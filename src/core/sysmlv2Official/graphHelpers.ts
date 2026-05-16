import type { GraphNode } from './ContainmentGraph';

const WRAPPER_TYPES = new Set([
  'OwningMembership', 'FeatureMembership', 'OwningFeatureMembership',
  'ParameterMembership', 'ReturnParameterMembership', 'VariantMembership',
  'EndFeatureMembership', 'ObjectiveMembership', 'ActorMembership',
  'StakeholderMembership', 'ExposeMembership', 'AliasMembership',
  'ImportMembership', 'ViewRenderingMembership',
]);

export function isWrapper(type: string): boolean {
  return WRAPPER_TYPES.has(type) || type.endsWith('Membership') || type.endsWith('Import');
}

export function buildChildrenMap(nodes: GraphNode[]): Map<string | null, string[]> {
  const m = new Map<string | null, string[]>();
  m.set(null, []);
  for (const n of nodes) m.set(n.id, []);
  for (const n of nodes) {
    const segs = n.id.split('.');
    const parentId = segs.length > 1 ? segs.slice(0, -1).join('.') : null;
    m.get(parentId)?.push(n.id);
  }
  return m;
}

export function directSemanticChildren(
  parentId: string,
  childrenOf: Map<string | null, string[]>,
  nodeById: Map<string, GraphNode>,
): GraphNode[] {
  const result: GraphNode[] = [];
  function search(id: string) {
    for (const childId of childrenOf.get(id) ?? []) {
      const node = nodeById.get(childId);
      if (!node) continue;
      if (isWrapper(node.type)) {
        search(childId);
      } else {
        result.push(node);
      }
    }
  }
  search(parentId);
  return result;
}
