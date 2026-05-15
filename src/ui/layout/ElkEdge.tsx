/**
 * Custom React Flow edge that follows ELK-computed waypoints.
 *
 * Path structure (all segments are axis-aligned for ORTHOGONAL routing):
 *
 *   M  sourceX  sourceY          ← React Flow handle (center of node edge)
 *   L  elkStart.x  elkStart.y   ← ELK attachment point (same x as handle in LR, same y in TB)
 *   L  bend1.x  bend1.y  ...    ← ELK obstacle-avoiding intermediate bends
 *   L  elkEnd.x  elkEnd.y       ← ELK attachment at target
 *   L  targetX  targetY          ← React Flow handle
 *
 * Because ELK places startPoint/endPoint on the same node face as the React
 * Flow handle, the arms (handle→elkStart and elkEnd→handle) differ only in
 * the perpendicular axis and are therefore always orthogonal.
 *
 * Falls back to a straight line when no waypoints are stored (edges that
 * were not submitted to ELK, e.g. intra-group connections).
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
  const waypoints = (data as Record<string, unknown>)?.waypoints as Pt[] | undefined;

  let path: string;
  let labelX: number;
  let labelY: number;

  if (waypoints && waypoints.length >= 2) {
    // Full path: React-Flow handle → ELK route → React-Flow handle.
    const pts: Pt[] = [
      { x: sourceX, y: sourceY },
      ...waypoints,
      { x: targetX, y: targetY },
    ];
    path = `M ${pts[0].x} ${pts[0].y}` +
      pts.slice(1).map(p => ` L ${p.x} ${p.y}`).join('');

    // Label on the longest segment for best readability.
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
