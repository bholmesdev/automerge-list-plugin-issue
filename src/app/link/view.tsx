import { createRoot, createSignal } from "solid-js";
import type { MarkViewConstructor } from "prosemirror-view";
import { popoverEl, toggleLinkPopover } from "./popover";

export const linkView: MarkViewConstructor = (mark) => {
  const linkEl = createRoot(() => (
    <button
      onClick={() => toggleLinkPopover(linkEl, mark)}
      aria-describedby="tooltip"
      class="text-blue-500"
    />
  )) as HTMLElement;

  return {
    dom: linkEl,
  };
};
