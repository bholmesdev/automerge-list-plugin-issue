import { Plugin, TextSelection } from "prosemirror-state";
import { autoMirror } from "./schema";

const { schema } = autoMirror;

export function listShortcutPlugin() {
  // Mutate meta directly, since `setMeta() is not supported by automerge.`
  // https://github.com/automerge/automerge-prosemirror/issues/19
  let meta = { active: false };
  const init = { active: false };

  const plugin = new Plugin({
    state: {
      init() {
        return init;
      },
      apply(tr, value) {
        return meta;
      },
    },
    props: {
      handleKeyDown(view, event) {
        const { active } = plugin.getState(view.state) ?? init;
        const { $from } = view.state.selection;
        if (event.key === "-" && $from.parentOffset === 0) {
          meta = { active: true };
          view.dispatch(
            view.state.tr.insertText(event.key, view.state.selection.from)
          );
          return true;
        }
        if (active && event.key === " ") {
          let tr = view.state.tr;
          const li = schema.node(
            "list_item",
            null,
            schema.node(
              "paragraph",
              null,
              $from.parent.content.cut(0, $from.parent.content.size)
            )
          );
          const ul = schema.node("bullet_list", null, [li]);
          const parentPos = $from.start(-1);

          view.dispatch(
            tr
              .replaceWith(parentPos, parentPos + $from.parent.nodeSize, ul)
              .setSelection(TextSelection.create(tr.doc, parentPos + 1))
          );
          // -----------
          // Code to handle joining adjacent lists.
          // Commented for now to debug the above base case.
          //
          // const nodeBefore = view.state.doc.resolve(
          //   $from.start() - 1
          // ).nodeBefore;
          // const nodeAfter = view.state.doc.resolve(
          //   $from.end() + 1
          // ).nodeAfter;

          // const children: Node[] = [];
          // let rangeStart = $from.start();
          // let rangeEnd = $from.end();
          // let selectionToRestore = $from.start() + 1;

          // if (nodeBefore?.type.name === "bullet_list") {
          //   nodeBefore.forEach((node) => children.push(node));
          //   rangeStart = $from.start() - nodeBefore.nodeSize;
          //   // Account for collapsed blocks when joining
          //   selectionToRestore -= 2;
          // }
          // children.push(li);
          // if (nodeAfter?.type.name === "bullet_list") {
          //   nodeAfter.forEach((node) => children.push(node));
          //   rangeEnd = $from.end() + nodeAfter.nodeSize;
          // }
          // const list = schema.node("bullet_list", null, children);
          // console.log(list);
          // meta = init;
          // tr = tr.replaceRangeWith(rangeStart, rangeEnd, list);
          // // restoreSelection(tr, selectionToRestore);
          // view.dispatch(tr);
          return true;
        }
        meta = init;
        return false;
      },
    },
  });
  return plugin;
}
