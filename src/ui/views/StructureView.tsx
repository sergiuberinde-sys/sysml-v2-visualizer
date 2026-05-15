import { useMemo, useCallback, useState, useEffect, useRef, createContext, useContext } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  Handle, Position, applyNodeChanges,
  type Node, type Edge, type NodeChange, type NodeProps,
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
import { applyElkLayout, LAYOUT_LABELS, type LayoutMode } from '../layout/graphLayout';

// ── Layout direction context (consumed by custom node type) ───────────────────

const LayoutDirCtx = createContext<'lr' | 'tb'>('lr');

// ── Layout constants ──────────────────────────────────────────────────────────

const MIN_NODE_W   = 148;
const H_PAD_NODE   = 20;  // 2 × 10 px horizontal padding from 'padding: 6px 10px'
const PART_BASE_H  = 48;
const PORT_TOP     = 6;
const PORT_ROW_H   = 18;
const IFACE_H      = 40;
const COL_GAP      = 32;
const ROW_GAP      = 80;
const GRP_PAD_X    = 20;
const GRP_PAD_TOP  = 34;
const GRP_PAD_BOT  = 18;
const INST_GAP     = 60;

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
): Node {
  const w = nodeWidth(stereotype, name, attrs, forceWidth);
  const h = (ports.length > 0 || attrs.length > 0) ? partH(ports.length, attrs.length) : PART_BASE_H;
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
      borderRadius: 7, padding: '6px 10px', width: w, height: h,
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
      {/* Generic handles for occurrence→def edges (invisible) */}
      <Handle type="target" position={targetPos} id="__target" style={{ opacity: 0 }} />
      <Handle type="source" position={sourcePos} id="__source" style={{ opacity: 0 }} />

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

// ── Row layout helper ─────────────────────────────────────────────────────────

type Pos = { x: number; y: number };

/** Centre a row of nodes around x = 0.  widths[i] is the computed width of names[i]. */
function centeredRow(names: string[], y: number, widths?: number[]): Map<string, Pos> {
  const ws    = widths ?? names.map(() => MIN_NODE_W);
  const total = ws.reduce((s, w) => s + w, 0) + Math.max(0, names.length - 1) * COL_GAP;
  const map   = new Map<string, Pos>();
  let x = -(total / 2);
  for (let i = 0; i < names.length; i++) {
    map.set(names[i], { x, y });
    x += ws[i] + COL_GAP;
  }
  return map;
}

// ── Selection highlight colours ───────────────────────────────────────────────

const SEL_BORDER = '#89b4fa';
const SEL_GLOW   = '0 0 10px 2px #89b4fa33';

// ── Layout toolbar styles ─────────────────────────────────────────────────────

const TOOLBAR: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '5px 10px', borderBottom: '1px solid #1a1a2e',
  background: '#06060f', flexShrink: 0, flexWrap: 'wrap',
};

function modeBtn(active: boolean): CSSProperties {
  return {
    background: active ? '#151f36' : 'transparent',
    border: `1px solid ${active ? '#3b82f6' : '#2a2a3a'}`,
    color: active ? '#93c5fd' : '#6b7280',
    borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11,
  };
}

const actionBtn: CSSProperties = {
  background: '#111827', border: '1px solid #2a2a3a',
  color: '#9ca3af', borderRadius: 4, padding: '2px 9px',
  cursor: 'pointer', fontSize: 11, marginLeft: 4,
};


// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  result: VisualizerModel;
  graph?: ContainmentGraph;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
}

export default function StructureView({ result, graph, selection, onSelect }: Props) {
  const [layoutMode,     setLayoutMode]     = useState<LayoutMode>('lr');
  const [displayNodes,   setDisplayNodes]   = useState<Node[]>([]);
  const [displayEdges,   setDisplayEdges]   = useState<Edge[]>([]);
  const [savedPositions, setSavedPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [layoutKey,      setLayoutKey]      = useState(0);
  const [autoFitVersion, setAutoFitVersion] = useState(0);
  const [fitMode,        setFitMode]        = useState(false);

  // Always-current ref so useEffect can read savedPositions without it as a dep
  const savedPositionsRef = useRef(savedPositions);
  savedPositionsRef.current = savedPositions;

  // nodeTypes / edgeTypes are stable references
  const nodeTypes = useMemo(() => ({ sysmlPart: SysmlPartNode }), []);
  const edgeTypes = useMemo(() => ({ elkEdge: ElkEdge }), []);

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
    type CompBlock = { name: string; line: number; body: VizNode[]; stereotype: string };
    const allComposed: CompBlock[] = [
      ...composedDefs.map(n => ({ name: n.name, line: n.line, body: n.body, stereotype: '«part def»' })),
      ...composedUsages.map(n => ({
        name: n.name, line: n.line, body: n.body,
        stereotype: n.type ? `«part» : ${n.type}` : '«part»',
      })),
    ];

    const allOccs           = result.nodes.filter((n): n is OD => n.kind === 'occurrenceDef');
    const legacyStructOccs  = allOccs.filter(o => o.body.some(b => b.kind === 'partAlias'));
    const scenarios         = allOccs.filter(o => !o.body.some(b => b.kind === 'partAlias'));

    let curY = 0;

    // Section 0: Interface defs (purple) and Port defs (indigo) — connection-point types
    // Both share the same row; IDs are prefixed to avoid name collisions.
    const ifaceGid = gid('InterfaceDefinition', 'ConnectionDefinition');
    const portDefGid = gid('PortDefinition');
    const connSection0 = [
      ...ifaceDefs.map(n => ({
        nodeId:  `iface-${n.name}`,
        name:    n.name,
        stereo:  '«interface def»',
        palette: PAL.iface,
        sel:     { id: `iface-${n.name}`,   type: 'interface' as const, name: n.name, line: n.line,
          ...(ifaceGid(n.name) ? { extra: { graphId: ifaceGid(n.name)! } } : {}),
        },
      })),
      ...portDefs.map(n => ({
        nodeId:  `portdef-${n.name}`,
        name:    n.name,
        stereo:  '«port def»',
        palette: PAL.portDef,
        sel:     { id: `portdef-${n.name}`, type: 'port'      as const, name: n.name, line: n.line,
          ...(portDefGid(n.name) ? { extra: { graphId: portDefGid(n.name)! } } : {}),
        },
      })),
    ];
    if (connSection0.length > 0) {
      const sec0Widths = connSection0.map(c => nodeWidth(c.stereo, c.name, []));
      const pos = centeredRow(connSection0.map(c => c.nodeId), curY, sec0Widths);
      for (const c of connSection0) {
        baseNodes.push(makePartNode(
          c.nodeId, pos.get(c.nodeId)!, c.stereo, c.name, [], c.palette,
          undefined, c.sel,
        ));
        regGid(c.sel.extra?.graphId as string | undefined, c.nodeId);
      }
      curY += IFACE_H + ROW_GAP;
    }

    // Section 0.5: Attribute definitions — «attribute def» boxes (cyan palette)
    const attrDefGid = gid('AttributeDefinition');
    if (attrDefs.length > 0) {
      const attrDefMeta = attrDefs.map(n => {
        const attrs = n.body.filter((b): b is AU => b.kind === 'attributeUsage');
        return { n, attrs, h: partH(0, attrs.length), w: nodeWidth('«attribute def»', n.name, attrs) };
      });
      const maxH = attrDefMeta.reduce((m, d) => Math.max(m, d.h), PART_BASE_H);
      const pos = centeredRow(attrDefs.map(n => n.name), curY, attrDefMeta.map(m => m.w));
      for (const { n, attrs } of attrDefMeta) {
        const gidVal = attrDefGid(n.name);
        const nodeId = `attrdef-${n.name}`;
        baseNodes.push(makePartNode(
          nodeId, pos.get(n.name)!, '«attribute def»', n.name, [], PAL.attr,
          undefined,
          { id: nodeId, type: 'part', name: n.name, line: n.line,
            ...(gidVal ? { extra: { graphId: gidVal } } : {}),
          },
          attrs,
        ));
        regGid(gidVal, nodeId);
      }
      curY += maxH + ROW_GAP;
    }

    // Section 1: Type-library defs — part defs (blue) and item defs (amber)
    // Item defs are rendered alongside part defs since both are structural type references.
    const partDefGid = gid('PartDefinition');
    const itemDefGid = gid('ItemDefinition');
    type Section1Entry = { nodeId: string; stereo: string; name: string; ports: PortLike[]; attrs: AU[]; palette: Palette; sel: NonNullable<Parameters<typeof makePartNode>[7]> };
    const section1Entries: Section1Entry[] = [
      ...typePartDefs.map(n => ({
        nodeId: `def-${n.name}`,
        stereo: '«part def»',
        name:   n.name,
        ports:  n.body.filter((b): b is PortLike => b.kind === 'port'),
        attrs:  n.body.filter((b): b is AU => b.kind === 'attributeUsage'),
        palette: PAL.type,
        sel: { id: `def-${n.name}`, type: 'part' as const, name: n.name, line: n.line,
          ...(partDefGid(n.name) ? { extra: { graphId: partDefGid(n.name)! } } : {}),
        },
      })),
      ...itemDefs.map(n => ({
        nodeId: `itemdef-${n.name}`,
        stereo: '«item def»',
        name:   n.name,
        ports:  [] as PortLike[],
        attrs:  [] as AU[],
        palette: PAL.item,
        sel: { id: `itemdef-${n.name}`, type: 'part' as const, name: n.name, line: n.line,
          ...(itemDefGid(n.name) ? { extra: { graphId: itemDefGid(n.name)! } } : {}),
        },
      })),
    ];
    if (section1Entries.length > 0) {
      let maxH = PART_BASE_H;
      const sec1Widths = section1Entries.map(e => nodeWidth(e.stereo, e.name, e.attrs));
      const pos = centeredRow(section1Entries.map(e => e.nodeId), curY, sec1Widths);
      for (const e of section1Entries) {
        const h = partH(e.ports.length, e.attrs.length);
        maxH = Math.max(maxH, h);
        baseNodes.push(makePartNode(
          e.nodeId, pos.get(e.nodeId)!, e.stereo, e.name, e.ports, e.palette,
          undefined, e.sel, e.attrs,
        ));
        regGid(e.sel.extra?.graphId as string | undefined, e.nodeId);
      }
      curY += maxH + ROW_GAP;
    }

    // Section 1.3: Action / behavior definitions — «action def» boxes (lime palette).
    // ActionDefinition nodes arrive here as 'behaviorDef' kind (official adapter mapping).
    // Rendered with «action def» stereotype so they are distinguishable from part defs.
    // Clicking selects type:'behavior' so resolveGraphNodeId can locate the graph node.
    const actDefGid = gid('ActionDefinition', 'BehaviorDefinition');
    if (behaviorDefs.length > 0) {
      const nodeIds = behaviorDefs.map(n => `actdef-${n.name}`);
      const actWidths = behaviorDefs.map(n => nodeWidth('«action def»', n.name, []));
      const pos = centeredRow(nodeIds, curY, actWidths);
      let maxH = PART_BASE_H;
      for (const n of behaviorDefs) {
        const nodeId = `actdef-${n.name}`;
        maxH = Math.max(maxH, PART_BASE_H);
        const gidVal = actDefGid(n.name);
        baseNodes.push(makePartNode(
          nodeId,
          pos.get(nodeId)!,
          '«action def»',
          n.name,
          [],
          PAL.actDef,
          undefined,
          { id: nodeId, type: 'behavior' as const, name: n.name, line: n.line,
            ...(gidVal ? { extra: { graphId: gidVal } } : {}),
          },
        ));
        regGid(gidVal, nodeId);
      }
      curY += maxH + ROW_GAP;
    }

    // Section 1.5: Standalone part usages — package-scope "part x : Type;" declarations.
    // Rendered as individual usage boxes (not composition groups) with «part» stereotype.
    // Clicking reveals type context in the Inspector's Impact section (typedBy relationship).
    const partUsageGid = gid('PartUsage');
    if (standaloneUsages.length > 0) {
      const usageNodeIds = standaloneUsages.map(n => `usage-${n.name}`);
      const usageWidths = standaloneUsages.map(n => nodeWidth(n.type ? `«part» : ${n.type}` : '«part»', n.name, []));
      const pos = centeredRow(usageNodeIds, curY, usageWidths);
      for (const n of standaloneUsages) {
        const nodeId = `usage-${n.name}`;
        const gidVal = partUsageGid(n.name);
        // Enrich with ports from ContainmentGraph when available.
        const graphPorts = getGraphPorts(gidVal);
        baseNodes.push(makePartNode(
          nodeId,
          pos.get(nodeId)!,
          n.type ? `«part» : ${n.type}` : '«part»',
          n.name,
          graphPorts,
          PAL.inst,
          undefined,
          {
            id: nodeId,
            type: 'instance' as const,
            name: n.name,
            extra: {
              ...(n.type ? { type: n.type } : {}),
              parent: n.namespace,
              ...(gidVal ? { graphId: gidVal } : {}),
            },
          },
        ));
        regGid(gidVal, nodeId);
        // Add a dashed «typedBy» edge to the type def box if it is visible in section 1.
        if (n.type) {
          const typeBoxId = `def-${n.type}`;
          if (baseNodes.some(bn => bn.id === typeBoxId)) {
            baseEdges.push({
              id: `usage-${n.name}->typedBy->${typeBoxId}`,
              source: nodeId,
              target: typeBoxId,
              type: 'smoothstep',
              label: ': type',
              style: { stroke: '#22c55e', strokeWidth: 1, strokeDasharray: '5 3' },
              labelStyle: { fontSize: 9, fill: '#4ade80', fontFamily: 'monospace' },
              labelBgStyle: { fill: '#040f08', fillOpacity: 0.88 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e', width: 11, height: 11 },
              zIndex: 10,
            });
          }
        }
      }
      curY += PART_BASE_H + ROW_GAP;
    }

    // Section 2: Composed part defs (groups) + named PartUsage blocks
    const grpPartDefGid = gid('PartDefinition', 'PartUsage');
    for (const compDef of allComposed) {
      const aliases     = compDef.body.filter((b): b is PA => b.kind === 'partAlias');
      const connections = compDef.body.filter((b): b is CN => b.kind === 'connection');

      const instanceMeta = aliases.map(alias => {
        const typeDef = partDefMap.get(alias.type);
        const ports   = typeDef ? typeDef.body.filter((b): b is PortLike => b.kind === 'port') : [];
        const stereo  = `${alias.name} : ${alias.type}`;
        // Each instance gets its own content-fitted width — no forced uniformity.
        const instW   = Math.max(nodeWidth(stereo, '', [], undefined), MIN_NODE_W);
        return { alias, ports, h: partH(ports.length), instW };
      });
      const maxInstH = instanceMeta.reduce((m, d) => Math.max(m, d.h), PART_BASE_H);

      const nInst  = aliases.length;
      const groupW = 2 * GRP_PAD_X
        + instanceMeta.reduce((s, m) => s + m.instW, 0)
        + Math.max(0, nInst - 1) * INST_GAP;
      const groupH = GRP_PAD_TOP + maxInstH + GRP_PAD_BOT;
      const groupX = -(groupW / 2);

      const grpGid = grpPartDefGid(compDef.name);
      const grpRfId = `grp-${compDef.name}`;
      regGid(grpGid, grpRfId);
      baseNodes.push({
        id: grpRfId,
        position: { x: groupX, y: curY },
        className: 'comp-group',
        data: {
          label: `${compDef.stereotype}  ${compDef.name}`,
          _sel: { id: grpRfId, type: 'systemPart', name: compDef.name, line: compDef.line,
            ...(grpGid ? { extra: { graphId: grpGid } } : {}),
          } satisfies SelectionState,
        },
        style: {
          width: groupW, height: groupH,
          background: '#040f08', border: '1.5px solid #22c55e', borderRadius: 10,
          fontSize: 10.5, color: '#4ade80', fontStyle: 'italic',
          display: 'flex', alignItems: 'flex-start', padding: '8px 12px',
          cursor: 'pointer',
        },
        selectable: true,
        draggable: false,
        zIndex: -1,
      });

      let runX = GRP_PAD_X;
      for (const { alias, ports, h, instW: iW } of instanceMeta) {
        const instGid  = partUsageGid(alias.name);
        const instRfId = `inst-${compDef.name}-${alias.name}`;
        regGid(instGid, instRfId);
        baseNodes.push(
          makePartNode(
            instRfId,
            { x: runX, y: GRP_PAD_TOP },
            `${alias.name} : ${alias.type}`,
            '',
            ports,
            PAL.inst,
            {
              parentId: `grp-${compDef.name}`,
              extent: 'parent',
              style: {
                background: PAL.inst.bg, border: `1px solid ${PAL.inst.border}`,
                borderRadius: 7, padding: '6px 10px', width: iW, height: h,
              },
            },
            {
              id: `inst-${compDef.name}-${alias.name}`,
              type: 'instance',
              name: alias.name,
              line: alias.line,
              extra: { type: alias.type, parent: compDef.name, ...(instGid ? { graphId: instGid } : {}) },
            },
          ),
        );
        runX += iW + INST_GAP;
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
          // Show connection type as label when declared; omit label for anonymous connects.
          ...(conn.connType ? {
            label: conn.connType,
            labelStyle:   { fontSize: 9, fill: '#4ade80', fontFamily: 'monospace' },
            labelBgStyle: { fill: '#040f08', fillOpacity: 0.9 },
          } : {}),
          style: { stroke: '#4ade80', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#4ade80', width: 11, height: 11 },
          // Sit above the group container (zIndex -1) and instance nodes (default 0)
          zIndex: 20,
          data: {
            _sel: {
              id: edgeId,
              type: 'connection',
              name: conn.connType
                ? `${conn.fromPart}.${conn.fromPort} → ${conn.toPart}.${conn.toPort} : ${conn.connType}`
                : `${conn.fromPart}.${conn.fromPort} → ${conn.toPart}.${conn.toPort}`,
              line: conn.line,
              extra: {
                fromPart: conn.fromPart, fromPort: conn.fromPort,
                toPart:   conn.toPart,   toPort:   conn.toPort,
                parent:   compDef.name,
                ...(conn.connType ? { connType: conn.connType } : {}),
              },
            } satisfies SelectionState,
          },
        });
      }

      curY += groupH + ROW_GAP;
    }

    // Section 3: Legacy structural occurrenceDef
    const occDefGid = gid('OccurrenceDefinition');
    if (legacyStructOccs.length > 0) {
      const typeNames = new Set(typePartDefs.map(n => n.name));
      const occWidths = legacyStructOccs.map(n => nodeWidth('«occurrence def»', n.name, []));
      const pos = centeredRow(legacyStructOccs.map(n => n.name), curY, occWidths);
      for (const n of legacyStructOccs) {
        const gidVal = occDefGid(n.name);
        const nodeId = `occ-${n.name}`;
        baseNodes.push(makePartNode(
          nodeId, pos.get(n.name)!, '«occurrence def»', n.name, [], PAL.occ,
          undefined,
          { id: nodeId, type: 'occurrence', name: n.name, line: n.line,
            ...(gidVal ? { extra: { graphId: gidVal } } : {}),
          },
        ));
        regGid(gidVal, nodeId);
        const seenType = new Set<string>();
        for (const b of n.body) {
          if (b.kind !== 'partAlias' || !typeNames.has(b.type) || seenType.has(b.type)) continue;
          seenType.add(b.type);
          const labels = (n.body as VizNode[])
            .filter((x): x is Extract<VizNode,{ kind: 'partAlias' }> => x.kind === 'partAlias' && x.type === b.type)
            .map(x => x.name);
          baseEdges.push({
            id: `${n.name}→${b.type}`,
            source: `occ-${n.name}`,
            target: `def-${b.type}`,
            sourceHandle: '__source',
            targetHandle: '__target',
            label: labels.join(', '),
            type: 'smoothstep',
            style: { stroke: '#22c55e', strokeWidth: 1.5 },
            labelStyle: { fontSize: 10, fill: '#86efac', fontFamily: 'monospace' },
            labelBgStyle: { fill: '#0d2e1a', fillOpacity: 0.9 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e', width: 16, height: 16 },
          });
        }
      }
      curY += PART_BASE_H + ROW_GAP;
    }

    // Section 4: Behavioral scenarios
    if (scenarios.length > 0) {
      const scenWidths = scenarios.map(n => nodeWidth('«scenario»', n.name, []));
      const pos = centeredRow(scenarios.map(n => n.name), curY, scenWidths);
      for (const n of scenarios) {
        const gidVal = occDefGid(n.name);
        const nodeId = `occ-${n.name}`;
        baseNodes.push(makePartNode(
          nodeId, pos.get(n.name)!, '«scenario»', n.name, [], PAL.scen,
          undefined,
          { id: nodeId, type: 'occurrence', name: n.name, line: n.line,
            ...(gidVal ? { extra: { graphId: gidVal } } : {}),
          },
        ));
        regGid(gidVal, nodeId);
      }
    }

    // ── Relationship edges from ContainmentGraph ────────────────────────────
    // Added after all sections so graphIdToRfId is fully populated.
    if (graph) {
      // Track already-added edge IDs to avoid duplicates with Section 1.5 / Section 2.
      const addedEdgeIds = new Set(baseEdges.map(e => e.id));

      // portGraphId → owning rfNodeId — needed to route connection edges that
      // terminate on PortUsage children of visible parts (direct or inherited).
      const portToOwnerRfId = new Map<string, string>();
      for (const [graphId, rfId] of graphIdToRfId) {
        for (const p of getGraphNodePorts(graphId)) portToOwnerRfId.set(p.id, rfId);
      }

      for (const edge of graph.edges) {
        if (edge.type === 'typedBy') {
          const srcRf = graphIdToRfId.get(edge.source);
          const tgtRf = graphIdToRfId.get(edge.target);
          if (!srcRf || !tgtRf || srcRf === tgtRf) continue;
          // inst-* nodes are inside parent groups — their edges bypass ELK
          // routing and draw uncontrolled curves; the type is already visible
          // in the instance label so these edges add no information.
          if (srcRf.startsWith('inst-') || tgtRf.startsWith('inst-')) continue;
          const edgeId = `typedby-${edge.id}`;
          if (addedEdgeIds.has(edgeId)) continue;
          addedEdgeIds.add(edgeId);
          baseEdges.push({
            id:           edgeId,
            source:       srcRf,
            target:       tgtRf,
            type:         'smoothstep',
            label:        'types',
            style:        { stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5 3' },
            labelStyle:   { fontSize: 9, fill: '#60a5fa', fontFamily: 'monospace' },
            labelBgStyle: { fill: '#040f08', fillOpacity: 0.88 },
            markerEnd:    { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 10, height: 10 },
            zIndex: 8,
          });

        } else if (edge.type === 'connection') {
          // Resolve endpoints through port ownership if needed.
          const srcRf = graphIdToRfId.get(edge.source) ?? portToOwnerRfId.get(edge.source);
          const tgtRf = graphIdToRfId.get(edge.target) ?? portToOwnerRfId.get(edge.target);
          if (!srcRf || !tgtRf || srcRf === tgtRf) continue;
          // Skip connections involving inst-* (inside composition groups) —
          // intra-group connections come from Section 2 already; cross-group
          // connections bypass ELK and draw unrouted curves over other nodes.
          if (srcRf.startsWith('inst-') || tgtRf.startsWith('inst-')) continue;
          const edgeId = `conn-graph-${edge.id}`;
          if (addedEdgeIds.has(edgeId)) continue;
          addedEdgeIds.add(edgeId);
          baseEdges.push({
            id:           edgeId,
            source:       srcRf,
            target:       tgtRf,
            type:         'smoothstep',
            label:        'connects',
            style:        { stroke: '#4ade80', strokeWidth: 1.5 },
            labelStyle:   { fontSize: 9, fill: '#4ade80', fontFamily: 'monospace' },
            labelBgStyle: { fill: '#040f08', fillOpacity: 0.88 },
            markerEnd:    { type: MarkerType.ArrowClosed, color: '#4ade80', width: 10, height: 10 },
            zIndex: 8,
          });
        }
      }
    }

    return { baseNodes, baseEdges };
  }, [result, graph]);

  // ── Layout effect ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    applyElkLayout(baseNodes, baseEdges, layoutMode).then(({ nodes: positioned, edgeRoutes }) => {
      if (cancelled) return;
      const newPositions = new Map(savedPositionsRef.current);
      for (const n of positioned) {
        if (!n.parentId) newPositions.set(n.id, n.position);
      }
      setSavedPositions(newPositions);
      // Keep explicit draggable: false on group containers; enable on all other nodes.
      setDisplayNodes(positioned.map(n => ({ ...n, draggable: n.draggable !== false })));
      // Apply ELK obstacle-avoiding routes to edges so they render as polylines
      // that stay clear of every node face, not as naive smoothstep curves.
      setDisplayEdges(baseEdges.map(e => {
        const waypoints = edgeRoutes.get(e.id);
        if (!waypoints) return e;   // intra-group straight edges — keep as-is
        return { ...e, type: 'elkEdge', data: { ...(e.data ?? {}), waypoints } };
      }));
      setAutoFitVersion(v => v + 1);
    });

    return () => { cancelled = true; };
  // layoutKey triggers a re-run without savedPositions as a dep (avoids loop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseNodes, baseEdges, layoutMode, layoutKey]);

  // ── Drag handler — saves positions when user finishes dragging ────────────────
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setDisplayNodes(prev => applyNodeChanges(changes, prev));
    for (const change of changes) {
      if (change.type === 'position' && !change.dragging && change.position) {
        setSavedPositions(prev => {
          const next = new Map(prev);
          next.set(change.id, change.position!);
          return next;
        });
      }
    }
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

  const handleAutoLayout = useCallback(() => {
    setLayoutKey(k => k + 1);
  }, []);

  const handleResetLayout = useCallback(() => {
    setSavedPositions(new Map());
    setLayoutKey(k => k + 1);
  }, []);

  if (rfNodes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: 14, gap: 8 }}>
        Add <code style={{ background: '#313244', padding: '2px 6px', borderRadius: 4 }}>part def</code> or
        <code style={{ background: '#313244', padding: '2px 6px', borderRadius: 4 }}>interface def</code>
      </div>
    );
  }

  const layoutDir: 'lr' | 'tb' = layoutMode === 'tb' ? 'tb' : 'lr';

  return (
    <LayoutDirCtx.Provider value={layoutDir}>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Layout toolbar */}
        <div style={TOOLBAR}>
          <span style={{ fontSize: 11, color: '#6b7280', marginRight: 2 }}>Layout:</span>
          {(['lr', 'tb', 'compact'] as LayoutMode[]).map(m => (
            <button key={m} style={modeBtn(layoutMode === m)} onClick={() => setLayoutMode(m)}>
              {LAYOUT_LABELS[m]}
            </button>
          ))}
          <button style={actionBtn} onClick={handleAutoLayout} title="Re-run auto layout">
            ↺ Auto Layout
          </button>
          <button style={actionBtn} onClick={handleResetLayout} title="Clear saved positions and re-run layout">
            ⊠ Reset Layout
          </button>
        </div>

        {/* React Flow canvas */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={handleNodesChange}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            fitViewOptions={{ padding: 0.18 }}
            nodesDraggable={!fitMode}
            panOnDrag={!fitMode}
            zoomOnScroll={!fitMode}
            zoomOnPinch={!fitMode}
            zoomOnDoubleClick={!fitMode}
          >
            <Background color="#2a2a3a" gap={24} />
            <Controls showFitView={false} />
            <FitPanel autoFitVersion={autoFitVersion} active={fitMode} onToggle={() => setFitMode(v => !v)} />
          </ReactFlow>
        </div>
      </div>
    </LayoutDirCtx.Provider>
  );
}
