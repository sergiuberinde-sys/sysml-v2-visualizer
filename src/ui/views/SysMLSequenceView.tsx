import { useMemo, useState, useEffect, useRef } from 'react';
import type { ContainmentGraph, GraphNode } from '../../core/sysmlv2Official/ContainmentGraph';
import type { SelectionState } from '../../app/selection';
import {
  buildPortAsilIndex, indexDependenciesByClient, deriveMessageAsilFor,
  describeMessageAsil, asilShort,
  type DependencyMapping, type DerivedMessageAsil, type MessageDependencies, type PortAsilIndex,
} from '../../core/sysmlv2Official/messageInterfaceAsil';
import { asilColors } from '../layout/AsilBadge';
import type { SequenceTiming } from '../../core/sysmlv2Official/sequenceTiming';

// ── Zoom bounds ────────────────────────────────────────────────────────────────
const ZOOM_MIN  = 0.25;
const ZOOM_MAX  = 4;
const ZOOM_STEP = 1.2; // multiplicative step per button click / wheel notch
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

interface Props {
  graph: ContainmentGraph | undefined;
  /** Retained message→interface-port dependencies used to derive per-message ASIL. */
  dependencies?: DependencyMapping[];
  /** Per-definition timing-evaluation data (elapsed measures, budget, contract). */
  timing?: SequenceTiming[];
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
const ALT_NEST_INSET = 12; // horizontal inset per nesting level, so nested fragments sit inside

const boxW = (label: string) =>
  Math.max(LBOX_MIN_W, Math.ceil(label.length * CHAR_W) + BOX_PAD_X);

// ── Graph helpers ──────────────────────────────────────────────────────────────

export function buildIndexes(graph: ContainmentGraph) {
  const nodeById   = new Map<string, GraphNode>();
  const childrenOf = new Map<string, string[]>();
  const parentOf   = new Map<string, string>();
  for (const n of graph.nodes) nodeById.set(n.id, n);
  for (const e of graph.edges) {
    if (e.type !== 'contains') continue;
    const arr = childrenOf.get(e.source) ?? [];
    arr.push(e.target);
    childrenOf.set(e.source, arr);
    parentOf.set(e.target, e.source);
  }
  return { nodeById, childrenOf, parentOf };
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

// SysML v2 control-structure node types that become sequence messages / fragments.
const SEQ_CHILD_TYPES = new Set(['FlowUsage', 'IfActionUsage', 'WhileLoopActionUsage']);

/** The FlowUsage / If / While members of a body (ActionDef or a branch ActionUsage), source-ordered. */
function seqChildren(
  containerId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): GraphNode[] {
  return semanticChildren(containerId, childrenOf, nodeById)
    .filter(c => SEQ_CHILD_TYPES.has(c.type))
    .sort((a, b) => (a.startLine ?? 0) - (b.startLine ?? 0));
}

/**
 * Condition label of an IfActionUsage (ParameterMembership[0] → ifTest), negated form included.
 */
function ifCondition(
  ifId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): string {
  const params = (childrenOf.get(ifId) ?? [])
    .filter(id => nodeById.get(id)?.type === 'ParameterMembership');
  if (params.length === 0) return '';
  let condition = '';
  let negated   = false;
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
  return negated ? `not ${condition}` : condition;
}

/**
 * The then / else branch ActionUsage node ids of an IfActionUsage (positional, per SysML v2 §11.4):
 *   ParameterMembership[1] → then-branch ActionUsage; [2]? → else-branch ActionUsage.
 * Each branch body may itself contain FlowUsages AND nested If/While actions → nested fragments.
 */
function ifBranchActionIds(
  ifId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): { thenId: string | null; elseId: string | null } {
  const params = (childrenOf.get(ifId) ?? [])
    .filter(id => nodeById.get(id)?.type === 'ParameterMembership');
  const action = (pmId: string | undefined): string | null => {
    if (!pmId) return null;
    for (const kid of childrenOf.get(pmId) ?? [])
      if (nodeById.get(kid)?.type === 'ActionUsage') return kid;
    return null;
  };
  return { thenId: action(params[1]), elseId: action(params[2]) };
}

/** Body ActionUsage node id of a WhileLoopActionUsage (last ParameterMembership, after whileTest). */
function loopBodyActionId(
  loopId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): string | null {
  const params = (childrenOf.get(loopId) ?? [])
    .filter(id => nodeById.get(id)?.type === 'ParameterMembership');
  if (params.length < 2) return null;
  for (const kid of childrenOf.get(params[params.length - 1]) ?? [])
    if (nodeById.get(kid)?.type === 'ActionUsage') return kid;
  return null;
}

/** Logical negation of a guard label (strips or adds "not "). */
function negateCondition(cond: string): string {
  return cond.startsWith('not ') ? cond.slice(4) : `not ${cond}`;
}

// ── Data types ─────────────────────────────────────────────────────────────────

type FragmentKind = 'alt' | 'loop' | 'opt';

/** One enclosing combined fragment for a message. A message's `fragments` array is the full
 *  nesting path, outermost first, so nested `if`s render as nested `alt`/`opt` boxes. */
interface FragmentCtx {
  blockId: string;
  kind:    FragmentKind;
  guard:   string;        // the branch guard this message sits under (`cond`, `not cond`, loop label)
}

interface ParsedMessage {
  id:         string;
  label:      string;
  from:       Endpoint | null;
  to:         Endpoint | null;
  line?:      number;
  fragments?: FragmentCtx[]; // enclosing combined fragments, outermost → innermost
  payload?:   string;        // message payload/item type (`message X of Payload`)
  asil?:      DerivedMessageAsil; // ASIL derived from the two interface-port dependencies
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
  depth:    number;        // nesting level (0 = outermost) → horizontal inset
}

interface SequenceDef {
  node:         GraphNode;
  participants: GraphNode[];
  messages:     ParsedMessage[];
  entries:      Endpoint[];   // root event occurrences that start the interaction (found messages)
  successions:  Array<[string, string]>; // `first A then B` event pairs (keys `participant.event`), for timing placement
}

// ── Flow resolver (shared helper) ──────────────────────────────────────────────

function resolveFlow(
  flow: GraphNode,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
  fragments?: FragmentCtx[],
): ParsedMessage {
  const paramMembs = (childrenOf.get(flow.id) ?? [])
    .map(id => nodeById.get(id))
    .filter((n): n is GraphNode => n?.type === 'ParameterMembership');
  const [m0, m1] = paramMembs;
  const payload = messagePayload(flow.id, childrenOf, nodeById);
  return {
    id:    flow.id,
    label: flow.label,
    from:  m0 ? resolveEndpoint(m0.id, childrenOf, nodeById) : null,
    to:    m1 ? resolveEndpoint(m1.id, childrenOf, nodeById) : null,
    line:  flow.startLine,
    ...(fragments && fragments.length ? { fragments } : {}),
    ...(payload ? { payload } : {}),
  };
}

/** Payload/item type of a message (`message X of Payload`): the FeatureTyping under its PayloadFeature. */
function messagePayload(
  flowId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): string | undefined {
  for (const cid of childrenOf.get(flowId) ?? []) {
    if (nodeById.get(cid)?.type !== 'PayloadFeature') continue;
    for (const gid of childrenOf.get(cid) ?? []) {
      const g = nodeById.get(gid);
      if (g?.type === 'FeatureTyping' && g.label && g.label !== 'FeatureTyping') return g.label;
    }
  }
  return undefined;
}

/**
 * Qualified name of a node: `::`-joined labels of its Package/Definition ancestors
 * (self included when it is one). Matches the parser's qualified-name form, so a
 * sequence definition's qualified name + `::` + a message label equals the message's
 * qualified name used as a dependency client — the basis for action-def-scoped lookup.
 */
const QNAME_OWNER_TYPES = new Set([
  'Package', 'LibraryPackage', 'PartDefinition', 'ActionDefinition', 'ItemDefinition',
  'PortDefinition', 'ConnectionDefinition', 'InterfaceDefinition', 'AttributeDefinition',
]);
function qualifiedNameOf(
  id: string,
  parentOf: Map<string, string>,
  nodeById: Map<string, GraphNode>,
): string {
  const parts: string[] = [];
  let cur: string | undefined = id;
  while (cur) {
    const n = nodeById.get(cur);
    if (n && QNAME_OWNER_TYPES.has(n.type) && n.label && n.label !== n.type) parts.unshift(n.label);
    cur = parentOf.get(cur);
  }
  return parts.join('::');
}

/**
 * Walk one sequence node (flow / if / while), emitting messages that each carry the stack of
 * enclosing fragments. Recurses into if-branch and loop bodies, so a nested `if` inside a branch
 * produces messages whose `fragments` path has the outer fragment followed by the inner one —
 * which the layout renders as a nested combined fragment.
 */
function processSeqNode(
  node: GraphNode,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
  frags: FragmentCtx[],
  out: ParsedMessage[],
): void {
  if (node.type === 'FlowUsage') {
    out.push(resolveFlow(node, childrenOf, nodeById, frags));
    return;
  }
  if (node.type === 'IfActionUsage') {
    const { thenId, elseId } = ifBranchActionIds(node.id, childrenOf, nodeById);
    const thenKids = thenId ? seqChildren(thenId, childrenOf, nodeById) : [];
    const elseKids = elseId ? seqChildren(elseId, childrenOf, nodeById) : [];
    if (thenKids.length === 0 && elseKids.length === 0) return;
    // Two populated branches → UML `alt`; a single guarded branch → UML `opt`.
    const kind: FragmentKind = thenKids.length > 0 && elseKids.length > 0 ? 'alt' : 'opt';
    const cond     = ifCondition(node.id, childrenOf, nodeById) || 'condition';
    const elseCond = negateCondition(cond);
    for (const k of thenKids) processSeqNode(k, childrenOf, nodeById, [...frags, { blockId: node.id, kind, guard: cond }],     out);
    for (const k of elseKids) processSeqNode(k, childrenOf, nodeById, [...frags, { blockId: node.id, kind, guard: elseCond }], out);
    return;
  }
  if (node.type === 'WhileLoopActionUsage') {
    const bodyId   = loopBodyActionId(node.id, childrenOf, nodeById);
    const bodyKids = bodyId ? seqChildren(bodyId, childrenOf, nodeById) : [];
    if (bodyKids.length === 0) return;
    const loopLabel = node.label && node.label !== node.type ? node.label : 'loop';
    for (const k of bodyKids) processSeqNode(k, childrenOf, nodeById, [...frags, { blockId: node.id, kind: 'loop', guard: loopLabel }], out);
  }
}

// ── First/then ordering (SysML v2 succession → causal message order) ───────────
//
// A sequence's `first A.evt then B.evt` lines are SuccessionAsUsage nodes whose two
// EndFeatureMembership ends chain to `participant.event`. They state the temporal order
// of the events on the lifelines. We turn them — plus each message's own send→receive
// order — into an event DAG, rank every event by its longest causal path, and order the
// messages by the rank of their SEND event, so the diagram follows the declared order of
// events rather than the order the `message` lines happen to be written in.

/** DFS for the `participant.event` (or bare `participant`) chain under a subtree. */
function chainKeyUnder(
  rootId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): string | null {
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const n = nodeById.get(id);
    if (!n) continue;
    if (n.type === 'Feature') {
      const chains = (childrenOf.get(id) ?? [])
        .map(c => nodeById.get(c))
        .filter((c): c is GraphNode => c?.type === 'FeatureChaining' && c.label !== c.type);
      if (chains.length >= 2) return `${chains[0].label}.${chains[1].label}`;
      if (chains.length === 1) return chains[0].label;
    }
    for (const c of childrenOf.get(id) ?? []) queue.push(c);
  }
  return null;
}

/** The [earlierKey, laterKey] event pair of a SuccessionAsUsage (`first … then …`). */
function successionEventPair(
  succId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): [string, string] | null {
  const ends = (childrenOf.get(succId) ?? [])
    .map(id => nodeById.get(id))
    .filter((n): n is GraphNode => n?.type === 'EndFeatureMembership');
  if (ends.length < 2) return null;
  const a = chainKeyUnder(ends[0].id, childrenOf, nodeById);
  const b = chainKeyUnder(ends[1].id, childrenOf, nodeById);
  return a && b ? [a, b] : null;
}

/** Longest-path depth of every node in a DAG, or null if the graph has a cycle. */
function longestPathDepths(
  edges: Array<[string, string]>,
  nodes: Set<string>,
): Map<string, number> | null {
  const adj   = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const k of nodes) { adj.set(k, []); indeg.set(k, 0); }
  for (const [a, b] of edges) {
    if (!nodes.has(a) || !nodes.has(b) || a === b) continue;
    adj.get(a)!.push(b);
    indeg.set(b, (indeg.get(b) ?? 0) + 1);
  }
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const k of nodes) if ((indeg.get(k) ?? 0) === 0) { queue.push(k); depth.set(k, 0); }
  let processed = 0;
  while (queue.length) {
    const u = queue.shift()!;
    processed++;
    for (const v of adj.get(u) ?? []) {
      depth.set(v, Math.max(depth.get(v) ?? 0, (depth.get(u) ?? 0) + 1));
      indeg.set(v, indeg.get(v)! - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }
  return processed === nodes.size ? depth : null;   // incomplete ⇒ cycle
}

const endpointKey = (e: Endpoint | null): string | null =>
  e ? (e.event ? `${e.participant}.${e.event}` : e.participant) : null;

/**
 * Reorder messages to follow the `first/then` event ordering. Returns the input
 * UNCHANGED (so nothing regresses) when there are no successions, when ANY message sits
 * inside a fragment (reordering could break alt/opt contiguity), or when the event graph
 * has a cycle. Otherwise messages are sorted by the longest-path depth of their send
 * event, ties broken by original (source-line) order.
 */
export function orderMessagesByFirstThen(
  messages: ParsedMessage[],
  successions: Array<[string, string]>,
): ParsedMessage[] {
  if (successions.length === 0) return messages;
  if (messages.some(m => m.fragments && m.fragments.length > 0)) return messages;

  const nodes = new Set<string>();
  const edges: Array<[string, string]> = [];
  for (const [a, b] of successions) { nodes.add(a); nodes.add(b); edges.push([a, b]); }
  for (const m of messages) {
    const f = endpointKey(m.from), t = endpointKey(m.to);
    if (f) nodes.add(f);
    if (t) nodes.add(t);
    if (f && t) edges.push([f, t]);   // a message's send precedes its own receive
  }
  const depth = longestPathDepths(edges, nodes);
  if (!depth) return messages;        // cycle ⇒ leave as authored

  const origIndex = new Map(messages.map((m, i) => [m, i]));
  const rankOf = (m: ParsedMessage) => depth.get(endpointKey(m.from) ?? '') ?? Number.MAX_SAFE_INTEGER;
  return messages.slice().sort((a, b) => {
    const d = rankOf(a) - rankOf(b);
    return d !== 0 ? d : origIndex.get(a)! - origIndex.get(b)!;
  });
}

/** Split an endpoint key (`participant.event`) back into an Endpoint. */
function keyToEndpoint(key: string): Endpoint {
  const dot = key.indexOf('.');
  return dot < 0
    ? { participant: key, event: '' }
    : { participant: key.slice(0, dot), event: key.slice(dot + 1) };
}

/**
 * The interaction's ENTRY events — root event occurrences that start the sequence:
 * an event with no `first/then` predecessor that no message arrives at, yet which leads
 * somewhere (e.g. `smu.alarmAccepted`). These are the SysML/UML "found messages" — a
 * stimulus whose sender is outside the interaction. Returns [] when there are no
 * successions, so sequences without a first/then ordering are left exactly as-is.
 */
export function findEntryEvents(
  messages: ParsedMessage[],
  successions: Array<[string, string]>,
): Endpoint[] {
  if (successions.length === 0) return [];
  const epOf   = new Map<string, Endpoint>();
  const indeg  = new Map<string, number>();
  const outdeg = new Map<string, number>();
  const touch = (k: string) => { if (!indeg.has(k)) { indeg.set(k, 0); outdeg.set(k, 0); } };
  const edge  = (a: string, b: string) => {
    touch(a); touch(b);
    if (a === b) return;
    outdeg.set(a, outdeg.get(a)! + 1);
    indeg.set(b, indeg.get(b)! + 1);
  };
  const reg = (ep: Endpoint | null): string | null => {
    const k = endpointKey(ep);
    if (k) { touch(k); if (!epOf.has(k)) epOf.set(k, ep!); }
    return k;
  };
  for (const m of messages) { const f = reg(m.from), t = reg(m.to); if (f && t) edge(f, t); }
  for (const [a, b] of successions) {
    if (!epOf.has(a)) epOf.set(a, keyToEndpoint(a));
    if (!epOf.has(b)) epOf.set(b, keyToEndpoint(b));
    edge(a, b);
  }
  const entries: Endpoint[] = [];
  for (const [k, ep] of epOf) {
    if ((indeg.get(k) ?? 0) === 0 && (outdeg.get(k) ?? 0) > 0 && ep.event) entries.push(ep);
  }
  return entries;
}

// ── Parsing ────────────────────────────────────────────────────────────────────

/** Context used to derive each message's ASIL from its two interface-port dependencies. */
export interface AsilDerivationCtx {
  parentOf:     Map<string, string>;
  depsByClient: Map<string, MessageDependencies>;
  portIndex:    PortAsilIndex;
}

export function parseSequenceDefs(
  graph: ContainmentGraph,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
  asilCtx?: AsilDerivationCtx,
): SequenceDef[] {
  const results: SequenceDef[] = [];

  for (const n of graph.nodes) {
    // Only offer sequences declared in the currently-open file. `fromPrimary === false`
    // marks context (imported) nodes, which are kept in the graph for cross-file
    // resolution (ports, ASIL interfaces) but must not appear as selectable sequences.
    if (n.fromPrimary === false) continue;
    // Accept both PartDefinition (plain sequences) and ActionDefinition (with if/else)
    if (n.type !== 'PartDefinition' && n.type !== 'ActionDefinition') continue;

    const sChildren = semanticChildren(n.id, childrenOf, nodeById);
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
      if (SEQ_CHILD_TYPES.has(child.type)) processSeqNode(child, childrenOf, nodeById, [], messages);
    }

    // Order the messages by the `first/then` event ordering when present (falls back
    // to the source-line order collected above — see orderMessagesByFirstThen).
    const successions: Array<[string, string]> = [];
    for (const child of sorted) {
      if (child.type === 'SuccessionAsUsage' || child.type === 'Succession') {
        const pair = successionEventPair(child.id, childrenOf, nodeById);
        if (pair) successions.push(pair);
      }
    }
    const ordered = orderMessagesByFirstThen(messages, successions);
    const entries = findEntryEvents(messages, successions);

    // Only a genuine message sequence is selectable. A *behaviour* action definition
    // owns `flow` item-flows that also parse to FlowUsage but carry no lifeline
    // endpoints (from/to resolve to null); those must not turn an action diagram into
    // a "sequence". Require at least one real message between two lifelines.
    if (!ordered.some(m => m.from && m.to)) continue;

    // Derive each message's ASIL from its two interface-port dependencies, scoped to
    // THIS action definition: the message's qualified name (defQName::messageName) is
    // the dependency client, so lookups never cross action-definition scopes even when
    // message names repeat across sequences (SysML message names are only locally unique).
    if (asilCtx) {
      const defQName = qualifiedNameOf(n.id, asilCtx.parentOf, nodeById);
      for (const m of ordered) {
        const derived = deriveMessageAsilFor(`${defQName}::${m.label}`, asilCtx.depsByClient, asilCtx.portIndex);
        if (derived) m.asil = derived;
      }
    }

    results.push({ node: n, participants, messages: ordered, entries, successions });
  }

  return results.sort((a, b) => (a.node.startLine ?? 0) - (b.node.startLine ?? 0));
}

// ── Message layout (accounts for alt blocks) ──────────────────────────────────

interface MessageLayout {
  msgY:      number[];
  altBlocks: AltBlockLayout[];
  totalH:    number;
}

function computeMessageLayout(messages: ParsedMessage[], startY: number = MSG_START_Y): MessageLayout {
  const msgY: number[]              = new Array(messages.length);
  const altBlocks: AltBlockLayout[] = [];
  let curY = startY;

  // Stack of currently-open fragments (outermost at index 0), tracked as we walk messages in
  // order. A message's `fragments` path tells us which fragments must be open around it: we close
  // any that no longer match (deepest first) and open any new ones, so nested `if`s nest visually.
  interface Open { blockId: string; kind: FragmentKind; depth: number; topY: number; currentGuard: string | null; branches: AltBranchLayout[]; }
  const open: Open[] = [];
  const closeTop = () => {
    const f = open.pop()!;
    const bottomY = curY + ALT_VPAD;
    altBlocks.push({ kind: f.kind, topY: f.topY, bottomY, branches: f.branches, depth: f.depth });
    curY = bottomY;
  };

  for (let i = 0; i < messages.length; i++) {
    const path = messages[i].fragments ?? [];
    // Close fragments (deepest first) that this message is no longer inside.
    while (open.length > 0 && (open.length > path.length || open[open.length - 1].blockId !== path[open.length - 1].blockId)) {
      closeTop();
      curY += MSG_STEP_Y / 4; // small gap after a fragment closes
    }
    // Open fragments this message newly enters.
    for (let d = open.length; d < path.length; d++) {
      const topY = curY;
      curY += ALT_HEADER_H;
      open.push({ blockId: path[d].blockId, kind: path[d].kind, depth: d, topY, currentGuard: null, branches: [] });
    }
    // Branch (guard) bookkeeping on the innermost open fragment.
    if (path.length > 0) {
      const top = open[open.length - 1];
      const g   = path[path.length - 1].guard;
      if (g !== top.currentGuard) {
        if (top.currentGuard === null) {
          top.branches.push({ condition: g, condLabelY: top.topY + ALT_TAG_H / 2 });
        } else {
          const sepY = curY;
          curY += ALT_SEP_H;
          top.branches.push({ condition: g, sepY, condLabelY: sepY + 10 });
        }
        top.currentGuard = g;
      }
    }
    msgY[i] = curY;
    curY   += MSG_STEP_Y;
  }
  while (open.length > 0) closeTop();

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

// ── ASIL badge (sequence message) ──────────────────────────────────────────────

/** Pill text + colours for a derived ASIL. `unassigned` shows no badge. */
function asilTagVisual(d: DerivedMessageAsil): { text: string; bg: string; fg: string } | null {
  switch (d.status) {
    case 'unassigned': return null;
    case 'resolved':   { const c = asilColors(d.level ?? ''); return { text: `ASIL ${asilShort(d.level ?? '')}`, bg: c.bg, fg: c.fg }; }
    case 'conflict':   return { text: 'ASIL ⚠', bg: '#7c2d12', fg: '#fed7aa' };
    case 'partial':    return { text: 'ASIL ?', bg: '#422006', fg: '#fbbf24' };
    case 'unresolved': return { text: 'ASIL ?', bg: '#27272a', fg: '#9ca3af' };
  }
}

/**
 * Compact ASIL badge drawn next to a message label, reusing the shared ASIL palette.
 * A hover tooltip carries the full derivation details (payload, both endpoints, ASILs).
 * `x` is the badge's LEFT edge; `cy` its vertical centre.
 */
function AsilTag({ d, x, cy, label, payload }: {
  d: DerivedMessageAsil; x: number; cy: number; label: string; payload?: string;
}) {
  const v = asilTagVisual(d);
  if (!v) return null;
  const w = v.text.length * 5.4 + 8;
  const h = 12;
  return (
    <g>
      <title>{describeMessageAsil(d, { message: label, payload })}</title>
      <rect x={x} y={cy - h / 2} width={w} height={h} rx={2.5} fill={v.bg} />
      <text x={x + w / 2} y={cy + 3} textAnchor="middle" fontSize={8} fontWeight={700}
        fontFamily="monospace" fill={v.fg}>{v.text}</text>
    </g>
  );
}

// ── Timing (UML duration constraints + contract panel) ────────────────────────

const endpointLabel = (e: { participant?: string; event: string }): string =>
  e.participant ? `${e.participant}.${e.event}` : e.event;

/** One placed UML duration constraint: a vertical span from the origin (t=0) to a milestone,
 *  drawn beside the milestone's lifeline. */
interface TimingBar {
  name:        string;
  oy:          number;         // origin y (t = 0)
  ty:          number;         // target-milestone y
  deadline?:   string;         // budget label when this measure is deadline-bounded
  anchorX?:    number;         // x of the lifeline to draw beside (undefined ⇒ not placeable)
  labelY?:     number;         // collision-free y for the (vertical) label (undefined ⇒ no room)
  targetLabel: string;
  originLabel: string;
}

/**
 * UML duration constraints drawn BESIDE the milestone's lifeline: each elapsed measure is a
 * vertical line with end caps from t = 0 (fault occurrence) down to its milestone, sitting just
 * left of the lifeline it ends on. Lines are semi-transparent and highlight on left-click (the
 * deadline is red). The measure name (+ budget) is drawn vertically along the line at a y the
 * parent computed to be free of every other label; clicking selects it, empty-space clears.
 */
function TimingDurations({ bars, selected, onSelect }: {
  bars: TimingBar[]; selected: string | null; onSelect: (name: string | null) => void;
}) {
  if (bars.length === 0) return null;
  const t0Y = Math.min(...bars.map(b => b.oy));
  return (
    <g fontFamily="monospace">
      {bars.map(b => {
        if (b.anchorX == null) return null;
        const x     = b.anchorX - 9;                 // just left of the lifeline
        const isSel = selected === b.name;
        const col   = b.deadline ? '#f87171' : '#38bdf8';
        const op    = isSel ? 0.95 : 0.3;
        const sw    = isSel ? 2.5 : 1.5;
        return (
          <g key={b.name} style={{ cursor: 'pointer' }}
             onClick={(e) => { e.stopPropagation(); onSelect(isSel ? null : b.name); }}>
            <title>{`${b.name}${b.deadline ? ` ≤ ${b.deadline}` : ''}\nfrom ${b.originLabel} (t = 0) to ${b.targetLabel}`}</title>
            {/* wide invisible hit area for easy clicking */}
            <line x1={x} y1={t0Y} x2={x} y2={b.ty} stroke="transparent" strokeWidth={11} />
            {/* duration line + end caps */}
            <line x1={x} y1={t0Y} x2={x} y2={b.ty} stroke={col} strokeWidth={sw} opacity={op} />
            <line x1={x - 4} y1={t0Y} x2={x + 4} y2={t0Y} stroke={col} strokeWidth={sw} opacity={op} />
            <line x1={x - 4} y1={b.ty} x2={x + 4} y2={b.ty} stroke={col} strokeWidth={sw} opacity={op} />
            {/* vertical label at a collision-free y (falls back to hover tooltip if none fits) */}
            {b.labelY != null && (
              <text x={x} y={b.labelY} textAnchor="middle" fontSize={8} fontWeight={b.deadline ? 700 : 400}
                fill={col} opacity={isSel ? 1 : 0.7} transform={`rotate(-90 ${x} ${b.labelY})`}>
                {b.name}{b.deadline ? ` ≤ ${b.deadline}` : ''}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Collapsible summary of a sequence's timing-evaluation contract. */
function TimingPanel({ t }: { t: SequenceTiming }) {
  const [open, setOpen] = useState(false);
  const budget = t.deadlines[0] ?? (t.budgets[0] ? { display: t.budgets[0].display } : undefined);
  return (
    <div style={{ flexShrink: 0, borderBottom: '1px solid #1e293b', background: '#0b1a24' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
        padding: '7px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#7dd3fc',
      }}>
        <span style={{ fontSize: 11, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>▶</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>⏱ Timing contract</span>
        {t.constraintName && <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{t.constraintName}</span>}
        {budget && (
          <span style={{
            marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, fontFamily: 'monospace',
            padding: '2px 7px', borderRadius: 4, background: '#0e3a4a', color: '#7dd3fc', border: '1px solid #0e7490',
          }}>
            FTTI ≤ {budget.display}
          </span>
        )}
      </button>
      {open && (
        <div style={{ padding: '2px 14px 12px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {t.measures.length > 0 && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>Elapsed measures</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {t.measures.map(m => {
                  const dl = t.deadlines.find(d => d.measureName === m.name);
                  return (
                    <div key={m.name} style={{ fontSize: 12, fontFamily: 'monospace', color: '#cbd5e1' }}>
                      <span style={{ color: '#94a3b8' }}>{m.name}</span>
                      <span style={{ color: '#475569' }}> = TimeOf(</span><span style={{ color: '#7dd3fc' }}>{endpointLabel(m.target)}</span>
                      <span style={{ color: '#475569' }}>) − TimeOf(</span><span style={{ color: '#7dd3fc' }}>{endpointLabel(m.origin)}</span><span style={{ color: '#475569' }}>)</span>
                      {dl && <span style={{ marginLeft: 6, color: '#fca5a5', fontWeight: 700 }}>≤ {dl.display}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {t.contract && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>Asserted contract</div>
              <div style={{ fontSize: 11.5, fontFamily: 'monospace', color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {t.contract.replace(/\band\b/g, '\n  and ')}
              </div>
            </div>
          )}
          <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
            Symbolic times measured from the fault-occurrence origin (t = 0); only the budget is quantitative.
          </div>
        </div>
      )}
    </div>
  );
}

export default function SysMLSequenceView({ graph, dependencies, timing, selection, onSelect }: Props) {
  const [selectedSeqId, setSelectedSeqId] = useState<string>('');
  const [fitMode, setFitMode]             = useState(false);
  const [zoom, setZoom]                   = useState(1);
  const [selectedTiming, setSelectedTiming] = useState<string | null>(null); // highlighted duration constraint
  const scrollRef = useRef<HTMLDivElement>(null);

  const zoomBy = (factor: number) => { setFitMode(false); setZoom(z => clampZoom(z * factor)); };

  const { nodeById, childrenOf, parentOf } = useMemo(() => {
    if (!graph) return { nodeById: new Map<string, GraphNode>(), childrenOf: new Map<string, string[]>(), parentOf: new Map<string, string>() };
    return buildIndexes(graph);
  }, [graph]);

  // Context for deriving message ASIL from interface-port dependencies (see messageInterfaceAsil.ts).
  const asilCtx = useMemo((): AsilDerivationCtx | undefined => {
    if (!graph || !dependencies?.length) return undefined;
    return {
      parentOf,
      depsByClient: indexDependenciesByClient(dependencies),
      portIndex:    buildPortAsilIndex(graph),
    };
  }, [graph, dependencies, parentOf]);

  const sequenceDefs = useMemo((): SequenceDef[] => {
    if (!graph) return [];
    return parseSequenceDefs(graph, childrenOf, nodeById, asilCtx);
  }, [graph, childrenOf, nodeById, asilCtx]);

  // Timing-evaluation data keyed by the owning sequence definition's qualified name.
  const timingByOwner = useMemo(
    () => new Map((timing ?? []).map(t => [t.ownerQualifiedName, t] as const)),
    [timing],
  );

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

  // ⌘/Ctrl + wheel zooms (native non-passive listener so preventDefault works and
  // the diagram doesn't scroll while zooming). Keyed on sequenceDefs.length so it
  // (re)attaches once the diagram container is actually mounted.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setFitMode(false);
      setZoom(z => clampZoom(z * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [sequenceDefs.length]);

  if (!graph) {
    return <div style={{ padding: 24, color: '#64748b', fontSize: 13 }}>No graph data available. Ensure the SysML v2 parser service is running.</div>;
  }
  if (sequenceDefs.length === 0) {
    return <div style={{ padding: 24, color: '#64748b', fontSize: 13 }}>No sequence definitions found in this model.</div>;
  }

  const activeSeq                    = sequenceDefs.find(s => s.node.id === selectedSeqId) ?? sequenceDefs[0];
  const { participants, messages, entries } = activeSeq;

  // Timing contract for the active sequence (if any).
  const activeTiming = timingByOwner.size
    ? timingByOwner.get(qualifiedNameOf(activeSeq.node.id, parentOf, nodeById))
    : undefined;
  const { centers, widths, totalW }   = computeLayout(participants);
  // Reserve a band above the first message for the found-message entry markers.
  const entryBandH                    = entries.length > 0 ? 30 : 0;
  const entryY                        = MSG_START_Y + entryBandH - 18;
  const { msgY, altBlocks, totalH }   = computeMessageLayout(messages, MSG_START_Y + entryBandH);
  const partIdx                       = new Map(participants.map((p, i) => [p.label, i]));
  const selGraphId                    = selection?.extra?.graphId;

  // ── UML timing: place each milestone on the y-axis, then build duration-constraint bars ──
  // Message send/receive events sit on their message row; the fault origin is t = 0 at the top;
  // remaining milestones are resolved by relaxing over the `first/then` succession DAG.
  const evK = (p: string | undefined, e: string) => (p ? `${p}.${e}` : e);
  const timingBars: TimingBar[] = (() => {
    if (!activeTiming || activeTiming.measures.length === 0) return [];
    const eventY = new Map<string, number>();
    messages.forEach((m, i) => {
      if (m.from) { const k = evK(m.from.participant, m.from.event); if (!eventY.has(k)) eventY.set(k, msgY[i]); }
      if (m.to)   eventY.set(evK(m.to.participant, m.to.event), msgY[i]);
    });
    const t0Y = (msgY.length ? Math.min(...msgY) : MSG_START_Y + entryBandH) - 18;
    for (const m of activeTiming.measures) {
      const ok = evK(m.origin.participant, m.origin.event);
      if (!eventY.has(ok)) eventY.set(ok, t0Y);
    }
    const predOf = new Map<string, string[]>(), succOf = new Map<string, string[]>();
    for (const [a, b] of activeSeq.successions) {
      (succOf.get(a) ?? succOf.set(a, []).get(a)!).push(b);
      (predOf.get(b) ?? predOf.set(b, []).get(b)!).push(a);
    }
    const keys = new Set<string>([...predOf.keys(), ...succOf.keys()]);
    for (let iter = 0; iter <= keys.size; iter++) {
      let changed = false;
      for (const e of keys) {
        if (eventY.has(e)) continue;
        const preds = (predOf.get(e) ?? []).map(p => eventY.get(p)).filter((v): v is number => v != null);
        const succs = (succOf.get(e) ?? []).map(s => eventY.get(s)).filter((v): v is number => v != null);
        let y: number | undefined;
        if (preds.length && succs.length) y = (Math.max(...preds) + Math.min(...succs)) / 2;
        else if (preds.length) y = Math.max(...preds) + 14;
        else if (succs.length) y = Math.min(...succs) - 14;
        if (y != null) { eventY.set(e, y); changed = true; }
      }
      if (!changed) break;
    }
    const t = activeTiming;
    const tys = t.measures.map(m => eventY.get(evK(m.target.participant, m.target.event)) ?? null);
    const resolved = tys.filter((v): v is number => v != null);
    if (resolved.length === 0) return [];
    const maxTy = Math.max(...resolved);
    // Some milestones (bare top-level events) are not reachable through the succession keys;
    // place them by interpolating between their resolved neighbours. The measures are in source
    // (= temporal) order and the contract asserts that order, so this respects it.
    for (let i = 0; i < tys.length; i++) {
      if (tys[i] != null) continue;
      let p = -1, pY = t0Y; for (let j = i - 1; j >= 0; j--) if (tys[j] != null) { p = j; pY = tys[j]!; break; }
      let n = tys.length, nY = maxTy + 30; for (let j = i + 1; j < tys.length; j++) if (tys[j] != null) { n = j; nY = tys[j]!; break; }
      tys[i] = pY + (nY - pY) * (i - p) / (n - p);
    }
    // The lifeline to draw a measure beside: its target's lifeline, or — for a bare top-level
    // milestone (no lifeline) — the lifeline of a succession neighbour (the event it leads into).
    const centerOfPart = (p: string | undefined) => (p != null && partIdx.has(p) ? centers[partIdx.get(p)!] : undefined);
    const anchorXof = (part: string | undefined, event: string): number | undefined => {
      const direct = centerOfPart(part);
      if (direct != null) return direct;
      const tk = part ? `${part}.${event}` : event;
      for (const nb of [...(succOf.get(tk) ?? []), ...(predOf.get(tk) ?? [])]) {
        const dot = nb.indexOf('.');
        if (dot > 0) { const c = centerOfPart(nb.slice(0, dot)); if (c != null) return c; }
      }
      return undefined;
    };
    return t.measures
      .map((m, i): TimingBar => {
        const oy = eventY.get(evK(m.origin.participant, m.origin.event)) ?? t0Y;
        const dl = t.deadlines.find(d => d.measureName === m.name);
        return {
          name: m.name, oy, ty: tys[i]!, deadline: dl?.display,
          anchorX: anchorXof(m.target.participant, m.target.event),
          targetLabel: endpointLabel(m.target), originLabel: endpointLabel(m.origin),
        };
      })
      .filter(b => b.anchorX != null);
  })();

  // Choose a collision-free y for each duration's vertical label so it never overlaps a
  // message label, ASIL badge, lifeline name, entry marker, or another duration's label.
  if (timingBars.length > 0) {
    type Box = { x0: number; y0: number; x1: number; y1: number };
    const hit = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    const avoid: Box[] = [];
    participants.forEach((_, i) => { const cx = centers[i], bw = widths[i]; avoid.push({ x0: cx - bw / 2, y0: 0, x1: cx + bw / 2, y1: LBOX_H + 2 }); });
    entries.forEach(ep => { const li = partIdx.get(ep.participant); if (li == null) return; avoid.push({ x0: centers[li] - 62, y0: entryY - 14, x1: centers[li] + 2, y1: entryY + 3 }); });
    messages.forEach((m, i) => {
      if (!m.from || !m.to) return;
      const fi = partIdx.get(m.from.participant) ?? -1, tj = partIdx.get(m.to.participant) ?? -1;
      if (fi < 0 || tj < 0) return;
      const x1 = centers[fi], x2 = centers[tj], y = msgY[i], w = m.label.length * 6;
      if (fi === tj) avoid.push({ x0: x1 + 34, y0: y - 18, x1: x1 + 40 + w, y1: y - 5 });
      else          avoid.push({ x0: (x1 + x2) / 2 - w / 2, y0: y - 17, x1: (x1 + x2) / 2 + w / 2, y1: y - 5 });
      if (m.asil)   { const bx = (x1 + x2) / 2 + m.label.length * 3 + 3; avoid.push({ x0: bx, y0: y - 18, x1: bx + 48, y1: y - 4 }); }
    });
    const placed: Box[] = [];
    for (const b of timingBars) {
      if (b.anchorX == null) continue;
      const lx = b.anchorX - 9;
      const len = (b.name.length + (b.deadline ? b.deadline.length + 3 : 0)) * 4.8;
      const box = (cy: number): Box => ({ x0: lx - 5, y0: cy - len / 2, x1: lx + 4, y1: cy + len / 2 });
      let found: number | undefined;
      for (const [lo, hi] of [[b.oy + len / 2 + 2, b.ty - len / 2 - 2], [LBOX_H + len / 2 + 4, totalH - len / 2 - 6]]) {
        if (lo > hi) continue;
        for (let cy = lo; cy <= hi; cy += 5) {
          const bx = box(cy);
          if (avoid.some(a => hit(bx, a)) || placed.some(a => hit(bx, a))) continue;
          found = cy; break;
        }
        if (found != null) break;
      }
      b.labelY = found;
      if (found != null) placed.push(box(found));
    }
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {(() => {
            const zBtn: React.CSSProperties = {
              fontSize: 12, lineHeight: 1, width: 24, height: 22, borderRadius: 4, cursor: 'pointer',
              border: '1px solid #2a2a3a', background: '#111827', color: '#9ca3af',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            };
            return <>
              <button title="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)} style={zBtn}>−</button>
              <button title="Reset zoom to 100%" onClick={() => { setFitMode(false); setZoom(1); }}
                style={{ ...zBtn, width: 44, fontSize: 11 }}>
                {Math.round((fitMode ? 1 : zoom) * 100)}%
              </button>
              <button title="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} style={zBtn}>+</button>
            </>;
          })()}
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

      {/* ── Timing contract (when the active sequence declares timing) ───────── */}
      {activeTiming && <TimingPanel t={activeTiming} />}

      {/* ── Diagram ─────────────────────────────────────────────────────────── */}
      <div ref={scrollRef} style={{ flex: 1, overflow: fitMode ? 'hidden' : 'auto', padding: fitMode ? 0 : 16 }}>
        <svg
          width={fitMode ? '100%' : totalW * zoom} height={fitMode ? '100%' : totalH * zoom}
          viewBox={`0 0 ${totalW} ${totalH}`}
          onClick={() => setSelectedTiming(null)}
          preserveAspectRatio="xMidYMid meet"
          style={{ fontFamily: 'monospace', userSelect: 'none', display: 'block' }}
        >
          {/* Combined fragment backgrounds (alt / opt / loop, possibly nested) — before lifelines.
              Nested fragments are inset by depth * ALT_NEST_INSET so they sit inside their parent. */}
          {altBlocks.map((blk, bi) => {
            const tagW = blk.kind === 'loop' ? 36 : ALT_TAG_W;
            const inset = blk.depth * ALT_NEST_INSET;
            const bx = altX + inset;
            const bw = altW - inset * 2;
            return (
              <g key={`alt-${bi}`}>
                <rect
                  x={bx} y={blk.topY} width={bw} height={blk.bottomY - blk.topY}
                  fill="none" stroke={C_ALT_BORDER} strokeWidth={1} rx={2}
                />
                {/* Pentagon tag — 'alt' / 'opt' / 'loop' */}
                <polygon
                  points={[
                    `${bx},${blk.topY}`,
                    `${bx + tagW},${blk.topY}`,
                    `${bx + tagW},${blk.topY + ALT_TAG_H - 6}`,
                    `${bx + tagW - 6},${blk.topY + ALT_TAG_H}`,
                    `${bx},${blk.topY + ALT_TAG_H}`,
                  ].join(' ')}
                  fill={C_ALT_TAG_BG} stroke={C_ALT_TAG_BD} strokeWidth={1}
                />
                <text
                  x={bx + tagW / 2} y={blk.topY + ALT_TAG_H / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fill={C_ALT_TAG_TX} fontSize={9} fontWeight={600}
                >{blk.kind}</text>
                {blk.branches.map((br, bri) => (
                  <g key={`br-${bri}`}>
                    {br.sepY !== undefined && (
                      <line
                        x1={bx} y1={br.sepY} x2={bx + bw} y2={br.sepY}
                        stroke={C_ALT_SEP} strokeWidth={1} strokeDasharray="5 3"
                      />
                    )}
                    {br.condition && (
                      <text
                        x={bri === 0 ? bx + tagW + 4 : bx + 6}
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

          {/* Found-message entry markers — a filled ball + arrow into the lifeline, marking a
              root event that starts the interaction from outside (UML/SysML found message). */}
          {entries.map((ep, ei) => {
            const li = partIdx.get(ep.participant);
            if (li === undefined) return null;
            const cx = centers[li];
            const r = 4;
            const ballX = cx - 30;
            const tipX  = cx;
            return (
              <g key={`entry-${ei}`} style={{ pointerEvents: 'none' }}>
                <title>{`found message — interaction entry: ${ep.participant}.${ep.event}`}</title>
                <text x={ballX} y={entryY - 7} textAnchor="start"
                  fill="#7dd3fc" fontSize={9} fontStyle="italic">
                  {ep.event}
                </text>
                <circle cx={ballX} cy={entryY} r={r} fill="#64748b" />
                <line x1={ballX + r} y1={entryY} x2={tipX - ARROW_SIZE} y2={entryY}
                  stroke="#64748b" strokeWidth={1.5} />
                <polygon
                  points={`${tipX},${entryY} ${tipX - ARROW_SIZE},${entryY - ARROW_SIZE / 2} ${tipX - ARROW_SIZE},${entryY + ARROW_SIZE / 2}`}
                  fill="#64748b"
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
                  {msg.asil && <AsilTag d={msg.asil} label={msg.label} payload={msg.payload}
                    x={x1 + loopW + 6 + msg.label.length * 6 + 5} cy={startY - 5} />}
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
                {msg.asil && <AsilTag d={msg.asil} label={msg.label} payload={msg.payload}
                  x={(x1+x2)/2 + msg.label.length * 3 + 5} cy={y - 11} />}
                <line x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={sw} />
                <polygon points={`${x2},${y} ${aX},${y-ARROW_SIZE/2} ${aX},${y+ARROW_SIZE/2}`} fill={stroke} />
              </g>
            );
          })}

          {/* UML duration constraints (timing), drawn beside each milestone's lifeline */}
          <TimingDurations bars={timingBars} selected={selectedTiming} onSelect={setSelectedTiming} />
        </svg>
      </div>
    </div>
  );
}
