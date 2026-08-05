/**
 * Extracts behavior semantics (actions, succession flows, and conditionals)
 * from the raw ModelNode[] tree produced by the Java parser wrapper.
 *
 * Recognised EMF types
 * ────────────────────
 * ActionDefinition         — behavior definition container
 * ActionUsage              — named action instance
 * PerformActionUsage       — perform-action instance (same semantics as ActionUsage)
 * SuccessionAsUsage        — "succession first X then Y"  (actual EMF type for succession)
 * Succession               — bare succession (fallback)
 * IfActionUsage            — "if <cond> { … } else { … }"
 * WhileLoopActionUsage     — "loop { … }" / "while <cond> { … }"
 * DecisionNode             — explicit decide node (succession endpoints may be unresolved
 *                            due to a known NPE bug in Pilot Implementation 0.59.0-SNAPSHOT)
 * ForkNode / JoinNode      — parallel fork/join control-flow nodes
 * MergeNode                — merge control-flow node
 *
 * IfActionUsage / WhileLoopActionUsage structure
 * ───────────────────────────────────────────────
 * IfActionUsage
 *   ParameterMembership[0] → condition expression  (LiteralBoolean | FeatureReferenceExpression | …)
 *   ParameterMembership[1] → anonymous ActionUsage[in]  = then-block container
 *         children: real ActionUsage / SuccessionAsUsage nodes
 *   ParameterMembership[2] → anonymous ActionUsage[in]  = else-block container  (optional)
 *
 * WhileLoopActionUsage
 *   ParameterMembership[0] → condition expression
 *   ParameterMembership[1] → anonymous ActionUsage[in]  = loop-body container
 */

import type {
  ModelNode, BehaviorAction, BehaviorFlow, BehaviorConditional, BehaviorData, BehaviorAllocation, ActionPort,
} from './types';

const ACTION_USAGE_TYPES   = new Set(['ActionUsage', 'PerformActionUsage']);
const SUCCESSION_TYPES     = new Set(['Succession', 'SuccessionAsUsage']);
const CONTROL_FLOW_TYPES   = new Set(['DecisionNode', 'ForkNode', 'JoinNode', 'MergeNode']);

// Structural definition types that can own ActionDefinitions in official SysML v2.
// When the traversal enters one of these, its name/type are recorded as the owner context
// so that the contained ActionDefinition entries carry owningDefName / owningDefType.
const STRUCTURAL_DEF_TYPES = new Set([
  'PartDefinition', 'ItemDefinition', 'ConnectionDefinition',
  'PortDefinition', 'InterfaceDefinition', 'AllocationDefinition',
  'OccurrenceDefinition',
]);

interface OwnerCtx { name: string; type: string; }

// ── Guard extraction (TransitionUsage) ────────────────────────────────────────

// EMF node types that represent boolean negation (if not <expr>).
const NEGATION_TYPES = new Set(['InvertingExpression', 'OperatorExpression', 'UnaryExpression']);

/**
 * Recursively search for a FeatureReferenceExpression under `node`, returning
 * { name, negated } where negated=true if the FRE is wrapped in a negation node.
 */
function findFRE(node: ModelNode, parentIsNegation: boolean): { name: string; negated: boolean } | undefined {
  if (node.type === 'FeatureReferenceExpression') {
    const m = node.children.find(c => c.type === 'Membership');
    if (m?.name) return { name: m.name, negated: parentIsNegation };
  }
  const isNeg = NEGATION_TYPES.has(node.type) || (node.type === 'OperatorExpression' && node.name === 'not');
  for (const child of node.children) {
    const result = findFRE(child, parentIsNegation || isNeg);
    if (result) return result;
  }
  return undefined;
}

/**
 * Extract the guard feature name from a TransitionFeatureMembership child.
 * Supports FeatureReferenceExpression, negated expressions (if not guard), and LiteralBoolean.
 */
function extractGuardName(transitionNode: ModelNode): string | undefined {
  const tfm = transitionNode.children.find(c => c.type === 'TransitionFeatureMembership');
  if (!tfm) return undefined;

  // Search recursively for FeatureReferenceExpression (handles plain and negated guards).
  for (const child of tfm.children) {
    const result = findFRE(child, false);
    if (result) return result.negated ? `not ${result.name}` : result.name;
  }

  // LiteralBoolean (e.g. if true then …)
  const lit = tfm.children.find(c => c.type === 'LiteralBoolean');
  if (lit?.name) return lit.name;

  return undefined;
}

// ── Endpoint extraction ───────────────────────────────────────────────────────

/**
 * DFS through a node's children collecting ALL ReferenceSubsetting / FeatureChaining
 * labels, flattened. A dotted reference contributes one entry per segment, so this
 * yields the full qualified PATH — which is what allocations need (`sourcePath`).
 * For succession endpoints use extractSuccessionEndpoints() instead.
 */
function extractEndpointNames(node: ModelNode): string[] {
  const refs: string[] = [];

  function findRef(n: ModelNode): void {
    if (
      (n.type === 'ReferenceSubsetting' || n.type === 'FeatureChaining') &&
      n.name != null &&
      n.name !== n.type
    ) {
      refs.push(n.name);
      return;
    }
    for (const child of n.children) findRef(child);
  }

  for (const child of node.children) findRef(child);
  return refs;
}

/**
 * A succession's endpoint names — ONE per end (source, target).
 *
 * Each end is a child of the succession node. A QUALIFIED reference such as
 * `faultManager.classifyAsEpc2` (an action allocated to a `ref part`) arrives as a CHAIN
 * of segments under that same end, where the leading segments only qualify the final one,
 * so the endpoint is the LAST segment.
 *
 * Flattening across ends instead (extractEndpointNames) would take the first two entries
 * of a SINGLE end as if they were the two endpoints — turning
 * `first faultManager.classifyAsEpc2 then faultManager.selectControllerResetIsolation`
 * into `faultManager -> classifyAsEpc2`, an edge whose ends are not action nodes at all,
 * so every such succession silently vanished from the Actions view.
 */
function extractSuccessionEndpoints(node: ModelNode): string[] {
  function lastSegment(n: ModelNode): string | null {
    const segs: string[] = [];
    function walk(m: ModelNode): void {
      if (
        (m.type === 'ReferenceSubsetting' || m.type === 'FeatureChaining') &&
        m.name != null &&
        m.name !== m.type
      ) {
        segs.push(m.name);
        return;
      }
      for (const c of m.children) walk(c);
    }
    walk(n);
    return segs.length > 0 ? segs[segs.length - 1] : null;
  }

  const endpoints: string[] = [];
  for (const child of node.children) {
    const seg = lastSegment(child);
    if (seg !== null) endpoints.push(seg);
  }
  return endpoints;
}

/**
 * Like extractSuccessionEndpoints, but keeps the FULL qualifier chain per end
 * (e.g. `can.inhibitTx` rather than just `inhibitTx`).  The qualifier is what
 * distinguishes two identically-named actions that live under different
 * `ref part`s, so the Actions view can route their edges to the right node.
 * Returns one dot-joined string per end (source, target), aligned with
 * extractSuccessionEndpoints' output.
 */
function extractSuccessionEndpointPaths(node: ModelNode): string[] {
  function fullChain(n: ModelNode): string | null {
    const segs: string[] = [];
    function walk(m: ModelNode): void {
      if (
        (m.type === 'ReferenceSubsetting' || m.type === 'FeatureChaining') &&
        m.name != null &&
        m.name !== m.type
      ) {
        segs.push(m.name);
        return;
      }
      for (const c of m.children) walk(c);
    }
    walk(n);
    return segs.length > 0 ? segs.join('.') : null;
  }

  const paths: string[] = [];
  for (const child of node.children) {
    const chain = fullChain(child);
    if (chain !== null) paths.push(chain);
  }
  return paths;
}

// ── Implicit succession resolver ──────────────────────────────────────────────
//
// `then action X` emits a SuccessionAsUsage whose EndFeatureMembership children
// hold ReferenceUsage nodes named 'earlierOccurrence' / 'laterOccurrence' instead
// of concrete action names.  To resolve these we look at the sibling list: the
// action immediately before the succession node is the source, and the one
// immediately after is the target.
//
// Returns: Map<childIndex, [sourceName, targetName]>

function resolveImplicitSucc(children: ModelNode[]): Map<number, [string, string]> {
  const result = new Map<number, [string, string]>();

  // Unwrap a single-child membership wrapper to reach the inner node.
  const innerOf = (c: ModelNode): ModelNode => (c.children.length === 1 ? c.children[0] : c);

  // Collect (childIndex, actionName) pairs in document order.
  const actionOrder: { idx: number; name: string }[] = [];
  for (let i = 0; i < children.length; i++) {
    const inner = innerOf(children[i]);
    if (ACTION_USAGE_TYPES.has(inner.type) && inner.name != null) {
      actionOrder.push({ idx: i, name: inner.name });
    }
  }

  // For each SuccessionAsUsage with implicit (earlierOccurrence/laterOccurrence) refs,
  // resolve by adjacent action names.
  for (let i = 0; i < children.length; i++) {
    const inner = innerOf(children[i]);
    if (!SUCCESSION_TYPES.has(inner.type)) continue;
    if (extractSuccessionEndpoints(inner).length >= 2) continue; // already explicit

    const isImplicit = inner.children.some(efm =>
      efm.type === 'EndFeatureMembership' &&
      efm.children.some(ru =>
        ru.type === 'ReferenceUsage' &&
        (ru.name === 'earlierOccurrence' || ru.name === 'laterOccurrence'),
      ),
    );
    if (!isImplicit) continue;

    const beforeI = actionOrder.filter(a => a.idx < i);
    const prev = beforeI[beforeI.length - 1];
    const next = actionOrder.find(a => a.idx > i);
    if (prev && next) result.set(i, [prev.name, next.name]);
  }

  return result;
}

// ── Condition extraction ──────────────────────────────────────────────────────

interface ConditionInfo {
  kind: 'LiteralBoolean' | 'FeatureReference' | 'Expression';
  text?: string;
}

function extractCondition(paramMembership: ModelNode | undefined): ConditionInfo {
  const expr = paramMembership?.children[0];
  if (!expr) return { kind: 'Expression' };

  if (expr.type === 'LiteralBoolean') {
    return { kind: 'LiteralBoolean', text: expr.name ?? undefined };
  }
  if (expr.type === 'LiteralInteger' || expr.type === 'LiteralString') {
    return { kind: 'Expression', text: expr.name ?? undefined };
  }
  if (expr.type === 'FeatureReferenceExpression') {
    // FeatureReferenceExpression → Membership (memberElement cross-ref resolved by Java wrapper)
    const membership = expr.children.find(c => c.type === 'Membership');
    const refName = membership?.name ?? undefined;
    return { kind: 'FeatureReference', text: refName };
  }
  return { kind: 'Expression' };
}

// ── Port collection ───────────────────────────────────────────────────────────
//
// Extracts `in item` / `out item` parameters from an ActionUsage node's children.
// Structure: FeatureMembership → ItemUsage (direction='in'/'out') → FeatureTyping

function collectPorts(node: ModelNode): ActionPort[] {
  const ports: ActionPort[] = [];
  for (const child of node.children) {
    const inner = (
      child.children.length === 1 &&
      (child.type === 'FeatureMembership' || child.type === 'OwningMembership' ||
       child.type === 'ParameterMembership' || child.type === 'ReturnParameterMembership')
    ) ? child.children[0] : child;

    if ((inner.type === 'ItemUsage' || inner.type === 'ActionUsage' || inner.type === 'ReferenceUsage') &&
        inner.name != null && (inner.direction === 'in' || inner.direction === 'out')) {
      const ft = inner.children.find(c => c.type === 'FeatureTyping');
      ports.push({ name: inner.name, direction: inner.direction as 'in' | 'out', itemType: ft?.name ?? undefined });
    }
  }
  return ports;
}

// ── ASIL metadata on an element ──────────────────────────────────────────────
// `@ASIL { level = ASILLevel::X }` parses to a MetadataUsage typed by 'ASIL' whose
// 'level' value references an enum literal (a named Membership in its subtree).
// Look for it directly under the element or one membership-wrapper deep — never in
// nested elements (which carry their own @ASIL). Returns the level (e.g. 'ASIL_D').
function asilOf(node: ModelNode): string | undefined {
  let level: string | undefined;
  const digLevel = (m: ModelNode): void => {
    for (const k of m.children) {
      if (level) return;
      if (k.type === 'Membership' && k.name) { level = k.name; return; }
      digLevel(k);
    }
  };
  const fromMetadata = (mu: ModelNode): void => {
    if (mu.children.find(k => k.type === 'FeatureTyping')?.name !== 'ASIL') return;
    digLevel(mu);
  };
  for (const c of node.children) {
    if (level) break;
    if (c.type === 'MetadataUsage') fromMetadata(c);
    else if (c.children.length && (c.type.endsWith('Membership') || c.type === 'Namespace')) {
      for (const gc of c.children) { if (gc.type === 'MetadataUsage') fromMetadata(gc); if (level) break; }
    }
  }
  return level;
}

// ── Flow-endpoint extraction ───────────────────────────────────────────────────
//
// For `flow from A.p to B.q`, each EndFeatureMembership child of the FlowUsage
// contains a chain: ReferenceSubsetting(action) + ReferenceUsage(port).
// Returns [actionName, portName] or null if the chain can't be resolved.

// Returns [actionName, portName, actionQual?] where:
//   • `performer.action.port` (3 segs) → [action, port, "performer.action"]  — the qualifier
//     disambiguates two actions that share a name across `ref part`s (e.g. can.inhibitTx).
//   • `action.port`          (2 segs) → [action, port]
//   • bare param name        (1 seg)  → [param, null]  (boundary-parameter node)
// The PORT is always the last segment and the ACTION the one before it, so deeper qualification
// does not shift which segment is the port.
function extractFlowEndpointPair(efm: ModelNode): [string, string | null, string?] | null {
  const names: string[] = [];
  function collect(n: ModelNode): void {
    if (
      (n.type === 'ReferenceSubsetting' || n.type === 'FeatureChaining' ||
       n.type === 'ReferenceUsage'       || n.type === 'Redefinition') &&
      n.name != null && n.name !== n.type &&
      n.name !== 'earlierOccurrence' && n.name !== 'laterOccurrence'
    ) {
      names.push(n.name);
    } else {
      for (const c of n.children) collect(c);
    }
  }
  for (const c of efm.children) collect(c);
  if (names.length >= 3) {
    const action = names[names.length - 2];
    const port   = names[names.length - 1];
    return [action, port, `${names[names.length - 3]}.${action}`];
  }
  if (names.length === 2) return [names[0], names[1]];
  if (names.length === 1) return [names[0], null];   // boundary parameter node
  return null;
}

// ── Cross-file ActionDefinition port scanner ──────────────────────────────────
//
// Scans a model tree for ActionDefinition nodes and populates `out` with their
// ports.  Used to resolve typed action usages whose definition lives in another
// file (context model).

function scanActionDefPorts(nodes: ModelNode[], out: Map<string, ActionPort[]>): void {
  function scan(node: ModelNode): void {
    if (node.type === 'ActionDefinition' && node.name) {
      const ports = collectPorts(node);
      if (ports.length > 0 && !out.has(node.name)) out.set(node.name, ports);
    }
    for (const c of node.children) scan(c);
  }
  for (const root of nodes) scan(root);
}

// ── Core traversal ────────────────────────────────────────────────────────────

export function buildBehavior(roots: ModelNode[], contextRoots: ModelNode[][] = []): BehaviorData {
  const actions:      BehaviorAction[]     = [];
  const flows:        BehaviorFlow[]       = [];
  const conditionals: BehaviorConditional[] = [];
  const allocations:  BehaviorAllocation[] = [];

  /**
   * Visit a single node in the EMF tree.
   *
   * @param node         the current ModelNode
   * @param path         dot-separated index path (for stable unique IDs)
   * @param ownerDefId   id of the enclosing ActionDefinition, or null if at package level
   * @param conditionalId  id of the enclosing IfActionUsage/WhileLoop, if any
   * @param branch         which branch of a conditional we're currently in
   * @param ownerCtx     nearest enclosing structural definition (PartDefinition etc.), if any
   */
  function visit(
    node: ModelNode,
    path: string,
    ownerDefId: string | null,
    conditionalId?: string,
    branch?: 'then' | 'else' | 'loop',
    ownerCtx: OwnerCtx | null = null,
    performer: string | null = null,
  ): void {

    // ── Structural definition types (record as owner context for contained ActionDefs) ──
    if (STRUCTURAL_DEF_TYPES.has(node.type)) {
      const ctx: OwnerCtx = { name: node.name ?? node.type, type: node.type };
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i], `${path}.${i}`, ownerDefId, conditionalId, branch, ctx, performer);
      }
      return;
    }

    // ── ActionDefinition ────────────────────────────────────────────────────
    if (node.type === 'ActionDefinition') {
      const name = node.name ?? node.type;
      const defEntry: BehaviorAction = { id: path, name, type: 'ActionDefinition' };
      if (ownerCtx) {
        defEntry.owningDefName = ownerCtx.name;
        defEntry.owningDefType = ownerCtx.type;
      }
      const defPorts = collectPorts(node);
      if (defPorts.length > 0) defEntry.ports = defPorts;
      actions.push(defEntry);
      const implicitDef = resolveImplicitSucc(node.children);
      for (let i = 0; i < node.children.length; i++) {
        if (implicitDef.has(i)) {
          const [source, target] = implicitDef.get(i)!;
          flows.push({ id: `flow:${path}.${i}.0`, source, target, type: 'succession' });
        } else {
          visit(node.children[i], `${path}.${i}`, path, undefined, undefined, ownerCtx, performer);
        }
      }
      return;
    }

    // ── Named ActionUsage / PerformActionUsage ──────────────────────────────
    if (ACTION_USAGE_TYPES.has(node.type)) {
      // Anonymous ActionUsage[in] = then/else/loop container inside a conditional.
      // These are transparent — recurse into their children without creating an action entry.
      if (node.name === null && node.direction === 'in') {
        for (let i = 0; i < node.children.length; i++) {
          visit(node.children[i], `${path}.${i}`, ownerDefId, conditionalId, branch, ownerCtx, performer);
        }
        return;
      }

      // Named action instance — create an entry.
      const name: string = node.name ?? node.type;
      const action: BehaviorAction = { id: path, name, type: node.type };
      if (ownerDefId !== null) action.ownerId = ownerDefId;
      if (conditionalId)       action.conditionalId = conditionalId;
      if (branch)              action.branch = branch;
      if (performer)           action.performer = performer;
      // Structural owner context (e.g. PartDefinition directly containing this ActionUsage).
      if (ownerCtx && ownerDefId === null) {
        action.owningDefName = ownerCtx.name;
        action.owningDefType = ownerCtx.type;
      }
      const ft = node.children.find(c => c.type === 'FeatureTyping');
      if (ft?.name) action.actionType = ft.name;
      const asil = asilOf(node);
      if (asil) action.asil = asil;
      const ports = collectPorts(node);
      if (ports.length > 0) action.ports = ports;
      actions.push(action);

      // If this ActionUsage has an inline body (grandchildren include ActionUsage or
      // SuccessionAsUsage nodes), recurse into it using this usage's path as the owning
      // scope — same pattern as ActionDefinition.
      const hasInlineBody = node.children.some(c =>
        c.children.some(gc =>
          ACTION_USAGE_TYPES.has(gc.type) || SUCCESSION_TYPES.has(gc.type) || CONTROL_FLOW_TYPES.has(gc.type),
        ),
      );
      if (hasInlineBody) {
        const implicitUsage = resolveImplicitSucc(node.children);
        for (let i = 0; i < node.children.length; i++) {
          if (implicitUsage.has(i)) {
            const [source, target] = implicitUsage.get(i)!;
            flows.push({ id: `flow:${path}.${i}.0`, source, target, type: 'succession' });
          } else {
            visit(node.children[i], `${path}.${i}`, path, undefined, undefined, null, performer);
          }
        }
      }
      return;
    }

    // ── SuccessionAsUsage / Succession ──────────────────────────────────────
    if (SUCCESSION_TYPES.has(node.type)) {
      const refs   = extractSuccessionEndpoints(node);
      const paths  = extractSuccessionEndpointPaths(node);
      const flowId = `flow:${path}`;
      if (refs.length >= 2) {
        flows.push({
          id: flowId, source: refs[0], target: refs[1], type: 'succession',
          ...(paths[0] && paths[0] !== refs[0] ? { sourceQual: paths[0] } : {}),
          ...(paths[1] && paths[1] !== refs[1] ? { targetQual: paths[1] } : {}),
        });
      } else {
        flows.push({
          id: flowId,
          sourceName: refs[0] ?? '',
          targetName: refs[1] ?? '',
          type: 'succession',
          unresolved: true,
        });
      }
      return;
    }

    // ── Control-flow nodes (DecisionNode, ForkNode, JoinNode, MergeNode) ───
    if (CONTROL_FLOW_TYPES.has(node.type)) {
      const name = node.name ?? node.type;
      const action: BehaviorAction = { id: path, name, type: node.type };
      if (ownerDefId !== null) action.ownerId = ownerDefId;
      if (conditionalId)       action.conditionalId = conditionalId;
      if (branch)              action.branch = branch;
      actions.push(action);
      // Don't recurse — control-flow nodes have no meaningful children.
      return;
    }

    // ── TransitionUsage (guarded succession: first a if guard then b;) ─────
    if (node.type === 'TransitionUsage') {
      // Source: first Membership child (cross-ref resolved by Java wrapper)
      const srcMembership = node.children.find(c => c.type === 'Membership');
      const sourceName    = srcMembership?.name ?? null;

      // Guard: TransitionFeatureMembership → FeatureReferenceExpression → Membership
      const guard = extractGuardName(node);

      // Target: OwningMembership → SuccessionAsUsage → ReferenceSubsetting
      const owningMembership = node.children.find(c => c.type === 'OwningMembership');
      const succession       = owningMembership?.children.find(c => SUCCESSION_TYPES.has(c.type));
      const targetRefs       = succession ? extractSuccessionEndpoints(succession) : [];
      const targetName       = targetRefs[0] ?? null;
      const targetPaths      = succession ? extractSuccessionEndpointPaths(succession) : [];
      const targetQual       = targetPaths[0] && targetPaths[0] !== targetName ? targetPaths[0] : undefined;

      const flowId = `flow:${path}`;
      if (sourceName && targetName) {
        flows.push({ id: flowId, source: sourceName, target: targetName, type: 'transition' as const, ...(guard !== undefined ? { guard } : {}), ...(targetQual ? { targetQual } : {}) });
      } else {
        flows.push({ id: flowId, sourceName: sourceName ?? '', targetName: targetName ?? '', type: 'transition' as const, ...(guard !== undefined ? { guard } : {}), unresolved: true as const });
      }
      return;
    }

    // ── FlowUsage (item flow: flow from A.p to B.q) ────────────────────────
    if (node.type === 'FlowUsage') {
      const efms = node.children.filter(c => c.type === 'EndFeatureMembership');
      if (efms.length >= 2) {
        const src = extractFlowEndpointPair(efms[0]);
        const tgt = extractFlowEndpointPair(efms[1]);
        if (src && tgt) {
          flows.push({
            id:         `flow:${path}`,
            source:     src[0],
            sourcePort: src[1],
            target:     tgt[0],
            targetPort: tgt[1],
            type:       'itemFlow',
            ...(src[2] ? { sourceQual: src[2] } : {}),
            ...(tgt[2] ? { targetQual: tgt[2] } : {}),
          });
        }
      }
      return;
    }

    // ── IfActionUsage ───────────────────────────────────────────────────────
    if (node.type === 'IfActionUsage') {
      const condition = extractCondition(node.children[0]);

      // Collect action ids added in each branch so we can populate the conditional entry.
      const thenIds:  string[] = [];
      const elseIds:  string[] = [];

      // Visit the then-block container (ParameterMembership[1] → anonymous ActionUsage[in]).
      const thenContainer = node.children[1]?.children[0];
      if (thenContainer) {
        const before = actions.length;
        for (let i = 0; i < thenContainer.children.length; i++) {
          visit(thenContainer.children[i], `${path}.then.${i}`, ownerDefId, path, 'then', ownerCtx, performer);
        }
        for (let j = before; j < actions.length; j++) thenIds.push(actions[j].id);
      }

      // Visit the else-block container (ParameterMembership[2] → anonymous ActionUsage[in]).
      const elseContainer = node.children[2]?.children[0];
      if (elseContainer) {
        const before = actions.length;
        for (let i = 0; i < elseContainer.children.length; i++) {
          visit(elseContainer.children[i], `${path}.else.${i}`, ownerDefId, path, 'else', ownerCtx, performer);
        }
        for (let j = before; j < actions.length; j++) elseIds.push(actions[j].id);
      }

      const cond: BehaviorConditional = {
        id:            path,
        type:          'ifThenElse',
        ownerId:       ownerDefId,
        conditionKind: condition.kind,
        conditionText: condition.text,
        thenActionIds: thenIds,
      };
      if (elseIds.length > 0) cond.elseActionIds = elseIds;
      conditionals.push(cond);
      return;
    }

    // ── WhileLoopActionUsage ────────────────────────────────────────────────
    if (node.type === 'WhileLoopActionUsage') {
      // Two syntactic forms map differently:
      //   while cond { body }        → condition at children[0], body at children[1]
      //   loop { body } until cond   → empty ReferenceUsage at children[0],
      //                                body at children[1], until-condition at children[2]
      let condition = extractCondition(node.children[0]);
      if (condition.text === undefined && node.children[2] !== undefined) {
        condition = extractCondition(node.children[2]);
      }

      const loopIds: string[] = [];
      const bodyContainer = node.children[1]?.children[0];
      if (bodyContainer) {
        const before = actions.length;
        for (let i = 0; i < bodyContainer.children.length; i++) {
          visit(bodyContainer.children[i], `${path}.loop.${i}`, ownerDefId, path, 'loop', ownerCtx, performer);
        }
        for (let j = before; j < actions.length; j++) loopIds.push(actions[j].id);
      }

      conditionals.push({
        id:            path,
        type:          'whileLoop',
        ownerId:       ownerDefId,
        conditionKind: condition.kind,
        conditionText: condition.text,
        thenActionIds: loopIds,
      });
      return;
    }

    // ── AllocationUsage (allocate X.Y to Z) — SysML v2 §16.3 ─────────────────
    // AllocationUsage is a specialisation of ConnectionUsage with two EndFeatureMembership
    // children: source path (the allocated action, possibly dotted) and target (the responsible part).
    // These become swimlane assignments in the action view.
    if (node.type === 'AllocationUsage') {
      const efms = node.children.filter(c => c.type === 'EndFeatureMembership');
      if (efms.length >= 2) {
        const sourceNames = extractEndpointNames(efms[0]);
        const targetNames = extractEndpointNames(efms[1]);
        if (sourceNames.length >= 1 && targetNames.length >= 1) {
          allocations.push({ sourcePath: sourceNames, targetName: targetNames[0] });
        }
      }
      return;
    }

    // ── Transparent wrapper (OwningMembership, FeatureMembership, ParameterMembership, etc.) ──
    // A `ref part` (PartUsage/ReferenceUsage) becomes the performer for the actions nested
    // beneath it, so a `perform action` inside it is tagged with that part (its swimlane).
    const named = node.name && node.name !== node.type ? node.name : null;
    const childPerformer =
      (node.type === 'PartUsage' || node.type === 'ReferenceUsage') && named ? named : performer;
    for (let i = 0; i < node.children.length; i++) {
      visit(node.children[i], `${path}.${i}`, ownerDefId, conditionalId, branch, ownerCtx, childPerformer);
    }
  }

  roots.forEach((root, i) => visit(root, String(i), null));

  // Also traverse context files so cross-file behaviors and their swimlane
  // `allocate` statements — which in a multi-file project often live in a separate
  // assembly file from the behavior definition — are collected. Prefixed ids keep
  // context nodes distinct from primary-file ids. (No-op for single-file models.)
  contextRoots.forEach((ctx, ci) => {
    ctx.forEach((root, i) => visit(root, `ctx${ci}_${i}`, null));
  });

  // Swimlane assignments from `perform action` inside a `ref part` — the SysML v2 way to say a
  // part performs an action WITHOUT an explicit `allocate` (e.g. `ref part smu : Tc4zSmuHw
  // { perform action acceptEpc2Alarm; }` ⇒ smu performs acceptEpc2Alarm → lane smu). Scoped to
  // the enclosing ActionDefinition. Complements the AllocationUsage path above.
  const collectPerformAllocations = (nodes: ModelNode[]): void => {
    const walk = (node: ModelNode, performer: string | null, behaviorDef: string | null): void => {
      const named = node.name && node.name !== node.type ? node.name : null;
      const nextDef = node.type === 'ActionDefinition' && named ? named : behaviorDef;
      const nextPerformer = (node.type === 'PartUsage' || node.type === 'ReferenceUsage') && named ? named : performer;
      if (node.type === 'PerformActionUsage' && named && performer) {
        allocations.push({ sourcePath: [performer, named], targetName: performer, kind: 'perform', ...(behaviorDef ? { behaviorScope: behaviorDef } : {}) });
      }
      for (const c of node.children ?? []) walk(c, nextPerformer, nextDef);
    };
    for (const n of nodes) walk(n, null, null);
  };
  collectPerformAllocations(roots);
  contextRoots.forEach(ctx => collectPerformAllocations(ctx));

  // Inherit ports onto typed ActionUsages from their ActionDefinition.
  // Primary model first, then context files (cross-file defs don't override local ones).
  const defPortsByName = new Map<string, ActionPort[]>();
  for (const a of actions) {
    if (a.type === 'ActionDefinition' && a.ports?.length) {
      defPortsByName.set(a.name, a.ports);
    }
  }
  for (const ctxRoots of contextRoots) {
    scanActionDefPorts(ctxRoots, defPortsByName);
  }
  for (const a of actions) {
    if (
      (a.type === 'ActionUsage' || a.type === 'PerformActionUsage') &&
      a.actionType && !a.ports?.length
    ) {
      const inherited = defPortsByName.get(a.actionType);
      if (inherited) a.ports = inherited;
    }
  }

  return { actions, flows, conditionals, allocations };
}
