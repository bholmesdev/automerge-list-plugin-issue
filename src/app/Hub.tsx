import { useParams } from "@solidjs/router";
import {
  getManyToManyIds,
  relations,
  store,
  useCell,
  useManyToManyIds,
} from "./store";
import { Show } from "solid-js";

export function HubView() {
  const { id } = useParams();
  const tagIds = useManyToManyIds("hubTagsJunction", id, "tagId");
  // TODO: handle "and" vs "or" for tags.
  // This gets all docs that have at least one of the tags.
  const docIds = () =>
    new Set(
      tagIds()
        .map((tagId) => useManyToManyIds("tagDocsJunction", tagId, "docId")())
        .flat(),
    );
  return (
    <div>
      <h1
        contentEditable="plaintext-only"
        class="focus:outline-none"
        onChange={(e) =>
          store.setCell("hubs", id, "name", e.target.textContent ?? "")
        }
      >
        {store.getCell("hubs", id, "name")}
      </h1>
      <ul>
        {tagIds().map((tagId) => {
          const name = useCell("tags", tagId, "name");
          return <li>{name()}</li>;
        })}
      </ul>
      <ul>
        {[...docIds()].map((docId) => {
          const title = useCell("docs", docId, "title");
          return (
            <li>
              <a href={`/docs/${docId}`}>{title()}</a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
