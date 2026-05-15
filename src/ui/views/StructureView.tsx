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
import { ElkEdge } from '../layout/ElkEdge';
import { applyElkLayout } from '../layout/graphLayout';

// ── Layout direction context (consumed by custom node type) ───────────────────

const LayoutDirCtx = createContext<'lr' | 'tb'>('lr');

// ── Layout constants ──────────────────────────────────────────────────────────

const MIN_NODE_W   = 148;
const H_PAD_NODE   = 20;  // 2 × 10 px horizontal padding from 'padding: 6px 10px'
const PART_BASE_H  = 48;
const PORT_TOP     = 6;
const PORT_ROW_H   = 18;
const GRP_PAD_X    = 20;
const GRP_PAD_TOP  = 34;
const GRP_PAD_BOT  = 18;
const INST_V_GAP   = 12;   // vertical gap between stacked instances inside a group

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

// ── FeatureTyping custom edge ─────────────────────────────────────────────────
// Renders <defs> INSIDE ReactFlow's SVG (critical: url(#id) only resolves within
// the same <svg> element in Chrome). Each edge instance writes its own marker
// using a unique id to avoid duplicate-id conflicts across edge instances.

const FT_COLOR = '#94a3b8';

function FeatureTypingEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 4,
  });
  const mid = `sysml-ft-${id}`;
  return (
    <g>
      <defs>
        {/* Closed arrowhead with two preceding dots — official SysML v2 FeatureTyping */}
        <marker id={mid} viewBox="-2 -5 20 10" refX="16" refY="0"
          markerWidth="18" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 6,-4 L 16,0 L 6,4 Z" fill={FT_COLOR} />
          <circle cx="2"  cy="0" r="1.8" fill={FT_COLOR} />
          <circle cx="-1" cy="0" r="1.8" fill={FT_COLOR} />
        </marker>
      </defs>
      <BaseEdge id={id} path={edgePath}
        style={{ stroke: FT_COLOR, strokeWidth: 1 }}
        markerEnd={`url(#${mid})`}
      />
    </g>
  );
}

// ── Legend panel ──────────────────────────────────────────────────────────────

function StructureLegend() {
  const row = (color: string, label: string, marker: 'ft' | 'arrow' | 'diamond') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
      <svg width="34" height="12" style={{ flexShrink: 0, overflow: 'visible' }}>
        <line x1="2" y1="6" x2={marker === 'ft' ? 18 : 26} y2="6" stroke={color} strokeWidth="1.2" />
        {marker === 'ft' && <>
          {/* Closed arrow tip */}
          <polygon points="34,6 22,2.5 22,9.5" fill={color} />
          {/* Two dots */}
          <circle cx="20" cy="6" r="1.5" fill={color} />
          <circle cx="17" cy="6" r="1.5" fill={color} />
        </>}
        {marker === 'arrow' && <polygon points="32,6 26,3 26,9" fill={color} />}
        {marker === 'diamond' && <polygon points="2,6 8,3 14,6 8,9" fill={color} />}
      </svg>
      <span>{label}</span>
    </div>
  );
  return (
    <div style={{
      background: 'rgba(15,17,26,0.88)', border: '1px solid #1e2535',
      borderRadius: 6, padding: '7px 11px', display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.5px', marginBottom: 1 }}>NOTATION</div>
      {row(FT_COLOR,   'FeatureTyping  (usage → type)', 'ft')}
      {row('#4ade80',  'Connection',                     'arrow')}
      {row('#22c55e',  'Composition  (◆ at owner)',      'diamond')}
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
  const radius = shape === 'usage' ? 12 : 2;
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
    makeBoundaryPortDisplay(p.name, p.name, p.direction, p.portType ?? '')
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

// ── Composition-group container node (needs left/right handles for col edges) ─

function SysmlGroupNode({ data }: NodeProps) {
  return (
    <>
      <Handle type="source" position={Position.Left}  id="__source_left"  style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right} id="__target_right" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="__source"       style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}  id="__target"       style={{ opacity: 0 }} />
      {data['label'] as React.ReactNode}
    </>
  );
}

// ── Column layout constants ───────────────────────────────────────────────────

const COL_H_GAP   = 220;  // horizontal gap between the three columns
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
}

export default function StructureView({ result, graph, selection, onSelect }: Props) {
  const [displayNodes,   setDisplayNodes]   = useState<Node[]>([]);
  const [displayEdges,   setDisplayEdges]   = useState<Edge[]>([]);
  const [autoFitVersion, setAutoFitVersion] = useState(0);

  // nodeTypes / edgeTypes are stable references
  const nodeTypes = useMemo(() => ({ sysmlPart: SysmlPartNode, sysmlGroup: SysmlGroupNode }), []);
  const edgeTypes = useMemo(() => ({ elkEdge: ElkEdge, featureTypingEdge: FeatureTypingEdge }), []);

  // ── Pass 1: manual layout (recomputes when model changes) ─────────────────
  const { baseNodes, baseEdges } = useMemo(() => {
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
    type CN   = Extract<VizNode, { kind: 'connection' }>;
    type ID   = Extract<VizNode, { kind: 'interfaceDef' }>;
    type PRD  = Extract<VizNode, { kind: 'portDef' }>;
    type ITMD = Extract<VizNode, { kind: 'itemDef' }>;
    type BD   = Extract<VizNode, { kind: 'behaviorDef' }>;

    const ifaceDefs    = result.nodes.filter((n): n is ID   => n.kind === 'interfaceDef');
    const portDefs     = result.nodes.filter((n): n is PRD  => n.kind === 'portDef');
    const attrDefs     = result.nodes.filter((n): n is AD   => n.kind === 'attributeDef');
    const itemDefs     = result.nodes.filter((n): n is ITMD => n.kind === 'itemDef');
    const behaviorDefs = result.nodes.filter((n): n is BD   => n.kind === 'behaviorDef');
    const allPartDefs  = result.nodes.filter((n): n is PD   => n.kind === 'partDef');
    const allPartUsages = result.nodes.filter((n): n is PU  => n.kind === 'partUsage');
    const partDefMap   = new Map(allPartDefs.map(n => [n.name, n]));
    // Only treat a partAlias as a composition reference when it has a non-empty
    // type that matches a known PartDef.  ItemUsage / OccurrenceUsage also map
    // to partAlias but carry type='' → they must not trigger composition groups.
    const isCompAlias  = (b: VizNode) =>
      b.kind === 'partAlias' && !!b.type && partDefMap.has(b.type);
    const composedDefs = allPartDefs.filter(n =>  n.body.some(isCompAlias));
    const typePartDefs = allPartDefs.filter(n => !n.body.some(isCompAlias));


    // Split partUsages: composed (contain child partAlias instances) vs standalone
    // (no partAlias body — package-scope declarations like "part x : MyType;").
    const composedUsages   = allPartUsages.filter(n =>  n.body.some(isCompAlias));
    const standaloneUsages = allPartUsages.filter(n => !n.body.some(isCompAlias));

    // Combined composition blocks: partDef groups + composed PartUsage blocks.
    // Standalone partUsages (no child instances) are rendered separately below.
    type CompBlock = { name: string; line: number; body: VizNode[]; stereotype: string; isDefinition: boolean };
    const allComposed: CompBlock[] = [
      ...composedDefs.map(n => ({ name: n.name, line: n.line, body: n.body, stereotype: '«part def»', isDefinition: true })),
      ...composedUsages.map(n => ({
        name: n.name, line: n.line, body: n.body,
        stereotype: n.type ? `«part» : ${n.type}` : '«part»',
        isDefinition: false,
      })),
    ];

    const allOccs           = result.nodes.filter((n): n is OD => n.kind === 'occurrenceDef');
    const legacyStructOccs  = allOccs.filter(o => o.body.some(b => b.kind === 'partAlias'));
    const scenarios         = allOccs.filter(o => !o.body.some(b => b.kind === 'partAlias'));

    // ── Pre-compute column X positions ────────────────────────────────────────
    // Column 1 (left):   port defs + interface defs
    // Column 2 (middle): part defs + attr defs + item defs + behavior defs
    // Column 3 (right):  composition groups + part usages + occurrence defs
    const col1MaxW = Math.max(MIN_NODE_W,
      ...ifaceDefs.map(n => nodeWidth('«interface def»', n.name, [])),
      ...portDefs.map(n  => nodeWidth('«port def»',       n.name, [])),
    );
    const col2MaxW = Math.max(MIN_NODE_W,
      ...attrDefs.map(n => {
        const a = n.body.filter((b): b is AU => b.kind === 'attributeUsage');
        return nodeWidth('«attribute def»', n.name, a);
      }),
      ...typePartDefs.map(n => {
        const p = n.body.filter((b): b is PortLike => b.kind === 'port');
        const a = n.body.filter((b): b is AU => b.kind === 'attributeUsage');
        return nodeWidth('«part def»', n.name, a, p.length > 0 ? undefined : undefined);
      }),
      ...itemDefs.map(n  => nodeWidth('«item def»',   n.name, [])),
      ...behaviorDefs.map(n => nodeWidth('«action def»', n.name, [])),
    );
    const col3MaxW = Math.max(MIN_NODE_W,
      ...standaloneUsages.map(n => {
        const stereo = n.type ? `«part» : ${n.type}` : '«part»';
        return nodeWidth(stereo, n.name, []);
      }),
      ...allComposed.map(compDef => {
        const aliases = compDef.body.filter((b): b is PA => b.kind === 'partAlias');
        const maxInstW = aliases.reduce((m, alias) => {
          const stereo = `${alias.name} : ${alias.type}`;
          return Math.max(m, nodeWidth(stereo, '', []), MIN_NODE_W);
        }, MIN_NODE_W);
        return 2 * GRP_PAD_X + maxInstW;
      }),
      ...legacyStructOccs.map(n => nodeWidth('«occurrence def»', n.name, [])),
      ...scenarios.map(n => nodeWidth('«scenario»', n.name, [])),
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
      ...typePartDefs.map(n => ({
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
      col2Y += PART_BASE_H + V_STACK_GAP;
    }

    // ── Column 3 ─ Standalone part usages ─────────────────────────────────────
    const partUsageGid = gid('PartUsage');
    for (const n of standaloneUsages) {
      const nodeId    = `usage-${n.name}`;
      const gidVal    = partUsageGid(n.name);
      const graphPorts = getGraphPorts(gidVal);
      const stereoSU  = n.type ? `«part» : ${n.type}` : '«part»';
      const w3su      = nodeWidth(stereoSU, n.name, []);
      baseNodes.push(makePartNode(
        nodeId, { x: C3CX - w3su / 2, y: col3Y },
        stereoSU, n.name, graphPorts, PAL.inst, undefined,
        { id: nodeId, type: 'instance' as const, name: n.name,
          extra: { ...(n.type ? { type: n.type } : {}), parent: n.namespace, ...(gidVal ? { graphId: gidVal } : {}) } },
        [],
        w3su,
        'usage',
      ));
      regGid(gidVal, nodeId);
      col3Y += PART_BASE_H + V_STACK_GAP;

      // FeatureTyping connector: usage → definition (official SysML v2 notation)
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
            sourceHandle: '__source_left', targetHandle: '__target_right',
            type: 'featureTypingEdge',
            zIndex: 5,
          });
        }
      }
    }

    // ── Column 3 ─ Composed part defs (groups) + named PartUsage blocks ────────
    const grpPartDefGid = gid('PartDefinition', 'PartUsage');
    for (const compDef of allComposed) {
      const aliases     = compDef.body.filter((b): b is PA => b.kind === 'partAlias');
      const connections = compDef.body.filter((b): b is CN => b.kind === 'connection');

      const instanceMeta = aliases.map(alias => {
        const typeDef = partDefMap.get(alias.type);
        const ports   = typeDef ? typeDef.body.filter((b): b is PortLike => b.kind === 'port') : [];
        const stereo  = `${alias.name} : ${alias.type}`;
        const instW   = Math.max(nodeWidth(stereo, '', [], undefined), MIN_NODE_W);
        return { alias, ports, h: partH(ports.length), instW };
      });
      const maxInstW = instanceMeta.reduce((m, d) => Math.max(m, d.instW), MIN_NODE_W);
      const nInst    = aliases.length;
      const groupW   = 2 * GRP_PAD_X + maxInstW;
      const groupH   = GRP_PAD_TOP + instanceMeta.reduce((s, m) => s + m.h, 0) + Math.max(0, nInst - 1) * INST_V_GAP + GRP_PAD_BOT;

      const grpGid  = grpPartDefGid(compDef.name);
      const grpRfId = `grp-${compDef.name}`;
      regGid(grpGid, grpRfId);
      baseNodes.push({
        id: grpRfId,
        type: 'sysmlGroup',
        position: { x: C3CX - groupW / 2, y: col3Y },
        className: 'comp-group',
        data: {
          label: `${compDef.stereotype}  ${compDef.name}`,
          _sel: { id: grpRfId, type: 'systemPart', name: compDef.name, line: compDef.line,
            ...(grpGid ? { extra: { graphId: grpGid } } : {}),
          } satisfies SelectionState,
        },
        style: {
          width: groupW, height: groupH,
          background: '#040f08', border: '1.5px solid #22c55e',
          borderRadius: compDef.isDefinition ? 2 : 12,
          fontSize: 10.5, color: '#4ade80', fontStyle: 'italic',
          display: 'flex', alignItems: 'flex-start', padding: '8px 12px',
          cursor: 'pointer',
        },
        selectable: true,
        draggable: false,
        zIndex: -1,
      });

      let runY = GRP_PAD_TOP;
      for (const { alias, ports, h, instW: iW } of instanceMeta) {
        const instGid  = partUsageGid(alias.name);
        const instRfId = `inst-${compDef.name}-${alias.name}`;
        regGid(instGid, instRfId);
        const instX = GRP_PAD_X + Math.round((maxInstW - iW) / 2);
        baseNodes.push(makePartNode(
          instRfId, { x: instX, y: runY },
          `${alias.name} : ${alias.type}`, '', ports, PAL.inst,
          { parentId: `grp-${compDef.name}`, extent: 'parent',
            style: { background: PAL.inst.bg, border: `1px solid ${PAL.inst.border}`,
              borderRadius: 12, padding: '6px 10px', width: iW, height: h } },
          { id: `inst-${compDef.name}-${alias.name}`, type: 'instance', name: alias.name, line: alias.line,
            extra: { type: alias.type, parent: compDef.name, ...(instGid ? { graphId: instGid } : {}) } },
        ));
        // FeatureTyping connector: instance usage → its type definition
        if (alias.type && baseNodes.some(bn => bn.id === `def-${alias.type}`)) {
          baseEdges.push({
            id: `typing-inst-${compDef.name}-${alias.name}`,
            source: instRfId, target: `def-${alias.type}`,
            sourceHandle: '__source_left', targetHandle: '__target_right',
            type: 'featureTypingEdge',
            zIndex: 5,
          });
        }
        runY += h + INST_V_GAP;
      }

      for (const conn of connections) {
        const edgeId = `conn-${compDef.name}-${conn.fromPart}.${conn.fromPort}-${conn.toPart}.${conn.toPort}`;
        baseEdges.push({
          id: edgeId,
          source: `inst-${compDef.name}-${conn.fromPart}`,
          target: `inst-${compDef.name}-${conn.toPart}`,
          sourceHandle: conn.fromPort ? `port-${conn.fromPort}-out` : '__source',
          targetHandle: conn.toPort   ? `port-${conn.toPort}`      : '__target',
          type: 'straight',
          ...(conn.connType ? {
            label: conn.connType,
            labelStyle:   { fontSize: 9, fill: '#4ade80', fontFamily: 'monospace' },
            labelBgStyle: { fill: '#040f08', fillOpacity: 0.9 },
          } : {}),
          style: { stroke: '#4ade80', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#4ade80', width: 11, height: 11 },
          zIndex: 20,
          data: {
            _sel: {
              id: edgeId, type: 'connection',
              name: conn.connType
                ? `${conn.fromPart}.${conn.fromPort} → ${conn.toPart}.${conn.toPort} : ${conn.connType}`
                : `${conn.fromPart}.${conn.fromPort} → ${conn.toPart}.${conn.toPort}`,
              line: conn.line,
              extra: { fromPart: conn.fromPart, fromPort: conn.fromPort,
                       toPart: conn.toPart, toPort: conn.toPort, parent: compDef.name,
                       ...(conn.connType ? { connType: conn.connType } : {}) },
            } satisfies SelectionState,
          },
        });
      }

      // FeatureTyping connectors: group node (col3) → port/interface defs (col1)
      // for any ports declared directly on the composed part def
      const grpPorts = compDef.body.filter((b): b is PortLike => b.kind === 'port');
      for (const port of grpPorts) {
        if (!port.portType) continue;
        const targetId =
          baseNodes.some(n => n.id === `portdef-${port.portType}`) ? `portdef-${port.portType}` :
          baseNodes.some(n => n.id === `iface-${port.portType}`)   ? `iface-${port.portType}`   :
          null;
        if (!targetId) continue;
        baseEdges.push({
          id: `typing-port-${grpRfId}-${port.name}->${targetId}`,
          source: grpRfId, target: targetId,
          sourceHandle: '__source_left', targetHandle: '__target_right',
          type: 'featureTypingEdge',
          zIndex: 5,
        });
      }

      col3Y += groupH + V_STACK_GAP;
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
          baseEdges.push({
            id: edgeId, source: srcRf, target: tgtRf,
            type: 'smoothstep', label: 'connects',
            style:        { stroke: '#4ade80', strokeWidth: 1.5 },
            labelStyle:   { fontSize: 9, fill: '#4ade80', fontFamily: 'monospace' },
            labelBgStyle: { fill: '#040f08', fillOpacity: 0.88 },
            markerEnd:    { type: MarkerType.ArrowClosed, color: '#4ade80', width: 10, height: 10 },
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
            sourceHandle: '__source_left', targetHandle: '__target_right',
            type: 'featureTypingEdge',
            zIndex: 5,
          });
        }
      }
    }

    return { baseNodes, baseEdges };
  }, [result, graph]);

  // ── Layout effect ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    applyElkLayout(baseNodes, baseEdges, 'lr').then(({ nodes: positioned, edgeRoutes }) => {
      if (cancelled) return;
      // Keep explicit draggable: false on group containers; enable on all other nodes.
      setDisplayNodes(positioned.map(n => ({ ...n, draggable: n.draggable !== false })));
      // Apply ELK obstacle-avoiding routes to edges so they render as polylines
      // that stay clear of every node face, not as naive smoothstep curves.
      setDisplayEdges(baseEdges.map(e => {
        const waypoints = edgeRoutes.get(e.id);
        if (!waypoints) return e;
        // Edges with explicit handles connect at the correct node-border point via
        // smoothstep — don't replace them with ElkEdge which would add arms.
        if (e.sourceHandle || e.targetHandle) return e;
        return { ...e, type: 'elkEdge', data: { ...(e.data ?? {}), waypoints } };
      }));
      setAutoFitVersion(v => v + 1);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseNodes, baseEdges]);

  // ── Drag handler ──────────────────────────────────────────────────────────────
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setDisplayNodes(prev => applyNodeChanges(changes, prev));
  }, []);

  // ── Pass 2: apply selection highlight ────────────────────────────────────────
  const { rfNodes, rfEdges } = useMemo(() => {
    const nodes = displayNodes.length > 0 ? displayNodes : baseNodes;
    const edges = displayEdges.length > 0 ? displayEdges : baseEdges;

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

    const rfEdges = edges.map(e => {
      if (e.id !== selection.id) return e;
      return {
        ...e,
        style: { stroke: SEL_BORDER, strokeWidth: 2.5 },
        labelStyle: { ...(e.labelStyle as object), fill: SEL_BORDER },
        markerEnd: { type: MarkerType.ArrowClosed, color: SEL_BORDER, width: 14, height: 14 },
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

  if (rfNodes.length === 0) {
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
          fitViewOptions={{ padding: 0.18 }}
        >
          <Background color="#2a2a3a" gap={24} />
          <Controls />
          <FitPanel autoFitVersion={autoFitVersion} />
          <Panel position="top-right">
            <StructureLegend />
          </Panel>
        </ReactFlow>
      </div>
    </LayoutDirCtx.Provider>
  );
}
