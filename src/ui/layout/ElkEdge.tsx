/**
 * Custom React Flow edge that follows ELK-computed waypoints.
 *
 * Path structure (all segments are axis-aligned for ORTHOGONAL routing):
 *
 *   M  elkStart.x  elkStart.y   ← ELK attachment point on source node boundary
 *   L  bend1.x  bend1.y  ...    ← ELK obstacle-avoiding intermediate bends
 *   L  elkEnd.x  elkEnd.y       ← ELK attachment point on target node boundary
 *
 * ELK spreads startPoint/endPoint across each node face so that multiple
 * edges leaving/entering the same node never share the same pixel.  Using
 * ELK's points directly (rather than collapsing to the React Flow handle
 * center) preserves that spread and prevents endpoint stacking.
 *
 * Falls back to a straight line when no waypoints are stored (edges that
 * were not submitted to ELK, e.g. intra-group connections).
 */

import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';

type Pt = { x: number; y: number };

const CORNER_R = 6; // px — rounded corner radius for orthogonal polylines

/**
 * Build an SVG path string for an orthogonal polyline with rounded corners.
 * Each intermediate waypoint (bend) is replaced by a short quadratic bezier
 * that rounds the 90-degree angle with radius `r`.
 */
export function roundedPolyline(pts: Pt[], r = CORNER_R): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.hypot(dx1, dy1);
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.hypot(dx2, dy2);

    if (len1 < 1 || len2 < 1) { d += ` L ${curr.x} ${curr.y}`; continue; }

    const rr  = Math.min(r, len1 / 2, len2 / 2);
    const bx  = curr.x - (dx1 / len1) * rr;
    const by  = curr.y - (dy1 / len1) * rr;
    const ax  = curr.x + (dx2 / len2) * rr;
    const ay  = curr.y + (dy2 / len2) * rr;

    d += ` L ${bx} ${by} Q ${curr.x} ${curr.y} ${ax} ${ay}`;
  }

  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

export function ElkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
  label,
  labelStyle,
  labelBgStyle,
  markerEnd,
}: EdgeProps) {
  const waypoints = (data as Record<string, unknown>)?.waypoints as Pt[] | undefined;

  let path: string;
  let labelX: number;
  let labelY: number;

  if (waypoints && waypoints.length >= 2) {
    // Use ELK attachment points directly — no React Flow handle prepend/append.
    // ELK spreads startPoint/endPoint across each node face so multiple edges
    // never share the same pixel; collapsing them to the handle center undoes that.
    path = roundedPolyline(waypoints);

    // Label on the longest segment for best readability.
    let bestLen = -1;
    let bestMid = { x: (waypoints[0].x + waypoints[waypoints.length - 1].x) / 2,
                    y: (waypoints[0].y + waypoints[waypoints.length - 1].y) / 2 };
    for (let i = 0; i < waypoints.length - 1; i++) {
      const dx = waypoints[i + 1].x - waypoints[i].x;
      const dy = waypoints[i + 1].y - waypoints[i].y;
      const len = dx * dx + dy * dy;
      if (len > bestLen) {
        bestLen = len;
        bestMid = { x: (waypoints[i].x + waypoints[i + 1].x) / 2,
                    y: (waypoints[i].y + waypoints[i + 1].y) / 2 };
      }
    }
    labelX = bestMid.x;
    labelY = bestMid.y;
  } else {
    [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  }

  return (
    <BaseEdge
      id={id}
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={label}
      labelStyle={labelStyle as React.CSSProperties}
      labelBgStyle={labelBgStyle as React.CSSProperties}
      labelBgPadding={[4, 3]}
      markerEnd={markerEnd}
      style={style as React.CSSProperties}
    />
  );
}
