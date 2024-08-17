import { z } from "astro/zod";
import { Replicache, type WriteTransaction } from "replicache";
import { REPLICACHE_LICENSE_KEY } from "./consts";
import { createSignal } from "solid-js";
import Slugger from "github-slugger";
import { alphabet, generateRandomString } from "oslo/crypto";

export const createID = (prefix = "") =>
  prefix + generateRandomString(8, alphabet("a-z", "A-Z", "0-9"));

type BlockID = string;

export type Entry = {
  title: string;
  tags: string[];
  body: BlockID[];
};

const draftSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  body: z.array(z.string()),
});

export const blockSchema = z.object({
  type: z.enum(["text"]),
  content: z.string(),
});

type Block = z.infer<typeof blockSchema>;

export const rep = new Replicache({
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
      if (existingDraft) return draftSchema.parse(existingDraft);

      const blockID = `block:${createID()}`;

      await tx.set(blockID, {
        type: "text",
        content: "Start typing...",
      });

      await tx.set("entry:draft", {
        title: "Untitled",
        tags: [],
        body: [blockID],
      });

      return draftSchema.parse(await tx.get("entry:draft"));
    },
    async updateEntryTitle(tx: WriteTransaction, title: string) {
      const draft = draftSchema.parse(await tx.get("entry:draft"));
      if (!draft) throw new Error("No draft found.");

      await tx.set("entry:draft", {
        ...draft,
        title,
      });
    },
    async updateBlock(
      tx: WriteTransaction,
      payload: { id: string; change: Partial<Block> },
    ) {
      const rawBlock = await tx.get(payload.id);
      if (!rawBlock) throw new Error("No block found.");
      const block = blockSchema.parse(rawBlock);

      await tx.set(payload.id, {
        ...block,
        ...payload.change,
      });
    },
  },
});

export function repSignal<TValidator extends z.ZodType>(
  id: string,
  validator: TValidator,
): z.infer<TValidator> | undefined {
  const [value, setValue] = createSignal<any>(undefined);
  rep.subscribe((tx) => tx.get(id), setValue);

  return value() !== undefined ? validator.parse(value()) : undefined;
}
