import { Schema, type Node } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";
import {
  nodes as nodesBase,
  marks as marksBase,
} from "prosemirror-schema-basic";
import { alphabet } from "oslo/crypto";

export const schema = new Schema({
  nodes: {
    ...nodesBase,
    bulleted_list: {
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ul" }],
      toDOM(node) {
        return ["ul", 0];
      },
    },
    ordered_list: {
      content: "list_item+",
      group: "block",
      attrs: { start: { default: 1, validate: "number" } },
      parseDOM: [{ tag: "ol" }],
      toDOM(node) {
        return ["ol", { start: node.attrs.start }, 0];
      },
    },
    list_item: {
      // TODO: revisit paragraphs within li
      content: "inline*",
      parseDOM: [{ tag: "li" }],
      toDOM() {
        return ["li", 0];
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

export function headingShortcutPlugin() {
  const LEVELS = 6;
  const init = { active: false, offset: 0 };
  const plugin = new Plugin({
    state: {
      init() {
        return init;
      },
      apply(tr, value) {
        // State payloads are passed via metadata. It's weird
        const meta = tr.getMeta(plugin);
        if (meta) return meta;
        return value;
      },
    },
    props: {
      handleKeyDown(view, event) {
        const { offset, active } = plugin.getState(view.state) ?? init;
        const { $from, from } = view.state.selection;
        const { parentOffset } = view.state.selection.$from;
        if (event.key === "#" && parentOffset === offset) {
          if (offset + 1 > LEVELS) {
            view.dispatch(view.state.tr.setMeta(plugin, init));
            return false;
          }
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                active: true,
                offset: offset + 1,
              })
              .insertText("#", view.state.selection.from),
          );
          return true;
        }
        if (offset > 0 && event.key === " ") {
          const heading = schema.node(
            "heading",
            { level: offset },
            $from.parent.content.cut(offset, $from.parent.content.size),
          );
          const tr = view.state.tr
            .setMeta(plugin, init)
            .replaceRangeWith($from.start(), $from.end(), heading);
          tr.setSelection(new TextSelection(tr.doc.resolve(from - offset)));
          view.dispatch(tr);
          return true;
        }
        view.dispatch(view.state.tr.setMeta(plugin, init));
        return false;
      },
    },
  });
  return plugin;
}

export function listShortcutPlugin() {
  const init = { active: false };
  const plugin = new Plugin({
    state: {
      init() {
        return init;
      },
      apply(tr, value) {
        // State payloads are passed via metadata. It's weird
        const meta = tr.getMeta(plugin);
        if (meta) return meta;
        return value;
      },
    },
    props: {
      handleKeyDown(view, event) {
        const { active } = plugin.getState(view.state) ?? init;
        const { $from, from } = view.state.selection;
        const { parentOffset } = view.state.selection.$from;
        if (event.key === "-" && parentOffset === 0) {
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                active: true,
              })
              .insertText("-", view.state.selection.from),
          );
          return true;
        }
        if (active && event.key === " ") {
          const li = schema.node(
            "list_item",
            null,
            $from.parent.content.cut(1, $from.parent.content.size),
          );
          const nodeBefore = view.state.doc.resolve(
            $from.start() - 1,
          ).nodeBefore;
          const nodeAfter = view.state.doc.resolve($from.end() + 1).nodeAfter;

          const children: Node[] = [];
          let rangeStart = $from.start();
          let rangeEnd = $from.end();

          if (nodeBefore?.type.name === "bulleted_list") {
            nodeBefore.forEach((node) => children.push(node));
            rangeStart = $from.start() - nodeBefore.nodeSize;
          }
          children.push(li);
          if (nodeAfter?.type.name === "bulleted_list") {
            nodeAfter.forEach((node) => children.push(node));
            rangeEnd = $from.end() + nodeAfter.nodeSize;
          }
          const list = schema.node("bulleted_list", null, children);
          let tr = view.state.tr
            .setMeta(plugin, init)
            .replaceRangeWith(rangeStart, rangeEnd, list);
          tr.setSelection(new TextSelection(tr.doc.resolve(from)));
          view.dispatch(tr);
          return true;
        }
        view.dispatch(view.state.tr.setMeta(plugin, init));
        return false;
      },
    },
  });
  return plugin;
}

const NUMBERS = alphabet("0-9");

export function orderedListShortcutPlugin() {
  const init: { lastInput: "none" | "number" | "period"; start?: number } = {
    lastInput: "none",
    start: undefined,
  };
  const plugin = new Plugin({
    state: {
      init() {
        return init;
      },
      apply(tr, value) {
        // State payloads are passed via metadata. It's weird
        const meta = tr.getMeta(plugin);
        if (meta) return meta;
        return value;
      },
    },
    props: {
      handleKeyDown(view, event) {
        // TODO: handle multi-digit numbers
        const { lastInput, start } = plugin.getState(view.state) ?? init;
        const { $from, from } = view.state.selection;
        const { parentOffset } = view.state.selection.$from;
        if (NUMBERS.includes(event.key) && parentOffset === 0) {
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                lastInput: "number",
                start: parseInt(event.key),
              })
              .insertText(event.key, view.state.selection.from),
          );
          return true;
        }
        if (lastInput === "number" && event.key === ".") {
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                lastInput: "period",
                start,
              })
              .insertText(".", view.state.selection.from),
          );
          return true;
        }
        if (lastInput === "period" && event.key === " ") {
          const li = schema.node(
            "list_item",
            null,
            $from.parent.content.cut(2, $from.parent.content.size),
          );
          const nodeBefore = view.state.doc.resolve(
            $from.start() - 1,
          ).nodeBefore;
          const nodeAfter = view.state.doc.resolve($from.end() + 1).nodeAfter;

          const children: Node[] = [];
          let rangeStart = $from.start();
          let rangeEnd = $from.end();

          let startValue = start;
          if (nodeBefore?.type.name === "ordered_list") {
            nodeBefore.forEach((node) => children.push(node));
            rangeStart = $from.start() - nodeBefore.nodeSize;
            startValue = nodeBefore.attrs.start;
          }
          children.push(li);
          if (nodeAfter?.type.name === "ordered_list") {
            nodeAfter.forEach((node) => children.push(node));
            rangeEnd = $from.end() + nodeAfter.nodeSize;
          }
          const list = schema.node(
            "ordered_list",
            { start: startValue },
            children,
          );
          let tr = view.state.tr
            .setMeta(plugin, init)
            .replaceRangeWith(rangeStart, rangeEnd, list);
          tr.setSelection(new TextSelection(tr.doc.resolve(from)));
          view.dispatch(tr);
          return true;
        }
        view.dispatch(view.state.tr.setMeta(plugin, init));
        return false;
      },
    },
  });
  return plugin;
}
