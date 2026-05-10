/**
 * ELK-based automatic graph layout for the Structure View.
 *
 * Only top-level React Flow nodes (no parentId) are positioned by ELK.
 * Nodes with parentId (composition-group instances) keep their relative
 * positions unchanged — they are already arranged inside their parent by the
 * manual layout logic in StructureView.
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

// ── ELK instance (shared, stateless between layout calls) ─────────────────────

const elk = new ELK();

// ── Layout options per mode ───────────────────────────────────────────────────

function elkOptions(mode: Exclude<LayoutMode, 'manual'>): Record<string, string> {
  const base: Record<string, string> = {
    'elk.algorithm':  'layered',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.considerModelOrder.strategy': 'PREFER_NODES',
    'elk.layered.mergeEdges': 'false',
  };
  if (mode === 'compact') {
    return {
      ...base,
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
    };
  }
  return {
    ...base,
    'elk.direction': mode === 'lr' ? 'RIGHT' : 'DOWN',
    'elk.spacing.nodeNode': '80',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Apply an ELK layout to a set of React Flow nodes and edges.
 *
 * - mode === 'manual': returns `nodes` unchanged (caller uses the existing positions).
 * - Otherwise: runs ELK and returns a new node array with updated positions for
 *   top-level nodes.  Nodes with `parentId` are returned unchanged.
 *
 * Never throws: falls back to the original positions on ELK errors.
 */
export async function applyElkLayout(
  nodes: Node[],
  edges: Edge[],
  mode: LayoutMode,
): Promise<Node[]> {
  if (mode === 'manual') return nodes;

  const topNodes = nodes.filter(n => !n.parentId);
  const topIds   = new Set(topNodes.map(n => n.id));

  const elkChildren: ElkNode[] = topNodes.map(n => ({
    id:     n.id,
    width:  Number((n.style as Record<string, unknown>)?.['width']  ?? 172),
    height: Number((n.style as Record<string, unknown>)?.['height'] ?? 48),
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

    return nodes.map(n => {
      if (n.parentId) return n;               // keep relative position inside parent
      const pos = posMap.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });
  } catch (err) {
    console.error('[sysml-viz] ELK layout error:', err);
    return nodes;                             // fall back to original positions
  }
}
