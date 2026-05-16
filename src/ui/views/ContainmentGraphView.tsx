import { useMemo, useCallback } from 'react';
import { ReactFlow, Background, MarkerType, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ContainmentGraph, GraphNode } from '../../core/sysmlv2Official/ContainmentGraph';
import type { SelectionState } from '../../app/selection';

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 36;
const H_GAP  = 20;   // horizontal gap between sibling subtrees
const V_GAP  = 60;   // vertical gap between depth levels

// ── Tree layout ───────────────────────────────────────────────────────────────
//
// Node IDs are path-encoded ("0", "0.1", "0.1.2"), so the parent of any node
// is its ID with the last segment removed.  We use subtree leaf-count as the
// width unit so that siblings never overlap.

function buildLayout(graph: ContainmentGraph): { nodes: Node[]; edges: Edge[] } {
  // Build parent → children adjacency from IDs
  const childrenOf = new Map<string | null, string[]>();
  childrenOf.set(null, []);
  for (const n of graph.nodes) childrenOf.set(n.id, []);
  for (const n of graph.nodes) {
    const segs = n.id.split('.');
    const parentId = segs.length > 1 ? segs.slice(0, -1).join('.') : null;
    childrenOf.get(parentId)?.push(n.id);
  }

  // Subtree width = number of leaves (gives natural, non-overlapping spread)
  const subtreeWidth = new Map<string, number>();
  function measure(id: string): number {
    const kids = childrenOf.get(id) ?? [];
    const w = kids.length === 0 ? 1 : kids.reduce((s, k) => s + measure(k), 0);
    subtreeWidth.set(id, w);
    return w;
  }
  for (const root of childrenOf.get(null) ?? []) measure(root);

  // Assign pixel positions top-down
  const pos = new Map<string, { x: number; y: number }>();
  function place(id: string, offsetUnits: number, depth: number): void {
    const w = subtreeWidth.get(id) ?? 1;
    pos.set(id, {
      x: (offsetUnits + w / 2) * (NODE_W + H_GAP),
      y: depth * (NODE_H + V_GAP),
    });
    let childOffset = offsetUnits;
    for (const kid of childrenOf.get(id) ?? []) {
      place(kid, childOffset, depth + 1);
      childOffset += subtreeWidth.get(kid) ?? 1;
    }
  }
  let rootOffset = 0;
  for (const root of childrenOf.get(null) ?? []) {
    place(root, rootOffset, 0);
    rootOffset += subtreeWidth.get(root) ?? 1;
  }

  const nodes: Node[] = graph.nodes.map(n => ({
    id:       n.id,
    position: pos.get(n.id) ?? { x: 0, y: 0 },
    data:     { label: n.label },
    style:    { width: NODE_W, fontSize: 12, padding: '4px 8px' },
  }));

  const edges: Edge[] = graph.edges.map(e =>
    e.type === 'typedBy'
      ? {
          id:     e.id,
          source: e.source,
          target: e.target,
          type:   'smoothstep',
          style:  { stroke: '#06b6d4', strokeWidth: 1.5, strokeDasharray: '5 3' },
          label:  'typedBy',
          labelStyle:   { fontSize: 9, fill: '#06b6d4', fontFamily: 'monospace' },
          labelBgStyle: { fill: '#071a1a', fillOpacity: 0.88 },
          markerEnd:    { type: MarkerType.ArrowClosed, color: '#06b6d4', width: 12, height: 12 },
        }
      : e.type === 'connection'
        ? {
            id:       e.id,
            source:   e.source,
            target:   e.target,
            type:     'smoothstep',
            animated: true,
            style:    { stroke: '#22c55e', strokeWidth: 2 },
            label:    'connect',
            labelStyle:   { fontSize: 9, fill: '#22c55e', fontFamily: 'monospace' },
            labelBgStyle: { fill: '#071a1a', fillOpacity: 0.88 },
            markerEnd:    { type: MarkerType.ArrowClosed, color: '#22c55e', width: 12, height: 12 },
          }
        : {
            id:     e.id,
            source: e.source,
            target: e.target,
            style:  { stroke: '#334155', strokeWidth: 1 },
            markerEnd: { type: MarkerType.Arrow, color: '#334155', width: 10, height: 10 },
          },
  );

  return { nodes, edges };
}

// ── EMF type → SelectionState type mapping ────────────────────────────────────

function emfTypeToSelType(emfType: string): NonNullable<SelectionState>['type'] {
  switch (emfType) {
    case 'PartDefinition':
    case 'PartUsage':       return 'part';
    case 'PortUsage':
    case 'PortDefinition':  return 'port';
    case 'ActionDefinition':return 'behavior';
    case 'ActionUsage':
    case 'PerformActionUsage': return 'actionInst';
    case 'Package':
    case 'LibraryPackage':  return 'packageDef';
    case 'InterfaceDefinition':
    case 'ConnectionDefinition': return 'interface';
    case 'OccurrenceDefinition': return 'occurrence';
    default:                return 'part';
  }
}

// Index graph nodes by id for fast lookup during click handling.
function buildNodeIndex(graph: ContainmentGraph): Map<string, GraphNode> {
  return new Map(graph.nodes.map(n => [n.id, n]));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContainmentGraphView({
  graph,
  onSelect,
}: {
  graph: ContainmentGraph;
  onSelect?: (s: SelectionState) => void;
}) {
  const { nodes, edges } = useMemo(() => buildLayout(graph), [graph]);
  const nodeIndex = useMemo(() => buildNodeIndex(graph), [graph]);

  const handleNodeClick = useCallback((_e: React.MouseEvent, rfNode: Node) => {
    if (!onSelect) return;
    const gn = nodeIndex.get(rfNode.id);
    if (!gn) return;
    // Skip transparent wrappers and anonymous nodes (label === type means no name)
    if (gn.label === gn.type) return;
    const selType = emfTypeToSelType(gn.type);
    const sel: NonNullable<SelectionState> = { id: `cgv-${gn.id}`, type: selType, name: gn.label };
    console.log('[ContainmentGraphView] click → selection:', sel);
    onSelect(sel);
  }, [onSelect, nodeIndex]);

  if (nodes.length === 0) {
    return (
      <div style={{ padding: 24, color: '#64748b', fontFamily: 'monospace', fontSize: 13 }}>
        No graph data. Parse a SysML v2 file with the official service running.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={!!onSelect}
        onNodeClick={onSelect ? handleNodeClick : undefined}
      >
        <Background color="#2a2a3a" gap={24} />
      </ReactFlow>
    </div>
  );
}
