import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { Group, HybridSystem, Link, Metrics, SystemNode } from "./types";

/** Colours taken from the original SVG illustration. */
const C = {
  plateSide: "#36757e",
  plateTopA: "#272727",
  plateTopB: "#1a1a1a",
  accent: "#6ceafb",
  tileSide: "#41494c",
  tileTopA: "#41494c",
  tileTopB: "#272727",
  tileEdge: "#aab5b7",
  engraved: "#0e1516",
  engravedInactive: "#1a2021",
  label: "#eaeaea",
};

/** Camera matches the SVG projection: 45° azimuth, ~27.5° elevation. */
const ELEVATION = Math.asin(0.462);
const AZIMUTH = Math.PI / 4;
const MAX_TILT = THREE.MathUtils.degToRad(7);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export async function mountHybridScene(container: HTMLElement) {
  if (!webglAvailable()) return;

  const res = await fetch(`${import.meta.env.BASE_URL}${container.dataset.hz3d}`);
  if (!res.ok) throw new Error(`Could not load ${container.dataset.hz3d} (${res.status})`);
  const data: HybridSystem = await res.json();
  await document.fonts?.ready;

  const svg = container.parentElement?.querySelector<SVGElement>("svg.hzero-first-visual__scene");
  container.hidden = false;
  if (svg) svg.style.display = "none";
  container.setAttribute("role", "img");
  container.setAttribute("aria-label", svg?.getAttribute("aria-label") ?? "Hybrid QC–HPC system diagram");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const tooltip = document.createElement("div");
  tooltip.className = "hz3d-tooltip";
  tooltip.hidden = true;
  container.appendChild(tooltip);

  const scene = new THREE.Scene();
  const world = new THREE.Group(); // tilted slightly with the pointer
  scene.add(world);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const camDir = new THREE.Vector3(
    Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    Math.sin(ELEVATION),
    Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  );
  camera.position.copy(camDir).multiplyScalar(60);
  camera.lookAt(0, 0, 0);

  const lineMaterials: LineMaterial[] = [];
  const { plate } = data;
  const plateTop = plate.thickness;

  // --- Plate ---------------------------------------------------------------------------------
  world.add(slab(plate.width, plate.depth, plate.thickness, plate.radius, C.plateSide, [C.plateTopA, C.plateTopB]));
  world.add(outline(plate.width, plate.depth, plate.radius, plateTop + 0.002, C.accent, 1.4, lineMaterials));

  // --- Nodes and links, "engraved" into the plate ------------------------------------------------
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const nodeMeshes: THREE.Mesh[] = [];
  const discGeo = new THREE.CircleGeometry(0.085, 32).rotateX(-Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(0.065, 0.085, 32).rotateX(-Math.PI / 2);
  for (const n of data.nodes) {
    const mat = new THREE.MeshBasicMaterial({ color: n.active ? C.engraved : C.engravedInactive });
    const mesh = new THREE.Mesh(n.active ? discGeo : ringGeo, mat);
    mesh.position.set(n.x, plateTop + 0.004, n.z);
    mesh.userData = { kind: "node", node: n, baseColor: mat.color.clone() };
    world.add(mesh);
    nodeMeshes.push(mesh);
  }

  interface LinkView {
    link: Link;
    line: Line2;
    material: LineMaterial;
    a: THREE.Vector3;
    b: THREE.Vector3;
  }
  const links: LinkView[] = data.links.map((link) => {
    const a = nodeById.get(link.from)!;
    const b = nodeById.get(link.to)!;
    const va = new THREE.Vector3(a.x, plateTop + 0.003, a.z);
    const vb = new THREE.Vector3(b.x, plateTop + 0.003, b.z);
    const geo = new LineGeometry().setPositions([...va.toArray(), ...vb.toArray()]);
    const material = new LineMaterial({
      color: link.active ? C.engraved : C.engravedInactive,
      linewidth: 1.3,
      transparent: true,
      opacity: 0,
    });
    lineMaterials.push(material);
    const line = new Line2(geo, material);
    world.add(line);
    return { link, line, material, a: va, b: vb };
  });

  // --- Floating tiles: HPC, Workloads, QC --------------------------------------------------------
  const tileMeshes: THREE.Object3D[] = [];
  const tileOutlines = new Map<string, LineMaterial>();
  for (const g of data.groups) {
    const tile = new THREE.Group();
    tile.position.set(g.x, plateTop + g.height, g.z);
    const body = slab(g.size, g.size, 0.12, 0.2, C.tileSide, [C.tileTopA, C.tileTopB, C.tileTopB]);
    body.userData = { kind: "group", group: g };
    tile.add(body);
    const edgeMats: LineMaterial[] = [];
    tile.add(outline(g.size, g.size, 0.2, 0.122, C.tileEdge, 1.1, edgeMats, 0.65));
    lineMaterials.push(...edgeMats);
    tileOutlines.set(g.id, edgeMats[0]);
    tile.add(labelSprite(g.label, g.size));
    world.add(tile);
    tileMeshes.push(body);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(g.size * 1.35, g.size * 1.35).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.75, depthWrite: false }),
    );
    shadow.position.set(g.x, plateTop + 0.001, g.z);
    shadow.renderOrder = -1;
    world.add(shadow);

    // Engraved footprint of the tile on the plate, as in the original illustration.
    const foot = outline(g.size, g.size, 0.2, plateTop + 0.002, C.engravedInactive, 1, lineMaterials);
    foot.position.set(g.x, 0, g.z);
    world.add(foot);
  }

  // --- Pulses travelling along active links (amount ∝ simulated traffic) ------------------------
  interface Pulse {
    view: LinkView;
    offset: number;
    speed: number;
    reverse: boolean;
  }
  const pulses: Pulse[] = [];
  for (const view of links) {
    if (!view.link.active || view.link.flow <= 0) continue;
    const count = Math.max(1, Math.round(view.link.flow * 4));
    const len = view.a.distanceTo(view.b);
    for (let i = 0; i < count; i++) {
      pulses.push({ view, offset: i / count, speed: 0.55 / len, reverse: i % 2 === 1 });
    }
  }
  const pulseMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.055, 16, 12),
    new THREE.MeshBasicMaterial({ color: C.accent, transparent: true }),
    Math.max(pulses.length, 1),
  );
  pulseMesh.count = 0;
  pulseMesh.frustumCulled = false;
  world.add(pulseMesh);

  // --- Layout ------------------------------------------------------------------------------------
  const fitPoints: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, plateTop])
    fitPoints.push(new THREE.Vector3((sx * plate.width) / 2, y, (sz * plate.depth) / 2));
  for (const g of data.groups) fitPoints.push(new THREE.Vector3(g.x, plateTop + g.height + 0.4, g.z));

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    for (const m of lineMaterials) m.resolution.set(w, h);
    camera.updateMatrixWorld();
    const box = new THREE.Box2();
    for (const p of fitPoints) {
      const v = p.clone().applyMatrix4(camera.matrixWorldInverse);
      box.expandByPoint(new THREE.Vector2(v.x, v.y));
    }
    const pad = 1.06;
    let halfW = ((box.max.x - box.min.x) / 2) * pad;
    let halfH = ((box.max.y - box.min.y) / 2) * pad;
    if (halfW / halfH > w / h) halfH = halfW / (w / h);
    else halfW = halfH * (w / h);
    const cx = (box.max.x + box.min.x) / 2;
    const cy = (box.max.y + box.min.y) / 2;
    Object.assign(camera, { left: cx - halfW, right: cx + halfW, top: cy + halfH, bottom: cy - halfH });
    camera.updateProjectionMatrix();
    render();
  }

  // --- Interaction: gentle tilt, hover details ----------------------------------------------------
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let targetTilt = 0;
  let hovered: { kind: "group"; group: Group } | { kind: "node"; node: SystemNode } | null = null;

  const onPointer = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    if (e.pointerType === "mouse") targetTilt = reducedMotion ? 0 : pointer.x * MAX_TILT;
    updateHover(e.clientX - rect.left, e.clientY - rect.top);
  };
  container.addEventListener("pointermove", onPointer);
  container.addEventListener("pointerdown", onPointer); // tap shows details on touch screens
  container.addEventListener("pointerleave", () => {
    targetTilt = 0;
    setHover(null);
  });

  function updateHover(x: number, y: number) {
    raycaster.setFromCamera(pointer, camera);
    const tileHit = raycaster.intersectObjects(tileMeshes, false)[0];
    let next: typeof hovered = null;
    if (tileHit) next = { kind: "group", group: tileHit.object.userData.group };
    else {
      // Nodes are tiny; pick the nearest one on screen within a small radius.
      let best = 18;
      for (const m of nodeMeshes) {
        const p = m.getWorldPosition(new THREE.Vector3()).project(camera);
        const dx = ((p.x + 1) / 2) * container.clientWidth - x;
        const dy = ((1 - p.y) / 2) * container.clientHeight - y;
        const d = Math.hypot(dx, dy);
        if (d < best) {
          best = d;
          next = { kind: "node", node: m.userData.node };
        }
      }
    }
    setHover(next);
    if (hovered) {
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
      // Keep the tooltip inside the container on the right edge.
      const overflow = x + 14 + tooltip.offsetWidth - container.clientWidth;
      if (overflow > 0) tooltip.style.left = `${x - overflow - 8}px`;
    }
  }

  function setHover(next: typeof hovered) {
    const same =
      (next === null && hovered === null) ||
      (next && hovered && next.kind === hovered.kind &&
        (next.kind === "group" ? next.group.id === (hovered as { group: Group }).group.id
                               : next.node.id === (hovered as { node: SystemNode }).node.id));
    if (same) return;
    hovered = next;
    container.style.cursor = next ? "pointer" : "";

    const groupId = next?.kind === "group" ? next.group.id : next?.kind === "node" ? next.node.group : null;
    const nodeId = next?.kind === "node" ? next.node.id : null;
    const related = new Set(
      data.nodes.filter((n) => (groupId && n.group === groupId) || n.id === nodeId).map((n) => n.id),
    );

    for (const [id, mat] of tileOutlines) {
      mat.color.set(id === groupId ? C.accent : C.tileEdge);
      mat.opacity = id === groupId ? 1 : 0.65;
    }
    for (const m of nodeMeshes) {
      const mat = m.material as THREE.MeshBasicMaterial;
      const n = m.userData.node as SystemNode;
      mat.color.copy(related.has(n.id) && n.active ? new THREE.Color(C.accent) : m.userData.baseColor);
    }
    for (const v of links) {
      const hit = related.has(v.link.from) || related.has(v.link.to);
      v.material.color.set(hit && v.link.active ? C.accent : v.link.active ? C.engraved : C.engravedInactive);
    }

    if (!next) {
      tooltip.hidden = true;
    } else {
      const title = next.kind === "group" ? next.group.label : nodeTitle(next.node, data.groups);
      const metrics = next.kind === "group" ? next.group.metrics : next.node.metrics;
      tooltip.innerHTML = `<strong>${escapeHtml(title)}</strong>${metricList(metrics)}`;
      tooltip.hidden = false;
    }
    render();
  }

  // --- Animation ---------------------------------------------------------------------------------
  const t0 = performance.now();
  const elapsed = () => (performance.now() - t0) / 1000;
  let revealStart: number | null = null;
  let visible = false;
  let tilt = 0;
  const tmp = new THREE.Object3D();

  function render() {
    renderer.render(scene, camera);
  }

  function frame() {
    const t = elapsed();
    tilt += (targetTilt - tilt) * 0.08;
    world.rotation.y = tilt;

    // Reveal links step by step (3 → 4 → 5), like the original illustration's sequence.
    const since = revealStart === null ? 0 : t - revealStart;
    for (const v of links) {
      const start = reducedMotion ? -1 : (v.link.step - 3) * 0.6;
      const p = THREE.MathUtils.clamp((since - start) / 0.6, 0, 1);
      v.material.opacity = revealStart === null ? 0 : p;
    }

    let i = 0;
    if (revealStart !== null && !reducedMotion) {
      for (const pulse of pulses) {
        const start = (pulse.view.link.step - 3) * 0.6 + 0.6;
        if (since < start) continue;
        let u = (pulse.offset + (t - revealStart) * pulse.speed) % 1;
        if (pulse.reverse) u = 1 - u;
        tmp.position.lerpVectors(pulse.view.a, pulse.view.b, u);
        tmp.position.y += 0.03;
        const fade = Math.sin(Math.PI * u); // fade in/out at the ends
        tmp.scale.setScalar(0.55 + 0.45 * fade);
        tmp.updateMatrix();
        pulseMesh.setMatrixAt(i++, tmp.matrix);
      }
    }
    pulseMesh.count = i;
    pulseMesh.instanceMatrix.needsUpdate = true;
    render();
  }

  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && revealStart === null) revealStart = elapsed();
      renderer.setAnimationLoop(visible ? frame : null);
      if (!visible) render();
    },
    { threshold: 0.25 },
  ).observe(container);
  resize();
}

// --- Geometry helpers ------------------------------------------------------------------------------

function roundedRect(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** A rounded slab lying on y=0..height with a gradient top and a flat-coloured side. */
function slab(w: number, d: number, height: number, r: number, side: string, top: string[]): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w, d, r), { depth: height, bevelEnabled: false, curveSegments: 8 });
  geo.rotateX(-Math.PI / 2); // extrude upwards
  const tex = gradientTexture(top);
  // Cap UVs are in shape units; map them onto 0..1 so the gradient spans the whole top.
  tex.repeat.set(1 / w, 1 / d);
  tex.offset.set(0.5, 0.5);
  const capMat = new THREE.MeshBasicMaterial({ map: tex });
  const sideMat = new THREE.MeshBasicMaterial({ color: side });
  return new THREE.Mesh(geo, [capMat, sideMat]);
}

function outline(w: number, d: number, r: number, y: number, color: string, width: number, store: LineMaterial[], opacity = 1) {
  const pts = roundedRect(w, d, r).getPoints(12);
  const positions = pts.flatMap((p) => [p.x, y, -p.y]);
  positions.push(positions[0], positions[1], positions[2]);
  const mat = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity });
  store.push(mat);
  return new Line2(new LineGeometry().setPositions(positions), mat);
}

function gradientTexture(stops: string[]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 128, 115, 0); // matches x1=0 y1=0 x2=.9 y2=1 in screen space
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let shadowTex: THREE.CanvasTexture | null = null;
function shadowTexture(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.filter = "blur(9px)";
  ctx.fillStyle = "rgba(10,10,10,0.9)";
  ctx.beginPath();
  ctx.roundRect(22, 22, 84, 84, 10);
  ctx.fill();
  shadowTex = new THREE.CanvasTexture(c);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  return shadowTex;
}

function labelSprite(text: string, tileSize: number): THREE.Sprite {
  const scale = 4;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = `400 ${17 * scale}px "Inter Variable", Inter, Arial, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 8 * scale;
  c.width = w;
  c.height = 26 * scale;
  ctx.font = font;
  ctx.fillStyle = C.label;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  // 17px text on a tile ~81px wide in the SVG → scale relative to the tile.
  const h = tileSize * 0.3;
  sprite.scale.set((h * w) / c.height, h, 1);
  sprite.position.set(0, 0.13, 0);
  sprite.renderOrder = 10;
  sprite.raycast = () => {}; // labels should not block hover on the tile
  return sprite;
}

// --- Misc ------------------------------------------------------------------------------------------

function nodeTitle(n: SystemNode, groups: Group[]): string {
  if (n.layer === "hzero") return "hzero integration node";
  const g = groups.find((x) => x.id === n.group);
  return `${g?.label ?? n.group} resource`;
}

function metricList(m: Metrics): string {
  return (
    "<dl>" +
    Object.entries(m)
      .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd>`)
      .join("") +
    "</dl>"
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
