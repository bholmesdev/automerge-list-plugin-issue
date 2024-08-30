import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { AutoMirror } from "@automerge/prosemirror";
import { DocHandle, Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import {
  cache,
  createAsync,
  useNavigate,
  useParams,
  useSearchParams,
} from "@solidjs/router";
import { createSignal, onCleanup, Show } from "solid-js";

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

  return <Show when={handle()}>{(value) => <Editor handle={value()} />}</Show>;
}

function Editor(props: { handle: DocHandle<unknown> }) {
  const autoMirror = new AutoMirror(["text"]);
  const [isOnline, setIsOnline] = createSignal(false);
  const editorState = EditorState.create({
    doc: autoMirror.initialize(props.handle),
    schema: autoMirror.schema,
    plugins: [keymap({}), keymap(baseKeymap)],
  });

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
      <div
        class="focus:outline-none mt-4"
        ref={(el) => {
          const view = new EditorView(
            (editor) => {
              editor.className = el.className;
              el.replaceWith(editor);

              props.handle.on("change", ({ doc, patches, patchInfo }) => {
                const newState = autoMirror.reconcilePatch(
                  patchInfo.before,
                  doc,
                  patches,
                  view.state
                );
                view.updateState(newState);
              });

              onCleanup(() => props.handle.removeListener("change"));
            },
            {
              state: editorState,
              dispatchTransaction: (tx: Transaction) => {
                const newState = autoMirror.intercept(
                  props.handle,
                  tx,
                  view.state
                );
                view.updateState(newState);
              },
            }
          );
        }}
      />
    </article>
  );
}
