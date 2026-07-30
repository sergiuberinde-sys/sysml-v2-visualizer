import { useMemo, useCallback, useState, useEffect, createContext, useContext } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  ReactFlow, Background, Controls, Panel, MarkerType,
  BaseEdge, getSmoothStepPath,
  Handle, Position, applyNodeChanges,
  type Node, type Edge, type EdgeProps, type NodeChange, type NodeProps,
} from '@xyflow/react';
import { PortHandles, makeBoundaryPortDisplay, type PortDisplay } from '../layout/PortHandles';
import { fitNodeWidth, type TextRow } from '../layout/nodeSize';
import '@xyflow/react/dist/style.css';
import type { VisualizerModel, VizNode } from '../../core/visualizerModel';
import type { SelectionState } from '../../app/selection';
import type { ContainmentGraph } from '../../core/sysmlv2Official/ContainmentGraph';
import { buildChildrenMap, directSemanticChildren } from '../../core/sysmlv2Official/graphHelpers';
import { FitPanel } from '../layout/FitPanel';
import { ElkEdge, roundedPolyline } from '../layout/ElkEdge';
import { applyHierarchicalLayout, routeEdgesOrthogonal } from '../layout/graphLayout';

// ── Layout direction context (consumed by custom node type) ───────────────────

const LayoutDirCtx = createContext<'lr' | 'tb'>('lr');

// ── Layout constants ──────────────────────────────────────────────────────────

const MIN_NODE_W   = 148;
const H_PAD_NODE   = 20;  // 2 × 10 px horizontal padding from 'padding: 6px 10px'
const PART_BASE_H  = 48;
const PORT_TOP     = 6;
const PORT_ROW_H   = 18;
const INST_V_GAP   = 14;   // vertical gap between consecutive instances in col3

function partH(portCount: number, attrCount = 0) {
  const itemCount = portCount + attrCount;
  return PART_BASE_H + (itemCount > 0 ? PORT_TOP + itemCount * PORT_ROW_H : 0);
}

// ── Colour palettes ───────────────────────────────────────────────────────────

interface Palette { bg: string; border: string; name: string; stereo: string; sep: string; port: string }

const PAL: Record<string, Palette> = {
  iface:   { bg: '#1b0a30', border: '#a855f7', name: '#e9d5ff', stereo: '#c084fc', sep: '#7e22ce', port: '#d8b4fe' },
  portDef: { bg: '#0d0d24', border: '#6366f1', name: '#c7d2fe', stereo: '#818cf8', sep: '#4338ca', port: '#a5b4fc' },
  type:    { bg: '#0f2644', border: '#3b82f6', name: '#bfdbfe', stereo: '#60a5fa', sep: '#1d4ed8', port: '#93c5fd' },
  item:    { bg: '#1c1000', border: '#d97706', name: '#fde68a', stereo: '#fbbf24', sep: '#b45309', port: '#fcd34d' },
  attr:    { bg: '#071a1a', border: '#06b6d4', name: '#a5f3fc', stereo: '#22d3ee', sep: '#0e7490', port: '#67e8f9' },
  actDef:  { bg: '#0e1a00', border: '#84cc16', name: '#ecfccb', stereo: '#a3e635', sep: '#4d7c0f', port: '#d9f99d' },
  inst:    { bg: '#0a2218', border: '#22c55e', name: '#86efac', stereo: '#4ade80', sep: '#15803d', port: '#6ee7b7' },
  occ:     { bg: '#0d2e1a', border: '#22c55e', name: '#bbf7d0', stereo: '#4ade80', sep: '#15803d', port: '#86efac' },
  scen:    { bg: '#2a1200', border: '#f97316', name: '#fed7aa', stereo: '#fb923c', sep: '#c2410c', port: '#fdba74' },
};

// ── Custom edge types (SysML v2 spec §8.2.3.6) ───────────────────────────────
//
// Markers are rendered INSIDE ReactFlow's SVG via custom edge components.
// url(#id) only resolves within the same <svg> in Chrome, so each edge
// component writes its own <defs> block; unique ids prevent conflicts.
//
// Spec-decoded geometry (vector path analysis from PDF):
//   FeatureTyping / Subclassification / Subsetting:
//     solid line + hollow closed triangle (3-segment, ~11pt × 5.4pt, no fill)
//   Composite-feature-membership (Composition):
//     solid line + filled black diamond (~11pt × 6pt) at OWNER (source) end
//   Connection (ConnectionUsage):
//     plain solid line, small open arrowhead

const FT_STROKE   = '#64748b';   // FeatureTyping / subclassification / subsetting
const COMP_STROKE = '#94a3b8';   // Composition — filled diamond at owner end

type WayPt = { x: number; y: number };

/** Build an orthogonal polyline from ELK waypoints, or fall back to smoothstep. */
/**
 * Build an edge path from ELK waypoints or fall back to smoothstep.
 *
 * useHandleEndpoints — when TRUE the React Flow handle position is prepended /
 *   appended to the waypoint list.  Use this for edges whose source handle is
 *   a PORT-SPECIFIC handle (port-X-ft, port-X-ft-right) because those handles
 *   sit at a unique y-position per port, so including them naturally spreads
 *   the edges apart from their first segment.
 *   Set FALSE (default) for edges that share a GENERIC handle (__source,
 *   __source_left …) — for those, the handle center is identical for all
 *   edges on the node and including it would collapse ELK's spread back to one
 *   pixel.  Instead we use ELK's attachment points directly.
 */
function elkOrSmoothPath(
  sourceX: number, sourceY: number, sourcePosition: import('@xyflow/react').Position,
  targetX: number, targetY: number, targetPosition: import('@xyflow/react').Position,
  waypoints: WayPt[] | undefined,
  useHandleEndpoints = false,
): string {
  if (waypoints && waypoints.length >= 2) {
    const pts: WayPt[] = useHandleEndpoints
      ? [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }]
      : waypoints;
    return roundedPolyline(pts);
  }
  const [p] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 4 });
  return p;
}

function FeatureTypingEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps) {
  const d           = data as Record<string, unknown>;
  const waypoints   = d?.waypoints as WayPt[] | undefined;
  const highlighted = !!d?.highlighted;
  const baseStroke  = (d?.stroke as string | undefined) ?? FT_STROKE;
  const stroke      = highlighted ? SEL_BORDER : baseStroke;
  const strokeWidth = highlighted ? 2.5 : 1;
  // Always use pure ELK attachment points — ELK spreads every edge on a node face
  // independently, so the endpoint for this edge never coincides with the endpoint
  // of another edge (e.g. a composition edge leaving the same portDef face).
  const edgePath    = elkOrSmoothPath(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, waypoints, false);
  const mid = `sysml-ft-${id}`;
  return (
    <g>
      <defs>
        {/* SysML v2 §8.2.3.6: hollow closed triangle at the type/definition end. */}
        <marker id={mid} viewBox="0 0 14 12" refX="13" refY="6"
          markerWidth="14" markerHeight="12" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0,1 L 13,6 L 0,11 Z"
            fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round"/>
        </marker>
      </defs>
      <BaseEdge id={id} path={edgePath}
        style={{ stroke, strokeWidth }}
        markerEnd={`url(#${mid})`}
      />
    </g>
  );
}

function CompositionEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps) {
  const waypoints   = (data as Record<string, unknown>)?.waypoints as WayPt[] | undefined;
  const highlighted = !!(data as Record<string, unknown>)?.highlighted;
  const stroke      = highlighted ? SEL_BORDER : COMP_STROKE;
  const strokeWidth = highlighted ? 2.5 : 1;
  const edgePath    = elkOrSmoothPath(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, waypoints);
  const mid = `sysml-comp-${id}`;
  return (
    <g>
      <defs>
        {/* SysML v2 §8.2.3.3: filled diamond = composite-feature-membership, owner (source) end.
            refX="0" anchors the inner (left) tip at the path start so the diamond sits
            fully outside the source node.  The filled interior covers the edge line
            beneath it, so no overlap artefact is visible. */}
        <marker id={mid} viewBox="0 0 16 12" refX="0" refY="6"
          markerWidth="16" markerHeight="12" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0,6 L 8,1.5 L 16,6 L 8,10.5 Z"
            fill={stroke} stroke={stroke} strokeWidth="0.5" strokeLinejoin="round"/>
        </marker>
      </defs>
      <BaseEdge id={id} path={edgePath}
        style={{ stroke, strokeWidth }}
        markerStart={`url(#${mid})`}
      />
    </g>
  );
}

function NonCompositeMembershipEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps) {
  const waypoints   = (data as Record<string, unknown>)?.waypoints as WayPt[] | undefined;
  const highlighted = !!(data as Record<string, unknown>)?.highlighted;
  const stroke      = highlighted ? SEL_BORDER : COMP_STROKE;
  const strokeWidth = highlighted ? 2.5 : 1;
  const edgePath    = elkOrSmoothPath(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, waypoints);
  const mid = `sysml-ncm-${id}`;
  return (
    <g>
      <defs>
        {/* SysML v2 §8.2.3.3: open/hollow diamond = non-composite-feature-membership, owner (source) end.
            refX="0" anchors the inner tip at the path start (outside the node).
            Two layers: dark background rect masks the edge line that would otherwise
            show through the hollow interior; then the stroke-only diamond on top. */}
        <marker id={mid} viewBox="-1 0 18 12" refX="0" refY="6"
          markerWidth="18" markerHeight="12" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0,6 L 8,1.5 L 16,6 L 8,10.5 Z" fill="#0b1220" stroke="none"/>
          <path d="M 0,6 L 8,1.5 L 16,6 L 8,10.5 Z"
            fill="none" stroke={stroke} strokeWidth="1" strokeLinejoin="round"/>
        </marker>
      </defs>
      <BaseEdge id={id} path={edgePath}
        style={{ stroke, strokeWidth }}
        markerStart={`url(#${mid})`}
      />
    </g>
  );
}

// ── Legend panel ──────────────────────────────────────────────────────────────

function StructureLegend() {
  return (
    <div style={{
      background: 'rgba(15,17,26,0.88)', border: '1px solid #1e2535',
      borderRadius: 6, padding: '7px 11px', display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.5px', marginBottom: 1 }}>NOTATION</div>

      {/* FeatureTyping: solid line + hollow closed triangle (spec §8.2.3.6) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
        <svg width="36" height="12" style={{ flexShrink: 0, overflow: 'visible' }}>
          <line x1="2" y1="6" x2="22" y2="6" stroke={FT_STROKE} strokeWidth="1.2" />
          <path d="M 22,2 L 34,6 L 22,10 Z" fill="none" stroke={FT_STROKE} strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        <span>FeatureTyping  (usage → type)</span>
      </div>

      {/* Connection: solid line + small open arrowhead */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
        <svg width="36" height="12" style={{ flexShrink: 0, overflow: 'visible' }}>
          <line x1="2" y1="6" x2="26" y2="6" stroke="#4ade80" strokeWidth="1.2" />
          <polyline points="26,3 34,6 26,9" fill="none" stroke="#4ade80" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        <span>ConnectionUsage</span>
      </div>

      {/* Composite feature membership: filled diamond at owner end (§8.2.3.3) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
        <svg width="36" height="12" style={{ flexShrink: 0, overflow: 'visible' }}>
          <polygon points="2,6 9,3 16,6 9,9" fill={COMP_STROKE} />
          <line x1="16" y1="6" x2="34" y2="6" stroke={COMP_STROKE} strokeWidth="1.2" />
        </svg>
        <span>Composite feature membership  (◆)</span>
      </div>

      {/* Non-composite feature membership: open diamond at owner end (§8.2.3.3) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
        <svg width="36" height="12" style={{ flexShrink: 0, overflow: 'visible' }}>
          <polygon points="2,6 9,3 16,6 9,9" fill="none" stroke={COMP_STROKE} strokeWidth="1" />
          <line x1="16" y1="6" x2="34" y2="6" stroke={COMP_STROKE} strokeWidth="1.2" />
        </svg>
        <span>Non-composite feature membership  (◇)</span>
      </div>
    </div>
  );
}

// ── Node label renderer ───────────────────────────────────────────────────────

type PortLike = Extract<VizNode, { kind: 'port' }>;
type AttrUsageLike = Extract<VizNode, { kind: 'attributeUsage' }>;

// partLabel renders the header + separator + attribute rows.
// Port rows are intentionally omitted — they are rendered by PortHandles as
// absolutely-positioned boundary labels so they align with the handle squares.
function partLabel(stereotype: string, name: string, _ports: PortLike[], p: Palette, attrs: AttrUsageLike[] = []) {
  const hasItems = attrs.length > 0;
  return (
    <div style={{ lineHeight: 1.4 }}>
      <div style={{ textAlign: 'center', paddingBottom: hasItems ? 2 : 0 }}>
        <div style={{ fontSize: 9.5, color: p.stereo, letterSpacing: '0.35px' }}>{stereotype}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: p.name }}>{name}</div>
      </div>
      {hasItems && (
        <div style={{ height: 1, background: p.sep, margin: '2px -10px 4px', opacity: 0.4 }} />
      )}
      {attrs.map((a, i) => (
        <div key={`a${i}`} style={{ fontSize: 10, color: p.port, display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ fontSize: 8, opacity: 0.7 }}>◆</span>
          <span>{a.name}</span>
          {a.type && <span style={{ opacity: 0.45, fontSize: 9.5 }}>: {a.type}</span>}
        </div>
      ))}
    </div>
  );
}

/** Compute content-aware node width from visible text rows. */
function nodeWidth(stereotype: string, name: string, attrs: AttrUsageLike[], forceWidth?: number): number {
  if (forceWidth !== undefined) return forceWidth;
  const rows: TextRow[] = [
    { text: stereotype,  font: '9.5px sans-serif' },
    { text: name || stereotype, font: '600 13px sans-serif' },
    ...attrs.map(a => ({
      text: a.name + (a.type ? ': ' + a.type : ''),
      font: '10px sans-serif',
    } as TextRow)),
  ];
  return fitNodeWidth(rows, H_PAD_NODE, MIN_NODE_W);
}

// shape: 'definition' = square corners (official SysML v2 notation for defs)
//        'usage'      = rounded corners (official SysML v2 notation for usages)
function makePartNode(
  id: string,
  pos: { x: number; y: number },
  stereotype: string,
  name: string,
  ports: PortLike[],
  p: Palette,
  extra?: Partial<Node>,
  sel?: SelectionState,
  attrs: AttrUsageLike[] = [],
  forceWidth?: number,
  shape: 'definition' | 'usage' = 'definition',
): Node {
  const w = nodeWidth(stereotype, name, attrs, forceWidth);
  const h = (ports.length > 0 || attrs.length > 0) ? partH(ports.length, attrs.length) : PART_BASE_H;
  const radius = shape === 'usage' ? 12 : 0;
  return {
    id,
    type: 'sysmlPart',
    position: pos,
    data: {
      label: partLabel(stereotype, name, ports, p, attrs),
      ports,
      attrs,
      nodeH: h,
      palette: p,
      _sel: sel ?? null,
    },
    style: {
      background: p.bg, border: `1px solid ${p.border}`,
      borderRadius: radius, padding: '6px 10px', width: w, height: h,
      overflow: 'visible',
    },
    ...extra,
  };
}

// ── Custom node type with port handles ────────────────────────────────────────

function SysmlPartNode({ data }: NodeProps) {
  const dir    = useContext(LayoutDirCtx);
  const isLR   = dir !== 'tb';
  const ports  = (data['ports']  as PortLike[]) ?? [];
  const nodeH  = (data['nodeH']  as number)     ?? PART_BASE_H;

  const sourcePos = isLR ? Position.Right  : Position.Bottom;
  const targetPos = isLR ? Position.Left   : Position.Top;

  const portDisplays: PortDisplay[] = ports.map(p =>
    makeBoundaryPortDisplay(p.name, p.name, p.direction, p.portType ?? '', p.direction)
  );

  return (
    <>
      {/* Primary handles (right=source, left=target for LR layout) */}
      <Handle type="target" position={targetPos}      id="__target"       style={{ opacity: 0 }} />
      <Handle type="source" position={sourcePos}      id="__source"       style={{ opacity: 0 }} />
      {/* Reverse handles for right-to-left "types" edges between columns */}
      <Handle type="source" position={Position.Left}  id="__source_left"  style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right} id="__target_right" style={{ opacity: 0 }} />

      {/* Per-port boundary squares + aligned labels */}
      <PortHandles
        ports={portDisplays}
        isLR={isLR}
        sourcePos={sourcePos}
        targetPos={targetPos}
        nodeH={nodeH}
        portAreaTop={PART_BASE_H}
      />

      {/* Node content (header + attrs only; port rows removed) */}
      {data['label'] as React.ReactNode}
    </>
  );
}

// ── Column layout constants ───────────────────────────────────────────────────

const COL_H_GAP   = 280;  // horizontal gap between the three columns (routing corridor)
const V_STACK_GAP = 24;   // vertical gap between nodes within a column
const COL_START   = 60;   // left edge of column 1


// ── Selection highlight colours ───────────────────────────────────────────────

const SEL_BORDER = '#89b4fa';
const SEL_GLOW   = '0 0 10px 2px #89b4fa33';




// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  result: VisualizerModel;
  graph?: ContainmentGraph;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
  onShapeContextMenu?: (e: React.MouseEvent, sel: SelectionState) => void;
}

// Definition types that map to top-level nodes in the General View.
const TOP_DEF_TYPES = new Set([
  'PortDefinition', 'ActionDefinition', 'BehaviorDefinition', 'PartDefinition',
  'ItemDefinition', 'AttributeDefinition', 'InterfaceDefinition',
  'ConnectionDefinition', 'RequirementDefinition', 'StateDefinition',
  'AllocationDefinition', 'UseCaseDefinition', 'ViewDefinition',
]);

/** Walk the graph to find the outermost (largest-range) definition containing `line`. */
function findTopLevelDefInGraph(line: number, graph: ContainmentGraph): string | null {
  const candidates = graph.nodes.filter(n =>
    TOP_DEF_TYPES.has(n.type) &&
    n.label !== n.type &&
    n.startLine != null && n.endLine != null &&
    n.startLine <= line && line <= n.endLine!,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) =>
    ((b.endLine ?? 0) - (b.startLine ?? 0)) - ((a.endLine ?? 0) - (a.startLine ?? 0)),
  );
  return candidates[0].id;
}

export default function StructureView({ result, graph, selection, onSelect, onShapeContextMenu }: Props) {
  const [displayNodes,   setDisplayNodes]   = useState<Node[]>([]);
  const [displayEdges,   setDisplayEdges]   = useState<Edge[]>([]);
  const [autoFitVersion, setAutoFitVersion] = useState(0);
  const [focusedNodeId,  setFocusedNodeId]  = useState<string | null>(null);
  const [resetVersion,   setResetVersion]   = useState(0);

  // nodeTypes / edgeTypes are stable references
  const nodeTypes = useMemo(() => ({ sysmlPart: SysmlPartNode }), []);
  const edgeTypes = useMemo(() => ({
    elkEdge: ElkEdge,
    featureTypingEdge: FeatureTypingEdge,
    compositionEdge: CompositionEdge,
    nonCompositeMembershipEdge: NonCompositeMembershipEdge,
  }), []);

  // ── Pass 1: manual layout (recomputes when model changes) ─────────────────
  const { baseNodes, baseEdges, graphIdToRfId, nestedNodes, nestedEdges } = useMemo(() => {
    const baseNodes: Node[] = [];
    const baseEdges: Edge[] = [];

    // Build a lookup: "EMFType:label" → graph node id, for embedding graphId in selections.
    // Prefer nodes with source ranges so the extension can reveal them.
    const graphLookup = new Map<string, string>();
    if (graph) {
      for (const n of graph.nodes) {
        const key = `${n.type}:${n.label}`;
        const existing = graphLookup.get(key);
        if (!existing || (n.startLine != null && n.startLine > 0)) {
          graphLookup.set(key, n.id);
        }
      }
    }
    function gid(...emfTypes: string[]): (name: string) => string | undefined {
      return (name: string) => {
        for (const t of emfTypes) {
          const id = graphLookup.get(`${t}:${name}`);
          if (id !== undefined) return id;
        }
        return undefined;
      };
    }

    // Graph utilities for port lookup and relationship edges (official mode).
    const nodeById  = graph ? new Map(graph.nodes.map(n => [n.id, n])) : null;
    const childrenOf = graph ? buildChildrenMap(graph.nodes) : null;

    // Returns PortUsage children of a graph node as PortLike objects for rendering.
    // When the node has no direct PortUsage children (e.g. a PartUsage that inherits
    // ports from its type definition), follows the typedBy edge to the type definition
    // and collects ports from there.
    function getGraphNodePorts(graphId: string): import('../../core/sysmlv2Official/ContainmentGraph').GraphNode[] {
      if (!nodeById || !childrenOf) return [];
      let ports = directSemanticChildren(graphId, childrenOf, nodeById)
        .filter(n => n.type === 'PortUsage' || n.type === 'PortDefinition');
      if (ports.length === 0 && graph) {
        const typedByEdge = graph.edges.find(e => e.type === 'typedBy' && e.source === graphId);
        if (typedByEdge) {
          const typeDef = nodeById.get(typedByEdge.target);
          if (typeDef) {
            ports = directSemanticChildren(typeDef.id, childrenOf, nodeById)
              .filter(n => n.type === 'PortUsage' || n.type === 'PortDefinition');
          }
        }
      }
      return ports;
    }

    function getGraphPorts(graphId: string | undefined): PortLike[] {
      if (!graphId) return [];
      return getGraphNodePorts(graphId).map(p => {
        const rawDir = p.direction;
        const direction: 'in' | 'out' | 'inout' | '' =
          (rawDir === 'in' || rawDir === 'out' || rawDir === 'inout') ? rawDir : '';
        return {
          kind:      'port' as const,
          direction,
          name:      p.label,
          portType:  '',
          line:      p.startLine ?? 0,
        };
      });
    }

    // Reverse map: graphId → rfNodeId (built as we create each section's nodes).
    // Used to render relationship edges from ContainmentGraph at the end.
    const graphIdToRfId = new Map<string, string>();
    function regGid(graphIdVal: string | undefined, rfId: string) {
      if (graphIdVal) graphIdToRfId.set(graphIdVal, rfId);
    }

    type PD   = Extract<VizNode, { kind: 'partDef' }>;
    type PU   = Extract<VizNode, { kind: 'partUsage' }>;
    type AD   = Extract<VizNode, { kind: 'attributeDef' }>;
    type AU   = Extract<VizNode, { kind: 'attributeUsage' }>;
    type OD   = Extract<VizNode, { kind: 'occurrenceDef' }>;
    type PA   = Extract<VizNode, { kind: 'partAlias' }>;
    type IA   = Extract<VizNode, { kind: 'itemAlias' }>;
    type CN   = Extract<VizNode, { kind: 'connection' }>;
    type ID   = Extract<VizNode, { kind: 'interfaceDef' }>;
    type PRD  = Extract<VizNode, { kind: 'portDef' }>;
    type ITMD = Extract<VizNode, { kind: 'itemDef' }>;
    type BD   = Extract<VizNode, { kind: 'behaviorDef' }>;
    type AI   = Extract<VizNode, { kind: 'actionInst' }>;
    type ACTD = Extract<VizNode, { kind: 'actionDef' }>;

    // Depict only elements declared in the open file. `fromPrimary === false` marks
    // context-file elements — excluded from the rendered lists but still reachable via
    // the full-set lookup maps below so cross-file types resolve.
    const isPrimary = (n: VizNode) => n.fromPrimary !== false;
    const ifaceDefs       = result.nodes.filter((n): n is ID   => n.kind === 'interfaceDef').filter(isPrimary);
    const portDefs        = result.nodes.filter((n): n is PRD  => n.kind === 'portDef').filter(isPrimary);
    const attrDefs        = result.nodes.filter((n): n is AD   => n.kind === 'attributeDef').filter(isPrimary);
    const itemDefs        = result.nodes.filter((n): n is ITMD => n.kind === 'itemDef').filter(isPrimary);
    const behaviorDefs    = result.nodes.filter((n): n is BD   => n.kind === 'behaviorDef').filter(isPrimary);
    const simpleActDefs   = result.nodes.filter((n): n is ACTD => n.kind === 'actionDef').filter(isPrimary);
    const allPartDefs     = result.nodes.filter((n): n is PD   => n.kind === 'partDef').filter(isPrimary);
    const allPartUsages   = result.nodes.filter((n): n is PU   => n.kind === 'partUsage').filter(isPrimary);
    // Full-set type-resolution lookups (include context defs so a primary part typed by
    // a def in another file still resolves its contents).
    const partDefMap      = new Map(result.nodes.filter((n): n is PD   => n.kind === 'partDef').map(n => [n.name, n]));
    const itemDefMap      = new Map(result.nodes.filter((n): n is ITMD => n.kind === 'itemDef').map(n => [n.name, n]));
    // A body child triggers composition rendering when it is a partAlias/itemAlias
    // with a non-empty type. The type does NOT need to be defined in the same file —
    // cross-file typed parts are shown as instance nodes without a local type-def box.
    const isCompAlias  = (b: VizNode) =>
      (b.kind === 'partAlias' && !!b.type) ||
      (b.kind === 'itemAlias' && !!b.type);
    const hasActionInst = (b: VizNode): b is AI => b.kind === 'actionInst';
    // composedDefs: partDefs that own child instances/items → rendered in col2 with
    // composition edges to flat instance/item nodes in col3.
    const composedDefs = allPartDefs.filter(n => n.body.some(isCompAlias));
    // partDefs with only action-usage children (no part/item aliases) — get action boxes in col3.
    const actionOnlyDefs = allPartDefs.filter(n => !n.body.some(isCompAlias) && n.body.some(hasActionInst));

    // Split partUsages: composed (contain child partAlias/itemAlias) vs standalone.
    const composedUsages   = allPartUsages.filter(n =>  n.body.some(isCompAlias));
    const standaloneUsages = allPartUsages.filter(n => !n.body.some(isCompAlias));

    const allOccs           = result.nodes.filter((n): n is OD => n.kind === 'occurrenceDef').filter(isPrimary);
    const legacyStructOccs  = allOccs.filter(o => o.body.some(b => b.kind === 'partAlias' || b.kind === 'itemAlias'));
    const scenarios         = allOccs.filter(o => !o.body.some(b => b.kind === 'partAlias' || b.kind === 'itemAlias'));

    // ── Pre-compute column X positions ────────────────────────────────────────
    // Column 1 (left):   port defs + interface defs + standalone part usages
    // Column 2 (middle): ALL part defs + attr defs + item defs + behavior defs
    // Column 3 (right):  composed usages + flat instances + occurrence defs
    // Standalone usages go in col1 so their FeatureTyping edges arrive at the LEFT
    // face of col2 defs, while composition edges leave from the RIGHT face — opposite
    // faces ensure clear visual separation.
    const col1MaxW = Math.max(MIN_NODE_W,
      ...ifaceDefs.map(n => nodeWidth('«interface def»', n.name, [])),
      ...portDefs.map(n  => nodeWidth('«port def»',       n.name, [])),
      ...standaloneUsages.map(n => nodeWidth(n.type ? `«part» : ${n.type}` : '«part»', n.name, [])),
    );
    const col2MaxW = Math.max(MIN_NODE_W,
      ...attrDefs.map(n => {
        const a = n.body.filter((b): b is AU => b.kind === 'attributeUsage');
        return nodeWidth('«attribute def»', n.name, a);
      }),
      ...allPartDefs.map(n => {
        const a = n.body.filter((b): b is AU => b.kind === 'attributeUsage');
        return nodeWidth('«part def»', n.name, a);
      }),
      ...itemDefs.map(n  => nodeWidth('«item def»',   n.name, [])),
      ...behaviorDefs.map(n   => nodeWidth('«action def»', n.name, [])),
      ...simpleActDefs.map(n  => nodeWidth('«action def»', n.name, [])),
    );
    // col3 contains composed-usage nodes, all flat instance nodes, and occurrence/scenario nodes.
    const col3MaxW = Math.max(MIN_NODE_W,
      ...composedUsages.map(n   => nodeWidth(n.type ? `«part» : ${n.type}` : '«part»', n.name, [])),
      ...[...allPartDefs, ...composedUsages].flatMap(n => [
        ...n.body.filter((b): b is PA => b.kind === 'partAlias').map(alias =>
          Math.max(nodeWidth(alias.type ? `«part» : ${alias.type}` : '«part»', alias.name, []), MIN_NODE_W)
        ),
        ...n.body.filter((b): b is IA => b.kind === 'itemAlias').map(alias =>
          Math.max(nodeWidth(alias.type ? `«item» : ${alias.type}` : '«item»', alias.name, []), MIN_NODE_W)
        ),
      ]),
      ...portDefs.flatMap(n => (n.body ?? []).filter((b): b is IA => b.kind === 'itemAlias').map(alias =>
        Math.max(nodeWidth(alias.type ? `«item» : ${alias.type}` : '«item»', alias.name, []), MIN_NODE_W)
      )),
      ...behaviorDefs.flatMap(n => n.body.filter((b): b is IA => b.kind === 'itemAlias').map(alias =>
        Math.max(nodeWidth(alias.type ? `«item» : ${alias.type}` : '«item»', alias.name, []), MIN_NODE_W)
      )),
      ...legacyStructOccs.map(n => nodeWidth('«occurrence def»', n.name, [])),
      ...scenarios.map(n => nodeWidth('«scenario»', n.name, [])),
      ...[...allPartDefs, ...composedUsages, ...allPartUsages].flatMap(n =>
        n.body.filter(hasActionInst).map(a =>
          Math.max(nodeWidth(a.actionType ? `«action» : ${a.actionType}` : '«action»', a.name, []), MIN_NODE_W)
        )
      ),
    );
    const COL1_X = COL_START;
    const COL2_X = COL1_X + col1MaxW + COL_H_GAP;
    const COL3_X = COL2_X + col2MaxW + COL_H_GAP;
    // Center X of each column — nodes are placed at (centerX − nodeWidth/2)
    const C1CX = Math.round(COL1_X + col1MaxW / 2);
    const C2CX = Math.round(COL2_X + col2MaxW / 2);
    const C3CX = Math.round(COL3_X + col3MaxW / 2);
    console.log('[sysml-viz] col widths', { col1MaxW, col2MaxW, col3MaxW, C1CX, C2CX, C3CX });

    let col1Y = 60;   // running Y for column 1
    let col2Y = 60;   // running Y for column 2
    let col3Y = 60;   // running Y for column 3

    // Center-Y trackers for vertical alignment of col3 items with their owners.
    const defCol1Y = new Map<string, number>(); // portDef/ifaceDef name → col1 center Y
    const defCol2Y = new Map<string, number>(); // partDef/behaviorDef name → col2 center Y

    // ── Column 1 ─ Interface defs (purple) and Port defs (indigo) ─────────────
    const ifaceGid   = gid('InterfaceDefinition', 'ConnectionDefinition');
    const portDefGid = gid('PortDefinition');
    const connSection0 = [
      ...ifaceDefs.map(n => ({
        nodeId: `iface-${n.name}`, name: n.name, stereo: '«interface def»', palette: PAL.iface,
        sel: { id: `iface-${n.name}`, type: 'interface' as const, name: n.name, line: n.line,
          ...(ifaceGid(n.name) ? { extra: { graphId: ifaceGid(n.name)! } } : {}) },
      })),
      ...portDefs.map(n => ({
        nodeId: `portdef-${n.name}`, name: n.name, stereo: '«port def»', palette: PAL.portDef,
        sel: { id: `portdef-${n.name}`, type: 'port' as const, name: n.name, line: n.line,
          ...(portDefGid(n.name) ? { extra: { graphId: portDefGid(n.name)! } } : {}) },
      })),
    ];
    for (const c of connSection0) {
      const w1 = nodeWidth(c.stereo, c.name, []);
      baseNodes.push(makePartNode(c.nodeId, { x: C1CX - w1 / 2, y: col1Y }, c.stereo, c.name, [], c.palette, undefined, c.sel, [], w1));
      regGid(c.sel.extra?.graphId as string | undefined, c.nodeId);
      defCol1Y.set(c.name, col1Y + Math.round(PART_BASE_H / 2));
      col1Y += PART_BASE_H + V_STACK_GAP;
    }

    // ── Column 2 ─ Attribute definitions ──────────────────────────────────────
    const attrDefGid = gid('AttributeDefinition');
    for (const n of attrDefs) {
      const attrs  = n.body.filter((b): b is AU => b.kind === 'attributeUsage');
      const h      = partH(0, attrs.length);
      const nodeId = `attrdef-${n.name}`;
      const gidVal = attrDefGid(n.name);
      const w2a    = nodeWidth('«attribute def»', n.name, attrs);
      baseNodes.push(makePartNode(
        nodeId, { x: C2CX - w2a / 2, y: col2Y }, '«attribute def»', n.name, [], PAL.attr, undefined,
        { id: nodeId, type: 'part', name: n.name, line: n.line, ...(gidVal ? { extra: { graphId: gidVal } } : {}) },
        attrs,
        w2a,
      ));
      regGid(gidVal, nodeId);
      col2Y += h + V_STACK_GAP;
    }

    // ── Column 2 ─ Part defs (blue) and Item defs (amber) ─────────────────────
    const partDefGid = gid('PartDefinition');
    const itemDefGid = gid('ItemDefinition');
    type Section1Entry = { nodeId: string; stereo: string; name: string; ports: PortLike[]; attrs: AU[]; palette: Palette; sel: NonNullable<Parameters<typeof makePartNode>[7]> };
    const section1Entries: Section1Entry[] = [
      ...allPartDefs.map(n => ({
        nodeId: `def-${n.name}`, stereo: '«part def»', name: n.name,
        ports: n.body.filter((b): b is PortLike => b.kind === 'port'),
        attrs: n.body.filter((b): b is AU => b.kind === 'attributeUsage'),
        palette: PAL.type,
        sel: { id: `def-${n.name}`, type: 'part' as const, name: n.name, line: n.line,
          ...(partDefGid(n.name) ? { extra: { graphId: partDefGid(n.name)! } } : {}) },
      })),
      ...itemDefs.map(n => ({
        nodeId: `itemdef-${n.name}`, stereo: '«item def»', name: n.name,
        ports: [] as PortLike[], attrs: [] as AU[], palette: PAL.item,
        sel: { id: `itemdef-${n.name}`, type: 'part' as const, name: n.name, line: n.line,
          ...(itemDefGid(n.name) ? { extra: { graphId: itemDefGid(n.name)! } } : {}) },
      })),
    ];
    for (const e of section1Entries) {
      const h   = partH(e.ports.length, e.attrs.length);
      const w2e = nodeWidth(e.stereo, e.name, e.attrs);
      baseNodes.push(makePartNode(e.nodeId, { x: C2CX - w2e / 2, y: col2Y }, e.stereo, e.name, e.ports, e.palette, undefined, e.sel, e.attrs, w2e));
      regGid(e.sel.extra?.graphId as string | undefined, e.nodeId);
      // Record the vertical center of each def so we can align col3 instances.
      defCol2Y.set(e.name, col2Y + Math.round(h / 2));
      col2Y += h + V_STACK_GAP;

      // FeatureTyping connectors: each port on the part def → its portDef/iface (col1).
      // sourceHandle uses the port's own left-side handle so the edge originates at
      // the exact port position (matching the boundary square) rather than the generic
      // node-level handle — this makes the per-port typing relationships visually clear.
      for (const port of e.ports) {
        if (!port.portType) continue;
        const targetId =
          baseNodes.some(n => n.id === `portdef-${port.portType}`) ? `portdef-${port.portType}` :
          baseNodes.some(n => n.id === `iface-${port.portType}`)   ? `iface-${port.portType}`   :
          null;
        if (!targetId) continue;
        baseEdges.push({
          id: `typing-port-${e.nodeId}-${port.name}->${targetId}`,
          source: e.nodeId, target: targetId,
          sourceHandle: `port-${port.name}-ft`, targetHandle: '__target_right',
          type: 'featureTypingEdge',
          data: { portDirection: port.direction },
          zIndex: 5,
        });
      }
    }

    // ── Column 2 ─ Action / behavior defs ─────────────────────────────────────
    const actDefGid = gid('ActionDefinition', 'BehaviorDefinition');
    for (const n of behaviorDefs) {
      const nodeId = `actdef-${n.name}`;
      const gidVal = actDefGid(n.name);
      const w2b    = nodeWidth('«action def»', n.name, []);
      baseNodes.push(makePartNode(
        nodeId, { x: C2CX - w2b / 2, y: col2Y }, '«action def»', n.name, [], PAL.actDef, undefined,
        { id: nodeId, type: 'behavior' as const, name: n.name, line: n.line, ...(gidVal ? { extra: { graphId: gidVal } } : {}) },
        [],
        w2b,
      ));
      regGid(gidVal, nodeId);
      defCol2Y.set(n.name, col2Y + Math.round(PART_BASE_H / 2));
      col2Y += PART_BASE_H + V_STACK_GAP;
    }

    // ── Column 2 ─ Simple action defs (no body; prototype parser path) ─────────
    for (const n of simpleActDefs) {
      const nodeId = `actdef-${n.name}`;
      if (baseNodes.some(bn => bn.id === nodeId)) continue; // guard against dups with behaviorDef
      const w2s = nodeWidth('«action def»', n.name, []);
      baseNodes.push(makePartNode(
        nodeId, { x: C2CX - w2s / 2, y: col2Y }, '«action def»', n.name, [], PAL.actDef, undefined,
        { id: nodeId, type: 'behavior' as const, name: n.name, line: n.line },
        [],
        w2s,
      ));
      defCol2Y.set(n.name, col2Y + Math.round(PART_BASE_H / 2));
      col2Y += PART_BASE_H + V_STACK_GAP;
    }

    // Graph ID lookup for ActionUsage / PerformActionUsage nodes.
    const actInstGid = gid('ActionUsage', 'PerformActionUsage');

    // ── Column 1 ─ Standalone part usages ────────────────────────────────────
    // Placed in col1 (left of defs) so FeatureTyping edges cross left→right,
    // arriving at the LEFT face of col2 defs. Composition edges from composedDefs
    // leave from their RIGHT face → opposite faces, clear visual separation.
    const partUsageGid = gid('PartUsage');
    const itemUsageGid = gid('ItemUsage');
    for (const n of standaloneUsages) {
      const nodeId    = `usage-${n.name}`;
      const gidVal    = partUsageGid(n.name);
      const graphPorts = getGraphPorts(gidVal);
      const stereoSU  = n.type ? `«part» : ${n.type}` : '«part»';
      const w1su      = nodeWidth(stereoSU, n.name, []);
      baseNodes.push(makePartNode(
        nodeId, { x: C1CX - w1su / 2, y: col1Y },
        stereoSU, n.name, graphPorts, PAL.inst, undefined,
        { id: nodeId, type: 'instance' as const, name: n.name,
          extra: { ...(n.type ? { type: n.type } : {}), parent: n.namespace, ...(gidVal ? { graphId: gidVal } : {}) } },
        [],
        w1su,
        'usage',
      ));
      regGid(gidVal, nodeId);
      col1Y += PART_BASE_H + V_STACK_GAP;

      // FeatureTyping connector: usage (col1) → definition (col2), left face of def
      if (n.type) {
        const targetId =
          baseNodes.some(bn => bn.id === `def-${n.type}`)      ? `def-${n.type}`      :
          baseNodes.some(bn => bn.id === `iface-${n.type}`)    ? `iface-${n.type}`    :
          baseNodes.some(bn => bn.id === `portdef-${n.type}`)  ? `portdef-${n.type}`  :
          baseNodes.some(bn => bn.id === `attrdef-${n.type}`)  ? `attrdef-${n.type}`  :
          null;
        if (targetId) {
          baseEdges.push({
            id: `typing-${n.name}->${targetId}`,
            source: nodeId, target: targetId,
            sourceHandle: '__source', targetHandle: '__target',
            type: 'featureTypingEdge',
            zIndex: 5,
          });
        }
      }
    }

    // ── Column 3 ─ Instances from composed part defs ─────────────────────────
    // Each composedDef is already a node in col2 (def-${name}) from section1.
    // Here we create flat instance nodes in col3 and connect each to its owner
    // with a composition edge (filled diamond at the def end).
    function emitInstances(
      ownerRfId: string,
      ownerName: string,
      aliases: (PA | IA)[],
      connections: CN[],
      actions: AI[] = [],
    ) {
      for (let i = 0; i < aliases.length; i++) {
        const alias    = aliases[i];
        const isItem   = alias.kind === 'itemAlias';
        const partTypeDef = isItem ? undefined : partDefMap.get(alias.type);
        const ports    = partTypeDef
          ? partTypeDef.body.filter((b): b is PortLike => b.kind === 'port')
          : [];
        const stereo   = alias.type
          ? (isItem ? `«item» : ${alias.type}` : `«part» : ${alias.type}`)
          : (isItem ? '«item»' : '«part»');
        const palette  = isItem ? PAL.item : PAL.inst;
        const instW    = Math.max(nodeWidth(stereo, alias.name, []), MIN_NODE_W);
        const h        = partH(ports.length);
        const instGid  = isItem ? itemUsageGid(alias.name) : partUsageGid(alias.name);
        const instRfId = `inst-${ownerName}-${alias.name}`;
        regGid(instGid, instRfId);

        baseNodes.push(makePartNode(
          instRfId, { x: C3CX - instW / 2, y: col3Y },
          stereo, alias.name, ports, palette, undefined,
          { id: instRfId, type: isItem ? 'part' : 'instance', name: alias.name, line: alias.line,
            extra: { type: alias.type, parent: ownerName, ...(instGid ? { graphId: instGid } : {}) } },
          [],
          instW,
          'usage',
        ));

        // Composition or reference edge depending on whether the part is composite.
        baseEdges.push({
          id: `comp-${ownerName}-${alias.name}`,
          source: ownerRfId, target: instRfId,
          sourceHandle: '__source', targetHandle: '__target',
          type: alias.kind === 'partAlias' && alias.isRef ? 'nonCompositeMembershipEdge' : 'compositionEdge',
          zIndex: 4,
        });

        // FeatureTyping edge: instance → type definition in col2 (part def or item def)
        let ftTarget = alias.type
          ? (baseNodes.some(bn => bn.id === `def-${alias.type}`)     ? `def-${alias.type}`
          :  baseNodes.some(bn => bn.id === `itemdef-${alias.type}`)  ? `itemdef-${alias.type}`
          :  null)
          : null;

        // For item aliases whose type is defined in another file (not in result.nodes),
        // create a synthetic «item def» placeholder so the FT edge and focused-view
        // BFS can reach it.  Guard against duplicates — multiple portDefs often share
        // the same payload type (e.g. both In and Out variants carry AdcNotification…).
        if (isItem && !ftTarget && alias.type) {
          const synId = `itemdef-${alias.type}`;
          if (!baseNodes.some(bn => bn.id === synId)) {
            const synW = nodeWidth('«item def»', alias.type, []);
            baseNodes.push(makePartNode(
              synId, { x: C2CX - synW / 2, y: col2Y },
              '«item def»', alias.type, [], PAL.item, undefined,
              { id: synId, type: 'part' as const, name: alias.type, line: 0 },
              [],
              synW,
            ));
            col2Y += PART_BASE_H + V_STACK_GAP;
          }
          ftTarget = synId;
        }

        if (ftTarget) {
          baseEdges.push({
            id: `typing-inst-${ownerName}-${alias.name}`,
            source: instRfId, target: ftTarget,
            sourceHandle: '__source_left', targetHandle: '__target',
            type: 'featureTypingEdge',
            zIndex: 5,
          });
        }

        col3Y += h + (i < aliases.length - 1 ? INST_V_GAP : V_STACK_GAP);
      }

      // Action usage instances owned by this element.
      for (let i = 0; i < actions.length; i++) {
        const action   = actions[i];
        const stereo   = action.actionType ? `«action» : ${action.actionType}` : '«action»';
        const actW     = Math.max(nodeWidth(stereo, action.name, []), MIN_NODE_W);
        const actRfId  = `action-${ownerName}-${action.name}`;
        const actGid   = actInstGid(action.name);
        regGid(actGid, actRfId);

        baseNodes.push(makePartNode(
          actRfId, { x: C3CX - actW / 2, y: col3Y },
          stereo, action.name, [], PAL.actDef, undefined,
          { id: actRfId, type: 'behavior' as const, name: action.name, line: action.line,
            extra: { ...(action.actionType ? { type: action.actionType } : {}),
                     parent: ownerName, ...(actGid ? { graphId: actGid } : {}) } },
          [],
          actW,
          'usage',
        ));

        // Composition edge: owner → action instance (filled diamond at owner end)
        baseEdges.push({
          id: `comp-action-${ownerName}-${action.name}`,
          source: ownerRfId, target: actRfId,
          sourceHandle: '__source', targetHandle: '__target',
          type: 'compositionEdge',
          zIndex: 4,
        });

        // FeatureTyping edge: action instance → action def type in col2
        if (action.actionType) {
          const ftActTarget =
            baseNodes.some(bn => bn.id === `actdef-${action.actionType}`) ? `actdef-${action.actionType}` :
            null;
          if (ftActTarget) {
            baseEdges.push({
              id: `typing-action-${ownerName}-${action.name}`,
              source: actRfId, target: ftActTarget,
              sourceHandle: '__source_left', targetHandle: '__target',
              type: 'featureTypingEdge',
              zIndex: 5,
            });
          }
        }

        const isLast = i === actions.length - 1 && aliases.length === 0;
        col3Y += PART_BASE_H + (isLast ? V_STACK_GAP : INST_V_GAP);
      }

      for (const conn of connections) {
        const edgeId = `conn-${ownerName}-${conn.fromPart}.${conn.fromPort}-${conn.toPart}.${conn.toPort}`;
        baseEdges.push({
          id: edgeId,
          source: `inst-${ownerName}-${conn.fromPart}`,
          target: `inst-${ownerName}-${conn.toPart}`,
          sourceHandle: conn.fromPort ? `port-${conn.fromPort}-out` : '__source',
          targetHandle: conn.toPort   ? `port-${conn.toPort}`      : '__target',
          type: 'smoothstep',
          ...(conn.connType ? {
            label: conn.connType,
            labelStyle:   { fontSize: 9, fill: '#4ade80', fontFamily: 'monospace' },
            labelBgStyle: { fill: '#040f08', fillOpacity: 0.9 },
          } : {}),
          style: { stroke: '#4ade80', strokeWidth: 2 },
          // ConnectionUsage is undirected — no arrowhead. Only flow types (FlowUsage,
          // FlowConnectionUsage, SuccessionItemFlow) carry an explicit direction.
          ...(conn.directed ? { markerEnd: { type: MarkerType.ArrowClosed, color: '#4ade80', width: 11, height: 11 } } : {}),
          zIndex: 20,
          data: {
            _sel: {
              id: edgeId, type: 'connection',
              name: conn.connType
                ? `${conn.fromPart}.${conn.fromPort} → ${conn.toPart}.${conn.toPort} : ${conn.connType}`
                : `${conn.fromPart}.${conn.fromPort} → ${conn.toPart}.${conn.toPort}`,
              line: conn.line,
              extra: { fromPart: conn.fromPart, fromPort: conn.fromPort,
                       toPart: conn.toPart, toPort: conn.toPort, parent: ownerName,
                       ...(conn.connType ? { connType: conn.connType } : {}) },
            } satisfies SelectionState,
          },
        });
      }
    }

    // ── Column 3 ─ Items owned by port defs (aligned with col1) ─────────────────
    // Process portDef items FIRST so their col3 positions align with the portDef
    // positions in col1, keeping composition edges short and horizontal.
    // This also means FT edges from col2 partDef ports and portDef composition
    // edges are at similar vertical positions, reducing crossings.
    for (const n of portDefs) {
      const items = (n.body ?? []).filter((b): b is IA => b.kind === 'itemAlias');
      if (items.length === 0) continue;
      const portDefCenterY = defCol1Y.get(n.name);
      if (portDefCenterY !== undefined) {
        // items always have height PART_BASE_H (no ports on item instances)
        const clusterH = items.length * PART_BASE_H + (items.length - 1) * INST_V_GAP;
        const alignedStart = portDefCenterY - Math.round(clusterH / 2);
        if (alignedStart > col3Y) col3Y = alignedStart;
      }
      emitInstances(`portdef-${n.name}`, n.name, items, []);
    }

    // ── Column 3 ─ Items owned by behavior / action defs (aligned with col2) ───
    for (const n of behaviorDefs) {
      const items = n.body.filter((b): b is IA => b.kind === 'itemAlias');
      if (items.length === 0) continue;
      const actDefCenterY = defCol2Y.get(n.name);
      if (actDefCenterY !== undefined) {
        const clusterH = items.length * PART_BASE_H + (items.length - 1) * INST_V_GAP;
        const alignedStart = actDefCenterY - Math.round(clusterH / 2);
        if (alignedStart > col3Y) col3Y = alignedStart;
      }
      emitInstances(`actdef-${n.name}`, n.name, items, []);
    }

    // ── Column 3 ─ Instances from composed part defs ─────────────────────────
    for (const n of composedDefs) {
      const defRfId  = `def-${n.name}`;    // already created in col2 section1
      const aliases: (PA | IA)[] = n.body.filter((b): b is PA | IA =>
        b.kind === 'partAlias' || b.kind === 'itemAlias');
      const conns    = n.body.filter((b): b is CN => b.kind === 'connection');
      const actions  = n.body.filter(hasActionInst);
      // Vertically align the instance cluster with the owning def to shorten
      // composition edges. If prior col3 items already pushed col3Y past the
      // def's vertical position, stay at col3Y (no gap, no backwards jump).
      const defCenterY = defCol2Y.get(n.name);
      if (defCenterY !== undefined) {
        const clusterH = aliases.reduce((s, alias) => {
          const td = alias.kind === 'itemAlias' ? itemDefMap.get(alias.type) : partDefMap.get(alias.type);
          const p  = (td && 'body' in td) ? td.body.filter((b): b is PortLike => b.kind === 'port') : [];
          return s + partH(p.length);
        }, 0) + (aliases.length + actions.length - 1) * INST_V_GAP + actions.length * PART_BASE_H;
        const alignedStart = defCenterY - Math.round(clusterH / 2);
        if (alignedStart > col3Y) col3Y = alignedStart;
      }
      emitInstances(defRfId, n.name, aliases, conns, actions);
    }

    // ── Column 3 ─ Action usages from non-composed part defs ─────────────────
    for (const n of actionOnlyDefs) {
      const defRfId  = `def-${n.name}`;
      const actions  = n.body.filter(hasActionInst);
      const defCenterY = defCol2Y.get(n.name);
      if (defCenterY !== undefined) {
        const clusterH = actions.length * PART_BASE_H + (actions.length - 1) * INST_V_GAP;
        const alignedStart = defCenterY - Math.round(clusterH / 2);
        if (alignedStart > col3Y) col3Y = alignedStart;
      }
      emitInstances(defRfId, n.name, [], [], actions);
    }

    // ── Column 3 ─ Composed part usages + their instances ─────────────────────
    for (const n of composedUsages) {
      const gidVal  = partUsageGid(n.name);
      const stereoU = n.type ? `«part» : ${n.type}` : '«part»';
      const usageId = `usage-${n.name}`;
      const wU      = nodeWidth(stereoU, n.name, []);
      const graphPorts = getGraphPorts(gidVal);
      regGid(gidVal, usageId);

      baseNodes.push(makePartNode(
        usageId, { x: C3CX - wU / 2, y: col3Y },
        stereoU, n.name, graphPorts, PAL.inst, undefined,
        { id: usageId, type: 'instance' as const, name: n.name,
          extra: { ...(n.type ? { type: n.type } : {}), parent: n.namespace, ...(gidVal ? { graphId: gidVal } : {}) } },
        [],
        wU,
        'usage',
      ));
      col3Y += PART_BASE_H + V_STACK_GAP;

      // FeatureTyping: composed usage → its type definition
      if (n.type) {
        const targetId =
          baseNodes.some(bn => bn.id === `def-${n.type}`)     ? `def-${n.type}`     :
          baseNodes.some(bn => bn.id === `iface-${n.type}`)   ? `iface-${n.type}`   :
          null;
        if (targetId) {
          baseEdges.push({
            id: `typing-${n.name}->${targetId}`,
            source: usageId, target: targetId,
            sourceHandle: '__source_left', targetHandle: '__target',
            type: 'featureTypingEdge',
            zIndex: 5,
          });
        }
      }

      const aliases: (PA | IA)[] = n.body.filter((b): b is PA | IA =>
        b.kind === 'partAlias' || b.kind === 'itemAlias');
      const conns   = n.body.filter((b): b is CN => b.kind === 'connection');
      const actions = n.body.filter(hasActionInst);
      if (aliases.length > 0 || actions.length > 0) emitInstances(usageId, n.name, aliases, conns, actions);
    }

    // ── Column 3 ─ Legacy structural occurrenceDef ────────────────────────────
    const occDefGid  = gid('OccurrenceDefinition');
    for (const n of legacyStructOccs) {
      const gidVal = occDefGid(n.name);
      const nodeId = `occ-${n.name}`;
      const w3occ  = nodeWidth('«occurrence def»', n.name, []);
      baseNodes.push(makePartNode(
        nodeId, { x: C3CX - w3occ / 2, y: col3Y }, '«occurrence def»', n.name, [], PAL.occ, undefined,
        { id: nodeId, type: 'occurrence', name: n.name, line: n.line, ...(gidVal ? { extra: { graphId: gidVal } } : {}) },
        [],
        w3occ,
      ));
      regGid(gidVal, nodeId);
      col3Y += PART_BASE_H + V_STACK_GAP;
    }

    // ── Column 3 ─ Behavioral scenarios ───────────────────────────────────────
    for (const n of scenarios) {
      const gidVal = occDefGid(n.name);
      const nodeId = `occ-${n.name}`;
      const w3scen = nodeWidth('«scenario»', n.name, []);
      baseNodes.push(makePartNode(
        nodeId, { x: C3CX - w3scen / 2, y: col3Y }, '«scenario»', n.name, [], PAL.scen, undefined,
        { id: nodeId, type: 'occurrence', name: n.name, line: n.line, ...(gidVal ? { extra: { graphId: gidVal } } : {}) },
        [],
        w3scen,
      ));
      regGid(gidVal, nodeId);
      col3Y += PART_BASE_H + V_STACK_GAP;
    }

    // ── Relationship edges from ContainmentGraph ───────────────────────────────
    if (graph) {
      const addedEdgeIds   = new Set(baseEdges.map(e => e.id));
      const addedEdgePairs = new Set(baseEdges.map(e => `${e.source}→${e.target}`));

      const portToOwnerRfId = new Map<string, string>();
      for (const [graphId, rfId] of graphIdToRfId) {
        for (const p of getGraphNodePorts(graphId)) portToOwnerRfId.set(p.id, rfId);
      }

      for (const edge of graph.edges) {
        if (edge.type === 'connection') {
          const srcRf = graphIdToRfId.get(edge.source) ?? portToOwnerRfId.get(edge.source);
          const tgtRf = graphIdToRfId.get(edge.target) ?? portToOwnerRfId.get(edge.target);
          if (!srcRf || !tgtRf || srcRf === tgtRf) continue;
          if (srcRf.startsWith('inst-') || tgtRf.startsWith('inst-')) continue;
          const edgeId  = `conn-graph-${edge.id}`;
          const pairKey = `${srcRf}→${tgtRf}`;
          if (addedEdgeIds.has(edgeId) || addedEdgePairs.has(pairKey)) continue;
          addedEdgeIds.add(edgeId);
          addedEdgePairs.add(pairKey);
          const isFlowEdge = !!edge.label;
          baseEdges.push({
            id: edgeId, source: srcRf, target: tgtRf,
            type: 'smoothstep',
            ...(isFlowEdge
              ? { label: edge.label, labelStyle: { fontSize: 9, fill: '#4ade80', fontFamily: 'monospace' }, labelBgStyle: { fill: '#040f08', fillOpacity: 0.88 } }
              : {}),
            style:        { stroke: '#4ade80', strokeWidth: 1.5 },
            ...(isFlowEdge ? { markerEnd: { type: MarkerType.ArrowClosed, color: '#4ade80', width: 10, height: 10 } } : {}),
            zIndex: 8,
          });
        }

        // FeatureTyping edges from ContainmentGraph not already rendered manually.
        // These catch any typing relationships that the per-section manual loops missed.
        if (edge.type === 'typedBy') {
          const srcRf = graphIdToRfId.get(edge.source);
          const tgtRf = graphIdToRfId.get(edge.target);
          if (!srcRf || !tgtRf || srcRf === tgtRf) continue;
          const edgeId  = `typing-graph-${edge.id}`;
          const pairKey = `${srcRf}→${tgtRf}`;
          if (addedEdgeIds.has(edgeId) || addedEdgePairs.has(pairKey)) continue;
          addedEdgeIds.add(edgeId);
          addedEdgePairs.add(pairKey);
          baseEdges.push({
            id: edgeId, source: srcRf, target: tgtRf,
            sourceHandle: '__source_left', targetHandle: '__target',
            type: 'featureTypingEdge',
            zIndex: 5,
          });
        }

        // Specialization edges: PartDef :> PartDef (solid + hollow triangle at supertype)
        // SysML v2 spec §8.2.3.6: same notation as FeatureTyping / Subclassification.
        if (edge.type === 'specialization') {
          const srcRf = graphIdToRfId.get(edge.source);
          const tgtRf = graphIdToRfId.get(edge.target);
          if (!srcRf || !tgtRf || srcRf === tgtRf) continue;
          const edgeId  = `spec-graph-${edge.id}`;
          const pairKey = `${srcRf}→${tgtRf}`;
          if (addedEdgeIds.has(edgeId) || addedEdgePairs.has(pairKey)) continue;
          addedEdgeIds.add(edgeId);
          addedEdgePairs.add(pairKey);
          baseEdges.push({
            id: edgeId, source: srcRf, target: tgtRf,
            sourceHandle: '__source_left', targetHandle: '__target',
            type: 'featureTypingEdge',
            data: { stroke: '#818cf8' },  // indigo tint — visually distinguishes from typing
            zIndex: 5,
          });
        }

        // Subsetting edges: PartUsage :>> PartUsage (solid + hollow triangle at supersetted usage)
        // SysML v2 spec §8.2.3.6: same notation as FeatureTyping / Subsetting.
        if (edge.type === 'subsetting') {
          const srcRf = graphIdToRfId.get(edge.source);
          const tgtRf = graphIdToRfId.get(edge.target);
          if (!srcRf || !tgtRf || srcRf === tgtRf) continue;
          const edgeId  = `sub-graph-${edge.id}`;
          const pairKey = `${srcRf}→${tgtRf}`;
          if (addedEdgeIds.has(edgeId) || addedEdgePairs.has(pairKey)) continue;
          addedEdgeIds.add(edgeId);
          addedEdgePairs.add(pairKey);
          baseEdges.push({
            id: edgeId, source: srcRf, target: tgtRf,
            sourceHandle: '__source_left', targetHandle: '__target',
            type: 'featureTypingEdge',
            data: { stroke: '#a78bfa' },  // violet tint — visually distinguishes from specialization
            zIndex: 5,
          });
        }
      }
    }

    // ═══ Nested "Show all" build — recursive spec-style compartments ═══════════
    // Roots = part defs + action/behavior defs. A composite usage (partAlias /
    // itemAlias / actionInst) becomes a CHILD box nested inside its owner, and
    // recursion descends into the usage's TYPE def (cycle-guarded) so the whole
    // decomposition is shown as nested compartments. Attributes + ports render as
    // rows. Specialization / subsetting stay as cross-box lines (added after);
    // connections between sibling parts are drawn inside their common owner.
    const NPAD = 14, NHEAD_GAP = 10, NCHILD_GAP = 14, NBOTTOM = 14, ROOT_GAP = 70, ROOT_MAX_W = 2800;
    const nestedNodes: Node[] = [];
    const nestedEdges: Edge[] = [];
    const nestedGidToRf = new Map<string, string>();
    const partDefGidN = gid('PartDefinition');
    const behDefGidN  = gid('ActionDefinition', 'BehaviorDefinition');
    const nestDefMap  = new Map<string, PD | BD>();
    for (const d of allPartDefs)  nestDefMap.set(d.name, d);
    for (const d of behaviorDefs) if (!nestDefMap.has(d.name)) nestDefMap.set(d.name, d);

    // Build one box for `def` (attrs/ports/children come from it) shown under `ownerRfId`
    // (null = a root). Returns the box node plus its whole subtree in parent-first order
    // (React Flow requires a parent to precede its children in the node array).
    function buildNestBox(
      rfId: string, ownerRfId: string | null,
      stereo: string, name: string, palette: Palette, sel: SelectionState,
      def: PD | BD | undefined, graphId: string | undefined, seen: Set<string>,
    ): { node: Node; subtree: Node[] } {
      const attrs = def ? def.body.filter((b): b is AU => b.kind === 'attributeUsage') : [];
      const ports = def ? def.body.filter((b): b is PortLike => b.kind === 'port') : [];
      const rows  = attrs.length + ports.length;
      const contentH = PART_BASE_H + (rows > 0 ? PORT_TOP + rows * PORT_ROW_H : 0);

      const childMembers = def
        ? def.body.filter((b): b is PA | IA | AI =>
            b.kind === 'partAlias' || b.kind === 'itemAlias' || b.kind === 'actionInst')
        : [];

      const childBoxes: Node[]   = [];
      const childSubtrees: Node[][] = [];
      let cy = contentH + (childMembers.length ? NHEAD_GAP : 0);
      let maxChildW = 0;
      for (const m of childMembers) {
        const cRfId    = `${rfId}::${m.name}`;
        const cType    = m.kind === 'actionInst' ? m.actionType : m.type;
        const cKindLbl = m.kind === 'actionInst' ? '«action»' : m.kind === 'itemAlias' ? '«item»' : '«part»';
        const cStereo  = cType ? `${cKindLbl} : ${cType}` : cKindLbl;
        const cPalette = m.kind === 'actionInst' ? PAL.actDef : m.kind === 'itemAlias' ? PAL.item : PAL.inst;
        const cDef     = cType && !seen.has(cType) ? nestDefMap.get(cType) : undefined;
        const cGid     = m.kind === 'actionInst' ? actInstGid(m.name)
                       : m.kind === 'itemAlias'  ? itemUsageGid(m.name)
                       : partUsageGid(m.name);
        const cSel: SelectionState = {
          id: cRfId, type: m.kind === 'actionInst' ? 'behavior' : 'part', name: m.name, line: m.line,
          extra: { ...(cType ? { type: cType } : {}), parent: name },
        };
        const { node: cbox, subtree: csub } = buildNestBox(
          cRfId, rfId, cStereo, m.name, cPalette, cSel,
          cDef, cGid, cType ? new Set(seen).add(cType) : seen,
        );
        cbox.position = { x: NPAD, y: cy };
        cy += (cbox.style as { height: number }).height + NCHILD_GAP;
        maxChildW = Math.max(maxChildW, (cbox.style as { width: number }).width);
        childBoxes.push(cbox);
        childSubtrees.push(csub);
      }

      const boxW = Math.max(MIN_NODE_W, nodeWidth(stereo, name, attrs),
        childBoxes.length ? maxChildW + 2 * NPAD : 0);
      const boxH = childBoxes.length ? (cy - NCHILD_GAP + NBOTTOM) : contentH;

      const node = makePartNode(
        rfId, { x: 0, y: 0 }, stereo, name, ports, palette,
        ownerRfId ? { parentId: ownerRfId, extent: 'parent' as const } : undefined,
        sel, attrs, boxW, ownerRfId ? 'usage' : 'definition',
      );
      (node.style as Record<string, unknown>).height = boxH;
      (node.data  as Record<string, unknown>).nodeH  = contentH;  // ports/attrs sit in the header rows
      if (graphId) nestedGidToRf.set(graphId, rfId);

      // Sibling connections drawn inside this owner.
      if (def) {
        for (const conn of def.body.filter((b): b is CN => b.kind === 'connection')) {
          const s = `${rfId}::${conn.fromPart}`, t = `${rfId}::${conn.toPart}`;
          if (!childBoxes.some(c => c.id === s) || !childBoxes.some(c => c.id === t)) continue;
          nestedEdges.push({
            id: `nconn-${rfId}-${conn.fromPart}.${conn.fromPort}-${conn.toPart}.${conn.toPort}`,
            source: s, target: t,
            sourceHandle: conn.fromPort ? `port-${conn.fromPort}-out` : '__source',
            targetHandle: conn.toPort   ? `port-${conn.toPort}`       : '__target',
            type: 'smoothstep',
            style: { stroke: '#4ade80', strokeWidth: 1.5 },
            ...(conn.directed ? { markerEnd: { type: MarkerType.ArrowClosed, color: '#4ade80', width: 10, height: 10 } } : {}),
            zIndex: 20,
          });
        }
      }

      return { node, subtree: [node, ...childSubtrees.flat()] };
    }

    // Roots: every part def, then every action/behavior def. Shelf-pack, wrapping rows.
    const rootSpecs: Array<{ def: PD | BD; stereo: string; palette: Palette; type: 'part' | 'behavior'; gidVal?: string }> = [
      ...allPartDefs.map(d  => ({ def: d, stereo: '«part def»',   palette: PAL.type,   type: 'part'     as const, gidVal: partDefGidN(d.name) })),
      ...behaviorDefs.map(d => ({ def: d, stereo: '«action def»', palette: PAL.actDef, type: 'behavior' as const, gidVal: behDefGidN(d.name) })),
    ];
    let shelfX = 0, shelfY = 0, shelfRowH = 0;
    for (const r of rootSpecs) {
      const rootRfId = `n:${r.type === 'part' ? 'def' : 'actdef'}-${r.def.name}`;
      const sel: SelectionState = { id: rootRfId, type: r.type, name: r.def.name, line: r.def.line,
        extra: r.gidVal ? { graphId: r.gidVal } : {} };
      const { node: box, subtree } = buildNestBox(rootRfId, null, r.stereo, r.def.name, r.palette, sel, r.def, r.gidVal, new Set([r.def.name]));
      const w = (box.style as { width: number }).width, h = (box.style as { height: number }).height;
      if (shelfX > 0 && shelfX + w > ROOT_MAX_W) { shelfX = 0; shelfY += shelfRowH + ROOT_GAP; shelfRowH = 0; }
      box.position = { x: shelfX, y: shelfY };
      shelfX += w + ROOT_GAP;
      shelfRowH = Math.max(shelfRowH, h);
      nestedNodes.push(...subtree);
    }

    // Cross-box specialization / subsetting lines (def :> def, usage :>> usage).
    if (graph) {
      for (const edge of graph.edges) {
        if (edge.type !== 'specialization' && edge.type !== 'subsetting') continue;
        const s = nestedGidToRf.get(edge.source), t = nestedGidToRf.get(edge.target);
        if (!s || !t || s === t) continue;
        nestedEdges.push({
          id: `nspec-${edge.id}`, source: s, target: t,
          sourceHandle: '__source_left', targetHandle: '__target',
          type: 'featureTypingEdge',
          data: { stroke: edge.type === 'subsetting' ? '#a78bfa' : '#818cf8' },
          zIndex: 5,
        });
      }
    }

    return { baseNodes, baseEdges, graphIdToRfId, nestedNodes, nestedEdges };
  }, [result, graph]);

  // ── Reset focus when the model changes ────────────────────────────────────────
  useEffect(() => { setFocusedNodeId(null); }, [result, graph]);

  // ── Cursor sync: editor line → focused element ────────────────────────────────
  useEffect(() => {
    if (!graph) return;
    const handler = (ev: MessageEvent) => {
      const msg = ev.data as { type: string; sourceLocation?: { line: number } };
      if (msg.type !== 'revealElementAtSource' || !msg.sourceLocation) return;
      const defGraphId = findTopLevelDefInGraph(msg.sourceLocation.line, graph);
      if (!defGraphId) return;
      const rfId = graphIdToRfId.get(defGraphId);
      if (rfId) setFocusedNodeId(rfId);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [graph, graphIdToRfId]);

  // ── Neighbourhood filter ───────────────────────────────────────────────────────
  // Directional BFS from the focused node: follow edges only in their natural
  // source → target direction.  This limits the subgraph to the definition
  // and its type/composition descendants (portDefs, items, owned instances, etc.)
  // without pulling in unrelated subtrees via reverse traversal.
  //
  // Bidirectional BFS would traverse FT edges backward from a type-def to every
  // instance that uses it, then backward through composition to the owner, then
  // forward through ALL of the owner's instances — exploding the subgraph for
  // models like AcpdCdd_DataflowInterconnection.
  const { filteredNodes, filteredEdges } = useMemo(() => {
    // "Show all elements": the recursive nested compartment layout (roots = part/action
    // defs, composite usages nested inside, cycle-guarded). Focused mode keeps the flat
    // graph so its drill-in BFS over baseEdges still works.
    if (!focusedNodeId) return { filteredNodes: nestedNodes, filteredEdges: nestedEdges };

    const visible = new Set<string>([focusedNodeId]);
    const queue   = [focusedNodeId];

    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const e of baseEdges) {
        if (e.source !== id) continue;
        // Don't follow featureTyping edges FROM part instances (inst-*) to definition
        // nodes (def-*, portdef-*, ...).  Those edges would pull in the full type-def
        // subtree and re-expand the entire graph — e.g. selecting
        // AcpdCdd_DataflowInterconnection would collect all partDefs and portDefs of
        // its 10 instances, making the focused view identical to the general view.
        // Exception: FT to itemdef-* is fine — item defs have no further outgoing
        // edges, so they are bounded, and they carry useful payload-type information.
        if (id.startsWith('inst-') && e.type === 'featureTypingEdge' &&
            !e.target.startsWith('itemdef-')) continue;
        if (!visible.has(e.target)) {
          visible.add(e.target);
          queue.push(e.target);
        }
      }
    }

    return {
      filteredNodes: baseNodes.filter(n => visible.has(n.id)),
      filteredEdges: baseEdges.filter(e => visible.has(e.source) && visible.has(e.target)),
    };
  }, [baseNodes, baseEdges, nestedNodes, nestedEdges, focusedNodeId]);

  // ── Layout effect ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // "Show all": the nested compartment nodes carry their own (recursively packed)
    // positions and sizes — no overlaps by construction — so skip ELK entirely and
    // render them as-is. Only cross-box lines (specialization / connection) use native
    // React Flow routing. Nested children must NOT be draggable out of their parent.
    if (!focusedNodeId) {
      setDisplayNodes(filteredNodes.map(n => ({ ...n, draggable: n.parentId ? false : (n.draggable !== false) })));
      // Route cross-box lines (specialization / subsetting between root boxes) orthogonally
      // AROUND the top-level boxes so no line cuts through an intervening box. Connection
      // lines between nested siblings stay on React Flow's native routing (short + local).
      const topNodes = filteredNodes.filter(n => !n.parentId);
      const topIds   = new Set(topNodes.map(n => n.id));
      const nodeInfo = topNodes.map(n => ({
        id: n.id, x: n.position.x, y: n.position.y,
        width:  Number((n.style as Record<string, unknown>)?.['width']  ?? 172),
        height: Number((n.style as Record<string, unknown>)?.['height'] ?? 48),
      }));
      const routeIn = filteredEdges
        .filter(e => topIds.has(e.source) && topIds.has(e.target) && e.source !== e.target)
        .map(e => ({ id: e.id, source: e.source, target: e.target }));
      const routes = routeEdgesOrthogonal(nodeInfo, routeIn);
      setDisplayEdges(filteredEdges.map(e => {
        const wp = routes.get(e.id);
        return wp ? { ...e, data: { ...(e.data ?? {}), waypoints: wp } } : e;
      }));
      setAutoFitVersion(v => v + 1);
      return () => { cancelled = true; };
    }

    // In focused mode, redirect output-port featureTyping edges to the right-side
    // handle so they exit the correct side of the partDef node.  Output ports are
    // rendered on the right boundary, so their portDef should be to the right too.
    const edgesForLayout = focusedNodeId
      ? filteredEdges.map(e => {
          if (e.type !== 'featureTypingEdge') return e;
          const dir = (e.data as Record<string, unknown>)?.portDirection;
          if (dir !== 'out') return e;
          return {
            ...e,
            sourceHandle: e.sourceHandle ? e.sourceHandle.replace(/-ft$/, '-ft-right') : e.sourceHandle,
            targetHandle: '__target',
          };
        })
      : filteredEdges;

    // "Show all elements": preserve the manual 3-column layout, only route edges
    // orthogonally around nodes (ELK fixed).  Repositioning with ELK layered DOWN
    // discards the column structure and spreads portDef items far below their owners.
    // Focused mode: ELK layered RIGHT with crossing minimisation (algorithm='stress').
    const layoutPromise = focusedNodeId
      ? applyHierarchicalLayout(filteredNodes, edgesForLayout, { algorithm: 'stress' })
      : applyHierarchicalLayout(filteredNodes, edgesForLayout, { direction: 'RIGHT' });

    layoutPromise.then(({ nodes: positioned, edgeRoutes }) => {
      if (cancelled) return;
      setDisplayNodes(positioned.map(n => ({ ...n, draggable: n.draggable !== false })));
      // Apply ELK routes to SysML relationship edges only.
      // • featureTypingEdge / compositionEdge / nonCompositeMembershipEdge: keep
      //   their type so SVG markers render; waypoints go in data.
      // • straight / smoothstep connection edges: skip ELK waypoints entirely.
      //   These use port-specific handles (port-X-out, port-Y) and React Flow's
      //   native path rendering connects them to the exact port square position.
      //   ELK routes to node-boundary midpoints, which misses the port squares.
      const CUSTOM_EDGE_TYPES = new Set(['featureTypingEdge', 'compositionEdge', 'nonCompositeMembershipEdge']);
      const SKIP_WAYPOINTS    = new Set(['straight', 'smoothstep']);
      setDisplayEdges(edgesForLayout.map(e => {
        const waypoints = edgeRoutes.get(e.id);
        if (!waypoints || SKIP_WAYPOINTS.has(e.type ?? '')) return e;
        if (CUSTOM_EDGE_TYPES.has(e.type ?? '')) {
          return { ...e, data: { ...(e.data ?? {}), waypoints } };
        }
        return { ...e, type: 'elkEdge', data: { ...(e.data ?? {}), waypoints } };
      }));
      setAutoFitVersion(v => v + 1);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNodes, filteredEdges, resetVersion]);

  // ── Drag handler ──────────────────────────────────────────────────────────────
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setDisplayNodes(prev => applyNodeChanges(changes, prev));
  }, []);

  // ── Pass 2: apply selection highlight ────────────────────────────────────────
  const { rfNodes, rfEdges } = useMemo(() => {
    const nodes = displayNodes.length > 0 ? displayNodes : filteredNodes;
    const edges = displayEdges.length > 0 ? displayEdges : filteredEdges;

    if (!selection) return { rfNodes: nodes, rfEdges: edges };

    const rfNodes = nodes.map(n => {
      if (n.id !== selection.id) return n;
      return {
        ...n,
        style: {
          ...(n.style as object),
          border: `1.5px solid ${SEL_BORDER}`,
          boxShadow: SEL_GLOW,
        },
      };
    });

    // Highlight edges connected to the selected node, or the directly-selected edge.
    const selectedIsNode = nodes.some(n => n.id === selection.id);
    const rfEdges = edges.map(e => {
      const isDirectlySelected = e.id === selection.id;
      const isConnected = selectedIsNode && (e.source === selection.id || e.target === selection.id);
      if (!isDirectlySelected && !isConnected) return e;
      return {
        ...e,
        // Inject highlighted flag so custom edge types (FeatureTypingEdge, CompositionEdge)
        // can switch their inline marker colors alongside the stroke.
        data: { ...(e.data ?? {}), highlighted: true },
        // Style override for built-in / ElkEdge types which read the style prop directly.
        style: { ...(e.style as object), stroke: SEL_BORDER, strokeWidth: 2.5 },
        labelStyle: { ...(e.labelStyle as object), fill: SEL_BORDER },
        markerEnd: { type: MarkerType.ArrowClosed, color: SEL_BORDER, width: 14, height: 14 },
        zIndex: (typeof e.zIndex === 'number' ? e.zIndex : 0) + 20,
      };
    });

    return { rfNodes, rfEdges };
  }, [displayNodes, displayEdges, baseNodes, baseEdges, selection]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((_e: ReactMouseEvent, node: Node) => {
    const s = node.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  const handleEdgeClick = useCallback((_e: ReactMouseEvent, edge: Edge) => {
    const s = edge.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  // ── Element dropdown entries ──────────────────────────────────────────────────
  const dropdownEntries = useMemo(() => {
    return baseNodes
      .filter(n => !n.id.startsWith('inst-') && !n.id.startsWith('conn-fallback'))
      .map(n => {
        const sel = n.data._sel as SelectionState | null;
        const name = sel?.name ?? n.id;
        const kind = n.id.startsWith('def-')      ? 'part def'
                   : n.id.startsWith('portdef-')  ? 'port def'
                   : n.id.startsWith('actdef-')   ? 'action def'
                   : n.id.startsWith('itemdef-')  ? 'item def'
                   : n.id.startsWith('attrdef-')  ? 'attr def'
                   : n.id.startsWith('iface-')    ? 'interface def'
                   : n.id.startsWith('usage-')    ? 'part'
                   : n.id.startsWith('occ-')      ? 'occurrence def'
                   : '';
        return { id: n.id, name, kind, label: kind ? `«${kind}» ${name}` : name };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [baseNodes]);

  if (baseNodes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: 14, gap: 8 }}>
        Add <code style={{ background: '#313244', padding: '2px 6px', borderRadius: 4 }}>part def</code> or
        <code style={{ background: '#313244', padding: '2px 6px', borderRadius: 4 }}>interface def</code>
      </div>
    );
  }

  return (
    <LayoutDirCtx.Provider value="lr">
      <div style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onNodeContextMenu={(e, n) => { const s = n.data?._sel as SelectionState; if (s) onShapeContextMenu?.(e, s); }}
          onEdgeContextMenu={(e, ed) => { const s = ed.data?._sel as SelectionState; if (s) onShapeContextMenu?.(e, s); }}
          fitViewOptions={{ padding: 0.18 }}
        >
          <Background color="#2a2a3a" gap={24} />
          <Controls />
          <FitPanel autoFitVersion={autoFitVersion} onReset={() => setResetVersion(v => v + 1)} />
          <Panel position="top-left">
            <select
              value={focusedNodeId ?? ''}
              onChange={e => setFocusedNodeId(e.target.value || null)}
              style={{
                background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #45475a',
                borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer',
                maxWidth: 280, outline: 'none',
              }}
            >
              <option value="">— Show all elements —</option>
              {dropdownEntries.map(e => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </Panel>
          <Panel position="bottom-right">
            <StructureLegend />
          </Panel>
        </ReactFlow>
      </div>
    </LayoutDirCtx.Provider>
  );
}
