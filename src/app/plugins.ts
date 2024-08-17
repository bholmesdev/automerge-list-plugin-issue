import { Schema, type Node } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";
import {
  nodes as nodesBase,
  marks as marksBase,
} from "prosemirror-schema-basic";

export const schema = new Schema({
  nodes: {
    ...nodesBase,
    bulleted_list: {
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ul" }],
      toDOM() {
        return ["ul", 0];
      },
    },
    ordered_list: {
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ol" }],
      toDOM() {
        return ["ol", 0];
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
