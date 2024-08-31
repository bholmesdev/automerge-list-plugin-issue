import { DocHandle, Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { cache, createAsync, useNavigate, useParams } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { Editor } from "../editor";

const broadcast = new BroadcastChannelNetworkAdapter();
const indexedDB = new IndexedDBStorageAdapter();

export const loadDocHandle = cache(async (url: string) => {
  const handle = repo.find(url as AutomergeUrl);
  await handle.whenReady();
  return handle;
}, "docUrl");

export const repo = new Repo({
  storage: indexedDB,
});

export function NewDocumentRedirectView() {
  const navigate = useNavigate();
  const doc = repo.create({
    text: "Welcome",
  })!;

  navigate(`/docs/${doc.url}`, { replace: true });
  return undefined;
}

export function DocumentView() {
  const { url } = useParams();
  const handle = createAsync(() => loadDocHandle(url));

  return <Show when={handle()}>{(value) => <View handle={value()} />}</Show>;
}

function View(props: { handle: DocHandle<unknown> }) {
  const [isOnline, setIsOnline] = createSignal(false);
  return (
    <article>
      <h1>Document</h1>
      <button
        onClick={() => {
          if (!isOnline()) {
            repo.networkSubsystem.addNetworkAdapter(broadcast);
            setIsOnline(true);
            return;
          }
          window.location.reload();
        }}
        class="text-gray-500 font-bold"
      >
        {isOnline() ? "Go offline" : "Go online"}
      </button>
      <Editor handle={props.handle} />
    </article>
  );
}
