import { createResource, createSignal, Show, Suspense } from "solid-js";
import { createID, rep } from "./cache.js";
import { EditorState, type Command } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { type MarkType, type Attrs } from "prosemirror-model";
import {
  headingShortcutPlugin,
  listShortcutPlugin,
  orderedListShortcutPlugin,
} from "./plugins.js";
import { schema } from "./schema.js";
import { LinkPopover } from "./link/popover.jsx";
import { linkView } from "./link/view.jsx";

export function App() {
  return (
    <main>
      <Suspense fallback={<p>Loading</p>}>
        <Suspended />
      </Suspense>
    </main>
  );
}

const Suspended = () => {
  const [draft] = createResource(async () => {
    return rep.mutate.createDraftEntry();
  });

  const doc = schema.node("doc", null, [
    schema.node("paragraph", { id: createID("block") }, [schema.text("One.")]),
    schema.node("paragraph", { id: createID("block") }, [schema.text("Two.")]),
    schema.node("paragraph", { id: createID("block") }, [
      schema.text("Three!", [
        schema.marks.link.create({ href: "https://example.com" }),
      ]),
    ]),
    schema.node("paragraph", { id: createID("block") }, [
      schema.text("Four?", [
        schema.marks.link.create({ href: "https://google.com" }),
      ]),
    ]),
  ]);

  const state = EditorState.create({
    doc,
    schema,
    plugins: [
      headingShortcutPlugin(),
      listShortcutPlugin(),
      orderedListShortcutPlugin(),
      history(),
      keymap({
        "Mod-z": undo,
        "Mod-y": redo,
        "Mod-b": toggleMark(schema.marks.strong),
        "Mod-i": toggleMark(schema.marks.em),
        "Mod-shift-h": toggleMark(schema.marks.highlight),
        "Mod-shift-k": toggleMark(schema.marks.link, {
          href: "https://example.com",
        }),
      }),
      keymap(baseKeymap),
    ],
  });

  const [editorView, setEditorView] = createSignal<EditorView | undefined>(
    undefined,
  );
  return (
    <article class="max-w-prose mx-auto py-8">
      <h1
        contentEditable
        onInput={(e) => rep.mutate.updateEntryTitle(e.target.textContent ?? "")}
        class="text-2xl font-bold"
      >
        {draft()?.title}
      </h1>
      <div
        class="focus:outline-none mt-4"
        ref={(proseMirrorEl) => {
          if (!proseMirrorEl) return;
          const view = new EditorView(
            (editor) => {
              editor.className = proseMirrorEl.className;
              proseMirrorEl.replaceWith(editor);
            },
            {
              state,
              markViews: {
                link: linkView,
              },
            },
          );
          setEditorView(view);
          // applyDevTools(view);
        }}
      ></div>
      <Show when={editorView()}>
        {(view) => <LinkPopover editorView={view()} />}
      </Show>
    </article>
  );
};

// Learned about $from.marks() from source:
// https://github.com/ProseMirror/prosemirror-commands/blob/master/src/commands.ts#L602
function toggleMark(mark: MarkType, attrs?: Attrs): Command {
  return (state, dispatch): boolean => {
    if (!dispatch) return false;

    const { $from } = state.selection;
    if (mark.isInSet(state.storedMarks ?? $from.marks())) {
      dispatch(state.tr.removeStoredMark(mark));
    } else {
      dispatch(state.tr.addStoredMark(mark.create(attrs)));
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
    if (isActive) {
      dispatch(
        state.tr.removeMark(state.selection.from, state.selection.to, mark),
      );
    } else {
      dispatch(
        state.tr.addMark(
          state.selection.from,
          state.selection.to,
          mark.create(attrs),
        ),
      );
    }
    return true;
  };
}
