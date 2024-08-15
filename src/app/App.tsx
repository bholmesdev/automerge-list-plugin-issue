import {
  createEffect,
  createResource,
  createSignal,
  lazy,
  Show,
  Suspense,
} from "solid-js";
import { blockSchema, rep, type Entry } from "./cache.js";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { Schema } from "prosemirror-model";

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
        marks: "_",
      },
      blockquote: {
        content: "block+",
        group: "block",
        parseDOM: [{ tag: "blockquote" }],
        toDOM() {
          return ["blockquote", 0];
        },
      },
      text: { inline: true },
    },
    marks: {
      strong: {
        toDOM() {
          return ["strong", 0];
        },
        parseDOM: [
          { tag: "strong" },
          { tag: "b" },
          { style: "font-weight=bold" },
        ],
      },
      em: {
        toDOM() {
          return ["em", 0];
        },
        parseDOM: [{ tag: "em" }, { tag: "i" }, { style: "font-style=italic" }],
      },
    },
  });

  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("One.")]),
    schema.node("paragraph", { style: "color:red" }, [schema.text("One.")]),
    schema.node("paragraph", null, [schema.text("Two!")]),
  ]);

  const state = EditorState.create({
    doc,
    schema,
    plugins: [
      history(),
      keymap({
        "Mod-z": undo,
        "Mod-y": redo,
        "Mod-b"(state, dispatch) {
          if (!dispatch) return false;

          let isBold = true;

          state.doc.nodesBetween(
            state.selection.from,
            state.selection.to,
            (node) => {
              isBold = node.marks.includes(schema.mark("strong"));
              return !isBold;
            },
          );
          if (isBold) {
            dispatch(
              state.tr.removeMark(
                state.selection.from,
                state.selection.to,
                schema.mark("strong"),
              ),
            );
          } else {
            dispatch(
              state.tr.addMark(
                state.selection.from,
                state.selection.to,
                schema.mark("strong"),
              ),
            );
          }
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
