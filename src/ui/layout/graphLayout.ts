/**
 * ELK-based edge routing for the Structure View.
 *
 * Node positions come from StructureView's manual section layout (rows of defs
 * above rows of composition groups).  ELK's `fixed` algorithm keeps those
 * positions and computes obstacle-avoiding ORTHOGONAL routes for every edge,
 * returning bend points that ElkEdge renders as axis-aligned polylines.
 *
 * The LayoutMode type and LAYOUT_LABELS are kept for API compatibility.
 */

import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';

// ── Public types ──────────────────────────────────────────────────────────────

export type LayoutMode = 'lr' | 'tb' | 'compact' | 'manual';

export const LAYOUT_LABELS: Record<LayoutMode, string> = {
  lr:      'Left → Right',
  tb:      'Top → Bottom',
  compact: 'Compact LR',
  manual:  'Manual',
};

/** Map from React Flow edge id → ELK bend points (world-coordinate waypoints). */
export type ElkRouteMap = Map<string, { x: number; y: number }[]>;

// ── ELK instance (shared, stateless between layout calls) ─────────────────────

const elk = new ELK();

// ── ELK options: fixed positions, orthogonal routing ─────────────────────────

// 'fixed' algorithm keeps every node at the position we supply and only
// computes obstacle-avoiding ORTHOGONAL routes for the edges.
// edgeNode=40 keeps routes 40 px clear of every node face.
const FIXED_ROUTING_OPTIONS: Record<string, string> = {
  'elk.algorithm':        'fixed',
  'elk.edgeRouting':      'ORTHOGONAL',
  'elk.spacing.edgeNode': '28',   // clearance from node face — tighter to leave room for parallel routes
  'elk.spacing.edgeEdge': '14',   // gap between parallel edge segments — wide enough to see separately
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Route edges around nodes using ELK's `fixed` algorithm.
 *
 * Node positions are taken from the input unchanged — only edge routes are
 * computed.  Falls back to the original nodes (smoothstep edges) on error.
 */
export async function applyElkLayout(
  nodes: Node[],
  edges: Edge[],
  mode: LayoutMode,
): Promise<{ nodes: Node[]; edgeRoutes: ElkRouteMap }> {
  const empty: ElkRouteMap = new Map();
  if (mode === 'manual') return { nodes, edgeRoutes: empty };

  const topNodes = nodes.filter(n => !n.parentId);
  const topIds   = new Set(topNodes.map(n => n.id));

  const style = (n: Node) => n.style as Record<string, unknown> | undefined;

  // Pass current positions so the `fixed` algorithm keeps them.
  const elkChildren: ElkNode[] = topNodes.map(n => ({
    id:     n.id,
    width:  Number(style(n)?.['width']  ?? 172),
    height: Number(style(n)?.['height'] ?? 48),
    x:      n.position.x,
    y:      n.position.y,
  }));

  // Only include edges whose both endpoints are top-level nodes.
  const elkEdges: ElkExtendedEdge[] = edges
    .filter(e => topIds.has(e.source) && topIds.has(e.target))
    .map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }));

  const graph: ElkNode = {
    id:            'root',
    layoutOptions: FIXED_ROUTING_OPTIONS,
    children:      elkChildren,
    edges:         elkEdges,
  };

  try {
    const laid = await elk.layout(graph);

    // Extract ELK-computed routes per edge.
    // Store [startPoint, ...bendPoints, endPoint] — the full attachment-to-attachment
    // route.  ElkEdge prepends the React Flow source handle and appends the target
    // handle so the complete rendered path is always axis-aligned.
    const edgeRoutes: ElkRouteMap = new Map();
    for (const e of (laid.edges ?? [])) {
      const section = e.sections?.[0];
      if (!section) continue;
      edgeRoutes.set(e.id, [
        section.startPoint,
        ...(section.bendPoints ?? []),
        section.endPoint,
      ]);
    }

    return { nodes, edgeRoutes };   // node positions unchanged
  } catch (err) {
    console.error('[sysml-viz] ELK routing error:', err);
    return { nodes, edgeRoutes: empty };
  }
}
