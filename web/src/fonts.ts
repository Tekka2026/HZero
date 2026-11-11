/**
 * Title fonts.
 *
 * - Gear Wide (web/assets/fonts/gear/) for h1 and h2.
 * - Selecta (Maxitype, web/assets/fonts/selecta/) for the smaller titles (h3 and below).
 *
 * Every file in a folder is registered under that folder's family name; weight and style are read from the
 * file name (e.g. Selecta-Light.woff2, GearTrialWide-RegularSlant.woff2). With no files present, titles fall
 * back to Inter.
 */
const selecta = import.meta.glob("../assets/fonts/selecta/*.{woff2,woff,otf,ttf}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const gear = import.meta.glob("../assets/fonts/gear/*.{woff2,woff,otf,ttf}", {
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

function register(family: string, files: Record<string, string>): void {
  const entries = Object.entries(files);
  if (!entries.length || !("fonts" in document)) return;
  // Prefer woff2 over other formats when the same style is present more than once.
  const rank = (f: string) => ["woff2", "woff", "otf", "ttf"].indexOf(f.split(".").pop()!.toLowerCase());
  const seen = new Map<string, FontFace>();
  for (const [path, url] of entries.sort(([a], [b]) => rank(a) - rank(b))) {
    const name = path.split("/").pop()!.replace(/\.[^.]+$/, "");
    const weight = WEIGHTS.find(([re]) => re.test(name))?.[1] ?? 400;
    const style = /italic|oblique|slant/i.test(name) ? "italic" : "normal";
    const key = `${weight}-${style}`;
    if (seen.has(key)) continue;
    const face = new FontFace(family, `url(${url})`, { weight: String(weight), style, display: "swap" });
    seen.set(key, face);
    document.fonts.add(face);
    face.load().catch((err) => console.warn(`Could not load ${name}`, err));
  }
}

export function loadTitleFonts(): void {
  register("Gear Wide", gear);
  register("Selecta", selecta);
}
