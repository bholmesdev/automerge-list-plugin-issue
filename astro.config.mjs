import { defineConfig } from "astro/config";
import solidJs from "@astrojs/solid-js";
import { createTools } from "tinybase/tools";
import tailwind from "@astrojs/tailwind";
import { store } from "./src/app/store";
import { mkdir, writeFile } from "node:fs/promises";
import react from "@astrojs/react";

let dotAstroDir;
const getStoreTypesDir = () => new URL("store-types.d.ts", dotAstroDir);

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [
    solidJs(),
    tailwind(),
    {
      name: "tinybase:types",
      hooks: {
        async "astro:config:setup"({ config, logger }) {
          const [dTs] = createTools(store).getStoreApi("fika");
          dotAstroDir = new URL(".astro/", config.root);
          await mkdir(dotAstroDir, {
            recursive: true,
          });
          await writeFile(getStoreTypesDir(), dTs);
          logger.info("Loaded store types");
        },
        async "astro:server:setup"({ server, logger }) {
          server.watcher.on("all", async (eventName, path) => {
            if (path.endsWith("src/app/store.ts")) {
              const updatedStore = await server.ssrLoadModule(
                `src/app/store.ts?timestamp=${Date.now()}`,
              );
              const [dTs] = createTools(updatedStore.store).getStoreApi("fika");
              await writeFile(getStoreTypesDir(), dTs);
              logger.info("Updated store types");
            }
          });
        },
      },
    },
    react({
      exclude: ["src/app/*"],
    }),
  ],
});
