# hzero design language

This file is the single reference for how hzero looks. Read it before making a chart, a page or a slide.
Claude reads it through `CLAUDE.md`.

Part 1 covers the brand basics shared with the website. Part 2 is the chart specification: it was measured from the reference charts (`graph_1.svg`, updated by `graph_3.svg` with a white background, a `#E5E5E5` backdrop and more space under the category labels, plus a PNG of the systems-by-segment chart), so every value below is a measurement, not a guess. Part 3 explains how Jupyter produces charts in this style.

Units: px. Chart values refer to the 1920 × 1080 slide frame at 1×.

---

## 1. Brand basics

### Typefaces

| Role | Face | Weights | Where |
|---|---|---|---|
| Titles | FK Display | 400 | Website headings (h1–h6). Self-hosted in `web/assets/fonts/fkdisplay/` (Florian Karsten Typefaces; check the web licence). IBM Plex Sans is the fallback. Tracking -0.025em on the largest titles, -0.02em on section titles. |
| Text, labels, numbers | Inter | 400, 600 | Everything else, including all chart text. |
| Monospace | none | | Never use monospace text anywhere. |

### Colours

The website is black: a near-black page with a trace of cyan, cyan-tinted greys, and the hzero cyan as the one signal colour (see the brand guidelines).

| Token | Value | Use |
|---|---|---|
| bg | `#091314` | Page background |
| bg-alt | `#0D1A1C` | Alternate sections |
| panel | `#132224` | Cards and panels |
| ink | `#EEF2F2` | Text |
| ink-60 | `#EEF2F2` at 66% | Secondary text |
| steel | `#778386` | Second line of headlines (large text only) |
| mist | `#AAB5B7` | Menu links, logo bracket on dark, the sphere's centre shape |
| line | white at 10% | Hairlines |
| cyan (highlight, accent) | `#2ECCD4` | Hero highlight ("Zero disruption."), Contact button, links and markers, sphere lines and receiving squares. One signal per screen. |
| on-signal | `#091314` | Text on cyan |
| lime | `#E2F28E` | Favicon; the sphere's centre shape when a stroke lights it |

The logo on the site is the "signal" version: white letters, cyan bracket.

Charts use their own palette (section 2.4). Do not mix the two.

### Website type scale (follows samara.com)

| Style | Desktop | Phone | Line height |
|---|---|---|---|
| Hero title (H1) | 58–96 | 34–38 | 102% / 110% |
| Closing title ("Get in touch") | 72–120 | 42–48 | 100% / 110% |
| Section title | 54–60 | 32–36 | 110% / 117% |
| Intro text (light) | 19–23 | 17–19 | 125% |
| Card title | 18–21 | 18–21 | 125% |
| Body | 18 | 16–18 | 133% |
| Labels | 15, 14, 12 | same | 120%, 128%, 133% |

Layout: a 12-column grid with 54 px margins and 24 px gutters on desktop (30/15 on tablet, 21/15 and 6 columns on phones). Content uses columns 2–11. The logo and the Contact button each take one column, and the footer uses all 12.

---

## 2. Charts

### 2.1 Formats

| Output | Size | Background | Text | File |
|---|---|---|---|---|
| Slide | 1920 × 1080 frame | white, full frame | outlined (paths) | `exports/slides/<name>.svg` |
| Slide, image | 3840 × 2160 (2×) | white, full frame | rendered | `exports/slides/<name>.png` |
| Website | chart + 48 px on every side | white | outlined (paths) | `web/public/charts/<name>.svg` |

Text is outlined in every SVG, so files render identically without Inter installed. On the website, the `alt` text carries what the chart says.

### 2.2 Geometry

All charts share one fixed plot box. Slides then line up when you step from one chart to the next.

| Element | Value |
|---|---|
| Frame | 1920 × 1080 |
| Plot box | x 560–1360, y 411–735 (800 × 324). Centred horizontally on the frame. |
| Value 0 | Plot bottom, y 735 |
| Axis maximum | 3 px below the plot top, y 414. Scale: `y = 735 − value / max × 321` |
| Bar gap | 3 px |
| Bar width | `(800 − 3 × (n − 1)) / n`. The first bar starts at the plot's left edge and the last ends at its right edge. 10 bars: 77.3. 6 bars: 130.8. |
| Bar centre | `560 + i × (bar width + 3) + bar width / 2` |
| Tick label to plot edge | 13 (left axis: right-aligned; right axis: left-aligned) |
| Tick label, vertical | Centred on its gridline (centre of the digits' ink) |
| Category label | Centred on the bar. Cap top 12 below the plot, so the first baseline is 23 below the plot (y 758). |
| Two-line category label | Line pitch 15.4 (second baseline at y 773.4) |
| Axis title to tick labels | 22, measured between the ink |
| Axis title, vertical | Centred on the plot box |
| Gridline | 1 px high, full plot width |
| Line | 2 px stroke |
| Marker | Circle, radius 3 (6 px across), centred on the bar centre |

### 2.3 Layer order (bottom to top)

1. Canvas, white `#FFFFFF`, full frame.
2. Plot backdrop: a rectangle the size of the plot box, filled with a vertical gradient of `#E5E5E5` from 0% opacity at the top to 50% opacity at the bottom.
3. Gridlines.
4. Bars.
5. Lines.
6. Markers.
7. Text: tick labels, category labels, axis titles.

Gridlines sit under the bars, so a bar hides the gridlines it crosses. That's what the systems-by-segment reference shows.

### 2.4 Colours

| Token | Value | Role |
|---|---|---|
| canvas | `#FFFFFF` | Frame and web background |
| backdrop | `#E5E5E5` | Plot backdrop gradient, 0% at the top to 50% at the bottom |
| grid | `#D2D2D2` | Gridlines |
| text | `#000000` | All chart text |
| green | `#446455` | Bar: primary series, top of a stack |
| sage | `#A8B1A7` | Bar: secondary series, bottom of a stack; single-series bar charts |
| sand-line / sand | `#E1C9A4` / `#D4A359` | Line series 1: line / markers |
| coral-line / coral | `#EFB1A2` / `#EE7254` | Line series 2: line / markers |

Rules:
- A line series always pairs a light line with a full-strength marker.
- The order is fixed:
  - Bars: sage first (bottom), then green.
  - Lines: sand first, then coral.
- The palette holds two bar series and two line series. For more, ask design. Do not invent a colour.

### 2.5 Typography

| Text | Font | Size | Colour | Other |
|---|---|---|---|---|
| Tick labels | Inter Regular | 15 | `#000000` | Plain numbers: `1500`, not `1,500` or `1.5k` |
| Category labels | Inter Regular | 15 | `#000000` | One line or two, centred |
| Axis titles | Inter Regular | 18 | `#000000` | Rotated 90° counter-clockwise (reads bottom to top), unit in brackets: `Spending (MEUR)` |

Letter spacing 0, sentence case, no bold, no italics. The chart has no title inside the frame: the slide or page heading names it.

### 2.6 Axes

- Each axis shows 3–5 labelled ticks with even steps. The top tick is the axis maximum.
- Don't draw a 0 gridline or a 0 label. Don't draw axis lines or tick marks.
- With two axes, the right axis has exactly as many ticks as the left, so both share the same gridlines. For example 500/1000/1500 on the left and 50/100/150 on the right.
- Bars read on the left axis and lines on the right.

### 2.7 Bars

- Square corners, no outline, no shadow.
- Stacked segments touch: no gap between them.
- Bars start at value 0 at the plot bottom, with no baseline drawn.

### 2.8 Legends

The references have no legend. Name the series in the text next to the chart: the slide text or the paragraph above it on the website. If a chart truly needs a legend, ask design first; there is no legend style yet.

### 2.10 Motion (website)

On the website a chart starts empty: canvas, backdrop, gridlines, tick labels, category labels and axis titles. The data then animates in, the first time 45% of the chart is in view and again on "Replay".

| Piece | Movement | Duration | Start | Easing |
|---|---|---|---|---|
| Bar, bottom segment | Grows up from the baseline (scale 0 → 1, anchored at the bottom) | 700 ms | 70 ms × category index | `cubic-bezier(0.2, 0.7, 0.2, 1)` |
| Bar, top segment | Same, from the top of the bottom segment | 455 ms | 70 ms × index + 450 ms | same |
| Line | Revealed from left to right at constant speed | 1400 ms | 500 ms | linear |
| Marker | Scales in from its centre when the line reaches it | 320 ms | 500 ms + 1400 ms × index / (n − 1) | `cubic-bezier(0.3, 1.5, 0.5, 1)` |

With reduced motion turned on, the finished chart shows at once.

How it works: `hzero_charts` gives every bar, line and marker an id in the SVG (`hz-bar-<series>-<index>`, `hz-line-<series>`, `hz-marker-<series>-<index>`). The page `charts.html` inlines the SVG, and `web/src/charts.ts` with the chart rules in `site.css` animates those ids. Slides use the finished, static frame.

### 2.11 Fixes compared with the references

| Reference | Issue | Rule |
|---|---|---|
| `graph_1.svg` | The 500 and 1000 gridlines sit at y 616 and 515, about 12 and 6 px higher than their values (the bars and the 1500 line are correct). | Gridlines sit exactly at their values: y 628 and 521 on that chart. |
| Systems by segment | Tick labels 8–20 are about 12 px; "4" is 15 px. | All tick labels are 15 px. |
| `graph_1.svg` | Gridlines are layered above the bars in the file. | Gridlines go under the bars (2.3). |

---

## 3. From Jupyter to the website and slides

```
notebooks/charts.ipynb ──> hzero_charts (style package) ──> web/public/charts/*.svg  (website)
                                                       └──> exports/slides/*.png, *.svg  (slides)
```

- **`notebooks/hzero_charts/`** is a small Python package. It holds every value in this file as code, plus Inter Regular and SemiBold as TTF files (SIL Open Font License, see `fonts/OFL.txt`). It builds matplotlib charts that match the references to within half a pixel.
- **`notebooks/charts.ipynb`** loads the data into pandas tables, builds each chart and exports it.
- **On every push to `main`**, GitHub Actions runs all notebooks, then builds and deploys the site. The website charts are regenerated from the notebook every time.

### Making a chart

```python
from hzero_charts import bar_chart, bar_line_chart, export

fig = bar_chart(df["segment"], df["systems"], ticks=[4, 8, 12, 16, 20], title="Number of systems")
export(fig, "systems-by-segment")

fig = bar_line_chart(
    categories=df["year"].astype(str),
    bars={"Public": df["public"], "Private": df["private"]},        # bottom first
    lines={"Installed": df["installed"], "Planned": df["planned"]},
    left_ticks=[500, 1000, 1500], right_ticks=[50, 100, 150],
    left_title="Spending (MEUR)", right_title="Number of systems",
)
export(fig, "spending-and-systems")
```

To use a chart on the website: add a `<figure class="chart" data-chart="charts/<name>.svg">` to `web/charts.html`, following the two that are there. The `<img>` inside it holds the alt text, which says what the chart shows. The page animates the chart in (2.10).

To use it in slides: place `exports/slides/<name>.png` (or the SVG) full-bleed on a 16:9 slide.

### Running it on your own computer

```bash
cd notebooks
pip install -r requirements.txt
jupyter lab charts.ipynb
```

### Rules for Claude and anyone else making charts

- Always build charts through `hzero_charts`. Never style matplotlib, Plotly or any other library by hand.
- If a chart type is missing (a horizontal bar, an area chart), add a function to `hzero_charts` that follows sections 2.2–2.8. Then update this file in the same change.
- Never invent colours, sizes or fonts. Take them from this file; if something isn't covered, ask.
- Check every new chart against the reference geometry: the plot box, the 3 px headroom, and the 12, 13 and 22 px offsets.
