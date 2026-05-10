/**
 * Graph builder for the parser-service.
 *
 * Takes the raw ModelNode[] tree from the Java wrapper and produces a
 * ContainmentGraph with three kinds of edges:
 *
 *   'contains'   — EMF eContents() parent→child ownership
 *   'typedBy'    — FeatureTyping cross-reference (usage → definition)
 *   'connection' — ConnectionUsage endpoints resolved via FeatureChaining
 *
 * This mirrors officialSysMLAdapter.buildContainmentGraph() in the frontend
 * but runs inside the parser-service so the graph is embedded in the response.
 */

import type { ModelNode } from './types';

// ── Output types ──────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  direction?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'typedBy' | 'connection';
  label?: string;
}

export interface ContainmentGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Sets of EMF types used in semantic passes ─────────────────────────────────

const MEMBERSHIP_WRAPPERS = new Set([
  'Namespace', 'OwningMembership', 'FeatureMembership',
  'ReturnParameterMembership', 'ParameterMembership',
  'VariantMembership', 'EndFeatureMembership',
  'ObjectiveMembership', 'ActorMembership', 'StakeholderMembership',
  'ExposeMembership', 'AliasMembership', 'ImportMembership',
  'MembershipExpose', 'NamespaceExpose', 'ViewRenderingMembership',
]);

const TYPED_USAGE_TYPES = new Set(['PartUsage', 'AttributeUsage', 'PortUsage', 'ActionUsage', 'PerformActionUsage']);

const TYPED_DEF_TYPES = new Set([
  'PartDefinition', 'AttributeDefinition', 'PortDefinition',
  'InterfaceDefinition', 'ConnectionDefinition',
  'ItemDefinition', 'OccurrenceDefinition', 'ActionDefinition',
  'BehaviorDefinition', 'StateDefinition', 'RequirementDefinition',
  'AllocationDefinition', 'UseCaseDefinition', 'ViewDefinition',
]);

// ── Main export ───────────────────────────────────────────────────────────────

export function buildGraph(roots: ModelNode[]): ContainmentGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // ── Pass 1: containment tree ──────────────────────────────────────────────

  function visit(node: ModelNode, parentId: string | null, path: string): void {
    const label = node.name ?? node.type;
    const n: GraphNode = { id: path, label, type: node.type };
    if (node.direction != null) n.direction = node.direction;
    nodes.push(n);

    if (parentId !== null) {
      edges.push({ id: `${parentId}->${path}`, source: parentId, target: path, type: 'contains' });
    }

    node.children.forEach((child, i) => visit(child, path, `${path}.${i}`));
  }

  roots.forEach((root, i) => visit(root, null, String(i)));

  // ── Pass 2: typedBy edges ─────────────────────────────────────────────────

  const parentOf = new Map<string, string>();
  for (const e of edges) parentOf.set(e.target, e.source);

  const nodeById = new Map(nodes.map(n => [n.id, n]));

  const defByName = new Map<string, string>();
  for (const n of nodes) {
    if (TYPED_DEF_TYPES.has(n.type) && n.label !== n.type) {
      defByName.set(n.label, n.id);
    }
  }

  function findUsageAncestor(startId: string): string | null {
    let id = parentOf.get(startId);
    while (id !== undefined) {
      const n = nodeById.get(id);
      if (!n) return null;
      if (TYPED_USAGE_TYPES.has(n.type)) return id;
      if (!MEMBERSHIP_WRAPPERS.has(n.type)) return null;
      id = parentOf.get(id);
    }
    return null;
  }

  const seenTypedBy = new Set<string>();
  for (const n of nodes) {
    if (n.type !== 'FeatureTyping') continue;
    if (n.label === n.type) continue;

    const usageId = findUsageAncestor(n.id);
    if (!usageId) continue;

    const defId = defByName.get(n.label);
    if (!defId) continue;

    const edgeId = `${usageId}->typedBy->${defId}`;
    if (seenTypedBy.has(edgeId)) continue;
    seenTypedBy.add(edgeId);

    edges.push({ id: edgeId, source: usageId, target: defId, type: 'typedBy' });
  }

  // ── Pass 3: connection edges via FeatureChaining ──────────────────────────
  //
  // Each ConnectionUsage has two EndFeatureMembership children. Under each end,
  // a chain of FeatureChaining nodes encodes the dotted path (e.g. tank.fuelOut).
  // We DFS to collect those names, then resolve the last segment (port name) to
  // a PortUsage node in the graph.

  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) childrenOf.set(n.id, []);
  for (const [childId, parentId] of parentOf) {
    childrenOf.get(parentId)?.push(childId);
  }

  // Build name→[id] index for PortUsage nodes so we can resolve endpoint chains.
  const portUsagesByName = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.type === 'PortUsage' && n.label !== n.type) {
      const list = portUsagesByName.get(n.label) ?? [];
      list.push(n.id);
      portUsagesByName.set(n.label, list);
    }
  }

  // Collect all FeatureChaining labels in DFS order within a subtree.
  function collectFeatureChainingNames(startId: string): string[] {
    const names: string[] = [];
    function dfs(id: string): void {
      const n = nodeById.get(id);
      if (!n) return;
      if (n.type === 'FeatureChaining' && n.label !== n.type) {
        names.push(n.label);
        return; // FeatureChaining nodes don't nest further chains
      }
      for (const kid of childrenOf.get(id) ?? []) dfs(kid);
    }
    dfs(startId);
    return names;
  }

  // Collect endpoint chains from a ConnectionUsage's EndFeatureMembership children.
  // Returns one chain per end (0, 1, or 2 entries).
  function collectEndpointChains(connId: string): string[][] {
    const chains: string[][] = [];
    for (const kid of childrenOf.get(connId) ?? []) {
      const n = nodeById.get(kid);
      if (!n || n.type !== 'EndFeatureMembership') continue;
      const chain = collectFeatureChainingNames(kid);
      if (chain.length > 0) chains.push(chain);
    }
    return chains;
  }

  // Resolve a chain like ["tank", "fuelOut"] to the id of the PortUsage for
  // "fuelOut". If the chain has more than one segment, narrow candidates to
  // those whose parent chain contains a node named chain[0].
  function resolveChain(chain: string[]): string | null {
    if (chain.length === 0) return null;
    const portName = chain[chain.length - 1];
    const candidates = portUsagesByName.get(portName);
    if (!candidates?.length) return null;

    if (chain.length === 1 || candidates.length === 1) {
      return candidates[0];
    }

    // Multiple ports share the same name: narrow by walking up the containment
    // tree and checking whether any ancestor is named chain[chain.length - 2].
    const ownerName = chain[chain.length - 2];
    for (const portId of candidates) {
      let id = parentOf.get(portId);
      while (id !== undefined) {
        const n = nodeById.get(id);
        if (!n) break;
        if (n.label === ownerName) return portId;
        if (!MEMBERSHIP_WRAPPERS.has(n.type)) break;
        id = parentOf.get(id);
      }
    }

    return candidates[0]; // fall back to first match
  }

  const seenConn = new Set<string>();

  for (const n of nodes) {
    if (n.type !== 'ConnectionUsage') continue;

    const chains = collectEndpointChains(n.id);
    if (chains.length < 2) {
      // Endpoints not resolvable — add a visible fallback node under the parent.
      const parentId = parentOf.get(n.id);
      const fallbackId = `conn-fallback-${n.id}`;
      nodes.push({ id: fallbackId, label: '«connection» connect', type: 'ConnectionUsage' });
      if (parentId) {
        edges.push({ id: `${parentId}->${fallbackId}`, source: parentId, target: fallbackId, type: 'contains' });
      }
      continue;
    }

    const [chainA, chainB] = chains;
    const sourceId = resolveChain(chainA);
    const targetId = resolveChain(chainB);

    if (!sourceId || !targetId || sourceId === targetId) {
      // Resolution failed — add fallback node.
      const parentId = parentOf.get(n.id);
      const fallbackId = `conn-fallback-${n.id}`;
      nodes.push({ id: fallbackId, label: '«connection» connect', type: 'ConnectionUsage' });
      if (parentId) {
        edges.push({ id: `${parentId}->${fallbackId}`, source: parentId, target: fallbackId, type: 'contains' });
      }
      continue;
    }

    const edgeId = `connection:${sourceId}:${targetId}`;
    if (seenConn.has(edgeId)) continue;
    seenConn.add(edgeId);

    edges.push({ id: edgeId, source: sourceId, target: targetId, type: 'connection', label: 'connect' });
  }

  return { nodes, edges };
}
