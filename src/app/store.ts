import { createSignal, onCleanup } from "solid-js";
import type { Cell, CellId, Row, Table, TableId } from "store:types";
import {
  createIndexes,
  createRelationships,
  createMergeableStore,
  type Id,
} from "tinybase/with-schemas";

export const store = createMergeableStore()
  .setTablesSchema({
    docs: { title: { type: "string", required: true } },
    blocks: {
      type: { type: "string", required: true },
      docId: { type: "string", required: true },
      text: { type: "string" },
      index: { type: "number", required: true },
    },
    hubs: {
      name: { type: "string" },
      textSearch: { type: "string" },
    },
    hubsTagsJunction: {
      hubId: { type: "string", required: true },
      tagId: { type: "string", required: true },
    },
    docsTagsJunction: {
      docId: { type: "string", required: true },
      tagId: { type: "string", required: true },
    },
    tags: {
      name: { type: "string" },
    },
  })
  .setTables({
    docs: {
      draft: { title: "Untitled" },
    },
    blocks: {
      "1": {
        type: "paragraph",
        docId: "draft",
        text: "Hello world",
        index: 0,
      },
      "2": {
        type: "paragraph",
        docId: "draft",
        text: "Goodbye world",
        index: 1,
      },
      "3": {
        type: "paragraph",
        docId: "draft",
        text: "Welcome world",
        index: 2,
      },
    },
    tags: {
      "1": { name: "learning-list" },
    },
    hubs: {
      "1": { name: "Learning" },
    },
    hubsTagsJunction: {
      "1": { hubId: "1", tagId: "1" },
    },
    docsTagsJunction: {
      "1": { docId: "draft", tagId: "1" },
    },
  });

export const relations = createRelationships(store)
  .setRelationshipDefinition("docBlocks", "blocks", "docs", "docId")
  .setRelationshipDefinition(
    "hubTagsJunction",
    "hubsTagsJunction",
    "hubs",
    "hubId",
  )
  .setRelationshipDefinition(
    "tagDocsJunction",
    "docsTagsJunction",
    "tags",
    "tagId",
  )
  .setRelationshipDefinition(
    "docTagsJunction",
    "docsTagsJunction",
    "docs",
    "docId",
  );

export function useRow<T extends TableId>(tableId: T, rowId: Id) {
  const [row, setRow] = createSignal<Row<T> | undefined>(
    store.getRow(tableId, rowId) as any,
  );

  const listener = store.addRowListener(tableId, rowId, (store) => {
    setRow(store.getRow(tableId, rowId) as any);
  });
  onCleanup(() => {
    store.delListener(listener);
  });
  return row;
}

export function useCell<T extends TableId>(
  tableId: T,
  rowId: Id,
  cellId: CellId<T>,
) {
  const [cell, setCell] = createSignal<Cell<T, CellId<T>> | undefined>(
    store.getCell(tableId, rowId, cellId as any) as any,
  );

  const listener = store.addCellListener(tableId, rowId, cellId as any, () => {
    const cell = store.getCell(tableId, rowId, cellId as any);
    setCell(cell as any);
  });
  onCleanup(() => {
    store.delListener(listener);
  });
  return cell;
}

export function getManyToManyIds(
  relationId: string,
  id: string,
  throughCell: string,
) {
  const ids = relations.getLocalRowIds(relationId, id);
  if (!throughCell) return ids;
  const table = relations.getLocalTableId(relationId);
  if (!table) throw new Error(`Invalid relation id: ${relationId}`);
  const throughIds = ids.map((junctionId) => {
    const result = store.getCell(table as any, junctionId, throughCell);
    if (typeof result !== "string")
      throw new Error(`Invalid through cell: ${throughCell}`);
    return result;
  });
  return throughIds;
}

export function useManyToManyIds(
  relationId: string,
  id: string,
  throughCell: string,
) {
  const [ids, setIds] = createSignal(
    getManyToManyIds(relationId, id, throughCell),
  );
  const listener = relations.addLocalRowIdsListener(relationId, id, () => {
    setIds(getManyToManyIds(relationId, id, throughCell));
  });
  onCleanup(() => {
    relations.delListener(listener);
  });
  return ids;
}

export function useStoreListener(listenerId: string) {
  onCleanup(() => {
    store.delListener(listenerId);
  });
}

export function useRelationsListener(listenerId: string) {
  onCleanup(() => {
    relations.delListener(listenerId);
  });
}

export const indexes = createIndexes(store)
  .setIndexDefinition("blockIndex", "blocks", "index")
  .setIndexDefinition("tag", "tags", "name")
  .setIndexDefinition("docsTagsJunction", "docsTagsJunction", "tagId");

export function getBlocks(docId: string) {
  const blockIds = relations.getLocalRowIds("docBlocks", docId);
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
