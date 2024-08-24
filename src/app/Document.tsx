import { baseKeymap } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Schema } from "prosemirror-model";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createSignal, onCleanup } from "solid-js";
import { indexes, store, relations, getBlocks } from "./store";
import type { Id } from "tinybase/with-schemas";

export function DocumentView() {
  const documentId = "draft";
  const blocks = getBlocks(documentId);
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
    <main class="grid grid-cols-2 gap-4">
      <div class="p-4">
        <h1>{store.getRow("documents", documentId).title}</h1>
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
                    syncDocumentStore(transaction, view, documentId),
                },
              );
            }}
          />
        </article>
      </div>
      <Debugger documentId={documentId} />
    </main>
  );
}

function Debugger(props: { documentId: string }) {
  const [blocks, setBlocks] = createSignal(getBlocks(props.documentId));

  const listener = store.addTablesListener(() => {
    setBlocks(getBlocks(props.documentId));
  });

  onCleanup(() => {
    store.delListener(listener);
  });

  return (
    <pre class="bg-gray-800 text-white p-4 text-sm">
      {JSON.stringify(blocks(), null, 2)}
    </pre>
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

function syncDocumentStore(
  transaction: Transaction,
  view: EditorView,
  documentId: string,
) {
  if (transaction.steps.length === 0) {
    const newState = view.state.apply(transaction);
    view.updateState(newState);
    return;
  }
  const oldDoc = view.state.tr.doc;
  const newDoc = transaction.doc;

  const visitedBlocks = new Set<Id>();
  for (const blockId of relations.getLocalRowIds(
    "documentBlocks",
    documentId,
  )) {
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
          documentId,
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
