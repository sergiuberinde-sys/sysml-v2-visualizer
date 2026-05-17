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
  ModelNode, BehaviorAction, BehaviorFlow, BehaviorConditional, BehaviorData,
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
 * DFS through a succession node's children to collect the two endpoint names
 * (source, target) via ReferenceSubsetting or FeatureChaining labels.
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

// ── Core traversal ────────────────────────────────────────────────────────────

export function buildBehavior(roots: ModelNode[]): BehaviorData {
  const actions:      BehaviorAction[]     = [];
  const flows:        BehaviorFlow[]       = [];
  const conditionals: BehaviorConditional[] = [];

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
  ): void {

    // ── Structural definition types (record as owner context for contained ActionDefs) ──
    if (STRUCTURAL_DEF_TYPES.has(node.type)) {
      const ctx: OwnerCtx = { name: node.name ?? node.type, type: node.type };
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i], `${path}.${i}`, ownerDefId, conditionalId, branch, ctx);
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
      actions.push(defEntry);
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i], `${path}.${i}`, path, undefined, undefined, ownerCtx);
      }
      return;
    }

    // ── Named ActionUsage / PerformActionUsage ──────────────────────────────
    if (ACTION_USAGE_TYPES.has(node.type)) {
      // Anonymous ActionUsage[in] = then/else/loop container inside a conditional.
      // These are transparent — recurse into their children without creating an action entry.
      if (node.name === null && node.direction === 'in') {
        for (let i = 0; i < node.children.length; i++) {
          visit(node.children[i], `${path}.${i}`, ownerDefId, conditionalId, branch, ownerCtx);
        }
        return;
      }

      // Named action instance — create an entry.
      const name: string = node.name ?? node.type;
      const action: BehaviorAction = { id: path, name, type: node.type };
      if (ownerDefId !== null) action.ownerId = ownerDefId;
      if (conditionalId)       action.conditionalId = conditionalId;
      if (branch)              action.branch = branch;
      const ft = node.children.find(c => c.type === 'FeatureTyping');
      if (ft?.name) action.actionType = ft.name;
      actions.push(action);
      return;
    }

    // ── SuccessionAsUsage / Succession ──────────────────────────────────────
    if (SUCCESSION_TYPES.has(node.type)) {
      const refs   = extractEndpointNames(node);
      const flowId = `flow:${path}`;
      if (refs.length >= 2) {
        flows.push({ id: flowId, source: refs[0], target: refs[1], type: 'succession' });
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
      const targetRefs       = succession ? extractEndpointNames(succession) : [];
      const targetName       = targetRefs[0] ?? null;

      const flowId = `flow:${path}`;
      if (sourceName && targetName) {
        flows.push({ id: flowId, source: sourceName, target: targetName, type: 'transition' as const, ...(guard !== undefined ? { guard } : {}) });
      } else {
        flows.push({ id: flowId, sourceName: sourceName ?? '', targetName: targetName ?? '', type: 'transition' as const, ...(guard !== undefined ? { guard } : {}), unresolved: true as const });
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
          visit(thenContainer.children[i], `${path}.then.${i}`, ownerDefId, path, 'then', ownerCtx);
        }
        for (let j = before; j < actions.length; j++) thenIds.push(actions[j].id);
      }

      // Visit the else-block container (ParameterMembership[2] → anonymous ActionUsage[in]).
      const elseContainer = node.children[2]?.children[0];
      if (elseContainer) {
        const before = actions.length;
        for (let i = 0; i < elseContainer.children.length; i++) {
          visit(elseContainer.children[i], `${path}.else.${i}`, ownerDefId, path, 'else', ownerCtx);
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
          visit(bodyContainer.children[i], `${path}.loop.${i}`, ownerDefId, path, 'loop', ownerCtx);
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

    // ── Transparent wrapper (OwningMembership, FeatureMembership, ParameterMembership, etc.) ──
    for (let i = 0; i < node.children.length; i++) {
      visit(node.children[i], `${path}.${i}`, ownerDefId, conditionalId, branch, ownerCtx);
    }
  }

  roots.forEach((root, i) => visit(root, String(i), null));
  return { actions, flows, conditionals };
}
