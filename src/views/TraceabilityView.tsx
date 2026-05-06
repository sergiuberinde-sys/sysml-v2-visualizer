import { useMemo, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ParseResult, SysMLNode, SelectionState } from '../types';

type RD = Extract<SysMLNode, { kind: 'requirementDef' }>;
type TL = Extract<SysMLNode, { kind: 'traceLink' }>;

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_GAP  = 84;
const SRC_X     = 60;
const REQ_X     = 360;
const START_Y   = 60;
const SRC_W     = 164;
const REQ_W     = 196;
const NODE_H    = 54;

const SEL_BORDER = '#89b4fa';
const SEL_GLOW   = '0 0 8px 2px #89b4fa33';

const LINK_COLOR: Record<string, string> = {
  satisfy: '#4ade80',
  verify:  '#f9e2af',
  trace:   '#38bdf8',
};

// ── Node style by element kind ────────────────────────────────────────────────

function srcStyle(kind: string): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 7, padding: '6px 10px',
    width: SRC_W, height: NODE_H,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center',
  };
  if (kind === 'partDef')      return { ...base, background: '#0f2644', border: '1px solid #60a5fa' };
  if (kind === 'occurrenceDef')return { ...base, background: '#0d2e1a', border: '1px solid #4ade80' };
  if (kind === 'behaviorDef')  return { ...base, background: '#09213a', border: '1px solid #38bdf8' };
  if (kind === 'stateDef')     return { ...base, background: '#0d2e2e', border: '1px solid #2dd4bf' };
  return { ...base, background: '#1e1e2e', border: '1px solid #585b70' };
}

const REQ_STYLE: React.CSSProperties = {
  background: '#2d1b4e', border: '1px solid #c084fc',
  borderRadius: 7, padding: '6px 10px',
  width: REQ_W, height: NODE_H,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  textAlign: 'center',
};

// ── Kind label ────────────────────────────────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  partDef:      'part def',
  occurrenceDef:'occurrence def',
  behaviorDef:  'behavior def',
  stateDef:     'state def',
};

// ── Build graph ───────────────────────────────────────────────────────────────

function buildGraph(
  reqs: RD[],
  links: TL[],
  kindOf: Map<string, string>,
): { nodes: Node[]; edges: Edge[] } {
  const sourceNames = [...new Set(links.map(l => l.source))];
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  sourceNames.forEach((name, i) => {
    const kind = kindOf.get(name) ?? 'unknown';
    const sel: SelectionState = { id: `trsrc-${name}`, type: 'traceLink', name, extra: { source: name } };
    nodes.push({
      id: `trsrc-${name}`,
      position: { x: SRC_X, y: START_Y + i * NODE_GAP },
      data: {
        label: (
          <div style={{ lineHeight: 1.35 }}>
            <div style={{ fontSize: 9, opacity: 0.55, marginBottom: 2 }}>{KIND_LABEL[kind] ?? kind}</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div>
          </div>
        ),
        _sel: sel,
      },
      style: srcStyle(kind),
    });
  });

  reqs.forEach((req, i) => {
    const sel: SelectionState = {
      id: `req-${req.name}`, type: 'requirement', name: req.name,
      extra: { reqId: req.reqId, text: req.text, priority: req.priority },
    };
    nodes.push({
      id: `req-${req.name}`,
      position: { x: REQ_X, y: START_Y + i * NODE_GAP },
      data: {
        label: (
          <div style={{ lineHeight: 1.35 }}>
            {req.reqId && <div style={{ fontSize: 9, opacity: 0.55, marginBottom: 2 }}>{req.reqId}</div>}
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e9d5ff' }}>{req.name}</div>
          </div>
        ),
        _sel: sel,
      },
      style: REQ_STYLE,
    });
  });

  links.forEach((l, i) => {
    const edgeId = `trlink-${l.source}-${l.target}-${i}`;
    const color  = LINK_COLOR[l.linkType] ?? '#89b4fa';
    const sel: SelectionState = {
      id: edgeId, type: 'traceLink',
      name: `${l.source} ${l.linkType}s ${l.target}`,
      extra: { source: l.source, target: l.target, linkType: l.linkType },
    };
    edges.push({
      id: edgeId,
      source: `trsrc-${l.source}`,
      target: `req-${l.target}`,
      type: 'smoothstep',
      label: l.linkType,
      style: { stroke: color, strokeWidth: 1.5 },
      labelStyle: { fontSize: 9.5, fill: color, fontFamily: 'monospace' },
      labelBgStyle: { fill: '#12121e', fillOpacity: 0.9 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
      data: { _sel: sel },
    });
  });

  return { nodes, edges };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  result: ParseResult;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TraceabilityView({ result, selection, onSelect }: Props) {
  const reqs  = result.nodes.filter((n): n is RD => n.kind === 'requirementDef');
  const links = result.nodes.filter((n): n is TL => n.kind === 'traceLink');

  const kindOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of result.nodes) {
      if ('name' in n) m.set((n as { name: string }).name, n.kind);
    }
    return m;
  }, [result.nodes]);

  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => buildGraph(reqs, links, kindOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result],
  );

  const { rfNodes, rfEdges } = useMemo(() => {
    if (!selection) return { rfNodes: baseNodes, rfEdges: baseEdges };

    const rfNodes = baseNodes.map((n: Node) => {
      if (n.id !== selection.id) return n;
      return { ...n, style: { ...(n.style as object), border: `1.5px solid ${SEL_BORDER}`, boxShadow: SEL_GLOW } };
    });

    const rfEdges = baseEdges.map((e: Edge) => {
      if (e.id !== selection.id) return e;
      const color = '#89b4fa';
      return {
        ...e,
        style: { stroke: color, strokeWidth: 2.5 },
        labelStyle: { ...(e.labelStyle as object), fill: color },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
      };
    });

    return { rfNodes, rfEdges };
  }, [baseNodes, baseEdges, selection]);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const s = node.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  const handleEdgeClick = useCallback((_e: React.MouseEvent, edge: Edge) => {
    const s = edge.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  if (links.length === 0 && reqs.length === 0) {
    return (
      <div className="behavior-placeholder">
        No requirements or traceability links defined yet.
        Add <code>requirement def</code> and <code>satisfy / verify / trace</code> statements.
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
        fitViewOptions={{ padding: 0.25 }}
      >
        <Background color="#0a0a1e" gap={24} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
