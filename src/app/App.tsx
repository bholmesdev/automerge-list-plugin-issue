import { createSignal, Show, from } from "solid-js";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { Node } from "prosemirror-model";
import {
  headingShortcutPlugin,
  listShortcutPlugin,
  orderedListShortcutPlugin,
} from "./plugins.js";
import { schema } from "./schema.js";
import { LinkPopover, toggleLinkPopover } from "./link/popover.jsx";
import { linkView } from "./link/view.jsx";
import { splitToParagraph, toggleMark } from "./commands.js";
import { db, type Block } from "./db.js";
import { liveQuery } from "dexie";

export function App() {
  const document = from(
    liveQuery(async () => {
      const document = await db.documents.get(1);
      if (!document) throw new Error("Document not found: 1");
      return {
        title: document.title,
        blocks: await db.blocks
          .where("documentId")
          .equals(document.id)
          .toArray(),
      };
    }),
  );
  return (
    <main>
      <Show when={document()}>
        {(doc) => <Editor title={doc().title} blocks={doc().blocks} />}
      </Show>
    </main>
  );
}

const Editor = (props: { title: string; blocks: Block[] }) => {
  const doc = schema.node(
    "doc",
    null,
    props.blocks.map((block) => Node.fromJSON(schema, block.content)),
  );

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
        "Mod-b": toggleMark(schema.marks.strong.create()),
        "Mod-i": toggleMark(schema.marks.em.create()),
        "Mod-shift-h": toggleMark(schema.marks.highlight.create()),
        "Mod-shift-k": (state, dispatch) => {
          const mark = schema.marks.link.create({
            href: "",
          });
          const handled = toggleMark(mark, "focus-end")(state, dispatch);
          const el = editorView()?.domAtPos(state.selection.from);
          const anchor =
            el?.node instanceof HTMLElement ? el.node : el?.node.parentElement;
          if (handled) toggleLinkPopover(anchor ?? document.body, mark);
          return handled;
        },
        Backspace: (state, dispatch) => {
          if (state.selection.$from.parentOffset > 0) return false;
          return splitToParagraph()(state, dispatch);
        },
        Enter: (state, dispatch) => {
          const { $from } = state.selection;
          if ($from.start() !== $from.end()) return false;
          return splitToParagraph()(state, dispatch);
        },
      }),
      keymap(baseKeymap),
    ],
  });

  const [editorView, setEditorView] = createSignal<EditorView | undefined>(
    undefined,
  );
  return (
    <article class="max-w-prose mx-auto py-8">
      <input
        onInput={async (e) => {
          const { value } = e.target;
          await db.documents.update(1, { title: value });
        }}
        class="text-2xl font-bold"
        value={props.title}
      />
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
              async dispatchTransaction(tr) {
                tr.doc.content.forEach(async (node) => {
                  if (!node.attrs.id) return;
                  await db.blocks.put({
                    id: node.attrs.id,
                    documentId: 1,
                    content: node.toJSON(),
                    text: node.textContent,
                  });
                });

                const newState = view.state.apply(tr);
                view.updateState(newState);
              },
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
