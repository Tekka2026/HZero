/** Prefixes a site path with the configured base, so the site works under /HZero/brand and at a domain root. */
export function url(path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}
