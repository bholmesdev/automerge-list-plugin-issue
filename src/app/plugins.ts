import { Schema, type Node } from "prosemirror-model";
import { Plugin, TextSelection, Transaction } from "prosemirror-state";
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
        const state = plugin.getState(view.state) ?? init;
        const { $from } = view.state.selection;
        if (event.key === "#" && $from.parentOffset === state.offset) {
          if (state.offset + 1 > LEVELS) {
            view.dispatch(view.state.tr.setMeta(plugin, init));
            return false;
          }
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                active: true,
                offset: state.offset + 1,
              })
              .insertText("#", view.state.selection.from),
          );
          return true;
        }
        if (state.offset > 0 && event.key === " ") {
          const tr = view.state.tr
            .setMeta(plugin, init)
            .setBlockType(
              $from.start(),
              $from.end(),
              schema.node("heading").type,
              { level: state.offset },
            )
            .delete(
              view.state.selection.from - state.offset,
              view.state.selection.from,
            );
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
        const { $from } = view.state.selection;
        if (event.key === "-" && $from.parentOffset === 0) {
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                active: true,
              })
              .insertText(event.key, view.state.selection.from),
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
          // TODO: learn about mappings. Cursor is incorrect when merging nodes.
          restoreSelection(tr, view.state.selection.from);
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
  const init:
    | { lastInput: "none"; start: undefined }
    | { lastInput: "number" | "period"; start: number } = {
    lastInput: "none",
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
        const state = plugin.getState(view.state) ?? init;
        const { selection } = view.state;
        const { $from } = view.state.selection;
        if (
          NUMBERS.includes(event.key) &&
          ($from.parentOffset === 0 || state.lastInput === "number")
        ) {
          console.log("start", parseInt(`${state.start}${event.key}`));
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                lastInput: "number",
                start: parseInt(
                  state.start ? `${state.start}${event.key}` : event.key,
                ),
              })
              .insertText(event.key, selection.from),
          );
          return true;
        }
        if (state.lastInput === "number" && event.key === ".") {
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                lastInput: "period",
                start: state.start,
              })
              .insertText(".", selection.from),
          );
          return true;
        }
        if (state.lastInput === "period" && event.key === " ") {
          const li = schema.node(
            "list_item",
            null,
            $from.parent.content.cut(
              state.start?.toString().length + 1,
              $from.parent.content.size,
            ),
          );
          const nodeBefore = view.state.doc.resolve(
            $from.start() - 1,
          ).nodeBefore;
          const nodeAfter = view.state.doc.resolve($from.end() + 1).nodeAfter;

          const children: Node[] = [];
          let rangeStart = $from.start();
          let rangeEnd = $from.end();

          let start = state.start;
          if (nodeBefore?.type.name === "ordered_list") {
            nodeBefore.forEach((node) => children.push(node));
            rangeStart = $from.start() - nodeBefore.nodeSize;
            start = nodeBefore.attrs.start;
          }
          children.push(li);
          if (nodeAfter?.type.name === "ordered_list") {
            nodeAfter.forEach((node) => children.push(node));
            rangeEnd = $from.end() + nodeAfter.nodeSize;
          }
          const list = schema.node("ordered_list", { start }, children);
          let tr = view.state.tr
            .setMeta(plugin, init)
            .replaceRangeWith(rangeStart, rangeEnd, list);
          // TODO: learn about mappings. Cursor is incorrect when merging nodes.
          restoreSelection(tr, selection.from - state.start.toString().length);
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

function restoreSelection(tr: Transaction, position: number) {
  return tr.setSelection(new TextSelection(tr.doc.resolve(position)));
}
