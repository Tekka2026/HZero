import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the built site works on GitHub Pages (/<repo>/), a custom domain, or any static host.
  base: "./",
  build: {
    outDir: "dist",
    // Three.js is loaded lazily in its own chunk (~550 kB minified); that is expected.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        impressum: resolve(import.meta.dirname, "impressum.html"),
        datenschutz: resolve(import.meta.dirname, "datenschutz.html"),
      },
    },
  },
});
