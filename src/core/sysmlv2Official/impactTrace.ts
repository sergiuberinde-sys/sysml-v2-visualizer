/**
 * Impact-trace utility for official SysML v2 parse results.
 *
 * Computes only relationships that are explicit in the official EMF model:
 *   - EMF containment (ownedElements, ownerChain)
 *   - FeatureTyping cross-references (usedAsTypeBy)
 *   - ConnectionUsage endpoints (connectedElements)
 *   - ActionDefinition → ActionUsage ownership via BehaviorData (relatedBehaviors, relatedFlows)
 *
 * No call relationships, runtime execution ownership, or dependency strength
 * are inferred.
 */

import type { ContainmentGraph, GraphNode } from './ContainmentGraph';
import type { BehaviorData } from './SysMLV2ParseResult';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ImpactedElement {
  label: string;
  type: string;
  /** Element-type-specific context (e.g. {behavior: 'Controller::Startup'} for ActionUsage). */
  extra?: Record<string, string>;
}

export interface ImpactedFlow {
  source: string;
  target: string;
  flowType: 'succession' | 'transition' | 'itemFlow';
  guard?: string;
  /** Qualified name of the ActionDefinition this flow belongs to — used for click navigation. */
  behaviorContext?: string;
}

export interface ImpactedBehavior {
  name: string;
  /** 'Owner::Name' when nested in a structural definition, otherwise == name */
  qualifiedName: string;
}

export interface ImpactTrace {
  /** Direct meaningful children in EMF containment (transparent wrappers skipped) */
  ownedElements: ImpactedElement[];
  /** PortUsage/PortDefinition children (subset of ownedElements) */
  ownedPorts: ImpactedElement[];
  /** ActionUsage children with behavior context extra (populated for ActionDefinition selections) */
  ownedActions: ImpactedElement[];
  /** Ancestor chain to package root (transparent wrappers skipped), innermost first */
  ownerChain: ImpactedElement[];
  /** Usages typed by this definition (typedBy edges pointing to this node) */
  usedAsTypeBy: ImpactedElement[];
  /** Elements connected to this port/part via resolved ConnectionUsage endpoints */
  connectedElements: ImpactedElement[];
  /** ActionDefinitions owned by or representing this element */
  relatedBehaviors: ImpactedBehavior[];
  /** Succession/transition flows whose source or target belongs to this element's actions */
  relatedFlows: ImpactedFlow[];
  /** Flows where this actionInst is the target (populated for actionInst selections) */
  incomingFlows: ImpactedFlow[];
  /** Flows where this actionInst is the source (populated for actionInst selections) */
  outgoingFlows: ImpactedFlow[];
  /** ActionDefinition this actionInst is typed by (populated for actionInst selections via typedBy edge) */
  typedByDef?: ImpactedElement;
  /** Named RequirementUsage children with their typed definition (populated for part/instance selections) */
  ownedRequirements: ImpactedElement[];
  /**
   * Enum-typed attribute usages on the selected element.
   * Each entry carries name (e.g. 'asil'), typeName (e.g. 'ASIL'), and optional value (e.g. 'B').
   * Extracted from AttributeUsage children via FeatureTyping + FeatureValue → Membership.
   */
  ownedAttributes: AttributeEntry[];
}

export interface AttributeEntry {
  name: string;
  typeName?: string;
  value?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// EMF wrapper types that are transparent in containment traversal.
const WRAPPER_TYPES = new Set([
  'OwningMembership', 'FeatureMembership', 'ParameterMembership',
  'ReturnParameterMembership', 'EndFeatureMembership', 'TransitionFeatureMembership',
  'VariantMembership', 'ObjectiveMembership', 'ActorMembership',
  'StakeholderMembership', 'ExposeMembership', 'AliasMembership',
  'ImportMembership', 'MembershipExpose', 'NamespaceExpose',
  'ViewRenderingMembership', 'FeatureTyping', 'Subclassification',
  'Subsetting', 'ReferenceSubsetting', 'FeatureChaining', 'Membership',
]);

// Preferred EMF types per SelectionState.type — used to narrow label-based lookups.
const SELECTION_TO_EMF: Record<string, string[]> = {
  part:       ['PartDefinition', 'PartUsage'],
  port:       ['PortUsage', 'PortDefinition'],
  behavior:   ['ActionDefinition'],
  actionInst: ['ActionUsage', 'PerformActionUsage'],
  interface:  ['InterfaceDefinition'],
  occurrence: ['OccurrenceDefinition'],
  instance:   ['PartUsage'],
  connection: ['ConnectionUsage', 'ConnectionDefinition'],
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Returns true for transparent EMF wrapper nodes. */
function isWrapper(type: string): boolean {
  return WRAPPER_TYPES.has(type);
}

/**
 * DFS through containment, recursing into wrappers and collecting the first
 * non-wrapper, named descendant at each branch.
 */
function directMeaningfulChildren(
  nodeId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): GraphNode[] {
  const result: GraphNode[] = [];
  function collect(id: string): void {
    for (const childId of childrenOf.get(id) ?? []) {
      const child = nodeById.get(childId);
      if (!child) continue;
      if (isWrapper(child.type)) {
        collect(childId);
      } else if (child.label !== child.type) {
        // Named, non-wrapper → meaningful
        result.push(child);
      }
    }
  }
  collect(nodeId);
  return result;
}

/** Walk up parentOf, skipping wrappers, collecting named ancestors (innermost first). */
function ownerChainOf(
  nodeId: string,
  parentOf: Map<string, string>,
  nodeById: Map<string, GraphNode>,
): GraphNode[] {
  const chain: GraphNode[] = [];
  let id = parentOf.get(nodeId);
  while (id !== undefined) {
    const n = nodeById.get(id);
    if (!n) break;
    if (!isWrapper(n.type) && n.label !== n.type) chain.push(n);
    id = parentOf.get(id);
  }
  return chain;
}

// ── Attribute value extraction ────────────────────────────────────────────────

/**
 * DFS from startId through the graph to find the first Membership node whose
 * label differs from its type (i.e., a resolved cross-reference name).
 * Used to follow: FeatureValue → FeatureReferenceExpression → Membership.name
 */
function findMembershipValue(
  startId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): string | undefined {
  for (const childId of childrenOf.get(startId) ?? []) {
    const child = nodeById.get(childId);
    if (!child) continue;
    if (child.type === 'Membership' && child.label !== child.type) return child.label;
    const found = findMembershipValue(childId, childrenOf, nodeById);
    if (found) return found;
  }
  return undefined;
}

/**
 * Extract the type name and optional enum value from an AttributeUsage graph node.
 * typeName comes from the FeatureTyping child; value from FeatureValue → Membership.
 */
function extractAttributeInfo(
  nodeId: string,
  childrenOf: Map<string, string[]>,
  nodeById: Map<string, GraphNode>,
): { typeName?: string; value?: string } {
  let typeName: string | undefined;
  let value: string | undefined;

  for (const childId of childrenOf.get(nodeId) ?? []) {
    const child = nodeById.get(childId);
    if (!child) continue;
    if (child.type === 'FeatureTyping' && child.label !== child.type) {
      typeName = child.label;
    }
    if (child.type === 'FeatureValue') {
      value = findMembershipValue(childId, childrenOf, nodeById);
    }
  }

  return { typeName, value };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute the impact trace for a selected element.
 *
 * @param graph         ContainmentGraph from the parser-service response.
 * @param behavior      BehaviorData from the parser-service response.
 * @param selectedName  The display name of the selected element (SelectionState.name).
 * @param selectedType  The kind of element (SelectionState.type).
 * @param selectedExtra SelectionState.extra — used to qualify actionInst lookups.
 */
export function computeImpactTrace(
  graph: ContainmentGraph,
  behavior: BehaviorData,
  selectedName: string,
  selectedType: string,
  selectedExtra?: Record<string, string>,
): ImpactTrace {

  // ── Build index maps ────────────────────────────────────────────────────────

  const nodeById   = new Map(graph.nodes.map(n => [n.id, n]));
  const parentOf   = new Map<string, string>();
  const childrenOf = new Map<string, string[]>(graph.nodes.map(n => [n.id, []]));

  for (const e of graph.edges) {
    if (e.type === 'contains') {
      parentOf.set(e.target, e.source);
      childrenOf.get(e.source)?.push(e.target);
    }
  }

  // ── Resolve the primary graph node for the selection ────────────────────────

  const preferred  = SELECTION_TO_EMF[selectedType] ?? [];
  const candidates = graph.nodes.filter(n => n.label === selectedName);

  let graphNode: GraphNode | null = null;
  if (preferred.length > 0) {
    graphNode = candidates.find(n => preferred.includes(n.type)) ?? candidates[0] ?? null;
  } else {
    graphNode = candidates[0] ?? null;
  }

  // ── ownedElements ───────────────────────────────────────────────────────────

  const ownedChildren: GraphNode[] = graphNode
    ? directMeaningfulChildren(graphNode.id, childrenOf, nodeById)
    : [];
  const ownedElements: ImpactedElement[] = ownedChildren.map(n => ({ label: n.label, type: n.type }));

  // ── ownedPorts ──────────────────────────────────────────────────────────────

  const PORT_EMFTYPES = new Set(['PortUsage', 'PortDefinition']);
  const ownedPorts: ImpactedElement[] = ownedElements.filter(el => PORT_EMFTYPES.has(el.type));

  // ── ownerChain ──────────────────────────────────────────────────────────────

  const ownerChain: ImpactedElement[] = graphNode
    ? ownerChainOf(graphNode.id, parentOf, nodeById)
        .map(n => ({ label: n.label, type: n.type }))
    : [];

  // ── usedAsTypeBy ────────────────────────────────────────────────────────────

  const usedAsTypeBy: ImpactedElement[] = [];
  if (graphNode) {
    for (const e of graph.edges) {
      if (e.type === 'typedBy' && e.target === graphNode.id) {
        const usage = nodeById.get(e.source);
        if (usage) usedAsTypeBy.push({ label: usage.label, type: usage.type });
      }
    }
  }

  // ── connectedElements ────────────────────────────────────────────────────────

  const connectedElements: ImpactedElement[] = [];
  if (graphNode) {
    for (const e of graph.edges) {
      if (e.type !== 'connection') continue;
      if (e.source === graphNode.id) {
        const target = nodeById.get(e.target);
        if (target) connectedElements.push({ label: target.label, type: target.type });
      } else if (e.target === graphNode.id) {
        const source = nodeById.get(e.source);
        if (source) connectedElements.push({ label: source.label, type: source.type });
      }
    }
  }

  // ── relatedBehaviors ─────────────────────────────────────────────────────────
  //
  // Rules:
  //   part / instance  → ActionDefinitions with owningDefName === selectedName
  //   behavior         → the ActionDefinition itself (by name)
  //   actionInst       → the owning ActionDefinition (via extra.behavior or ownerId)

  const relatedBehaviors: ImpactedBehavior[] = [];

  if (selectedType === 'part' || selectedType === 'instance' || selectedType === 'systemPart') {
    for (const a of behavior.actions) {
      if (a.type === 'ActionDefinition' && a.owningDefName === selectedName) {
        relatedBehaviors.push({
          name:          a.name,
          qualifiedName: `${a.owningDefName}::${a.name}`,
        });
      }
    }
  } else if (selectedType === 'behavior') {
    for (const a of behavior.actions) {
      if (a.type === 'ActionDefinition' && a.name === selectedName) {
        relatedBehaviors.push({
          name:          a.name,
          qualifiedName: a.owningDefName ? `${a.owningDefName}::${a.name}` : a.name,
        });
      }
    }
  } else if (selectedType === 'actionInst') {
    const behaviorName = selectedExtra?.behavior ?? '';
    const colonIdx  = behaviorName.indexOf('::');
    const defPart   = colonIdx >= 0 ? behaviorName.slice(colonIdx + 2) : behaviorName;
    const ownerPart = colonIdx >= 0 ? behaviorName.slice(0, colonIdx) : null;

    const def = behavior.actions.find(a =>
      a.type === 'ActionDefinition' &&
      a.name === defPart &&
      (ownerPart === null || a.owningDefName === ownerPart),
    );
    if (def) {
      relatedBehaviors.push({
        name:          def.name,
        qualifiedName: def.owningDefName ? `${def.owningDefName}::${def.name}` : def.name,
      });
    }
  }

  // ── ownedActions ─────────────────────────────────────────────────────────────
  //
  // For ActionDefinition selections: the owned ActionUsage instances with behavior
  // context so Inspector click-through can navigate to the correct actionInst scope.

  const ownedActions: ImpactedElement[] = [];
  if (selectedType === 'behavior') {
    const def = behavior.actions.find(a => a.type === 'ActionDefinition' && a.name === selectedName);
    if (def) {
      const qualifiedName = def.owningDefName ? `${def.owningDefName}::${def.name}` : def.name;
      for (const a of behavior.actions) {
        if (a.ownerId === def.id) {
          ownedActions.push({ label: a.name, type: a.type, extra: { behavior: qualifiedName } });
        }
      }
    }
  }

  // ── relatedFlows ─────────────────────────────────────────────────────────────
  //
  // Collect the set of action names to check against flow source/target.
  // Only resolved flows (with 'source'/'target' fields) are included.

  const actionNames = new Set<string>();

  if (selectedType === 'actionInst') {
    actionNames.add(selectedName);
  } else if (selectedType === 'behavior') {
    const def = behavior.actions.find(a => a.type === 'ActionDefinition' && a.name === selectedName);
    if (def) {
      for (const a of behavior.actions) {
        if (a.ownerId === def.id) actionNames.add(a.name);
      }
    }
  } else if (selectedType === 'part' || selectedType === 'instance' || selectedType === 'systemPart') {
    for (const a of behavior.actions) {
      if (a.type === 'ActionDefinition' && a.owningDefName === selectedName) {
        for (const sub of behavior.actions) {
          if (sub.ownerId === a.id) actionNames.add(sub.name);
        }
      }
    }
  }

  const relatedFlows: ImpactedFlow[] = [];
  for (const f of behavior.flows) {
    if (!('source' in f)) continue; // skip unresolved
    if (!actionNames.has(f.source) && !actionNames.has(f.target)) continue;

    const flow: ImpactedFlow = { source: f.source, target: f.target, flowType: f.type };
    if (f.type === 'transition' && 'guard' in f && f.guard !== undefined) {
      flow.guard = f.guard;
    }
    relatedFlows.push(flow);
  }

  // ── incomingFlows / outgoingFlows ─────────────────────────────────────────────
  //
  // For actionInst selections: split relatedFlows by whether the selected action
  // is the target (incoming) or source (outgoing).  Attach behaviorContext so the
  // Inspector can offer click-through navigation to the other-end action.

  const behaviorContext = relatedBehaviors[0]?.qualifiedName;
  const incomingFlows: ImpactedFlow[] = [];
  const outgoingFlows: ImpactedFlow[] = [];
  if (selectedType === 'actionInst') {
    for (const f of relatedFlows) {
      const withCtx: ImpactedFlow = behaviorContext ? { ...f, behaviorContext } : f;
      if (f.target === selectedName) incomingFlows.push(withCtx);
      if (f.source === selectedName) outgoingFlows.push(withCtx);
    }
  }

  // ── typedByDef ───────────────────────────────────────────────────────────────
  //
  // For actionInst selections: find the typedBy edge whose source is this node
  // and return the definition it points to.

  let typedByDef: ImpactedElement | undefined;
  if (selectedType === 'actionInst' && graphNode) {
    for (const e of graph.edges) {
      if (e.type === 'typedBy' && e.source === graphNode.id) {
        const def = nodeById.get(e.target);
        if (def) { typedByDef = { label: def.label, type: def.type }; break; }
      }
    }
  }

  // ── ownedRequirements ────────────────────────────────────────────────────────
  //
  // For part/instance/systemPart selections: named RequirementUsage children,
  // annotated with the definition they're typed by (via typedBy edges) so the
  // Inspector can render "brakeReq : BrakeResponse" and navigate to the definition.

  const ownedRequirements: ImpactedElement[] = [];
  if (selectedType === 'part' || selectedType === 'instance' || selectedType === 'systemPart') {
    for (const child of ownedChildren) {
      if (child.type !== 'RequirementUsage') continue;
      let reqDef: string | undefined;
      for (const e of graph.edges) {
        if (e.type === 'typedBy' && e.source === child.id) {
          const def = nodeById.get(e.target);
          if (def) { reqDef = def.label; break; }
        }
      }
      ownedRequirements.push({
        label: child.label,
        type:  child.type,
        ...(reqDef ? { extra: { requirementDef: reqDef } } : {}),
      });
    }
  }

  // ── ownedAttributes ──────────────────────────────────────────────────────────
  //
  // AttributeUsage children of the selected node, with extracted type name and
  // enum value.  Only enum-typed attributes (FeatureTyping.name resolved) are
  // included; unresolved types (String, Integer) produce typeName=undefined.
  //
  // Value path: AttributeUsage → FeatureValue → FeatureReferenceExpression → Membership.name

  const ownedAttributes: AttributeEntry[] = [];
  if (graphNode) {
    for (const child of ownedChildren) {
      if (child.type !== 'AttributeUsage') continue;
      const { typeName, value } = extractAttributeInfo(child.id, childrenOf, nodeById);
      ownedAttributes.push({ name: child.label, typeName, value });
    }
  }

  return {
    ownedElements, ownedPorts, ownedActions, ownedRequirements,
    ownedAttributes,
    ownerChain, usedAsTypeBy, connectedElements,
    relatedBehaviors, relatedFlows,
    incomingFlows, outgoingFlows,
    ...(typedByDef !== undefined ? { typedByDef } : {}),
  };
}
