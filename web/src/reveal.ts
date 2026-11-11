/**
 * Wipe-to-reveal for h1 and h2: every word sits in a clipping mask and slides up into view,
 * line by line, when the heading scrolls into view.
 *
 * The headings stay hidden (see `html.reveal` in site.css) until the title font has loaded, so the
 * first thing anyone sees is the right font, already moving. Without JavaScript, or with reduced
 * motion, the inline script in <head> never adds `reveal` and headings show as normal.
 */
const FONT_TIMEOUT_MS = 2500;
const WORD_STAGGER_S = 0.07;
const LINE_PAUSE_S = 0.05;

function wrap(node: Node): HTMLSpanElement {
  const outer = document.createElement("span");
  outer.className = "rv-w";
  const inner = document.createElement("span");
  inner.className = "rv-i";
  outer.append(inner);
  node.parentNode?.insertBefore(outer, node);
  inner.append(node);
  return outer;
}

/** Wraps every word (and inline image) in a mask, keeping <br>, <em> and other inline elements intact. */
function splitWords(node: Node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      // Split on ordinary whitespace only, so &nbsp; keeps words together.
      const parts = (child.textContent ?? "").split(/([ \t\n\r]+)/);
      if (parts.length === 1 && !parts[0].trim()) continue;
      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (!part) continue;
        if (/^[ \t\n\r]+$/.test(part)) { frag.append(part); continue; }
        const text = document.createTextNode(part);
        frag.append(text);
        wrap(text);
      }
      child.replaceWith(frag);
    } else if (child instanceof HTMLElement || child instanceof SVGElement) {
      const tag = child.tagName.toUpperCase();
      if (tag === "BR") continue;
      if (tag === "IMG" || tag === "SVG") { child.classList.add("rv-media"); continue; }
      splitWords(child);
    }
  }
}

/** Gives each word its delay: one after another through the heading, with a short pause at each new line. */
function staggerLines(heading: HTMLElement) {
  let line = -1;
  let lastTop = -Infinity;
  let word = 0;
  for (const el of heading.querySelectorAll<HTMLElement>(".rv-w, .rv-media")) {
    const top = Math.round(el.getBoundingClientRect().top);
    if (top > lastTop + 4) { line += 1; lastTop = top; }
    // Word by word through the whole heading, with a short extra beat at each new line.
    el.style.setProperty("--rv-delay", `${(word * WORD_STAGGER_S + line * LINE_PAUSE_S).toFixed(3)}s`);
    word += 1;
  }
}

function fontReady(): Promise<unknown> {
  if (!("fonts" in document)) return Promise.resolve();
  return Promise.race([
    document.fonts.load('400 1em "IBM Plex Sans"').then(() => document.fonts.ready),
    new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS)),
  ]);
}

export async function initHeadingReveal() {
  const root = document.documentElement;
  if (!root.classList.contains("reveal")) return;
  const headings = [...document.querySelectorAll<HTMLElement>("h1, h2")].filter((h) => !h.classList.contains("visually-hidden"));

  await fontReady();

  for (const h of headings) {
    splitWords(h);
    h.classList.add("rv-ready");
  }
  for (const h of headings) staggerLines(h);

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("rv-in");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.15 },
  );
  // Let the hidden state paint once before the first headings start moving.
  requestAnimationFrame(() => requestAnimationFrame(() => headings.forEach((h) => io.observe(h))));
}
