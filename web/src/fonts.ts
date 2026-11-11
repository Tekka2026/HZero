/**
 * Title font: Selecta (Maxitype).
 *
 * Drop the font files into web/assets/fonts/selecta/ (woff2, woff or otf/ttf).
 * Every file there is registered as the "Selecta" family; weight and style are read from the file name
 * (e.g. Selecta-Light.woff2, SelectaTrial-MediumItalic.otf). With no files present, titles fall back to Inter.
 *
 * Regular (400) is the weight every title uses, so it is declared in site.css and preloaded in each page's <head>
 * instead: that way the browser fetches it straight away and titles never flash in Inter first.
 */
const files = import.meta.glob("../assets/fonts/selecta/*.{woff2,woff,otf,ttf}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const WEIGHTS: [RegExp, number][] = [
  [/hairline|thin/i, 100],
  [/extra-?light|ultra-?light/i, 200],
  [/light/i, 300],
  [/medium/i, 500],
  [/semi-?bold|demi/i, 600],
  [/extra-?bold|ultra-?bold/i, 800],
  [/black|heavy/i, 900],
  [/bold/i, 700],
];

export function loadSelecta(): void {
  const entries = Object.entries(files);
  if (!entries.length || !("fonts" in document)) return;
  // Prefer woff2 over other formats when the same style is present more than once.
  const rank = (f: string) => ["woff2", "woff", "otf", "ttf"].indexOf(f.split(".").pop()!.toLowerCase());
  const seen = new Map<string, FontFace>();
  for (const [path, url] of entries.sort(([a], [b]) => rank(a) - rank(b))) {
    const name = path.split("/").pop()!.replace(/\.[^.]+$/, "");
    const weight = WEIGHTS.find(([re]) => re.test(name))?.[1] ?? 400;
    const style = /italic|oblique/i.test(name) ? "italic" : "normal";
    const key = `${weight}-${style}`;
    if (seen.has(key) || key === "400-normal") continue;
    const face = new FontFace("Selecta", `url(${url})`, { weight: String(weight), style, display: "swap" });
    seen.set(key, face);
    // Registered only: the browser downloads a weight the first time a heading actually uses it.
    document.fonts.add(face);
  }
}
