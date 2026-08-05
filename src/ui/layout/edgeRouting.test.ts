import { describe, it, expect } from 'vitest';
import { routeOrthogonal, pointsToPath, type Rect } from './edgeRouting';

// A poly-line segment crosses a rectangle's interior?
function segHitsRect(a: { x: number; y: number }, b: { x: number; y: number }, r: Rect): boolean {
  const eps = 0.5;
  if (Math.abs(a.y - b.y) < eps) {
    if (a.y <= r.top + eps || a.y >= r.bottom - eps) return false;
    return Math.max(a.x, b.x) > r.left + eps && Math.min(a.x, b.x) < r.right - eps;
  }
  if (Math.abs(a.x - b.x) < eps) {
    if (a.x <= r.left + eps || a.x >= r.right - eps) return false;
    return Math.max(a.y, b.y) > r.top + eps && Math.min(a.y, b.y) < r.bottom - eps;
  }
  return false;
}

function polyClear(pts: Array<{ x: number; y: number }>, obs: Rect[]): boolean {
  for (let i = 0; i < pts.length - 1; i++)
    for (const r of obs)
      if (segHitsRect(pts[i], pts[i + 1], r)) return false;
  return true;
}

describe('routeOrthogonal', () => {
  it('produces an axis-aligned poly-line between the two handles', () => {
    const { points } = routeOrthogonal(0, 0, 'right', 200, 0, 'left', []);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 200, y: 0 });
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      expect(Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5).toBe(true);
    }
  });

  it('routes around a shape sitting directly between the endpoints', () => {
    // A box straddling the straight path from (0,0)→(200,0).
    const obstacle: Rect = { left: 80, top: -40, right: 120, bottom: 40 };
    const { points } = routeOrthogonal(0, 0, 'right', 200, 0, 'left', [obstacle]);
    expect(polyClear(points, [obstacle])).toBe(true);
  });

  it('routes around a shape blocking a vertical (control-flow) path', () => {
    const obstacle: Rect = { left: -30, top: 60, right: 30, bottom: 120 };
    const { points } = routeOrthogonal(0, 0, 'bottom', 0, 200, 'top', [obstacle]);
    expect(polyClear(points, [obstacle])).toBe(true);
  });

  it('keeps a clear straight path straight (no needless detour)', () => {
    const { points } = routeOrthogonal(0, 0, 'bottom', 0, 200, 'top', []);
    // start, end (+ simplified interior) — all share x=0.
    expect(points.every(p => Math.abs(p.x) < 0.5)).toBe(true);
  });

  it('pointsToPath emits a valid SVG path starting with a move', () => {
    const { points } = routeOrthogonal(0, 0, 'right', 100, 50, 'left', []);
    const d = pointsToPath(points);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.length).toBeGreaterThan(4);
  });
});
