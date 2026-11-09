/**
 * "Why it matters" visual: a sphere of connections.
 *
 * The outer ring is the sphere's outline, marked with 2 x 2 px squares; squares without a line
 * are light grey. Each line runs from a ring square through a shared point inside the sphere to another ring
 * square or to a point on the sphere's surface; a stroke keeps travelling along it from A to B.
 * Squares that receive a line are #82816D; surface points only show a square when a stroke arrives.
 * The globe turns on its own and can be dragged. A sphere's outline looks the same from every
 * angle, so the ring stays a circle while everything inside and on the surface rotates.
 * Canvas 2D with its own 3D projection, so lines and squares stay pixel-sharp.
 */

type V3 = [number, number, number];

const SAMPLES = 64;            // points per curve
const SQUARE = 2;              // px
const ORBIT_SECONDS = 48;      // one turn of the globe when left alone
const FLOW_SECONDS = 3.2;      // a stroke's trip from A to B
const STROKE = 0.4;           // stroke length, share of the route
const INK = "10, 10, 10";
const RECEIVER = "130, 129, 109";   // #82816D: squares that receive a line
const IDLE = "210, 210, 210";       // #D2D2D2: ring squares without a line

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** b: ring square the line ends at; surf: or a point on the sphere's surface, only shown when a stroke arrives */
interface Curve { a: number; b: number; surf?: V3; j1: V3; j2: V3; pull: number; highlight: boolean; delay: number; speed: number }

const SLOTS = 160;              // possible positions on the ring
const FILL = 0.6;              // at most 60% of the positions hold a square
const CONNECTED = 0.45;        // share of squares with a line (kept within 30-60%)
const SURFACE_SHARE = 0.45;    // share of lines that end on the sphere's surface instead of the ring

function build(): { ring: V3[]; curves: Curve[] } {
  const rand = rng(7);
  // squares come in clusters with gaps: score each slot with a slow wave plus noise, keep the top 60%
  const score = Array.from({ length: SLOTS }, (_, i) => {
    const t = (i / SLOTS) * Math.PI * 2;
    return Math.sin(t * 2 + 0.6) * 0.6 + Math.sin(t * 5 + 2.1) * 0.35 + rand() * 0.5;
  });
  const keep = new Set([...score.keys()].sort((a, b) => score[b] - score[a]).slice(0, Math.floor(SLOTS * FILL)));
  const ring: V3[] = [];
  const angle: number[] = [];
  for (let i = 0; i < SLOTS; i++) {
    if (!keep.has(i)) continue;
    const t = (i / SLOTS) * Math.PI * 2 - Math.PI / 2;
    ring.push([Math.cos(t), Math.sin(t), 0]);
    angle.push(t);
  }
  const jitter = (r: number): V3 => {
    const u = rand() * 2 - 1, phi = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u), k = Math.cbrt(rand()) * r;
    return [s * Math.cos(phi) * k, u * k, s * Math.sin(phi) * k];
  };
  // pick the connected squares, then join each to one or two others at least a quarter turn away
  const ids = [...ring.keys()].sort(() => rand() - 0.5).slice(0, Math.round(ring.length * CONNECTED));
  const far = (a: number, b: number) => { const d = Math.abs(angle[a] - angle[b]) % (Math.PI * 2); return Math.min(d, Math.PI * 2 - d) > Math.PI / 2; };
  const curves: Curve[] = [];
  const add = (a: number, b: number, surf?: V3) => curves.push({ a, b, surf, j1: jitter(0.32), j2: jitter(0.32), pull: 0.7 + rand() * 0.25, highlight: false, delay: rand(), speed: 0.8 + rand() * 0.5 });
  // every connected square gets one or two lines, never more
  const degree = new Map<number, number>(ids.map((i) => [i, 0]));
  const want = new Map<number, number>(ids.map((i) => [i, rand() < 0.5 ? 2 : 1]));
  for (const a of ids) {
    while ((degree.get(a) ?? 0) < (want.get(a) ?? 1)) {
      if (rand() < SURFACE_SHARE) {                       // this line ends somewhere on the sphere's surface
        const u = rand() * 2 - 1, phi = rand() * Math.PI * 2, k = Math.sqrt(1 - u * u);
        add(a, a, [k * Math.cos(phi), u, k * Math.sin(phi)]);
        degree.set(a, (degree.get(a) ?? 0) + 1);
        continue;
      }
      const options = ids.filter((b) => b !== a && far(a, b) && (degree.get(b) ?? 0) < 2);
      if (!options.length) break;
      const b = options[Math.floor(rand() * options.length)];
      add(a, b);
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    }
  }
  if (curves[3]) curves[3].highlight = true;
  if (curves[11]) curves[11].highlight = true;
  return { ring, curves };
}

function rotate([x, y, z]: V3, yaw: number, pitch: number): V3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;          // turn around the vertical axis
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];            // then tilt towards the viewer
}

function bezier(p0: V3, c1: V3, c2: V3, p1: V3, t: number): V3 {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1], a * p0[2] + b * c1[2] + c * c2[2] + d * p1[2]];
}

export function mountSphere(host: HTMLElement) {
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { ring, curves } = build();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // which ring squares are shown, and which of them receive a line
  const shown = new Set<number>(), receives = new Set<number>();
  for (const c of curves) {
    shown.add(c.a);
    if (!c.surf) { shown.add(c.b); receives.add(c.b); }
  }

  let w = 0, h = 0, dpr = 1;
  const resize = () => {
    const r = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  };

  // orientation: turns on its own, can be dragged, keeps a little momentum after a drag
  const AUTO = reduce ? 0 : (Math.PI * 2) / ORBIT_SECONDS;     // rad per second
  let yaw = 0.6, pitch = -0.25, vYaw = AUTO, vPitch = 0;
  let dragging = false, lastX = 0, lastY = 0, lastT = 0;
  host.addEventListener("pointerdown", (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
    host.setPointerCapture(e.pointerId);
    host.classList.add("is-dragging");
  });
  host.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const now = performance.now(), dt = Math.max(1, now - lastT) / 1000;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    const k = 3 / Math.max(200, host.clientWidth);              // a drag across the globe is about half a turn
    yaw += dx * k; pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * k));
    vYaw = (dx * k) / dt; vPitch = (dy * k) / dt;
    lastX = e.clientX; lastY = e.clientY; lastT = now;
    if (!running) draw(clock, !reduce);
  });
  const release = () => { dragging = false; host.classList.remove("is-dragging"); };
  host.addEventListener("pointerup", release);
  host.addEventListener("pointercancel", release);

  const D = 3.4;                                   // camera distance, in sphere radii
  const draw = (time: number, flowing: boolean) => {
    const R = Math.min(w, h) / 2 - 6, cx = w / 2, cy = h / 2;
    const project = ([x, y, z]: V3) => { const k = D / (D - z); return [cx + x * R * k, cy + y * R * k, z] as const; };
    const snap = (v: number) => Math.round(v * dpr) / dpr - SQUARE / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const rot = (v: V3) => rotate(v, yaw, pitch);
    const hub = rot([-0.42, -0.08, 0.25]);          // the shared point, fixed inside the globe

    const hits: { p: readonly [number, number, number]; alpha: number }[] = [];
    const paths = curves.map((c) => {
      const p0 = ring[c.a];
      const p1: V3 = c.surf ? rot(c.surf) : ring[c.b];
      // each curve runs square -> shared point -> square, passing through the point smoothly
      const j1 = rot(c.j1), j2 = rot(c.j2);
      const m: V3 = [hub[0] + j1[0] * 0.12, hub[1] + j1[1] * 0.12, hub[2] + j1[2] * 0.12];   // tight pinch
      let d: V3 = [p1[0] - p0[0], p1[1] - p0[1], 0];
      const len = Math.hypot(d[0], d[1]) || 1;
      d = [d[0] / len, d[1] / len, 0];
      const reach = 0.28 * c.pull;
      const a1: V3 = [p0[0] + (m[0] - p0[0]) * 0.45 + j1[0] * 0.6, p0[1] + (m[1] - p0[1]) * 0.45 + j1[1] * 0.6, m[2] * 0.45 + j1[2]];
      const a2: V3 = [m[0] - d[0] * reach, m[1] - d[1] * reach, m[2] - j2[2] * 0.4];
      const b1: V3 = [m[0] + d[0] * reach, m[1] + d[1] * reach, m[2] + j2[2] * 0.4];
      const b2: V3 = [p1[0] + (m[0] - p1[0]) * 0.45 + j2[0] * 0.6, p1[1] + (m[1] - p1[1]) * 0.45 + j2[1] * 0.6, m[2] * 0.45 + j2[2]];
      // a stroke travels from square A to square B, then starts again at A
      let from = 0, to = 1;
      if (flowing) {
        const head = ((time / 1000 / FLOW_SECONDS) * c.speed + c.delay) % (1 + STROKE);
        from = Math.max(0, head - STROKE); to = Math.min(1, head);
        if (c.surf && head >= 1) hits.push({ p: project(p1), alpha: 1 - (head - 1) / STROKE });   // the stroke has arrived
      } else if (c.surf) hits.push({ p: project(p1), alpha: 1 });
      const pts = [];
      let depth = 0;
      const half = SAMPLES / 2;
      for (let i = Math.floor(SAMPLES * from); i <= SAMPLES * to; i++) {
        const q = i <= half ? bezier(p0, a1, a2, m, i / half) : bezier(m, b1, b2, p1, (i - half) / half);
        depth += q[2];
        pts.push(project(q));
      }
      return { c, pts, depth: pts.length ? depth / pts.length : 0 };
    });
    paths.sort((a, b) => a.depth - b.depth);            // far curves first

    ctx.lineWidth = 0.75;
    ctx.lineJoin = "round";
    for (const { c, pts, depth } of paths) {
      if (pts.length < 2) continue;
      const near = (depth + 0.6) / 1.2;                 // 0 far ... 1 near
      const alpha = c.highlight ? 0.85 : 0.07 + Math.max(0, Math.min(1, near)) * 0.23;
      ctx.strokeStyle = `rgba(${INK}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    // surface points: a #82816D square where a stroke arrives, fading out
    for (const { p, alpha } of hits) {
      ctx.fillStyle = `rgba(${RECEIVER}, ${Math.max(0, alpha).toFixed(3)})`;
      ctx.fillRect(snap(p[0]), snap(p[1]), SQUARE, SQUARE);
    }

    // the ring: light grey without a line, black where lines start, #82816D where they arrive
    ring.forEach((p, i) => {
      ctx.fillStyle = `rgb(${!shown.has(i) ? IDLE : receives.has(i) ? RECEIVER : INK})`;
      ctx.fillRect(snap(cx + p[0] * R), snap(cy + p[1] * R), SQUARE, SQUARE);
    });
  };

  resize();
  let running = false, raf = 0, last = 0, clock = 9000;
  new ResizeObserver(() => { resize(); if (!running) draw(clock, !reduce); }).observe(host);

  const loop = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    clock += dt * 1000;
    if (!dragging) {
      // after a drag, ease back to the steady turn
      vYaw += (AUTO - vYaw) * Math.min(1, dt * 1.5);
      vPitch += (0 - vPitch) * Math.min(1, dt * 1.5);
      yaw += vYaw * dt;
      pitch = Math.max(-1.2, Math.min(1.2, pitch + vPitch * dt));
    }
    draw(clock, true);
    raf = requestAnimationFrame(loop);
  };
  draw(clock, !reduce);
  if (reduce) return;
  new IntersectionObserver((entries) => {
    const visible = entries.some((e) => e.isIntersecting);
    if (visible && !running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
    if (!visible && running) { running = false; cancelAnimationFrame(raf); }
  }, { threshold: 0.15 }).observe(host);
}
