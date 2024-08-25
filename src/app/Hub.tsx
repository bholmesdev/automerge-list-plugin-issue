import { useParams } from "@solidjs/router";
import { getRelationIds, relations, store } from "./store";

export function HubView() {
  const { id } = useParams();
  const hub = store.getRow("hubs", id);
  const tagIds = getRelationIds("hubTagsJunction", id, "tagId");
  // TODO: handle "and" vs "or" for tags.
  // This gets all docs that have at least one of the tags.
  const docIds = new Set(
    tagIds
      .map((tagId) => getRelationIds("tagDocsJunction", tagId, "docId"))
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
        {hub.name}
      </h1>
      <ul>
        {tagIds.map((tagId) => (
          <li>{store.getRow("tags", tagId)?.name}</li>
        ))}
      </ul>
      <ul>
        {[...docIds].map((docId) => (
          <li>
            <a href={`/docs/${docId}`}>{store.getRow("docs", docId)?.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
