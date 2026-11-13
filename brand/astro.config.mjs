// The brand site. Static output; every page is generated from src/content/sections/*.mdx.
// BRAND_BASE sets where it is served: /HZero/brand on GitHub Pages today, "/" on brand.hzero.tech later.
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

export default defineConfig({
  base: process.env.BRAND_BASE ?? "/HZero/brand",
  outDir: process.env.BRAND_OUT ?? "./dist",
  trailingSlash: "ignore",
  build: { format: "directory" },
  integrations: [mdx()],
  vite: { server: { fs: { allow: [".."] } } },
});
