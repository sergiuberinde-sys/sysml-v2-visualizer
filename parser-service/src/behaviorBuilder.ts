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
const CONDITIONAL_TYPES    = new Set(['IfActionUsage', 'WhileLoopActionUsage']);

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
   */
  function visit(
    node: ModelNode,
    path: string,
    ownerDefId: string | null,
    conditionalId?: string,
    branch?: 'then' | 'else' | 'loop',
  ): void {

    // ── ActionDefinition ────────────────────────────────────────────────────
    if (node.type === 'ActionDefinition') {
      const name = node.name ?? node.type;
      actions.push({ id: path, name, type: 'ActionDefinition' });
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i], `${path}.${i}`, path);
      }
      return;
    }

    // ── Named ActionUsage / PerformActionUsage ──────────────────────────────
    if (ACTION_USAGE_TYPES.has(node.type)) {
      // Anonymous ActionUsage[in] = then/else/loop container inside a conditional.
      // These are transparent — recurse into their children without creating an action entry.
      if (node.name === null && node.direction === 'in') {
        for (let i = 0; i < node.children.length; i++) {
          visit(node.children[i], `${path}.${i}`, ownerDefId, conditionalId, branch);
        }
        return;
      }

      // Named action instance — create an entry.
      const name: string = node.name ?? node.type;
      const action: BehaviorAction = { id: path, name, type: node.type };
      if (ownerDefId !== null) action.ownerId = ownerDefId;
      if (conditionalId)       action.conditionalId = conditionalId;
      if (branch)              action.branch = branch;
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
          visit(thenContainer.children[i], `${path}.then.${i}`, ownerDefId, path, 'then');
        }
        for (let j = before; j < actions.length; j++) thenIds.push(actions[j].id);
      }

      // Visit the else-block container (ParameterMembership[2] → anonymous ActionUsage[in]).
      const elseContainer = node.children[2]?.children[0];
      if (elseContainer) {
        const before = actions.length;
        for (let i = 0; i < elseContainer.children.length; i++) {
          visit(elseContainer.children[i], `${path}.else.${i}`, ownerDefId, path, 'else');
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
      const condition = extractCondition(node.children[0]);

      const loopIds: string[] = [];
      const bodyContainer = node.children[1]?.children[0];
      if (bodyContainer) {
        const before = actions.length;
        for (let i = 0; i < bodyContainer.children.length; i++) {
          visit(bodyContainer.children[i], `${path}.loop.${i}`, ownerDefId, path, 'loop');
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
      visit(node.children[i], `${path}.${i}`, ownerDefId, conditionalId, branch);
    }
  }

  roots.forEach((root, i) => visit(root, String(i), null));
  return { actions, flows, conditionals };
}
