import { baseKeymap } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Schema } from "prosemirror-model";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createSignal, onCleanup } from "solid-js";
import {
  createIndexes,
  createRelationships,
  createStore,
  type Id,
} from "tinybase/with-schemas";

export function App() {
  const blocks = getBlocks();
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
        <h1>{draft.title}</h1>
        <article>
          <div
            class="focus:outline-none mt-4"
            ref={(el) => editorRef(el, editorState)}
          />
        </article>
      </div>
      <Debugger />
    </main>
  );
}

function Debugger() {
  const [blocks, setBlocks] = createSignal(getBlocks());

  const listener = store.addTablesListener(() => {
    setBlocks(getBlocks());
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

const schema = new Schema({
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

function editorRef(el: HTMLElement, editorState: EditorState) {
  const view = new EditorView(
    (editor) => {
      editor.className = el.className;
      el.replaceWith(editor);
    },
    {
      state: editorState,
      dispatchTransaction: (transaction) =>
        dispatchTransaction(transaction, view),
    },
  );
}

function dispatchTransaction(transaction: Transaction, view: EditorView) {
  if (transaction.steps.length === 0) {
    const newState = view.state.apply(transaction);
    view.updateState(newState);
    return;
  }
  const oldDoc = view.state.tr.doc;
  const newDoc = transaction.doc;

  const visitedBlocks = new Set<Id>();
  for (const blockId of relations.getLocalRowIds("documentBlocks", "draft")) {
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
          type: node.type.name,
          documentId: "draft",
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

const store = createStore()
  .setTablesSchema({
    documents: { title: { type: "string", required: true } },
    blocks: {
      type: { type: "string", required: true },
      documentId: { type: "string", required: true },
      text: { type: "string" },
      index: { type: "number", required: true },
    },
  })
  .setTables({
    documents: {
      draft: { title: "Untitled" },
    },
    blocks: {
      "1": {
        type: "paragraph",
        documentId: "draft",
        text: "Hello world",
        index: 0,
      },
      "2": {
        type: "paragraph",
        documentId: "draft",
        text: "Goodbye world",
        index: 1,
      },
      "3": {
        type: "paragraph",
        documentId: "draft",
        text: "Welcome world",
        index: 2,
      },
    },
  });

const relations = createRelationships(store).setRelationshipDefinition(
  "documentBlocks",
  "blocks",
  "documents",
  "documentId",
);

export const indexes = createIndexes(store).setIndexDefinition(
  "blockIndex",
  "blocks",
  "index",
);

store.addRow("documents", { title: "string" });

const document = store.getRow("documents", "draft");
export const draft = { title: document.title!, blocks: getBlocks() };

function getBlocks() {
  const blockIds = relations.getLocalRowIds("documentBlocks", "draft");
  return blockIds
    .map((blockId) => {
      const block = store.getRow("blocks", blockId);
      return {
        ...block,
        id: blockId,
      };
    })
    .sort((a, b) => a.index! - b.index!);
}
