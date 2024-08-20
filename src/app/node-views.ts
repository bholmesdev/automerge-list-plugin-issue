import type { Node } from "prosemirror-model";
import type {
  Decoration,
  DecorationSource,
  EditorView,
  NodeView,
} from "prosemirror-view";
import { createID, db } from "./db";
import { NodeSelection } from "prosemirror-state";

export class ParagraphView implements NodeView {
  dom: HTMLElement;
  view: EditorView;
  getPos: () => number | undefined;
  id?: string;
  contentDOM?: HTMLElement | null | undefined;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    console.log(node, node.attrs.id);
    this.dom = this.contentDOM = document.createElement("p");
    this.id = node.attrs.id;
    this.view = view;
    this.getPos = getPos;

    if (!this.id) {
      db.blocks
        .add({
          id: createID("block"),
          documentId: 1,
          text: node.textContent,
          content: node.toJSON(),
          pos: getPos() ?? view.state.doc.content.size,
        })
        .then(async (id) => {
          this.id = id;
          const nodePos = getPos();
          if (nodePos === undefined) return;
          view.dispatch(view.state.tr.setNodeAttribute(nodePos, "id", id));

          view.state.doc.nodesBetween(
            nodePos,
            view.state.doc.content.size,
            (node, pos) => {
              if (node.attrs.id) {
                db.blocks.update(node.attrs.id, { pos });
                return false;
              }
              return true;
            }
          );
        });
    }
  }

  update: (
    node: Node,
    decorations: readonly Decoration[],
    innerDecorations: DecorationSource
  ) => boolean = (node) => {
    if (node.type.name !== "paragraph") return false;
    if (!this.id) throw new Error("TODO: handle case where create is waiting.");

    db.blocks.put({
      id: this.id,
      documentId: 1,
      text: node.textContent,
      content: node.toJSON(),
      pos: this.getPos() ?? this.view.state.doc.content.size,
    });
    return true;
  };

  destroy() {
    if (!this.id) throw new Error("TODO: handle case where create is waiting.");
    db.blocks.delete(this.id);
  }
}
