/**
 * Charts page. The charts are the SVGs that Jupyter exports (notebooks/hzero_charts); each bar,
 * line and marker carries an id from matplotlib (hz-bar-<series>-<i>, hz-line-<series>,
 * hz-marker-<series>-<i>). This script inlines the SVG and animates those pieces in.
 * Timings are part of the design language: DESIGN.md, section 2.10.
 */

const MOTION = {
  barDuration: 700,      // ms, one bar segment growing from the baseline
  barStagger: 70,        // ms between neighbouring categories
  stackDelay: 450,       // ms between a stack's base and its top segment
  lineDelay: 500,        // ms after the first bar starts
  lineDuration: 1400,    // ms to draw a line from first to last point
  markerDuration: 320,   // ms, one marker scaling in as the line reaches it
};

export function initCharts() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll<HTMLElement>("[data-chart]").forEach((figure, n) => {
    mount(figure, `c${n}`, reduce).catch((err) => console.error("Chart not loaded", figure.dataset.chart, err));
  });
}

async function mount(figure: HTMLElement, prefix: string, reduce: boolean) {
  const frame = figure.querySelector<HTMLElement>(".chart-frame");
  const img = frame?.querySelector("img");
  const src = figure.dataset.chart;
  if (!frame || !img || !src) return;

  let text = await (await fetch(img.getAttribute("src") || src)).text();
  // ids inside the two SVGs repeat (glyphs, clip paths); prefix them so the inlined charts stay separate
  text = text
    .replace(/id="(?!hz-)([^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#(?!hz-)([^)]+)\)/g, `url(#${prefix}-$1)`)
    .replace(/href="#(?!hz-)([^"]+)"/g, `href="#${prefix}-$1"`);
  const svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement as unknown as SVGSVGElement;
  if (svg.nodeName !== "svg") throw new Error("not an SVG");

  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", img.alt);
  svg.classList.add("chart-svg");
  frame.replaceChildren(svg);

  timeline(svg);
  if (reduce) { svg.classList.add("is-static"); return; }

  const replay = figure.querySelector<HTMLButtonElement>(".chart-replay");
  const start = () => { svg.classList.remove("is-played"); void svg.getBoundingClientRect(); requestAnimationFrame(() => svg.classList.add("is-played")); };
  replay?.addEventListener("click", start);
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { start(); io.disconnect(); }
  }, { threshold: 0.45 });
  io.observe(svg);

}

/** Sets the delay and starting state of every animated piece. Adding .is-played runs it. */
function timeline(svg: SVGSVGElement) {
  const bars = [...svg.querySelectorAll<SVGGElement>('[id^="hz-bar-"]')];
  const categories = new Set(bars.map((b) => b.id.split("-")[3])).size || 1;

  bars.forEach((g) => {
    const [, , series, index] = g.id.split("-").map(Number);
    const delay = index * MOTION.barStagger + series * MOTION.stackDelay;
    g.style.setProperty("--delay", `${delay}ms`);
    g.style.setProperty("--duration", `${series > 0 ? MOTION.barDuration * 0.65 : MOTION.barDuration}ms`);
  });

  // lines are revealed left to right at a constant speed, so each marker can appear as the line reaches it
  svg.querySelectorAll<SVGGElement>('[id^="hz-line-"]').forEach((g) => {
    g.style.setProperty("--delay", `${MOTION.lineDelay}ms`);
    g.style.setProperty("--duration", `${MOTION.lineDuration}ms`);
  });

  svg.querySelectorAll<SVGGElement>('[id^="hz-marker-"]').forEach((g) => {
    const index = Number(g.id.split("-")[3]);
    const at = categories > 1 ? index / (categories - 1) : 1;
    g.style.setProperty("--delay", `${Math.round(MOTION.lineDelay + at * MOTION.lineDuration)}ms`);
    g.style.setProperty("--duration", `${MOTION.markerDuration}ms`);
  });
}
