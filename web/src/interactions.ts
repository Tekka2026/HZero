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

/** Give the navigation a frosted background once the page has scrolled. */
export function initNav() {
  const nav = document.querySelector<HTMLElement>(".nav");
  if (!nav) return;
  const update = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", update, { passive: true });
  update();
}
