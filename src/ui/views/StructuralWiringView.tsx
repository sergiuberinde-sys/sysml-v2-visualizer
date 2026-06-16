/**
 * Structural Wiring View — official SysML v2 mode, Flow tab.
 *
 * Shows structural interconnection within a PartDefinition scope:
 *   - PartUsage instances as boxes (with their PortUsage children annotated)
 *   - ConnectionUsage-derived edges between PortUsage nodes → rendered as wires
 *   - PortUsage children of the scope PartDef itself → boundary port nodes
 *
 * Source: ContainmentGraph (not VisualizerModel — avoids the adapter's lossy
 * mappings and reads EMF structure directly).
 *
 * Scope selector lets the user pick which PartDefinition to inspect.
 */

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  applyNodeChanges, Handle, Position,
  type Node, type Edge, type NodeChange, type NodeProps, type EdgeMouseHandler,
} from '@xyflow/react';
import { PortHandles, makeBoundaryPortDisplay, resolvePortDirection, type PortDisplay } from '../layout/PortHandles';
import { fitNodeWidth, type TextRow } from '../layout/nodeSize';
import '@xyflow/react/dist/style.css';
import type { ContainmentGraph, GraphNode } from '../../core/sysmlv2Official/ContainmentGraph';
import { buildChildrenMap, directSemanticChildren } from '../../core/sysmlv2Official/graphHelpers';
import { FitPanel } from '../layout/FitPanel';
import type { SelectionState } from '../../app/selection';

// ── Layout constants ──────────────────────────────────────────────────────────

const PART_MIN_W    = 192;
const WIRING_H_PAD  = 24;  // 2 × 12 px from padding: '8px 12px'
const PART_BASE_H   = 72;
const PORT_ROW_H    = 17;
const H_GAP         = 240; // horizontal gap between rank columns (wider for edge-label room)
const V_GAP         = 80;  // vertical gap between directly-connected nodes in the same rank column
const V_GAP_SPLIT   = 200; // larger gap between disconnected groups in the same rank column
const Y_PARTS       = 60;  // min-y used as base in the rank-centering formula

// IBD outer-frame (scope container) geometry
const SCOPE_PAD_TOP     = 52;  // space for the «part def» + name header
const SCOPE_PAD_BOTTOM  = 80;
const SCOPE_PAD_LEFT    = 220; // gap between left frame edge and first rank column
const SCOPE_PAD_RIGHT   = 220;
const SCOPE_PORT_NODE_W = 9;   // boundary port node width — sqR center lands at x=9 (inner face of sqL square)
const SCOPE_PORT_NODE_H = 10;  // boundary port node height (port-square height)
const MIN_PORT_SPACING  = 20;  // minimum px between adjacent boundary port squares

// ── Colour palette ────────────────────────────────────────────────────────────

const PART_BG     = '#0b1e14';
const PART_BORDER = '#22c55e';
const PART_SEL    = '#89b4fa';
const PART_NAME   = '#bbf7d0';
const PART_TYPE   = '#4ade80';
const PORT_IN_C   = '#7dd3fc';
const PORT_OUT_C  = '#fbbf24';
const PORT_BIO_C  = '#c084fc';
const SCOPE_BG    = '#0a1628';
const SCOPE_BDR   = '#38bdf8';
const CONN_C      = '#22c55e';
const MSG_C       = '#7dd3fc';
const EDGE_SEL_C  = '#89b4fa'; // selected edge / port highlight colour
const DIM         = '#334155';
const SCOPE_FRAME_BDR = '#1e3a5f';

const FLOW_NODE_TYPES = new Set(['FlowUsage', 'FlowConnectionUsage', 'SuccessionItemFlow']);


// ── Helpers ───────────────────────────────────────────────────────────────────

function wiringNodeWidth(partLbl: string, typeName: string | null): number {
  const rows: TextRow[] = [
    { text: partLbl, font: '600 12.5px monospace' },
    ...(typeName ? [{ text: ': ' + typeName, font: '10px monospace' } as TextRow] : []),
  ];
  return fitNodeWidth(rows, WIRING_H_PAD, PART_MIN_W);
}

function portColor(direction: string | undefined): string {
  if (direction === 'in')    return PORT_IN_C;
  if (direction === 'out')   return PORT_OUT_C;
  if (direction === 'inout') return PORT_BIO_C;
  return PORT_IN_C;
}

function portArrow(direction: string | undefined): string {
  if (direction === 'out')   return '▸';
  if (direction === 'inout') return '⇄';
  return '◂';
}

// ── Custom node for PartUsage boxes with port-handle squares ──────────────────

function WiringPartNode({ data }: NodeProps) {
  const ports         = (data['ports']        as PortDisplay[]) ?? [];
  const partLbl       =  data['partLbl']       as string;
  const typeName      = (data['typeName']      as string | null) ?? null;
  const nodeH         = (data['nodeH']         as number) ?? PART_BASE_H;
  const onPortSelect  = data['onPortSelect']   as ((p: PortDisplay, e: React.MouseEvent) => void) | undefined;

  return (
    <>
      <Handle type="target" id="__target" position={Position.Left}  style={{ opacity: 0 }} />
      <Handle type="source" id="__source" position={Position.Right} style={{ opacity: 0 }} />

      <PortHandles
        ports={ports}
        isLR={true}
        sourcePos={Position.Right}
        targetPos={Position.Left}
        nodeH={nodeH}
        portAreaTop={42}
        onPortClick={onPortSelect}
      />

      <div style={{ fontFamily: 'monospace', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: ports.length > 0 ? 6 : 0 }}>
          <div style={{ fontSize: 9, color: '#4ade8088', letterSpacing: '0.3px' }}>«part»</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: PART_NAME }}>{partLbl}</div>
          {typeName && <div style={{ fontSize: 10, color: PART_TYPE, marginTop: 1 }}>: {typeName}</div>}
        </div>
      </div>
    </>
  );
}

// ── Custom node for leaf PartDef (no nested PartUsages) with port-handle squares

function WiringLeafNode({ data }: NodeProps) {
  const ports     = (data['ports']    as PortDisplay[]) ?? [];
  const items     = (data['items']    as Array<{ id: string; label: string }>) ?? [];
  const actions   = (data['actions']  as Array<{ id: string; label: string }>) ?? [];
  const scopeName = (data['scopeName'] as string) ?? '';
  const nodeH     = (data['nodeH']    as number) ?? 96;
  const onSelect  = data['onSelect']  as ((s: SelectionState) => void) | undefined;

  return (
    <>
      <Handle type="target" id="__target" position={Position.Left}  style={{ opacity: 0 }} />
      <Handle type="source" id="__source" position={Position.Right} style={{ opacity: 0 }} />

      <PortHandles
        ports={ports}
        isLR={true}
        sourcePos={Position.Right}
        targetPos={Position.Left}
        nodeH={nodeH}
        portAreaTop={42}
      />

      <div style={{ fontFamily: 'monospace', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${DIM}` }}>
          <div style={{ fontSize: 9, color: '#22c55e88' }}>«part def»</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: PART_NAME }}>{scopeName}</div>
        </div>
        {items.length > 0 && (
          <div style={{ fontSize: 8.5, color: '#475569', marginBottom: 3, marginTop: 6, textTransform: 'uppercase' }}>Items</div>
        )}
        {items.map(item => (
          <div key={item.id}
            style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2, cursor: onSelect ? 'pointer' : 'default' }}
            onClick={onSelect ? (e) => { e.stopPropagation(); onSelect({ id: `witem-${item.id}`, type: 'part' as const, name: item.label, extra: { graphId: item.id } }); } : undefined}
          >
            ⬡ {item.label}
          </div>
        ))}
        {actions.length > 0 && (
          <div style={{ fontSize: 8.5, color: '#475569', marginBottom: 3, marginTop: 6, textTransform: 'uppercase' }}>Actions</div>
        )}
        {actions.map(a => (
          <div key={a.id}
            style={{ fontSize: 10, color: '#a78bfa', marginBottom: 2, cursor: onSelect ? 'pointer' : 'default' }}
            onClick={onSelect ? (e) => { e.stopPropagation(); onSelect({ id: `wact-${a.id}`, type: 'actionInst' as const, name: a.label, extra: { graphId: a.id } }); } : undefined}
          >
            ▶ {a.label}
          </div>
        ))}
      </div>
    </>
  );
}

// ── IBD outer frame: the scope PartDef rendered as a non-interactive container ─

function WiringScopeContainerNode({ data }: NodeProps) {
  const scopeName = data['scopeName'] as string;
  return (
    <div style={{ width: '100%', height: '100%', fontFamily: 'monospace', pointerEvents: 'none', userSelect: 'none' }}>
      <div style={{ position: 'absolute', top: 10, left: 14 }}>
        <div style={{ fontSize: 9, color: '#22c55e44', letterSpacing: '0.3px' }}>«part def»</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: PART_NAME, marginTop: 2 }}>{scopeName}</div>
      </div>
    </div>
  );
}

// ── IBD boundary port: small 18×10 node straddling the container frame edge ───

function WiringScopePortNode({ data }: NodeProps) {
  const port         = data['port']         as PortDisplay;
  const onPortSelect = data['onPortSelect'] as ((p: PortDisplay, e: React.MouseEvent) => void) | undefined;
  return (
    <>
      <Handle type="target" id="__target" position={Position.Left}  style={{ opacity: 0 }} />
      <Handle type="source" id="__source" position={Position.Right} style={{ opacity: 0 }} />
      <PortHandles
        ports={[port]}
        isLR={true}
        sourcePos={Position.Right}
        targetPos={Position.Left}
        nodeH={SCOPE_PORT_NODE_H}
        portAreaTop={0}
        onPortClick={onPortSelect}
      />
    </>
  );
}

// Stable reference — defined at module level so React Flow doesn't remount nodes.
const WIRING_NODE_TYPES = {
  wiringPart:           WiringPartNode,
  wiringLeaf:           WiringLeafNode,
  wiringScopeContainer: WiringScopeContainerNode,
  wiringScopePort:      WiringScopePortNode,
} as const;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  graph:     ContainmentGraph | null | undefined;
  selection: SelectionState;
  onSelect:  (s: SelectionState) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StructuralWiringView({ graph, selection, onSelect }: Props) {
  const [scopeName, setScopeName] = useState('');
  const [layoutVersion, setLayoutVersion] = useState(0);

  // ── Drag-position persistence ────────────────────────────────────────────────
  // displayNodes is the source-of-truth for React Flow; it is initialised from
  // the useMemo output and updated in-place by onNodesChange during drag.
  // layoutVersionRef lets the merge effect detect a "Reset Layout" click so it
  // discards saved positions instead of re-applying them.
  const [displayNodes, setDisplayNodes] = useState<Node[]>([]);
  const layoutVersionRef = useRef(layoutVersion);

  // ── Precompute stable lookups ────────────────────────────────────────────────

  const { scopeOptions, interconnectScopeOptions, nodeById, childrenOf } = useMemo(() => {
    if (!graph) return {
      scopeOptions: [], interconnectScopeOptions: [],
      nodeById: new Map<string, GraphNode>(), childrenOf: new Map<string | null, string[]>(),
    };
    const nb = new Map(graph.nodes.map(n => [n.id, n]));
    const ch = buildChildrenMap(graph.nodes);

    // Split PartDefinitions into interconnection contexts (have nested PartUsages)
    // and component-type definitions (only ports/items, no nested parts).
    const interconnect: string[] = [];
    const leafDefs:     string[] = [];
    for (const n of graph.nodes) {
      if (n.type !== 'PartDefinition' || n.label === n.type) continue;
      const hasPartUsage = directSemanticChildren(n.id, ch, nb).some(c => c.type === 'PartUsage');
      if (hasPartUsage) interconnect.push(n.label);
      else               leafDefs.push(n.label);
    }
    const opts = [...interconnect, ...leafDefs];
    return { scopeOptions: opts, interconnectScopeOptions: interconnect, nodeById: nb, childrenOf: ch };
  }, [graph]);

  const activeScopeName = scopeOptions.includes(scopeName) ? scopeName
    : (interconnectScopeOptions[0] ?? scopeOptions[0] ?? '');

  // Must be defined before the main useMemo that references it in the dep array.
  const onPortSelect = useCallback((port: PortDisplay, e: React.MouseEvent) => {
    e.stopPropagation();
    const portNode = nodeById.get(port.id);
    onSelect({
      id:   `wport-${port.id}`,
      type: 'port' as const,
      name: port.label,
      line: portNode?.startLine,
      extra: { graphId: port.id, emfType: portNode?.type ?? 'PortUsage' },
    });
  }, [nodeById, onSelect]);

  // ── Build ReactFlow nodes and edges ──────────────────────────────────────────

  const { rfNodes, rfEdges } = useMemo(() => {
    if (!graph || !activeScopeName) return { rfNodes: [], rfEdges: [] };

    const scopeDef = graph.nodes.find(
      n => n.type === 'PartDefinition' && n.label === activeScopeName,
    );
    if (!scopeDef) return { rfNodes: [], rfEdges: [] };

    // Semantic children of the scope PartDef
    const scopeChildren = directSemanticChildren(scopeDef.id, childrenOf, nodeById);
    const partUsages    = scopeChildren.filter(n => n.type === 'PartUsage');
    const scopePorts    = scopeChildren.filter(n => n.type === 'PortUsage' || n.type === 'PortDefinition');
    const scopeItems    = scopeChildren.filter(n => n.type === 'ItemUsage');
    const scopeActions  = scopeChildren.filter(n => n.type === 'ActionUsage');

    // typedBy edges: usage → definition (needed for port direction inference)
    const typedByEdges = graph.edges.filter(e => e.type === 'typedBy');

    // Derive port direction: explicit → typedBy item-match → name heuristic.
    // Ports in this project are untyped in SysML source, so the name heuristic
    // is the primary resolver (*In → 'in', *Out → 'out', from_* → 'in', to_* → 'out').
    function resolvePortDir(port: GraphNode): string {
      if (port.direction) return port.direction;
      // Follow typedBy edge to the PortDefinition.
      const typedEdge = typedByEdges.find(e => e.source === port.id);
      if (typedEdge) {
        const portDef = nodeById.get(typedEdge.target);
        if (portDef) {
          const defKids = directSemanticChildren(portDef.id, childrenOf, nodeById);
          // Match by name first (unambiguous single feature case).
          const matchItem = defKids.find(
            n => n.label === port.label && n.direction,
          );
          if (matchItem?.direction) return matchItem.direction;
          // Aggregate all directed features: both in+out present → inout.
          const dirFeatures = defKids.filter(n => n.direction);
          if (dirFeatures.length === 1) return dirFeatures[0].direction ?? '';
          if (dirFeatures.length > 1) {
            const dirs = new Set(dirFeatures.map(f => f.direction));
            if ((dirs.has('in') && dirs.has('out')) || dirs.has('inout')) return 'inout';
            if (dirs.has('out')) return 'out';
            if (dirs.has('in')) return 'in';
          }
        }
      }
      // Fall back to shared name heuristic (*In → in, *Out → out, from_* → in, to_* → out).
      return resolvePortDirection(port.label, '');
    }

    function portDisplay(port: GraphNode): PortDisplay {
      const dir = resolvePortDir(port);
      return makeBoundaryPortDisplay(port.id, port.label, dir, '', dir);
    }

    // ── Leaf-part view: scope has no nested PartUsages ──────────────────────────
    // Render the scope PartDef itself as a container showing its ports, items,
    // and owned action usages. Also render package-sibling PortDefinitions as
    // context boxes (they describe the port item-flow types).
    if (partUsages.length === 0) {
      const selfId     = `wself-${scopeDef.id}`;
      const isSelfSel  = selection?.extra?.graphId === scopeDef.id || selection?.id === selfId;

      // Walk up the node ID path to find the containing Package.
      const pkgPortDefs: GraphNode[] = [];
      const idParts = scopeDef.id.split('.');
      for (let len = idParts.length - 1; len >= 1; len--) {
        const ancestorId = idParts.slice(0, len).join('.');
        const ancestor   = nodeById.get(ancestorId);
        if (ancestor && (ancestor.type === 'Package' || ancestor.type === 'LibraryPackage')) {
          const siblings = directSemanticChildren(ancestorId, childrenOf, nodeById);
          pkgPortDefs.push(...siblings.filter(n => n.type === 'PortDefinition'));
          break;
        }
      }

      // Estimate rendered height to distribute port handles across the node.
      // Header ~46px, each section label ~18px, each item/action row ~13px, padding 20px.
      const leafNodeH = Math.max(96,
        46
        + (scopeItems.length   > 0 ? 18 + scopeItems.length   * 13 : 0)
        + (scopeActions.length > 0 ? 18 + scopeActions.length * 13 : 0)
        + 20,
      );

      const selfNode: Node = {
        id:   selfId,
        type: 'wiringLeaf',
        position: { x: 0, y: 0 },
        data: {
          scopeName: activeScopeName,
          ports: scopePorts.map(portDisplay),
          items:    scopeItems.map(i => ({ id: i.id, label: i.label })),
          actions:  scopeActions.map(a => ({ id: a.id, label: a.label })),
          selection,
          onSelect,
          nodeH:    leafNodeH,
          _sel: {
            id: selfId, type: 'part' as const, name: scopeDef.label,
            line: scopeDef.startLine,
            extra: { graphId: scopeDef.id, emfType: 'PartDefinition' },
          } satisfies SelectionState,
        },
        style: {
          background:   PART_BG,
          border:       `1.5px solid ${isSelfSel ? PART_SEL : PART_BORDER}`,
          borderRadius: 8,
          padding:      '10px 14px',
          minWidth:     240,
          cursor:       'pointer',
          overflow:     'visible',
          boxShadow:    isSelfSel ? `0 0 8px 2px ${PART_SEL}44` : 'none',
        },
      };

      // PortDefinition context boxes showing item-flow direction
      const PORTDEF_X = 370;
      const rfPortDefNodes: Node[] = pkgPortDefs.map((pd, i) => {
        const pdKids  = directSemanticChildren(pd.id, childrenOf, nodeById);
        const pdItems = pdKids.filter(n => n.type === 'ItemUsage');
        const pdId    = `wportdef-${pd.id}`;
        const isPdSel = selection?.id === pdId || selection?.extra?.graphId === pd.id;
        return {
          id: pdId,
          position: { x: PORTDEF_X, y: i * 80 },
          data: {
            label: (
              <div style={{ fontFamily: 'monospace', minWidth: 150 }}>
                <div style={{ fontSize: 8.5, color: '#38bdf888', marginBottom: 2 }}>«port def»</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#7dd3fc', marginBottom: pdItems.length > 0 ? 4 : 0 }}>{pd.label}</div>
                {pdItems.map(it => (
                  <div key={it.id} style={{ fontSize: 9.5, color: portColor(it.direction) }}>
                    {portArrow(it.direction)} {it.label}
                  </div>
                ))}
              </div>
            ),
            _sel: {
              id: pdId, type: 'port' as const, name: pd.label,
              line: pd.startLine,
              extra: { graphId: pd.id, emfType: 'PortDefinition' },
            } satisfies SelectionState,
          },
          style: {
            background:   SCOPE_BG,
            border:       `1px solid ${isPdSel ? PART_SEL : SCOPE_BDR}`,
            borderRadius: 5,
            padding:      '6px 10px',
            cursor:       'pointer',
          },
        };
      });

      return { rfNodes: [selfNode, ...rfPortDefNodes], rfEdges: [] };
    }

    // For each PartUsage, collect its ports from the typed PartDef body first.
    // portAllPorts  — raw list per part (may include parser-emitted duplicates with the
    //                 same label, e.g. own-body entry + implicit-specialisation entry).
    // partPorts      — label-deduplicated list used for visual rendering (one square per name).
    // canonicalPortId — any portId → canonical portId (first-seen with that label under the
    //                   same part). Edges that resolve to a non-canonical ID are remapped here
    //                   so they still attach to the single visible handle square.
    const partAllPorts   = new Map<string, GraphNode[]>();
    const partPorts      = new Map<string, GraphNode[]>();
    const canonicalPortId = new Map<string, string>();

    for (const part of partUsages) {
      let allPorts: GraphNode[] = [];

      const typedByEdge = typedByEdges.find(e => e.source === part.id);
      if (typedByEdge) {
        const typeDef = nodeById.get(typedByEdge.target);
        if (typeDef) {
          const defKids = directSemanticChildren(typeDef.id, childrenOf, nodeById);
          allPorts = defKids.filter(n => n.type === 'PortUsage' || n.type === 'PortDefinition');
        }
      }
      if (allPorts.length === 0) {
        const kids = directSemanticChildren(part.id, childrenOf, nodeById);
        allPorts = kids.filter(n => n.type === 'PortUsage' || n.type === 'PortDefinition');
      }

      // Deduplicate by label: first-seen entry is canonical.
      const seenLabels = new Set<string>();
      const deduped: GraphNode[] = [];
      for (const p of allPorts) {
        if (!seenLabels.has(p.label)) {
          seenLabels.add(p.label);
          deduped.push(p);
          canonicalPortId.set(p.id, p.id);
        } else {
          const canonical = deduped.find(d => d.label === p.label)!;
          canonicalPortId.set(p.id, canonical.id);
        }
      }

      partAllPorts.set(part.id, allPorts);
      partPorts.set(part.id, deduped);
    }

    function getTypeName(nodeId: string): string | null {
      const edge = typedByEdges.find(e => e.source === nodeId);
      if (!edge) return null;
      return nodeById.get(edge.target)?.label ?? null;
    }

    // Map portId / partId → owning PartUsage id (or scope id for boundary ports).
    // Uses partAllPorts (all IDs, including non-canonical duplicates) so graph
    // edges that reference a non-canonical port ID still pass the inScopeConns filter.
    const portOwner = new Map<string, string>();
    for (const [partId, ports] of partAllPorts.entries()) {
      for (const p of ports) portOwner.set(p.id, partId);
      portOwner.set(partId, partId);
    }
    for (const sp of scopePorts) portOwner.set(sp.id, scopeDef.id);

    // Also register PartUsage direct-body port IDs so that flow edges whose
    // endpoints were resolved to PartUsage-body specialisation nodes (not the
    // canonical PartDef ports) are still counted as in-scope connections and
    // inform the rank-based layout. Map them to the canonical PartDef port of
    // the same label so portsAsSource / portsAsTarget stay correct.
    for (const part of partUsages) {
      const ownPorts = directSemanticChildren(part.id, childrenOf, nodeById)
        .filter(n => n.type === 'PortUsage' || n.type === 'PortDefinition');
      const canonical = partPorts.get(part.id) ?? [];
      for (const op of ownPorts) {
        portOwner.set(op.id, part.id);
        if (!canonicalPortId.has(op.id)) {
          const match = canonical.find(c => c.label === op.label);
          canonicalPortId.set(op.id, match?.id ?? op.id);
        }
      }
    }

    // Connection edges within this scope (structural port-to-port + behavioral message part-to-part)
    const inScopeConns = graph.edges.filter(
      e => (e.type === 'connection' || e.type === 'message' || e.type === 'interconnect') && portOwner.has(e.source) && portOwner.has(e.target),
    );

    // Returns V_GAP_SPLIT when the two adjacent parts in a column share no direct connection,
    // V_GAP when they do — visually groups connected parts and separates unrelated ones.
    function gapBetween(aId: string, bId: string): number {
      for (const conn of inScopeConns) {
        const src = portOwner.get(conn.source);
        const tgt = portOwner.get(conn.target);
        if ((src === aId && tgt === bId) || (src === bId && tgt === aId)) return V_GAP;
      }
      return V_GAP_SPLIT;
    }

    // ── Rank-based layout (Sugiyama-style, synchronous) ─────────────────────────
    // Build part-to-part directed graph from in-scope connections via portOwner.
    const flowOut = new Map<string, Set<string>>();
    const flowIn  = new Map<string, Set<string>>();
    for (const p of partUsages) { flowOut.set(p.id, new Set()); flowIn.set(p.id, new Set()); }
    for (const conn of inScopeConns) {
      const src = portOwner.get(conn.source);
      const tgt = portOwner.get(conn.target);
      if (!src || !tgt || src === tgt || src === scopeDef.id || tgt === scopeDef.id) continue;
      flowOut.get(src)?.add(tgt);
      flowIn.get(tgt)?.add(src);
    }

    // Detect back-edges using iterative DFS so cycle edges can be excluded from
    // rank assignment. Back-edges point to a DFS ancestor (gray node in the stack).
    // Removing them makes the ranking graph a DAG (Sugiyama cycle-breaking step).
    const dfsColor = new Map<string, number>(partUsages.map(p => [p.id, 0])); // 0=white,1=gray,2=black
    const backEdgeSet = new Set<string>(); // "srcId:tgtId" pairs
    for (const start of partUsages) {
      if (dfsColor.get(start.id) !== 0) continue;
      const stk: Array<{ id: string; iter: IterableIterator<string> }> = [];
      dfsColor.set(start.id, 1);
      stk.push({ id: start.id, iter: (flowOut.get(start.id) ?? new Set<string>())[Symbol.iterator]() });
      while (stk.length > 0) {
        const top = stk[stk.length - 1];
        const nxt = top.iter.next();
        if (nxt.done) { dfsColor.set(top.id, 2); stk.pop(); }
        else {
          const v = nxt.value;
          if (dfsColor.get(v) === 1) backEdgeSet.add(`${top.id}:${v}`);
          else if (dfsColor.get(v) === 0) {
            dfsColor.set(v, 1);
            stk.push({ id: v, iter: (flowOut.get(v) ?? new Set<string>())[Symbol.iterator]() });
          }
        }
      }
    }

    // Build an acyclic version of the graph by excluding detected back-edges.
    const rankOut = new Map<string, Set<string>>();
    const rankIn  = new Map<string, Set<string>>();
    for (const p of partUsages) { rankOut.set(p.id, new Set()); rankIn.set(p.id, new Set()); }
    for (const [src, dsts] of flowOut) {
      for (const dst of dsts) {
        if (!backEdgeSet.has(`${src}:${dst}`)) {
          rankOut.get(src)?.add(dst);
          rankIn.get(dst)?.add(src);
        }
      }
    }

    // Kahn's topological BFS on the acyclic subgraph to assign column ranks.
    // Rank = length of the longest incoming path from any source node.
    const rank = new Map<string, number>(partUsages.map(p => [p.id, 0]));
    const inDeg = new Map(partUsages.map(p => [p.id, rankIn.get(p.id)!.size]));
    const topo: string[] = [];
    const bfsHead = partUsages.filter(p => (inDeg.get(p.id) ?? 0) === 0).map(p => p.id);
    while (bfsHead.length > 0) {
      const u = bfsHead.shift()!;
      topo.push(u);
      for (const v of rankOut.get(u) ?? []) {
        const d = (inDeg.get(v) ?? 1) - 1;
        inDeg.set(v, d);
        const proposed = (rank.get(u) ?? 0) + 1;
        if ((rank.get(v) ?? 0) < proposed) rank.set(v, proposed);
        if (d <= 0) bfsHead.push(v);
      }
    }
    // Nodes still in cycles after back-edge removal: place after max reached rank.
    const maxRankReached = partUsages.reduce((m, p) => topo.includes(p.id) ? Math.max(m, rank.get(p.id) ?? 0) : m, 0);
    for (const p of partUsages) { if (!topo.includes(p.id)) rank.set(p.id, maxRankReached + 1); }
    const finalMaxRank = partUsages.reduce((m, p) => Math.max(m, rank.get(p.id) ?? 0), 0);

    // Port side assignment: for each in-scope connection, decide which side of the part
    // node each port's handle square should appear on.  Backward edges (source rank >
    // target rank) flip the sides so the edge travels straight across instead of
    // routing all the way around the shapes.
    const portsShowLeft  = new Set<string>();
    const portsShowRight = new Set<string>();
    for (const conn of inScopeConns) {
      const srcPartId  = portOwner.get(conn.source);
      const tgtPartId  = portOwner.get(conn.target);
      // rank.get returns undefined for scopeDef.id → treated as -1 (boundary)
      const srcRankVal = srcPartId ? (rank.get(srcPartId) ?? -1) : -1;
      const tgtRankVal = tgtPartId ? (rank.get(tgtPartId) ?? -1) : -1;
      const srcCanon   = canonicalPortId.get(conn.source) ?? conn.source;
      const tgtCanon   = canonicalPortId.get(conn.target) ?? conn.target;
      if (srcRankVal >= 0 && tgtRankVal >= 0 && srcRankVal > tgtRankVal) {
        // Backward edge: source exits left, target enters from right
        portsShowLeft.add(srcCanon);
        portsShowRight.add(tgtCanon);
      } else {
        // Forward, same-rank, or boundary connection: source exits right, target enters left
        portsShowRight.add(srcCanon);
        portsShowLeft.add(tgtCanon);
      }
    }

    // Group parts by rank; within each rank the initial order follows model order.
    const byRank: string[][] = Array.from({ length: finalMaxRank + 1 }, () => []);
    for (const p of partUsages) byRank[rank.get(p.id)!].push(p.id);

    // Barycenter heuristic (left-to-right pass): reorder nodes within each rank r
    // by the average index of their predecessors in rank r-1. Reduces crossings.
    // Uses the acyclic rankIn graph so back-edges don't perturb the ordering.
    for (let r = 1; r <= finalMaxRank; r++) {
      const prevIdx = new Map(byRank[r - 1].map((id, i) => [id, i]));
      byRank[r].sort((a, b) => {
        const bary = (pid: string) => {
          const preds = [...(rankIn.get(pid) ?? [])];
          if (preds.length === 0) return byRank[r].length / 2;
          return preds.reduce((s, id) => s + (prevIdx.get(id) ?? byRank[r - 1].length / 2), 0) / preds.length;
        };
        return bary(a) - bary(b);
      });
    }

    // Helper: rendered height for a part (header + one row per port).
    const nodeHeightOf = (partId: string) =>
      PART_BASE_H + (partPorts.get(partId)?.length ?? 0) * PORT_ROW_H;

    // Column widths: widest node in each rank.
    const colWidth = byRank.map(ids =>
      ids.reduce((mx, id) => {
        const p = partUsages.find(q => q.id === id)!;
        return Math.max(mx, wiringNodeWidth(p.label, getTypeName(id)));
      }, PART_MIN_W),
    );

    // Column heights: sum of node heights + variable inter-node gaps.
    const colHeight = byRank.map(ids => {
      if (ids.length === 0) return 0;
      let h = nodeHeightOf(ids[0]);
      for (let i = 1; i < ids.length; i++) h += gapBetween(ids[i - 1], ids[i]) + nodeHeightOf(ids[i]);
      return h;
    });

    // Center all columns at the same vertical midpoint so connected nodes are
    // roughly horizontally aligned even when column heights differ.
    const globalMidY = Y_PARTS + Math.max(...colHeight) / 2;

    // Build layoutPos map: part id → {x, y}
    const layoutPos = new Map<string, { x: number; y: number }>();
    let colX = 0;
    for (let r = 0; r <= finalMaxRank; r++) {
      const startY = globalMidY - colHeight[r] / 2;
      let rowY = startY;
      for (let j = 0; j < byRank[r].length; j++) {
        const id = byRank[r][j];
        layoutPos.set(id, { x: colX, y: rowY });
        if (j < byRank[r].length - 1) rowY += nodeHeightOf(id) + gapBetween(id, byRank[r][j + 1]);
      }
      colX += colWidth[r] + H_GAP;
    }

    // ── IBD container geometry ────────────────────────────────────────────────
    // innerW = total width of columns+inter-column gaps (no trailing H_GAP).
    const innerW     = colX - H_GAP;
    const maxColH    = colHeight.length > 0 ? Math.max(...colHeight) : 0;
    const containerW = SCOPE_PAD_LEFT + innerW + SCOPE_PAD_RIGHT;
    const containerH = SCOPE_PAD_TOP  + maxColH + SCOPE_PAD_BOTTOM;

    // Shift all part positions so they sit inside the container frame.
    // Y_PARTS is the current top baseline; SCOPE_PAD_TOP is the target.
    const xOffset = SCOPE_PAD_LEFT;
    const yOffset = SCOPE_PAD_TOP - Y_PARTS;
    for (const [id, pos] of layoutPos) {
      layoutPos.set(id, { x: pos.x + xOffset, y: pos.y + yOffset });
    }

    // ── Smart boundary port Y positioning ────────────────────────────────────
    // Anchor each boundary port at the average Y of its connected internal ports,
    // then enforce minimum spacing with a forward/backward sweep.
    const PORT_AREA_TOP = 42; // matches portAreaTop={42} in WiringPartNode
    const scopeDefIdStr = scopeDef.id; // captured for use inside nested closures

    function internalPortAbsY(portId: string): number | null {
      const canonId = canonicalPortId.get(portId) ?? portId;
      const partId  = portOwner.get(portId);
      if (!partId || partId === scopeDefIdStr) return null;
      const pos     = layoutPos.get(partId);
      if (!pos) return null;
      const ports   = partPorts.get(partId) ?? [];
      const idx     = ports.findIndex(p => p.id === canonId);
      if (idx < 0) return null;
      const nodeH   = nodeHeightOf(partId);
      const topPx   = PORT_AREA_TOP + ((idx + 1) / (ports.length + 1)) * (nodeH - PORT_AREA_TOP);
      return pos.y + topPx;
    }

    function preferredScopePortY(sp: GraphNode): number | null {
      const ys: number[] = [];
      for (const conn of inScopeConns) {
        const internalId = conn.source === sp.id ? conn.target
                         : conn.target === sp.id ? conn.source : null;
        if (!internalId) continue;
        const y = internalPortAbsY(internalId);
        if (y !== null) ys.push(y);
      }
      if (ys.length === 0) return null;
      return ys.reduce((a, b) => a + b, 0) / ys.length;
    }

    function assignScopePortYs(ports: GraphNode[]): number[] {
      if (ports.length === 0) return [];
      const preferred = ports.map(p => preferredScopePortY(p));
      // Sort by preferred Y; unconnected ports (null) go last in model order.
      const order = ports.map((_, i) => i).sort((a, b) => {
        const pa = preferred[a], pb = preferred[b];
        if (pa === null && pb === null) return a - b;
        if (pa === null) return 1;
        if (pb === null) return -1;
        return pa - pb;
      });
      const usableH    = containerH - SCOPE_PAD_TOP - SCOPE_PAD_BOTTOM;
      const defaultStep = usableH / (ports.length + 1);
      const lo = SCOPE_PAD_TOP + MIN_PORT_SPACING;
      const hi = containerH - SCOPE_PAD_BOTTOM - MIN_PORT_SPACING;
      const sortedY: number[] = order.map((origIdx, k) => {
        const pref = preferred[origIdx];
        const def  = SCOPE_PAD_TOP + defaultStep * (k + 1);
        return Math.max(lo, Math.min(hi, pref ?? def));
      });
      // Forward pass: enforce minimum spacing.
      for (let k = 1; k < sortedY.length; k++) {
        sortedY[k] = Math.max(sortedY[k], sortedY[k - 1] + MIN_PORT_SPACING);
      }
      // Backward pass: pull up any ports pushed past hi by the forward pass.
      for (let k = sortedY.length - 2; k >= 0; k--) {
        sortedY[k] = Math.min(sortedY[k], sortedY[k + 1] - MIN_PORT_SPACING);
      }
      // Map sorted positions back to original port order, subtracting half node height.
      const result = new Array<number>(ports.length);
      for (let k = 0; k < order.length; k++) {
        result[order[k]] = sortedY[k] - SCOPE_PORT_NODE_H / 2;
      }
      return result;
    }

    // Part nodes — layoutVersion in dep triggers position reset when user clicks Reset
    const partRfId = (partId: string) => `wpart-${partId}`;
    const rfPartNodes: Node[] = [];
    for (const part of partUsages) {
      const typeName = getTypeName(part.id);
      const ports    = partPorts.get(part.id) ?? [];
      const nodeH    = nodeHeightOf(part.id);
      const partW    = wiringNodeWidth(part.label, typeName);
      const id       = partRfId(part.id);
      const pos      = layoutPos.get(part.id) ?? { x: 0, y: Y_PARTS };
      const isSel    = selection?.extra?.graphId === part.id
                    || (selection?.type === 'part' && selection?.name === part.label);

      rfPartNodes.push({
        id,
        type: 'wiringPart',
        position: pos,
        data: {
          partLbl:  part.label,
          typeName: typeName ?? null,
          ports:    ports.map(p => {
            const pd         = portDisplay(p);
            const showsLeft  = portsShowLeft.has(p.id);
            const showsRight = portsShowRight.has(p.id);
            const isPortSel = selection?.extra?.graphId === p.id
                           || (selection?.type === 'port' && selection?.name === p.label);
            const selStyle = isPortSel ? { color: EDGE_SEL_C, fontWeight: 600 } : undefined;
            return {
              ...pd,
              ...(showsLeft || showsRight ? { showLeft: showsLeft, showRight: showsRight } : {}),
              ...(selStyle ? { labelStyle: { ...pd.labelStyle, ...selStyle } } : {}),
            };
          }),
          nodeH,
          onPortSelect,
          _sel: {
            id,
            type: 'part' as const,
            name: part.label,
            line: part.startLine,
            extra: {
              graphId:  part.id,
              emfType:  'PartUsage',
              ...(typeName ? { type: typeName } : {}),
            },
          } satisfies SelectionState,
        },
        style: {
          background:     PART_BG,
          border:         `1.5px solid ${isSel ? PART_SEL : PART_BORDER}`,
          borderRadius:   8,
          width:          partW,
          minHeight:      nodeH,
          padding:        '8px 12px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          overflow:       'visible',
          boxShadow:      isSel ? `0 0 8px 2px ${PART_SEL}44` : 'none',
          cursor:         'pointer',
        },
      });
    }

    // ── IBD boundary port nodes: in/inout on left frame edge, out on right ──────
    // Port square straddles the frame edge: left-side nodes at x=0 (sqL handle
    // has `left: -9` so its center lands at the container left at x=0), right-side
    // nodes at x = containerW - SCOPE_PORT_NODE_W (sqR center at x=containerW).
    const leftScopePorts  = scopePorts.filter(p => resolvePortDir(p) !== 'out');
    const rightScopePorts = scopePorts.filter(p => resolvePortDir(p) === 'out');

    function makeScopePortNode(port: GraphNode, y: number, isRight: boolean): Node {
      const id  = `wsport-${port.id}`;
      const dir = resolvePortDir(port);
      // One visible square per boundary port: left-side ports show sqL (on left boundary),
      // right-side ports show sqR (on right boundary). The hidden handle stays in the DOM
      // so React Flow can still route edges to/from it.
      const pd: PortDisplay = { ...makeBoundaryPortDisplay(port.id, port.label, dir, '', dir), showLeft: !isRight, showRight: isRight };
      return {
        id,
        type: 'wiringScopePort',
        position: {
          x: isRight ? containerW - SCOPE_PORT_NODE_W : 0,
          y,
        },
        data: {
          port: pd,
          onPortSelect,
          _sel: {
            id,
            type: 'port' as const,
            name: port.label,
            line: port.startLine,
            extra: { graphId: port.id },
          } satisfies SelectionState,
        },
        style: {
          width:      SCOPE_PORT_NODE_W,
          height:     SCOPE_PORT_NODE_H,
          background: 'transparent',
          border:     'none',
          padding:    0,
          overflow:   'visible',
        },
      };
    }

    const leftYs  = assignScopePortYs(leftScopePorts);
    const rightYs = assignScopePortYs(rightScopePorts);
    const rfScopePortNodes: Node[] = [
      ...leftScopePorts.map((p, i)  => makeScopePortNode(p, leftYs[i],  false)),
      ...rightScopePorts.map((p, i) => makeScopePortNode(p, rightYs[i], true)),
    ];

    // Build a label → FlowUsage GraphNode map so connection edges can carry _sel
    // that jumps the editor cursor to the flow declaration, not just the port.
    const flowNodeByLabel = new Map<string, GraphNode>();
    for (const n of graph.nodes) {
      if (FLOW_NODE_TYPES.has(n.type) && n.label !== n.type && !flowNodeByLabel.has(n.label)) {
        flowNodeByLabel.set(n.label, n);
      }
    }

    // Connection edges: map portId / partId → rfNodeId.
    // Uses partAllPorts so non-canonical duplicate IDs also map to the correct RF node.
    const portToRfId = new Map<string, string>();
    for (const [partId, ports] of partAllPorts.entries()) {
      for (const p of ports) portToRfId.set(p.id, partRfId(partId));
      portToRfId.set(partId, partRfId(partId)); // allow part-to-part FlowUsage connections
    }
    for (const sp of scopePorts) portToRfId.set(sp.id, `wsport-${sp.id}`);
    // Mirror the portOwner fix: also register PartUsage body port IDs so that
    // flow edges resolved to specialisation-copy port IDs are rendered as wires.
    for (const part of partUsages) {
      const ownPorts = directSemanticChildren(part.id, childrenOf, nodeById)
        .filter(n => n.type === 'PortUsage' || n.type === 'PortDefinition');
      for (const op of ownPorts) {
        if (!portToRfId.has(op.id)) portToRfId.set(op.id, partRfId(part.id));
      }
    }

    const rfConnEdges: Edge[] = inScopeConns
      .filter(conn => {
        const srcRf = portToRfId.get(conn.source);
        const tgtRf = portToRfId.get(conn.target);
        return srcRf && tgtRf && srcRf !== tgtRf;
      })
      .map(conn => {
        const srcRf   = portToRfId.get(conn.source)!;
        const tgtRf   = portToRfId.get(conn.target)!;
        const srcNode = nodeById.get(conn.source);
        const tgtNode = nodeById.get(conn.target);
        // Structural connections (ConnectionUsage, no label) are undirected plain lines.
        // Flow connections (FlowUsage etc.) carry a named label and get animated arrows.
        const isStructural = !conn.label;
        const label = conn.label;

        // Find the FlowUsage graph node for this edge (label match: exact or prefix before " : ")
        let flowNode = conn.label ? flowNodeByLabel.get(conn.label) : undefined;
        if (!flowNode && conn.label) {
          const colonIdx = conn.label.indexOf(' : ');
          if (colonIdx > 0) flowNode = flowNodeByLabel.get(conn.label.slice(0, colonIdx));
        }

        const edgeSel: SelectionState = flowNode
          ? {
              id:   `wflow-${flowNode.id}`,
              type: 'connection' as const,
              name: flowNode.label,
              line: flowNode.startLine,
              extra: { graphId: flowNode.id, emfType: flowNode.type },
            }
          : {
              id:   `wconn-${conn.id}`,
              type: 'connection' as const,
              name: label ?? '',
              extra: {
                fromPort: srcNode?.label ?? '',
                toPort:   tgtNode?.label ?? '',
              },
            };

        const isEdgeSel = flowNode
          ? selection?.extra?.graphId === flowNode.id || selection?.id === `wflow-${flowNode.id}`
          : selection?.id === `wconn-${conn.id}`;
        // Highlight edges connected to the selected node (part or scope-port).
        // srcRf / tgtRf are the React Flow node ids; selection.id for a node click
        // is set to the same id (wpart-* or wsport-*), so the check is exact.
        const isConnected = !isEdgeSel && (selection?.id === srcRf || selection?.id === tgtRf);
        const highlightEdge = isEdgeSel || isConnected;

        const isMsg  = conn.type === 'message';
        const edgeC  = highlightEdge ? EDGE_SEL_C : (isMsg ? MSG_C : CONN_C);

        // Route structural edges to port-handle squares; message edges connect parts directly.
        const isSrcPort = !isMsg && srcNode?.type === 'PortUsage';
        const isTgtPort = !isMsg && tgtNode?.type === 'PortUsage';
        // Remap through canonicalPortId: a non-canonical duplicate ID must attach
        // to the handle of the single canonical (visible) square for that port.
        const srcCanon   = canonicalPortId.get(conn.source) ?? conn.source;
        const tgtCanon   = canonicalPortId.get(conn.target) ?? conn.target;
        // Detect backward edges (source at higher layout rank than target) so the
        // port squares and edge handles can be flipped to face each other directly.
        const srcPartId  = portOwner.get(conn.source);
        const tgtPartId  = portOwner.get(conn.target);
        const srcRankVal = srcPartId ? (rank.get(srcPartId) ?? -1) : -1;
        const tgtRankVal = tgtPartId ? (rank.get(tgtPartId) ?? -1) : -1;
        const isBackward = srcRankVal >= 0 && tgtRankVal >= 0 && srcRankVal > tgtRankVal;
        // Forward edge: source sqR (position=Right) → target sqL (position=Left).
        // Backward edge: source exits via port-X-ft (position=Left, co-located with sqL)
        //   and target receives via port-X-tgt-right (position=Right, co-located with sqR).
        // With SCOPE_PORT_NODE_W=9 the sqR center coincides with the inner face of sqL.
        const srcHandle = isSrcPort ? (isBackward ? `port-${srcCanon}-ft` : `port-${srcCanon}-out`) : undefined;
        const tgtHandle = isTgtPort ? (isBackward ? `port-${tgtCanon}-tgt-right` : `port-${tgtCanon}`) : undefined;

        const edge: Edge & { pathOptions?: { borderRadius?: number } } = {
          id:              `wconn-${conn.id}`,
          source:          srcRf,
          target:          tgtRf,
          sourceHandle:    srcHandle,
          targetHandle:    tgtHandle,
          type:            'smoothstep',
          animated:        !isMsg && !isStructural,
          label,
          // Label background prevents text landing directly on port glyphs or node text.
          labelStyle:      { fill: edgeC, fontSize: 9, fontFamily: 'monospace' },
          labelBgStyle:    { fill: '#030c06', fillOpacity: 0.95, rx: 3, ry: 3 },
          labelBgPadding:  [3, 4] as [number, number],
          style:           { stroke: edgeC, strokeWidth: highlightEdge ? 2.5 : 1.5, ...(isMsg ? { strokeDasharray: '6 3' } : {}) },
          // Structural connections (ConnectionUsage) are undirected — no arrowhead.
          // Flow connections carry direction (FlowUsage / FlowConnectionUsage).
          ...(isStructural ? {} : { markerEnd: { type: MarkerType.ArrowClosed, color: edgeC, width: 12, height: 12 } }),
          // Smooth rounded corners on the orthogonal bends
          pathOptions:     { borderRadius: 12 },
          data:            { _sel: edgeSel },
        };
        return edge;
      });

    // IBD outer frame — rendered first (lowest z-order, behind parts and ports)
    const scopeContainerNode: Node = {
      id:         'wscope-container',
      type:       'wiringScopeContainer',
      position:   { x: 0, y: 0 },
      draggable:  false,
      selectable: false,
      focusable:  false,
      data:       { scopeName: activeScopeName },
      style: {
        width:         containerW,
        height:        containerH,
        background:    'transparent',
        border:        `1.5px solid ${SCOPE_FRAME_BDR}`,
        borderRadius:  6,
        overflow:      'visible',
        pointerEvents: 'none',
      },
    };

    return {
      rfNodes: [scopeContainerNode, ...rfPartNodes, ...rfScopePortNodes],
      rfEdges: rfConnEdges,
    };
  // layoutVersion in deps forces position recomputation when user clicks Reset
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, activeScopeName, nodeById, childrenOf, selection, layoutVersion, onPortSelect]);

  // When rfNodes changes (model reload, scope switch, selection, layout reset)
  // merge into displayNodes: preserve existing drag positions unless this is a
  // Reset Layout (layoutVersion changed).
  useEffect(() => {
    setDisplayNodes(prev => {
      const isReset = layoutVersionRef.current !== layoutVersion;
      if (isReset) {
        layoutVersionRef.current = layoutVersion;
        return rfNodes;
      }
      const prevPosMap = new Map(prev.map(n => [n.id, n.position]));
      return rfNodes.map(n => {
        const saved = prevPosMap.get(n.id);
        return saved ? { ...n, position: saved } : n;
      });
    });
  // rfNodes reference changes on every useMemo run; layoutVersion is needed to
  // detect explicit resets without adding savedPositions to the dep array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfNodes, layoutVersion]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setDisplayNodes(prev => applyNodeChanges(changes, prev));
  }, []);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const s = node.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  const handleEdgeClick: EdgeMouseHandler = useCallback((_e, edge) => {
    const s = edge.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  // ── Empty states ───────────────────────────────────────────────────────────

  if (!graph) {
    return (
      <div style={{ padding: 24, color: '#64748b', fontFamily: 'monospace', fontSize: 13 }}>
        No graph data. Switch to Official SysML v2 mode and parse a file.
      </div>
    );
  }

  if (scopeOptions.length === 0) {
    return (
      <div style={{ padding: 24, color: '#64748b', fontFamily: 'monospace', fontSize: 13 }}>
        No PartDefinitions found in the model. Define a <code>part def</code> to inspect its structural wiring.
      </div>
    );
  }

  const partCount = rfNodes.filter(n => n.id.startsWith('wpart-') || n.id.startsWith('wself-')).length;
  const connCount = rfEdges.length;

  const actionBtn: React.CSSProperties = {
    background: '#111827', border: '1px solid #2a2a3a',
    color: '#9ca3af', borderRadius: 4, padding: '2px 9px',
    cursor: 'pointer', fontSize: 11,
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Scope + layout toolbar ──────────────────────────────────────── */}
      <div style={{
        padding:       '7px 14px',
        background:    '#0f172a',
        borderBottom:  '1px solid #1e293b',
        display:       'flex',
        alignItems:    'center',
        gap:           10,
        fontFamily:    'monospace',
        fontSize:      12,
        flexShrink:    0,
      }}>
        <span style={{ color: '#64748b' }}>Scope:</span>
        <select
          value={activeScopeName}
          onChange={e => setScopeName(e.target.value)}
          style={{
            background:   '#1e293b',
            color:        '#e2e8f0',
            border:       '1px solid #334155',
            borderRadius: 3,
            fontSize:     12,
            padding:      '2px 6px',
            fontFamily:   'monospace',
            cursor:       'pointer',
          }}
        >
          {interconnectScopeOptions.length > 0 && (
            <optgroup label="Interconnection">
              {interconnectScopeOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </optgroup>
          )}
          {scopeOptions.filter(n => !interconnectScopeOptions.includes(n)).length > 0 && (
            <optgroup label="Component defs">
              {scopeOptions.filter(n => !interconnectScopeOptions.includes(n)).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </optgroup>
          )}
        </select>
        <span style={{ color: '#334155', fontSize: 11 }}>
          {partCount} part{partCount !== 1 ? 's' : ''}
          {connCount > 0 && ` · ${connCount} connection${connCount !== 1 ? 's' : ''}`}
        </span>
        <button
          style={actionBtn}
          title="Reset parts to computed positions"
          onClick={() => setLayoutVersion(v => v + 1)}
        >
          ↺ Reset Layout
        </button>
        <span style={{ marginLeft: 'auto', color: '#1e3a5f', fontSize: 10 }}>
          Structural wiring · part usages + connections
        </span>
      </div>

      {/* ── Wiring diagram ─────────────────────────────────────────────── */}
      {rfNodes.length > 0 ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReactFlow
            nodes={displayNodes.length > 0 ? displayNodes : rfNodes}
            edges={rfEdges}
            nodeTypes={WIRING_NODE_TYPES}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onNodesChange={handleNodesChange}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            nodesConnectable={false}
          >
            <Background color="#1a2a3a" gap={24} />
            <Controls showFitView={false} />
            <FitPanel padding={0.3} onReset={() => setLayoutVersion(v => v + 1)} />
          </ReactFlow>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#475569',
          fontFamily: 'monospace',
          fontSize: 13,
          flexDirection: 'column',
          gap: 8,
        }}>
          <div>No structural members found in</div>
          <div style={{ color: '#7dd3fc', fontWeight: 600 }}>{activeScopeName}</div>
        </div>
      )}
    </div>
  );
}
