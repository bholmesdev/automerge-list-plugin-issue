import { DocumentView } from "./Document";
import search from "../icons/list_search_fill.svg?raw";
import { Icon } from "src/icons/Icon";

export function AppView() {
  return (
    <main class="grid grid-cols-[1fr_6fr]">
      <nav class="p-8 pr-12 min-w-max">
        <div class="relative flex items-center  px-2 border border-slate-300 focus-within:border-blue-400 py-1 rounded ">
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
        <ul class="flex flex-col gap-4">
          <li>Global</li>
          <li>Learning list - projects</li>
          <li>Learning list - articles</li>
        </ul>
      </nav>
      <DocumentView />
    </main>
  );
}
