import { DocumentView } from "./Document";

export function AppView() {
  return (
    <main class="grid grid-cols-[1fr_6fr]">
      <nav>
        <ul>
          <li>
            <a href="#document">Document</a>
          </li>
        </ul>
      </nav>
      <DocumentView />
    </main>
  );
}
