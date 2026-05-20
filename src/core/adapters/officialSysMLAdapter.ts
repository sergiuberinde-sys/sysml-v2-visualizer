/**
 * Adapter: official SysML v2 parser results → visualizer data structures.
 *
 * Two public exports:
 *
 *   buildContainmentGraph(roots)
 *     Converts the raw EMF ModelNode[] tree into a flat ContainmentGraph
 *     (nodes + containment edges).  Used by the Graph tab and by the VS Code
 *     extension to forward graph data to the webview.
 *
 *   convertGraph(parseResult)
 *     Step 3 of MIGRATION_TO_SYSML_V2.md.
 *     Converts SysMLV2ParseResult.graph → VisualizerModel so that all
 *     existing views (Structure, Sequence, …) can render official parse output.
 *
 * Mapping rules
 * ─────────────
 * • Transparent wrapper nodes (memberships, typing, superclassing, …) are
 *   silently skipped; their children are folded into the enclosing scope.
 * • Definition nodes (PartDefinition, OccurrenceDefinition, …) → top-level
 *   VizNode kinds; added to both the parent body and result.nodes[].
 * • Usage nodes (PartUsage, PortUsage, …) → body-only VizNode kinds; added
 *   to parent body but NOT to result.nodes[].
 * • Package → packageDef; added to result.packages[], not result.nodes[].
 * • No semantic relationships are inferred; only EMF containment is mapped.
 */

import type { ModelNode } from '../sysmlv2Official/ModelNode';
import type { ContainmentGraph, GraphEdge, GraphNode } from '../sysmlv2Official/ContainmentGraph';
import type { SysMLV2ParseResult } from '../sysmlv2Official/SysMLV2ParseResult';
import type { SysMLNode, PackageDefNode, ParseDiagnostic } from '../modelTypes';
import type { VisualizerModel } from '../visualizerModel';
import { PARSER_MODE } from '../parserMode';

// ── Containment graph builder ─────────────────────────────────────────────────

// Membership wrapper node types that are transparent when walking up the tree
// to locate the usage that owns a FeatureTyping cross-reference.
const MEMBERSHIP_WRAPPERS = new Set([
  'Namespace',
  'OwningMembership', 'FeatureMembership',
  'ReturnParameterMembership', 'ParameterMembership',
  'VariantMembership', 'EndFeatureMembership',
  'ObjectiveMembership', 'ActorMembership', 'StakeholderMembership',
  'ExposeMembership', 'AliasMembership', 'ImportMembership',
  'MembershipExpose', 'NamespaceExpose', 'ViewRenderingMembership',
]);

// Usage kinds for which we create typedBy edges (per requirements §3).
const TYPED_USAGE_TYPES = new Set(['PartUsage', 'ItemUsage', 'AttributeUsage', 'PortUsage', 'ActionUsage', 'PerformActionUsage', 'RequirementUsage']);

// Definition kinds that are valid targets for typedBy edges.
const TYPED_DEF_TYPES = new Set([
  'PartDefinition', 'AttributeDefinition', 'PortDefinition',
  'InterfaceDefinition', 'ConnectionDefinition',
  'ItemDefinition', 'OccurrenceDefinition', 'ActionDefinition',
  'BehaviorDefinition', 'StateDefinition', 'RequirementDefinition',
  'AllocationDefinition', 'UseCaseDefinition', 'ViewDefinition',
]);

export function buildContainmentGraph(roots: ModelNode[]): ContainmentGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // ── Pass 1: containment tree ──────────────────────────────────────────────

  function visit(node: ModelNode, parentId: string | null, path: string): void {
    const id = path;
    const gn: GraphNode = { id, label: node.name ?? node.type, type: node.type };
    if (node.direction != null) gn.direction = node.direction;
    if (node.isComposite === false) gn.isComposite = false;
    if (node.startLine != null && node.startLine > 0) {
      gn.startLine = node.startLine;
      gn.endLine   = node.endLine;
    }
    nodes.push(gn);

    if (parentId !== null) {
      edges.push({
        id:     `${parentId}->${id}`,
        source: parentId,
        target: id,
        type:   'contains',
      });
    }

    node.children.forEach((child, i) => visit(child, id, `${path}.${i}`));
  }

  roots.forEach((root, i) => visit(root, null, String(i)));

  // ── Pass 2: typedBy edges ─────────────────────────────────────────────────
  //
  // For each FeatureTyping node whose label carries a resolved type name (set
  // by the Java parser's crossRefName helper), walk up through membership
  // wrappers to locate the owning usage node, then find the definition node
  // with that name and add a 'typedBy' edge.

  // Build parent lookup from containment edges.
  const parentOf = new Map<string, string>();
  for (const e of edges) parentOf.set(e.target, e.source);

  // Build quick-access maps: id → node.
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // Index definition nodes by simple name (last definition with that name wins).
  // Qualified-name resolution is deferred to a future semantic pass.
  const defByName = new Map<string, string>(); // name → node id
  for (const n of nodes) {
    if (TYPED_DEF_TYPES.has(n.type) && n.label !== n.type) {
      defByName.set(n.label, n.id);
    }
  }

  // Walk up through membership wrappers to find the nearest usage ancestor.
  // Returns null if the walk exits the transparent zone without finding a usage.
  function findUsageAncestor(startId: string): string | null {
    let id = parentOf.get(startId);
    while (id !== undefined) {
      const n = nodeById.get(id);
      if (!n) return null;
      if (TYPED_USAGE_TYPES.has(n.type)) return id;
      if (!MEMBERSHIP_WRAPPERS.has(n.type)) return null; // crossed a semantic boundary
      id = parentOf.get(id);
    }
    return null;
  }

  const seenTypedBy = new Set<string>();

  for (const n of nodes) {
    if (n.type !== 'FeatureTyping') continue;
    if (n.label === n.type) continue; // label == type means no resolved name

    const usageId = findUsageAncestor(n.id);
    if (!usageId) continue;

    const defId = defByName.get(n.label);
    if (!defId) continue; // req §9: skip silently if type cannot be resolved

    const edgeId = `${usageId}->typedBy->${defId}`;
    if (seenTypedBy.has(edgeId)) continue; // deduplicate (e.g. multiple FeatureTypings)
    seenTypedBy.add(edgeId);

    edges.push({ id: edgeId, source: usageId, target: defId, type: 'typedBy' });
  }

  // ── Pass 3: connection edges ─────────────────────────────────────────────────
  //
  // For each ConnectionUsage, find its EndFeatureMembership children, locate the
  // ReferenceSubsetting nodes (their label was set by the Java parser's
  // crossRefName helper to the referenced port's simple name), and emit a
  // 'connection' edge between the two resolved PortUsage nodes.

  // Build containment-only childrenOf by inverting parentOf (which was built
  // before typedBy edges were appended, so it covers only containment).
  const childrenOfContainment = new Map<string, string[]>();
  for (const n of nodes) childrenOfContainment.set(n.id, []);
  for (const [childId, parentId] of parentOf) {
    childrenOfContainment.get(parentId)?.push(childId);
  }

  // Index PortUsage nodes by simple name for endpoint resolution.
  const portUsagesByName = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.type === 'PortUsage' && n.label !== n.type) {
      const list = portUsagesByName.get(n.label) ?? [];
      list.push(n.id);
      portUsagesByName.set(n.label, list);
    }
  }

  // Collect FeatureChaining names within the subtree of an EndFeatureMembership.
  // FeatureChaining nodes carry the chained segment names (e.g. "tank", "fuelOut").
  // We return the last segment, which is the port name.
  function collectEndpointChain(id: string): string[] {
    const names: string[] = [];
    function dfs(nodeId: string): void {
      const n = nodeById.get(nodeId);
      if (!n) return;
      if (n.type === 'FeatureChaining' && n.label !== n.type) {
        names.push(n.label);
        return;
      }
      for (const kid of childrenOfContainment.get(nodeId) ?? []) dfs(kid);
    }
    dfs(id);
    return names;
  }

  // Collect the resolved endpoint port names from a ConnectionUsage node's
  // EndFeatureMembership children (returns 0, 1, or 2 names).
  function collectEndpointNames(connId: string): string[] {
    const names: string[] = [];
    for (const kid of childrenOfContainment.get(connId) ?? []) {
      const n = nodeById.get(kid);
      if (!n || n.type !== 'EndFeatureMembership') continue;
      const chain = collectEndpointChain(kid);
      // Last segment is the port; take it if present.
      const portName = chain[chain.length - 1];
      if (portName) names.push(portName);
    }
    return names;
  }

  const seenConn = new Set<string>();
  for (const n of nodes) {
    if (n.type !== 'ConnectionUsage') continue;

    const endNames = collectEndpointNames(n.id);
    if (endNames.length < 2) continue;

    const [nameA, nameB] = endNames;
    const portsA = portUsagesByName.get(nameA);
    const portsB = portUsagesByName.get(nameB);
    if (!portsA?.length || !portsB?.length) continue;

    // Use first match per name — sufficient for typical single-port models.
    const portAId = portsA[0];
    const portBId = portsB[0];
    if (portAId === portBId) continue; // skip degenerate self-loops

    const edgeId = `${portAId}->conn->${portBId}`;
    if (seenConn.has(edgeId)) continue;
    seenConn.add(edgeId);

    edges.push({ id: edgeId, source: portAId, target: portBId, type: 'connection' });
  }

  // ── Shared: PartUsage index + typedBy lookup (used by Pass 4 and Pass 5) ──────

  const partUsagesByNameBCG = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.type === 'PartUsage' && n.label !== n.type) {
      const list = partUsagesByNameBCG.get(n.label) ?? [];
      list.push(n.id);
      partUsagesByNameBCG.set(n.label, list);
    }
  }

  const typedByBySourceBCG = new Map<string, string>();
  for (const e of edges) {
    if (e.type === 'typedBy') typedByBySourceBCG.set(e.source, e.target);
  }

  // ── FlowUsage connection edges via FlowEnd endpoints ──────────────────────────
  //
  // 'flow ... from part.port to part.port' creates a FlowUsage with two
  // EndFeatureMembership children. Under each EndFeatureMembership sits a FlowEnd:
  //   ReferenceSubsetting (label = part name)
  //   FeatureMembership → ReferenceUsage (label = port name)

  function collectFlowEndChainsBCG(flowId: string): string[][] {
    const chains: string[][] = [];
    for (const kid of childrenOfContainment.get(flowId) ?? []) {
      const emNode = nodeById.get(kid);
      if (!emNode || emNode.type !== 'EndFeatureMembership') continue;
      for (const kid2 of childrenOfContainment.get(kid) ?? []) {
        const feNode = nodeById.get(kid2);
        if (!feNode || feNode.type !== 'FlowEnd') continue;
        let partName: string | null = null;
        let portName: string | null = null;
        for (const kid3 of childrenOfContainment.get(kid2) ?? []) {
          const n3 = nodeById.get(kid3);
          if (!n3) continue;
          if (n3.type === 'ReferenceSubsetting' && n3.label !== n3.type) {
            partName = n3.label;
          } else if (n3.type === 'FeatureMembership') {
            for (const kid4 of childrenOfContainment.get(kid3) ?? []) {
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

  const seenFlow = new Set<string>();
  for (const n of nodes) {
    if (n.type !== 'FlowUsage') continue;

    const chains = collectFlowEndChainsBCG(n.id);
    if (chains.length < 2) continue;

    const [chainA, chainB] = chains;
    const srcId = resolveFlowChainBCG(chainA);
    const tgtId = resolveFlowChainBCG(chainB);

    if (!srcId || !tgtId || srcId === tgtId) continue;

    const flowName    = n.label !== n.type ? n.label : undefined;
    const payloadType = findFlowTypeNameBCG(n.id);
    const label       = flowName && payloadType ? `${flowName} : ${payloadType}`
                      : flowName ?? payloadType;
    const edgeId = `flow:${srcId}:${tgtId}`;
    if (seenFlow.has(edgeId)) continue;
    seenFlow.add(edgeId);

    edges.push({ id: edgeId, source: srcId, target: tgtId, type: 'connection', label });
  }

  // ── Pass 5: FlowConnectionUsage / SuccessionItemFlow ─────────────────────────
  // Same structure as ConnectionUsage (EndFeatureMembership+FeatureChaining)
  // but with type-aware port resolution to handle ambiguous port names.

  function findFlowTypeNameBCG(id: string): string | undefined {
    for (const kid of childrenOfContainment.get(id) ?? []) {
      const n = nodeById.get(kid);
      if (!n) continue;
      if (n.type === 'FeatureTyping' && n.label !== n.type) return n.label;
      if (MEMBERSHIP_WRAPPERS.has(n.type)) {
        const f = findFlowTypeNameBCG(kid);
        if (f) return f;
      }
    }
    return undefined;
  }

  // Collect full FeatureChaining chains from all EndFeatureMembership children.
  function collectEndpointFullChains(connId: string): string[][] {
    const chains: string[][] = [];
    for (const kid of childrenOfContainment.get(connId) ?? []) {
      const n = nodeById.get(kid);
      if (!n || n.type !== 'EndFeatureMembership') continue;
      const chain = collectEndpointChain(kid);
      if (chain.length > 0) chains.push(chain);
    }
    return chains;
  }

  function resolveFlowChainBCG(chain: string[]): string | null {
    if (chain.length === 0) return null;
    const portName   = chain[chain.length - 1];
    const candidates = portUsagesByName.get(portName);
    if (!candidates?.length) return null;
    if (candidates.length === 1) return candidates[0];

    if (chain.length >= 2) {
      const partName = chain[0];
      const partIds  = partUsagesByNameBCG.get(partName) ?? [];
      for (const partId of partIds) {
        const defId = typedByBySourceBCG.get(partId);
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

    return candidates[0];
  }

  for (const n of nodes) {
    if (n.type !== 'FlowConnectionUsage' && n.type !== 'SuccessionItemFlow') continue;

    const chains = collectEndpointFullChains(n.id);
    if (chains.length < 2) continue;

    const [chainA, chainB] = chains;
    const srcId = resolveFlowChainBCG(chainA);
    const tgtId = resolveFlowChainBCG(chainB);
    if (!srcId || !tgtId || srcId === tgtId) continue;

    const flowName    = n.label !== n.type ? n.label : undefined;
    const payloadType = findFlowTypeNameBCG(n.id);
    const label       = flowName && payloadType ? `${flowName} : ${payloadType}`
                      : flowName ?? payloadType;

    const edgeId = `flow:${srcId}:${tgtId}`;
    if (seenFlow.has(edgeId)) continue;
    seenFlow.add(edgeId);

    edges.push({ id: edgeId, source: srcId, target: tgtId, type: 'connection', label });
  }

  return { nodes, edges };
}

// ── VisualizerModel conversion (Step 3) ──────────────────────────────────────

/**
 * EMF wrapper / relationship types that carry no visualizable content.
 * These nodes are skipped during traversal; their children are folded into the
 * enclosing semantic scope as if the wrapper did not exist.
 */
const TRANSPARENT_TYPES = new Set([
  // Implicit root wrapper Xtext adds to every resource
  'Namespace',
  // Ownership / membership wrappers
  'OwningMembership',
  'FeatureMembership',
  'ReturnParameterMembership',
  'ParameterMembership',
  'VariantMembership',
  'EndFeatureMembership',
  'ObjectiveMembership',
  'ActorMembership',
  'StakeholderMembership',
  'ExposeMembership',
  'AliasMembership',
  'ImportMembership',
  'MembershipExpose',
  'NamespaceExpose',
  'ViewRenderingMembership',
  // Classifier / feature relationships (cross-references, not content)
  'FeatureTyping',
  'Superclassing',
  'SubclassificationMembership',
  'Redefinition',
  'Subsetting',
  'ReferenceSubsetting',
  'ConjugatedPortTyping',
]);

/**
 * EMF definition types that become top-level visualizer nodes (result.nodes[]).
 * All other mapped types are body-only (result.nodes[] is not populated).
 */
const DEFINITION_TYPES = new Set([
  'PartDefinition',
  'OccurrenceDefinition',
  'InterfaceDefinition',
  'PortDefinition',
  'ConnectionDefinition',
  'ActionDefinition',
  'BehaviorDefinition',
  'StateDefinition',
  'RequirementDefinition',
  'AttributeDefinition',
  'ItemDefinition',
  'AllocationDefinition',
  'UseCaseDefinition',
  'ViewDefinition',
  'MetadataDefinition',
]);

/**
 * Map a single GraphNode to a SysMLNode, given its resolved body children and
 * the declared type name (extracted from FeatureTyping cross-reference if
 * available, empty string otherwise).
 * Returns null for unmapped / unrecognised EMF types (they are skipped).
 */
function toVizNode(
  gNode: GraphNode,
  namespace: string,
  body: SysMLNode[],
  typeName: string,
  portDirection?: 'in' | 'out' | 'inout',
  _portItemType?: string,
): SysMLNode | null {
  const name = gNode.label; // already name ?? type from buildContainmentGraph

  switch (gNode.type) {
    // ── Package ──────────────────────────────────────────────────────────────
    case 'Package':
    case 'LibraryPackage':
      return { kind: 'packageDef', name, namespace, body, line: 0 };

    // ── Part / composition ───────────────────────────────────────────────────
    case 'PartDefinition':
    case 'AllocationDefinition':
    case 'UseCaseDefinition':
    case 'ViewDefinition':
    case 'MetadataDefinition':
      return { kind: 'partDef', name, namespace, body, line: 0 };

    case 'ItemDefinition':
      return { kind: 'itemDef', name, namespace, body, line: 0 };

    case 'AttributeDefinition':
      return { kind: 'attributeDef', name, namespace, body, line: 0 };

    case 'PartUsage':
      // PartUsage with body items = package-scope structural block (e.g. "part system { ... }")
      return body.length > 0
        ? { kind: 'partUsage', name, namespace, type: typeName, body, line: 0 }
        : { kind: 'partAlias', name, type: typeName, line: 0,
            ...(gNode.isComposite === false ? { isRef: true } : {}) };

    case 'ItemUsage':
      return { kind: 'itemAlias', name, type: typeName, line: 0 };

    case 'OccurrenceUsage':
      return { kind: 'partAlias', name, type: typeName, line: 0,
               ...(gNode.isComposite === false ? { isRef: true } : {}) };

    case 'AttributeUsage':
      return { kind: 'attributeUsage', name, type: typeName, line: 0 };

    // ── Interface / port ─────────────────────────────────────────────────────
    case 'InterfaceDefinition':
    case 'ConnectionDefinition':
      return { kind: 'interfaceDef', name, namespace, line: 0 };

    case 'PortDefinition': {
      const portItems = body.filter(b => b.kind === 'itemAlias');
      return { kind: 'portDef', name, namespace, line: 0, ...(portItems.length ? { body: portItems } : {}) };
    }

    case 'PortUsage':
      return {
        kind: 'port',
        name,
        direction: portDirection ?? '',
        portType:  typeName || '',   // portDef type name for typing-edge lookup & display
        line: 0,
      };

    // ── Occurrence / scenario ────────────────────────────────────────────────
    case 'OccurrenceDefinition':
      return { kind: 'occurrenceDef', name, namespace, body, line: 0 };

    // ── Action / behavior ────────────────────────────────────────────────────
    case 'ActionDefinition':
      // Body includes ActionUsage (actionInst) and Succession (flow) children.
      // Map to behaviorDef so BehaviorView can render it directly.
      return { kind: 'behaviorDef', name, namespace, body, line: 0 };

    case 'ActionUsage':
    case 'PerformActionUsage':
      return { kind: 'actionInst', name, actionType: typeName, line: 0 };

    case 'BehaviorDefinition':
    case 'CalculationDefinition':
    case 'FlowConnectionDefinition':
      return { kind: 'behaviorDef', name, namespace, body, line: 0 };

    // ── State ────────────────────────────────────────────────────────────────
    case 'StateDefinition':
      return { kind: 'stateDef', name, namespace, body, line: 0 };

    case 'StateUsage':
      return { kind: 'stateEntry', name, line: 0 };

    // ── Requirement ──────────────────────────────────────────────────────────
    case 'RequirementDefinition':
      return { kind: 'requirementDef', name, namespace, reqId: '', text: '', priority: '', line: 0 };

    default:
      return null; // unknown / intentionally unmapped type — skip silently
  }
}

/**
 * Convert a SysMLV2ParseResult (containing a ContainmentGraph) to a
 * VisualizerModel that all existing views can render.
 *
 * When graph is absent or empty, returns an empty model so views degrade
 * gracefully rather than throwing.
 */
export function convertGraph(parseResult: SysMLV2ParseResult): VisualizerModel {
  const graph = parseResult.graph;

  const diagnostics: ParseDiagnostic[] = parseResult.diagnostics.map(d => ({
    line:     d.line ?? 0,
    column:   d.column,
    message:  d.message,
    severity: d.severity,
  }));

  if (!graph || graph.nodes.length === 0) {
    return { parserMode: 'sysmlV2OfficialFuture', nodes: [], packages: [], diagnostics };
  }

  // Index nodes and build adjacency from CONTAINMENT edges only.
  // typedBy edges must be excluded here — they go from a usage to a sibling
  // definition and would incorrectly make the definition appear as a child of
  // the usage during tree traversal.
  const nodeIndex  = new Map(graph.nodes.map(n => [n.id, n]));
  const childrenOf = new Map<string, string[]>(graph.nodes.map(n => [n.id, []]));
  for (const e of graph.edges) {
    if (e.type === 'contains') childrenOf.get(e.source)?.push(e.target);
  }

  // Build direct type-label lookup from typedBy edges:
  //   usageNodeId -> definition label (e.g. '0.0.3.0.0.0' -> 'FuelInPort')
  // This is the authoritative type resolution path — the server resolved these
  // cross-references explicitly.  Falls back to findTypeName (containment DFS)
  // when no typedBy edge exists for a node.
  const typedByLabel = new Map<string, string>();
  for (const e of graph.edges) {
    if (e.type !== 'typedBy') continue;
    const defNode = nodeIndex.get(e.target);
    if (defNode && defNode.label !== defNode.type) typedByLabel.set(e.source, defNode.label);
  }
  console.log('[convertGraph] typedBy edges:', graph.edges.filter(e => e.type === 'typedBy').length);
  console.log('[convertGraph] typedByLabel:', Object.fromEntries(
    [...typedByLabel.entries()].map(([k, v]) => {
      const n = nodeIndex.get(k);
      return [`${n?.type ?? '?'}[${n?.label ?? k}]`, v];
    }),
  ));

  // Build port definition flow info:
  //   portDefLabel → { direction, itemType }
  // Used to derive the direction and flowing item type for PortUsage nodes.
  // Source: ItemUsage children of PortDefinition nodes that carry a direction.
  const portDefFlowInfo = new Map<string, { direction: 'in' | 'out' | 'inout'; itemType: string }>();

  function findItemFlowInDef(id: string): { direction: string; itemType: string } | null {
    for (const kid of childrenOf.get(id) ?? []) {
      const g = nodeIndex.get(kid);
      if (!g) continue;
      if (g.type === 'ItemUsage' && g.direction && g.direction !== 'none') {
        // Use typedBy → FeatureTyping DFS → item label as successive fallbacks.
        // For "in item SensorDataEntry;" the label IS the item name even though
        // there's no FeatureTyping node, so the label is always a valid type hint.
        const itemType = (typedByLabel.get(kid) ?? findTypeName(kid)) || g.label;
        return { direction: g.direction, itemType };
      }
      if (TRANSPARENT_TYPES.has(g.type)) {
        const found = findItemFlowInDef(kid);
        if (found) return found;
      }
    }
    return null;
  }

  for (const gn of graph.nodes) {
    if (gn.type !== 'PortDefinition' || gn.label === gn.type) continue;
    const info = findItemFlowInDef(gn.id);
    if (info) {
      portDefFlowInfo.set(gn.label, {
        direction: info.direction as 'in' | 'out' | 'inout',
        itemType:  info.itemType,
      });
    }
  }
  console.log('[convertGraph] portDefFlowInfo:', Object.fromEntries(portDefFlowInfo));

  // PortUsage name → [id, ...] index; used to infer flow item type for connection edges.
  const portUsagesByName = new Map<string, string[]>();
  for (const gn of graph.nodes) {
    if (gn.type === 'PortUsage' && gn.label !== gn.type) {
      const list = portUsagesByName.get(gn.label) ?? [];
      list.push(gn.id);
      portUsagesByName.set(gn.label, list);
    }
  }

  // Roots: nodes with no incoming containment edge.
  const hasParent = new Set(graph.edges.filter(e => e.type === 'contains').map(e => e.target));
  const roots     = graph.nodes.filter(n => !hasParent.has(n.id)).map(n => n.id);

  const packages: PackageDefNode[] = [];
  const nodes: SysMLNode[]         = [];

  /**
   * Collect ordered FeatureChaining labels within the subtree of an
   * EndFeatureMembership node.  For "tank.fuelOut" there are two FeatureChaining
   * nodes whose labels the Java parser resolved to ["tank", "fuelOut"].
   */
  function collectFeatureChainingNames(startId: string): string[] {
    const names: string[] = [];
    function dfs(id: string): void {
      const n = nodeIndex.get(id);
      if (!n) return;
      if (n.type === 'FeatureChaining' && n.label !== n.type) {
        names.push(n.label);
        return; // don't recurse further; chaining nodes are leaves
      }
      for (const kid of childrenOf.get(id) ?? []) dfs(kid);
    }
    dfs(startId);
    return names;
  }

  /**
   * Extract a connection node from a ConnectionUsage by finding its two
   * EndFeatureMembership subtrees and collecting FeatureChaining segment names.
   * Returns null if the endpoints cannot be resolved to two-segment chains.
   */
  function extractConnectionEndpoints(connId: string): Extract<SysMLNode, { kind: 'connection' }> | null {
    const chains: string[][] = [];
    for (const kid of childrenOf.get(connId) ?? []) {
      const n = nodeIndex.get(kid);
      if (!n || n.type !== 'EndFeatureMembership') continue;
      const chain = collectFeatureChainingNames(kid);
      if (chain.length >= 1) chains.push(chain);
    }
    if (chains.length < 2) {
      return null;
    }
    const [a, b] = chains;
    // Prefer explicit ConnectionUsage type; fall back to item flow type from endpoint port def.
    let connType: string | undefined = findTypeName(connId) || undefined;
    if (!connType) {
      const portName = a[a.length - 1];
      const portIds  = portUsagesByName.get(portName);
      if (portIds?.length) {
        const portDefName = typedByLabel.get(portIds[0]);
        if (portDefName) connType = portDefFlowInfo.get(portDefName)?.itemType;
      }
    }
    return {
      kind:     'connection',
      fromPart: a.length >= 2 ? a[0] : '',
      fromPort: a.length >= 2 ? a[1] : a[0],
      toPart:   b.length >= 2 ? b[0] : '',
      toPort:   b.length >= 2 ? b[1] : b[0],
      connType,
      line:     0,
    };
  }

  /**
   * Extract flow endpoints from a FlowUsage by finding its EventOccurrenceUsage children
   * and collecting their FeatureChaining chains (e.g. ["acpdCdd", "callCollectInputData"]).
   */
  function extractFlowEndpoints(flowId: string): Extract<SysMLNode, { kind: 'connection' }> | null {
    const chains: string[][] = [];

    function findEvents(id: string): void {
      for (const kid of childrenOf.get(id) ?? []) {
        const n = nodeIndex.get(kid);
        if (!n) continue;
        if (n.type === 'EventOccurrenceUsage') {
          const chain = collectFeatureChainingNames(kid);
          if (chain.length > 0) chains.push(chain);
        } else if (TRANSPARENT_TYPES.has(n.type)) {
          findEvents(kid);
        }
      }
    }

    findEvents(flowId);
    if (chains.length < 2) return null;

    const [a, b] = chains;
    const flowNode = nodeIndex.get(flowId);
    return {
      kind:     'connection',
      fromPart: a.length >= 2 ? a[0] : '',
      fromPort: a.length >= 2 ? a[1] : a[0],
      toPart:   b.length >= 2 ? b[0] : '',
      toPort:   b.length >= 2 ? b[1] : b[0],
      connType: (flowNode && flowNode.label !== flowNode.type) ? flowNode.label : undefined,
      line:     0,
    };
  }

  /**
   * Extract predecessor and successor action names from a Succession node.
   *
   * A Succession has two endpoint references, each encoded as a ReferenceSubsetting
   * whose label was resolved by the Java parser to the referenced action's name.
   * We DFS through the Succession's containment subtree to find them, stopping at
   * the first ReferenceSubsetting in each branch (no deep recursion past it).
   */
  function extractSuccessionEndpoints(succId: string): Extract<SysMLNode, { kind: 'flow' }> | null {
    const refs: string[] = [];

    function findRef(id: string): void {
      const n = nodeIndex.get(id);
      if (!n) return;
      if ((n.type === 'ReferenceSubsetting' || n.type === 'FeatureChaining') && n.label !== n.type) {
        refs.push(n.label);
        return; // don't recurse further into this endpoint's subtree
      }
      for (const kid of childrenOf.get(id) ?? []) findRef(kid);
    }

    for (const kid of childrenOf.get(succId) ?? []) findRef(kid);

    if (refs.length < 2) return null;
    return { kind: 'flow', from: refs[0], to: refs[1], line: 0 };
  }

  /**
   * Scan the containment subtree rooted at `id` for the first FeatureTyping node
   * whose label was populated with a cross-referenced type name by the Java parser.
   * Only recurses through TRANSPARENT_TYPES wrappers so it never crosses semantic
   * scope boundaries.  Returns '' when no resolved type name is found.
   */
  function findTypeName(id: string): string {
    for (const kid of childrenOf.get(id) ?? []) {
      const g = nodeIndex.get(kid);
      if (!g) continue;
      // FeatureTyping whose label != its type name = the Java parser resolved the
      // cross-referenced type and stored its name in the label field.
      if (g.type === 'FeatureTyping' && g.label !== g.type) return g.label;
      if (TRANSPARENT_TYPES.has(g.type)) {
        const found = findTypeName(kid);
        if (found) return found;
      }
    }
    return '';
  }

  /**
   * Recursively map a list of graph node IDs to SysMLNode body items.
   *
   * TRANSPARENT_TYPES nodes are "see-through": their children are inserted at
   * the current nesting level as though the wrapper did not exist.
   *
   * DEFINITION_TYPES nodes are also pushed to the flat result.nodes[] list so
   * that views which iterate result.nodes can find them.
   *
   * Package nodes are pushed to result.packages[] instead of result.nodes[].
   */
  // parentIsPackage = true when the parent node in the EMF tree is a Package.
  // Propagated through transparent membership wrappers so that package-scope
  // PartUsage nodes (e.g. "part acpdCdd : AcpdCdd;") are promoted from
  // body-only partAlias to partUsage in result.nodes[] and become visible in
  // the Structure view.
  function traverse(ids: string[], namespace: string, parentIsPackage = false): SysMLNode[] {
    const body: SysMLNode[] = [];

    for (const id of ids) {
      const gNode = nodeIndex.get(id);
      if (!gNode) continue;

      const kids = childrenOf.get(id) ?? [];

      if (TRANSPARENT_TYPES.has(gNode.type)) {
        // Fold children into the current scope, preserving package-scope context
        // so that PartUsage inside OwningMembership inside Package is still promoted.
        body.push(...traverse(kids, namespace, parentIsPackage));
        continue;
      }

      // FlowConnectionUsage: extract via EndFeatureMembership+FeatureChaining
      // (same structure as ConnectionUsage; also carries payload type as connType).
      if (gNode.type === 'FlowConnectionUsage' || gNode.type === 'SuccessionItemFlow') {
        const conn = extractConnectionEndpoints(id);
        if (conn) {
          const flowName = gNode.label !== gNode.type ? gNode.label : undefined;
          body.push({ ...conn, connType: flowName ?? conn.connType });
        }
        continue;
      }

      // ConnectionUsage: extract chained endpoints before any child traversal.
      if (gNode.type === 'ConnectionUsage') {
        const conn = extractConnectionEndpoints(id);
        if (conn) body.push(conn);
        // else: skip silently (endpoints not resolvable via FeatureChaining)
        continue;
      }

      // FlowUsage: extract flow endpoints from EventOccurrenceUsage children.
      if (gNode.type === 'FlowUsage') {
        const conn = extractFlowEndpoints(id);
        if (conn) body.push(conn);
        continue;
      }

      // Succession: extract predecessor → successor action names as a flow edge.
      if (gNode.type === 'Succession' || gNode.type === 'SuccessionAsUsage') {
        const succ = extractSuccessionEndpoints(id);
        if (succ) body.push(succ);
        continue;
      }

      // Namespace for children of a Package is the package's own name
      const childNs =
        (gNode.type === 'Package' || gNode.type === 'LibraryPackage') &&
        gNode.label !== gNode.type
          ? gNode.label
          : namespace;

      const isPackage = gNode.type === 'Package' || gNode.type === 'LibraryPackage';
      const bodyItems = traverse(kids, childNs, isPackage);
      // Resolve type name: typedBy edge (authoritative) → fallback to FeatureTyping DFS.
      const typeName  = typedByLabel.get(id) ?? findTypeName(id);
      // For PortUsage, check gNode.direction first (direct declaration), then
      // fall back to looking up flow semantics from the port definition type.
      let portDirection: 'in' | 'out' | 'inout' | undefined;
      let portItemType: string | undefined;
      if (gNode.type === 'PortUsage') {
        const rawDir = gNode.direction;
        if (rawDir === 'in' || rawDir === 'out' || rawDir === 'inout') portDirection = rawDir;
        if (!portDirection && typeName) {
          const flowInfo = portDefFlowInfo.get(typeName);
          if (flowInfo) { portDirection = flowInfo.direction; portItemType = flowInfo.itemType; }
        }
      }
      const node      = toVizNode(gNode, namespace, bodyItems, typeName, portDirection, portItemType);
      if (!node) continue;

      // Promote package-scope PartUsage from partAlias to partUsage so it appears
      // in result.nodes[] and is visible as a standalone box in the Structure view.
      // Nested PartUsage (inside a PartDef) stays as partAlias and remains body-only
      // (it is rendered as a composition instance, not as an independent node).
      let finalNode: typeof node = node;
      if (node.kind === 'partAlias' && gNode.type === 'PartUsage' && parentIsPackage) {
        finalNode = {
          kind: 'partUsage',
          name: node.name,
          namespace,
          type: node.type,
          body: bodyItems,
          line: 0,
        };
      }

      console.log(`[convertGraph] ${gNode.type}[${gNode.label}] → kind:${finalNode.kind}` +
        (typeName ? ` typeName:${typeName}` : ''));

      if (finalNode.kind === 'packageDef') {
        packages.push(finalNode);
        // Package children were already added to nodes[] inside traverse(kids)
      } else {
        body.push(finalNode);
        // Named PartUsage with body (partUsage kind) joins nodes[] alongside
        // definition types so StructureView can render it as a composed block.
        if (DEFINITION_TYPES.has(gNode.type) || finalNode.kind === 'partUsage' || finalNode.kind === 'itemDef') {
          nodes.push(finalNode);
        }
      }
    }

    return body;
  }

  traverse(roots, '', false);

  console.log('[convertGraph] nodes[]:', nodes.map(n => {
    const any = n as Record<string, unknown>;
    return `${n.kind}:${String(any['name'] ?? '?')}${any['type'] ? `:${any['type']}` : ''}`;
  }));

  return { parserMode: 'sysmlV2OfficialFuture', nodes, packages, diagnostics };
}

// ── VisualizerModel conversion (placeholder — kept for reference) ─────────────

/**
 * Placeholder for a future full SysML v2 semantic adapter.
 * Typed `never` so it cannot accidentally be called until properly implemented.
 */
export type OfficialParseOutput = never;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function convert(_output: OfficialParseOutput): VisualizerModel {
  throw new Error(
    `[sysml-viz] Official SysML v2 semantic adapter is not yet implemented. ` +
    `Active parser mode: "${PARSER_MODE}". ` +
    `See docs/OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md for the implementation plan.`,
  );
}

// ── Element kind mapping (reference) ─────────────────────────────────────────
//
//  SysML v2 / KerML concept          →  VizNode kind  (implemented above)
//  ──────────────────────────────────────────────────────────────────────
//  KerML::Package                    →  'packageDef'
//  SysML::PartDefinition             →  'partDef'
//  SysML::AttributeDefinition        →  'attributeDef'
//  SysML::PartUsage                  →  'partAlias'    (type from FeatureTyping cross-ref)
//  SysML::AttributeUsage             →  'attributeUsage' (type from FeatureTyping cross-ref)
//  SysML::PortDefinition             →  'portDef'
//  SysML::PortUsage                  →  'port'         (portType from FeatureTyping cross-ref)
//  SysML::OccurrenceDefinition       →  'occurrenceDef'
//  SysML::ActionDefinition           →  'behaviorDef'  (body: actionInst + flow items)
//  SysML::ActionUsage                →  'actionInst'   (actionType from FeatureTyping cross-ref)
//  SysML::PerformActionUsage         →  'actionInst'   (actionType from FeatureTyping cross-ref)
//  SysML::BehaviorDefinition         →  'behaviorDef'
//  SysML::StateDefinition            →  'stateDef'
//  SysML::StateUsage                 →  'stateEntry'
//  SysML::RequirementDefinition      →  'requirementDef'
//  SysML::ItemDefinition             →  'partDef'
