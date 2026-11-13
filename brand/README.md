# hzero brand guidelines

The place where the hzero brand lives. Same structure as a classic brand portal: a home page with a
section grid, and nine sections (Foundations, Logo, Colour, Typography, Photography, Graphics, Layout,
Applications, Marketing collateral).

Live: `/brand/` next to the website (GitHub Pages), built by `.github/workflows/deploy.yml`.

## How it is built

| Part | Where | What it does |
|---|---|---|
| Content | `src/content/sections/*.mdx` | One file per section. Text in Markdown/HTML plus ready-made blocks. Adding a file adds a page and a tile. |
| Tokens | `../tokens/hzero.json` | The single source for colours, type, grid and motion. Swatches, ramps and the type scale read it directly. |
| Blocks | `src/components/` | `Block`, `Grid`, `Card`, `Statement`, `Quote`, `Tag`, `Swatches`, `Proportion`, `Ramp`, `Specimen`, `TypeScale`, `Logo`, `LogoPanel`, `LogoDonts`, `Clearspace`, `Photos`, `Downloads`. Usable in any MDX file without importing. |
| Files | `public/downloads/` | Logos, charts and zips people download. |
| Photos | `public/photos/`, `public/team/` | WebP, at most 1400 px. |

## Editing

```bash
npm install
npm run dev        # http://localhost:4321/HZero/brand/
npm run build      # static site in dist/
```

A section page is front matter plus blocks:

```mdx
---
title: Colour
order: 3            # position in the grid
tile: ink           # tile colour: a token id
icon: drop          # heart, mark, drop, type, image, shapes, grid, device, file
status: final       # draft | proposal | final, shown in the page header
intro: "The big statement under the title."
---

<Block label="Primary palette" text="One short line." action="Download" href="downloads/x.zip">
  <Swatches ids={["charcoal", "ink", "cyan"]} />
</Block>
```

Mark anything not final with `<Tag />` (proposal) or `<Tag kind="todo" />`.

## Rules

- Follow `../DESIGN.md`. Titles in FK Display, text in Inter, no monospace.
- Change a colour or size in `tokens/hzero.json` first, then in the website and the chart package.
- Charts come from `notebooks/hzero_charts`; copy the exports from `exports/slides/` into `public/downloads/charts/`.
- The photos in `public/photos/` are mood references from the founders' photo selection, not licensed for publication.
