import { createRoot, createSignal } from "solid-js";
import type { MarkViewConstructor } from "prosemirror-view";
import type { Mark } from "prosemirror-model";

export const [activeMark, setActiveMark] = createSignal<Mark | null>(null);
export let markToLink: WeakMap<Mark, HTMLElement> = new WeakMap();

export const linkView: MarkViewConstructor = (mark) => {
  const linkElement = createRoot(() => (
    <button
      onClick={() => {
        return setActiveMark((activeLink) =>
          activeLink === mark ? null : mark,
        );
      }}
      aria-describedby="tooltip"
      class="text-blue-500"
    />
  )) as HTMLElement;
  markToLink.set(mark, linkElement);

  return {
    dom: linkElement,
  };
};
