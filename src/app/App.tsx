import { DocumentView } from "./Document";
import { HubView } from "./Hub";
import search from "../icons/list_search_fill.svg?raw";
import { Icon } from "src/icons/Icon";
import { Route, Router, useSearchParams } from "@solidjs/router";
import { createResource, onCleanup, type ParentProps } from "solid-js";
import { relations, store } from "./store";
import { createWsSynchronizer } from "tinybase/synchronizers/synchronizer-ws-client";

export function AppView() {
  return (
    <Router root={Layout}>
      <Route
        path="/hubs/:id"
        component={HubView}
        matchFilters={{
          id: (value) => store.hasRow("hubs", value),
        }}
      />
      <Route
        path="/docs/:id"
        component={DocumentView}
        matchFilters={{
          id: (value) => store.hasRow("docs", value),
        }}
      />
      <Route path="*" component={() => <p>404 not found</p>} />
    </Router>
  );
}

function Layout(props: ParentProps) {
  const hubs = Object.entries(store.getTable("hubs"));
  const [searchParams, setSearchParams] = useSearchParams();
  const [ws] = createResource(() =>
    createWsSynchronizer(store, new WebSocket("ws://localhost:8048")).then(
      (server) => server.startSync(),
    ),
  );

  onCleanup(() => ws()?.destroy());

  return (
    <main class="grid grid-cols-[1fr_6fr]">
      <nav class="p-4 pt-8 pr-8 min-w-64">
        <div class="relative flex items-center w-full px-2 border border-slate-300 focus-within:border-blue-400 py-1 rounded mb-4">
          <input
            type="text"
            class="focus:outline-none rounded absolute inset-2 pl-8"
          />
          <Icon
            class="relative text-slate-400 pointer-events-none"
            size={24}
            raw={search}
          />
        </div>
        <ul class="flex flex-col gap-4 px-2">
          {hubs.map(([id, hub]) => (
            <li>
              <a href={`/hubs/${id}`}>{hub.name}</a>
            </li>
          ))}
        </ul>
        <button
          classList={{
            "bg-red-200": Boolean(searchParams.offline),
            "bg-green-200": !Boolean(searchParams.offline),
          }}
          onClick={() => {
            if (searchParams.offline) {
              setSearchParams({ offline: undefined });
              ws()?.startSync();
            } else {
              setSearchParams({ offline: true });
              ws()?.stopSync();
            }
          }}
        >
          {searchParams.offline ? "Offline" : "Online"}
        </button>
      </nav>
      {props.children}
    </main>
  );
}
