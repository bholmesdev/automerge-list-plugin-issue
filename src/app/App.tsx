import {
  consoleLogSink,
  Replicache,
  type ReplicacheOptions,
  type WriteTransaction,
} from "replicache";
import { REPLICACHE_LICENSE_KEY } from "./consts";
import Slugger from "github-slugger";
import { createResource, createSignal, Show } from "solid-js";
import type { Node } from "@markdoc/markdoc";

type Block = string;

type Entry = {
  title: string;
  tags: string[];
  body: Block[];
};

const rep = new Replicache({
  licenseKey: REPLICACHE_LICENSE_KEY,
  // TODO: users
  name: "global-user",
  mutators: {
    async setEntry(
      tx: WriteTransaction,
      entry: { title: string; body: string },
    ) {
      const id = new Slugger().slug(entry.title);
      await tx.set(id, entry);
    },
    async createDraftEntry(tx: WriteTransaction) {
      const existingDraft = await tx.get("entry:draft");
      if (existingDraft) return existingDraft;

      await tx.set("entry:draft", {
        title: "Untitled",
        tags: [],
        body: ["Start typing..."],
      });

      return tx.get("entry:draft");
    },
    async updateEntryTitle(tx: WriteTransaction, title: string) {
      const draft = await tx.get("entry:draft");
      if (!draft) throw new Error("No draft found.");

      await tx.set("entry:draft", {
        ...draft,
        title,
      });
    },
  },
});

const repSignal = (id: string) => {
  const [value, setValue] = createSignal<any>(undefined);
  rep.subscribe((tx) => tx.get(id), setValue);

  return value;
};

export function App() {
  const [draft] = createResource(rep.mutate.createDraftEntry);

  return (
    <main class="max-w-prose">
      <p>{rep.idbName}</p>
      <Show when={draft()}>
        {(value) => (
          <>
            <h1
              contentEditable
              onInput={(e) =>
                rep.mutate.updateEntryTitle(e.target.textContent ?? "")
              }
              class="text-2xl font-bold"
            >
              {value().title}
            </h1>
            {value().body.map((text) => (
              <p contentEditable>{text}</p>
            ))}
          </>
        )}
      </Show>
    </main>
  );
}
