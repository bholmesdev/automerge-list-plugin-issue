import Dexie, { type EntityTable } from "dexie";
import type { Node } from "prosemirror-model";
import { schema } from "./schema";
import { createID } from "./cache";

type Document = {
  id: number;
  title: string;
};

export type Block = {
  id: string;
  documentId: number;
  text: string;
  content: Node;
};

export const db = new Dexie("fika") as Dexie & {
  documents: EntityTable<Document, "id">;
  blocks: EntityTable<Block, "id">;
};

db.version(1).stores({
  documents: "++id, title",
  blocks: "id, documentId, text, content",
});

const initialBlocks = [
  schema.node("paragraph", { id: createID("block") }, [schema.text("One.")]),
  schema.node("paragraph", { id: createID("block") }, [schema.text("Two.")]),
  schema.node("paragraph", { id: createID("block") }, [
    schema.text("Three!", [
      schema.marks.link.create({ href: "https://example.com" }),
    ]),
  ]),
  schema.node("paragraph", { id: createID("block") }, [
    schema.text("Four!!!!", [
      schema.marks.link.create({ href: "https://google.com" }),
    ]),
  ]),
];

db.on("populate", async (tr) => {
  const documentId: number = await tr
    .table<Omit<Document, "id">>("documents")
    .add({
      title: "Untitled",
    });
  await Promise.all(
    initialBlocks.map((block) =>
      tr.table<Block>("blocks").add({
        id: block.attrs.id,
        documentId,
        text: block.textContent,
        content: block.toJSON(),
      }),
    ),
  );
});
