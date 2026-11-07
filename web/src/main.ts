import "./site-menu.js";
import "./hz3d.css";
import { loadSelecta } from "./fonts";
import { initFlow, initInView, initMenuPill, initNav, initSpotlight } from "./interactions";

loadSelecta();
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
