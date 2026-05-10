/**
 * Extracts behavior semantics (actions and succession flows) from the raw
 * ModelNode[] tree produced by the Java parser wrapper.
 *
 * Handles:
 *   ActionDefinition         — behavior definition
 *   ActionUsage              — action instance inside a definition
 *   PerformActionUsage       — perform-action instance (treated same as ActionUsage)
 *   SuccessionAsUsage        — succession first X then Y  (actual EMF type)
 *   Succession               — bare succession relationship (fallback)
 *
 * Succession endpoints are resolved by DFS-searching for ReferenceSubsetting
 * or FeatureChaining nodes whose name the Java wrapper populated from the
 * resolved cross-reference (referencedFeature / chainingFeature).
 */

import type { ModelNode, BehaviorAction, BehaviorFlow, BehaviorData } from './types';

const ACTION_USAGE_TYPES = new Set(['ActionUsage', 'PerformActionUsage']);
const SUCCESSION_TYPES   = new Set(['Succession', 'SuccessionAsUsage']);

/**
 * DFS through a node's children to collect ReferenceSubsetting /
 * FeatureChaining names that the Java wrapper resolved from cross-references.
 * Stops at the first hit in each subtree so both endpoint names come out as
 * refs[0] and refs[1].
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

export function buildBehavior(roots: ModelNode[]): BehaviorData {
  const actions: BehaviorAction[] = [];
  const flows:   BehaviorFlow[]   = [];

  function visit(node: ModelNode, path: string, ownerDefId: string | null): void {
    if (node.type === 'ActionDefinition') {
      const name = node.name ?? node.type;
      actions.push({ id: path, name, type: 'ActionDefinition' });
      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i], `${path}.${i}`, path);
      }
      return;
    }

    if (ACTION_USAGE_TYPES.has(node.type)) {
      const name = node.name ?? node.type;
      const action: BehaviorAction = { id: path, name, type: node.type };
      if (ownerDefId !== null) action.ownerId = ownerDefId;
      actions.push(action);
      return;
    }

    if (SUCCESSION_TYPES.has(node.type)) {
      const refs   = extractEndpointNames(node);
      const flowId = `flow:${path}`;
      if (refs.length >= 2) {
        flows.push({ id: flowId, source: refs[0], target: refs[1], type: 'succession' });
      } else {
        flows.push({
          id:         flowId,
          sourceName: refs[0] ?? '',
          targetName: refs[1] ?? '',
          type:       'succession',
          unresolved: true,
        });
      }
      return;
    }

    // Recurse through membership wrappers, packages, and all other containers.
    for (let i = 0; i < node.children.length; i++) {
      visit(node.children[i], `${path}.${i}`, ownerDefId);
    }
  }

  roots.forEach((root, i) => visit(root, String(i), null));
  return { actions, flows };
}
