import "./site-menu.js";
import "./hz3d.css";
import { loadTitleFonts } from "./fonts";
import { initFlow, initInView, initMenuPill, initNav, initSpotlight } from "./interactions";

loadTitleFonts();

// Viewport width without the scrollbar, so the nav and the content share one column grid.
const setVw = () => document.documentElement.style.setProperty("--vw", `${document.documentElement.clientWidth}px`);
setVw();
window.addEventListener("resize", setVw);
initNav();
initMenuPill();
initFlow();
initSpotlight();
initInView();

// Load the WebGL diagram only when its container exists, and keep Three.js out of the critical path.
const container = document.querySelector<HTMLElement>("[data-hz3d]");
if (container) {
  import("./hybrid-scene")
    .then(({ mountHybridScene }) => mountHybridScene(container))
    .catch((err) => console.warn("3D diagram unavailable, keeping SVG fallback.", err));
}

// "Why it matters": the sphere of connections.
const sphere = document.querySelector<HTMLElement>("[data-sphere]");
if (sphere) import("./sphere").then(({ mountSphere }) => mountSphere(sphere)).catch((err) => console.error("Sphere unavailable", err));

// Charts page: inline the Jupyter-made SVGs and animate them in.
if (document.querySelector("[data-chart]")) {
  import("./charts").then(({ initCharts }) => initCharts()).catch((err) => console.error("Charts unavailable", err));
}
