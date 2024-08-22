import {
  createRelationships,
  createStore,
  type Content,
} from "tinybase/with-schemas";
import type { Store } from "tinybase";
import { generateRandomString, alphabet } from "oslo/crypto";
import { createIndexedDbPersister } from "tinybase/persisters/persister-indexed-db";

export function createID(prefix?: string) {
  return `${prefix ? prefix + "-" : ""}${generateRandomString(8, alphabet("A-Z", "a-z"))}`;
}

export const store = createStore().setTablesSchema({
  documents: { title: { type: "string", required: true } },
  blocks: {
    type: { type: "string", required: true },
    documentId: { type: "string", required: true },
    order: { type: "number", required: true },
  },
  inline: {
    content: { type: "string" },
    blockId: { type: "string" },
    order: { type: "number" },
  },
  marks: {
    type: { type: "string" },
    inlineId: { type: "string" },
  },
});

// Seems the "with schema" breaks persister types
// TODO: report issue
const persister = createIndexedDbPersister(store as unknown as Store, "fika");

const defaultTables = {
  documents: {
    draft: { title: "Untitled" },
  },
  blocks: {
    "1": {
      type: "paragraph",
      documentId: "draft",
      order: "1",
    },
    "2": {
      type: "paragraph",
      documentId: "draft",
      order: "2",
    },
  },
  inline: {
    "1": { content: "Hello world", blockId: "1", order: 1 },
    "2": { content: "Goodbye world", blockId: "2", order: 1 },
  },
  marks: {
    "1": { type: "strong", inlineId: "1" },
    "2": { type: "highlight", inlineId: "2" },
  },
};
await persister.startAutoLoad([defaultTables, {}]);
await persister.startAutoSave();

export const relations = createRelationships(store)
  .setRelationshipDefinition(
    "documentBlocks",
    "blocks",
    "documents",
    "documentId",
  )
  .setRelationshipDefinition("blockInline", "inline", "blocks", "blockId")
  .setRelationshipDefinition("inlineMarks", "marks", "inline", "inlineId");

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
        inline: getInline(blockId),
      };
    })
    .sort((a, b) => a.order! - b.order!);
}

function getInline(blockId: string) {
  const inlineIds = relations.getLocalRowIds("blockInline", blockId);
  return inlineIds
    .map((inlineId) => {
      const inline = store.getRow("inline", inlineId);
      return {
        ...inline,
        id: inlineId,
        marks: getMarks(inlineId),
      };
    })
    .sort((a, b) => a.order! - b.order!);
}

function getMarks(inlineId: string) {
  const markIds = relations.getLocalRowIds("inlineMarks", inlineId);
  return markIds.map((markId) => store.getRow("marks", markId));
}
