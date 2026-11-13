// Every brand section is one MDX file in src/content/sections. Adding a file adds a page,
// a tile on the home page and a tile in every page's footer navigation.
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const sections = defineCollection({
  loader: glob({ pattern: "*.mdx", base: "./src/content/sections" }),
  schema: z.object({
    title: z.string(),
    /** Position in the navigation grid. */
    order: z.number(),
    /** The large statement under the page title. */
    intro: z.string(),
    /** Tile colour on the home grid: a token id from tokens/hzero.json. */
    tile: z.string(),
    icon: z.enum(["heart", "mark", "drop", "type", "image", "shapes", "grid", "device", "file"]),
    /** Shown on the page when the section is still a draft. */
    status: z.enum(["draft", "proposal", "final"]).default("draft"),
    updated: z.string().optional(),
  }),
});

export const collections = { sections };
