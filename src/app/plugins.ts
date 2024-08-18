import { type Node } from "prosemirror-model";
import { Plugin, TextSelection, Transaction } from "prosemirror-state";
import { alphabet } from "oslo/crypto";
import type { EditorView } from "prosemirror-view";
import { schema } from "./schema.js";

export function headingShortcutPlugin() {
  const LEVELS = 6;
  const init: { lastInput: "none" | "#"; offset: number } = {
    lastInput: "none",
    offset: 0,
  };
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
        const state = plugin.getState(view.state) ?? init;
        const { $from } = view.state.selection;
        if (event.key === "#" && $from.parentOffset === state.offset) {
          if (state.offset + 1 > LEVELS) {
            view.dispatch(view.state.tr.setMeta(plugin, init));
            return false;
          }
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                lastInput: "#",
                offset: state.offset + 1,
              })
              .insertText("#", $from.start()),
          );
          return true;
        }
        if (state.lastInput === "#" && event.key === " ") {
          const deletion = view.state.tr.delete(
            $from.start(),
            $from.start() + state.offset,
          );
          const resolved = deletion.doc.resolve($from.start());
          padDuringTransition($from.parent.attrs.id, state.offset);
          view.dispatch(deletion);
          const tr = view.state.tr
            .setMeta(plugin, init)
            .setBlockType(
              resolved.start(),
              resolved.end(),
              schema.node("heading").type,
              { level: state.offset, id: resolved.parent.attrs.id },
            );
          dispatchViewTransition(view, tr);
          return true;
        }
        view.dispatch(view.state.tr.setMeta(plugin, init));
        return false;
      },
    },
  });
  return plugin;
}

export function listShortcutPlugin() {
  const init = { active: false };
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
        const { active } = plugin.getState(view.state) ?? init;
        const { $from } = view.state.selection;
        if (event.key === "-" && $from.parentOffset === 0) {
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                active: true,
              })
              .insertText(event.key, view.state.selection.from),
          );
          return true;
        }
        if (active && event.key === " ") {
          const deletion = view.state.tr.delete(
            $from.start(),
            $from.start() + 1,
          );
          padDuringTransition($from.parent.attrs.id);
          view.dispatch(deletion);
          const resolved = deletion.doc.resolve($from.start());
          const li = schema.node(
            "list_item",
            { id: resolved.parent.attrs.id },
            resolved.parent.content.cut(0, resolved.parent.content.size),
          );
          const nodeBefore = view.state.doc.resolve(
            resolved.start() - 1,
          ).nodeBefore;
          const nodeAfter = view.state.doc.resolve(
            resolved.end() + 1,
          ).nodeAfter;

          const children: Node[] = [];
          let rangeStart = resolved.start();
          let rangeEnd = resolved.end();
          let selectionToRestore = resolved.start() + 1;

          if (nodeBefore?.type.name === "bulleted_list") {
            nodeBefore.forEach((node) => children.push(node));
            rangeStart = resolved.start() - nodeBefore.nodeSize;
            // Account for collapsed blocks when joining
            selectionToRestore -= 2;
          }
          children.push(li);
          if (nodeAfter?.type.name === "bulleted_list") {
            nodeAfter.forEach((node) => children.push(node));
            rangeEnd = resolved.end() + nodeAfter.nodeSize;
          }
          const list = schema.node("bulleted_list", null, children);
          let tr = view.state.tr
            .setMeta(plugin, init)
            .replaceRangeWith(rangeStart, rangeEnd, list);
          restoreSelection(tr, selectionToRestore);
          dispatchViewTransition(view, tr);
          return true;
        }
        view.dispatch(view.state.tr.setMeta(plugin, init));
        return false;
      },
    },
  });
  return plugin;
}

const NUMBERS = alphabet("0-9");

export function orderedListShortcutPlugin() {
  const init:
    | { lastInput: "none"; start: undefined }
    | { lastInput: "number" | "period"; start: number } = {
    lastInput: "none",
  };
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
        const state = plugin.getState(view.state) ?? init;
        const { selection } = view.state;
        const { $from } = view.state.selection;
        if (
          NUMBERS.includes(event.key) &&
          ($from.parentOffset === 0 || state.lastInput === "number")
        ) {
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                lastInput: "number",
                start: parseInt(
                  state.start ? `${state.start}${event.key}` : event.key,
                ),
              })
              .insertText(event.key, selection.from),
          );
          return true;
        }
        if (state.lastInput === "number" && event.key === ".") {
          view.dispatch(
            view.state.tr
              .setMeta(plugin, {
                lastInput: "period",
                start: state.start,
              })
              .insertText(".", selection.from),
          );
          return true;
        }
        if (state.lastInput === "period" && event.key === " ") {
          const deletion = view.state.tr.delete(
            $from.start(),
            $from.start() + state.start.toString().length + 1,
          );
          padDuringTransition(
            $from.parent.attrs.id,
            state.start.toString().length,
          );
          view.dispatch(deletion);
          const resolved = deletion.doc.resolve($from.start());
          const li = schema.node(
            "list_item",
            { id: resolved.parent.attrs.id },
            resolved.parent.content.cut(0, resolved.parent.content.size),
          );
          const nodeBefore = view.state.doc.resolve(
            resolved.start() - 1,
          ).nodeBefore;
          const nodeAfter = view.state.doc.resolve(
            resolved.end() + 1,
          ).nodeAfter;

          const children: Node[] = [];
          let rangeStart = resolved.start();
          let rangeEnd = resolved.end();
          let selectionToRestore = resolved.start() + 1;

          let start = state.start;
          if (nodeBefore?.type.name === "ordered_list") {
            nodeBefore.forEach((node) => children.push(node));
            rangeStart = resolved.start() - nodeBefore.nodeSize;
            start = nodeBefore.attrs.start;
            // Account for collapsed blocks when joining
            selectionToRestore -= 2;
          }
          children.push(li);
          if (nodeAfter?.type.name === "ordered_list") {
            nodeAfter.forEach((node) => children.push(node));
            rangeEnd = resolved.end() + nodeAfter.nodeSize;
          }
          const list = schema.node("ordered_list", { start }, children);
          let tr = view.state.tr
            .setMeta(plugin, init)
            .replaceRangeWith(rangeStart, rangeEnd, list);
          // TODO: learn about mappings. Cursor is incorrect when merging nodes.
          restoreSelection(tr, selectionToRestore);
          dispatchViewTransition(view, tr);
          return true;
        }
        view.dispatch(view.state.tr.setMeta(plugin, init));
        return false;
      },
    },
  });
  return plugin;
}

function restoreSelection(tr: Transaction, position: number) {
  return tr.setSelection(new TextSelection(tr.doc.resolve(position)));
}

function dispatchViewTransition(view: EditorView, tr: Transaction) {
  if (
    "startViewTransition" in document &&
    typeof document.startViewTransition === "function"
  ) {
    document.startViewTransition(() => {
      view.dispatch(tr);
    });
  } else {
    view.dispatch(tr);
  }
}

function padDuringTransition(id: string, ch = 1) {
  const el = document.getElementById(id)!;
  if (!el) return;
  el.setAttribute("style", `margin-inline-start: ${ch}ch;`);
}
