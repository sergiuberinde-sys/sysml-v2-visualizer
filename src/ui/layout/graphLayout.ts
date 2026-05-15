/**
 * ELK-based automatic graph layout for the Structure View.
 *
 * Only top-level React Flow nodes (no parentId) are positioned by ELK.
 * Nodes with parentId (composition-group instances) keep their relative
 * positions unchanged — they are already arranged inside their parent by the
 * manual layout logic in StructureView.
 *
 * Edge routes: ELK computes obstacle-avoiding bend points for every edge.
 * These are returned in `edgeRoutes` so the caller can pass them to a custom
 * edge renderer that draws the ELK-computed polyline instead of a naive curve.
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

// ── Layout options per mode ───────────────────────────────────────────────────

function elkOptions(mode: Exclude<LayoutMode, 'manual'>): Record<string, string> {
  //
  // Strategy: ELK layered algorithm, ORTHOGONAL routing.
  //
  // Key settings for clean, overlap-free layout:
  //   thoroughness=64          – maximum crossing-minimisation iterations
  //   edgeNode spacing=30      – edges stay 30 px clear of every node face,
  //                              preventing routes from visually crossing text
  //   edgeEdge spacing=10      – parallel edges don't touch each other
  //   separateConnectedComponents – isolated sub-graphs don't interleave
  //   unnecessaryBendpoints    – strips redundant bends from ORTHOGONAL routes
  //   nodePlacement=BRANDES_KOEPF – x-coordinates minimise edge length and bends
  //
  const base: Record<string, string> = {
    'elk.algorithm':                                       'layered',
    'elk.edgeRouting':                                     'ORTHOGONAL',
    'elk.layered.nodePlacement.strategy':                  'BRANDES_KOEPF',
    'elk.layered.nodePlacement.bk.fixedAlignment':         'BALANCED',
    'elk.layered.crossingMinimization.strategy':           'LAYER_SWEEP',
    'elk.layered.thoroughness':                            '64',
    'elk.layered.unnecessaryBendpoints':                   'true',
    'elk.layered.considerModelOrder.strategy':             'PREFER_NODES',
    'elk.layered.mergeEdges':                              'false',
    'elk.separateConnectedComponents':                     'true',
    'elk.spacing.edgeNode':                                '30',
    'elk.spacing.edgeEdge':                                '10',
    'elk.spacing.portPort':                                '8',
  };

  if (mode === 'compact') {
    return {
      ...base,
      'elk.direction':                                    'RIGHT',
      'elk.spacing.nodeNode':                             '40',
      'elk.layered.spacing.nodeNodeBetweenLayers':        '80',
    };
  }

  return {
    ...base,
    'elk.direction':                                    mode === 'lr' ? 'RIGHT' : 'DOWN',
    'elk.spacing.nodeNode':                             '80',
    // Generous inter-layer gap: gives ORTHOGONAL routing room to route
    // cross-layer edges cleanly without clipping over node content.
    'elk.layered.spacing.nodeNodeBetweenLayers':        '160',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Apply an ELK layout to a set of React Flow nodes and edges.
 *
 * Returns:
 *   nodes      – repositioned Node array (top-level nodes moved; parentId nodes unchanged)
 *   edgeRoutes – ELK-computed bend points per edge id; empty map on 'manual' or error
 *
 * Never throws: falls back to the original positions on ELK errors.
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

  const elkChildren: ElkNode[] = topNodes.map(n => ({
    id:     n.id,
    width:  Number(style(n)?.['width']  ?? 172),
    height: Number(style(n)?.['height'] ?? 48),
  }));

  // Only include edges whose both endpoints are top-level nodes.
  const elkEdges: ElkExtendedEdge[] = edges
    .filter(e => topIds.has(e.source) && topIds.has(e.target))
    .map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }));

  const graph: ElkNode = {
    id:            'root',
    layoutOptions: elkOptions(mode),
    children:      elkChildren,
    edges:         elkEdges,
  };

  try {
    const laid   = await elk.layout(graph);
    const posMap = new Map(
      (laid.children ?? []).map(c => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]),
    );

    const positionedNodes = nodes.map(n => {
      if (n.parentId) return n;               // keep relative position inside parent
      const pos = posMap.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });

    // Extract ELK-computed bend points per edge.
    // These are in the same world-coordinate space as node positions and can
    // be passed directly to a React Flow custom edge renderer.
    const edgeRoutes: ElkRouteMap = new Map();
    for (const e of (laid.edges ?? [])) {
      const section = e.sections?.[0];
      if (!section) continue;
      edgeRoutes.set(e.id, section.bendPoints ?? []);
    }

    return { nodes: positionedNodes, edgeRoutes };
  } catch (err) {
    console.error('[sysml-viz] ELK layout error:', err);
    return { nodes, edgeRoutes: empty };     // fall back to original positions
  }
}
