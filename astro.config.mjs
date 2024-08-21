import { defineConfig } from "astro/config";
import solidJs from "@astrojs/solid-js";
import { createTools } from "tinybase/tools";
import tailwind from "@astrojs/tailwind";
import { store } from "./src/app/db";
import { mkdir, writeFile } from "node:fs/promises";

let dotAstroDir;

// https://astro.build/config
export default defineConfig({
  integrations: [
    solidJs(),
    tailwind(),
    {
      name: "tinybase:types",
      hooks: {
        async "astro:config:setup"({ config, logger }) {
          const [dTs] = createTools(store).getStoreApi("fika");
          dotAstroDir = new URL(".astro/", config.root);
          await mkdir(dotAstroDir, { recursive: true });
          await writeFile(new URL("store-types.d.ts", dotAstroDir), dTs);
          logger.info("Loaded store types");
        },
        async "astro:server:setup"({ server, logger }) {
          server.watcher.on("all", (eventName, path) => {
            if (path.endsWith("src/app/db.ts")) {
              const [dTs] = createTools(store).getStoreApi("fika");
              writeFile(new URL("store-types.d.ts", dotAstroDir), dTs);
              logger.info("Updated store types");
            }
          });
        },
      },
    },
  ],
});
