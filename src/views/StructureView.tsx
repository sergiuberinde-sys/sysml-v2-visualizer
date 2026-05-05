import { useMemo, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ParseResult, SysMLNode, SelectionState } from '../types';

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
const INST_GAP     = 36;

function partH(portCount: number) {
  return PART_BASE_H + (portCount > 0 ? PORT_TOP + portCount * PORT_ROW_H : 0);
}

// ── Colour palettes ───────────────────────────────────────────────────────────

interface Palette { bg: string; border: string; name: string; stereo: string; sep: string; port: string }

const PAL: Record<string, Palette> = {
  iface:  { bg: '#1b0a30', border: '#a855f7', name: '#e9d5ff', stereo: '#c084fc', sep: '#7e22ce', port: '#d8b4fe' },
  type:   { bg: '#0f2644', border: '#3b82f6', name: '#bfdbfe', stereo: '#60a5fa', sep: '#1d4ed8', port: '#93c5fd' },
  inst:   { bg: '#0a2218', border: '#22c55e', name: '#86efac', stereo: '#4ade80', sep: '#15803d', port: '#6ee7b7' },
  occ:    { bg: '#0d2e1a', border: '#22c55e', name: '#bbf7d0', stereo: '#4ade80', sep: '#15803d', port: '#86efac' },
  scen:   { bg: '#2a1200', border: '#f97316', name: '#fed7aa', stereo: '#fb923c', sep: '#c2410c', port: '#fdba74' },
};

// ── Node label renderer ───────────────────────────────────────────────────────

type PortLike = Extract<SysMLNode, { kind: 'port' }>;

function partLabel(stereotype: string, name: string, ports: PortLike[], p: Palette) {
  return (
    <div style={{ lineHeight: 1.4 }}>
      <div style={{ textAlign: 'center', paddingBottom: ports.length ? 2 : 0 }}>
        <div style={{ fontSize: 9.5, color: p.stereo, letterSpacing: '0.35px' }}>{stereotype}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: p.name }}>{name}</div>
      </div>
      {ports.length > 0 && (
        <>
          <div style={{ height: 1, background: p.sep, margin: '2px -10px 4px', opacity: 0.4 }} />
          {ports.map((port, i) => (
            <div key={i} style={{ fontSize: 10, color: p.port, display: 'flex', gap: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 7.5, opacity: 0.8 }}>{port.direction === 'in' ? '◂' : '▸'}</span>
              <span>{port.name}</span>
              <span style={{ opacity: 0.45, fontSize: 9.5 }}>: {port.portType}</span>
            </div>
          ))}
        </>
      )}
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
): Node {
  const h = ports.length > 0 ? partH(ports.length) : PART_BASE_H;
  return {
    id,
    position: pos,
    data: { label: partLabel(stereotype, name, ports, p), _sel: sel ?? null },
    style: {
      background: p.bg, border: `1px solid ${p.border}`,
      borderRadius: 7, padding: '6px 10px', width: NODE_W, height: h,
    },
    ...extra,
  };
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

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  result: ParseResult;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
}

export default function StructureView({ result, selection, onSelect }: Props) {
  // ── Pass 1: layout (only recomputes when model changes) ───────────────────
  const { baseNodes, baseEdges } = useMemo(() => {
    const baseNodes: Node[] = [];
    const baseEdges: Edge[] = [];

    type PD = Extract<SysMLNode, { kind: 'partDef' }>;
    type OD = Extract<SysMLNode, { kind: 'occurrenceDef' }>;
    type PA = Extract<SysMLNode, { kind: 'partAlias' }>;
    type CN = Extract<SysMLNode, { kind: 'connection' }>;
    type ID = Extract<SysMLNode, { kind: 'interfaceDef' }>;

    const ifaceDefs    = result.nodes.filter((n): n is ID => n.kind === 'interfaceDef');
    const allPartDefs  = result.nodes.filter((n): n is PD => n.kind === 'partDef');
    const typePartDefs = allPartDefs.filter(n => !n.body.some(b => b.kind === 'partAlias'));
    const composedDefs = allPartDefs.filter(n =>  n.body.some(b => b.kind === 'partAlias'));
    const partDefMap   = new Map(allPartDefs.map(n => [n.name, n]));

    const allOccs           = result.nodes.filter((n): n is OD => n.kind === 'occurrenceDef');
    const legacyStructOccs  = allOccs.filter(o => o.body.some(b => b.kind === 'partAlias'));
    const scenarios         = allOccs.filter(o => !o.body.some(b => b.kind === 'partAlias'));

    let curY = 0;

    // Section 0: Interface definitions
    if (ifaceDefs.length > 0) {
      const pos = centeredRow(ifaceDefs.map(n => n.name), curY);
      for (const n of ifaceDefs) {
        baseNodes.push(makePartNode(
          `iface-${n.name}`, pos.get(n.name)!, '«interface def»', n.name, [], PAL.iface,
          undefined,
          { id: `iface-${n.name}`, type: 'interface', name: n.name },
        ));
      }
      curY += IFACE_H + ROW_GAP;
    }

    // Section 1: Type-library part defs
    if (typePartDefs.length > 0) {
      let maxH = PART_BASE_H;
      const pos = centeredRow(typePartDefs.map(n => n.name), curY);
      for (const n of typePartDefs) {
        const ports = n.body.filter((b): b is PortLike => b.kind === 'port');
        const h = partH(ports.length);
        maxH = Math.max(maxH, h);
        baseNodes.push(makePartNode(
          `def-${n.name}`, pos.get(n.name)!, '«part def»', n.name, ports, PAL.type,
          undefined,
          { id: `def-${n.name}`, type: 'part', name: n.name },
        ));
      }
      curY += maxH + ROW_GAP;
    }

    // Section 2: Composed part defs (groups)
    for (const compDef of composedDefs) {
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
          label: `«part def»  ${compDef.name}`,
          _sel: { id: `grp-${compDef.name}`, type: 'systemPart', name: compDef.name } satisfies SelectionState,
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
              extra: { type: alias.type, parent: compDef.name },
            },
          ),
        );
      });

      const instanceTypeMap = new Map(aliases.map(a => [a.name, a.type]));
      for (const conn of connections) {
        const srcTypeName = instanceTypeMap.get(conn.fromPart);
        const srcDef      = srcTypeName ? partDefMap.get(srcTypeName) : undefined;
        const srcPort     = srcDef?.body.find(
          (b): b is PortLike => b.kind === 'port' && b.name === conn.fromPort,
        );
        const edgeLabel = srcPort?.portType ?? `${conn.fromPort}→${conn.toPort}`;
        const edgeId    = `conn-${compDef.name}-${conn.fromPart}.${conn.fromPort}-${conn.toPart}.${conn.toPort}`;

        baseEdges.push({
          id: edgeId,
          source: `inst-${compDef.name}-${conn.fromPart}`,
          target: `inst-${compDef.name}-${conn.toPart}`,
          label: edgeLabel,
          type: 'smoothstep',
          style: { stroke: '#22c55e', strokeWidth: 1.5 },
          labelStyle: { fontSize: 10, fill: '#86efac', fontFamily: 'monospace' },
          labelBgStyle: { fill: '#0a2218', fillOpacity: 0.92 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e', width: 14, height: 14 },
          zIndex: 10,
          data: {
            _sel: {
              id: edgeId,
              type: 'connection',
              name: `${conn.fromPart}.${conn.fromPort} → ${conn.toPart}.${conn.toPort}`,
              extra: {
                fromPart: conn.fromPart, fromPort: conn.fromPort,
                toPart:   conn.toPart,   toPort:   conn.toPort,
                parent:   compDef.name,
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
          { id: `occ-${n.name}`, type: 'occurrence', name: n.name },
        ));
        const seenType = new Set<string>();
        for (const b of n.body) {
          if (b.kind !== 'partAlias' || !typeNames.has(b.type) || seenType.has(b.type)) continue;
          seenType.add(b.type);
          const labels = (n.body as SysMLNode[])
            .filter((x): x is Extract<SysMLNode, { kind: 'partAlias' }> => x.kind === 'partAlias' && x.type === b.type)
            .map(x => x.name);
          baseEdges.push({
            id: `${n.name}→${b.type}`,
            source: `occ-${n.name}`,
            target: `def-${b.type}`,
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
          { id: `occ-${n.name}`, type: 'occurrence', name: n.name },
        ));
      }
    }

    return { baseNodes, baseEdges };
  }, [result]);

  // ── Pass 2: apply selection highlight (cheap, only reruns on selection change)
  const { rfNodes, rfEdges } = useMemo(() => {
    if (!selection) return { rfNodes: baseNodes, rfEdges: baseEdges };

    const rfNodes = baseNodes.map(n => {
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
  }, [baseNodes, baseEdges, selection]);

  // ── Click handlers ────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const s = node.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  const handleEdgeClick = useCallback((_e: React.MouseEvent, edge: Edge) => {
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
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        fitView
        fitViewOptions={{ padding: 0.18 }}
      >
        <Background color="#2a2a3a" gap={24} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
