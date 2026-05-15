import { useMemo, useState, useEffect } from 'react';
import type { ContainmentGraph, GraphNode } from '../../core/sysmlv2Official/ContainmentGraph';
import type { SelectionState } from '../../app/selection';

interface Props {
  graph: ContainmentGraph | undefined;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
}

// ── Layout constants ───────────────────────────────────────────────────────────
// Box width is computed per-lifeline from text length; these are the variables.
const CHAR_W      = 7.2;   // px per char at 11px monospace (generous estimate)
const BOX_PAD_X   = 20;    // total horizontal padding inside box (10px each side)
const LBOX_MIN_W  = 60;
const LBOX_H      = 38;
const LBOX_GAP    = 32;    // horizontal gap between adjacent lifeline boxes
const MSG_START_Y = LBOX_H + 32;
const MSG_STEP_Y  = 46;
const SVG_PAD_X   = 24;
const SVG_PAD_BOT = 28;
const ARROW_SIZE  = 7;

const boxW = (label: string) =>
  Math.max(LBOX_MIN_W, Math.ceil(label.length * CHAR_W) + BOX_PAD_X);

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

// ── Layout computation (variable-width lifelines) ──────────────────────────────

interface LifelineLayout {
  centers:   number[];  // SVG x of each lifeline centre
  widths:    number[];  // box width for each lifeline
  totalW:    number;
}

function computeLayout(participants: GraphNode[]): LifelineLayout {
  const widths: number[] = participants.map(p => boxW(p.label));
  const centers: number[] = [];
  let cursor = SVG_PAD_X;
  for (let i = 0; i < widths.length; i++) {
    centers.push(cursor + widths[i] / 2);
    cursor += widths[i] + (i < widths.length - 1 ? LBOX_GAP : 0);
  }
  const totalW = cursor + SVG_PAD_X;
  return { centers, widths, totalW };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SysMLSequenceView({ graph, selection, onSelect }: Props) {
  const [selectedSeqId, setSelectedSeqId] = useState<string>('');
  const [fitMode, setFitMode]             = useState(false);

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

  const activeSeq   = sequenceDefs.find(s => s.node.id === selectedSeqId) ?? sequenceDefs[0];
  const { participants, messages } = activeSeq;
  const layout      = computeLayout(participants);
  const { centers, widths, totalW } = layout;
  const totalH      = MSG_START_Y + messages.length * MSG_STEP_Y + SVG_PAD_BOT;
  const partIdx     = new Map(participants.map((p, i) => [p.label, i]));
  const selGraphId  = selection?.extra?.graphId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0f172a' }}>

      {/* ── Toolbar: sequence selector + fit button ───────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
        borderBottom: '1px solid #1e293b', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
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
        <button
          title="Fit view"
          onClick={() => setFitMode(v => !v)}
          style={{
            fontSize: 11, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
            flexShrink: 0,
            border:     `1px solid ${fitMode ? '#38bdf8' : '#2a2a3a'}`,
            background: fitMode ? '#1e3a5f' : '#111827',
            color:      fitMode ? '#7dd3fc' : '#9ca3af',
          }}
        >
          ⊡ Fit
        </button>
      </div>

      {/* ── Diagram ───────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflow: fitMode ? 'hidden' : 'auto',
        padding: fitMode ? 0 : 16,
      }}>
        <svg
          width={fitMode ? '100%' : totalW}
          height={fitMode ? '100%' : totalH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ fontFamily: 'monospace', userSelect: 'none', display: 'block' }}
        >
          {/* Lifelines */}
          {participants.map((part, i) => {
            const cx    = centers[i];
            const bw    = widths[i];
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
                  x={cx - bw / 2} y={0}
                  width={bw} height={LBOX_H} rx={4}
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
            const x1    = centers[fi];
            const x2    = centers[ti];
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
