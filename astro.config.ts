import { defineConfig } from "astro/config";
import solidJs from "@astrojs/solid-js";
import { createTools } from "tinybase/tools";
import tailwind from "@astrojs/tailwind";
import { mkdir, writeFile } from "node:fs/promises";
import react from "@astrojs/react";
import type { AstroIntegration } from "astro";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [
    solidJs(),
    tailwind(),
    react({
      exclude: ["src/app/*"],
    }),
    tinybaseTypes(),
  ],
});

function tinybaseTypes(): AstroIntegration {
  let dotAstroDir: URL;
  const getStoreTypesFile = () => new URL("store-types.d.ts", dotAstroDir);

  return {
    name: "tinybase:types",
    hooks: {
      async "astro:config:setup"({ config, logger }) {
        const { store } = await import("./src/app/store.js");
        const [dTs] = createTools(store as any).getStoreApi("fika");
        dotAstroDir = new URL(".astro/", config.root);
        await mkdir(dotAstroDir, {
          recursive: true,
        });
        await writeFile(getStoreTypesFile(), dTs);
        logger.info("Loaded store types");
      },
      async "astro:server:setup"({ server, logger }) {
        server.watcher.on("all", async (eventName: string, path: string) => {
          if (path.endsWith("src/app/store.ts")) {
            const updatedStore = await server.ssrLoadModule(
              `src/app/store.ts?timestamp=${Date.now()}`,
            );
            const [dTs] = createTools(updatedStore.store).getStoreApi("fika");
            await writeFile(getStoreTypesFile(), dTs);
            logger.info("Updated store types");
          }
        });
      },
    },
  };
}
