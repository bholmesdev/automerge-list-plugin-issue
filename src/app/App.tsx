import { createSignal, Show, from } from "solid-js";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import type { Node } from "prosemirror-model";
import { undo, redo, history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import {
  headingShortcutPlugin,
  listShortcutPlugin,
  orderedListShortcutPlugin,
} from "./plugins.js";
import { schema } from "./schema.js";
import { LinkPopover, toggleLinkPopover } from "./link/popover.jsx";
import { linkView } from "./link/view.jsx";
import { splitToParagraph, toggleMark } from "./commands.js";
import { draft, store } from "./db.js";
import type { BlocksRow, InlineRow, MarksRow } from "store:types";

export function App() {
  return (
    <main>
      <Editor title={draft.title} blocks={draft.blocks} />
    </main>
  );
}

const Editor = (props: {
  title: string;
  blocks: (BlocksRow & {
    id: string;
    inline: (InlineRow & { id: string; marks: MarksRow[] })[];
  })[];
}) => {
  const blockNodes: Node[] = [];
  const nodeToBlockId = new Map<Node, string>();
  const nodeToInlineId = new Map<Node, string>();

  for (const block of props.blocks) {
    let inlineNodes: Node[] = [];
    for (const inline of block.inline) {
      const inlineNode = schema.text(
        inline.content!,
        inline.marks.map((mark) => schema.mark(mark.type!)),
      );

      nodeToInlineId.set(inlineNode, inline.id);
      inlineNodes.push(inlineNode);
    }

    const node = schema.node(block.type!, null, inlineNodes);
    blockNodes.push(node);
    nodeToBlockId.set(node, block.id);
  }
  const doc = schema.node("doc", null, blockNodes);

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
          store.setRow("documents", "draft", {
            ...store.getRow("documents", "draft"),
            title: value,
          });
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
              dispatchTransaction(transaction) {
                if (transaction.steps.length === 0) {
                  const newState = view.state.apply(transaction);
                  view.updateState(newState);
                  return;
                }
                const posToOriginalNode = new Map<number, Node>();
                view.state.doc.descendants((node, pos, parent, index) => {
                  posToOriginalNode.set(transaction.mapping.map(pos), node);
                  return true;
                });

                const newState = view.state.apply(transaction);
                view.updateState(newState);

                if (transaction.steps.length === 0) return;

                view.state.doc.descendants((node, pos, parent, index) => {
                  if (!node.isBlock) return false;

                  const originalNode = posToOriginalNode.get(pos);
                  const blockId = originalNode
                    ? nodeToBlockId.get(originalNode)
                    : undefined;
                  if (!blockId) {
                    console.log(
                      "Creating block",
                      node.type.name,
                      pos,
                      posToOriginalNode,
                    );
                    const id = store.addRow("blocks", {
                      documentId: "draft",
                      type: node.type.name,
                      order: index + 1,
                    });
                    if (!id)
                      throw new Error("Unexpected failure to create block");
                    nodeToBlockId.set(node, id);
                    return false;
                  }
                  store.setRow("blocks", blockId, {
                    ...store.getRow("blocks", blockId),
                    order: index + 1,
                  });
                  if (originalNode && node !== originalNode) {
                    nodeToBlockId.set(node, blockId);
                    updateInlineStore({
                      blockPos: pos,
                      nodeToInlineId,
                      posToOriginalNode,
                      blockNode: node,
                      blockId,
                    });
                  }
                  return true;
                });
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

function updateInlineStore({
  blockPos,
  nodeToInlineId,
  posToOriginalNode,
  blockNode: blockNode,
  blockId,
}: {
  blockPos: number;
  nodeToInlineId: Map<Node, string>;
  posToOriginalNode: Map<number, Node>;
  blockNode: Node;
  blockId: string;
}) {
  blockNode.descendants((node, pos, _, index) => {
    if (!node.isText) return false;
    const originalInlineNode = posToOriginalNode.get(blockPos + pos + 1);
    if (originalInlineNode && !originalInlineNode.isText)
      throw new Error(
        `Inline node of unexpected type: ${originalInlineNode.type.name}`,
      );
    const inlineId = originalInlineNode
      ? nodeToInlineId.get(originalInlineNode)
      : undefined;
    if (!inlineId) {
      console.log(
        "Creating inline node",
        node.text,
        originalInlineNode,
        nodeToInlineId,
      );
      const id = store.addRow("inline", {
        blockId,
        content: node.text,
        order: index + 1,
      });
      if (!id) throw new Error("Unexpected failure to create inline");
      nodeToInlineId.set(node, id);
      return false;
    }
    nodeToInlineId.set(node, inlineId);
    store.setRow("inline", inlineId, {
      ...store.getRow("inline", inlineId),
      content: node.text,
      order: index + 1,
    });
    return false;
  });
}
