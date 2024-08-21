import type { Node } from "prosemirror-model";
import type {
  Decoration,
  DecorationSource,
  EditorView,
  NodeView,
} from "prosemirror-view";
import { relations, store } from "./db";

export class ParagraphView implements NodeView {
  dom: HTMLElement;
  view: EditorView;
  getPos: () => number | undefined;
  id?: string;
  contentDOM?: HTMLElement | null | undefined;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    console.log(node.attrs);

    this.dom = this.contentDOM = document.createElement("p");
    this.id = node.attrs.serverId;
    this.view = view;
    this.getPos = getPos;

    if (this.id) return;

    const nodePos = getPos();
    if (!nodePos) throw new Error("Unexpectedly cannot locate node");

    this.id = store.addRow("blocks", {
      type: "paragraph",
      documentId: "draft",
      // TODO: compute this
      order: nodePos,
      text: "",
    })!;

    // view.dispatch(view.state.tr.setNodeAttribute(nodePos, "id", this.id));
    this.setOrderAfter();
  }

  update: (
    node: Node,
    decorations: readonly Decoration[],
    innerDecorations: DecorationSource,
  ) => boolean = (node) => {
    if (node.type.name !== "paragraph" || !this.id) return false;

    store.setRow("blocks", this.id, {
      ...store.getRow("blocks", this.id),
      text: node.textContent,
      order: this.getPos() ?? this.view.state.doc.content.size,
    });
    const inlineIds = relations.getLocalRowIds("blockInline", this.id);
    inlineIds.forEach((id) => {
      store.delRow("inline", id);
      const markIds = relations.getLocalRowIds("inlineMarks", id);
      markIds.forEach((markId) => store.delRow("marks", markId));
    });
    node.content.forEach((node, _, index) => {
      const inlineId = store.addRow("inline", {
        content: node.textContent,
        blockId: this.id,
        order: index,
      });
      node.marks.forEach((mark) => {
        store.addRow("marks", {
          type: mark.type.name,
          inlineId,
        });
      });
    });
    this.setOrderAfter();
    return true;
  };

  setOrderAfter() {
    const nodePos = this.getPos();
    if (!nodePos) return;

    this.view.state.doc.nodesBetween(
      nodePos,
      this.view.state.doc.content.size,
      (node, pos) => {
        if (node.attrs.id) {
          store.setRow("blocks", node.attrs.id, {
            ...store.getRow("blocks", node.attrs.id),
            order: pos,
          });
          return false;
        }
        return true;
      },
    );
  }

  destroy() {
    if (!this.id) throw new Error("TODO: handle case where create is waiting.");
    store.delRow("blocks", this.id);
  }
}
