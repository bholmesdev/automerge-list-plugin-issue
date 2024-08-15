import { customElement, noShadowDOM } from "solid-element";
import { createResource, Show, type ParentProps } from "solid-js";
import { blockSchema, rep, repSignal } from "./cache.js";

customElement(
  "fika-block",
  (props: ParentProps<{ dataId: string }>, { element }) => {
    noShadowDOM();

    console.log("hey");

    element.addEventListener("click", () => {
      console.log("input");
    });

    const block = repSignal(props.dataId, blockSchema);
    console.log("block", block);
    return block ? <p>{block.content}</p> : <p>Start typing...</p>;
  },
);
