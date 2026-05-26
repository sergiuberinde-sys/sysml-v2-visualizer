import { useMemo, useState, useEffect } from 'react';
import type { ContainmentGraph, GraphNode } from '../../core/sysmlv2Official/ContainmentGraph';
import type { SelectionState } from '../../app/selection';

interface Props {
  graph: ContainmentGraph | undefined;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
}

// ── Layout constants ───────────────────────────────────────────────────────────
const CHAR_W       = 7.2;
const BOX_PAD_X    = 20;
const LBOX_MIN_W   = 60;
const LBOX_H       = 38;
const LBOX_GAP     = 32;
const MSG_START_Y  = LBOX_H + 32;
const MSG_STEP_Y   = 46;
const SVG_PAD_X    = 24;
const SVG_PAD_BOT  = 28;
const ARROW_SIZE   = 7;

// Alt combined fragment
const ALT_HEADER_H = 44;
const ALT_SEP_H    = 36;
const ALT_VPAD     = 8;
const ALT_HMARGIN  = 12;
const ALT_TAG_W    = 28;
const ALT_TAG_H    = 18;

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

// ── IfActionUsage extraction ───────────────────────────────────────────────────

/**
 * DFS to find the first Membership node (carries the condition attribute name).
 * Stops at the first match to avoid over-reaching into nested structures.
 */
function findMembershipLabel(
  id: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): string | null {
  const n = nodeById.get(id);
  if (!n) return null;
  if (n.type === 'Membership' && n.label !== 'Membership') return n.label;
  for (const kid of childrenOf.get(id) ?? []) {
    const found = findMembershipLabel(kid, childrenOf, nodeById);
    if (found) return found;
  }
  return null;
}

/**
 * Extract all FlowUsage direct children of an ActionUsage body.
 * These are wrapped in FeatureMembership inside the ActionUsage.
 */
function flowsInActionUsage(
  actionId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): GraphNode[] {
  const flows: GraphNode[] = [];
  for (const membId of childrenOf.get(actionId) ?? []) {
    const memb = nodeById.get(membId);
    if (!memb || memb.type !== 'FeatureMembership') continue;
    for (const kid of childrenOf.get(membId) ?? []) {
      const n = nodeById.get(kid);
      if (n?.type === 'FlowUsage') flows.push(n);
    }
  }
  return flows;
}

interface IfBranches {
  condition:  string;   // e.g. "credentialsValid" or "not credentialsValid"
  thenFlows:  GraphNode[];
  elseFlows:  GraphNode[];
}

/**
 * Decode an IfActionUsage node into its condition label and branch FlowUsages.
 *
 * ifTest child:
 *   FeatureReferenceExpression → Membership[name]          (if flag)
 *   OperatorExpression → ... → Membership[name]            (if not flag)
 * thenClause / elseClause: ActionUsage nodes containing FlowUsage children.
 */
function extractIfBranches(
  ifId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): IfBranches {
  let condition  = '';
  let negated    = false;
  const thenFlows: GraphNode[] = [];
  const elseFlows: GraphNode[] = [];

  for (const pmId of childrenOf.get(ifId) ?? []) {
    const pm = nodeById.get(pmId);
    if (!pm || pm.type !== 'ParameterMembership') continue;

    for (const kid of childrenOf.get(pmId) ?? []) {
      const n = nodeById.get(kid);
      if (!n) continue;

      if (n.type === 'FeatureReferenceExpression') {
        // Direct: if flag
        const name = findMembershipLabel(kid, childrenOf, nodeById);
        if (name) condition = name;
      } else if (n.type === 'OperatorExpression') {
        // Negated: if not flag
        const name = findMembershipLabel(kid, childrenOf, nodeById);
        if (name) { condition = name; negated = true; }
      } else if (n.type === 'ActionUsage' && n.label === 'thenClause') {
        thenFlows.push(...flowsInActionUsage(kid, childrenOf, nodeById));
      } else if (n.type === 'ActionUsage' && n.label === 'elseClause') {
        elseFlows.push(...flowsInActionUsage(kid, childrenOf, nodeById));
      }
    }
  }

  if (negated) condition = `not ${condition}`;
  return { condition, thenFlows, elseFlows };
}

/** Logical negation of a guard label (strips or adds "not "). */
function negateCondition(cond: string): string {
  return cond.startsWith('not ') ? cond.slice(4) : `not ${cond}`;
}

// ── Data types ─────────────────────────────────────────────────────────────────

interface ParsedMessage {
  id:     string;
  label:  string;
  from:   Endpoint | null;
  to:     Endpoint | null;
  line?:  number;
  guard?: string;
}

interface AltBranchLayout {
  condition:  string;
  sepY?:      number;
  condLabelY: number;
}

interface AltBlockLayout {
  topY:     number;
  bottomY:  number;
  branches: AltBranchLayout[];
}

interface SequenceDef {
  node:         GraphNode;
  participants: GraphNode[];
  messages:     ParsedMessage[];
}

// ── Flow resolver (shared helper) ──────────────────────────────────────────────

function resolveFlow(
  flow: GraphNode,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
  guard?: string,
): ParsedMessage {
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
    ...(guard !== undefined ? { guard } : {}),
  };
}

// ── Parsing ────────────────────────────────────────────────────────────────────

function parseSequenceDefs(
  graph: ContainmentGraph,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): SequenceDef[] {
  const results: SequenceDef[] = [];

  for (const n of graph.nodes) {
    // Accept both PartDefinition (plain sequences) and ActionDefinition (with if/else)
    if (n.type !== 'PartDefinition' && n.type !== 'ActionDefinition') continue;

    const sChildren = semanticChildren(n.id, childrenOf, nodeById);
    if (!sChildren.some(c => c.type === 'FlowUsage' || c.type === 'IfActionUsage')) continue;

    const sorted       = sChildren.slice().sort((a, b) => (a.startLine ?? 0) - (b.startLine ?? 0));
    const participants = sorted.filter(c => c.type === 'PartUsage');
    const messages: ParsedMessage[] = [];

    for (const child of sorted) {
      if (child.type === 'FlowUsage') {
        messages.push(resolveFlow(child, childrenOf, nodeById));
      } else if (child.type === 'IfActionUsage') {
        const { condition, thenFlows, elseFlows } = extractIfBranches(child.id, childrenOf, nodeById);
        if (!condition) continue;
        const elseCond = negateCondition(condition);
        for (const f of thenFlows) messages.push(resolveFlow(f, childrenOf, nodeById, condition));
        for (const f of elseFlows) messages.push(resolveFlow(f, childrenOf, nodeById, elseCond));
      }
    }

    results.push({ node: n, participants, messages });
  }

  return results.sort((a, b) => (a.node.startLine ?? 0) - (b.node.startLine ?? 0));
}

// ── Message layout (accounts for alt blocks) ──────────────────────────────────

interface MessageLayout {
  msgY:      number[];
  altBlocks: AltBlockLayout[];
  totalH:    number;
}

function computeMessageLayout(messages: ParsedMessage[]): MessageLayout {
  const msgY: number[]              = new Array(messages.length);
  const altBlocks: AltBlockLayout[] = [];
  let curY = MSG_START_Y;
  let i    = 0;

  while (i < messages.length) {
    if (!messages[i].guard) {
      msgY[i] = curY;
      curY   += MSG_STEP_Y;
      i++;
    } else {
      const blockTopY = curY;
      curY += ALT_HEADER_H;

      const branches: AltBranchLayout[] = [];
      let currentCondition = '';

      while (i < messages.length && messages[i].guard) {
        const cond = messages[i].guard!;
        if (cond !== currentCondition) {
          if (currentCondition === '') {
            branches.push({ condition: cond, condLabelY: blockTopY + ALT_TAG_H / 2 });
          } else {
            const sepY = curY;
            curY      += ALT_SEP_H;
            branches.push({ condition: cond, sepY, condLabelY: sepY + 10 });
          }
          currentCondition = cond;
        }
        msgY[i] = curY;
        curY   += MSG_STEP_Y;
        i++;
      }

      const blockBottomY = curY + ALT_VPAD;
      altBlocks.push({ topY: blockTopY, bottomY: blockBottomY, branches });
      curY = blockBottomY + MSG_STEP_Y / 2;
    }
  }

  return { msgY, altBlocks, totalH: curY + SVG_PAD_BOT };
}

// ── Lifeline layout ────────────────────────────────────────────────────────────

function computeLayout(participants: GraphNode[]) {
  const widths  = participants.map(p => boxW(p.label));
  const centers: number[] = [];
  let cursor = SVG_PAD_X;
  for (let i = 0; i < widths.length; i++) {
    centers.push(cursor + widths[i] / 2);
    cursor += widths[i] + (i < widths.length - 1 ? LBOX_GAP : 0);
  }
  return { centers, widths, totalW: cursor + SVG_PAD_X };
}

// ── Colours ────────────────────────────────────────────────────────────────────

const C_ALT_BORDER = '#334155';
const C_ALT_TAG_BG = '#0f172a';
const C_ALT_TAG_BD = '#38bdf8';
const C_ALT_TAG_TX = '#38bdf8';
const C_ALT_COND   = '#94a3b8';
const C_ALT_SEP    = '#475569';

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
    return <div style={{ padding: 24, color: '#64748b', fontSize: 13 }}>No graph data available. Ensure the SysML v2 parser service is running.</div>;
  }
  if (sequenceDefs.length === 0) {
    return <div style={{ padding: 24, color: '#64748b', fontSize: 13 }}>No sequence definitions found in this model.</div>;
  }

  const activeSeq                    = sequenceDefs.find(s => s.node.id === selectedSeqId) ?? sequenceDefs[0];
  const { participants, messages }    = activeSeq;
  const { centers, widths, totalW }   = computeLayout(participants);
  const { msgY, altBlocks, totalH }   = computeMessageLayout(messages);
  const partIdx                       = new Map(participants.map((p, i) => [p.label, i]));
  const selGraphId                    = selection?.extra?.graphId;

  // Activation bars: span from first to last message y each participant appears in
  const actSpans = new Map<string, { topY: number; botY: number }>();
  messages.forEach((msg, idx) => {
    const y = msgY[idx];
    for (const ep of [msg.from, msg.to]) {
      if (!ep) continue;
      const p = ep.participant;
      const cur = actSpans.get(p);
      if (!cur) actSpans.set(p, { topY: y, botY: y });
      else actSpans.set(p, { topY: Math.min(cur.topY, y), botY: Math.max(cur.botY, y) });
    }
  });

  const altX = SVG_PAD_X - ALT_HMARGIN;
  const altW = totalW - SVG_PAD_X + ALT_HMARGIN - altX;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0f172a' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
        borderBottom: '1px solid #1e293b', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          {sequenceDefs.map(seq => (
            <button key={seq.node.id} onClick={() => setSelectedSeqId(seq.node.id)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              border:     `1px solid ${seq.node.id === activeSeq.node.id ? '#38bdf8' : '#334155'}`,
              background: seq.node.id === activeSeq.node.id ? '#1e3a5f' : '#1e293b',
              color:      seq.node.id === activeSeq.node.id ? '#7dd3fc' : '#94a3b8',
              whiteSpace: 'nowrap',
            }}>
              {seq.node.label}
            </button>
          ))}
        </div>
        <button title="Fit view" onClick={() => setFitMode(v => !v)} style={{
          fontSize: 11, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', flexShrink: 0,
          border:     `1px solid ${fitMode ? '#38bdf8' : '#2a2a3a'}`,
          background: fitMode ? '#1e3a5f' : '#111827',
          color:      fitMode ? '#7dd3fc' : '#9ca3af',
        }}>
          ⊡ Fit
        </button>
      </div>

      {/* ── Diagram ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: fitMode ? 'hidden' : 'auto', padding: fitMode ? 0 : 16 }}>
        <svg
          width={fitMode ? '100%' : totalW} height={fitMode ? '100%' : totalH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ fontFamily: 'monospace', userSelect: 'none', display: 'block' }}
        >
          {/* Alt combined fragment backgrounds — rendered before lifelines */}
          {altBlocks.map((blk, bi) => (
            <g key={`alt-${bi}`}>
              <rect
                x={altX} y={blk.topY} width={altW} height={blk.bottomY - blk.topY}
                fill="none" stroke={C_ALT_BORDER} strokeWidth={1} rx={2}
              />
              {/* Pentagon "alt" tag */}
              <polygon
                points={[
                  `${altX},${blk.topY}`,
                  `${altX + ALT_TAG_W},${blk.topY}`,
                  `${altX + ALT_TAG_W},${blk.topY + ALT_TAG_H - 6}`,
                  `${altX + ALT_TAG_W - 6},${blk.topY + ALT_TAG_H}`,
                  `${altX},${blk.topY + ALT_TAG_H}`,
                ].join(' ')}
                fill={C_ALT_TAG_BG} stroke={C_ALT_TAG_BD} strokeWidth={1}
              />
              <text
                x={altX + ALT_TAG_W / 2} y={blk.topY + ALT_TAG_H / 2}
                textAnchor="middle" dominantBaseline="central"
                fill={C_ALT_TAG_TX} fontSize={9} fontWeight={600}
              >alt</text>
              {blk.branches.map((br, bri) => (
                <g key={`br-${bri}`}>
                  {br.sepY !== undefined && (
                    <line
                      x1={altX} y1={br.sepY} x2={altX + altW} y2={br.sepY}
                      stroke={C_ALT_SEP} strokeWidth={1} strokeDasharray="5 3"
                    />
                  )}
                  <text
                    x={bri === 0 ? altX + ALT_TAG_W + 4 : altX + 6}
                    y={br.condLabelY}
                    dominantBaseline="central"
                    fill={C_ALT_COND} fontSize={10} fontStyle="italic"
                  >{`[${br.condition}]`}</text>
                </g>
              ))}
            </g>
          ))}

          {/* Lifelines */}
          {participants.map((part, i) => {
            const cx = centers[i], bw = widths[i], isSel = selGraphId === part.id;
            return (
              <g key={part.id} style={{ cursor: 'pointer' }} onClick={() => onSelect({
                id: part.id, type: 'part', name: part.label, line: part.startLine,
                extra: { graphId: part.id, emfType: 'PartUsage' },
              })}>
                <rect x={cx - bw/2} y={0} width={bw} height={LBOX_H} rx={4}
                  fill={isSel ? '#1e3a5f' : '#1e293b'}
                  stroke={isSel ? '#38bdf8' : '#334155'} strokeWidth={isSel ? 1.5 : 1} />
                <text x={cx} y={LBOX_H/2} textAnchor="middle" dominantBaseline="central"
                  fill={isSel ? '#7dd3fc' : '#e2e8f0'} fontSize={11} fontWeight={isSel ? 600 : 400}>
                  {part.label}
                </text>
                <line x1={cx} y1={LBOX_H} x2={cx} y2={totalH - SVG_PAD_BOT}
                  stroke={isSel ? '#38bdf8' : '#334155'} strokeWidth={1} strokeDasharray="5 4" />
              </g>
            );
          })}

          {/* Execution activation bars */}
          {participants.map((part, i) => {
            const span = actSpans.get(part.label);
            if (!span) return null;
            const cx = centers[i];
            const isSel = selGraphId === part.id;
            const barW  = 10;
            const barTop = Math.max(LBOX_H, span.topY - 12);
            const barBot = span.botY + 12;
            return (
              <rect key={`act-${part.id}`}
                x={cx - barW / 2} y={barTop}
                width={barW} height={barBot - barTop}
                fill={isSel ? '#1e3a5f' : '#172040'}
                stroke={isSel ? '#38bdf8' : '#2d5a9e'}
                strokeWidth={1} rx={2}
                style={{ pointerEvents: 'none' }}
              />
            );
          })}

          {/* Messages */}
          {messages.map((msg, idx) => {
            if (!msg.from || !msg.to) return null;
            const fi = partIdx.get(msg.from.participant) ?? -1;
            const ti = partIdx.get(msg.to.participant)   ?? -1;
            if (fi < 0 || ti < 0) return null;
            const x1 = centers[fi], x2 = centers[ti], y = msgY[idx];
            const isSel = selGraphId === msg.id;
            const stroke = isSel ? '#38bdf8' : '#64748b';
            const right  = x2 > x1;
            const aX     = right ? x2 - ARROW_SIZE : x2 + ARROW_SIZE;
            return (
              <g key={msg.id} style={{ cursor: 'pointer' }} onClick={() => onSelect({
                id: msg.id, type: 'connection', name: msg.label, line: msg.line,
                extra: { graphId: msg.id, emfType: 'FlowUsage' },
              })}>
                <text x={(x1+x2)/2} y={y-8} textAnchor="middle"
                  fill={isSel ? '#7dd3fc' : '#94a3b8'} fontSize={10} fontWeight={isSel ? 600 : 400}>
                  {msg.label}
                </text>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={isSel ? 2 : 1.5} />
                <polygon points={`${x2},${y} ${aX},${y-ARROW_SIZE/2} ${aX},${y+ARROW_SIZE/2}`} fill={stroke} />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
