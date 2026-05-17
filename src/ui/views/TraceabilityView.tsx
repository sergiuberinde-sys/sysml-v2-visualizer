import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  applyNodeChanges,
  type Node, type Edge, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { VisualizerModel, VizNode } from '../../core/visualizerModel';
import type { SelectionState } from '../../app/selection';
import type { TrlcData } from '../../core/trlc/types';
import { FitPanel } from '../layout/FitPanel';

type RD = Extract<VizNode, { kind: 'requirementDef' }>;
type TL = Extract<VizNode, { kind: 'traceLink' }>;

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

const ASIL_COLOR: Record<string, string> = {
  D: '#f87171', C: '#fb923c', B: '#facc15', A: '#a3e635', QM: '#64748b',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  result: VisualizerModel;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
  trlcData?: TrlcData;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TraceabilityView({ result, selection, onSelect, trlcData }: Props) {
  const reqs  = result.nodes.filter((n): n is RD => n.kind === 'requirementDef');
  const links = result.nodes.filter((n): n is TL => n.kind === 'traceLink');
  const isOfficial = result.parserMode === 'sysmlV2OfficialFuture';

  // Official mode: render TRLC trace matrix
  if (isOfficial) {
    if (!trlcData) {
      return (
        <div className="behavior-placeholder">
          <div>No TRLC requirements loaded.</div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
            Use the <code>Import TRLC</code> button to load a requirements JSON file.
          </div>
        </div>
      );
    }

    // Group traces by requirement
    const byReq = new Map<string, string[]>();
    for (const t of trlcData.traces) {
      if (!byReq.has(t.requirementId)) byReq.set(t.requirementId, []);
      byReq.get(t.requirementId)!.push(t.elementName);
    }

    return (
      <div style={{
        height: '100%', overflowY: 'auto',
        padding: '16px 24px',
        background: '#0d1117',
        fontFamily: 'monospace',
      }}>
        <div style={{
          marginBottom: 16, fontSize: 10, color: '#475569',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          borderBottom: '1px solid #1e2d3d', paddingBottom: 8,
        }}>
          Requirement Traces ({trlcData.requirements.length} reqts · {trlcData.traces.length} links)
        </div>
        {trlcData.requirements.map(req => {
          const elements = byReq.get(req.id) ?? [];
          const selId = `trlc-req-${req.id}`;
          const isSelected = selection?.id === selId;
          return (
            <div
              key={req.id}
              style={{
                marginBottom: 12,
                padding: '10px 14px',
                background: isSelected ? '#0f1f3a' : '#0d1f2d',
                border: `1px solid ${isSelected ? '#60a5fa' : '#1e3a5f'}`,
                borderRadius: 7,
                cursor: 'pointer',
              }}
              onClick={() => onSelect({
                id: selId, type: 'requirement', name: req.id,
                extra: { reqId: req.id, text: req.text, title: req.title, ...(req.asil ? { asil: req.asil } : {}) },
              })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>{req.id}</span>
                <span style={{ fontSize: 12, color: '#e2e8f0' }}>{req.title}</span>
                {req.asil && (
                  <span style={{ fontSize: 10, color: ASIL_COLOR[req.asil] ?? '#64748b', marginLeft: 'auto' }}>
                    ASIL-{req.asil}
                  </span>
                )}
              </div>
              {elements.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {elements.map(el => {
                    const elSelId = `trlc-el-${req.id}-${el}`;
                    return (
                      <span
                        key={el}
                        style={{
                          fontSize: 10, padding: '2px 7px',
                          background: '#0f172a', border: '1px solid #334155',
                          borderRadius: 4, color: '#94a3b8',
                          cursor: 'pointer',
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          onSelect({ id: elSelId, type: 'part', name: el });
                        }}
                      >
                        {el}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span style={{ fontSize: 10, color: '#334155', fontStyle: 'italic' }}>no traced elements</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

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

  // Drag support
  const [displayNodes, setDisplayNodes] = useState<Node[]>([]);
  const [resetVersion, setResetVersion] = useState(0);

  useEffect(() => {
    // When the model or resetVersion changes, reset to computed positions.
    setDisplayNodes(rfNodes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseNodes, resetVersion]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setDisplayNodes(prev => applyNodeChanges(changes, prev));
  }, []);

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
        nodes={displayNodes.length > 0 ? displayNodes : rfNodes}
        edges={rfEdges}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onNodesChange={handleNodesChange}
        fitView
        fitViewOptions={{ padding: 0.25 }}
      >
        <Background color="#0a0a1e" gap={24} />
        <Controls showFitView={false} />
        <FitPanel padding={0.25} onReset={() => setResetVersion(v => v + 1)} />
      </ReactFlow>
    </div>
  );
}
