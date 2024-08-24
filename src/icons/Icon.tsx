import type { JSX } from "solid-js";

export function Icon(props: { raw: string; class?: string; size?: number }) {
  const size = props.size ?? 24;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={props.class}
      width={size}
      height={size}
      fill="currentColor"
      ref={(el) => {
        const template = document.createElement("template");
        template.innerHTML = props.raw;
        const svg = template.content.firstChild;
        if (!(svg instanceof SVGElement))
          throw new Error("Icon expected an SVG element.");
        el.innerHTML = svg.innerHTML;

        const viewBox = svg.getAttribute("viewBox");
        if (viewBox) {
          el.setAttribute("viewBox", viewBox);
        } else {
          const width = svg.getAttribute("width");
          const height = svg.getAttribute("height");
          if (width && height) {
            el.setAttribute("viewBox", `0 0 ${width} ${height}`);
          }
        }

        const xmlns = svg.getAttribute("xmlns");
        if (xmlns) {
          el.setAttribute("xmlns", xmlns);
        }
      }}
    ></svg>
  );
}
