// The brand tokens, read straight from the shared file at the repository root.
import tokens from "../../../tokens/hzero.json";

export { tokens };

export type Colour = { id: string; name: string; hex: string; role?: string; rgb?: string; pms?: string; use?: string };

const all: Colour[] = [
  ...tokens.color.primary,
  ...tokens.color.secondary,
  ...tokens.color.greys,
];

export function colour(id: string): Colour {
  const c = all.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown colour token "${id}" (see tokens/hzero.json)`);
  return c;
}

/** Text colour that reads on a given background token. */
export function inkOn(id: string): string {
  const hex = colour(id).hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#091314" : "#EEF2F2";
}

export function rgbOf(hex: string): string {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}
