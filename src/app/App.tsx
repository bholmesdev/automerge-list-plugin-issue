import {
  createEffect,
  createResource,
  createSignal,
  lazy,
  Show,
  Suspense,
} from "solid-js";
import { blockSchema, rep, type Entry } from "./cache.js";
import { schema } from "prosemirror-schema-basic";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";

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
    schema.node("paragraph", null, [schema.text("One.")]),
    schema.node("horizontal_rule"),
    schema.node("blockquote", null, [
      schema.node("paragraph", { style: "color:red" }, [schema.text("One.")]),
      schema.node("paragraph", null, [schema.text("Two!")]),
    ]),
  ]);

  const state = EditorState.create({
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
    <article class="max-w-prose mx-auto py-8">
      <h1
        contentEditable
        onInput={(e) => rep.mutate.updateEntryTitle(e.target.textContent ?? "")}
        class="text-2xl font-bold"
      >
        {draft()?.title}
      </h1>
      <div>{draft()?.body.map((id) => <BlockRenderer id={id} />)}</div>
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
