import { Route, Router } from "@solidjs/router";
import type { ParentProps } from "solid-js";
import {
  DocumentView,
  loadDocHandle,
  NewDocumentRedirectView,
  repo,
} from "./views/Document";
import {
  isValidAutomergeUrl,
  type AutomergeUrl,
} from "@automerge/automerge-repo";

export function IndexView() {
  return (
    <Router root={Layout}>
      <Route path="/" component={NewDocumentRedirectView} />
      <Route
        path="/docs/:url"
        component={DocumentView}
        preload={async ({ params }) => {
          void loadDocHandle(params.url as AutomergeUrl);
        }}
        matchFilters={{
          url: (value: string) => isValidAutomergeUrl(value),
        }}
      />
      <Route path="*" component={() => <p>404 not found</p>} />
    </Router>
  );
}

function Layout(props: ParentProps) {
  return (
    <main class="grid grid-cols-[1fr_6fr] pt-4">
      <nav></nav>
      {props.children}
    </main>
  );
}
