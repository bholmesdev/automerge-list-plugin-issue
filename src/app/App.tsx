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
import { draft, relations, store } from "./db.js";
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

                const visitedBlocks = new Set<Node>();
                const visitedInline = new Set<Node>();
                view.state.doc.descendants((node, pos, parent, index) => {
                  if (node.isBlock) {
                    visitedBlocks.add(node);
                    const originalNode = posToOriginalNode.get(pos);
                    if (!originalNode) {
                      const id = addBlock(node.type.name, index + 1);
                      nodeToBlockId.set(node, id);
                      return console.log("add:block", index);
                    }
                    const blockId = nodeToBlockId.get(originalNode);
                    if (!blockId) throw new Error("original node not found");
                    if (node !== originalNode)
                      nodeToBlockId.delete(originalNode);
                    nodeToBlockId.set(node, blockId);
                    updateBlockOrder(blockId, index + 1);
                    return console.log("update:block", blockId, index);
                  }
                  // TODO: optimize inline updates by cursor position
                  if (node.isInline) {
                    visitedInline.add(node);
                    const originalNode = posToOriginalNode.get(pos);
                    if (!originalNode) {
                      if (!parent)
                        throw new Error("Expected inline to have parent");
                      const blockId = nodeToBlockId.get(parent);
                      if (!blockId)
                        throw new Error(
                          "Expected inline to have parent block id",
                        );
                      const id = addInline(blockId, node.text!, index + 1);
                      nodeToInlineId.set(node, id);
                      return console.log("add:inline", index, pos);
                    }
                    const inlineId = nodeToInlineId.get(originalNode);
                    if (!inlineId) throw new Error("original node not found");
                    if (node !== originalNode)
                      nodeToInlineId.delete(originalNode);
                    nodeToInlineId.set(node, inlineId);
                    updateInline(inlineId, node.text!, index + 1);
                    return console.log("update:inline", inlineId, index, pos);
                  }
                  return false;
                });
                for (const [node, id] of nodeToBlockId) {
                  if (!visitedBlocks.has(node)) {
                    console.log("remove:block", node);
                    deleteBlock(id);
                    nodeToBlockId.delete(node);
                  }
                }
                for (const [node, id] of nodeToInlineId) {
                  if (!visitedInline.has(node)) {
                    console.log("remove:inline", node);
                    deleteInline(id);
                    nodeToInlineId.delete(node);
                  }
                }
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

function addBlock(type: string, order: number) {
  return store.addRow("blocks", {
    documentId: "draft",
    type,
    order,
  })!;
}

function addInline(blockId: string, content: string, order: number) {
  return store.addRow("inline", {
    blockId,
    content,
    order,
  })!;
}

function updateBlockOrder(id: string, order: number) {
  store.setRow("blocks", id, {
    ...store.getRow("blocks", id),
    order,
  });
}

function updateInline(id: string, content: string, order: number) {
  store.setRow("inline", id, {
    ...store.getRow("inline", id),
    content,
    order,
  });
}

function deleteBlock(id: string) {
  store.delRow("blocks", id);
}

function deleteInline(id: string) {
  store.delRow("inline", id);
}
