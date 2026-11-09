/**
 * "Why it matters" visual: a sphere of connections.
 *
 * 4 x 4 px squares sit all over the surface of a sphere (20% of an even spread of positions).
 * Squares without a line are light grey (#D2D2D2), squares where lines start are black, squares
 * that receive a line are #82816D. Each line is made of straight stretches with sharp corners: it
 * runs from a square through the opening of the hzero shape floating inside the globe (the logo's
 * slanted, chamfered outline in #CCCCCC, at the centre and spinning against the globe) and on to a square on the other half, or to a hidden point that only shows a
 * square when a stroke arrives. On the way it may kink 1-3 times, each kink a hook of at most 15% of
 * that stretch. A stroke keeps travelling along every line from A to B. Everything is 3D and turns
 * together, very slowly, around a diagonal axis; the globe can be dragged. Far squares are fainter.
 * Canvas 2D with its own 3D projection, so lines and squares stay pixel-sharp.
 */

type V3 = [number, number, number];

const D = 3.4;                 // camera distance, in sphere radii
const SQUARE = 4;              // px
const ORBIT_SECONDS = 240;     // one turn of the globe when left alone: very slow
const AXIS: V3 = [Math.SQRT1_2, Math.SQRT1_2, 0];   // it turns around a diagonal axis
const HOOK = 0.15;             // a kink moves the line sideways by at most 15% of that stretch
const FLOW_SECONDS = 3.2;      // a stroke's trip from A to B
const STROKE = 0.4;           // stroke length, share of the route
// a stroke is drawn in 7 equal parts, tail to head, at these opacities
const PARTS = [0.1, 0.2, 0.6, 1, 0.5, 0.4, 0.1];
// the hzero shape sits at the centre of the globe; every line passes through its opening
const SCROLL_TURN_PX = 2400;    // page scroll that turns the globe once, against the scroll
// the shape from the hzero logo (icon.svg), outer and inner outline
const SHAPE_H = 1;              // unit height here; scaled to pixels when drawn
const SHAPE_MAX_PX = 40;       // the shape is never larger than this on screen, in any position
const SHAPE_SPAN = 1.24;       // its longest straight-line extent (corner to corner), in shape heights
const SHAPE_SPIN_SECONDS = 60;  // its own turn, against the globe's
const SHAPE_COLOR = "204, 204, 204";   // #CCCCCC, as in the logo
const toShape = (pts: number[]): V3[] => {
  const out: V3[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push([((pts[i] - 959.67) / 540) * SHAPE_H, ((pts[i + 1] - 540) / 540) * SHAPE_H, 0]);
  return out;
};
const SHAPE_OUTER = toShape([751.397, 810, 713.704, 765.079, 795.502, 314.921, 849.037, 270, 1168.34, 270, 1205.63, 314.921, 1123.83, 765.079, 1070.7, 810]);
const SHAPE_INNER = toShape([778.666, 773.354, 1055.95, 773.354, 1084.6, 749.317, 1160.84, 330.683, 1140.67, 306.646, 863.382, 306.646, 834.736, 330.683, 758.497, 749.317]);
// corners of the opening, for picking where a line passes through
const [OPEN_TL, OPEN_TR, OPEN_BL] = toShape([863.382, 306.646, 1140.67, 306.646, 778.666, 773.354]);
const INK = "10, 10, 10";
const RECEIVER = "130, 129, 109";   // #82816D: squares that receive a line
const IDLE = "210, 210, 210";       // #D2D2D2: squares without a line

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** b: points square the line ends at; surf: or a point on the sphere's surface, only shown when a stroke arrives */
interface Bend { f: number; dir: V3; amount: number }
interface Curve { a: number; b: number; surf?: V3; rank: number; through: V3; bendsIn: Bend[]; bendsOut: Bend[]; highlight: boolean; delay: number; speed: number }

const SLOTS = 420;              // possible positions on the sphere
const FILL = 0.2;              // 20% of the positions hold a square (within 10-30%)
const CONNECTED = 0.4;         // most squares that can have a line
// the lines come and go: the share of squares with an active line rises and falls between 20% and 40%
const ACTIVE_MIN = 0.34;       // of the possible lines, which leaves about 20% of the squares connected
const ACTIVE_SECONDS = 24;     // one rise and fall
const ACTIVE_FADE = 0.06;      // how gently a line fades in or out
const SURFACE_SHARE = 0.3;     // share of lines that end at a hidden point, shown only when a stroke arrives

function build(): { points: V3[]; curves: Curve[] } {
  const rand = rng(7);
  // squares over the whole sphere: an even (Fibonacci) spread of positions, 60% of them filled
  const points: V3[] = [];
  for (let i = 0; i < SLOTS; i++) {
    if (rand() >= FILL) continue;
    const y = 1 - (2 * (i + 0.5)) / SLOTS, k = Math.sqrt(1 - y * y), phi = i * Math.PI * (3 - Math.sqrt(5));
    points.push([k * Math.cos(phi), y, k * Math.sin(phi)]);
  }
  const jitter = (r: number): V3 => {
    const u = rand() * 2 - 1, phi = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u), k = Math.cbrt(rand()) * r;
    return [s * Math.cos(phi) * k, u * k, s * Math.sin(phi) * k];
  };
  // pick the connected squares, then join each to one or two others
  const ids = [...points.keys()].sort(() => rand() - 0.5).slice(0, Math.round(points.length * CONNECTED));
  // partners sit on the other half of the sphere, so every line crosses the inside
  const far = (a: number, b: number) => points[a][0] * points[b][0] + points[a][1] * points[b][1] + points[a][2] * points[b][2] < 0;
  const curves: Curve[] = [];
  // 1-3 kinks per line, spread over the stretch into the small sphere and the stretch out of it
  const bends = (n: number): Bend[] => Array.from({ length: n }, () => ({ f: 0.2 + rand() * 0.6, dir: jitter(1), amount: (rand() * 2 - 1) * HOOK }))
    .sort((x, y) => x.f - y.f);
  const add = (a: number, b: number, surf?: V3) => {
    const total = 1 + Math.floor(rand() * 3);
    const into = Math.floor(rand() * (total + 1));
    const u = 0.2 + rand() * 0.6, v = 0.15 + rand() * 0.7;     // a point inside the shape's opening
    const through = add3(add3(OPEN_TL, sub3(OPEN_TR, OPEN_TL), u), sub3(OPEN_BL, OPEN_TL), v);
    curves.push({ a, b, surf, rank: rand(), through, bendsIn: bends(into), bendsOut: bends(total - into), highlight: false, delay: rand(), speed: 0.8 + rand() * 0.5 });
  };
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
  return { points, curves };
}

type M3 = number[];               // 3 x 3 rotation matrix, row by row

const apply = (m: M3, [x, y, z]: V3): V3 => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
const mul = (a: M3, b: M3): M3 => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));
/** Rotation by `angle` around the unit vector `u`. */
function axisAngle([x, y, z]: V3, angle: number): M3 {
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
const add3 = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/** Corner points of a straight stretch from p to q with sideways kinks. */
function kinked(p: V3, q: V3, bends: Bend[]): V3[] {
  const d = sub3(q, p), L = len3(d) || 1, u: V3 = [d[0] / L, d[1] / L, d[2] / L];
  return bends.map(({ f, dir, amount }) => {
    const along = dir[0] * u[0] + dir[1] * u[1] + dir[2] * u[2];
    let side = sub3(dir, [u[0] * along, u[1] * along, u[2] * along]);   // part of dir across the stretch
    const sl = len3(side) || 1;
    side = [side[0] / sl, side[1] / sl, side[2] / sl];
    return add3(add3(p, d, f), side, amount * L);
  });
}

export function mountSphere(host: HTMLElement) {
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { points, curves } = build();

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // which points squares are shown, and which of them receive a line
  const shown = new Set<number>(), receives = new Set<number>();

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
  const autoSpin: V3 = [AXIS[0] * AUTO, AXIS[1] * AUTO, AXIS[2] * AUTO];
  let orient: M3 = mul(axisAngle([1, 0, 0], -0.25), axisAngle([0, 1, 0], 0.6));
  let spin: V3 = [...autoSpin];                                 // angular velocity, rad per second
  const turnBy = (w: V3, dt: number) => {
    const a = len3(w) * dt;
    if (a > 1e-7) orient = mul(axisAngle([w[0] / len3(w), w[1] / len3(w), w[2] / len3(w)], a), orient);
  };
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
    // dragging turns the globe around the screen's vertical and horizontal axes
    orient = mul(mul(axisAngle([0, 1, 0], dx * k), axisAngle([1, 0, 0], -dy * k)), orient);
    spin = [(-dy * k) / dt, (dx * k) / dt, 0];
    lastX = e.clientX; lastY = e.clientY; lastT = now;
    if (!running) draw(clock, !reduce);
  });
  const release = () => { dragging = false; host.classList.remove("is-dragging"); };
  host.addEventListener("pointerup", release);
  // scrolling the page turns the globe the other way: scroll down and its front rolls down
  let lastScroll = window.scrollY;
  window.addEventListener("scroll", () => {
    const delta = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    orient = mul(axisAngle([1, 0, 0], (-delta / SCROLL_TURN_PX) * Math.PI * 2), orient);
    if (!running) draw(clock, !reduce);
  }, { passive: true });
  host.addEventListener("pointercancel", release);

  const draw = (time: number, flowing: boolean) => {
    // scale so the outline (projected radius D / sqrt(D^2 - 1)) fits with 6 px to spare
    const R = (Math.min(w, h) / 2 - 6) * Math.sqrt(D * D - 1) / D, cx = w / 2, cy = h / 2;
    const project = ([x, y, z]: V3) => { const k = D / (D - z); return [cx + x * R * k, cy + y * R * k, z] as const; };
    const snap = (v: number) => Math.round(v * dpr) / dpr - SQUARE / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const rot = (v: V3) => apply(orient, v);
    const hub: V3 = [0, 0, 0];                       // the shape sits at the centre
    // the shape turns against the globe: the globe's turn undone, plus its own counter-spin
    const back: M3 = [orient[0], orient[3], orient[6], orient[1], orient[4], orient[7], orient[2], orient[5], orient[8]];
    const shapeOrient = mul(axisAngle(AXIS, -(time / 1000 / SHAPE_SPIN_SECONDS) * Math.PI * 2), back);
    // size so the longest corner-to-corner extent stays under 40 px, allowing for perspective
    const shapeSize = SHAPE_MAX_PX / (SHAPE_SPAN * R * 1.04);
    const shapeWorld = (v: V3) => add3(hub, apply(shapeOrient, [v[0] * shapeSize, v[1] * shapeSize, v[2] * shapeSize]));

    const hits: { p: readonly [number, number, number]; alpha: number }[] = [];
    // which lines are active right now; their squares show black (start) or #82816D (arrival)
    const level = flowing ? ACTIVE_MIN + (1 - ACTIVE_MIN) * (0.5 + 0.5 * Math.sin((time / 1000 / ACTIVE_SECONDS) * Math.PI * 2)) : 1;
    const vis = curves.map((c) => Math.max(0, Math.min(1, (level - c.rank) / ACTIVE_FADE)));
    shown.clear(); receives.clear();
    curves.forEach((c, n) => {
      if (vis[n] < 0.5) return;
      shown.add(c.a);
      if (!c.surf) { shown.add(c.b); receives.add(c.b); }
    });

    const paths = curves.map((c, n) => {
      // corner points in the globe's own space, so the kinks turn with it
      const A = points[c.a];
      const B: V3 = c.surf ?? points[c.b];
      const M = apply(back, shapeWorld(c.through));              // the point in the shape's opening, in the globe's own space
      const corners: V3[] = [A, ...kinked(A, M, c.bendsIn), M, ...kinked(M, B, c.bendsOut), B];
      const at: number[] = [0];                                 // distance along the line to each corner
      for (let i = 1; i < corners.length; i++) at.push(at[i - 1] + len3(sub3(corners[i], corners[i - 1])));
      const total = at[at.length - 1];
      const pointAt = (f: number): V3 => {
        const d = f * total;
        let i = 1;
        while (i < at.length - 1 && at[i] < d) i++;
        const t = (d - at[i - 1]) / ((at[i] - at[i - 1]) || 1);
        return add3(corners[i - 1], sub3(corners[i], corners[i - 1]), t);
      };
      const p1 = rot(B);
      // a stroke travels from square A to square B, then starts again at A
      let from = 0, to = 1, tail = 0, span = 1;                 // tail/span: where the 7 parts sit along the line
      if (flowing) {
        const head = ((time / 1000 / FLOW_SECONDS) * c.speed + c.delay) % (1 + STROKE);
        from = Math.max(0, head - STROKE); to = Math.min(1, head);
        tail = head - STROKE; span = STROKE;
        if (c.surf && head >= 1) hits.push({ p: project(p1), alpha: (1 - (head - 1) / STROKE) * vis[n] });   // the stroke has arrived
      } else if (c.surf) hits.push({ p: project(p1), alpha: 1 });
      // break the visible piece at its ends, at every corner and at every opacity step
      const marks = [from, to, ...at.map((d) => d / total), ...PARTS.map((_, k) => tail + (k * span) / PARTS.length)]
        .filter((f) => f >= from && f <= to).sort((x, y) => x - y);
      const pts: (readonly [number, number, number])[] = [];
      const part: number[] = [];
      let depth = 0;
      for (const f of marks) {
        const q = rot(pointAt(f));
        depth += q[2];
        pts.push(project(q));
      }
      for (let i = 1; i < marks.length; i++) {
        const mid = (marks[i - 1] + marks[i]) / 2;
        part.push(Math.min(PARTS.length - 1, Math.max(0, Math.floor(((mid - tail) / span) * PARTS.length))));
      }
      return { c, pts, part, v: vis[n], depth: pts.length ? depth / pts.length : 0 };
    });
    paths.sort((a, b) => a.depth - b.depth);            // far curves first

    // the hzero shape: its outline filled, the opening left empty; the lines pass through the opening
    ctx.fillStyle = `rgb(${SHAPE_COLOR})`;
    ctx.beginPath();
    for (const ring of [SHAPE_OUTER, SHAPE_INNER]) {
      ring.forEach((v, i) => { const [x, y] = project(shapeWorld(v)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath();
    }
    ctx.fill("evenodd");

    ctx.lineWidth = 0.75;
    ctx.lineJoin = "miter";
    for (const { c, pts, part, v, depth } of paths) {
      if (pts.length < 2 || v <= 0) continue;
      const near = Math.max(0, Math.min(1, (depth + 0.6) / 1.2));   // 0 far ... 1 near
      const depthFactor = (c.highlight ? 1 : 0.5 + near * 0.5) * v;   // far lines a little lighter; fading lines fainter
      // draw the stroke part by part, each at its own opacity
      let i = 0;
      while (i < pts.length - 1) {
        const k = part[i];
        ctx.strokeStyle = `rgba(${INK}, ${(PARTS[k] * depthFactor).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        while (i < pts.length - 1 && part[i] === k) { i++; ctx.lineTo(pts[i][0], pts[i][1]); }
        ctx.stroke();
      }
    }

    // surface points: a #82816D square where a stroke arrives, fading out
    for (const { p, alpha } of hits) {
      ctx.fillStyle = `rgba(${RECEIVER}, ${Math.max(0, alpha).toFixed(3)})`;
      ctx.fillRect(snap(p[0]), snap(p[1]), SQUARE, SQUARE);
    }

    // the squares: light grey without a line, black where lines start, #82816D where they arrive
    points.forEach((p, i) => {
      const [x, y, z] = project(rot(p));
      const alpha = z >= 0 ? 1 : 0.35 + (z + 1) * 0.4;           // fainter on the far side
      ctx.fillStyle = `rgba(${!shown.has(i) ? IDLE : receives.has(i) ? RECEIVER : INK}, ${alpha.toFixed(3)})`;
      ctx.fillRect(snap(x), snap(y), SQUARE, SQUARE);
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
      // after a drag, ease back to the slow diagonal turn
      const e = Math.min(1, dt * 1.5);
      spin = [spin[0] + (autoSpin[0] - spin[0]) * e, spin[1] + (autoSpin[1] - spin[1]) * e, spin[2] + (autoSpin[2] - spin[2]) * e];
      turnBy(spin, dt);
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
