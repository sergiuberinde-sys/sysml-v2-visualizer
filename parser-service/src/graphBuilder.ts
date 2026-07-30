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
  isConjugated?: boolean;
  /** ASIL safety level (e.g. 'ASIL_D', 'QM') from an applied `@ASIL` metadata usage. */
  asil?: string;
  /** Realization kind (e.g. 'HW', 'SW') from an applied `@Realization` metadata usage. */
  realization?: string;
  startLine?: number;
  endLine?: number;
  /**
   * True when this element is declared in the primary (currently-open) file rather
   * than a context file. Set by buildGraphWithContext. Undefined ≡ primary (used by
   * single-model callers that pass no context). Views depict only primary-owned
   * elements while keeping context nodes for cross-file resolution.
   */
  fromPrimary?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'typedBy' | 'connection' | 'message' | 'specialization' | 'subsetting' | 'interconnect' | 'redefinition';
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

  // ConjugatedPortDefinition: synthesized sibling of a PortDefinition.
  // Map conjDefId → owning PortDefinition id, and conjLabel → conjDefId.
  const conjToPortDef = new Map<string, string>(); // conjDefId → portDefId
  const conjDefByName = new Map<string, string>(); // label → conjDefId
  for (const n of nodes) {
    if (n.type !== 'ConjugatedPortDefinition') continue;
    conjDefByName.set(n.label, n.id);
    // Walk up through wrappers to find the enclosing PortDefinition.
    let pid = parentOf.get(n.id);
    while (pid !== undefined) {
      const pn = nodeById.get(pid);
      if (!pn) break;
      if (pn.type === 'PortDefinition') { conjToPortDef.set(n.id, pid); break; }
      if (!MEMBERSHIP_WRAPPERS.has(pn.type)) break;
      pid = parentOf.get(pid);
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
    if (n.type !== 'FeatureTyping' && n.type !== 'ConjugatedPortTyping') continue;
    if (n.label === n.type) continue;

    const usageId = findUsageAncestor(n.id);
    if (!usageId) continue;

    // ConjugatedPortTyping: the node label is the BASE PortDefinition name (extracted
    // from ConjugatedPortTyping.portDefinition by the Java wrapper).  Always emit a
    // typedBy edge to the base def and mark the usage as conjugated so resolvePortDir
    // can flip the direction from the PortDef's payload direction.
    if (n.type === 'ConjugatedPortTyping') {
      const defId = defByName.get(n.label);
      if (defId) {
        const edgeId = `${usageId}->typedBy->${defId}`;
        if (!seenTypedBy.has(edgeId)) {
          seenTypedBy.add(edgeId);
          edges.push({ id: edgeId, source: usageId, target: defId, type: 'typedBy' });
        }
      }
      const usageNode = nodeById.get(usageId);
      if (usageNode) usageNode.isConjugated = true;
      continue;
    }

    // FeatureTyping: check for ConjugatedPortDefinition first (typed by ~SomeDef via name match).
    const conjId = conjDefByName.get(n.label);
    if (conjId !== undefined) {
      const basePortDefId = conjToPortDef.get(conjId);
      if (basePortDefId) {
        const edgeId = `${usageId}->typedBy->${basePortDefId}`;
        if (!seenTypedBy.has(edgeId)) {
          seenTypedBy.add(edgeId);
          edges.push({ id: edgeId, source: usageId, target: basePortDefId, type: 'typedBy' });
        }
        const usageNode = nodeById.get(usageId);
        if (usageNode) usageNode.isConjugated = true;
      }
      continue;
    }

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

  // ── Metadata annotations (@ASIL, @Realization) ──────────────────────────────
  // `@Meta { feat = Kind::X }` parses to a MetadataUsage typed by the metadata def
  // ('ASIL'/'Realization') whose feature value references an enum literal (a named
  // Membership in the subtree). Attach the value to the annotated host so views can
  // render a badge — SysML v2 shows metadata as a textual annotation on the element.
  //
  // Host resolution: a metadata usage written inside an element's body annotates
  // that element (its owner). Prefix metadata (`@Meta {…} part X`) is stored by the
  // parser as a sibling immediately before X, so when the metadata's next sibling is
  // a part/action it is treated as a prefix and attached to that following element.
  // (Ports/endpoints are not prefix targets here, so body annotations on
  // PartDefinition/ActionUsage/FlowUsage keep resolving to their owner.)
  const PREFIX_TARGET_TYPES = new Set([
    'PartUsage', 'PartDefinition', 'ActionUsage', 'PerformActionUsage', 'ActionDefinition',
  ]);
  const descendToSemantic = (id: string): GraphNode | undefined => {
    let cur: GraphNode | undefined = nodeById.get(id);
    while (cur && MEMBERSHIP_WRAPPERS.has(cur.type)) {
      const kids = childrenOf.get(cur.id) ?? [];
      cur = kids.length ? nodeById.get(kids[0]) : undefined;
    }
    return cur;
  };
  for (const n of nodes) {
    if (n.type !== 'MetadataUsage') continue;
    const kids = childrenOf.get(n.id) ?? [];
    const metaDef = kids.map(id => nodeById.get(id)).find(k => k?.type === 'FeatureTyping')?.label;
    if (metaDef !== 'ASIL' && metaDef !== 'Realization') continue;
    // Descend to the first named Membership — the referenced enum literal (the value).
    let value: string | undefined;
    const findValue = (id: string): void => {
      for (const cid of childrenOf.get(id) ?? []) {
        const c = nodeById.get(cid);
        if (!c) continue;
        if (c.type === 'Membership' && c.label && c.label !== c.type) { value = c.label; return; }
        findValue(cid);
        if (value) return;
      }
    };
    findValue(n.id);
    if (!value) continue;
    // In multi-file projects the enum literal resolves to a qualified name
    // (e.g. 'ASILLevel::ASIL_D'); keep only the literal (last '::' segment).
    value = value.split('::').pop() ?? value;
    // Resolve the host: climb to the owner (first non-wrapper ancestor), tracking the
    // wrapper that is the owner's direct child; if the next sibling resolves to a
    // part/action, this is prefix metadata → attach there instead of the owner.
    let host: GraphNode | undefined;
    let childOfOwner = n.id;
    let pid = parentOf.get(n.id);
    while (pid !== undefined) {
      const p = nodeById.get(pid);
      if (!p) break;
      if (!MEMBERSHIP_WRAPPERS.has(p.type)) {
        host = p;
        const sibs = childrenOf.get(p.id) ?? [];
        const idx  = sibs.indexOf(childOfOwner);
        if (idx >= 0 && idx + 1 < sibs.length) {
          const next = descendToSemantic(sibs[idx + 1]);
          if (next && PREFIX_TARGET_TYPES.has(next.type)) host = next;
        }
        break;
      }
      childOfOwner = pid;
      pid = parentOf.get(pid);
    }
    if (!host) continue;
    if (metaDef === 'ASIL')        host.asil = value;
    else if (metaDef === 'Realization') host.realization = value;
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

  // PartUsage name→[id] index: used as a fallback when port nodes are absent
  // (e.g. cross-file ports not present in a Phase 1 single-file parse).
  const partsByName = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.type === 'PartUsage' && n.label !== n.type) {
      const list = partsByName.get(n.label) ?? [];
      list.push(n.id);
      partsByName.set(n.label, list);
    }
  }

  // Synthetic PortUsage nodes for cross-file ports absent from the Phase 1 model.
  // IDs use "{partId}.{portName}" dot-notation: the webview's buildChildrenMap
  // derives parent-child purely from ID prefixes, so this is enough to place them
  // as children of the PartUsage and have the wiring view render port squares.
  const synthPortIds = new Map<string, string>(); // "{partId}:{portName}" → portId
  function ensureSynthPort(partId: string, portName: string): string {
    const key = `${partId}:${portName}`;
    let portId = synthPortIds.get(key);
    if (!portId) {
      portId = `${partId}.${portName}`;
      nodes.push({ id: portId, label: portName, type: 'PortUsage' });
      synthPortIds.set(key, portId);
    }
    return portId;
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

    // DFS fallback for single-step direct references (boundary ports).
    // These produce a ReferenceSubsetting node instead of FeatureChaining, and it
    // sits at least two levels deep under EndFeatureMembership (behind an anonymous
    // Feature/ReferenceUsage wrapper), so a shallow direct-children search misses it.
    function findRefSubsettingLabel(startId: string): string | null {
      for (const cid of childrenOf.get(startId) ?? []) {
        const cn = nodeById.get(cid);
        if (!cn) continue;
        if (cn.type === 'ReferenceSubsetting' && cn.label !== cn.type) return cn.label;
        const found = findRefSubsettingLabel(cid);
        if (found !== null) return found;
      }
      return null;
    }

    for (const kid of childrenOf.get(connId) ?? []) {
      const n = nodeById.get(kid);
      if (!n || n.type !== 'EndFeatureMembership') continue;
      let chain = collectFeatureChainingNames(kid);
      if (chain.length === 0) {
        const name = findRefSubsettingLabel(kid);
        if (name) chain = [name];
      }
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

  // Snapshot before iterating: `for…of` on a live array visits elements pushed
  // during the loop.  The old code pushed fallback nodes with type 'ConnectionUsage',
  // which caused the loop to process them again, push more fallbacks, and so on —
  // an unbounded loop that exhausted the V8 heap (exit code 5 / OOM crash).
  // The fallback nodes themselves are unnecessary: the original ConnectionUsage node
  // is already in the containment tree and the webview's extractConnectionEndpoints
  // walks its EndFeatureMembership→FeatureChaining children to get fromPart/fromPort
  // regardless of whether the referenced port nodes exist in the model.
  for (const n of nodes.filter(n => n.type === 'ConnectionUsage')) {
    const chains = collectEndpointChains(n.id);
    if (chains.length < 2) continue;

    const [chainA, chainB] = chains;
    let sourceId = resolveChain(chainA);
    let targetId = resolveChain(chainB);

    // When port nodes are absent (cross-file imports not in Phase 1 model),
    // synthesize a placeholder PortUsage as a child of the PartUsage so the
    // wiring view renders a proper port square on the part box boundary.
    if (!sourceId && chainA.length >= 2) {
      const partId = partsByName.get(chainA[0])?.[0];
      if (partId) sourceId = ensureSynthPort(partId, chainA[chainA.length - 1]);
    }
    if (!targetId && chainB.length >= 2) {
      const partId = partsByName.get(chainB[0])?.[0];
      if (partId) targetId = ensureSynthPort(partId, chainB[chainB.length - 1]);
    }

    if (!sourceId || !targetId || sourceId === targetId) continue;

    const edgeId = `connection:${sourceId}:${targetId}`;
    if (seenConn.has(edgeId)) continue;
    seenConn.add(edgeId);

    edges.push({ id: edgeId, source: sourceId, target: targetId, type: 'connection' });
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

  // Direct supertypes per definition (`part def A :> B` → A has a Superclassing/Subclassification
  // child labeled B). Needed so resolveFlowChain can match a port INHERITED from a supertype —
  // e.g. `safetyBoundary : DomainSafetyBoundaryHw` whose ports are declared on the supertype
  // DomainContainmentHw. Built here (Pass 6 emits the edges later, but flow resolution runs first).
  const directSupersOf = new Map<string, string[]>();
  const nearestTypedDef = (startId: string): string | null => {
    let id: string | undefined = parentOf.get(startId);
    while (id !== undefined) {
      const p = nodeById.get(id);
      if (!p) return null;
      if (TYPED_DEF_TYPES.has(p.type)) return id;
      if (!MEMBERSHIP_WRAPPERS.has(p.type)) return null;
      id = parentOf.get(id);
    }
    return null;
  };
  for (const n of nodes) {
    if (n.type !== 'Superclassing' && n.type !== 'Subclassification') continue;
    if (n.label === n.type) continue;
    const specificId = nearestTypedDef(n.id);
    const generalId  = defByName.get(n.label);
    if (!specificId || !generalId || generalId === specificId) continue;
    const l = directSupersOf.get(specificId) ?? [];
    l.push(generalId);
    directSupersOf.set(specificId, l);
  }
  // Transitive supertype closure (includes the def itself), memoised.
  const superClosureCache = new Map<string, Set<string>>();
  const superClosure = (defId: string): Set<string> => {
    const cached = superClosureCache.get(defId);
    if (cached) return cached;
    const out = new Set<string>([defId]);
    const stack = [defId];
    while (stack.length) {
      const d = stack.pop()!;
      for (const s of directSupersOf.get(d) ?? []) if (!out.has(s)) { out.add(s); stack.push(s); }
    }
    superClosureCache.set(defId, out);
    return out;
  };

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
  // scopeDefId: when provided, 1-element chains prefer the candidate that is a
  // direct semantic child of that PartDef (boundary-port disambiguation).
  function resolveFlowChain(chain: string[], scopeDefId?: string | null): string | null {
    if (chain.length === 0) return null;
    const portName = chain[chain.length - 1];
    const candidates = portUsagesByName.get(portName);
    if (!candidates?.length) return null;

    // The specific PART USAGE this endpoint refers to. When the part name is ambiguous across
    // scopes (e.g. every domain owns a `controller`), prefer the usage that lives in the flow's
    // OWN scope — otherwise `controller.tlfSpiRequest` inside HvmSafetyDomain would resolve
    // against DrivingSafetyDomain's controller (declared earlier) and pick a port on the WRONG
    // def, so the view can't map it and the whole edge silently vanishes.
    const chainPartId = chain.length >= 2
      ? (partUsagesByName.get(chain[0]) ?? []).find(pid => findEnclosingPartDef(pid) === scopeDefId)
        ?? (partUsagesByName.get(chain[0]) ?? [])[0]
      : undefined;

    // The def that OWNS the port. Walk the chain of nested parts from the top-level part down:
    // chain[0] is the top part, chain[1..-2] are nested parts, chain[-1] is the port. For a
    // plain `part.port` (length 2) this loop is a no-op and it stays the top part's def; for a
    // deep `part.subpart[.…].port` it descends into the nested part that actually owns the port,
    // so the candidate is disambiguated correctly (right direction/def), not last-writer-wins.
    let portDefScope = chainPartId ? typedByBySource.get(chainPartId) : undefined;
    for (let i = 1; i < chain.length - 1 && portDefScope; i++) {
      const closure = superClosure(portDefScope);
      const nested = (partUsagesByName.get(chain[i]) ?? []).find(pid => {
        let id: string | undefined = parentOf.get(pid);
        while (id !== undefined) {
          if (closure.has(id)) return true;
          const n = nodeById.get(id);
          if (!n || !MEMBERSHIP_WRAPPERS.has(n.type)) return false;
          id = parentOf.get(id);
        }
        return false;
      });
      portDefScope = nested ? typedByBySource.get(nested) : undefined;
    }

    // Resolve the port NODE id, choosing the candidate declared on the port's OWNING def
    // (or any of its supertypes — inherited ports). A single shared candidate is fine; the
    // `part.` qualification below keeps two usages of the same def distinct.
    let portId = candidates[0];
    if (candidates.length > 1) {
      let matched: string | undefined;
      const defId = portDefScope;
      if (defId) {
        const defAndSupers = superClosure(defId);
        for (const pid of candidates) {
          let id: string | undefined = parentOf.get(pid);
          while (id !== undefined) {
            if (defAndSupers.has(id)) { matched = pid; break; }
            const n = nodeById.get(id);
            if (!n || !MEMBERSHIP_WRAPPERS.has(n.type)) break;
            id = parentOf.get(id);
          }
          if (matched) break;
        }
      }
      // 1-element chain with ambiguous name: prefer the candidate that lives directly
      // inside the enclosing scope PartDef (boundary ports that share a name with a
      // same-named port on a sub-part, e.g. BatterySupply_In on scope + sub-PartDef).
      if (!matched && scopeDefId) {
        for (const pid of candidates) {
          let id: string | undefined = parentOf.get(pid);
          while (id !== undefined) {
            if (id === scopeDefId) { matched = pid; break; }
            const n = nodeById.get(id);
            if (!n || !MEMBERSHIP_WRAPPERS.has(n.type)) break;
            id = parentOf.get(id);
          }
          if (matched) break;
        }
      }
      portId = matched ?? candidates[0];
    }

    // Qualify a `part.port` endpoint with its specific PART USAGE (`${partUsageId}::${portId}`)
    // so two usages that inherit the SAME PartDefinition port stay distinct — e.g. both
    // drivingDomain and hvmDomain inherit SafetyDomain.domainSupplyInput, and without this
    // both `drivingDomain.domainSupplyInput` and `hvmDomain.domainSupplyInput` would collapse
    // onto the one shared def port. A 1-element (boundary) chain has no part and stays bare.
    if (chain.length >= 2) {
      const partId = chainPartId;
      // Anchor the endpoint to the TOP-LEVEL part (chain[0]) and keep the resolved port id.
      // For a plain `part.port` the port is a direct/boundary port of that part. For a deep
      // `part.subpart[.…].port` the port lives inside a NESTED part, so it isn't a direct port
      // of the top-level part — the interconnect view synthesises a delegated boundary port for
      // it on that part's box (so the wire lands on a real port and routes around obstacles)
      // instead of dropping the edge for want of a rendered handle. (chainPartId = chain[0].)
      if (partId) return `${partId}::${portId}`;
    }
    return portId;
  }

  // Walk up through membership wrappers to find the nearest enclosing PartDefinition.
  function findEnclosingPartDef(startId: string): string | null {
    let id = parentOf.get(startId);
    while (id !== undefined) {
      const n = nodeById.get(id);
      if (!n) return null;
      if (n.type === 'PartDefinition') return id;
      if (MEMBERSHIP_WRAPPERS.has(n.type)) { id = parentOf.get(id); continue; }
      return null;
    }
    return null;
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
        const partChain: string[] = [];
        let portName: string | null = null;
        for (const kid3 of childrenOf.get(kid2) ?? []) {
          const n3 = nodeById.get(kid3);
          if (!n3) continue;
          if (n3.type === 'ReferenceSubsetting') {
            if (n3.label !== n3.type) {
              // Shallow endpoint `part.port`: the part name is on the ReferenceSubsetting.
              partChain.push(n3.label);
            } else {
              // Deep endpoint `part.subpart[.subpart…].port`: the parser leaves the
              // ReferenceSubsetting generic and carries the part PATH as a Feature whose
              // FeatureChaining children are the successive part names (outermost first).
              for (const kid4 of childrenOf.get(kid3) ?? []) {
                const n4 = nodeById.get(kid4);
                if (n4?.type !== 'Feature') continue;
                for (const kid5 of childrenOf.get(kid4) ?? []) {
                  const n5 = nodeById.get(kid5);
                  if (n5?.type === 'FeatureChaining' && n5.label !== n5.type) partChain.push(n5.label);
                }
              }
            }
          } else if (n3.type === 'FeatureMembership') {
            for (const kid4 of childrenOf.get(kid3) ?? []) {
              const n4 = nodeById.get(kid4);
              if (n4?.type !== 'ReferenceUsage') continue;
              if (n4.label !== n4.type) {
                portName = n4.label;
              } else {
                // Unresolved port (e.g. inherited from a cross-file supertype): the parser
                // leaves the ReferenceUsage generic and carries the actual name on a
                // Redefinition/Subsetting child. Recover it so the endpoint isn't dropped.
                for (const kid5 of childrenOf.get(kid4) ?? []) {
                  const n5 = nodeById.get(kid5);
                  if (n5 && (n5.type === 'Redefinition' || n5.type === 'Subsetting') && n5.label !== n5.type) {
                    portName = n5.label;
                    break;
                  }
                }
              }
            }
          }
        }
        const chain: string[] = [...partChain];
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
    // scopeDefId disambiguates an unqualified boundary-port name (a 1-element chain,
    // e.g. `flow from pmicFault to …`) to the port declared on THIS flow's own PartDef,
    // not a same-named port on an enclosing def earlier in document order.
    const scopeDefId = findEnclosingPartDef(n.id);
    const srcId = resolveFlowChain(chainA, scopeDefId);
    const tgtId = resolveFlowChain(chainB, scopeDefId);

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
    // See Pass 4: resolve unqualified boundary-port names against THIS flow's own PartDef.
    const scopeDefId = findEnclosingPartDef(n.id);
    const srcId = resolveFlowChain(chainA, scopeDefId);
    const tgtId = resolveFlowChain(chainB, scopeDefId);

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

  // ── InterfaceUsage connection edges ──────────────────────────────────────────
  //
  // 'interface X connect A.portA to B.portB' produces InterfaceUsage nodes with the
  // same EndFeatureMembership+FeatureChaining structure as ConnectionUsage. Pass 3
  // only processes 'ConnectionUsage' (exact type match) so InterfaceUsage was silently
  // skipped. Use resolveFlowChain here (same as Pass 5) for type-aware disambiguation
  // of port names that appear in multiple PartDefs. No label → treated as structural.

  const seenIface = new Set<string>();
  for (const n of nodes) {
    if (n.type !== 'InterfaceUsage') continue;

    const chains = collectEndpointChains(n.id);
    if (chains.length < 2) continue;

    const [chainA, chainB] = chains;
    // Pass the enclosing PartDef so 1-element boundary-port chains are resolved
    // to the scope's own port rather than a same-named port in a sub-PartDef.
    const scopeDefId = findEnclosingPartDef(n.id);
    const srcId = resolveFlowChain(chainA, scopeDefId);
    const tgtId = resolveFlowChain(chainB, scopeDefId);
    if (!srcId || !tgtId || srcId === tgtId) continue;

    const edgeId = `iface:${srcId}:${tgtId}`;
    if (seenIface.has(edgeId)) continue;
    seenIface.add(edgeId);

    edges.push({ id: edgeId, source: srcId, target: tgtId, type: 'interconnect' });
  }

  // ── BindingConnectorAsUsage (delegation) edges ───────────────────────────────
  //
  // `bind boundaryPort = part.internalPort;` produces a BindingConnectorAsUsage
  // with the SAME EndFeatureMembership structure as ConnectionUsage/InterfaceUsage:
  // one end is a single-segment ReferenceSubsetting (the scope's own boundary port),
  // the other a FeatureChaining path into a sub-part.  These are delegation
  // connectors, so we emit them as 'interconnect' edges — identical handling to
  // `interface … connect` (direction inference, boundary-side placement, etc.).
  const seenBind = new Set<string>();
  for (const n of nodes) {
    if (n.type !== 'BindingConnectorAsUsage') continue;

    const chains = collectEndpointChains(n.id);
    if (chains.length < 2) continue;

    const [chainA, chainB] = chains;
    // Pass the enclosing PartDef so the 1-element boundary-port end resolves to the
    // scope's own port rather than a same-named port on a sub-PartDef.
    const scopeDefId = findEnclosingPartDef(n.id);
    const srcId = resolveFlowChain(chainA, scopeDefId);
    const tgtId = resolveFlowChain(chainB, scopeDefId);
    if (!srcId || !tgtId || srcId === tgtId) continue;

    const edgeId = `bind:${srcId}:${tgtId}`;
    if (seenBind.has(edgeId)) continue;
    seenBind.add(edgeId);

    edges.push({ id: edgeId, source: srcId, target: tgtId, type: 'interconnect' });
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
    // The pilot API emits `Subclassification` for `part def A :> B`; older builds saw
    // `Superclassing`. Accept both — the Java parser sets the label to the supertype name.
    if (n.type !== 'Superclassing' && n.type !== 'Subclassification') continue;
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

  // All named usage nodes: for subsetting / redefinition target resolution.
  const allUsagesByName = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.label === n.type || !n.label) continue;
    if (TYPED_USAGE_TYPES.has(n.type)) {
      const list = allUsagesByName.get(n.label) ?? [];
      list.push(n.id);
      allUsagesByName.set(n.label, list);
    }
  }

  const seenSub = new Set<string>();
  for (const n of nodes) {
    if (n.type !== 'Subsetting') continue;
    if (n.label === n.type) continue;

    const subId = findUsageAncestor(n.id);
    if (!subId) continue;

    // Prefer PartUsage; fall back to any named usage.
    const superCandidates = partUsagesByName.get(n.label) ?? allUsagesByName.get(n.label);
    if (!superCandidates?.length) continue;
    const superId = superCandidates[0];
    if (superId === subId) continue;

    const edgeId = `${subId}->subsets->${superId}`;
    if (seenSub.has(edgeId)) continue;
    seenSub.add(edgeId);

    edges.push({ id: edgeId, source: subId, target: superId, type: 'subsetting' });
  }

  // ── Pass 7.5: redefinition edges (Redefinition between features) ──────────────
  //
  // `feature redefines other` creates a Redefinition node (EMF subtype of Subsetting).
  // We emit a 'redefinition' edge so the validator can distinguish it from subsetting.

  const seenRedef = new Set<string>();
  for (const n of nodes) {
    if (n.type !== 'Redefinition') continue;
    if (n.label === n.type) continue;

    const redefId = findUsageAncestor(n.id);
    if (!redefId) continue;

    const targetCandidates = allUsagesByName.get(n.label) ?? partUsagesByName.get(n.label);
    if (!targetCandidates?.length) continue;
    const targetId = targetCandidates[0];
    if (targetId === redefId) continue;

    const edgeId = `${redefId}->redefines->${targetId}`;
    if (seenRedef.has(edgeId)) continue;
    seenRedef.add(edgeId);

    edges.push({ id: edgeId, source: redefId, target: targetId, type: 'redefinition' });
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

// ── Context model enrichment ───────────────────────────────────────────────────

/**
 * Annotates synthetic PortUsage nodes in `graph` that have no direction by
 * resolving their direction from the context models (imported files).
 * Called after buildGraph() when the parse result includes contextModels.
 */
/**
 * Build a graph from the primary model unioned with all context-file models.
 *
 * In a multi-file project the primary file's `model` contains only its own
 * content; the part/port *definitions* it references (and the internal endpoints
 * of its `connect`/`bind` statements) live in other files. Building from just the
 * primary leaves typedBy edges and connection endpoints unresolved — e.g. the
 * cluster assembly renders as boxes with no ports and no wires. Concatenating the
 * context roots gives every referenced definition to the resolver; buildGraph
 * indexes each root by position, so ids never collide. For a self-contained file
 * (no context) this is identical to `buildGraph(model)`.
 */
export function buildGraphWithContext(
  model: ModelNode[],
  contextModels: ModelNode[][] = [],
): ContainmentGraph {
  if (!contextModels.length) {
    // Self-contained file: every element is primary-owned.
    const graph = buildGraph(model);
    for (const n of graph.nodes) n.fromPrimary = true;
    return graph;
  }
  // buildGraph indexes roots by position and every node id begins with its root
  // index. The primary model is passed first, so a node is primary-owned iff its
  // root index is below the primary root count.
  const primaryCount = model.length;
  const graph = buildGraph([...model, ...contextModels.flat()]);
  for (const n of graph.nodes) {
    const rootIdx = Number(n.id.split('.', 1)[0]);
    n.fromPrimary = Number.isFinite(rootIdx) && rootIdx < primaryCount;
  }
  return graph;
}

export function enrichWithContextModels(
  graph: ContainmentGraph,
  contextModels: ModelNode[][],
): void {
  if (!contextModels?.length) return;

  const portDirIndex = new Map<string, string>();
  for (const ctxModel of contextModels) {
    const ctxGraph = buildGraph(ctxModel);
    const ctxNodeById = new Map(ctxGraph.nodes.map(n => [n.id, n]));
    const ctxTypedBy = new Map<string, string>();
    const ctxChildrenOf = new Map<string, string[]>();
    for (const n of ctxGraph.nodes) ctxChildrenOf.set(n.id, []);
    for (const e of ctxGraph.edges) {
      if (e.type === 'typedBy') ctxTypedBy.set(e.source, e.target);
      if (e.type === 'contains') ctxChildrenOf.get(e.source)?.push(e.target);
    }
    for (const n of ctxGraph.nodes) {
      if (n.type !== 'PortUsage' || n.label === n.type) continue;
      if (n.direction) { portDirIndex.set(n.label, n.direction); continue; }
      const defId = ctxTypedBy.get(n.id);
      if (!defId) continue;
      const defNode = ctxNodeById.get(defId);
      if (!defNode || defNode.type !== 'PortDefinition') continue;
      const dir = resolvePortDefDirection(defId, ctxChildrenOf, ctxNodeById);
      if (dir) portDirIndex.set(n.label, dir);
    }
  }

  for (const n of graph.nodes) {
    if (n.type === 'PortUsage' && !n.direction && n.label !== n.type) {
      const dir = portDirIndex.get(n.label);
      if (dir) n.direction = dir;
    }
  }
}

function resolvePortDefDirection(
  defId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): string {
  const dirs: string[] = [];
  function collect(id: string): void {
    for (const kid of childrenOf.get(id) ?? []) {
      const n = nodeById.get(kid);
      if (!n) continue;
      if (n.direction) dirs.push(n.direction);
      if (MEMBERSHIP_WRAPPERS.has(n.type)) collect(kid);
    }
  }
  collect(defId);
  if (dirs.length === 0) return '';
  if (dirs.length === 1) return dirs[0];
  const set = new Set(dirs);
  if ((set.has('in') && set.has('out')) || set.has('inout')) return 'inout';
  if (set.has('out')) return 'out';
  if (set.has('in')) return 'in';
  return '';
}
