import type { Mark } from "prosemirror-model";
import { TextSelection, type Command } from "prosemirror-state";
import { autoMirror } from "./schema";

const { schema } = autoMirror;

// Learned about $from.marks() from source:
// https://github.com/ProseMirror/prosemirror-commands/blob/master/src/commands.ts#L602
export function toggleMark(
  mark: Mark,
  selectionBehavior: "preserve" | "focus-end" = "preserve"
): Command {
  return (state, dispatch): boolean => {
    if (!dispatch) return false;

    const { $from } = state.selection;
    if (mark.isInSet(state.storedMarks ?? $from.marks())) {
      dispatch(state.tr.removeStoredMark(mark));
    } else {
      dispatch(state.tr.addStoredMark(mark));
    }

    if (state.selection.from === state.selection.to) return true;

    let isActive = true;
    state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
      if (!isActive) return false;

      const isAlreadyToggled = mark.isInSet(node.marks);
      if (!isAlreadyToggled && node.isLeaf) {
        isActive = false;
      }
      return !isAlreadyToggled;
    });
    let tr = isActive
      ? state.tr.removeMark(state.selection.from, state.selection.to, mark)
      : state.tr.addMark(state.selection.from, state.selection.to, mark);
    if (selectionBehavior === "focus-end") {
      tr = tr.setSelection(TextSelection.create(tr.doc, state.selection.to));
    }
    dispatch(tr);
    return true;
  };
}

export function splitToParagraph(): Command {
  return (state, dispatch) => {
    if (!dispatch) return false;

    const { $from } = state.selection;
    if ($from.parent.type === schema.node("paragraph").type) return false;
    if ($from.parent.type === schema.node("list_item").type) {
      let tr = state.tr;
      if (state.doc.resolve($from.before()).nodeBefore) {
        tr = tr.split($from.before());
      }
      const before = tr.mapping.map($from.before());
      const after = tr.mapping.map($from.after());
      tr = tr
        .deleteRange(before, after)
        .insert(
          before - 1,
          schema.node("paragraph", null, $from.parent.content)
        )
        .setSelection(TextSelection.create(tr.doc, before));

      dispatch(tr);
      return true;
    }

    const tr = state.tr.setBlockType(
      $from.start(),
      $from.end(),
      schema.node("paragraph").type
    );

    dispatch(tr);
    return true;
  };
}
