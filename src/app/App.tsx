import { createResource, Suspense } from "solid-js";
import { blockSchema, createID, rep } from "./cache.js";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { Mark } from "prosemirror-model";
import {
  headingShortcutPlugin,
  listShortcutPlugin,
  orderedListShortcutPlugin,
  schema,
} from "./plugins.js";
import applyDevTools from "prosemirror-dev-tools";

export function App() {
  return (
    <main>
      <Suspense fallback={<p>Loading</p>}>
        <Suspended />
      </Suspense>
    </main>
  );
}

const Suspended = () => {
  const [draft] = createResource(async () => {
    return rep.mutate.createDraftEntry();
  });

  const doc = schema.node("doc", null, [
    schema.node("paragraph", { id: createID("block") }, [schema.text("One.")]),
    schema.node("paragraph", { id: createID("block") }, [schema.text("Two.")]),
    schema.node("paragraph", { id: createID("block") }, [
      schema.text("Three!"),
    ]),
  ]);

  const state = EditorState.create({
    doc,
    schema,
    plugins: [
      headingShortcutPlugin(),
      listShortcutPlugin(),
      orderedListShortcutPlugin(),
      history(),
      keymap({
        "Mod-z": undo,
        "Mod-y": redo,
        "Mod-b"(state, dispatch) {
          if (!dispatch) return false;
          dispatch(toggleMark(state, schema.mark("strong")));
          return true;
        },
        "Mod-i"(state, dispatch) {
          if (!dispatch) return false;
          dispatch(toggleMark(state, schema.mark("em")));
          return true;
        },
        "Mod-shift-h"(state, dispatch) {
          if (!dispatch) return false;
          dispatch(toggleMark(state, schema.mark("highlight")));
          return true;
        },
      }),
      keymap(baseKeymap),
    ],
  });

  return (
    <article class="max-w-prose mx-auto py-8">
      <h1
        contentEditable
        onInput={(e) => rep.mutate.updateEntryTitle(e.target.textContent ?? "")}
        class="text-2xl font-bold"
      >
        {draft()?.title}
      </h1>
      <div
        ref={(el) => {
          const view = new EditorView(el, {
            state,
            dispatchTransaction(transaction) {
              // const { before, doc } = transaction;
              // console.log(
              //   `went from ${before.content.size} to ${doc.content.size}`,
              // );
              const newState = view.state.apply(transaction);
              view.updateState(newState);
            },
          });
        }}
      />
    </article>
  );
};

function BlockRenderer({ id }: { id: string }) {
  const [block] = createResource(() =>
    rep.query(async (tx) => blockSchema.parse(await tx.get(id))),
  );

  return (
    <fika-block
      contentEditable
      onInput={(e) => console.log(e.target)}
      data-id={id}
    >
      {block()?.content}
    </fika-block>
  );
}

function toggleMark(state: EditorState, mark: Mark): Transaction {
  let selectionIsBold = true;

  state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
    if (!selectionIsBold) return false;

    const isBold = node.marks.includes(mark);
    if (!isBold && node.isLeaf) {
      selectionIsBold = false;
    }
    return !isBold;
  });
  if (selectionIsBold) {
    return state.tr.removeMark(state.selection.from, state.selection.to, mark);
  } else {
    return state.tr.addMark(state.selection.from, state.selection.to, mark);
  }
}
