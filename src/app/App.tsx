import { consoleLogSink, Replicache, type ReplicacheOptions } from "replicache";
import { REPLICACHE_LICENSE_KEY } from "./consts";
import Slugger from "github-slugger";
import { createSignal } from "solid-js";

const rep = new Replicache({
  licenseKey: REPLICACHE_LICENSE_KEY,
  // TODO: users
  name: "global-user",
  mutators: {
    async setEntry(tx, entry: { title: string; body: string }) {
      const id = new Slugger().slug(entry.title);
      await tx.set(id, entry);
    },
  },
});

const repSignal = (id: string) => {
  const [value, setValue] = createSignal<any>(undefined);
  rep.subscribe((tx) => tx.get(id), setValue);

  return value;
};

let count = 0;

export function App() {
  const value = repSignal("test");

  return (
    <main class="max-w-prose">
      <p>{rep.idbName}</p>
      <h1 contentEditable>{value()?.title}</h1>
      <div contentEditable>{value()?.body}</div>

      <button
        onClick={() =>
          rep.mutate.setEntry({
            title: "Test",
            body: `The count is ${count++}`,
          })
        }
      >
        Update entry
      </button>
    </main>
  );
}
