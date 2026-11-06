# hzero website

Source of [hzero.tech](https://hzero.tech/): the company website, with interactive WebGL diagrams
whose data comes from Jupyter notebooks.

```
notebooks/            Jupyter notebooks that model the hybrid system and export data (Python)
web/                  The website (Vite + TypeScript + Three.js)
  index.html            Homepage
  impressum.html        Legal pages
  datenschutz.html
  assets/               Styles, fonts, images, video (copied from the live site)
  src/                  TypeScript: menu, 3D diagram
  public/data/          Notebook output (JSON), served as-is
.github/workflows/    Runs the notebooks, builds the site and deploys it to GitHub Pages
```

## How the 3D diagram works

The "HPC / Workloads / QC" diagram on the homepage is rendered with Three.js (`web/src/hybrid-scene.ts`).

1. `notebooks/hybrid_system.ipynb` defines the system layout (tiles, nodes, connections), simulates
   workloads being routed through hzero, and writes `web/public/data/hybrid-system.json`.
2. The website loads that JSON and draws the diagram. Connections appear step by step when the section
   scrolls into view, moving pulses show traffic (more traffic → more pulses), and hovering (or tapping)
   a tile or node shows the metrics from the simulation.
3. If WebGL is not available, the original SVG illustration is shown instead. Users who prefer reduced
   motion get a static diagram.

To change what the diagram shows, edit the notebook and re-run it. The JSON format is defined in `web/src/types.ts`.

## Design system

- **Grid and spacing** follow samara.com: 12 columns / 24px gutter / 54px side margin above 1024px,
  12 / 15 / 30 from 769–1024px, and 6 / 15 / 21 at 768px and below (max width 1600px).
  Type sizes, navigation, footer and logo size (24px high) use the same scale. All of it lives in `web/assets/site.css`.
- **Titles**: Selecta by Maxitype. Put the font files in `web/assets/fonts/selecta/`; they are picked up automatically.
  Without them, titles fall back to Inter. Trial files may not be used on the live site (Maxitype EULA §6).
- **Body**: Inter (variable), installed from npm (`@fontsource-variable/inter`).
- No monospace type anywhere.

## Getting started

### Notebooks (Python 3.11+)

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r notebooks/requirements.txt
jupyter lab notebooks/
```

### Website (Node 20+)

```bash
cd web
npm install
npm run dev        # local dev server with hot reload
npm run build      # production build into web/dist
```

## Deployment

On every push to `main`, `.github/workflows/deploy.yml` re-runs all notebooks, builds the site and
publishes it to GitHub Pages.

One-time setup: in the repository on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
To serve it on hzero.tech, add the custom domain there and point the domain's DNS at GitHub Pages.
