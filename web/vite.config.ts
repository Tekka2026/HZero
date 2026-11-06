import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the built site works on GitHub Pages (/<repo>/) and any other host.
  base: "./",
  // Serve the notebook output folder (../data) as static files, e.g. /models.json
  publicDir: "../data",
  // Three.js alone is ~550 kB minified; that is expected.
  build: { outDir: "dist", chunkSizeWarningLimit: 1000 },
});
