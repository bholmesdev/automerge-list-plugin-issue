import { defineConfig } from "astro/config";
import solidJs from "@astrojs/solid-js";
import tailwind from "@astrojs/tailwind";
import vitePluginWasm from "vite-plugin-wasm";

// https://astro.build/config
export default defineConfig({
  srcDir: ".",
  output: "hybrid",
  integrations: [solidJs(), tailwind()],
  vite: {
    plugins: [vitePluginWasm()],
  },
});
