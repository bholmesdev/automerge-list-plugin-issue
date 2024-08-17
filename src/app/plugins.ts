import { Schema } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";
import {
  nodes as nodesBase,
  marks as marksBase,
} from "prosemirror-schema-basic";

export const schema = new Schema({
  nodes: {
    ...nodesBase,
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
