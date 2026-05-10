import { useMemo, useCallback, useState, useEffect, useRef, createContext, useContext, Fragment } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import {
  ReactFlow, Background, Controls, Panel, MarkerType, useReactFlow,
  Handle, Position, applyNodeChanges,
  type Node, type Edge, type NodeChange, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { VisualizerModel, VizNode } from '../../core/visualizerModel';
import type { SelectionState } from '../../app/selection';
import { applyElkLayout, LAYOUT_LABELS, type LayoutMode } from '../layout/graphLayout';

// ── Layout direction context (consumed by custom node type) ───────────────────

const LayoutDirCtx = createContext<'lr' | 'tb'>('lr');

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W       = 172;
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
  inst:    { bg: '#0a2218', border: '#22c55e', name: '#86efac', stereo: '#4ade80', sep: '#15803d', port: '#6ee7b7' },
  occ:     { bg: '#0d2e1a', border: '#22c55e', name: '#bbf7d0', stereo: '#4ade80', sep: '#15803d', port: '#86efac' },
  scen:    { bg: '#2a1200', border: '#f97316', name: '#fed7aa', stereo: '#fb923c', sep: '#c2410c', port: '#fdba74' },
};

// ── Node label renderer ───────────────────────────────────────────────────────

type PortLike = Extract<VizNode, { kind: 'port' }>;
type AttrUsageLike = Extract<VizNode, { kind: 'attributeUsage' }>;

function partLabel(stereotype: string, name: string, ports: PortLike[], p: Palette, attrs: AttrUsageLike[] = []) {
  const hasItems = ports.length > 0 || attrs.length > 0;
  return (
    <div style={{ lineHeight: 1.4 }}>
      <div style={{ textAlign: 'center', paddingBottom: hasItems ? 2 : 0 }}>
        <div style={{ fontSize: 9.5, color: p.stereo, letterSpacing: '0.35px' }}>{stereotype}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: p.name }}>{name}</div>
      </div>
      {hasItems && (
        <div style={{ height: 1, background: p.sep, margin: '2px -10px 4px', opacity: 0.4 }} />
      )}
      {ports.map((port, i) => (
        <div key={`p${i}`} style={{ fontSize: 10, color: p.port, display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ fontSize: 7.5, opacity: 0.8 }}>{port.direction === 'in' ? '◂' : port.direction === 'inout' ? '⇄' : '▸'}</span>
          <span>{port.name}</span>
          <span style={{ opacity: 0.45, fontSize: 9.5 }}>: {port.portType}</span>
        </div>
      ))}
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
): Node {
  const h = (ports.length > 0 || attrs.length > 0) ? partH(ports.length, attrs.length) : PART_BASE_H;
  return {
    id,
    type: 'sysmlPart',
    position: pos,
    data: {
      label: partLabel(stereotype, name, ports, p, attrs),
      ports,
      palette: p,
      _sel: sel ?? null,
    },
    style: {
      background: p.bg, border: `1px solid ${p.border}`,
      borderRadius: 7, padding: '6px 10px', width: NODE_W, height: h,
    },
    ...extra,
  };
}

// ── Custom node type with port handles ────────────────────────────────────────

function SysmlPartNode({ data }: NodeProps) {
  const dir = useContext(LayoutDirCtx);
  const isLR = dir !== 'tb';
  const ports = (data['ports'] as PortLike[]) ?? [];

  const sourcePos = isLR ? Position.Right  : Position.Bottom;
  const targetPos = isLR ? Position.Left   : Position.Top;

  return (
    <>
      {/* Generic handles for occurrence→def edges */}
      <Handle type="target" position={targetPos} id="__target" style={{ opacity: 0 }} />
      <Handle type="source" position={sourcePos} id="__source" style={{ opacity: 0 }} />

      {/* Per-port bidirectional handles: target on left, source on right */}
      {ports.map((p, i) => {
        const topPct = `${((i + 1) / (ports.length + 1)) * 100}%`;
        return (
          <Fragment key={p.name}>
            <Handle
              type="target"
              position={targetPos}
              id={`port-${p.name}`}
              style={{ top: topPct, opacity: 0 }}
            />
            <Handle
              type="source"
              position={sourcePos}
              id={`port-${p.name}-out`}
              style={{ top: topPct, opacity: 0 }}
            />
          </Fragment>
        );
      })}

      {/* Node content — rendered by existing label builder */}
      {data['label'] as React.ReactNode}
    </>
  );
}

// ── Row layout helper ─────────────────────────────────────────────────────────

type Pos = { x: number; y: number };

function centeredRow(names: string[], y: number): Map<string, Pos> {
  const total = names.length * NODE_W + (names.length - 1) * COL_GAP;
  const x0 = -(total / 2) + NODE_W / 2;
  return new Map(names.map((n, i) => [n, { x: x0 + i * (NODE_W + COL_GAP), y }]));
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

// ── Fit-view panel (must render inside <ReactFlow>) ───────────────────────────

function FitViewControl({ autoFitVersion }: { autoFitVersion: number }) {
  const { fitView } = useReactFlow();
  const prev = useRef<number>(-1);

  // Auto-fit whenever the layout version increments (after ELK completes)
  useEffect(() => {
    if (autoFitVersion === prev.current) return;
    prev.current = autoFitVersion;
    const id = setTimeout(() => fitView({ padding: 0.18 }), 40);
    return () => clearTimeout(id);
  }, [autoFitVersion, fitView]);

  return (
    <Panel position="top-right">
      <button
        title="Fit view"
        onClick={() => fitView({ padding: 0.18 })}
        style={{
          background: '#111827', border: '1px solid #2a2a3a',
          color: '#9ca3af', borderRadius: 4, padding: '3px 9px',
          cursor: 'pointer', fontSize: 11,
        }}
      >
        ⊡ Fit
      </button>
    </Panel>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  result: VisualizerModel;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
}

export default function StructureView({ result, selection, onSelect }: Props) {
  const [layoutMode,     setLayoutMode]     = useState<LayoutMode>('lr');
  const [displayNodes,   setDisplayNodes]   = useState<Node[]>([]);
  const [savedPositions, setSavedPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [layoutKey,      setLayoutKey]      = useState(0);
  const [autoFitVersion, setAutoFitVersion] = useState(0);

  // Always-current ref so useEffect can read savedPositions without it as a dep
  const savedPositionsRef = useRef(savedPositions);
  savedPositionsRef.current = savedPositions;

  // nodeTypes is stable — defined once outside component, but we need context so use useMemo
  const nodeTypes = useMemo(() => ({ sysmlPart: SysmlPartNode }), []);

  // ── Pass 1: manual layout (recomputes when model changes) ─────────────────
  const { baseNodes, baseEdges } = useMemo(() => {
    const baseNodes: Node[] = [];
    const baseEdges: Edge[] = [];

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

    const ifaceDefs    = result.nodes.filter((n): n is ID   => n.kind === 'interfaceDef');
    const portDefs     = result.nodes.filter((n): n is PRD  => n.kind === 'portDef');
    const attrDefs     = result.nodes.filter((n): n is AD   => n.kind === 'attributeDef');
    const itemDefs     = result.nodes.filter((n): n is ITMD => n.kind === 'itemDef');
    const allPartDefs  = result.nodes.filter((n): n is PD   => n.kind === 'partDef');
    const allPartUsages = result.nodes.filter((n): n is PU  => n.kind === 'partUsage');
    // composedDefs = part defs that contain part usages (structural composition)
    const typePartDefs = allPartDefs.filter(n => !n.body.some(b => b.kind === 'partAlias'));
    const composedDefs = allPartDefs.filter(n =>  n.body.some(b => b.kind === 'partAlias'));
    const partDefMap   = new Map(allPartDefs.map(n => [n.name, n]));

    console.log('[StructureView] portDefs:', portDefs.map(n => n.name));
    console.log('[StructureView] itemDefs:', itemDefs.map(n => n.name));
    console.log('[StructureView] typePartDefs:', typePartDefs.map(n => n.name));
    console.log('[StructureView] allPartUsages:', allPartUsages.map(n => `${n.name}:${n.type}`));

    // Combined composition blocks: partDef groups + named PartUsage blocks
    type CompBlock = { name: string; line: number; body: VizNode[]; stereotype: string };
    const allComposed: CompBlock[] = [
      ...composedDefs.map(n => ({ name: n.name, line: n.line, body: n.body, stereotype: '«part def»' })),
      ...allPartUsages.map(n => ({
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
    const connSection0 = [
      ...ifaceDefs.map(n => ({
        nodeId:  `iface-${n.name}`,
        name:    n.name,
        stereo:  '«interface def»',
        palette: PAL.iface,
        sel:     { id: `iface-${n.name}`,   type: 'interface' as const, name: n.name, line: n.line },
      })),
      ...portDefs.map(n => ({
        nodeId:  `portdef-${n.name}`,
        name:    n.name,
        stereo:  '«port def»',
        palette: PAL.portDef,
        sel:     { id: `portdef-${n.name}`, type: 'port'      as const, name: n.name, line: n.line },
      })),
    ];
    if (connSection0.length > 0) {
      const pos = centeredRow(connSection0.map(c => c.nodeId), curY);
      for (const c of connSection0) {
        baseNodes.push(makePartNode(
          c.nodeId, pos.get(c.nodeId)!, c.stereo, c.name, [], c.palette,
          undefined, c.sel,
        ));
      }
      curY += IFACE_H + ROW_GAP;
    }

    // Section 0.5: Attribute definitions — «attribute def» boxes (cyan palette)
    if (attrDefs.length > 0) {
      let maxH = PART_BASE_H;
      const pos = centeredRow(attrDefs.map(n => n.name), curY);
      for (const n of attrDefs) {
        const attrs = n.body.filter((b): b is AU => b.kind === 'attributeUsage');
        const h = partH(0, attrs.length);
        maxH = Math.max(maxH, h);
        baseNodes.push(makePartNode(
          `attrdef-${n.name}`, pos.get(n.name)!, '«attribute def»', n.name, [], PAL.attr,
          undefined,
          { id: `attrdef-${n.name}`, type: 'part', name: n.name, line: n.line },
          attrs,
        ));
      }
      curY += maxH + ROW_GAP;
    }

    // Section 1: Type-library defs — part defs (blue) and item defs (amber)
    // Item defs are rendered alongside part defs since both are structural type references.
    type Section1Entry = { nodeId: string; stereo: string; name: string; ports: PortLike[]; attrs: AU[]; palette: Palette; sel: NonNullable<Parameters<typeof makePartNode>[7]> };
    const section1Entries: Section1Entry[] = [
      ...typePartDefs.map(n => ({
        nodeId: `def-${n.name}`,
        stereo: '«part def»',
        name:   n.name,
        ports:  n.body.filter((b): b is PortLike => b.kind === 'port'),
        attrs:  n.body.filter((b): b is AU => b.kind === 'attributeUsage'),
        palette: PAL.type,
        sel: { id: `def-${n.name}`, type: 'part' as const, name: n.name, line: n.line },
      })),
      ...itemDefs.map(n => ({
        nodeId: `itemdef-${n.name}`,
        stereo: '«item def»',
        name:   n.name,
        ports:  [] as PortLike[],
        attrs:  [] as AU[],
        palette: PAL.item,
        sel: { id: `itemdef-${n.name}`, type: 'part' as const, name: n.name, line: n.line },
      })),
    ];
    console.log('[StructureView] section1 entries:', section1Entries.map(e => `${e.stereo} ${e.name}`));
    if (section1Entries.length > 0) {
      let maxH = PART_BASE_H;
      const pos = centeredRow(section1Entries.map(e => e.nodeId), curY);
      for (const e of section1Entries) {
        const h = partH(e.ports.length, e.attrs.length);
        maxH = Math.max(maxH, h);
        baseNodes.push(makePartNode(
          e.nodeId, pos.get(e.nodeId)!, e.stereo, e.name, e.ports, e.palette,
          undefined, e.sel, e.attrs,
        ));
      }
      curY += maxH + ROW_GAP;
    }

    // Section 2: Composed part defs (groups) + named PartUsage blocks
    for (const compDef of allComposed) {
      const aliases     = compDef.body.filter((b): b is PA => b.kind === 'partAlias');
      const connections = compDef.body.filter((b): b is CN => b.kind === 'connection');

      const instanceMeta = aliases.map(alias => {
        const typeDef = partDefMap.get(alias.type);
        const ports   = typeDef ? typeDef.body.filter((b): b is PortLike => b.kind === 'port') : [];
        return { alias, ports, h: partH(ports.length) };
      });
      const maxInstH = instanceMeta.reduce((m, d) => Math.max(m, d.h), PART_BASE_H);

      const nInst  = aliases.length;
      const groupW = 2 * GRP_PAD_X + nInst * NODE_W + (nInst - 1) * INST_GAP;
      const groupH = GRP_PAD_TOP + maxInstH + GRP_PAD_BOT;
      const groupX = -(groupW / 2);

      baseNodes.push({
        id: `grp-${compDef.name}`,
        position: { x: groupX, y: curY },
        className: 'comp-group',
        data: {
          label: `${compDef.stereotype}  ${compDef.name}`,
          _sel: { id: `grp-${compDef.name}`, type: 'systemPart', name: compDef.name, line: compDef.line } satisfies SelectionState,
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

      console.log(`[StructureView] group "${compDef.name}" instances:`,
        instanceMeta.map(m => `${m.alias.name}:${m.alias.type} ports:[${m.ports.map(p => `${p.name}:${p.portType}`).join(',')}]`),
        'connections:', connections.map(c => `${c.fromPart}.${c.fromPort}→${c.toPart}.${c.toPort}${c.connType ? ':'+c.connType : ''}`),
      );
      instanceMeta.forEach(({ alias, ports, h }, idx) => {
        const relX = GRP_PAD_X + idx * (NODE_W + INST_GAP);
        baseNodes.push(
          makePartNode(
            `inst-${compDef.name}-${alias.name}`,
            { x: relX, y: GRP_PAD_TOP },
            `${alias.name} : ${alias.type}`,
            '',
            ports,
            PAL.inst,
            {
              parentId: `grp-${compDef.name}`,
              extent: 'parent',
              style: {
                background: PAL.inst.bg, border: `1px solid ${PAL.inst.border}`,
                borderRadius: 7, padding: '6px 10px', width: NODE_W, height: h,
              },
            },
            {
              id: `inst-${compDef.name}-${alias.name}`,
              type: 'instance',
              name: alias.name,
              line: alias.line,
              extra: { type: alias.type, parent: compDef.name },
            },
          ),
        );
      });

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
    if (legacyStructOccs.length > 0) {
      const typeNames = new Set(typePartDefs.map(n => n.name));
      const pos = centeredRow(legacyStructOccs.map(n => n.name), curY);
      for (const n of legacyStructOccs) {
        baseNodes.push(makePartNode(
          `occ-${n.name}`, pos.get(n.name)!, '«occurrence def»', n.name, [], PAL.occ,
          undefined,
          { id: `occ-${n.name}`, type: 'occurrence', name: n.name, line: n.line },
        ));
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
      const pos = centeredRow(scenarios.map(n => n.name), curY);
      for (const n of scenarios) {
        baseNodes.push(makePartNode(
          `occ-${n.name}`, pos.get(n.name)!, '«scenario»', n.name, [], PAL.scen,
          undefined,
          { id: `occ-${n.name}`, type: 'occurrence', name: n.name, line: n.line },
        ));
      }
    }

    return { baseNodes, baseEdges };
  }, [result]);

  // ── Layout effect ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    if (layoutMode === 'manual') {
      // Apply any saved positions, then enable dragging on top-level nodes
      const positioned = baseNodes.map(n => {
        const saved = savedPositionsRef.current.get(n.id);
        return {
          ...n,
          position: saved ?? n.position,
          draggable: !n.parentId,
        };
      });
      setDisplayNodes(positioned);
      setAutoFitVersion(v => v + 1);
      return;
    }

    applyElkLayout(baseNodes, baseEdges, layoutMode).then(positioned => {
      if (cancelled) return;
      // Save ELK positions so manual mode can start from them
      const newPositions = new Map(savedPositionsRef.current);
      for (const n of positioned) {
        if (!n.parentId) newPositions.set(n.id, n.position);
      }
      setSavedPositions(newPositions);
      setDisplayNodes(positioned.map(n => ({ ...n, draggable: false })));
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

    if (!selection) return { rfNodes: nodes, rfEdges: baseEdges };

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

    const rfEdges = baseEdges.map(e => {
      if (e.id !== selection.id) return e;
      return {
        ...e,
        style: { stroke: SEL_BORDER, strokeWidth: 2.5 },
        labelStyle: { ...(e.labelStyle as object), fill: SEL_BORDER },
        markerEnd: { type: MarkerType.ArrowClosed, color: SEL_BORDER, width: 14, height: 14 },
      };
    });

    return { rfNodes, rfEdges };
  }, [displayNodes, baseNodes, baseEdges, selection]);

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
    if (layoutMode === 'manual') {
      // Switch to LR and run ELK
      setLayoutMode('lr');
    } else {
      setLayoutKey(k => k + 1);
    }
  }, [layoutMode]);

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
          {(['lr', 'tb', 'compact', 'manual'] as LayoutMode[]).map(m => (
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
            onNodesChange={layoutMode === 'manual' ? handleNodesChange : undefined}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            fitViewOptions={{ padding: 0.18 }}
          >
            <Background color="#2a2a3a" gap={24} />
            <Controls />
            <FitViewControl autoFitVersion={autoFitVersion} />
          </ReactFlow>
        </div>
      </div>
    </LayoutDirCtx.Provider>
  );
}
