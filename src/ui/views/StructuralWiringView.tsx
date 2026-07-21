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
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath,
  type Node, type Edge, type NodeChange, type NodeProps, type EdgeMouseHandler,
  type EdgeProps, type ReactFlowInstance,
} from '@xyflow/react';
import { PortHandles, makeBoundaryPortDisplay, resolvePortDirection, type PortDisplay } from '../layout/PortHandles';
import { AsilBadge, RealizationBadge, HwSwAllocBadge, asilLabel } from '../layout/AsilBadge';
import { fitNodeWidth, type TextRow } from '../layout/nodeSize';
import '@xyflow/react/dist/style.css';
import type { ContainmentGraph, GraphNode } from '../../core/sysmlv2Official/ContainmentGraph';
import type { IncrementalEdit } from '../../core/editDescriptor';
import { buildChildrenMap, directSemanticChildren } from '../../core/sysmlv2Official/graphHelpers';
import { ElkEdge } from '../layout/ElkEdge';
import {
  layoutWiringElk,
  type WiringElkNode, type WiringElkPort, type WiringElkEdge,
} from '../layout/graphLayout';
import { FitPanel } from '../layout/FitPanel';
import type { SelectionState } from '../../app/selection';

// ── Layout constants ──────────────────────────────────────────────────────────

const PART_MIN_W    = 200;
const WIRING_H_PAD  = 24;  // 2 × 12 px from padding: '8px 12px'
const PART_BASE_H   = 72;
const PORT_ROW_H    = 19;
const H_GAP         = 320; // horizontal gap between rank columns (wide enough for edge-label room and obstacle-free smoothstep curves)
const V_GAP         = 110; // vertical gap between directly-connected nodes in the same rank column
const V_GAP_SPLIT   = 260; // larger gap between disconnected groups in the same rank column
const Y_PARTS       = 60;  // min-y used as base in the rank-centering formula

// IBD outer-frame (scope container) geometry
const SCOPE_PAD_TOP     = 60;  // space for the «part def» + name header
const SCOPE_PAD_BOTTOM  = 90;
const SCOPE_PAD_LEFT    = 260; // gap between left frame edge and first rank column
const SCOPE_PAD_RIGHT   = 260;
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
const CONN_C      = '#3f6b55'; // default wiring — muted so the diagram reads calmer; a clicked
                               // edge still brightens to EDGE_SEL_C with the spotlight glow.
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

function WiringPartNode({ id, data }: NodeProps) {
  const ports         = (data['ports']        as PortDisplay[]) ?? [];
  const partLbl       =  data['partLbl']       as string;
  const typeName      = (data['typeName']      as string | null) ?? null;
  const nodeH         = (data['nodeH']         as number) ?? PART_BASE_H;
  const asil          = (data['asil']          as string | undefined);
  const realization   = (data['realization']   as string | undefined);
  const hwSwAlloc     = (data['hwSwAlloc']      as string | undefined);
  const onPortSelect  = data['onPortSelect']   as ((p: PortDisplay, e: React.MouseEvent) => void) | undefined;
  const expandable    = (data['expandable']    as boolean | undefined) ?? false;
  const expanded      = (data['expanded']      as boolean | undefined) ?? false;
  const onToggleExpand = data['onToggleExpand'] as ((id: string) => void) | undefined;

  // Expansion is keyed on the full (path-prefixed) React Flow node id, NOT the semantic part
  // id: an inherited/reused part (e.g. `controller` inside two different domains) shares one
  // semantic id but has a distinct node id per instance, so each expands independently.
  const toggle = expandable && onToggleExpand ? (
    <button
      title={expanded ? 'Collapse internals' : 'Expand internals'}
      onClick={(e) => { e.stopPropagation(); onToggleExpand(id); }}
      style={{
        position: 'absolute', top: 4, right: 4, zIndex: 30,
        width: 16, height: 16, lineHeight: '14px', textAlign: 'center',
        padding: 0, borderRadius: 3, cursor: 'pointer',
        background: '#0b1e14', border: `1px solid ${PART_BORDER}`, color: PART_NAME,
        fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
      }}
    >
      {expanded ? '−' : '+'}
    </button>
  ) : null;

  return (
    <>
      <Handle type="target" id="__target" position={Position.Left}  style={{ opacity: 0 }} />
      <Handle type="source" id="__source" position={Position.Right} style={{ opacity: 0 }} />

      <PortHandles
        // When expanded, boundary ports are rendered by the embedded frame-port nodes
        // inside the container, so the part box itself draws none (avoids duplication).
        ports={expanded ? [] : ports}
        isLR={true}
        sourcePos={Position.Right}
        targetPos={Position.Left}
        nodeH={nodeH}
        portAreaTop={expanded ? 30 : 42}
        labelBelowLine
        onPortClick={onPortSelect}
      />

      {toggle}

      {expanded ? (
        // Container mode: header pinned top-left; ReactFlow renders child nodes inside.
        <div style={{ position: 'absolute', top: 8, left: 12, fontFamily: 'monospace', pointerEvents: 'none' }}>
          <span style={{ fontSize: 9, color: '#4ade8088', letterSpacing: '0.3px' }}>«part» </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: PART_NAME }}>{partLbl}</span>
          {typeName && <span style={{ fontSize: 10, color: PART_TYPE, marginLeft: 4 }}>: {typeName}</span>}
        </div>
      ) : (
        <div style={{ fontFamily: 'monospace', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: ports.length > 0 ? 6 : 0 }}>
            <div style={{ fontSize: 9, color: '#4ade8088', letterSpacing: '0.3px' }}>«part»</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: PART_NAME }}>{partLbl}</div>
            {typeName && <div style={{ fontSize: 10, color: PART_TYPE, marginTop: 1 }}>: {typeName}</div>}
            {(asil || realization || hwSwAlloc) && (
              <div style={{ marginTop: 3, display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                {asil && <AsilBadge level={asil} />}
                {realization && <RealizationBadge kind={realization} />}
                {hwSwAlloc && <HwSwAllocBadge kind={hwSwAlloc} />}
              </div>
            )}
          </div>
        </div>
      )}
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
        labelBelowLine
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
        labelBelowLine
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

/**
 * Orthogonal wiring edge that routes each connection through its OWN vertical
 * channel between the two nodes (via a per-edge `centerX`), so parallel wires
 * never lie on top of one another. `data.laneFrac` (0..1) positions the vertical
 * run within the inter-node gap; assigned per node-pair by the layout.
 */
function ChannelEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  markerEnd, style, data, label, labelStyle, labelBgStyle,
}: EdgeProps) {
  const frac    = typeof data?.['laneFrac'] === 'number' ? (data['laneFrac'] as number) : 0.5;
  const centerX = sourceX + (targetX - sourceX) * frac;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    borderRadius: 10, centerX,
  });
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label != null && label !== '' && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              padding: '1px 3px', borderRadius: 3,
              ...(labelBgStyle as React.CSSProperties),
              ...(labelStyle as React.CSSProperties),
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const WIRING_EDGE_TYPES = { channel: ChannelEdge, elkEdge: ElkEdge } as const;

// ── Embedded sub-diagram id remapping ─────────────────────────────────────────
// Prepend `prefix` to every node id (and edge source/target and parentId) of a
// computed sub-diagram so an embedded copy never collides with the outer diagram.
// Port-handle ids are node-relative and stay unchanged, so edges keep binding.
function prefixDiagram(
  sub: { nodes: Node[]; edges: Edge[]; width: number; height: number },
  prefix: string,
): { nodes: Node[]; edges: Edge[]; width: number; height: number } {
  const nodes = sub.nodes.map(n => ({
    ...n,
    id: prefix + n.id,
    ...(n.parentId ? { parentId: prefix + n.parentId } : {}),
  }));
  const edges = sub.edges.map(e => ({
    ...e,
    id: prefix + e.id,
    source: prefix + e.source,
    target: prefix + e.target,
  }));
  return { nodes, edges, width: sub.width, height: sub.height };
}


// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  graph:     ContainmentGraph | null | undefined;
  selection: SelectionState;
  onSelect:  (s: SelectionState) => void;
  /** Full source text — used to compute where to insert new elements. */
  source?:   string;
  /** Apply a source edit (write-back). Present only in editable (VS Code) mode. */
  onIncrementalEdit?: (edit: IncrementalEdit) => void;
  /** Add a member (e.g. `port p : X;`) to a named definition, wherever it lives. */
  onAddMemberToDef?: (defName: string, memberText: string) => void;
}

// ── Add-element helpers ─────────────────────────────────────────────────────────

function leadingWhitespace(line: string): string {
  const m = /^[ \t]*/.exec(line);
  return m ? m[0] : '';
}

/**
 * Build the source edit that inserts a new `part <name> : <Type>;` into the scope
 * PartDefinition body — after the last existing part usage, else just before the
 * scope's closing brace. Indentation is copied from a sibling.
 */
function buildAddPartEdit(
  source: string,
  scopeDef: GraphNode,
  partUsages: GraphNode[],
  name: string,
  typeName: string | null,
): IncrementalEdit | null {
  const lines = source.split('\n');
  const decl  = typeName ? `part ${name} : ${typeName};` : `part ${name};`;

  const withLines = partUsages.filter(p => (p.endLine ?? 0) > 0);
  if (withLines.length > 0) {
    const ref = withLines.reduce((a, b) => ((b.endLine ?? 0) > (a.endLine ?? 0) ? b : a));
    const indent = leadingWhitespace(lines[(ref.startLine ?? 1) - 1] ?? '');
    return { kind: 'insert', position: { line: (ref.endLine ?? 1) + 1, column: 1 }, text: `${indent}${decl}\n` };
  }
  if (scopeDef.endLine && scopeDef.endLine > 0) {
    const indent = leadingWhitespace(lines[(scopeDef.startLine ?? 1) - 1] ?? '') + '    ';
    return { kind: 'insert', position: { line: scopeDef.endLine, column: 1 }, text: `${indent}${decl}\n` };
  }
  return null;
}

/**
 * Build the source edit that inserts a boundary `port <name> : <PortDef>;` as the
 * first member of the scope PartDefinition (right after its opening line).
 */
function buildAddPortEdit(
  source: string,
  scopeDef: GraphNode,
  name: string,
  typeName: string | null,
): IncrementalEdit | null {
  if (!scopeDef.startLine || !scopeDef.endLine) return null;
  const lines  = source.split('\n');
  const indent = leadingWhitespace(lines[scopeDef.startLine - 1] ?? '') + '    ';
  const decl   = typeName ? `port ${name} : ${typeName};` : `port ${name};`;
  // Insert as the first body member (assumes `part def … {` opens on startLine).
  return { kind: 'insert', position: { line: scopeDef.startLine + 1, column: 1 }, text: `${indent}${decl}\n` };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StructuralWiringView({ graph, selection, onSelect, source, onIncrementalEdit, onAddMemberToDef }: Props) {
  const [scopeName, setScopeName] = useState('');
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [hideUnconnectedPorts, setHideUnconnectedPorts] = useState(false);
  // Part usages (by graph id) whose type-def internals are expanded in place.
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());
  const onToggleExpand = useCallback((partId: string) => {
    setExpandedParts(prev => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId); else next.add(partId);
      return next;
    });
  }, []);

  // ── Drag-position persistence ────────────────────────────────────────────────
  // displayNodes is the source-of-truth for React Flow; it is initialised from
  // the useMemo output and updated in-place by onNodesChange during drag.
  // layoutVersionRef lets the merge effect detect a "Reset Layout" click so it
  // discards saved positions instead of re-applying them.
  const [displayNodes, setDisplayNodes] = useState<Node[]>([]);
  const layoutVersionRef = useRef(layoutVersion);

  // ELK layered layout for the wiring diagram: part-box positions + obstacle-avoiding
  // orthogonal edge routes + overall size. null until the async layout resolves.
  type ElkPortPos = Map<string, { x: number; y: number; side: 'left' | 'right' | 'top' | 'bottom' }>;
  type ElkBoundaryPos = Map<string, { x: number; y: number; side: 'left' | 'right' | 'top' | 'bottom'; containerW: number }>;
  const [elkLayout, setElkLayout] = useState<
    { nodePos: Map<string, { x: number; y: number }>;
      nodeSize: Map<string, { w: number; h: number }>;
      portPos: ElkPortPos; boundaryPos: ElkBoundaryPos;
      routes: Map<string, { x: number; y: number }[]>; width: number; height: number } | null
  >(null);
  // Bumped when a fresh ELK layout is applied, so React Flow remounts and adopts the
  // new node positions (it otherwise keeps a node's internal position across prop changes).
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  // Nodes the user has dragged since the last (re)layout. Their ELK-routed edges carry FIXED
  // absolute waypoints that don't move with the node, so we drop those edges back to the
  // dynamic `channel` routing (which follows the handles) until the next relayout re-routes.
  const [draggedNodeIds, setDraggedNodeIds] = useState<Set<string>>(new Set());
  // Tracks the last-applied expansion set so the merge can force a fresh layout when a
  // part is expanded/collapsed (sizes change → all parts must re-flow around it) rather
  // than preserving stale drag positions.
  const expandedPartsRef = useRef(expandedParts);

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
      // Offer only definitions declared in the open file as scopes; context-file defs
      // stay in `nb`/`graph` purely to resolve the primary scope's contents.
      if (n.fromPrimary === false) continue;
      const hasPartUsage = directSemanticChildren(n.id, ch, nb).some(c => c.type === 'PartUsage');
      if (hasPartUsage) interconnect.push(n.label);
      else               leafDefs.push(n.label);
    }
    const opts = [...interconnect, ...leafDefs];
    return { scopeOptions: opts, interconnectScopeOptions: interconnect, nodeById: nb, childrenOf: ch };
  }, [graph]);

  const activeScopeName = scopeOptions.includes(scopeName) ? scopeName
    : (interconnectScopeOptions[0] ?? scopeOptions[0] ?? '');

  // Reset expansion when the scope changes — expanded ids belong to the old scope.
  useEffect(() => { setExpandedParts(new Set()); }, [activeScopeName]);

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

    const scopeDefTop = graph.nodes.find(
      n => n.type === 'PartDefinition' && n.label === activeScopeName,
    );
    if (!scopeDefTop) return { rfNodes: [], rfEdges: [] };

    // Specialization (`part def A :> B`): A inherits B's members. Map each def to its
    // direct supertypes so member lookups can include inherited parts/ports/connections —
    // e.g. a part typed by an "empty" subclass still expands into the base def's internals.
    const superOf = new Map<string, string[]>();
    for (const e of graph.edges) {
      if (e.type !== 'specialization') continue;
      const list = superOf.get(e.source);
      if (list) list.push(e.target); else superOf.set(e.source, [e.target]);
    }
    // Semantic children of a definition INCLUDING those inherited from its supertypes
    // (transitively). Own members shadow inherited ones of the same name (redefinition).
    // Cycle-guarded. For defs with no supertype this is exactly directSemanticChildren.
    const inheritedChildren = (defId: string, seen = new Set<string>()): GraphNode[] => {
      const own = directSemanticChildren(defId, childrenOf, nodeById);
      const supers = superOf.get(defId);
      if (!supers || seen.has(defId)) return own;
      seen.add(defId);
      const byLabel = new Set(own.map(n => n.label));
      const merged = [...own];
      for (const sup of supers) {
        for (const inh of inheritedChildren(sup, seen)) {
          if (!byLabel.has(inh.label)) { merged.push(inh); byLabel.add(inh.label); }
        }
      }
      return merged;
    };

    // Reusable interconnect computation for one PartDefinition scope. Called for the
    // top scope and, recursively, for the type def of every expanded part usage so an
    // expanded part shows the exact diagram the top-level view renders for that def.
    // Returns natural (unprefixed) ids; embedding remaps them via prefixDiagram().
    // `pathPrefix` is the id prefix this diagram will be embedded under (e.g.
    // `wpart-drivingDomain::`), so expansion state — keyed on the full node-id path — is
    // resolved per INSTANCE, not per shared semantic id (two domains' inherited `controller`
    // expand independently).
    function computeInterconnect(scopeDef: GraphNode, seen: Set<string> = new Set(), externallyConnected: Set<string> = new Set(), pathPrefix = ''): { nodes: Node[]; edges: Edge[]; width: number; height: number } {
      if (!graph) return { nodes: [], edges: [], width: 0, height: 0 };

    // Semantic children of the scope PartDef (including members inherited via `:>`).
    const scopeChildren = inheritedChildren(scopeDef.id);
    const partUsages    = scopeChildren.filter(n => n.type === 'PartUsage');
    const scopePorts    = scopeChildren.filter(n => n.type === 'PortUsage' || n.type === 'PortDefinition');
    const scopeItems    = scopeChildren.filter(n => n.type === 'ItemUsage');
    const scopeActions  = scopeChildren.filter(n => n.type === 'ActionUsage');

    // typedBy edges: usage → definition (needed for port direction inference)
    const typedByEdges = graph.edges.filter(e => e.type === 'typedBy');

    // Feature type name by owner id. The official parser attaches a port's type either
    // as a `typedBy` edge OR — for types declared in a context file — as a `FeatureTyping`
    // child node (contains edge) whose label is the type name. The latter is the only place
    // the type shows up for such ports, and its …In/…Out suffix encodes the direction.
    const featureTypeById = new Map<string, string>();
    for (const e of graph.edges) {
      if (e.type !== 'contains') continue;
      const child = nodeById.get(e.target);
      if (child?.type === 'FeatureTyping' && child.label) featureTypeById.set(e.source, child.label);
    }

    // Connection-based direction inference — fallback for ports that have no
    // explicit direction, no typedBy edge (e.g. SysML v2 ConjugatedPortTyping
    // doesn't serialize its cross-reference in the official parser output),
    // and no name heuristic match.
    //
    // For **internal** ports of a part: the source of `connect A.p1 to B.p2`
    // emits data (`'out'`), the target receives (`'in'`).  For **boundary**
    // ports owned by the scope, the role is FLIPPED — they sit on the frame
    // edge, so a connection like `connect boundaryIn to internal.p` carries
    // external data IN to the internal port; the boundary endpoint is `'in'`.
    // Without this flip every conjugated supply-voltage input
    // (`port X : ~Y_Port`) was tagged `'out'` and ended up on the wrong side
    // of the IBD frame.
    const scopePortIdSet = new Set(scopePorts.map(p => p.id));

    // ── Owner-relative port direction ─────────────────────────────────────────────
    // A port's frame-relative direction is a property of its OWNING definition, not of
    // whichever scope is being rendered. Classify each flow endpoint relative to the
    // owning def of that endpoint's port:
    //   • delegation  — the OTHER endpoint is a port of one of this owner's DIRECT
    //     internal parts ⇒ boundary flip (this port as source → 'in', as target → 'out').
    //   • sibling use — both owners are direct part types of a COMMON parent def
    //     ⇒ no flip (source → 'out', target → 'in').
    //   • otherwise    — a spurious cross-level / same-name-merged edge ⇒ ignored,
    //     so a delegated output no longer gets mis-tagged 'inout' when it also appears
    //     as an inner part's port in a parent scope.
    const ownerDefOf = (nodeId: string): GraphNode | undefined => {
      let cur = nodeId;
      while (cur.includes('.')) {
        cur = cur.slice(0, cur.lastIndexOf('.'));
        const n = nodeById.get(cur);
        if (n && n.type === 'PartDefinition') return n;
      }
      return undefined;
    };
    const internalPartDefCache = new Map<string, Set<string>>();
    const internalPartDefIds = (defId: string): Set<string> => {
      let s = internalPartDefCache.get(defId);
      if (s) return s;
      s = new Set<string>();
      for (const kid of directSemanticChildren(defId, childrenOf, nodeById)) {
        if (kid.type !== 'PartUsage') continue;
        const te = typedByEdges.find(e => e.source === kid.id);
        if (te) s.add(te.target);
      }
      internalPartDefCache.set(defId, s);
      return s;
    };
    // Reverse index: type-def id → set of parent defs that own a direct part of that type.
    const parentDefsIndex = new Map<string, Set<string>>();
    for (const n of graph.nodes) {
      if (n.type !== 'PartDefinition') continue;
      for (const childDefId of internalPartDefIds(n.id)) {
        let s = parentDefsIndex.get(childDefId);
        if (!s) parentDefsIndex.set(childDefId, s = new Set());
        s.add(n.id);
      }
    }
    const shareCommonParent = (a: string, b: string): boolean => {
      const pa = parentDefsIndex.get(a); if (!pa) return false;
      const pb = parentDefsIndex.get(b); if (!pb) return false;
      for (const p of pa) if (pb.has(p)) return true;
      return false;
    };

    const portConnDir = new Map<string, string>();
    // Ports that received a delegation-classified direction — for these the flow
    // direction is authoritative (overrides a possibly-misleading declared type).
    const delegatedPorts = new Set<string>();
    const tagPortConn = (id: string, want: 'in' | 'out', delegated: boolean) => {
      if (delegated) delegatedPorts.add(id);
      const existing = portConnDir.get(id);
      if (!existing) portConnDir.set(id, want);
      else if (existing !== want) portConnDir.set(id, 'inout');
    };
    const classifyEndpoint = (self: string, other: string, selfIsSource: boolean) => {
      const dSelf = ownerDefOf(self), dOther = ownerDefOf(other);
      if (!dSelf || !dOther) return;
      if (internalPartDefIds(dSelf.id).has(dOther.id)) {
        // `other` is an internal part of `self`'s owner → `self` is a delegated boundary port.
        tagPortConn(self, selfIsSource ? 'in' : 'out', true);
      } else if (dSelf.id !== dOther.id && shareCommonParent(dSelf.id, dOther.id)) {
        // sibling parts of a common parent → plain internal wiring, no flip.
        tagPortConn(self, selfIsSource ? 'out' : 'in', false);
      }
      // otherwise: cross-level / name-merged spurious edge → ignore for this endpoint.
    };
    for (const e of graph.edges) {
      if (e.type !== 'connection' && e.type !== 'message' && e.type !== 'interconnect') continue;
      // `bind` delegation edges (id prefix `bind:`) always list the boundary port
      // first regardless of in/out, so their source/target order does NOT encode
      // data-flow direction — feeding them here would mis-tag boundary ports.
      if (e.id.startsWith('bind:')) continue;
      classifyEndpoint(e.source, e.target, true);
      classifyEndpoint(e.target, e.source, false);
    }

    // Conjugation flips port direction (SysML v2 §10.3.3.3): `~XPort` reverses
    // every directional feature of the base port def, so an `out item payload`
    // declared on XPort becomes `in item payload` on `~XPort`.  The parser
    // resolves the typedBy edge to the base PortDef (not the conjugated copy)
    // and sets `isConjugated` on the usage — we apply the flip here.
    const flipDir = (d: string): string =>
      d === 'in' ? 'out' : d === 'out' ? 'in' : d;

    // Derive port direction: explicit → typedBy item-match → name heuristic →
    // connection-edge participation. Ports in this project are often untyped,
    // so the name heuristic and connection inference are the primary resolvers.
    //
    // BOUNDARY ports get a different priority: the connection-based direction
    // is authoritative.  Some models declare `port External_X : YPort` (no
    // conjugation) even when the port semantically receives data from outside
    // the frame (e.g. External_AcceleratorPedalPowerSupplyState in the demo —
    // YPort has `out item payload`, but the connect statement routes data FROM
    // the boundary port INTO an internal part, meaning the frame-relative
    // direction is `'in'`).  Trusting typedBy in that case puts the input port
    // on the right edge and forces every wire to wrap around the diagram.
    // The connection direction reflects actual data flow through the frame,
    // so we use it first and only fall back to typedBy / name heuristic when
    // the boundary port has no connections.
    function resolvePortDir(port: GraphNode): string {
      if (port.direction) return port.direction;
      // For a delegated boundary port (of any def, not just the current scope) the
      // owner-relative flow direction is authoritative — it reflects real data flow
      // through the frame and overrides a possibly-misleading or unresolved type.
      if (scopePortIdSet.has(port.id) || delegatedPorts.has(port.id)) {
        const fromConn = portConnDir.get(port.id);
        if (fromConn) return fromConn;
      }
      // Follow typedBy edge to the PortDefinition.
      const typedEdge = typedByEdges.find(e => e.source === port.id);
      if (typedEdge) {
        const portDef = nodeById.get(typedEdge.target);
        if (portDef) {
          const defKids = directSemanticChildren(portDef.id, childrenOf, nodeById);
          let resolved = '';
          // Match by name first (unambiguous single feature case).
          const matchItem = defKids.find(
            n => n.label === port.label && n.direction,
          );
          if (matchItem?.direction) {
            resolved = matchItem.direction;
          } else {
            // Aggregate all directed features: both in+out present → inout.
            const dirFeatures = defKids.filter(n => n.direction);
            if (dirFeatures.length === 1) resolved = dirFeatures[0].direction ?? '';
            else if (dirFeatures.length > 1) {
              const dirs = new Set(dirFeatures.map(f => f.direction));
              if ((dirs.has('in') && dirs.has('out')) || dirs.has('inout')) resolved = 'inout';
              else if (dirs.has('out')) resolved = 'out';
              else if (dirs.has('in')) resolved = 'in';
            }
          }
          if (resolved) return port.isConjugated ? flipDir(resolved) : resolved;
        }
      }
      // Name heuristic on the port's own name (*In → in, *Out → out, from_*, to_*).
      const fromName = resolvePortDirection(port.label, '');
      if (fromName) return fromName;
      // Inferred from this port's role in connection edges (connected ports).
      const fromConn = portConnDir.get(port.id);
      if (fromConn) return fromConn;
      // Direction is commonly encoded in the port's TYPE name (…In / …Out), e.g.
      // `signal : HardwareSafetySignalOut`. The type def often lives in a context file
      // (so its directed features aren't loaded), and an UNCONNECTED port has no flow to
      // infer from — fall back to the type-name suffix so it keeps its arrow, not a dot.
      // Placed after connection inference, so connected ports are unaffected (no regression).
      const typeName = getTypeName(port.id) ?? featureTypeById.get(port.id) ?? '';
      const fromType = typeName ? resolvePortDirection(typeName, '') : '';
      if (fromType) return port.isConjugated ? flipDir(fromType) : fromType;
      return '';
    }

    function portDisplay(port: GraphNode): PortDisplay {
      const dir = resolvePortDir(port);
      // Display the port's declared NAME (not its type).
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

      // ── Leaf node geometry ───────────────────────────────────────────────
      // Pick height & width large enough that:
      //   (a) every port label gets a full PORT_ROW_H vertical slot, so labels
      //       on the right edge stop stacking on top of each other;
      //   (b) item / action rows inside the node still fit comfortably;
      //   (c) the right-side port column (which extends OUTSIDE the node via
      //       absolute positioning) doesn't collide with the port-def context
      //       boxes — those are pushed past the longest port label.
      const PORT_AREA_TOP = 42;
      const portsCount    = scopePorts.length;
      const portColH      = portsCount > 0 ? (portsCount + 1) * PORT_ROW_H + 16 : 0;
      const insideH       = 46
        + (scopeItems.length   > 0 ? 18 + scopeItems.length   * 13 : 0)
        + (scopeActions.length > 0 ? 18 + scopeActions.length * 13 : 0)
        + 20;
      const leafNodeH = Math.max(96, insideH, PORT_AREA_TOP + portColH);

      const maxInsideLabel = Math.max(
        scopeDef.label.length,
        ...scopeItems.map(i => i.label.length),
        ...scopeActions.map(a => a.label.length),
        0,
      );
      const leafNodeW = Math.max(260, maxInsideLabel * 7 + 56);

      const maxPortLabel = scopePorts.reduce((m, p) => Math.max(m, p.label.length), 0);
      // Port labels render outside the right edge with `right:-12; translate(100%, …)`.
      // Reserve label_width + gap before the port-def column starts.
      const portLabelW = maxPortLabel * 6.4 + 24;

      const selfNode: Node = {
        id:   selfId,
        type: 'wiringLeaf',
        position: { x: 0, y: 0 },
        data: {
          scopeName: scopeDef.label,
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
          width:        leafNodeW,
          height:       leafNodeH,
          cursor:       'pointer',
          overflow:     'visible',
          boxShadow:    isSelfSel ? `0 0 8px 2px ${PART_SEL}44` : 'none',
        },
      };

      // PortDefinition context boxes — placed past the leaf node + its outside
      // port labels so right-side port names don't overlap them.
      const PORTDEF_X = leafNodeW + portLabelW + 80;
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

      return { nodes: [selfNode, ...rfPortDefNodes], edges: [], width: 0, height: 0 };
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
          const defKids = inheritedChildren(typeDef.id);
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

    // Propagate connection-inferred direction from alias port IDs (specialization
    // copies) onto the canonical port ID — otherwise a port whose only edge
    // reference is via its non-canonical alias would still resolve to no arrow.
    for (const [alias, canonical] of canonicalPortId) {
      if (alias === canonical) continue;
      const aliasDir = portConnDir.get(alias);
      if (!aliasDir) continue;
      const canonDir = portConnDir.get(canonical);
      if (!canonDir) portConnDir.set(canonical, aliasDir);
      else if (canonDir !== aliasDir) portConnDir.set(canonical, 'inout');
    }

    function getTypeName(nodeId: string): string | null {
      const edge = typedByEdges.find(e => e.source === nodeId);
      if (!edge) return null;
      return nodeById.get(edge.target)?.label ?? null;
    }

    // A part is expandable when its type definition owns nested part usages.
    const typeDefOf = (partId: string): GraphNode | undefined => {
      const e = typedByEdges.find(x => x.source === partId);
      return e ? nodeById.get(e.target) : undefined;
    };
    const isExpandable = (partId: string): boolean => {
      const td = typeDefOf(partId);
      return !!td && inheritedChildren(td.id).some(n => n.type === 'PartUsage');
    };

    // ASIL / Realization for a part box: the PartUsage's own metadata, else its
    // typing PartDef's (so a usage shows the safety/realization of its definition).
    function getPartAsil(partId: string): string | undefined {
      const own = nodeById.get(partId)?.asil;
      if (own) return own;
      const edge = typedByEdges.find(e => e.source === partId);
      return edge ? nodeById.get(edge.target)?.asil : undefined;
    }
    function getPartRealization(partId: string): string | undefined {
      const own = nodeById.get(partId)?.realization;
      if (own) return own;
      const edge = typedByEdges.find(e => e.source === partId);
      return edge ? nodeById.get(edge.target)?.realization : undefined;
    }
    // hwSwAllocation attribute value (SysML v2 `attribute hwSwAllocation : HwSwAllocationKind
    // = HwSwAllocationKind::<kind>`). The enum value lives in a nested Membership node whose
    // label is `<EnumType>::<kind>` (FeatureValue → FeatureReferenceExpression → Membership).
    function hwSwAllocOf(ownerId: string): string | undefined {
      const attr = directSemanticChildren(ownerId, childrenOf, nodeById)
        .find(n => n.type === 'AttributeUsage' && n.label === 'hwSwAllocation');
      if (!attr) return undefined;
      const stack = [attr.id]; const seen = new Set<string>();
      while (stack.length) {
        const id = stack.pop()!; if (seen.has(id)) continue; seen.add(id);
        const lbl = nodeById.get(id)?.label;
        if (lbl && lbl.includes('::')) return lbl.slice(lbl.lastIndexOf('::') + 2);
        for (const cid of childrenOf.get(id) ?? []) stack.push(cid);
      }
      return undefined;
    }
    function getPartHwSwAlloc(partId: string): string | undefined {
      const own = hwSwAllocOf(partId);
      if (own) return own;
      const edge = typedByEdges.find(e => e.source === partId);
      return edge ? hwSwAllocOf(edge.target) : undefined;
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

    // Set of port IDs that participate in at least one in-scope connection
    // (canonical + raw alias forms). Drives the "hide unconnected ports" toggle.
    const connectedPortIds = new Set<string>();
    for (const conn of inScopeConns) {
      for (const ep of [conn.source, conn.target]) {
        connectedPortIds.add(ep);
        const canon = canonicalPortId.get(ep);
        if (canon) connectedPortIds.add(canon);
      }
    }
    // When hiding, drop unconnected squares from each part's rendered port list so
    // layout, node height, and boundary-port anchoring all use the reduced set.
    if (hideUnconnectedPorts) {
      for (const [partId, ports] of partPorts) {
        partPorts.set(partId, ports.filter(p => connectedPortIds.has(p.id)));
      }
    }

    // Nested white-box internals for each expanded part (relative-positioned children).
    // Expanded parts embed the FULL interconnect diagram of their type def, computed by
    // the same routine used for the top scope (recursive) — so an expanded part shows
    // exactly what selecting that def as the scope would render. Built AFTER connectedPortIds
    // so we can tell the child which of its boundary ports THIS scope connects to — those
    // stay visible under "hide unconnected ports" (they carry the cross-boundary wires).
    const expandedInternals = new Map<string, {
      childNodes: Node[]; childEdges: Edge[]; width: number; height: number; boundaryPortIds: Set<string>;
    }>();
    for (const part of partUsages) {
      // Keyed on the full node-id path (`${pathPrefix}wpart-<id>`) so instances of the same
      // (inherited/reused) part expand independently across sibling containers.
      if (!expandedParts.has(`${pathPrefix}wpart-${part.id}`)) continue;
      const td = typeDefOf(part.id);
      if (!td || seen.has(td.id)) continue; // guard against self-referential recursion
      const tdChildren = inheritedChildren(td.id);
      if (!tdChildren.some(n => n.type === 'PartUsage')) continue;
      // This scope's connected-port set includes (canonicalised to def-port ids) every
      // boundary port of `part` that we wire to — pass it so the child keeps them visible.
      const sub = computeInterconnect(td, new Set([...seen, scopeDef.id]), connectedPortIds, `${pathPrefix}wpart-${part.id}::`);
      if (!sub.nodes.length) continue;
      const prefix  = `wpart-${part.id}::`;
      const frameId = `wpart-${part.id}`;
      const pref = prefixDiagram(sub, prefix);
      // Drop the sub's own scope-container frame (the expanded part box replaces it) and
      // reparent the sub's top-level nodes into the part box, preserving nested parenting.
      const childNodes = pref.nodes
        .filter(n => n.id !== `${prefix}wscope-container`)
        .map(n => (n.parentId ? n : { ...n, parentId: frameId, extent: 'parent' as const }));
      const boundaryPortIds = new Set(
        tdChildren.filter(n => n.type === 'PortUsage' || n.type === 'PortDefinition').map(n => n.id));
      expandedInternals.set(part.id, { childNodes, childEdges: pref.edges, width: sub.width, height: sub.height, boundaryPortIds });
    }

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

    // Source-score per part: boundary inputs minus boundary outputs.  Parts
    // that absorb many boundary inputs (e.g. `signalConversion` taking 7 supply
    // voltages from the IBD frame) score high and should sit at rank 0 so the
    // long wires from those boundary ports stay short and straight.  This is
    // used to:
    //   • Order DFS starts so cycle-breaking back-edges fall on the right side
    //     (i.e., cycles get broken with the source-like part as the head).
    //   • Tiebreak the topological BFS so the most source-like parts are
    //     popped first within a rank.
    const boundaryIn  = new Map<string, number>();
    const boundaryOut = new Map<string, number>();
    for (const p of partUsages) { boundaryIn.set(p.id, 0); boundaryOut.set(p.id, 0); }
    for (const conn of inScopeConns) {
      const src = portOwner.get(conn.source);
      const tgt = portOwner.get(conn.target);
      if (!src || !tgt) continue;
      if (src === scopeDef.id && tgt !== scopeDef.id) {
        boundaryIn.set(tgt, (boundaryIn.get(tgt) ?? 0) + 1);
      } else if (tgt === scopeDef.id && src !== scopeDef.id) {
        boundaryOut.set(src, (boundaryOut.get(src) ?? 0) + 1);
      }
    }
    const sourceScore = (id: string) =>
      (boundaryIn.get(id) ?? 0) - (boundaryOut.get(id) ?? 0);

    // Order DFS starts by source-score (descending).  Cycle-breaking back-edges
    // depend on visit order — visiting the most source-like part first turns
    // every cycle's "back to the source" leg into the back-edge, leaving the
    // forward chain source → … intact.
    const dfsStartOrder = [...partUsages].sort(
      (a, b) => sourceScore(b.id) - sourceScore(a.id),
    );

    // Detect back-edges using iterative DFS so cycle edges can be excluded from
    // rank assignment. Back-edges point to a DFS ancestor (gray node in the stack).
    // Removing them makes the ranking graph a DAG (Sugiyama cycle-breaking step).
    const dfsColor = new Map<string, number>(partUsages.map(p => [p.id, 0])); // 0=white,1=gray,2=black
    const backEdgeSet = new Set<string>(); // "srcId:tgtId" pairs
    for (const start of dfsStartOrder) {
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
    // Among zero-indegree nodes we pop the most source-like part first; this
    // affects the order in `topo` (used later for barycenter init) without
    // changing the assigned rank values.
    const rank = new Map<string, number>(partUsages.map(p => [p.id, 0]));
    const inDeg = new Map(partUsages.map(p => [p.id, rankIn.get(p.id)!.size]));
    const topo: string[] = [];
    const bfsHead = partUsages
      .filter(p => (inDeg.get(p.id) ?? 0) === 0)
      .map(p => p.id)
      .sort((a, b) => sourceScore(b) - sourceScore(a));
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
    // node each port's handle square should appear on.  Inter-part sides are based on
    // connection topology (SysML `connect` source/target order), not port direction;
    // direction is conveyed by edge arrowheads instead, giving the layout more freedom.
    // Backward edges (source rank > target rank) flip the sides so the handle squares
    // stay on the side closest to the connected part.
    //
    // DELEGATION edges (one endpoint is a boundary port) are special: the connect order
    // doesn't encode a side (esp. `bind`, which always lists the boundary first), and
    // the only neighbour is the frame edge.  Their side is decided AFTER layout, by the
    // frame edge nearest the owning part (shortest wire) — see the delegation pass
    // below.  Here we just collect the internal endpoints.
    const portsShowLeft  = new Set<string>();
    const portsShowRight = new Set<string>();
    const delegationInternalPorts = new Set<string>();
    for (const conn of inScopeConns) {
      const srcPartId  = portOwner.get(conn.source);
      const tgtPartId  = portOwner.get(conn.target);
      // rank.get returns undefined for scopeDef.id → treated as -1 (boundary)
      const srcRankVal = srcPartId ? (rank.get(srcPartId) ?? -1) : -1;
      const tgtRankVal = tgtPartId ? (rank.get(tgtPartId) ?? -1) : -1;
      const srcCanon   = canonicalPortId.get(conn.source) ?? conn.source;
      const tgtCanon   = canonicalPortId.get(conn.target) ?? conn.target;

      const srcIsBoundary = scopePortIdSet.has(srcCanon);
      const tgtIsBoundary = scopePortIdSet.has(tgtCanon);
      if (srcIsBoundary !== tgtIsBoundary) {
        delegationInternalPorts.add(srcIsBoundary ? tgtCanon : srcCanon);
        continue;
      }

      if (srcRankVal >= 0 && tgtRankVal >= 0 && srcRankVal > tgtRankVal) {
        // Backward edge: source exits left, target enters from right
        portsShowLeft.add(srcCanon);
        portsShowRight.add(tgtCanon);
      } else {
        // Forward edge: source exits right, target enters left
        portsShowRight.add(srcCanon);
        portsShowLeft.add(tgtCanon);
      }
    }

    // Group parts by rank; within each rank seed by source-score (most input-
    // heavy first) so the subsequent barycenter pass starts from a sensible
    // ordering instead of model order, which is arbitrary.
    const byRank: string[][] = Array.from({ length: finalMaxRank + 1 }, () => []);
    const byRankSeed = [...partUsages].sort((a, b) => sourceScore(b.id) - sourceScore(a.id));
    for (const p of byRankSeed) byRank[rank.get(p.id)!].push(p.id);

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

    // Helper: rendered height for a part (header + one row per port); an expanded
    // part instead claims the height of its nested internals.
    const nodeHeightOf = (partId: string) =>
      expandedInternals.get(partId)?.height ??
      (PART_BASE_H + (partPorts.get(partId)?.length ?? 0) * PORT_ROW_H);

    // Column widths: widest node in each rank (expanded parts use their internals' width).
    const colWidth = byRank.map(ids =>
      ids.reduce((mx, id) => {
        const p = partUsages.find(q => q.id === id)!;
        return Math.max(mx, expandedInternals.get(id)?.width ?? wiringNodeWidth(p.label, getTypeName(id)));
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

    // ── Delegation port side: place on the frame edge nearest the owning part ───
    // For a port bound/connected to a boundary port, the connecting line is shortest
    // when the internal port sits on the side of its part closest to a frame edge and
    // the boundary port sits on that same edge.  Compare the gap from the part's left
    // side to the left frame (x≈0) against the gap from its right side to the right
    // frame (x=containerW); put the port on the smaller one.  This keeps every
    // delegation of a part (in OR out) together on its nearest edge — e.g. all of
    // onChipVTSupervisionDriver's bound ports — instead of splitting them by direction.
    for (const canon of delegationInternalPorts) {
      const partId = portOwner.get(canon);
      const pos    = partId ? layoutPos.get(partId) : undefined;
      if (!pos) { portsShowLeft.add(canon); continue; }
      const part = partUsages.find(q => q.id === partId);
      const w    = part ? wiringNodeWidth(part.label, getTypeName(partId!)) : PART_MIN_W;
      const distLeft  = pos.x;                      // part left → left frame edge (x≈0)
      const distRight = containerW - (pos.x + w);   // part right → right frame edge
      if (distRight < distLeft)      portsShowRight.add(canon);
      else if (distLeft < distRight) portsShowLeft.add(canon);
      else { // exact tie → fall back to direction (out → right, in/unknown → left)
        const node = nodeById.get(canon);
        if (node && resolvePortDir(node) === 'out') portsShowRight.add(canon);
        else                                        portsShowLeft.add(canon);
      }
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

    // ── Boundary-port side assignment (needed before port-ordering) ─────────────
    // Side is chosen by connection topology, NOT by direction: each delegated
    // boundary port sits on the same frame edge that the internal port it wires to
    // leaves from, so the connecting line goes straight across instead of making a
    // U-turn (e.g. an internal `out` port exiting the right side keeps its delegated
    // port on the RIGHT edge).  Direction is conveyed by the in/out arrow drawn
    // inside the square instead.  Ports with no in-scope connection fall back to
    // declared direction (in/inout → left, out → right).
    //
    // `internalOnRight` mirrors the edge-handle resolution below: when the boundary
    // is the connection source the internal endpoint is the target (right iff its
    // right square shows); when the boundary is the target the internal endpoint is
    // the source (right unless its left square shows).
    const scopePortRight = new Map<string, boolean>();
    function boundaryOnRight(sp: GraphNode): boolean {
      const cached = scopePortRight.get(sp.id);
      if (cached !== undefined) return cached;
      let rightVotes = 0, leftVotes = 0;
      for (const conn of inScopeConns) {
        const boundaryIsSource = conn.source === sp.id;
        const internalId = boundaryIsSource ? conn.target
                         : conn.target === sp.id ? conn.source : null;
        if (!internalId) continue;
        const partId = portOwner.get(internalId);
        if (!partId || partId === scopeDefIdStr) continue;
        const canon = canonicalPortId.get(internalId) ?? internalId;
        const internalOnRight = boundaryIsSource
          ? portsShowRight.has(canon)
          : !portsShowLeft.has(canon);
        if (internalOnRight) rightVotes++; else leftVotes++;
      }
      const right = (rightVotes + leftVotes === 0)
        ? resolvePortDir(sp) === 'out'
        : rightVotes >= leftVotes;
      scopePortRight.set(sp.id, right);
      return right;
    }
    // A boundary port stays visible when connected internally OR when the PARENT scope
    // wires to it (externallyConnected) — an expanded part's frame ports carry the
    // cross-boundary connections, so hiding them would orphan those wires.
    const visibleScopePorts = hideUnconnectedPorts
      ? scopePorts.filter(p => connectedPortIds.has(p.id) || externallyConnected.has(p.id))
      : scopePorts;
    const leftScopePorts  = visibleScopePorts.filter(p => !boundaryOnRight(p));
    const rightScopePorts = visibleScopePorts.filter(p =>  boundaryOnRight(p));

    // ── Port-ordering refinement: minimise connection line length ───────────────
    // Reorder each part's ports (and let the boundary ports re-anchor to them) by
    // iterated barycenter, so every port sits at the average height of whatever it
    // connects to.  This drives the vertical span of each connecting line — and in
    // particular the inner-port→boundary-port delegation lines — toward zero, while
    // also reducing crossings between parts.
    {
      const portAdj = new Map<string, string[]>();
      const addAdj = (x: string, y: string) => {
        const l = portAdj.get(x); if (l) l.push(y); else portAdj.set(x, [y]);
      };
      for (const conn of inScopeConns) {
        const a = canonicalPortId.get(conn.source) ?? conn.source;
        const b = canonicalPortId.get(conn.target) ?? conn.target;
        addAdj(a, b); addAdj(b, a);
      }
      const HALF = SCOPE_PORT_NODE_H / 2;
      for (let iter = 0; iter < 6; iter++) {
        // Boundary-port centre Ys for the current internal order.
        const boundaryY = new Map<string, number>();
        const lY = assignScopePortYs(leftScopePorts);
        leftScopePorts.forEach((p, i)  => boundaryY.set(p.id, lY[i] + HALF));
        const rY = assignScopePortYs(rightScopePorts);
        rightScopePorts.forEach((p, i) => boundaryY.set(p.id, rY[i] + HALF));
        const neighborY = (id: string): number | null =>
          scopePortIdSet.has(id) ? (boundaryY.get(id) ?? null) : internalPortAbsY(id);

        // Snapshot all barycenters before mutating any order (keeps the pass stable).
        const bary = new Map<string, number>();
        for (const part of partUsages) {
          const ports = partPorts.get(part.id) ?? [];
          ports.forEach((p, i) => {
            const ys = (portAdj.get(p.id) ?? [])
              .map(neighborY)
              .filter((y): y is number => y !== null);
            bary.set(p.id, ys.length
              ? ys.reduce((s, y) => s + y, 0) / ys.length
              : internalPortAbsY(p.id) ?? i);
          });
        }
        let changed = false;
        for (const part of partUsages) {
          const ports = partPorts.get(part.id);
          if (!ports || ports.length < 2) continue;
          const sorted = [...ports].sort((a, b) => bary.get(a.id)! - bary.get(b.id)!);
          if (sorted.some((p, i) => p.id !== ports[i].id)) {
            partPorts.set(part.id, sorted);
            changed = true;
          }
        }
        if (!changed) break;
      }
    }

    // Build the flow-name → FlowUsage lookup early so we can determine which
    // connection (and therefore which port IDs) the current selection points at,
    // before any port nodes are constructed.
    const flowNodeByLabel = new Map<string, GraphNode>();
    for (const n of graph.nodes) {
      if (FLOW_NODE_TYPES.has(n.type) && n.label !== n.type && !flowNodeByLabel.has(n.label)) {
        flowNodeByLabel.set(n.label, n);
      }
    }

    // Port IDs at the endpoints of the currently selected connection — used to
    // light up port labels at both ends when a wire is clicked.
    const selectedConnPortIds = new Set<string>();
    if (selection?.type === 'connection') {
      for (const conn of inScopeConns) {
        let flowNode = conn.label ? flowNodeByLabel.get(conn.label) : undefined;
        if (!flowNode && conn.label) {
          const colonIdx = conn.label.indexOf(' : ');
          if (colonIdx > 0) flowNode = flowNodeByLabel.get(conn.label.slice(0, colonIdx));
        }
        const isThisSel = flowNode
          ? selection?.extra?.graphId === flowNode.id || selection?.id === `wflow-${flowNode.id}`
          : selection?.id === `wconn-${conn.id}`;
        if (!isThisSel) continue;
        selectedConnPortIds.add(conn.source);
        selectedConnPortIds.add(conn.target);
        const srcCanon = canonicalPortId.get(conn.source);
        const tgtCanon = canonicalPortId.get(conn.target);
        if (srcCanon) selectedConnPortIds.add(srcCanon);
        if (tgtCanon) selectedConnPortIds.add(tgtCanon);
      }
    }

    // Part nodes — layoutVersion in dep triggers position reset when user clicks Reset
    const partRfId = (partId: string) => `wpart-${partId}`;
    const rfPartNodes: Node[] = [];
    for (const part of partUsages) {
      const typeName = getTypeName(part.id);
      const ports    = partPorts.get(part.id) ?? [];
      const nodeH    = nodeHeightOf(part.id);
      const internals = expandedInternals.get(part.id);
      const partW    = internals?.width ?? wiringNodeWidth(part.label, typeName);
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
          asil:        getPartAsil(part.id),
          realization: getPartRealization(part.id),
          hwSwAlloc:   getPartHwSwAlloc(part.id),
          expandable:    isExpandable(part.id),
          expanded:      !!internals,
          graphPartId:   part.id,
          onToggleExpand,
          // When expanded the part becomes a frame; its boundary ports are rendered as
          // embedded wsport child nodes, so the box itself shows no port handles.
          ports:    internals ? [] : ports.map(p => {
            const pd         = portDisplay(p);
            const showsLeft  = portsShowLeft.has(p.id);
            const showsRight = portsShowRight.has(p.id);
            const isPortSel = selection?.extra?.graphId === p.id
                           || (selection?.type === 'port' && selection?.name === p.label)
                           || selectedConnPortIds.has(p.id);
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
          background:     internals ? '#08160e' : PART_BG,
          border:         `1.5px solid ${isSel ? PART_SEL : PART_BORDER}`,
          borderRadius:   8,
          width:          partW,
          minHeight:      nodeH,
          height:         internals ? internals.height : undefined,
          padding:        internals ? 0 : '8px 12px',
          display:        internals ? 'block' : 'flex',
          alignItems:     'center',
          justifyContent: 'center',
          overflow:       'visible',
          boxShadow:      isSel ? `0 0 8px 2px ${PART_SEL}44` : 'none',
          cursor:         'pointer',
        },
      });
    }

    // ── IBD boundary port nodes ─────────────────────────────────────────────────
    // Port square straddles the frame edge: left-side nodes at x=0 (sqL handle
    // has `left: -9` so its center lands at the container left at x=0), right-side
    // nodes at x = containerW - SCOPE_PORT_NODE_W (sqR center at x=containerW).
    // (Side assignment — leftScopePorts/rightScopePorts — is computed above, before
    // the port-ordering pass, since both need the boundary side.)
    function makeScopePortNode(port: GraphNode, y: number, isRight: boolean): Node {
      const id  = `wsport-${port.id}`;
      const dir = resolvePortDir(port);
      const isPortSel = selection?.extra?.graphId === port.id
                     || selection?.id === id
                     || (selection?.type === 'port' && selection?.name === port.label)
                     || selectedConnPortIds.has(port.id);
      // One visible square per boundary port: left-side ports show sqL (on left boundary),
      // right-side ports show sqR (on right boundary). The hidden handle stays in the DOM
      // so React Flow can still route edges to/from it.
      const basePd = makeBoundaryPortDisplay(port.id, port.label, dir, '', dir);
      const pd: PortDisplay = {
        ...basePd,
        showLeft: !isRight,
        showRight: isRight,
        ...(isPortSel ? { labelStyle: { ...basePd.labelStyle, color: EDGE_SEL_C, fontWeight: 600 } } : {}),
      };
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

    // (flowNodeByLabel is built earlier so selectedConnPortIds can use it.)

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
    // For an expanded part, reroute its boundary-port connections from the part box to
    // the embedded boundary-port node on the part's inner frame, so the wire lands there.
    for (const [partId, emb] of expandedInternals) {
      const prefix = `wpart-${partId}::`;
      for (const [pid, rf] of [...portToRfId]) {
        if (rf !== partRfId(partId)) continue;
        const canon = canonicalPortId.get(pid) ?? pid;
        if (emb.boundaryPortIds.has(canon)) portToRfId.set(pid, `${prefix}wsport-${canon}`);
      }
    }

    // Edge spotlight: when the outer selection points at a connection, the
    // selected edge keeps its full visibility (with a colour-matched glow) and
    // every other edge fades to low opacity so the cluttered wire mesh thins out.
    const isConnectionSelected = selection?.type === 'connection';

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
        // Append the flow's ASIL level to its rendered label (SysML metadata annotation).
        const displayLabel = label && flowNode?.asil ? `${label}  ⟨${asilLabel(flowNode.asil)}⟩` : label;

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

        // Arrow orientation: the head must sit at the CONSUMER end so it points INTO
        // an input and never into an output.  For an internal port the consumer is its
        // 'in' side; for a boundary (delegated) port the role is frame-flipped — an
        // 'out' boundary port collects internal output to forward outside, so it is the
        // consumer.  This covers plain connections AND delegation binds in both
        // directions, where the parser's source/target order is otherwise arbitrary.
        const consumerEnd = (canon: string, node: GraphNode | undefined): boolean | null => {
          if (!node) return null;
          const dir = resolvePortDir(node);
          if (dir !== 'in' && dir !== 'out') return null; // inout / unknown → no decision
          return scopePortIdSet.has(canon) ? dir === 'out' : dir === 'in';
        };
        const srcConsumer = isSrcPort ? consumerEnd(srcCanon, srcNode) : null;
        const tgtConsumer = isTgtPort ? consumerEnd(tgtCanon, tgtNode) : null;
        // markerEnd sits at the target; swap so the head lands on the consumer end and
        // stays off a known producer end.
        const needsSwap =
          srcConsumer === true  ? true  :   // source consumes → head at source
          tgtConsumer === true  ? false :   // target consumes → head at target (default)
          tgtConsumer === false ? true  :   // target produces, source unknown → head at source
          srcConsumer === false ? false :   // source produces, target unknown → head at target
          false;                            // both unknown → keep declared order

        const edgeSrcRf     = needsSwap ? tgtRf    : srcRf;
        const edgeTgtRf     = needsSwap ? srcRf    : tgtRf;
        const edgeSrcCanon  = needsSwap ? tgtCanon : srcCanon;
        const edgeTgtCanon  = needsSwap ? srcCanon : tgtCanon;
        const edgeIsSrcPort = needsSwap ? isTgtPort : isSrcPort;
        const edgeIsTgtPort = needsSwap ? isSrcPort : isTgtPort;

        // Choose the handle by which side the port square is displayed on.
        //   Internal ports wire OUTWARD to a neighbouring part, so the handle is
        //   on the same side as the visible square.
        //   Boundary ports straddle a frame edge and always wire INWARD toward the
        //   interior, so their handle is on the opposite side from the frame edge
        //   they sit on (left-edge port → exits right; right-edge port → exits left).
        // Source: left side → hidden left source (-ft); right side → visible right (-out).
        // Target: right side → hidden right target (-tgt-right); left side → plain left target.
        const srcOnLeft = scopePortIdSet.has(edgeSrcCanon)
          ? (scopePortRight.get(edgeSrcCanon) ?? false)   // right-edge boundary → exits left
          : portsShowLeft.has(edgeSrcCanon);
        const tgtOnRight = scopePortIdSet.has(edgeTgtCanon)
          ? !(scopePortRight.get(edgeTgtCanon) ?? false)  // left-edge boundary → enters from right
          : portsShowRight.has(edgeTgtCanon);
        const srcHandle = edgeIsSrcPort
          ? (srcOnLeft ? `port-${edgeSrcCanon}-ft` : `port-${edgeSrcCanon}-out`)
          : undefined;
        const tgtHandle = edgeIsTgtPort
          ? (tgtOnRight ? `port-${edgeTgtCanon}-tgt-right` : `port-${edgeTgtCanon}`)
          : undefined;

        // Spotlight styling: selected edge gets a colour-matched glow filter
        // and is rendered above siblings; non-selected edges fade out so the
        // selected wire stands cleanly above the surrounding clutter.
        const isDimmed       = isConnectionSelected && !isEdgeSel;
        const spotlightStyle = isEdgeSel
          ? { filter: `drop-shadow(0 0 4px ${edgeC}) drop-shadow(0 0 10px ${edgeC})`, opacity: 1 }
          : isDimmed
          ? { opacity: 0.18 }
          : {};

        const edge: Edge & { pathOptions?: { borderRadius?: number } } = {
          id:              `wconn-${conn.id}`,
          source:          edgeSrcRf,
          target:          edgeTgtRf,
          sourceHandle:    srcHandle,
          targetHandle:    tgtHandle,
          type:            'channel',
          animated:        !isMsg && !isStructural && !isDimmed,
          label:           displayLabel,
          // Label background prevents text landing directly on port glyphs or node text.
          labelStyle:      { fill: edgeC, fontSize: 9, fontFamily: 'monospace', ...(isDimmed ? { opacity: 0.3 } : {}) },
          labelBgStyle:    { fill: '#030c06', fillOpacity: 0.95, rx: 3, ry: 3 },
          labelBgPadding:  [3, 4] as [number, number],
          style: {
            stroke:       edgeC,
            strokeWidth:  isEdgeSel ? 3 : (highlightEdge ? 2.5 : 1.5),
            ...(isMsg ? { strokeDasharray: '6 3' } : {}),
            ...spotlightStyle,
          },
          ...(isEdgeSel ? { zIndex: 1000 } : {}),
          // All connections carry an arrowhead pointing into the 'in' port.
          // Direction is conveyed by the arrow, not by port placement on left vs right.
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeC, width: 12, height: 12 },
          // Smooth rounded corners on the orthogonal bends
          pathOptions:     { borderRadius: 12 },
          data:            {
            _sel: edgeSel,
            // Port-square ids for ELK obstacle-avoiding routing (see the routing effect).
            ...(edgeIsSrcPort ? { srcPortId: edgeSrcCanon } : {}),
            ...(edgeIsTgtPort ? { tgtPortId: edgeTgtCanon } : {}),
          },
        };
        return edge;
      });

    // Assign each edge its own vertical channel between its two nodes, so parallel
    // wires never coincide. Group by unordered node pair, then spread the group's
    // edges evenly across the inter-node gap (laneFrac ∈ (0,1)). Ordering the group
    // by target Y keeps the channels monotonic, which also reduces crossings.
    {
      const groups = new Map<string, Edge[]>();
      for (const e of rfConnEdges) {
        const key = e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`;
        (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
      }
      const yOf = (rf: string) => layoutPos.get(rf.replace(/^wpart-/, ''))?.y ?? 0;
      for (const list of groups.values()) {
        if (list.length === 1) { (list[0].data as Record<string, unknown>)['laneFrac'] = 0.5; continue; }
        list.sort((a, b) => (yOf(a.target) - yOf(b.target)) || (yOf(a.source) - yOf(b.source)));
        list.forEach((e, i) => { (e.data as Record<string, unknown>)['laneFrac'] = (i + 1) / (list.length + 1); });
      }
    }

    // IBD outer frame — rendered first (lowest z-order, behind parts and ports)
    const scopeContainerNode: Node = {
      id:         'wscope-container',
      type:       'wiringScopeContainer',
      position:   { x: 0, y: 0 },
      draggable:  false,
      selectable: false,
      focusable:  false,
      data:       { scopeName: scopeDef.label },
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

    // Nested internals of expanded parts (children must follow their parent node).
    const internalChildNodes = [...expandedInternals.values()].flatMap(v => v.childNodes);
    const internalChildEdges = [...expandedInternals.values()].flatMap(v => v.childEdges);

      return {
        nodes: [scopeContainerNode, ...rfPartNodes, ...internalChildNodes, ...rfScopePortNodes],
        edges: [...rfConnEdges, ...internalChildEdges],
        width: containerW,
        height: containerH,
      };
    } // ── end computeInterconnect ──────────────────────────────────────────────

    const top = computeInterconnect(scopeDefTop);
    return { rfNodes: top.nodes, rfEdges: top.edges };
  // layoutVersion in deps forces position recomputation when user clicks Reset
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, activeScopeName, nodeById, childrenOf, selection, layoutVersion, hideUnconnectedPorts, onPortSelect, expandedParts, onToggleExpand]);

  // Apply ELK-computed part positions to the built nodes; resize the scope frame to fit.
  // Falls back to the built (custom) positions until the async ELK layout resolves.
  const positionedNodes = useMemo(() => {
    if (!elkLayout) return rfNodes;
    return rfNodes.map(n => {
      const p = elkLayout.nodePos.get(n.id);
      if (p) {
        // Re-place the part box (position is container-relative, matching React Flow's
        // parentId nesting). Move each port square to the side + offset ELK assigned it.
        // Expanded (compound) parts are resized to the ELK-computed frame that fits their
        // internals; their own ports are drawn by the embedded frame-port nodes, not here.
        const dd = n.data as Record<string, unknown>;
        const sz = elkLayout.nodeSize.get(n.id);
        const isCompound = rfNodes.some(c => c.parentId === n.id);
        const style = sz && isCompound
          ? { ...(n.style as object), width: sz.w, minHeight: sz.h, height: sz.h }
          : n.style;
        const ports = dd?.['ports'] as PortDisplay[] | undefined;
        if (ports?.length && !isCompound) {
          const newPorts = ports.map(pd => {
            const pp = elkLayout.portPos.get(`${n.id}::${pd.id}`);
            if (!pp) return pd;
            return { ...pd, elkX: pp.x, elkY: pp.y, elkSide: pp.side };
          });
          return { ...n, position: p, data: { ...dd, ports: newPorts } };
        }
        return { ...n, position: p, style, data: sz && isCompound ? { ...dd, nodeH: sz.h } : dd };
      }
      if (n.type === 'wiringScopePort') {
        // Re-place a frame boundary port (top scope or an expanded part's embedded frame)
        // at ELK's assigned face position, relative to its own container's width. The
        // square is centred vertically in the SCOPE_PORT_NODE_H-tall node, so offset by half.
        const bp = elkLayout.boundaryPos.get(n.id);
        if (bp) {
          const dd = n.data as Record<string, unknown>;
          const pd = dd?.['port'] as PortDisplay | undefined;
          const x  = bp.side === 'right' ? bp.containerW - SCOPE_PORT_NODE_W : 0;
          return {
            ...n,
            position: { x, y: bp.y - SCOPE_PORT_NODE_H / 2 },
            data: pd ? { ...dd, port: { ...pd, elkSide: bp.side } } : dd,
          };
        }
        return n;
      }
      if (n.id === 'wscope-container') {
        return { ...n, style: { ...(n.style as object), width: elkLayout.width, height: elkLayout.height } };
      }
      return n;
    });
  }, [rfNodes, elkLayout]);

  // When rfNodes changes (model reload, scope switch, selection, layout reset)
  // merge into displayNodes: preserve existing drag positions unless this is a
  // Reset Layout (layoutVersion changed).
  // Sync React Flow's controlled node list with the freshly computed layout. On an
  // explicit Reset or an expand/collapse the layout snaps to the new positions (the
  // diagram re-flows around the resized part); otherwise user drag positions are kept.
  // Uses React's "adjust state during render" pattern so the fresh positions are present
  // on the same render that remounts React Flow (via its `key`), which is required because
  // React Flow keeps an existing node's internal position and ignores changed prop values.
  const rfNodesRef = useRef(positionedNodes);
  if (layoutVersionRef.current !== layoutVersion || expandedPartsRef.current !== expandedParts) {
    layoutVersionRef.current = layoutVersion;
    expandedPartsRef.current = expandedParts;
    rfNodesRef.current       = positionedNodes;
    setDisplayNodes(positionedNodes);
  } else if (rfNodesRef.current !== positionedNodes) {
    // ELK layout arrived (or the built nodes changed): snap to the fresh positions.
    // ELK owns placement, so a prior manual drag is intentionally superseded here.
    rfNodesRef.current = positionedNodes;
    setDisplayNodes(positionedNodes);
  }

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setDisplayNodes(prev => applyNodeChanges(changes, prev));
    // Track dragged nodes so their edges follow the node (see draggedNodeIds).
    const moved = changes
      .filter((c): c is NodeChange & { id: string } => c.type === 'position' && (c as { dragging?: boolean }).dragging === true)
      .map(c => c.id);
    if (moved.length) {
      setDraggedNodeIds(prev => {
        let next = prev;
        for (const id of moved) if (!next.has(id)) { if (next === prev) next = new Set(prev); next.add(id); }
        return next;
      });
    }
  }, []);

  // ── ELK layered layout (part placement + obstacle-avoiding orthogonal routing) ─
  // Feeds ELK the part boxes with their real port squares (FIXED_POS), then applies
  // ELK's node positions + edge routes. ELK places boxes into left→right layers with
  // crossing minimisation, and routes wires around every box with segment spacing —
  // so wires never overlap and never pass through a shape. Runs when the built diagram
  // changes (scope switch, expand/collapse, port set).
  //
  // The built rfNodes/rfEdges also change reference when only the SELECTION changes (edge/
  // node highlight), but that never alters the ELK inputs. `elkSigRef` fingerprints those
  // structural inputs so a selection-only change skips the whole pass — no new layout, no
  // layoutEpoch bump, so the view is NOT remounted or re-fit just because a wire was clicked.
  const elkSigRef = useRef('');
  useEffect(() => {
    let cancelled = false;
    const partNodes     = rfNodes.filter(n => n.type === 'wiringPart');
    const boundaryNodes = rfNodes.filter(n => n.type === 'wiringScopePort');
    const boundaryIds   = new Set(boundaryNodes.map(n => n.id));

    const sizeOf = (n: Node) => {
      const st = n.style as Record<string, unknown> | undefined;
      const dd = n.data as Record<string, unknown>;
      return {
        width:  Number(st?.['width'] ?? 172),
        height: Number(dd?.['nodeH'] ?? st?.['minHeight'] ?? 96),
      };
    };
    // Port side for the ELK routing graph. Prefer the topology-based, peer-facing side
    // (portsShowLeft/Right, carried on the PortDisplay as showLeft/showRight) so an output
    // whose consumer sits to its LEFT gets its port on the left instead of wrapping a wire
    // all the way around the box (the "messed up tlfManager" case: normalizedFault → a
    // faultManager that ranks to its left). This also keeps the rendered square on the same
    // side as the handle the edge actually attaches to. Fall back to data-flow direction only
    // when there's no unambiguous peer side (unconnected/delegation/mixed-side ports).
    const partPortSide = (p: PortDisplay) => {
      if (p.showLeft && !p.showRight) return 'left' as const;
      if (p.showRight && !p.showLeft) return 'right' as const;
      return (p.direction === 'out' ? 'right' : 'left') as 'left' | 'right';
    };
    const boundarySide = (n: Node) => {
      const pd = (n.data as Record<string, unknown>)?.['port'] as PortDisplay | undefined;
      return (pd?.direction === 'out' ? 'right' : 'left') as 'left' | 'right';
    };

    // ELK port id for an endpoint: a boundary/frame port is the node itself; a part port is
    // `${partNode}::${portGraphId}`. Works at any nesting depth (node ids are already prefixed).
    const elkPortFor = (nodeId: string, portId: unknown): string | null =>
      boundaryIds.has(nodeId) ? nodeId : (portId ? `${nodeId}::${portId}` : null);
    const edgeToElk = (e: Edge): WiringElkEdge | null => {
      const d  = e.data as Record<string, unknown> | undefined;
      const sp = elkPortFor(e.source, d?.['srcPortId']);
      const tp = elkPortFor(e.target, d?.['tgtPortId']);
      return sp && tp ? { id: e.id, sourcePort: sp, targetPort: tp } : null;
    };

    // The frame chain of a node id: cumulative `wpart-…` prefixes (each ending before a `::`).
    // e.g. `wpart-a::wpart-b::wsport-c` → ['wpart-a', 'wpart-a::wpart-b'].
    const frameChain = (id: string): string[] => {
      const segs = id.split('::');
      const chain: string[] = [];
      for (let i = 1; i < segs.length; i++) chain.push(segs.slice(0, i).join('::'));
      return chain;
    };
    // The deepest expanded frame that CONTAINS both endpoints (null = the top scope). An edge
    // belongs to that container's compound so ELK routes it inside the right frame.
    const commonFrame = (a: string, b: string): string | null => {
      const ca = frameChain(a), cb = frameChain(b);
      let common: string | null = null;
      for (let i = 0; i < Math.min(ca.length, cb.length); i++) {
        if (ca[i] === cb[i]) common = ca[i]; else break;
      }
      return common;
    };
    const edgesForFrame = (frameId: string | null): WiringElkEdge[] =>
      rfEdges
        .filter(e => commonFrame(e.source, e.target) === frameId)
        .map(edgeToElk)
        .filter((e): e is WiringElkEdge => e != null);

    // Build an ELK node for a part: a leaf (its own ports) or, when expanded (it has child
    // part nodes), a compound whose ports are its embedded frame ports, children are its
    // internal parts (recursively), and childEdges are the wires internal to it.
    const buildNode = (n: Node): WiringElkNode => {
      const { width, height } = sizeOf(n);
      const kids = partNodes.filter(c => c.parentId === n.id);
      if (kids.length) {
        const embedded = boundaryNodes.filter(b => b.parentId === n.id);
        return {
          id: n.id, width, height,
          ports:      embedded.map(b => ({ id: b.id, side: boundarySide(b) })),
          children:   kids.map(buildNode),
          childEdges: edgesForFrame(n.id),
        };
      }
      const ports = ((n.data as Record<string, unknown>)?.['ports'] as PortDisplay[]) ?? [];
      return { id: n.id, width, height, ports: ports.map(p => ({ id: `${n.id}::${p.id}`, side: partPortSide(p) })) };
    };

    const topParts = partNodes.filter(n => !n.id.includes('::'));
    const elkNodes: WiringElkNode[] = topParts.map(buildNode);
    // Top scope boundary ports (frame ports); embedded ones belong to their compound part.
    const boundaryPorts: WiringElkPort[] = boundaryNodes
      .filter(n => !n.id.includes('::'))
      .map(n => ({ id: n.id, side: boundarySide(n) }));
    const elkEdges = edgesForFrame(null);

    // Skip when only selection/styling changed — same structural inputs → same layout.
    // Record the signature only AFTER a layout actually completes (below), NOT here: if this
    // effect is cancelled/re-run while the async layout is in flight, recording eagerly would
    // let the next run's guard skip it — leaving elkLayout permanently null (no ELK applied).
    const elkSig = JSON.stringify({ elkNodes, boundaryPorts, elkEdges });
    if (elkSig === elkSigRef.current) return;

    // Run ELK when there's something to lay out — ≥2 top boxes OR an expanded (compound) box —
    // and any edge anywhere in the tree. A scope whose top parts aren't wired to each other but
    // whose EXPANDED internals are (e.g. EcuPlatform's two domains) still needs ELK for those
    // internals; gating on top-level edges alone would drop them to the tangled built layout.
    const treeHasEdges = (ns: WiringElkNode[]): boolean =>
      ns.some(n => (n.childEdges?.length ?? 0) > 0 || treeHasEdges(n.children ?? []));
    const worthLayingOut = elkNodes.length >= 2 || elkNodes.some(n => (n.children?.length ?? 0) > 0);
    if (!worthLayingOut || (elkEdges.length === 0 && !treeHasEdges(elkNodes))) {
      setElkLayout(null); elkSigRef.current = elkSig; return;
    }
    layoutWiringElk(elkNodes, boundaryPorts, elkEdges).then(res => {
      if (cancelled) return;
      elkSigRef.current = elkSig;
      setElkLayout(res.nodePos.size ? res : null);
      setLayoutEpoch(e => e + 1);
    });
    return () => { cancelled = true; };
  }, [rfNodes, rfEdges]);

  // A fresh ELK layout (expand/collapse, scope switch, hide-ports, Reset) re-routes every
  // edge and supersedes manual drags, so clear the dragged set — edges resume ELK routing.
  useEffect(() => {
    setDraggedNodeIds(prev => (prev.size ? new Set() : prev));
  }, [layoutEpoch, activeScopeName]);

  // Upgrade ELK-routed connection edges to ElkEdge (orthogonal, obstacle-avoiding);
  // un-routed edges (boundary ports, message links) keep their channel routing. An edge that
  // touches a dragged node keeps its dynamic `channel` type so it follows the moved node's
  // handles instead of drawing the stale fixed ELK polyline (which would hang in mid-air).
  const routedEdges = useMemo(() => {
    if (!elkLayout || elkLayout.routes.size === 0) return rfEdges;
    // Dragging a node moves its WHOLE subtree (React Flow parent → children), so an edge must
    // follow when either endpoint IS a dragged node OR is nested inside one (id prefix). This
    // covers dragging an expanded part: its embedded boundary ports (`wpart-X::wsport-…`, the
    // targets of cross-boundary wires) and its internal parts all move with the frame.
    const draggedPrefixes = [...draggedNodeIds].map(id => `${id}::`);
    const onDragged = (nodeId: string) =>
      draggedNodeIds.has(nodeId) || draggedPrefixes.some(p => nodeId.startsWith(p));
    return rfEdges.map(e => {
      if (onDragged(e.source) || onDragged(e.target)) return e;
      const wp = elkLayout.routes.get(e.id);
      if (!wp || wp.length < 2) return e;
      return { ...e, type: 'elkEdge', data: { ...(e.data ?? {}), waypoints: wp } };
    });
  }, [rfEdges, elkLayout, draggedNodeIds]);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const s = node.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  const handleEdgeClick: EdgeMouseHandler = useCallback((_e, edge) => {
    const s = edge.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  // Pane click clears selection — also clears the edge spotlight.
  const handlePaneClick = useCallback(() => onSelect(null), [onSelect]);

  // ── Add-element (palette drag-drop → source edit) ─────────────────────────────
  const editable = !!onIncrementalEdit || !!onAddMemberToDef;

  // Scope PartDefinition + its part usages (for insert position) and the list of
  // PartDefinitions offered as the new part's type.
  const addContext = useMemo(() => {
    if (!graph || !activeScopeName) return null;
    const scopeDef = graph.nodes.find(n => n.type === 'PartDefinition' && n.label === activeScopeName);
    if (!scopeDef) return null;
    const kids       = directSemanticChildren(scopeDef.id, childrenOf, nodeById);
    const partUsages = kids.filter(n => n.type === 'PartUsage');
    const usedNames  = new Set(partUsages.map(p => p.label));
    const scopePortNames = new Set(
      kids.filter(n => n.type === 'PortUsage' || n.type === 'PortDefinition').map(n => n.label),
    );
    const partDefs   = [...new Set(
      graph.nodes.filter(n => n.type === 'PartDefinition' && n.label !== n.type).map(n => n.label),
    )].sort();
    const portDefs   = [...new Set(
      graph.nodes.filter(n => n.type === 'PortDefinition' && n.label !== n.type).map(n => n.label),
    )].sort();
    return { scopeDef, partUsages, usedNames, scopePortNames, partDefs, portDefs };
  }, [graph, activeScopeName, childrenOf, nodeById]);

  const wiringPaneRef = useRef<HTMLDivElement>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  // When set, the add-element form is shown at {x,y} within the canvas.
  // target: 'scope' → insert into the scope def (active file); { defName } → add to
  // the usage's type definition (possibly in another file).
  const [addForm, setAddForm] = useState<{
    x: number; y: number; kind: 'part' | 'port'; name: string; type: string;
    target: 'scope' | { defName: string };
  } | null>(null);
  // Transient "invalid drop target" toast.
  const [dropReject, setDropReject] = useState<{ x: number; y: number; msg: string } | null>(null);

  const onCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (!editable) return;
    if (e.dataTransfer.types.includes('application/sysml-add')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, [editable]);

  const onCanvasDrop = useCallback((e: React.DragEvent) => {
    if (!editable || !addContext) return;
    const kind = e.dataTransfer.getData('application/sysml-add');
    if (kind !== 'part' && kind !== 'port') return;
    e.preventDefault();
    const rect = wiringPaneRef.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : 40;
    const y = rect ? e.clientY - rect.top  : 40;
    const noun = kind === 'part' ? 'part' : 'port';
    const reject = (msg: string) => { setDropReject({ x, y, msg }); window.setTimeout(() => setDropReject(null), 2600); };

    // Determine the drop target from what's under the cursor.
    //   • a part usage  → add the member to that usage's TYPE DEFINITION (cross-file)
    //   • the scope frame → add to the scope PartDefinition (active file)
    //   • a boundary port / outside the frame → reject (not a valid container)
    let target: 'scope' | { defName: string } = 'scope';
    const inst = rfInstanceRef.current;
    if (inst) {
      const flow    = inst.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const hit     = inst.getIntersectingNodes({ x: flow.x, y: flow.y, width: 1, height: 1 });
      const partHit = hit.find(n => n.type === 'wiringPart');
      const portHit = hit.find(n => n.type === 'wiringScopePort');
      const onScope = hit.some(n => n.type === 'wiringScopeContainer' || n.type === 'wiringLeaf');
      if (portHit) { reject(`A ${noun} can't be added to a port.`); return; }
      if (partHit) {
        if (!onAddMemberToDef) { reject('Editing definitions is unavailable.'); return; }
        const partId = String(partHit.id).replace(/^wpart-/, '');
        const tEdge  = graph?.edges.find(ed => ed.type === 'typedBy' && ed.source === partId);
        const defN   = tEdge ? graph?.nodes.find(nd => nd.id === tEdge.target) : undefined;
        if (!defN) { reject('This part usage has no definition to add to.'); return; }
        target = { defName: defN.label };
      } else if (!onScope) {
        reject(`Drop onto a part definition to add a ${noun}.`);
        return;
      }
    }

    const isScope = target === 'scope';
    if (kind === 'part') {
      let n = 1, name = 'newPart';
      while (isScope && addContext.usedNames.has(name)) { n += 1; name = `newPart${n}`; }
      setAddForm({ x, y, kind: 'part', name, type: addContext.partDefs[0] ?? '', target });
    } else {
      let n = 1, name = 'newPort';
      while (isScope && addContext.scopePortNames.has(name)) { n += 1; name = `newPort${n}`; }
      setAddForm({ x, y, kind: 'port', name, type: addContext.portDefs[0] ?? '', target });
    }
  }, [editable, addContext, activeScopeName, graph, onAddMemberToDef]);

  const submitAdd = useCallback(() => {
    if (!addForm || !addContext) { setAddForm(null); return; }
    const name = addForm.name.trim();
    if (!name) { setAddForm(null); return; }
    if (addForm.target === 'scope') {
      if (!onIncrementalEdit || source == null) { setAddForm(null); return; }
      const edit = addForm.kind === 'part'
        ? buildAddPartEdit(source, addContext.scopeDef, addContext.partUsages, name, addForm.type || null)
        : buildAddPortEdit(source, addContext.scopeDef, name, addForm.type || null);
      if (edit) onIncrementalEdit(edit);
    } else {
      const decl = `${addForm.kind} ${name}${addForm.type ? ` : ${addForm.type}` : ''};`;
      onAddMemberToDef?.(addForm.target.defName, decl);
    }
    setAddForm(null);
  }, [addForm, addContext, onIncrementalEdit, onAddMemberToDef, source]);

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
        <button
          style={hideUnconnectedPorts
            ? { ...actionBtn, background: '#1e3a5f', borderColor: '#38bdf8', color: '#7dd3fc' }
            : actionBtn}
          title={hideUnconnectedPorts ? 'Show ports with no connection' : 'Hide ports with no connection'}
          onClick={() => setHideUnconnectedPorts(v => !v)}
        >
          {hideUnconnectedPorts ? '◎ Unconnected ports: hidden' : '◉ Unconnected ports: shown'}
        </button>

        {/* ── Palette: drag onto the canvas to add an element ──────────────── */}
        {editable && addContext && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <span style={{ color: '#475569', fontSize: 10 }}>Drag to add:</span>
            <div
              draggable
              onDragStart={e => { e.dataTransfer.setData('application/sysml-add', 'part'); e.dataTransfer.effectAllowed = 'copy'; }}
              title="Drag onto the part-def frame to add a part usage"
              style={{
                ...actionBtn, cursor: 'grab', userSelect: 'none',
                background: '#0b1e14', border: `1px solid ${PART_BORDER}`, color: PART_NAME,
              }}
            >
              «part»
            </div>
            <div
              draggable
              onDragStart={e => { e.dataTransfer.setData('application/sysml-add', 'port'); e.dataTransfer.effectAllowed = 'copy'; }}
              title="Drag onto the part-def frame to add a boundary port"
              style={{
                ...actionBtn, cursor: 'grab', userSelect: 'none',
                background: '#0a1628', border: `1px solid ${SCOPE_BDR}`, color: '#7dd3fc',
              }}
            >
              «port»
            </div>
          </div>
        )}

        <span style={{ marginLeft: 'auto', color: '#1e3a5f', fontSize: 10 }}>
          Structural wiring · part usages + connections
        </span>
      </div>

      {/* ── Wiring diagram ─────────────────────────────────────────────── */}
      {rfNodes.length > 0 ? (
        <div
          ref={wiringPaneRef}
          style={{ flex: 1, minHeight: 0, position: 'relative' }}
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}
        >
          {dropReject && (
            <div style={{
              position: 'absolute', left: Math.max(8, dropReject.x), top: Math.max(8, dropReject.y), zIndex: 100,
              background: '#3f1d1d', border: '1px solid #7f1d1d', color: '#fecaca',
              padding: '6px 10px', borderRadius: 6, fontFamily: 'monospace', fontSize: 11,
              maxWidth: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', pointerEvents: 'none',
            }}>
              ⊘ {dropReject.msg}
            </div>
          )}
          {addForm && addContext && (
            <div
              style={{
                position: 'absolute', left: Math.max(8, addForm.x), top: Math.max(8, addForm.y), zIndex: 100,
                background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
                padding: 10, width: 240, fontFamily: 'monospace', fontSize: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 8,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ color: '#bbf7d0', fontWeight: 600 }}>
                Add {addForm.kind}
                {' → '}
                <span style={{ color: '#7dd3fc' }}>
                  {addForm.target === 'scope' ? activeScopeName : addForm.target.defName}
                </span>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, color: '#94a3b8' }}>
                Name
                <input
                  autoFocus
                  value={addForm.name}
                  onChange={e => setAddForm(f => f && { ...f, name: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') setAddForm(null); }}
                  style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 3, padding: '3px 6px', fontFamily: 'monospace', fontSize: 12 }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, color: '#94a3b8' }}>
                Type
                <select
                  value={addForm.type}
                  onChange={e => setAddForm(f => f && { ...f, type: e.target.value })}
                  style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 3, padding: '3px 6px', fontFamily: 'monospace', fontSize: 12 }}
                >
                  <option value="">(untyped)</option>
                  {(addForm.kind === 'part' ? addContext.partDefs : addContext.portDefs).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button style={actionBtn} onClick={() => setAddForm(null)}>Cancel</button>
                <button
                  style={{ ...actionBtn, background: '#14532d', borderColor: PART_BORDER, color: '#bbf7d0' }}
                  onClick={submitAdd}
                >
                  Add
                </button>
              </div>
            </div>
          )}
          <ReactFlow
            // Remount when the set of expanded parts changes: ReactFlow keeps an existing
            // node's internal position and ignores a changed prop position, so a fresh mount
            // is what re-places every part around the resized (expanded) part and re-fits.
            key={([...expandedParts].sort().join('|') || 'none') + `#${layoutEpoch}`}
            nodes={displayNodes.length > 0 ? displayNodes : positionedNodes}
            edges={routedEdges}
            nodeTypes={WIRING_NODE_TYPES}
            edgeTypes={WIRING_EDGE_TYPES}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={handlePaneClick}
            onNodesChange={handleNodesChange}
            onInit={inst => { rfInstanceRef.current = inst; }}
            fitView
            // Allow zooming far out so a deeply-expanded diagram fits and stays pannable —
            // the default minZoom (0.5) clamps both manual zoom-out and the fit.
            minZoom={0.05}
            fitViewOptions={{ padding: 0.3, minZoom: 0.05 }}
            nodesConnectable={false}
          >
            <Background color="#1a2a3a" gap={24} />
            <Controls showFitView={false} />
            <FitPanel padding={0.3} autoFitVersion={layoutEpoch} onReset={() => setLayoutVersion(v => v + 1)} />
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
