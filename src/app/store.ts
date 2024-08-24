import {
  createIndexes,
  createRelationships,
  createStore,
} from "tinybase/with-schemas";

export const store = createStore()
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

export const relations = createRelationships(store).setRelationshipDefinition(
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

export function getBlocks(documentId: string) {
  const blockIds = relations.getLocalRowIds("documentBlocks", documentId);
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
