import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { DocHandle } from "@automerge/automerge-repo";
import { onCleanup } from "solid-js";
import { autoMirror } from "./schema";
import { toggleMark } from "./commands";
import { listShortcutPlugin } from "./plugins";

export function Editor(props: { handle: DocHandle<unknown> }) {
  const editorState = EditorState.create({
    doc: autoMirror.initialize(props.handle),
    schema: autoMirror.schema,
    plugins: [
      listShortcutPlugin(),
      keymap({
        "Mod-b": toggleMark(autoMirror.schema.marks.strong.create()),
        "Mod-i": toggleMark(autoMirror.schema.marks.em.create()),
      }),
      keymap(baseKeymap),
    ],
  });

  return (
    <article>
      <div
        class="focus:outline-none mt-4"
        ref={(el) => {
          const view = new EditorView(
            (editor) => {
              editor.className = el.className;
              el.replaceWith(editor);

              props.handle.on("change", ({ doc, patches, patchInfo }) => {
                const newState = autoMirror.reconcilePatch(
                  patchInfo.before,
                  doc,
                  patches,
                  view.state
                );
                view.updateState(newState);
              });

              onCleanup(() => props.handle.removeListener("change"));
            },
            {
              state: editorState,
              dispatchTransaction: (tx: Transaction) => {
                const newState = autoMirror.intercept(
                  props.handle,
                  tx,
                  view.state
                );
                view.updateState(newState);
              },
            }
          );
        }}
      />
    </article>
  );
}
