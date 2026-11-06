import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { HorizontalTiltShiftShader } from "three/addons/shaders/HorizontalTiltShiftShader.js";
import { VerticalTiltShiftShader } from "three/addons/shaders/VerticalTiltShiftShader.js";
import type { Group, HybridSystem, Link, Metrics, SystemNode } from "./types";

/** Light palette: white, warm greys, sand, black. */
const C = {
  ink: "#0a0a0a",
  plateTopA: "#ffffff",
  plateTopB: "#f1eee8",
  plateSide: "#e2dccf",
  plateEdge: "#0a0a0a",
  tileTopA: "#ffffff",
  tileTopB: "#f5f2ec",
  tileSide: "#e6e0d4",
  tileEdge: "#0a0a0a",
  link: "#0a0a0a",
  linkInactive: "#0a0a0a",
  sand: "#b08d57",
  sandDeep: "#8c6d3f",
  shadow: "rgba(46, 36, 20, 1)",
  label: "#141414",
  dots: "#0a0a0a",
};

/** Same viewing direction as the original illustration (45° azimuth, ~27.5° elevation), with mild perspective. */
const ELEVATION = Math.asin(0.462);
const AZIMUTH = Math.PI / 4;
const FOV = 20;
const MAX_TILT = THREE.MathUtils.degToRad(5);

/** How far (in tile widths on screen) the pointer can be for a tile to start lifting. */
const PROXIMITY_NEAR = 0.45;
const PROXIMITY_FAR = 2.1;
const LIFT = 0.85;

/** Corner radius of the plate and tiles (0 = sharp corners). */
const CORNER = 0;

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

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const tooltip = document.createElement("div");
  tooltip.className = "hz3d-tooltip";
  tooltip.hidden = true;
  container.appendChild(tooltip);

  const pageBg = getComputedStyle(container).getPropertyValue("--bg").trim() || "#ffffff";
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(pageBg);
  const world = new THREE.Group(); // tilted slightly with the pointer
  scene.add(world);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 400);
  const camDir = new THREE.Vector3(
    Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    Math.sin(ELEVATION),
    Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  );

  const lineMaterials: LineMaterial[] = [];
  const { plate } = data;
  const PLATE_THICKNESS = 0.07;
  const plateTop = PLATE_THICKNESS;

  // --- Ground: a dot grid that fades out around the plate --------------------------------------
  world.add(dotGrid(34, plate));

  // --- Plate: thin slab, hairline edge, soft contact shadow --------------------------------------
  const plateShadow = softShadow(plate.width * 1.25, plate.depth * 1.35, 0.13, 26);
  plateShadow.position.y = 0.0005;
  world.add(plateShadow);
  world.add(slab(plate.width, plate.depth, PLATE_THICKNESS, CORNER, C.plateSide, [C.plateTopA, C.plateTopB]));
  world.add(outline(plate.width, plate.depth, CORNER, plateTop + 0.002, C.plateEdge, 1, lineMaterials, 0.16));

  // --- Nodes and links ---------------------------------------------------------------------------
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const nodeMeshes: THREE.Mesh[] = [];
  const discGeo = new THREE.CircleGeometry(0.055, 32).rotateX(-Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(0.042, 0.055, 32).rotateX(-Math.PI / 2);
  for (const n of data.nodes) {
    const mat = new THREE.MeshBasicMaterial({
      color: C.ink,
      transparent: true,
      opacity: n.active ? 0.85 : 0.28,
    });
    const mesh = new THREE.Mesh(n.active ? discGeo : ringGeo, mat);
    mesh.position.set(n.x, plateTop + 0.004, n.z);
    mesh.userData = { kind: "node", node: n };
    world.add(mesh);
    nodeMeshes.push(mesh);
  }

  interface LinkView {
    link: Link;
    material: LineMaterial;
    a: THREE.Vector3;
    b: THREE.Vector3;
    baseOpacity: number;
  }
  const links: LinkView[] = data.links.map((link) => {
    const a = nodeById.get(link.from)!;
    const b = nodeById.get(link.to)!;
    const va = new THREE.Vector3(a.x, plateTop + 0.003, a.z);
    const vb = new THREE.Vector3(b.x, plateTop + 0.003, b.z);
    const material = new LineMaterial({
      color: link.active ? C.link : C.linkInactive,
      linewidth: 1,
      transparent: true,
      opacity: 0,
      dashed: !link.active,
      dashSize: 0.08,
      gapSize: 0.08,
    });
    lineMaterials.push(material);
    const line = new Line2(new LineGeometry().setPositions([...va.toArray(), ...vb.toArray()]), material);
    line.computeLineDistances();
    world.add(line);
    return { link, material, a: va, b: vb, baseOpacity: link.active ? 0.38 : 0.16 };
  });

  // --- Floating tiles: HPC, Workloads, QC --------------------------------------------------------
  interface TileView {
    group: Group;
    root: THREE.Group;
    body: THREE.Mesh;
    edge: LineMaterial;
    shadow: THREE.Mesh;
    baseY: number;
    lift: number; // 0..1, eased
    target: number; // 0..1, from pointer proximity
    phase: number;
  }
  const tiles: TileView[] = [];
  const TILE_THICKNESS = 0.06;
  for (const g of data.groups) {
    const root = new THREE.Group();
    const baseY = plateTop + g.height;
    root.position.set(g.x, baseY, g.z);

    const body = slab(g.size, g.size, TILE_THICKNESS, CORNER, C.tileSide, [C.tileTopA, C.tileTopB]);
    body.userData = { kind: "group", group: g };
    root.add(body);
    const edgeMats: LineMaterial[] = [];
    root.add(outline(g.size, g.size, CORNER, TILE_THICKNESS + 0.002, C.tileEdge, 1, edgeMats, 0.22));
    lineMaterials.push(...edgeMats);
    root.add(labelSprite(g.label, g.size, TILE_THICKNESS));
    world.add(root);

    const shadow = softShadow(g.size * 1.2, g.size * 1.2, 0.22, 18);
    shadow.position.set(g.x, plateTop + 0.001, g.z);
    world.add(shadow);

    // Footprint where the tile docks into the plate.
    const foot = outline(g.size, g.size, CORNER, plateTop + 0.002, C.ink, 1, lineMaterials, 0.08);
    foot.position.set(g.x, 0, g.z);
    world.add(foot);

    tiles.push({ group: g, root, body, edge: edgeMats[0], shadow, baseY, lift: 0, target: 0, phase: Math.random() * Math.PI * 2 });
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
    for (let i = 0; i < count; i++) pulses.push({ view, offset: i / count, speed: 0.5 / len, reverse: i % 2 === 1 });
  }
  const maxPulses = Math.max(pulses.length, 1);
  const pulseCore = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.04, 16, 12),
    new THREE.MeshBasicMaterial({ color: C.sandDeep }),
    maxPulses,
  );
  const pulseHalo = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.16, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: radialTexture(), color: C.sand, transparent: true, opacity: 0.55, depthWrite: false }),
    maxPulses,
  );
  for (const m of [pulseCore, pulseHalo]) {
    m.count = 0;
    m.frustumCulled = false;
    world.add(m);
  }

  // --- Post-processing: tilt-shift depth of field --------------------------------------------------
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }),
  );
  composer.addPass(new RenderPass(scene, camera));
  const hBlur = new ShaderPass(HorizontalTiltShiftShader);
  const vBlur = new ShaderPass(VerticalTiltShiftShader);
  composer.addPass(hBlur);
  composer.addPass(vBlur);
  composer.addPass(new OutputPass());

  // --- Layout ------------------------------------------------------------------------------------
  const fitPoints: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, plateTop])
    fitPoints.push(new THREE.Vector3((sx * plate.width) / 2, y, (sz * plate.depth) / 2));
  for (const g of data.groups) fitPoints.push(new THREE.Vector3(g.x, plateTop + g.height + LIFT + 0.3, g.z));
  const lookTarget = new THREE.Vector3(0, plateTop + 0.3, 0);

  let width = 1;
  let height = 1;
  let baseFocus = 0.5; // screen position (0 = bottom, 1 = top) that is in focus at rest
  let focus = 0.5;
  function resize() {
    width = container.clientWidth;
    height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    for (const m of lineMaterials) m.resolution.set(width, height);

    // Find the camera distance that makes the plate fill the frame, then centre it with a view offset.
    camera.aspect = width / height;
    camera.clearViewOffset();
    let dist = 40;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < 4; i++) {
      camera.position.copy(lookTarget).addScaledVector(camDir, dist);
      camera.lookAt(lookTarget);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      const box = new THREE.Box2();
      for (const p of fitPoints) {
        const v = p.clone().project(camera);
        box.expandByPoint(new THREE.Vector2(v.x, v.y));
      }
      cx = (box.min.x + box.max.x) / 2;
      cy = (box.min.y + box.max.y) / 2;
      const half = Math.max((box.max.x - box.min.x) / 2, (box.max.y - box.min.y) / 2);
      dist *= half / 0.92;
    }
    camera.setViewOffset(width, height, (cx * width) / 2, (-cy * height) / 2, width, height);
    camera.updateProjectionMatrix();

    // Depth of field: sharp around the plate's centre line, softening towards the far and near edges.
    const centre = new THREE.Vector3(0, plateTop, 0).project(camera);
    baseFocus = focus = (centre.y + 1) / 2;
    hBlur.uniforms.h.value = 1.7 / width;
    vBlur.uniforms.v.value = 1.7 / height;
    setFocus(focus);
    render();
  }

  // --- Interaction -------------------------------------------------------------------------------
  const pointerNdc = new THREE.Vector2();
  const pointerPx = new THREE.Vector2(-1e4, -1e4);
  const raycaster = new THREE.Raycaster();
  let targetTilt = 0;
  let hovered: { kind: "group"; group: Group } | { kind: "node"; node: SystemNode } | null = null;

  const onPointer = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    pointerPx.set(e.clientX - rect.left, e.clientY - rect.top);
    pointerNdc.set((pointerPx.x / rect.width) * 2 - 1, -(pointerPx.y / rect.height) * 2 + 1);
    if (e.pointerType === "mouse") targetTilt = reducedMotion ? 0 : pointerNdc.x * MAX_TILT;
    updateHover();
    wake();
  };
  container.addEventListener("pointermove", onPointer);
  container.addEventListener("pointerdown", onPointer); // tap works on touch screens
  container.addEventListener("pointerleave", () => {
    targetTilt = 0;
    pointerPx.set(-1e4, -1e4);
    setHover(null);
    wake();
  });

  const toScreen = (v: THREE.Vector3) => {
    const p = v.clone().project(camera);
    return new THREE.Vector2(((p.x + 1) / 2) * width, ((1 - p.y) / 2) * height);
  };

  /** Proximity in screen space: 1 when the pointer is on the tile, easing to 0 a tile-width or so away. */
  function updateProximity() {
    for (const t of tiles) {
      const centre = t.root.getWorldPosition(new THREE.Vector3());
      const c = toScreen(centre);
      const edge = toScreen(centre.clone().add(new THREE.Vector3(t.group.size / 2, 0, -t.group.size / 2)));
      const size = c.distanceTo(edge) * 2;
      const d = c.distanceTo(pointerPx);
      t.target = 1 - THREE.MathUtils.smoothstep(d, size * PROXIMITY_NEAR, size * PROXIMITY_FAR);
    }
  }

  function updateHover() {
    raycaster.setFromCamera(pointerNdc, camera);
    const tileHit = raycaster.intersectObjects(tiles.map((t) => t.body), false)[0];
    let next: typeof hovered = null;
    if (tileHit) next = { kind: "group", group: tileHit.object.userData.group };
    else {
      let best = 16;
      for (const m of nodeMeshes) {
        const d = toScreen(m.getWorldPosition(new THREE.Vector3())).distanceTo(pointerPx);
        if (d < best) {
          best = d;
          next = { kind: "node", node: m.userData.node };
        }
      }
    }
    setHover(next);
    if (hovered) {
      tooltip.style.left = `${pointerPx.x}px`;
      tooltip.style.top = `${pointerPx.y}px`;
      const overflow = pointerPx.x + 14 + tooltip.offsetWidth - width;
      if (overflow > 0) tooltip.style.left = `${pointerPx.x - overflow - 8}px`;
    }
  }

  let highlightGroup: string | null = null;
  let highlightNode: string | null = null;
  function setHover(next: typeof hovered) {
    const key = (h: typeof hovered) => (h ? (h.kind === "group" ? `g:${h.group.id}` : `n:${h.node.id}`) : "");
    if (key(next) === key(hovered)) return;
    hovered = next;
    container.style.cursor = next ? "pointer" : "";
    highlightGroup = next?.kind === "group" ? next.group.id : next?.kind === "node" ? next.node.group : null;
    highlightNode = next?.kind === "node" ? next.node.id : null;

    if (!next) {
      tooltip.hidden = true;
    } else {
      const title = next.kind === "group" ? next.group.label : nodeTitle(next.node, data.groups);
      const metrics = next.kind === "group" ? next.group.metrics : next.node.metrics;
      tooltip.innerHTML = `<strong>${escapeHtml(title)}</strong>${metricList(metrics)}`;
      tooltip.hidden = false;
    }
  }

  function isRelated(n: SystemNode | undefined) {
    return !!n && ((highlightGroup !== null && n.group === highlightGroup) || n.id === highlightNode);
  }

  // --- Animation ---------------------------------------------------------------------------------
  const t0 = performance.now();
  const elapsed = () => (performance.now() - t0) / 1000;
  let revealStart: number | null = null;
  let visible = false;
  let tilt = 0;
  const tmp = new THREE.Object3D();
  const sand = new THREE.Color(C.sandDeep);
  const ink = new THREE.Color(C.ink);

  function setFocus(r: number) {
    hBlur.uniforms.r.value = r;
    vBlur.uniforms.r.value = r;
  }

  function render() {
    composer.render();
  }

  function frame() {
    const t = elapsed();
    tilt += (targetTilt - tilt) * 0.06;
    world.rotation.y = tilt;

    updateProximity();
    for (const tile of tiles) {
      tile.lift += (tile.target - tile.lift) * (tile.target > tile.lift ? 0.12 : 0.07);
      const bob = reducedMotion ? 0 : Math.sin(t * 0.9 + tile.phase) * 0.035;
      const l = reducedMotion ? 0 : tile.lift;
      tile.root.position.y = tile.baseY + bob + l * LIFT;
      // Lean slightly towards the viewer as it lifts.
      tile.root.rotation.set(l * 0.05, 0, -l * 0.05);
      const active = highlightGroup === tile.group.id;
      tile.edge.opacity = 0.22 + 0.5 * Math.max(l, active ? 1 : 0);
      tile.edge.color.copy(ink).lerp(sand, Math.max(l, active ? 1 : 0));
      // Higher tile → wider, fainter shadow (the depth cue).
      const h = (tile.root.position.y - plateTop) / (tile.group.height + LIFT);
      tile.shadow.scale.setScalar(0.85 + 0.55 * h);
      (tile.shadow.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1.15 - 0.75 * h);
    }

    // Focus pull: the depth of field follows the tile the pointer is closest to.
    let focusTarget = baseFocus;
    const nearest = tiles.reduce((a, b) => (b.lift > a.lift ? b : a));
    if (nearest.lift > 0.02) {
      const p = nearest.root.getWorldPosition(new THREE.Vector3()).project(camera);
      focusTarget = THREE.MathUtils.lerp(baseFocus, (p.y + 1) / 2, Math.min(1, nearest.lift * 1.4));
    }
    focus += (focusTarget - focus) * 0.12;
    setFocus(focus);

    // Reveal links step by step (3 → 4 → 5).
    const since = revealStart === null ? 0 : t - revealStart;
    for (const v of links) {
      const start = reducedMotion ? -1 : (v.link.step - 3) * 0.55;
      const p = revealStart === null ? 0 : THREE.MathUtils.clamp((since - start) / 0.6, 0, 1);
      const related = isRelated(nodeById.get(v.link.from)) || isRelated(nodeById.get(v.link.to));
      v.material.opacity = p * (related && v.link.active ? 0.9 : v.baseOpacity);
      v.material.color.copy(related && v.link.active ? sand : ink);
    }
    for (const m of nodeMeshes) {
      const mat = m.material as THREE.MeshBasicMaterial;
      const n = m.userData.node as SystemNode;
      mat.color.copy(isRelated(n) && n.active ? sand : ink);
    }

    let i = 0;
    if (revealStart !== null && !reducedMotion) {
      for (const pulse of pulses) {
        const start = (pulse.view.link.step - 3) * 0.55 + 0.6;
        if (since < start) continue;
        let u = (pulse.offset + (t - revealStart) * pulse.speed) % 1;
        if (pulse.reverse) u = 1 - u;
        tmp.position.lerpVectors(pulse.view.a, pulse.view.b, u);
        tmp.position.y += 0.02;
        tmp.scale.setScalar(0.4 + 0.6 * Math.sin(Math.PI * u));
        tmp.updateMatrix();
        pulseCore.setMatrixAt(i, tmp.matrix);
        pulseHalo.setMatrixAt(i, tmp.matrix);
        i++;
      }
    }
    pulseCore.count = pulseHalo.count = i;
    pulseCore.instanceMatrix.needsUpdate = true;
    pulseHalo.instanceMatrix.needsUpdate = true;
    render();
  }

  function wake() {
    if (visible) renderer.setAnimationLoop(frame);
  }

  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && revealStart === null) revealStart = elapsed();
      renderer.setAnimationLoop(visible ? frame : null);
      if (!visible) render();
    },
    { threshold: 0.2 },
  ).observe(container);
  resize();
}

// --- Geometry helpers ------------------------------------------------------------------------------

function roundedRect(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  if (r <= 0) {
    s.moveTo(x, y);
    s.lineTo(x + w, y);
    s.lineTo(x + w, y + d);
    s.lineTo(x, y + d);
    s.lineTo(x, y);
    return s;
  }
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

/** A thin rounded slab on y=0..height with a gradient top and a flat-coloured side. */
function slab(w: number, d: number, height: number, r: number, side: string, top: string[]): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w, d, r), { depth: height, bevelEnabled: false, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);
  const tex = gradientTexture(top);
  tex.repeat.set(1 / w, 1 / d);
  tex.offset.set(0.5, 0.5);
  return new THREE.Mesh(geo, [new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ color: side })]);
}

function outline(w: number, d: number, r: number, y: number, color: string, width: number, store: LineMaterial[], opacity = 1) {
  const pts = roundedRect(w, d, r).getPoints(14);
  const positions = pts.flatMap((p) => [p.x, y, -p.y]);
  positions.push(positions[0], positions[1], positions[2]);
  const mat = new LineMaterial({ color, linewidth: width, transparent: true, opacity });
  store.push(mat);
  return new Line2(new LineGeometry().setPositions(positions), mat);
}

/** Procedural dot grid on the ground plane, fading out with distance from the plate. */
function dotGrid(size: number, plate: { width: number; depth: number }): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      color: { value: new THREE.Color(C.dots) },
      spacing: { value: 0.5 },
      inner: { value: Math.max(plate.width, plate.depth) * 0.45 },
      outer: { value: size * 0.42 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float spacing;
      uniform float inner;
      uniform float outer;
      varying vec2 vPos;
      void main() {
        vec2 cell = fract(vPos / spacing) - 0.5;
        float r = length(cell) * spacing;
        float aa = fwidth(r);
        float dotMask = 1.0 - smoothstep(0.014 - aa, 0.014 + aa, r);
        float fade = 1.0 - smoothstep(inner, outer, length(vPos * vec2(0.85, 1.0)));
        gl_FragColor = vec4(color, dotMask * fade * 0.28);
      }`,
  });
  const geo = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.002;
  mesh.renderOrder = -2;
  return mesh;
}

function gradientTexture(stops: string[]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 128, 128, 0);
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A blurred rounded-rectangle shadow lying on the plate. */
function softShadow(w: number, d: number, opacity: number, blurPx: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.filter = `blur(${blurPx}px)`;
  ctx.fillStyle = C.shadow;
  ctx.beginPath();
  ctx.rect(56, 56, 144, 144);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.6, d * 1.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false }),
  );
  mesh.renderOrder = -1;
  return mesh;
}

let radialTex: THREE.CanvasTexture | null = null;
function radialTexture(): THREE.CanvasTexture {
  if (radialTex) return radialTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  radialTex = new THREE.CanvasTexture(c);
  return radialTex;
}

function labelSprite(text: string, tileSize: number, tileThickness: number): THREE.Sprite {
  const scale = 4;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = `500 ${15 * scale}px "Inter Variable", Inter, Arial, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 8 * scale;
  c.width = w;
  c.height = 24 * scale;
  ctx.font = font;
  ctx.fillStyle = C.label;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const h = tileSize * 0.22;
  sprite.scale.set((h * w) / c.height, h, 1);
  sprite.position.set(0, tileThickness + 0.04, 0);
  sprite.renderOrder = 10;
  sprite.raycast = () => {};
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
