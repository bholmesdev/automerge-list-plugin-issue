import { baseKeymap } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Schema } from "prosemirror-model";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createEffect, createSignal, onCleanup } from "solid-js";
import {
  indexes,
  store,
  relations,
  getBlocks,
  getRelationIds,
  useRelationsListener,
  useStoreListener,
} from "./store";
import type { Id } from "tinybase/with-schemas";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { useParams } from "@solidjs/router";

function getTags(docId: string): Array<[Id, string]> {
  const tagIds = getRelationIds("docTagsJunction", docId, "tagId");
  return tagIds.map((id) => [id, store.getCell("tags", id, "name")!]);
}

export function DocumentView() {
  const { id: docId } = useParams();
  const [tags, setTags] = createSignal(getTags(docId));

  useRelationsListener(
    relations.addLocalRowIdsListener("docTagsJunction", docId, () => {
      setTags(getTags(docId));
    }),
  );

  const blocks = getBlocks(docId);
  const doc = schema.node(
    "doc",
    null,
    blocks.map((block) =>
      schema.node("paragraph", null, schema.text(block.text!)),
    ),
  );
  const editorState = EditorState.create({
    doc,
    schema,
    plugins: [
      history(),
      keymap({
        "Mod-z": undo,
        "Mod-y": redo,
      }),
      keymap(baseKeymap),
    ],
  });

  return (
    <div class="p-16 shadow-slate-100 shadow-2xl min-h-dvh">
      <h1
        class="text-5xl focus:outline-none mb-6"
        contentEditable="plaintext-only"
        onInput={(e) =>
          store.setCell("docs", docId, "title", e.target.textContent ?? "")
        }
      >
        {store.getRow("docs", docId).title}
      </h1>
      <ul class="flex gap-2 mb-12">
        {tags().map(([tagId, tag]) => (
          <li class="rounded-full px-2 py-1 bg-slate-100 text-sm">
            #{tag}{" "}
            <button
              onClick={() => {
                const ids = indexes.getSliceRowIds("docsTagsJunction", tagId);
                for (const id of ids) {
                  store.delRow("docsTagsJunction", id);
                }
              }}
            >
              x
            </button>
          </li>
        ))}
        <button
          onClick={() => {
            const tag = prompt("Enter a tag name");
            if (tag) {
              const [existingTag] = indexes.getSliceRowIds("tag", tag);
              if (existingTag) {
                const [alreadyInJunction] = indexes.getSliceRowIds(
                  "docsTagsJunction",
                  existingTag,
                );
                if (alreadyInJunction) return;
                return store.addRow("docsTagsJunction", {
                  docId,
                  tagId: existingTag,
                });
              }
              const tagId = store.addRow("tags", { name: tag });
              store.addRow("docsTagsJunction", { docId, tagId });
            }
          }}
        >
          Add Tag
        </button>
      </ul>
      <article>
        <div
          class="focus:outline-none mt-4"
          ref={(el) => {
            const view = new EditorView(
              (editor) => {
                editor.className = el.className;
                el.replaceWith(editor);
              },
              {
                state: editorState,
                dispatchTransaction: (transaction) =>
                  syncStore(transaction, view, docId),
              },
            );
          }}
        />
      </article>
      <Debugger docId={docId} />
    </div>
  );
}

function Debugger(props: { docId: string }) {
  const [document, setDocument] = createSignal(
    store.getRow("docs", props.docId),
  );
  const [blocks, setBlocks] = createSignal(getBlocks(props.docId));
  const [isOpen, setIsOpen] = createSignal(
    new URL(window.location.href).searchParams.has("debug"),
  );
  let trigger: HTMLButtonElement | undefined;
  let panel: HTMLDivElement | undefined;

  useStoreListener(
    store.addTablesListener(async () => {
      setDocument(store.getRow("docs", props.docId));
      setBlocks(getBlocks(props.docId));
      await updatePosition();
    }),
  );

  async function updatePosition() {
    if (!trigger || !panel) return;
    const { x, y } = await computePosition(trigger, panel, {
      placement: "bottom-end",
      middleware: [offset(), flip(), shift()],
    });
    Object.assign(panel.style, {
      left: `${x}px`,
      top: `${y + 6}px`,
    });
  }

  return (
    <>
      <button
        onClick={async () => {
          setIsOpen((v) => !v);
          await updatePosition();
        }}
        ref={trigger}
        class="fixed bottom-4 right-4 bg-gray-800 text-white rounded px-2 py-1"
      >
        Debug
      </button>
      <div
        ref={(el) => {
          panel = el;
          updatePosition();
        }}
        classList={{
          invisible: !isOpen(),
          visible: isOpen(),
        }}
        class="absolute p-4 bg-gray-800 flex-col gap-4 text-white max-w-md max-h-[95dvh] overflow-auto"
      >
        <h2>Document</h2>
        <pre class="bg-gray-800 text-white p-4 text-sm">
          {JSON.stringify(document(), null, 2)}
        </pre>
        <h2>Blocks</h2>
        <pre class="bg-gray-800 text-white p-4 text-sm">
          {JSON.stringify(blocks(), null, 2)}
        </pre>
      </div>
    </>
  );
}

export const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      content: "text*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM() {
        return ["p", 0];
      },
    },
    text: { group: "inline" },
  },
  marks: {},
});

function syncStore(transaction: Transaction, view: EditorView, docId: string) {
  if (transaction.steps.length === 0) {
    const newState = view.state.apply(transaction);
    view.updateState(newState);
    return;
  }
  const oldDoc = view.state.tr.doc;
  const newDoc = transaction.doc;

  const visitedBlocks = new Set<Id>();
  for (const blockId of relations.getLocalRowIds("docBlocks", docId)) {
    visitedBlocks.add(blockId);
    const block = store.getRow("blocks", blockId);
    const pos = oldDoc.resolve(0).posAtIndex(block.index!);
    const newIndex = newDoc.resolve(transaction.mapping.map(pos)).index();
    console.log("block", block, block.index, newIndex);
    store.setCell("blocks", blockId, "index", newIndex);
  }

  newDoc.descendants((node, pos, parent, index) => {
    if (node.isBlock) {
      const [match, ...toDelete] = indexes.getSliceRowIds(
        "blockIndex",
        `${index}`,
      );
      if (!match) {
        store.addRow("blocks", {
          docId,
          type: node.type.name,
          text: node.textContent,
          index,
        });
        return false;
      }
      visitedBlocks.delete(match);
      store.setCell("blocks", match, "text", node.textContent);
    }
    return false;
  });
  for (const unvisited of visitedBlocks) {
    store.delRow("blocks", unvisited);
  }

  const newState = view.state.apply(transaction);
  view.updateState(newState);
}
