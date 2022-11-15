import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  resolve: {
    alias: [
      // workaround for lucid as bundling it is messy
      { find: "lucid-cardano", replacement: "https://unpkg.com/lucid-cardano@0.7.6/web/mod.js" },
    ],
  },
  build: {
    // this is to make sure bigint works well at a cost of browser support
    target: "es2020",
    sourcemap: true,
  },
});
