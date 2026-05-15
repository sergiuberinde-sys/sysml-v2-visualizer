import { useMemo, useState, useEffect } from 'react';
import type { ContainmentGraph, GraphNode } from '../../core/sysmlv2Official/ContainmentGraph';
import type { SelectionState } from '../../app/selection';

interface Props {
  graph: ContainmentGraph | undefined;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
}

// ── Layout constants ───────────────────────────────────────────────────────────
const LBOX_W      = 130;
const LBOX_H      = 38;
const LBOX_GAP    = 36;
const MSG_START_Y = LBOX_H + 32;
const MSG_STEP_Y  = 46;
const SVG_PAD_X   = 32;
const SVG_PAD_BOT = 28;
const ARROW_SIZE  = 7;

// ── Graph helpers ──────────────────────────────────────────────────────────────

function buildIndexes(graph: ContainmentGraph) {
  const nodeById   = new Map<string, GraphNode>();
  const childrenOf = new Map<string, string[]>();
  for (const n of graph.nodes) nodeById.set(n.id, n);
  for (const e of graph.edges) {
    if (e.type !== 'contains') continue;
    const arr = childrenOf.get(e.source) ?? [];
    arr.push(e.target);
    childrenOf.set(e.source, arr);
  }
  return { nodeById, childrenOf };
}

/** One level of indirection through FeatureMembership/OwningMembership wrappers. */
function semanticChildren(
  parentId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): GraphNode[] {
  const result: GraphNode[] = [];
  for (const membId of childrenOf.get(parentId) ?? []) {
    const memb = nodeById.get(membId);
    if (!memb) continue;
    if (memb.type === 'FeatureMembership' || memb.type === 'OwningMembership') {
      for (const childId of childrenOf.get(membId) ?? []) {
        const child = nodeById.get(childId);
        if (child) result.push(child);
      }
    }
  }
  return result;
}

type Endpoint = { participant: string; event: string };

/**
 * Resolves a FlowUsage ParameterMembership → EventOccurrenceUsage →
 * ReferenceSubsetting → Feature → FeatureChaining×2 chain.
 * Returns { participant, event } from the two FeatureChaining labels.
 */
function resolveEndpoint(
  paramMembId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): Endpoint | null {
  for (const evtId of childrenOf.get(paramMembId) ?? []) {
    if (nodeById.get(evtId)?.type !== 'EventOccurrenceUsage') continue;
    for (const refId of childrenOf.get(evtId) ?? []) {
      if (nodeById.get(refId)?.type !== 'ReferenceSubsetting') continue;
      for (const featId of childrenOf.get(refId) ?? []) {
        if (nodeById.get(featId)?.type !== 'Feature') continue;
        const chains = (childrenOf.get(featId) ?? [])
          .map(id => nodeById.get(id))
          .filter((n): n is GraphNode => n?.type === 'FeatureChaining');
        if (chains.length >= 2) {
          return { participant: chains[0].label, event: chains[1].label };
        }
      }
    }
  }
  return null;
}

// ── Data types ─────────────────────────────────────────────────────────────────

interface ParsedMessage {
  id:    string;
  label: string;
  from:  Endpoint | null;
  to:    Endpoint | null;
  line?: number;
}

interface SequenceDef {
  node:         GraphNode;
  participants: GraphNode[];
  messages:     ParsedMessage[];
}

function parseSequenceDefs(
  graph: ContainmentGraph,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): SequenceDef[] {
  const results: SequenceDef[] = [];

  for (const n of graph.nodes) {
    if (n.type !== 'PartDefinition') continue;
    const sChildren = semanticChildren(n.id, childrenOf, nodeById);
    if (!sChildren.some(c => c.type === 'FlowUsage')) continue;

    const sorted       = sChildren.slice().sort((a, b) => (a.startLine ?? 0) - (b.startLine ?? 0));
    const participants = sorted.filter(c => c.type === 'PartUsage');
    const messages: ParsedMessage[] = sorted
      .filter(c => c.type === 'FlowUsage')
      .map(flow => {
        const paramMembs = (childrenOf.get(flow.id) ?? [])
          .map(id => nodeById.get(id))
          .filter((n): n is GraphNode => n?.type === 'ParameterMembership');
        const [m0, m1] = paramMembs;
        return {
          id:    flow.id,
          label: flow.label,
          from:  m0 ? resolveEndpoint(m0.id, childrenOf, nodeById) : null,
          to:    m1 ? resolveEndpoint(m1.id, childrenOf, nodeById) : null,
          line:  flow.startLine,
        };
      });

    results.push({ node: n, participants, messages });
  }

  return results.sort((a, b) => (a.node.startLine ?? 0) - (b.node.startLine ?? 0));
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SysMLSequenceView({ graph, selection, onSelect }: Props) {
  const [selectedSeqId, setSelectedSeqId] = useState<string>('');

  const { nodeById, childrenOf } = useMemo(() => {
    if (!graph) return { nodeById: new Map<string, GraphNode>(), childrenOf: new Map<string, string[]>() };
    return buildIndexes(graph);
  }, [graph]);

  const sequenceDefs = useMemo((): SequenceDef[] => {
    if (!graph) return [];
    return parseSequenceDefs(graph, childrenOf, nodeById);
  }, [graph, childrenOf, nodeById]);

  // Auto-select the sequence that contains the currently selected element.
  useEffect(() => {
    if (!selection || sequenceDefs.length === 0) return;
    const graphId = selection.extra?.graphId;
    if (!graphId) return;
    for (const seq of sequenceDefs) {
      if (
        seq.node.id === graphId ||
        seq.participants.some(p => p.id === graphId) ||
        seq.messages.some(m => m.id === graphId)
      ) {
        setSelectedSeqId(seq.node.id);
        return;
      }
    }
  }, [selection, sequenceDefs]);

  if (!graph) {
    return (
      <div style={{ padding: 24, color: '#64748b', fontSize: 13 }}>
        No graph data available. Ensure the SysML v2 parser service is running.
      </div>
    );
  }
  if (sequenceDefs.length === 0) {
    return (
      <div style={{ padding: 24, color: '#64748b', fontSize: 13 }}>
        No sequence definitions found in this model.
      </div>
    );
  }

  const activeSeq     = sequenceDefs.find(s => s.node.id === selectedSeqId) ?? sequenceDefs[0];
  const { participants, messages } = activeSeq;
  const numPart       = participants.length;
  const lifelineX     = (i: number) => SVG_PAD_X + LBOX_W / 2 + i * (LBOX_W + LBOX_GAP);
  const totalW        = SVG_PAD_X * 2 + numPart * LBOX_W + Math.max(0, numPart - 1) * LBOX_GAP;
  const totalH        = MSG_START_Y + messages.length * MSG_STEP_Y + SVG_PAD_BOT;
  const partIdx       = new Map(participants.map((p, i) => [p.label, i]));
  const selGraphId    = selection?.extra?.graphId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0f172a' }}>

      {/* ── Sequence selector ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 6, padding: '8px 12px',
        borderBottom: '1px solid #1e293b', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {sequenceDefs.map(seq => (
          <button
            key={seq.node.id}
            onClick={() => setSelectedSeqId(seq.node.id)}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              border:     `1px solid ${seq.node.id === activeSeq.node.id ? '#38bdf8' : '#334155'}`,
              background: seq.node.id === activeSeq.node.id ? '#1e3a5f' : '#1e293b',
              color:      seq.node.id === activeSeq.node.id ? '#7dd3fc' : '#94a3b8',
              whiteSpace: 'nowrap',
            }}
          >
            {seq.node.label}
          </button>
        ))}
      </div>

      {/* ── Diagram ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <svg
          width={totalW}
          height={totalH}
          style={{ fontFamily: 'monospace', userSelect: 'none', display: 'block' }}
        >
          {/* Lifelines */}
          {participants.map((part, i) => {
            const cx    = lifelineX(i);
            const isSel = selGraphId === part.id;
            return (
              <g
                key={part.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect({
                  id:    part.id,
                  type:  'part',
                  name:  part.label,
                  line:  part.startLine,
                  extra: { graphId: part.id, emfType: 'PartUsage' },
                })}
              >
                <rect
                  x={cx - LBOX_W / 2} y={0}
                  width={LBOX_W} height={LBOX_H} rx={4}
                  fill={isSel ? '#1e3a5f' : '#1e293b'}
                  stroke={isSel ? '#38bdf8' : '#334155'}
                  strokeWidth={isSel ? 1.5 : 1}
                />
                <text
                  x={cx} y={LBOX_H / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fill={isSel ? '#7dd3fc' : '#e2e8f0'}
                  fontSize={11}
                  fontWeight={isSel ? 600 : 400}
                >
                  {part.label}
                </text>
                {/* Dashed lifeline */}
                <line
                  x1={cx} y1={LBOX_H}
                  x2={cx} y2={totalH - SVG_PAD_BOT}
                  stroke={isSel ? '#38bdf8' : '#334155'}
                  strokeWidth={1}
                  strokeDasharray="5 4"
                />
              </g>
            );
          })}

          {/* Messages */}
          {messages.map((msg, idx) => {
            if (!msg.from || !msg.to) return null;
            const fi = partIdx.get(msg.from.participant) ?? -1;
            const ti = partIdx.get(msg.to.participant)   ?? -1;
            if (fi < 0 || ti < 0) return null;
            const x1    = lifelineX(fi);
            const x2    = lifelineX(ti);
            const y     = MSG_START_Y + idx * MSG_STEP_Y;
            const isSel = selGraphId === msg.id;
            const stroke = isSel ? '#38bdf8' : '#64748b';
            const right  = x2 > x1;
            const aX     = right ? x2 - ARROW_SIZE : x2 + ARROW_SIZE;

            return (
              <g
                key={msg.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect({
                  id:    msg.id,
                  type:  'connection',
                  name:  msg.label,
                  line:  msg.line,
                  extra: { graphId: msg.id, emfType: 'FlowUsage' },
                })}
              >
                {/* Label above the arrow */}
                <text
                  x={(x1 + x2) / 2} y={y - 8}
                  textAnchor="middle"
                  fill={isSel ? '#7dd3fc' : '#94a3b8'}
                  fontSize={10}
                  fontWeight={isSel ? 600 : 400}
                >
                  {msg.label}
                </text>
                {/* Arrow shaft */}
                <line x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={isSel ? 2 : 1.5} />
                {/* Filled arrowhead */}
                <polygon
                  points={`${x2},${y} ${aX},${y - ARROW_SIZE / 2} ${aX},${y + ARROW_SIZE / 2}`}
                  fill={stroke}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
