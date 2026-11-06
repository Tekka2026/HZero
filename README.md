# HZero

A website with interactive WebGL 3D models, generated from data produced in Jupyter notebooks.

```
notebooks/  Jupyter notebooks that generate model data (Python)
data/       Notebook output (JSON), served by the website
web/        The website: Vite + TypeScript + Three.js
.github/    GitHub Action that runs the notebooks, builds the site and deploys it to GitHub Pages
```

## How it fits together

1. A notebook in `notebooks/` generates 3D model data and writes it to `data/` (e.g. `data/models.json`).
2. The website in `web/` loads that JSON and renders it with Three.js (WebGL).
3. On every push to `main`, GitHub Actions reruns all notebooks, builds the site and publishes it.

The data format is documented at the bottom of `notebooks/example_models.ipynb`.

## Getting started

### Notebooks (Python 3.11+)

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r notebooks/requirements.txt
jupyter lab notebooks/
```

Run `example_models.ipynb` to regenerate `data/models.json`.

### Website (Node 20+)

```bash
cd web
npm install
npm run dev        # local dev server with hot reload
npm run build      # production build into web/dist
```

## Deployment

The site is published to GitHub Pages by `.github/workflows/deploy.yml`.
One-time setup: in the repository on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
