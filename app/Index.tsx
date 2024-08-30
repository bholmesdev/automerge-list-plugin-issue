import { cache, Route, Router, useSearchParams } from "@solidjs/router";
import { createResource, onCleanup, type ParentProps } from "solid-js";
import { DocumentView, NewDocumentRedirectView, repo } from "./views/Document";
import {
  isValidAutomergeUrl,
  isValidDocumentId,
} from "@automerge/automerge-repo";

export function IndexView() {
  return (
    <Router root={Layout}>
      <Route path="/" component={NewDocumentRedirectView} />
      <Route
        path="/docs/:url"
        component={DocumentView}
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
    <main class="grid grid-cols-[1fr_6fr]">
      <nav>Nav</nav>
      {props.children}
    </main>
  );
}
