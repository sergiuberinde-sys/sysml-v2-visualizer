// ── Orthogonal edge routing with obstacle avoidance ──────────────────────────
//
// React Flow's built-in edges draw straight between handles and happily cut
// through node boxes.  For the Actions view we want every line to travel in the
// gutters BETWEEN action shapes, never over/under/through them.  Given the final
// node rectangles we route each edge as an orthogonal poly-line, trying a small
// set of Manhattan candidates (L-shapes and channel Z-shapes) and picking the
// first one whose segments hit no obstacle.

export interface Rect { left: number; top: number; right: number; bottom: number }
export interface Pt { x: number; y: number }
export type Side = 'top' | 'bottom' | 'left' | 'right';

const STUB = 14;   // how far an edge steps straight out of a handle before it may turn

function outward(x: number, y: number, side: Side, d: number): Pt {
  switch (side) {
    case 'top':    return { x, y: y - d };
    case 'bottom': return { x, y: y + d };
    case 'left':   return { x: x - d, y };
    case 'right':  return { x: x + d, y };
  }
}

// Does an axis-aligned segment cross the interior of a rectangle?
function segHitsRect(a: Pt, b: Pt, r: Rect): boolean {
  const eps = 0.5;
  if (Math.abs(a.y - b.y) < eps) {                 // horizontal
    if (a.y <= r.top + eps || a.y >= r.bottom - eps) return false;
    const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
    return x2 > r.left + eps && x1 < r.right - eps;
  }
  if (Math.abs(a.x - b.x) < eps) {                 // vertical
    if (a.x <= r.left + eps || a.x >= r.right - eps) return false;
    const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
    return y2 > r.top + eps && y1 < r.bottom - eps;
  }
  return false;                                     // diagonal — not produced here
}

function polyClear(pts: Pt[], obs: Rect[]): boolean {
  for (let i = 0; i < pts.length - 1; i++)
    for (const r of obs)
      if (segHitsRect(pts[i], pts[i + 1], r)) return false;
  return true;
}

// How many obstacle hits does this poly-line have? (used to pick the least-bad
// route when no candidate is fully clear).
function hitCount(pts: Pt[], obs: Rect[]): number {
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++)
    for (const r of obs)
      if (segHitsRect(pts[i], pts[i + 1], r)) n++;
  return n;
}

// Merge overlapping 1-D intervals, then return the centres of the gaps between
// them (plus one just outside each end) — the clear channels for routing.
function channelCenters(intervals: Array<[number, number]>, pad: number): number[] {
  if (!intervals.length) return [];
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1] + pad) last[1] = Math.max(last[1], sorted[i][1]);
    else merged.push([sorted[i][0], sorted[i][1]]);
  }
  const centres: number[] = [merged[0][0] - pad * 2];
  for (let i = 0; i < merged.length - 1; i++) centres.push((merged[i][1] + merged[i + 1][0]) / 2);
  centres.push(merged[merged.length - 1][1] + pad * 2);
  return centres;
}

// Drop mid points that are collinear with their neighbours.
function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const n = out.length;
    if (n >= 2) {
      const a = out[n - 2], b = out[n - 1];
      const collinear =
        (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - p.x) < 0.5) ||
        (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - p.y) < 0.5);
      if (collinear) { out[n - 1] = p; continue; }
    }
    if (n === 0 || Math.abs(out[n - 1].x - p.x) > 0.5 || Math.abs(out[n - 1].y - p.y) > 0.5) out.push(p);
  }
  return out;
}

/**
 * Route an orthogonal poly-line from a source handle to a target handle that
 * avoids every rectangle in `obstacles` (already inflated by the caller and with
 * the source/target nodes removed).  Returns the poly-line points and a label
 * anchor at the middle segment.
 */
export function routeOrthogonal(
  sx: number, sy: number, sSide: Side,
  tx: number, ty: number, tSide: Side,
  obstacles: Rect[],
): { points: Pt[]; labelX: number; labelY: number } {
  const S: Pt = { x: sx, y: sy }, T: Pt = { x: tx, y: ty };
  const p0 = outward(sx, sy, sSide, STUB);
  const p3 = outward(tx, ty, tSide, STUB);
  const midX = (p0.x + p3.x) / 2, midY = (p0.y + p3.y) / 2;

  const candidates: Pt[][] = [];
  // Two L-shapes first (cheapest, most direct).
  candidates.push([p0, { x: p3.x, y: p0.y }, p3]);
  candidates.push([p0, { x: p0.x, y: p3.y }, p3]);
  // Z-shapes through a clear vertical channel, nearest the mid-point first.
  const xs = channelCenters(obstacles.map(r => [r.left, r.right]), 8)
    .sort((a, b) => Math.abs(a - midX) - Math.abs(b - midX)).slice(0, 12);
  for (const cx of xs) candidates.push([p0, { x: cx, y: p0.y }, { x: cx, y: p3.y }, p3]);
  // Z-shapes through a clear horizontal channel.
  const ys = channelCenters(obstacles.map(r => [r.top, r.bottom]), 8)
    .sort((a, b) => Math.abs(a - midY) - Math.abs(b - midY)).slice(0, 12);
  for (const cy of ys) candidates.push([p0, { x: p0.x, y: cy }, { x: p3.x, y: cy }, p3]);

  let best: Pt[] | null = null;
  let fallback: Pt[] | null = null;
  let fallbackHits = Infinity;
  for (const mid of candidates) {
    const full = [S, ...mid, T];
    if (polyClear(full, obstacles)) { best = full; break; }
    const hits = hitCount(full, obstacles);
    if (hits < fallbackHits) { fallbackHits = hits; fallback = full; }
  }
  // No fully-clear route → take the one that crosses the fewest shapes.
  if (!best) best = fallback ?? [S, p0, { x: p3.x, y: p0.y }, p3, T];

  const pts = simplify(best);

  // Label anchor: the mid-length point of the poly-line.
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  let acc = 0, lx = pts[0].x, ly = pts[0].y;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (acc + seg >= total / 2) {
      const t = seg === 0 ? 0 : (total / 2 - acc) / seg;
      lx = pts[i].x + (pts[i + 1].x - pts[i].x) * t;
      ly = pts[i].y + (pts[i + 1].y - pts[i].y) * t;
      break;
    }
    acc += seg;
  }
  return { points: pts, labelX: lx, labelY: ly };
}

/** Build a rounded-corner SVG path string from orthogonal poly-line points. */
export function pointsToPath(pts: Pt[], radius = 6): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], cur = pts[i], next = pts[i + 1];
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const inx = cur.x - Math.sign(cur.x - prev.x) * r;
    const iny = cur.y - Math.sign(cur.y - prev.y) * r;
    const outx = cur.x + Math.sign(next.x - cur.x) * r;
    const outy = cur.y + Math.sign(next.y - cur.y) * r;
    d += ` L ${inx},${iny} Q ${cur.x},${cur.y} ${outx},${outy}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x},${last.y}`;
  return d;
}
