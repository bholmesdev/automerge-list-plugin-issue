import { createEffect, createRoot, createSignal } from "solid-js";
import { EditorView, type MarkViewConstructor } from "prosemirror-view";
import { Mark } from "prosemirror-model";
import { schema } from "./schema.js";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";

const [activeMark, setActiveMark] = createSignal<Mark | null>(null);
let markToLink: WeakMap<Mark, HTMLElement> = new WeakMap();

export const linkView: MarkViewConstructor = (mark) => {
  const linkElement = createRoot(() => (
    <button
      onClick={() => {
        return setActiveMark((activeLink) =>
          activeLink === mark ? null : mark,
        );
      }}
      aria-describedby="tooltip"
      class="text-red-500"
    />
  )) as HTMLElement;
  markToLink.set(mark, linkElement);

  return {
    dom: linkElement,
  };
};

export function LinkPopover(props: { editorView: EditorView }) {
  let el: HTMLDivElement | undefined;
  let inputEl: HTMLInputElement | undefined;
  const [restoreFocusEl, setRestoreFocusEl] = createSignal<HTMLElement | null>(
    null,
  );

  createEffect(() => {
    const mark = activeMark();
    const link = mark ? markToLink.get(mark) : undefined;
    if (!el || !mark || !link) return;

    setRestoreFocusEl(document.activeElement as HTMLElement);
    inputEl?.focus();

    computePosition(link, el, {
      placement: "top",
      middleware: [offset(), flip(), shift()],
    }).then(({ x, y }) => {
      Object.assign(el.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
    });
  });
  return (
    <div
      id="tooltip"
      role="tooltip"
      classList={{
        block: Boolean(activeMark()),
        hidden: !Boolean(activeMark()),
      }}
      ref={el}
      class="w-max absolute px-5 py-1 top-0 left-0 bg-white border border-gray-200 rounded"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setActiveMark(null);
          restoreFocusEl()?.focus();
        }
      }}
      onFocusOut={(e) => {
        if (!el?.contains(e.relatedTarget as any)) {
          setActiveMark(null);
        }
      }}
    >
      <div class="flex items-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActiveMark(null);
          }}
        >
          <input
            ref={inputEl}
            type="text"
            name="link"
            value={activeMark()?.attrs.href}
            onInput={(e) => {
              const href = e.target.value;
              const mark = activeMark();
              if (!mark) return;

              const { state } = props.editorView;
              const newMark = schema.marks.link.create({ href });
              let tr = state.tr.setMeta("updated-link", true);
              state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
                if (!node.marks.includes(mark)) return true;

                tr = tr.addMark(pos, pos + node.nodeSize, newMark);
                return true;
              });
              setActiveMark(newMark);

              props.editorView.dispatch(tr);
            }}
          />
        </form>
        <a
          href={activeMark()?.attrs.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <g fill="none">
              <path d="M24 0v24H0V0zM12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z" />
              <path
                fill="currentColor"
                d="M11 6a1 1 0 1 1 0 2H5v11h11v-6a1 1 0 1 1 2 0v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm9-3a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V6.414l-8.293 8.293a1 1 0 0 1-1.414-1.414L17.586 5H15a1 1 0 1 1 0-2Z"
              />
            </g>
          </svg>
        </a>
      </div>
    </div>
  );
}
