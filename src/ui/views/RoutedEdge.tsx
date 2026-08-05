import { memo, useMemo } from 'react';
import { BaseEdge, useStore, Position, type EdgeProps } from '@xyflow/react';
import { routeOrthogonal, pointsToPath, type Rect, type Side } from '../layout/edgeRouting';

// Custom edge that routes orthogonally AROUND the action shapes instead of
// straight through them.  It reads every node's absolute rectangle from the
// React Flow store, treats the action/control shapes as obstacles (lane
// containers and boundary params are not), and asks the router for a clear
// poly-line between the two handles.

const MARGIN = 10;                                        // clearance kept around each shape
const NON_OBSTACLE = new Set(['partContainer', 'boundaryParam']);

function sideOf(pos?: Position): Side {
  switch (pos) {
    case Position.Top:    return 'top';
    case Position.Bottom: return 'bottom';
    case Position.Left:   return 'left';
    default:              return 'right';
  }
}

function styleVal<T>(o: unknown, key: string, fallback: T): T {
  const v = (o as Record<string, unknown> | undefined)?.[key];
  return (v as T) ?? fallback;
}

function RoutedEdgeInner({
  id, source, target, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, markerEnd, style, label, labelStyle, labelBgStyle, interactionWidth,
}: EdgeProps) {
  // Obstacles = all action/control shapes except this edge's own endpoints.
  // The equality function keeps the value stable across pan/zoom (positions
  // only change when the layout does), so edges don't re-route every frame.
  const obstacles = useStore(
    (s) => {
      const out: Rect[] = [];
      for (const [nid, n] of s.nodeLookup) {
        if (nid === source || nid === target) continue;
        if (n.type && NON_OBSTACLE.has(n.type)) continue;
        const p = n.internals?.positionAbsolute ?? n.position;
        const w = n.measured?.width ?? 0, h = n.measured?.height ?? 0;
        if (!w || !h) continue;
        out.push({ left: p.x - MARGIN, top: p.y - MARGIN, right: p.x + w + MARGIN, bottom: p.y + h + MARGIN });
      }
      return out;
    },
    (a, b) =>
      a.length === b.length &&
      a.every((r, i) => r.left === b[i].left && r.top === b[i].top && r.right === b[i].right && r.bottom === b[i].bottom),
  );

  const { path, labelX, labelY } = useMemo(() => {
    const r = routeOrthogonal(
      sourceX, sourceY, sideOf(sourcePosition),
      targetX, targetY, sideOf(targetPosition),
      obstacles,
    );
    return { path: pointsToPath(r.points), labelX: r.labelX, labelY: r.labelY };
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, obstacles]);

  const text = typeof label === 'string' ? label : undefined;
  const fontSize = styleVal<number>(labelStyle, 'fontSize', 9);
  const labelW = text ? text.length * (fontSize * 0.62) + 8 : 0;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={interactionWidth ?? 20} />
      {text && (
        <g transform={`translate(${labelX}, ${labelY})`} style={{ pointerEvents: 'none' }}>
          <rect
            x={-labelW / 2} y={-(fontSize / 2 + 3)} width={labelW} height={fontSize + 6} rx={3} ry={3}
            fill={styleVal(labelBgStyle, 'fill', '#04121a')}
            fillOpacity={styleVal(labelBgStyle, 'fillOpacity', 0.9)}
          />
          <text
            x={0} y={0} textAnchor="middle" dominantBaseline="central"
            style={{
              fill: styleVal(labelStyle, 'fill', '#8ab'),
              fontSize,
              fontWeight: styleVal(labelStyle, 'fontWeight', 500),
              fontFamily: 'monospace',
            }}
          >
            {text}
          </text>
        </g>
      )}
    </>
  );
}

export const RoutedEdge = memo(RoutedEdgeInner);
