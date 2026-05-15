/**
 * Custom React Flow edge that follows ELK-computed waypoints.
 *
 * Why this exists: React Flow's built-in smoothstep/bezier edges draw naïve
 * curves between handles — they have no obstacle awareness and will cross
 * over node boxes.  ELK produces obstacle-avoiding ORTHOGONAL routes; we
 * extract those bend points in applyElkLayout and render them here as an
 * axis-aligned polyline so edges stay clear of every node face.
 *
 * If no waypoints are stored (e.g. intra-group edges skipped by ELK), falls
 * back to a straight line between the two React Flow handle positions.
 */

import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';

type Pt = { x: number; y: number };

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
  const bends = (data as Record<string, unknown>)?.waypoints as Pt[] | undefined;

  let path: string;
  let labelX: number;
  let labelY: number;

  if (bends && bends.length > 0) {
    // Full polyline: handle → bend points → handle.
    // Using L (line-to) commands produces the axis-aligned segments that
    // match ELK's ORTHOGONAL routing.
    const pts: Pt[] = [{ x: sourceX, y: sourceY }, ...bends, { x: targetX, y: targetY }];
    path = `M ${pts[0].x} ${pts[0].y}` +
      pts.slice(1).map(p => ` L ${p.x} ${p.y}`).join('');

    // Place the label at the midpoint of the longest segment for readability.
    let bestLen = -1;
    let bestMid = { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      const len = dx * dx + dy * dy;
      if (len > bestLen) {
        bestLen = len;
        bestMid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
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
