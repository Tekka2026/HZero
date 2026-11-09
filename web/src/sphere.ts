/**
 * "Why it matters" visual: a sphere of connections.
 *
 * The outer ring is a circle of 2 x 2 px squares (the sphere's outline, always facing the viewer).
 * Every square is joined to another square by a curve that runs through the inside of the sphere
 * in 3D. The curves bundle around a shared point that slowly orbits inside the sphere, so the
 * interior turns while the ring stays a perfect circle. Drawn with Canvas 2D and its own 3D
 * projection, so lines and squares stay pixel-sharp.
 */

type V3 = [number, number, number];

const SAMPLES = 64;            // points per curve
const SQUARE = 2;              // px
const ORBIT_SECONDS = 48;      // one turn of the interior
const FLOW_SECONDS = 3.2;      // a stroke's trip from A to B
const STROKE = 0.4;           // stroke length, share of the route
const INK = "10, 10, 10";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Curve { a: number; b: number; j1: V3; j2: V3; pull: number; highlight: boolean; delay: number; speed: number }

const SLOTS = 160;              // possible positions on the ring
const FILL = 0.6;              // at most 60% of the positions hold a square
const CONNECTED = 0.45;        // share of squares with a line (kept within 30-60%)

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
  const add = (a: number, b: number) => curves.push({ a, b, j1: jitter(0.32), j2: jitter(0.32), pull: 0.7 + rand() * 0.25, highlight: false, delay: rand(), speed: 0.8 + rand() * 0.5 });
  // every connected square gets one or two lines, never more
  const degree = new Map<number, number>(ids.map((i) => [i, 0]));
  const want = new Map<number, number>(ids.map((i) => [i, rand() < 0.5 ? 2 : 1]));
  for (const a of ids) {
    while ((degree.get(a) ?? 0) < (want.get(a) ?? 1)) {
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

function rotY([x, y, z]: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
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

  let w = 0, h = 0, dpr = 1;
  const resize = () => {
    const r = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  };

  // pointer nudges the shared point a little
  let tx = 0, ty = 0, px = 0, py = 0;
  host.addEventListener("pointermove", (e) => {
    const r = host.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  host.addEventListener("pointerleave", () => { tx = 0; ty = 0; });

  const D = 3.4;                                   // camera distance, in sphere radii
  const draw = (time: number, flowing: boolean) => {
    const R = Math.min(w, h) / 2 - 6, cx = w / 2, cy = h / 2;
    const project = ([x, y, z]: V3) => { const k = D / (D - z); return [cx + x * R * k, cy + y * R * k, z] as const; };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    px += (tx - px) * 0.05; py += (ty - py) * 0.05;
    const turn = (time / 1000 / ORBIT_SECONDS) * Math.PI * 2;
    // the shared point orbits through the depth of the sphere
    const hub = rotY([-0.42 + px * 0.12, -0.08 + py * 0.12 + Math.sin(turn * 2) * 0.06, 0.25], turn);

    const paths = curves.map((c) => {
      const p0 = ring[c.a], p1 = ring[c.b];
      // each curve runs square -> shared point -> square, passing through the point smoothly
      const j1 = rotY(c.j1, turn * 1.6), j2 = rotY(c.j2, turn * 1.6);
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
      }
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

    // the ring: 2 x 2 px squares, snapped to the device pixel grid
    ctx.fillStyle = `rgb(${INK})`;
    for (const p of ring) {
      const x = Math.round((cx + p[0] * R) * dpr) / dpr - SQUARE / 2, y = Math.round((cy + p[1] * R) * dpr) / dpr - SQUARE / 2;
      ctx.fillRect(x, y, SQUARE, SQUARE);
    }
  };

  resize();
  new ResizeObserver(() => { resize(); if (reduce || !running) draw(frozen, !reduce); }).observe(host);

  let running = false, raf = 0, start = 0, frozen = 9000;
  const loop = (now: number) => {
    if (!start) start = now;
    const t = now - start;
    draw(t + 9000, true);
    frozen = t + 9000;
    raf = requestAnimationFrame(loop);
  };
  draw(frozen, !reduce);
  if (reduce) return;
  new IntersectionObserver((entries) => {
    const visible = entries.some((e) => e.isIntersecting);
    if (visible && !running) { running = true; raf = requestAnimationFrame(loop); }
    if (!visible && running) { running = false; cancelAnimationFrame(raf); }
  }, { threshold: 0.15 }).observe(host);
}
