"""hzero chart style for Jupyter.

Reproduces the hzero chart design language described in DESIGN.md (repository root) with matplotlib.
Every size in this file is in pixels on the 1920 x 1080 slide frame; the figure is rendered at
100 dpi so one pixel of the frame is one pixel of the output (two with scale=2).

    from hzero_charts import bar_line_chart, bar_chart, export

    fig = bar_chart(["R&D\\nFederal", "HPC\\nData center"], [20, 18.7], ticks=[4, 8, 12, 16, 20],
                    title="Number of systems")
    export(fig, "systems-by-segment")
"""

from __future__ import annotations

from pathlib import Path
from typing import Mapping, Sequence

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib import font_manager  # noqa: E402
from matplotlib.transforms import Bbox  # noqa: E402

__all__ = ["COLORS", "FRAME", "PLOT", "bar_line_chart", "bar_chart", "export"]

# ---------------------------------------------------------------- fonts
_HERE = Path(__file__).parent
for _f in sorted((_HERE / "fonts").glob("*.ttf")):
    font_manager.fontManager.addfont(str(_f))
FONT = "Inter"

# ---------------------------------------------------------------- tokens (see DESIGN.md)
DPI = 100
PT = 72 / DPI                      # points per frame pixel

FRAME = (1920, 1080)               # slide frame, px
PLOT = {"x": 560, "y": 411, "w": 800, "h": 324}   # plot box, px from the top-left corner
HEADROOM = 3                       # top gridline (axis maximum) sits 3 px below the plot top

COLORS = {
    "canvas": "#E5E5E5",
    "grid": "#D2D2D2",
    "text": "#000000",
    "green": "#446455",            # bar, primary / top of a stack
    "sage": "#A8B1A7",             # bar, secondary / base of a stack, single-series bars
    "sand_line": "#E1C9A4", "sand": "#D4A359",       # line series 1: line, marker
    "coral_line": "#EFB1A2", "coral": "#EE7254",     # line series 2: line, marker
}
BAR_ORDER = ["sage", "green"]      # stack order, bottom first
LINE_ORDER = [("sand_line", "sand"), ("coral_line", "coral")]

TICK_SIZE = 15                     # tick and category labels, px
TITLE_SIZE = 18                    # axis titles, px
CAP_HEIGHT = 0.727                 # Inter cap height / digit height, em
BAR_GAP = 3                        # gap between bars, px
TICK_PAD = 13                      # plot edge to tick label, px
CAT_PAD = 6                        # plot bottom to the cap top of a category label, px
CAT_PITCH = 15.4                   # line pitch of two-line category labels, px
TITLE_GAP = 22                     # widest tick label to axis title (ink to ink), px
_TITLE_GAP_BOX = 20                # the same gap measured between matplotlib text boxes
LINE_WIDTH = 2                     # px
MARKER_R = 3                       # px
WEB_PADDING = 48                   # px around the chart in the web export

# layer order, bottom to top
Z = {"backdrop": 0, "grid": 1, "bars": 2, "lines": 3, "markers": 4, "text": 5}

# ---------------------------------------------------------------- helpers
def _fx(px: float) -> float:
    return px / FRAME[0]


def _fy(px: float) -> float:
    return 1 - px / FRAME[1]


def _frame():
    fig = plt.figure(figsize=(FRAME[0] / DPI, FRAME[1] / DPI), dpi=DPI, facecolor=COLORS["canvas"])
    x, y, w, h = PLOT["x"], PLOT["y"], PLOT["w"], PLOT["h"]
    ax = fig.add_axes([_fx(x), _fy(y + h), w / FRAME[0], h / FRAME[1]])
    ax.set_facecolor("none")
    for s in ax.spines.values():
        s.set_visible(False)
    ax.tick_params(length=0, colors=COLORS["text"], labelsize=TICK_SIZE * PT, labelfontfamily=FONT)
    # backdrop: white, transparent at the top, 50% at the bottom
    grad = np.zeros((256, 1, 4))
    grad[..., :3] = 1
    grad[:, 0, 3] = np.linspace(0, 0.5, 256)
    ax.imshow(grad, extent=(0, 1, 0, 1), transform=ax.transAxes, aspect="auto",
              origin="upper", zorder=Z["backdrop"], interpolation="bilinear")
    return fig, ax


def _y_axis(ax, ticks: Sequence[float], side: str, fmt):
    top = max(ticks)
    ax.set_ylim(0, top * PLOT["h"] / (PLOT["h"] - HEADROOM))
    ticks = [t for t in ticks if t != 0]
    ax.set_yticks(ticks, [fmt(t) for t in ticks], fontfamily=FONT, fontsize=TICK_SIZE * PT, color=COLORS["text"])
    ax.yaxis.set_ticks_position(side)
    ax.tick_params(axis="y", pad=TICK_PAD * PT, length=0)
    for lab in ax.get_yticklabels():
        lab.set_verticalalignment("center_baseline")
    return ticks


def _grid(ax, ticks):
    for t in ticks:
        ax.axhline(t, color=COLORS["grid"], linewidth=1 * PT, zorder=Z["grid"], snap=True, antialiased=False)


def _slots(n: int):
    slot = (PLOT["w"] + BAR_GAP) / n
    width = slot - BAR_GAP
    lefts = np.arange(n) * slot
    return lefts, width, lefts + width / 2


def _categories(fig, ax, labels: Sequence[str], centres):
    ax.set_xlim(0, PLOT["w"])
    ax.set_xticks([])
    base = PLOT["y"] + PLOT["h"] + CAT_PAD + CAP_HEIGHT * TICK_SIZE        # first baseline, px
    for label, cx in zip(labels, centres):
        for i, line in enumerate(str(label).split("\n")):
            fig.text(_fx(PLOT["x"] + cx), _fy(base + i * CAT_PITCH), line, ha="center", va="baseline",
                     fontfamily=FONT, fontsize=TICK_SIZE * PT, color=COLORS["text"], zorder=Z["text"])


def _title(fig, axis, text: str, side: str):
    """Rotated axis title, 22 px outside the widest tick label, centred on the plot height."""
    fig.canvas.draw()
    r = fig.canvas.get_renderer()
    boxes = [lab.get_window_extent(r) for lab in axis.get_ticklabels() if lab.get_text()]
    cy = _fy(PLOT["y"] + PLOT["h"] / 2 + 1)    # +1 px: optical centre of the ink, as in the source
    if side == "left":
        edge = min(b.x0 for b in boxes) / fig.dpi / fig.get_figwidth()      # fig fraction
        fig.text(edge - _TITLE_GAP_BOX / FRAME[0], cy, text, rotation=90, ha="right", va="center",
                 fontfamily=FONT, fontsize=TITLE_SIZE * PT, color=COLORS["text"], zorder=Z["text"])
    else:
        edge = max(b.x1 for b in boxes) / fig.dpi / fig.get_figwidth()
        fig.text(edge + (_TITLE_GAP_BOX - 0.5) / FRAME[0], cy, text, rotation=90, ha="left", va="center",
                 fontfamily=FONT, fontsize=TITLE_SIZE * PT, color=COLORS["text"], zorder=Z["text"])


def _num(t: float) -> str:
    return f"{t:g}"


# ---------------------------------------------------------------- charts
def bar_chart(categories: Sequence[str], values: Sequence[float], ticks: Sequence[float],
              title: str | None = None, color: str = "sage", fmt=_num):
    """Single-series bar chart (systems by segment). Category labels may use '\\n' for two lines."""
    fig, ax = _frame()
    lefts, width, centres = _slots(len(categories))
    ax.bar(lefts, values, width=width, align="edge", color=COLORS[color], linewidth=0, zorder=Z["bars"])
    gt = _y_axis(ax, ticks, "left", fmt)
    _grid(ax, gt)
    _categories(fig, ax, categories, centres)
    if title:
        _title(fig, ax.yaxis, title, "left")
    return fig


def bar_line_chart(categories: Sequence[str], bars: Mapping[str, Sequence[float]],
                   lines: Mapping[str, Sequence[float]], left_ticks: Sequence[float],
                   right_ticks: Sequence[float], left_title: str | None = None,
                   right_title: str | None = None, fmt=_num):
    """Stacked bars on the left axis, lines with markers on the right axis.

    bars:  up to two series, stacked in the order given (first = base, sage; second = top, green).
    lines: up to two series (first = sand, second = coral). Points sit on the bar centres.
    The right axis needs as many ticks as the left one so both share the gridlines.
    """
    if len(left_ticks) != len(right_ticks):
        raise ValueError("left_ticks and right_ticks need the same number of ticks so they share gridlines")
    if len(bars) > len(BAR_ORDER) or len(lines) > len(LINE_ORDER):
        raise ValueError("the palette has two bar and two line colours; ask design before adding more series")
    fig, ax = _frame()
    lefts, width, centres = _slots(len(categories))
    bottom = np.zeros(len(categories))
    for (name, vals), key in zip(bars.items(), BAR_ORDER):
        ax.bar(lefts, vals, width=width, bottom=bottom, align="edge", color=COLORS[key],
               linewidth=0, zorder=Z["bars"], label=name)
        bottom = bottom + np.asarray(vals, dtype=float)
    gt = _y_axis(ax, left_ticks, "left", fmt)
    _grid(ax, gt)

    ax2 = ax.twinx()
    ax2.set_facecolor("none")
    for s in ax2.spines.values():
        s.set_visible(False)
    ax2.tick_params(length=0, colors=COLORS["text"])
    _y_axis(ax2, right_ticks, "right", fmt)
    for (name, vals), (line_key, mark_key) in zip(lines.items(), LINE_ORDER):
        ax2.plot(centres, vals, color=COLORS[line_key], linewidth=LINE_WIDTH * PT, zorder=Z["lines"],
                 solid_joinstyle="miter", label=name)
        ax2.scatter(centres, vals, s=(2 * MARKER_R * PT) ** 2, color=COLORS[mark_key], linewidths=0,
                    zorder=Z["markers"])
    ax2.set_xlim(0, PLOT["w"])
    ax.set_zorder(1)
    ax2.set_zorder(2)
    _categories(fig, ax, categories, centres)
    if left_title:
        _title(fig, ax.yaxis, left_title, "left")
    if right_title:
        _title(fig, ax2.yaxis, right_title, "right")
    return fig


# ---------------------------------------------------------------- export
def export(fig, name: str, web_dir: str | Path = "../web/public/charts",
           slides_dir: str | Path = "../exports/slides"):
    """Write the three standard files and close the figure.

    slides:  <name>.png (3840 x 2160, the 1920 x 1080 frame at 2x) and <name>.svg (full frame)
    web:     <name>.svg cropped to the chart with 48 px of canvas around it
    Text is converted to outlines in every SVG, so the files look identical without Inter installed.
    """
    web_dir, slides_dir = Path(web_dir), Path(slides_dir)
    web_dir.mkdir(parents=True, exist_ok=True)
    slides_dir.mkdir(parents=True, exist_ok=True)
    with plt.rc_context({"svg.fonttype": "path", "svg.hashsalt": "hzero"}):
        fig.savefig(slides_dir / f"{name}.png", dpi=DPI * 2, facecolor=fig.get_facecolor())
        fig.savefig(slides_dir / f"{name}.svg", facecolor=fig.get_facecolor())
        fig.canvas.draw()
        tight = fig.get_tightbbox(fig.canvas.get_renderer())
        pad = WEB_PADDING / DPI
        box = Bbox.from_extents(tight.x0 - pad, tight.y0 - pad, tight.x1 + pad, tight.y1 + pad)
        fig.savefig(web_dir / f"{name}.svg", bbox_inches=box, facecolor=fig.get_facecolor())
    plt.close(fig)
    return {"slides_png": slides_dir / f"{name}.png", "slides_svg": slides_dir / f"{name}.svg",
            "web_svg": web_dir / f"{name}.svg"}
