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

/**
 * Decode a message endpoint (ParameterMembership child of a FlowUsage).
 *
 * Two syntactic forms produced by the official parser:
 *   1. Dotted: `from acpdCdd.AcpdCdd_Activation_source`
 *      ParameterMembership → EventOccurrenceUsage → ReferenceSubsetting → Feature
 *        → FeatureChaining[participant], FeatureChaining[event]
 *   2. Direct: `from acpdSignalProcessing` (participant lifeline only, no event)
 *      ParameterMembership → EventOccurrenceUsage → ReferenceSubsetting (label = participant)
 *
 * Form (2) is what the demo's sequence action def uses for every message, so
 * missing it caused every lifeline to appear empty.
 */
function resolveEndpoint(
  paramMembId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): Endpoint | null {
  for (const evtId of childrenOf.get(paramMembId) ?? []) {
    if (nodeById.get(evtId)?.type !== 'EventOccurrenceUsage') continue;
    for (const refId of childrenOf.get(evtId) ?? []) {
      const refNode = nodeById.get(refId);
      if (refNode?.type !== 'ReferenceSubsetting') continue;
      // Dotted form: FeatureChaining children list participant + event.
      for (const featId of childrenOf.get(refId) ?? []) {
        if (nodeById.get(featId)?.type !== 'Feature') continue;
        const chains = (childrenOf.get(featId) ?? [])
          .map(id => nodeById.get(id))
          .filter((n): n is GraphNode => n?.type === 'FeatureChaining');
        if (chains.length >= 2) return { participant: chains[0].label, event: chains[1].label };
        if (chains.length === 1) return { participant: chains[0].label, event: '' };
      }
      // Direct form: ReferenceSubsetting.label is the participant.
      if (refNode.label && refNode.label !== 'ReferenceSubsetting') {
        return { participant: refNode.label, event: '' };
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
 * Children layout (positional, per SysML v2 §11.4):
 *   ParameterMembership[0]  → ifTest (FeatureReferenceExpression or OperatorExpression)
 *   ParameterMembership[1]  → then-branch ActionUsage (any name; demo files use
 *                              names like `enableSupplyBranch`, not `thenClause`)
 *   ParameterMembership[2]? → else-branch ActionUsage (any name)
 *
 * The earlier label-based match for `thenClause` / `elseClause` was too strict
 * and silently dropped both branches in real demos.
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

  const params = (childrenOf.get(ifId) ?? [])
    .filter(id => nodeById.get(id)?.type === 'ParameterMembership');

  // Param 0 → condition expression
  if (params.length > 0) {
    for (const kid of childrenOf.get(params[0]) ?? []) {
      const n = nodeById.get(kid);
      if (!n) continue;
      if (n.type === 'FeatureReferenceExpression') {
        const name = findMembershipLabel(kid, childrenOf, nodeById);
        if (name) condition = name;
      } else if (n.type === 'OperatorExpression') {
        const name = findMembershipLabel(kid, childrenOf, nodeById);
        if (name) { condition = name; negated = true; }
      }
    }
  }

  // Param 1 → then-branch ActionUsage; param 2 → else-branch ActionUsage.
  const collectBranchFlows = (pmId: string, target: GraphNode[]) => {
    for (const kid of childrenOf.get(pmId) ?? []) {
      if (nodeById.get(kid)?.type === 'ActionUsage') {
        target.push(...flowsInActionUsage(kid, childrenOf, nodeById));
      }
    }
  };
  if (params.length > 1) collectBranchFlows(params[1], thenFlows);
  if (params.length > 2) collectBranchFlows(params[2], elseFlows);

  if (negated) condition = `not ${condition}`;
  return { condition, thenFlows, elseFlows };
}

/**
 * Decode a WhileLoopActionUsage into its body FlowUsages.
 *
 *   ParameterMembership[0] → whileTest (often empty in modeling-from-XMI code)
 *   ParameterMembership[1] → body ActionUsage containing FlowUsage children
 *
 * Renders as a `loop` combined fragment with one branch.
 */
function extractLoopBody(
  loopId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): GraphNode[] {
  const flows: GraphNode[] = [];
  const params = (childrenOf.get(loopId) ?? [])
    .filter(id => nodeById.get(id)?.type === 'ParameterMembership');
  if (params.length < 2) return flows;
  // Body is the LAST parameter (after whileTest).
  const bodyParam = params[params.length - 1];
  for (const kid of childrenOf.get(bodyParam) ?? []) {
    if (nodeById.get(kid)?.type === 'ActionUsage') {
      flows.push(...flowsInActionUsage(kid, childrenOf, nodeById));
    }
  }
  return flows;
}

/** Logical negation of a guard label (strips or adds "not "). */
function negateCondition(cond: string): string {
  return cond.startsWith('not ') ? cond.slice(4) : `not ${cond}`;
}

// ── Data types ─────────────────────────────────────────────────────────────────

type FragmentKind = 'alt' | 'loop';

interface ParsedMessage {
  id:               string;
  label:            string;
  from:             Endpoint | null;
  to:               Endpoint | null;
  line?:            number;
  guard?:           string;
  fragmentBlockId?: string;       // groups consecutive messages into one combined fragment
  fragmentKind?:    FragmentKind; // 'alt' for if/else, 'loop' for while-loops
}

interface AltBranchLayout {
  condition:  string;
  sepY?:      number;
  condLabelY: number;
}

interface AltBlockLayout {
  kind:     FragmentKind;
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
  fragmentBlockId?: string,
  fragmentKind?: FragmentKind,
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
    ...(guard           !== undefined ? { guard }           : {}),
    ...(fragmentBlockId !== undefined ? { fragmentBlockId } : {}),
    ...(fragmentKind    !== undefined ? { fragmentKind }    : {}),
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
    const SEQ_CHILD_TYPES = new Set(['FlowUsage', 'IfActionUsage', 'WhileLoopActionUsage']);
    if (!sChildren.some(c => SEQ_CHILD_TYPES.has(c.type))) continue;

    const sorted = sChildren.slice().sort((a, b) => (a.startLine ?? 0) - (b.startLine ?? 0));

    // Lifelines per SysML v2 §13 (Interactions): any Usage referenced from a
    // message endpoint, not just PartUsage.  Real demos declare lifelines via
    // `ref part`, `ref port`, `ref item`, etc. — all parse to distinct EMF types.
    // Attribute/Action/IfAction/WhileLoop are explicitly excluded since they're
    // guards or control structures, not message endpoints.
    const LIFELINE_TYPES = new Set([
      'PartUsage', 'PortUsage', 'ItemUsage', 'ReferenceUsage',
      'ConnectionUsage', 'OccurrenceUsage',
    ]);
    const participants = sorted.filter(c => LIFELINE_TYPES.has(c.type));
    const messages: ParsedMessage[] = [];

    for (const child of sorted) {
      if (child.type === 'FlowUsage') {
        messages.push(resolveFlow(child, childrenOf, nodeById));
      } else if (child.type === 'IfActionUsage') {
        const { condition, thenFlows, elseFlows } = extractIfBranches(child.id, childrenOf, nodeById);
        if (thenFlows.length === 0 && elseFlows.length === 0) continue;
        const cond     = condition || 'condition';
        const elseCond = negateCondition(cond);
        for (const f of thenFlows) messages.push(resolveFlow(f, childrenOf, nodeById, cond,     child.id, 'alt'));
        for (const f of elseFlows) messages.push(resolveFlow(f, childrenOf, nodeById, elseCond, child.id, 'alt'));
      } else if (child.type === 'WhileLoopActionUsage') {
        const bodyFlows = extractLoopBody(child.id, childrenOf, nodeById);
        if (bodyFlows.length === 0) continue;
        const loopLabel = child.label && child.label !== child.type ? child.label : 'loop';
        for (const f of bodyFlows) messages.push(resolveFlow(f, childrenOf, nodeById, loopLabel, child.id, 'loop'));
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
    const blockId = messages[i].fragmentBlockId;
    if (!blockId) {
      msgY[i] = curY;
      curY   += MSG_STEP_Y;
      i++;
      continue;
    }

    const blockKind   = messages[i].fragmentKind ?? 'alt';
    const blockTopY   = curY;
    curY += ALT_HEADER_H;

    const branches: AltBranchLayout[] = [];
    let currentCondition = '';

    // Consume every consecutive message with the same fragmentBlockId.
    while (i < messages.length && messages[i].fragmentBlockId === blockId) {
      const cond = messages[i].guard ?? '';
      if (cond !== currentCondition) {
        if (currentCondition === '') {
          branches.push({ condition: cond, condLabelY: blockTopY + ALT_TAG_H / 2 });
        } else {
          const sepY = curY;
          curY     += ALT_SEP_H;
          branches.push({ condition: cond, sepY, condLabelY: sepY + 10 });
        }
        currentCondition = cond;
      }
      msgY[i] = curY;
      curY   += MSG_STEP_Y;
      i++;
    }

    const blockBottomY = curY + ALT_VPAD;
    altBlocks.push({ kind: blockKind, topY: blockTopY, bottomY: blockBottomY, branches });
    curY = blockBottomY + MSG_STEP_Y / 2;
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
          {/* Combined fragment backgrounds (alt / loop) — rendered before lifelines */}
          {altBlocks.map((blk, bi) => {
            const tagW = blk.kind === 'loop' ? 36 : ALT_TAG_W;
            return (
              <g key={`alt-${bi}`}>
                <rect
                  x={altX} y={blk.topY} width={altW} height={blk.bottomY - blk.topY}
                  fill="none" stroke={C_ALT_BORDER} strokeWidth={1} rx={2}
                />
                {/* Pentagon tag — 'alt' or 'loop' */}
                <polygon
                  points={[
                    `${altX},${blk.topY}`,
                    `${altX + tagW},${blk.topY}`,
                    `${altX + tagW},${blk.topY + ALT_TAG_H - 6}`,
                    `${altX + tagW - 6},${blk.topY + ALT_TAG_H}`,
                    `${altX},${blk.topY + ALT_TAG_H}`,
                  ].join(' ')}
                  fill={C_ALT_TAG_BG} stroke={C_ALT_TAG_BD} strokeWidth={1}
                />
                <text
                  x={altX + tagW / 2} y={blk.topY + ALT_TAG_H / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fill={C_ALT_TAG_TX} fontSize={9} fontWeight={600}
                >{blk.kind}</text>
                {blk.branches.map((br, bri) => (
                  <g key={`br-${bri}`}>
                    {br.sepY !== undefined && (
                      <line
                        x1={altX} y1={br.sepY} x2={altX + altW} y2={br.sepY}
                        stroke={C_ALT_SEP} strokeWidth={1} strokeDasharray="5 3"
                      />
                    )}
                    {br.condition && (
                      <text
                        x={bri === 0 ? altX + tagW + 4 : altX + 6}
                        y={br.condLabelY}
                        dominantBaseline="central"
                        fill={C_ALT_COND} fontSize={10} fontStyle="italic"
                      >{`[${br.condition}]`}</text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}

          {/* Lifelines */}
          {participants.map((part, i) => {
            const cx = centers[i], bw = widths[i], isSel = selGraphId === part.id;
            // Selection 'type' stays 'part' so cross-view sync (Inspector,
            // model tree) treats a clicked lifeline as a structural participant
            // regardless of whether it's a PartUsage, PortUsage, ItemUsage, …
            return (
              <g key={part.id} style={{ cursor: 'pointer' }} onClick={() => onSelect({
                id: part.id, type: 'part', name: part.label, line: part.startLine,
                extra: { graphId: part.id, emfType: part.type },
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
            const isSel  = selGraphId === msg.id;
            const stroke = isSel ? '#38bdf8' : '#64748b';
            const isSelf = fi === ti;

            const onClick = () => onSelect({
              id: msg.id, type: 'connection', name: msg.label, line: msg.line,
              extra: { graphId: msg.id, emfType: 'FlowUsage' },
            });
            const labelFill = isSel ? '#7dd3fc' : '#94a3b8';
            const sw        = isSel ? 2 : 1.5;

            // Self-message: rectangular loop to the right of the lifeline.
            if (isSelf) {
              const loopW = 30;
              const loopH = 14;
              const startY = y - loopH / 2;
              const endY   = y + loopH / 2;
              const tipX   = x1 + ARROW_SIZE;
              return (
                <g key={msg.id} style={{ cursor: 'pointer' }} onClick={onClick}>
                  <text x={x1 + loopW + 6} y={startY - 2} textAnchor="start"
                    fill={labelFill} fontSize={10} fontWeight={isSel ? 600 : 400}>
                    {msg.label}
                  </text>
                  <path d={`M ${x1} ${startY} L ${x1+loopW} ${startY} L ${x1+loopW} ${endY} L ${tipX} ${endY}`}
                        fill="none" stroke={stroke} strokeWidth={sw} />
                  <polygon
                    points={`${x1},${endY} ${tipX},${endY-ARROW_SIZE/2} ${tipX},${endY+ARROW_SIZE/2}`}
                    fill={stroke}
                  />
                </g>
              );
            }

            const right = x2 > x1;
            const aX    = right ? x2 - ARROW_SIZE : x2 + ARROW_SIZE;
            return (
              <g key={msg.id} style={{ cursor: 'pointer' }} onClick={onClick}>
                <text x={(x1+x2)/2} y={y-8} textAnchor="middle"
                  fill={labelFill} fontSize={10} fontWeight={isSel ? 600 : 400}>
                  {msg.label}
                </text>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={sw} />
                <polygon points={`${x2},${y} ${aX},${y-ARROW_SIZE/2} ${aX},${y+ARROW_SIZE/2}`} fill={stroke} />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
