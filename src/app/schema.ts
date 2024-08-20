import { Schema } from "prosemirror-model";
import {
  nodes as nodesBase,
  marks as marksBase,
} from "prosemirror-schema-basic";
import { createID } from "./db.js";

export const schema = new Schema({
  nodes: {
    ...nodesBase,
    bulleted_list: {
      content: "list_item+",
      group: "block",
      attrs: { id: { default: null } },
      parseDOM: [{ tag: "ul" }],
      toDOM(node) {
        return ["ul", getIDAttrs(node.attrs.id ?? createID()), 0];
      },
    },
    paragraph: {
      ...nodesBase.paragraph,
      attrs: { id: { default: null, validate: "string|null" } },
    },
    heading: {
      ...nodesBase.heading,
      attrs: {
        id: { default: null },
        level: { default: 1, validate: "number" },
      },
      toDOM(node) {
        const { id, style } = getIDAttrs(node.attrs.id ?? createID());
        return ["h" + node.attrs.level, { id }, ["span", { style }, 0]];
      },
    },
    ordered_list: {
      content: "list_item+",
      group: "block",
      attrs: {
        start: { default: 1, validate: "number" },
        id: { default: null },
      },
      parseDOM: [{ tag: "ol" }],
      toDOM(node) {
        return [
          "ol",
          {
            start: node.attrs.start,
            ...getIDAttrs(node.attrs.id ?? createID()),
          },
          0,
        ];
      },
    },
    list_item: {
      // TODO: revisit paragraphs within li
      content: "inline*",
      attrs: { id: { default: null } },
      parseDOM: [{ tag: "li" }],
      toDOM(node) {
        const { id, style } = getIDAttrs(node.attrs.id ?? createID());
        return ["li", { id }, ["span", { style }, 0]];
      },
    },
  },
  marks: {
    ...marksBase,
    highlight: {
      toDOM() {
        return ["mark", 0];
      },
      parseDOM: [{ tag: "mark" }],
    },
  },
});

function getIDAttrs(id: string) {
  return { id, style: `view-transition-name: ${id};` };
}
