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
  isComposite?: boolean;
  startLine?: number;
  endLine?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'typedBy' | 'connection' | 'message' | 'specialization' | 'subsetting';
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

const TYPED_USAGE_TYPES = new Set(['PartUsage', 'ItemUsage', 'AttributeUsage', 'PortUsage', 'ActionUsage', 'PerformActionUsage', 'RequirementUsage']);

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
    if (node.isComposite === false) n.isComposite = false;
    if (node.startLine != null && node.startLine > 0) {
      n.startLine = node.startLine;
      n.endLine   = node.endLine;
    }
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

  // ── Shared: PartUsage index + typedBy lookup + type-aware port resolution ─────

  const partUsagesByName = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.type === 'PartUsage' && n.label !== n.type) {
      const list = partUsagesByName.get(n.label) ?? [];
      list.push(n.id);
      partUsagesByName.set(n.label, list);
    }
  }

  // Build usageId → defId from all typedBy edges emitted in Pass 2.
  const typedByBySource = new Map<string, string>();
  for (const e of edges) {
    if (e.type === 'typedBy') typedByBySource.set(e.source, e.target);
  }

  // Find the first named FeatureTyping label in a subtree (the payload type).
  function findFlowTypeName(id: string): string | undefined {
    for (const kid of childrenOf.get(id) ?? []) {
      const n = nodeById.get(kid);
      if (!n) continue;
      if (n.type === 'FeatureTyping' && n.label !== n.type) return n.label;
      if (MEMBERSHIP_WRAPPERS.has(n.type)) {
        const found = findFlowTypeName(kid);
        if (found) return found;
      }
    }
    return undefined;
  }

  // Type-aware chain resolution: disambiguates same-named ports across PartDefs
  // by following PartUsage → typedBy → PartDef → PortUsage ancestry.
  function resolveFlowChain(chain: string[]): string | null {
    if (chain.length === 0) return null;
    const portName = chain[chain.length - 1];
    const candidates = portUsagesByName.get(portName);
    if (!candidates?.length) return null;
    if (candidates.length === 1) return candidates[0];

    if (chain.length >= 2) {
      const partName = chain[0];
      const partIds  = partUsagesByName.get(partName) ?? [];
      for (const partId of partIds) {
        const defId = typedByBySource.get(partId);
        if (!defId) continue;
        for (const portId of candidates) {
          let id: string | undefined = parentOf.get(portId);
          while (id !== undefined) {
            if (id === defId) return portId;
            const n = nodeById.get(id);
            if (!n || !MEMBERSHIP_WRAPPERS.has(n.type)) break;
            id = parentOf.get(id);
          }
        }
      }
    }

    return candidates[0]; // fallback
  }

  // ── Pass 4: connection edges via FlowUsage (FlowEnd endpoints) ───────────────
  //
  // 'flow ... from part.port to part.port' creates a FlowUsage with two
  // EndFeatureMembership children. Under each EndFeatureMembership sits a FlowEnd:
  //   ReferenceSubsetting (label = part name)
  //   FeatureMembership → ReferenceUsage (label = port name)
  // We build a [partName, portName] chain per end and resolve via resolveFlowChain.

  function collectFlowEndChains(flowId: string): string[][] {
    const chains: string[][] = [];
    for (const kid of childrenOf.get(flowId) ?? []) {
      const emNode = nodeById.get(kid);
      if (!emNode || emNode.type !== 'EndFeatureMembership') continue;
      for (const kid2 of childrenOf.get(kid) ?? []) {
        const feNode = nodeById.get(kid2);
        if (!feNode || feNode.type !== 'FlowEnd') continue;
        let partName: string | null = null;
        let portName: string | null = null;
        for (const kid3 of childrenOf.get(kid2) ?? []) {
          const n3 = nodeById.get(kid3);
          if (!n3) continue;
          if (n3.type === 'ReferenceSubsetting' && n3.label !== n3.type) {
            partName = n3.label;
          } else if (n3.type === 'FeatureMembership') {
            for (const kid4 of childrenOf.get(kid3) ?? []) {
              const n4 = nodeById.get(kid4);
              if (n4 && n4.type === 'ReferenceUsage' && n4.label !== n4.type) {
                portName = n4.label;
              }
            }
          }
        }
        const chain: string[] = [];
        if (partName) chain.push(partName);
        if (portName) chain.push(portName);
        if (chain.length > 0) chains.push(chain);
      }
    }
    return chains;
  }

  for (const n of nodes) {
    if (n.type !== 'FlowUsage') continue;

    const chains = collectFlowEndChains(n.id);
    if (chains.length < 2) continue;

    const [chainA, chainB] = chains;
    const srcId = resolveFlowChain(chainA);
    const tgtId = resolveFlowChain(chainB);

    if (!srcId || !tgtId || srcId === tgtId) continue;

    const edgeId = `flow:${srcId}:${tgtId}`;
    if (seenConn.has(edgeId)) continue;
    seenConn.add(edgeId);

    const flowName    = n.label !== n.type ? n.label : undefined;
    const payloadType = findFlowTypeName(n.id);
    const label       = flowName && payloadType ? `${flowName} : ${payloadType}`
                      : flowName ?? payloadType;
    edges.push({ id: edgeId, source: srcId, target: tgtId, type: 'connection', label });
  }

  // ── Pass 5: connection edges via FlowConnectionUsage / SuccessionItemFlow ─────
  //
  // These use EndFeatureMembership + FeatureChaining (same as ConnectionUsage).
  // resolveFlowChain disambiguates port names via the typedBy → PartDef path.

  const FLOW_CONN_TYPES = new Set(['FlowConnectionUsage', 'SuccessionItemFlow']);

  for (const n of nodes) {
    if (!FLOW_CONN_TYPES.has(n.type)) continue;

    const chains = collectEndpointChains(n.id);
    if (chains.length < 2) continue;

    const [chainA, chainB] = chains;
    const srcId = resolveFlowChain(chainA);
    const tgtId = resolveFlowChain(chainB);

    if (!srcId || !tgtId || srcId === tgtId) continue;

    const edgeId = `flow:${srcId}:${tgtId}`;
    if (seenConn.has(edgeId)) continue;
    seenConn.add(edgeId);

    const flowName    = n.label !== n.type ? n.label : undefined;
    const payloadType = findFlowTypeName(n.id);
    const label       = flowName && payloadType ? `${flowName} : ${payloadType}`
                      : flowName ?? payloadType;

    edges.push({ id: edgeId, source: srcId, target: tgtId, type: 'connection', label });
  }

  // ── Pass 6: specialization edges (Superclassing between PartDefinitions) ─────
  //
  // `part def A :> B` → PartDefinition A has a Superclassing child whose label
  // the Java parser now sets to B's name.  Emit source=A, target=B.

  function findDefAncestor(startId: string): string | null {
    let id = parentOf.get(startId);
    while (id !== undefined) {
      const n = nodeById.get(id);
      if (!n) return null;
      if (TYPED_DEF_TYPES.has(n.type)) return id;
      if (!MEMBERSHIP_WRAPPERS.has(n.type)) return null;
      id = parentOf.get(id);
    }
    return null;
  }

  const seenSpec = new Set<string>();
  for (const n of nodes) {
    if (n.type !== 'Superclassing') continue;
    if (n.label === n.type) continue;

    const specificId = findDefAncestor(n.id);
    if (!specificId) continue;

    const generalId = defByName.get(n.label);
    if (!generalId || generalId === specificId) continue;

    const edgeId = `${specificId}->specializes->${generalId}`;
    if (seenSpec.has(edgeId)) continue;
    seenSpec.add(edgeId);

    edges.push({ id: edgeId, source: specificId, target: generalId, type: 'specialization' });
  }

  // ── Pass 7: subsetting edges (Subsetting between PartUsages) ─────────────────
  //
  // `part a :>> b` → PartUsage a has a Subsetting child whose label the Java
  // parser now sets to b's name.  Emit source=a, target=b.
  // Excludes ReferenceSubsetting (different EMF type, handled in Pass 3/4).

  const seenSub = new Set<string>();
  for (const n of nodes) {
    if (n.type !== 'Subsetting') continue;
    if (n.label === n.type) continue;

    const subId = findUsageAncestor(n.id);
    if (!subId) continue;

    const superCandidates = partUsagesByName.get(n.label);
    if (!superCandidates?.length) continue;
    const superId = superCandidates[0];
    if (superId === subId) continue;

    const edgeId = `${subId}->subsets->${superId}`;
    if (seenSub.has(edgeId)) continue;
    seenSub.add(edgeId);

    edges.push({ id: edgeId, source: subId, target: superId, type: 'subsetting' });
  }

  // ── Pass 8: message-style FlowUsage → 'message' edges ───────────────────────
  //
  // 'message X from partA.event to partB.event' inside a part def (or action def)
  // creates a FlowUsage whose endpoints use:
  //   ParameterMembership → EventOccurrenceUsage → ReferenceSubsetting
  //     → Feature → FeatureChaining[partName] FeatureChaining[eventName]
  //
  // We extract the participant names and resolve them to PartUsage sibling nodes
  // in the same semantic container.  Multiple messages between the same ordered
  // pair are merged into one labeled edge.

  function extractMsgParticipants(flowId: string): [string, string] | null {
    const names: string[] = [];

    function fromEvent(evtId: string): void {
      for (const refId of childrenOf.get(evtId) ?? []) {
        const refN = nodeById.get(refId);
        if (!refN || refN.type !== 'ReferenceSubsetting') continue;
        for (const featId of childrenOf.get(refId) ?? []) {
          const featN = nodeById.get(featId);
          if (!featN || featN.type !== 'Feature') continue;
          const chains = (childrenOf.get(featId) ?? [])
            .map(id => nodeById.get(id))
            .filter((n): n is GraphNode => !!n && n.type === 'FeatureChaining' && n.label !== n.type);
          if (chains.length >= 1) { names.push(chains[0].label); return; }
        }
        if (refN.label !== refN.type) { names.push(refN.label); return; }
      }
    }

    function walkFlow(id: string): void {
      for (const kid of childrenOf.get(id) ?? []) {
        const n = nodeById.get(kid);
        if (!n) continue;
        if (n.type === 'EventOccurrenceUsage') { fromEvent(kid); }
        else if (MEMBERSHIP_WRAPPERS.has(n.type)) { walkFlow(kid); }
      }
    }

    walkFlow(flowId);
    return names.length >= 2 ? [names[0], names[1]] : null;
  }

  function findSiblingPart(flowId: string, name: string): string | null {
    let ancestorId: string | undefined = parentOf.get(flowId);
    while (ancestorId !== undefined && MEMBERSHIP_WRAPPERS.has(nodeById.get(ancestorId)?.type ?? '')) {
      ancestorId = parentOf.get(ancestorId);
    }
    if (!ancestorId) return null;

    function searchPart(cId: string): string | null {
      for (const kid of childrenOf.get(cId) ?? []) {
        const n = nodeById.get(kid);
        if (!n) continue;
        if (n.type === 'PartUsage' && n.label === name) return kid;
        if (MEMBERSHIP_WRAPPERS.has(n.type)) { const f = searchPart(kid); if (f) return f; }
      }
      return null;
    }
    return searchPart(ancestorId);
  }

  const msgGroups = new Map<string, { srcId: string; tgtId: string; names: string[] }>();
  for (const n of nodes) {
    if (n.type !== 'FlowUsage') continue;
    const pair = extractMsgParticipants(n.id);
    if (!pair) continue;
    const srcId = findSiblingPart(n.id, pair[0]);
    const tgtId = findSiblingPart(n.id, pair[1]);
    if (!srcId || !tgtId || srcId === tgtId) continue;
    const key      = `${srcId}:${tgtId}`;
    const flowName = n.label !== n.type ? n.label : '';
    if (!msgGroups.has(key)) msgGroups.set(key, { srcId, tgtId, names: [] });
    if (flowName) msgGroups.get(key)!.names.push(flowName);
  }
  for (const [key, { srcId, tgtId, names }] of msgGroups) {
    const label = names.length === 0  ? undefined
                : names.length <= 2   ? names.join(', ')
                : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
    edges.push({ id: `msg:${key}`, source: srcId, target: tgtId, type: 'message', label });
  }

  return { nodes, edges };
}
