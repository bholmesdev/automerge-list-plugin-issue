import {
  createEffect,
  createResource,
  createSignal,
  lazy,
  Show,
  Suspense,
} from "solid-js";
import { blockSchema, rep, type Entry } from "./cache.js";
// import "./FikaBlock.web.jsx";

export function App() {
  return (
    <main class="max-w-prose">
      <Suspense fallback={<p>Loading</p>}>
        <Suspended />
      </Suspense>
    </main>
  );
}

const Suspended = () => {
  const [draft] = createResource(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return rep.mutate.createDraftEntry();
  });

  return (
    <article>
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
