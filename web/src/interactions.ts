/**
 * Page interactions:
 *  - "How it works": the step in the middle of the viewport drives the sticky diagram.
 *  - Bento cards: a spotlight that follows the pointer.
 *  - Mini visuals: start animating once their card scrolls into view.
 */

/** Which diagram elements are highlighted at each step. */
const FLOW_STEPS: Record<number, string[]> = {
  1: ["f-obj", "f-wl", "f-p-obj", "f-p-wl"],
  2: ["f-p-obj", "f-p-wl"],
  3: ["f-p-assign", "f-p-assign2", "f-assign", "f-hpc", "f-qc"],
  4: ["f-p-tel", "f-status", "f-qc"],
  5: ["f-p-fb", "f-status", "f-p-assign", "f-assign", "f-hpc"],
};

export function initFlow(root: ParentNode = document) {
  const flow = root.querySelector<HTMLElement>("[data-flow]");
  if (!flow) return;
  const steps = [...flow.querySelectorAll<HTMLElement>("[data-flow-step]")];
  const max = steps.length;

  const setStep = (n: number) => {
    flow.dataset.step = String(n);
    for (let i = 1; i <= max; i++) flow.classList.toggle(`s${i}`, i <= n);
    steps.forEach((s) => s.classList.toggle("is-active", Number(s.dataset.flowStep) === n));
    const on = new Set(FLOW_STEPS[n] ?? []);
    flow.querySelectorAll<SVGElement>(".f-path, .f-node").forEach((el) => {
      const match = [...el.classList].some((c) => on.has(c));
      el.classList.toggle("is-on", match);
    });
  };

  // A thin band across the middle of the viewport decides the active step.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.flowStep));
    },
    // On phones the diagram is pinned over the top half, so read the step lower down.
    { rootMargin: matchMedia("(max-width: 768px)").matches ? "-55% 0px -40% 0px" : "-45% 0px -50% 0px" },
  );
  steps.forEach((s) => io.observe(s));
  setStep(1);
}

export function initSpotlight(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-spotlight]").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
}

export function initInView(root: ParentNode = document) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    },
    { threshold: 0.3 },
  );
  root.querySelectorAll(".bento-card").forEach((el) => io.observe(el));
}

/**
 * Hides the logo and navigation while scrolling down and brings them back on the first scroll up.
 * They always show near the top of the page, while the phone menu is open and while keyboard focus is in them.
 */
export function initNav() {
  const nav = document.querySelector<HTMLElement>(".nav");
  if (!nav) return;
  const toggle = document.getElementById("menu-toggle");
  const SHOW_ABOVE = 120;     // px from the top: always visible here
  const DELTA = 6;            // ignore tiny scroll jitter
  let lastY = window.scrollY;
  let queued = false;

  const update = () => {
    queued = false;
    const y = window.scrollY;
    const menuOpen = toggle?.getAttribute("aria-expanded") === "true";
    const focused = nav.contains(document.activeElement);
    if (y < SHOW_ABOVE || menuOpen || focused) nav.classList.remove("is-hidden");
    else if (y > lastY + DELTA) nav.classList.add("is-hidden");
    else if (y < lastY - DELTA) nav.classList.remove("is-hidden");
    if (Math.abs(y - lastY) > DELTA || y < SHOW_ABOVE) lastY = y;
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", schedule, { passive: true });
  nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));
  update();
}

/** Desktop menu: a highlight behind the current section's link that slides to whichever link is hovered or focused. */
export function initMenuPill() {
  const menu = document.querySelector<HTMLElement>("#site-menu");
  if (!menu) return;
  const links = [...menu.querySelectorAll<HTMLAnchorElement>("a:not(.site-menu-contact)")];
  const pill = document.createElement("span");
  pill.className = "menu-pill";
  pill.setAttribute("aria-hidden", "true");
  menu.prepend(pill);

  let current: HTMLAnchorElement | null = null;
  let target: HTMLAnchorElement | null = null;

  const moveTo = (link: HTMLAnchorElement | null) => {
    menu.classList.toggle("is-pointing", !!link && link !== current);
    if (!link) { pill.classList.remove("is-shown"); target = null; return; }
    const appearing = !pill.classList.contains("is-shown");
    pill.classList.toggle("no-slide", appearing);   // appear in place, then slide from there
    pill.style.setProperty("--pill-x", `${link.offsetLeft}px`);
    pill.style.setProperty("--pill-w", `${link.offsetWidth}px`);
    pill.classList.add("is-shown");
    if (appearing) requestAnimationFrame(() => pill.classList.remove("no-slide"));
    target = link;
  };

  links.forEach((link) => {
    link.addEventListener("pointerenter", () => moveTo(link));
    link.addEventListener("focus", () => moveTo(link));
  });
  menu.addEventListener("pointerleave", () => moveTo(current));
  menu.addEventListener("focusout", (e) => { if (!menu.contains(e.relatedTarget as Node)) moveTo(current); });

  // the section in the middle of the screen is the current one
  const byId = new Map(links.map((a) => [a.hash.slice(1), a]));
  const visible = new Set<string>();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
    const id = links.map((a) => a.hash.slice(1)).filter((x) => visible.has(x)).pop();
    const next = (id && byId.get(id)) || null;
    if (next === current) return;
    current?.classList.remove("is-current");
    next?.classList.add("is-current");
    current = next;
    if (!menu.matches(":hover") && !menu.contains(document.activeElement)) moveTo(current);
  }, { rootMargin: "-45% 0px -50% 0px" });
  byId.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });

  window.addEventListener("resize", () => moveTo(target));
  document.fonts?.ready.then(() => moveTo(target));
}
