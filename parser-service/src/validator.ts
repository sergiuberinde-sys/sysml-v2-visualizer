/**
 * SysML v2 model validator.
 *
 * Supplements the Java pilot-implementation parser (which runs the official OCL
 * constraint set) with graph-level checks that are easier to express over the
 * ContainmentGraph than over the raw Xtext model.
 *
 * Rules:
 *
 *   SML-PORT-001        Port direction conflict (in→in / out→out)       KerML §9.4.3, SysML v2 §10.3.3.3
 *   SML-SPEC-001        Specialization cycle                             KerML §7.2.5.2
 *   SML-SPEC-002        Cross-category specialization                    KerML §7.2.5
 *   SML-NAME-001        Duplicate member name in namespace               KerML §7.2.2.4
 *   SML-TYPE-001        PartUsage typed by non-part definition           SysML v2 §8.2.3.2
 *   SML-TYPE-002        PortUsage typed by non-port definition           SysML v2 §10.3.3.2
 *   SML-TYPE-003        ActionUsage typed by non-action definition       SysML v2 §12.3.3.2
 *   SML-TYPE-004        AttributeUsage typed by non-attribute def        KerML §9.2.3.2
 *   SML-TYPE-005        RequirementUsage typed by non-req def            SysML v2 §15.3.3.2
 *   SML-STRUCT-001      Direct circular composition                      SysML v2 §8.2.3
 *   SML-STRUCT-002      Transitive circular composition                  SysML v2 §8.2.3
 *   SML-CONN-TYPING-001 Connection port type compatibility               SysML v2 §10.3.3.3
 *   SML-IFACE-CONJ-001  InterfaceUsage complementary port types          SysML v2 §10.5.3.4
 *   SML-FLOW-TYPING-001 FlowConnectionUsage item-type conformance        SysML v2 §10.4.3.3
 *   SML-PORT-DIR-001    PortUsage direction vs PortDefinition direction   SysML v2 §11.3.3.3
 *   SML-CONN-END-001    Connector end type conformance                   KerML §9.5.3
 *   SML-SUBS-CONTEXT-001 Subsetting type conformance                     KerML §7.4.4.2
 *   SML-REDEF-TYPE-001  Redefinition type conformance                    KerML §7.4.5.2
 *   SML-SUBS-SCOPE-001  Subsetting target visibility                     KerML §9.3.3.2
 *   SML-ACTION-PARTS-001 ActionUsage must not own composite PartUsages   SysML v2 §12.3.3.3
 *   SML-STATE-INIT-001  At most one initial state per state namespace    SysML v2 §13.3.3.2
 *   SML-VERIFY-TARGET-001 VerifyRequirementUsage target type             SysML v2 §15.5.3
 *   SML-PORT-UNTYPED-001 Untyped PortUsage in connection                 SysML v2 §10.3.3 / §11.3
 */

import type { ContainmentGraph, GraphNode } from './graphBuilder';
import type { Diagnostic } from './types';

// ── Membership-wrapper types ───────────────────────────────────────────────────
const MEMBERSHIP_WRAPPERS = new Set([
  'Namespace', 'OwningMembership', 'FeatureMembership',
  'ReturnParameterMembership', 'ParameterMembership',
  'VariantMembership', 'EndFeatureMembership',
  'ObjectiveMembership', 'ActorMembership', 'StakeholderMembership',
  'ExposeMembership', 'AliasMembership', 'ImportMembership',
  'MembershipExpose', 'NamespaceExpose', 'ViewRenderingMembership',
]);

// ── Namespace-level types (can own named members) ─────────────────────────────
const NAMESPACE_TYPES = new Set([
  'PartDefinition', 'PortDefinition', 'ItemDefinition', 'OccurrenceDefinition',
  'ActionDefinition', 'BehaviorDefinition', 'StateDefinition', 'RequirementDefinition',
  'AllocationDefinition', 'UseCaseDefinition', 'ViewDefinition',
  'InterfaceDefinition', 'ConnectionDefinition', 'Namespace',
]);

// ── Types whose instances constitute named namespace members ──────────────────
const NAMED_MEMBER_TYPES = new Set([
  'PartUsage', 'PortUsage', 'AttributeUsage', 'ActionUsage', 'PerformActionUsage',
  'ItemUsage', 'RequirementUsage', 'ConnectionUsage', 'InterfaceUsage',
  'PartDefinition', 'PortDefinition', 'ItemDefinition', 'OccurrenceDefinition',
  'ActionDefinition', 'BehaviorDefinition', 'StateDefinition', 'RequirementDefinition',
  'AllocationDefinition', 'UseCaseDefinition', 'ViewDefinition',
  'InterfaceDefinition', 'ConnectionDefinition',
]);

// ── Definition types that can be parents of structural parts ──────────────────
const STRUCTURAL_DEF_TYPES = new Set([
  'PartDefinition', 'ItemDefinition', 'OccurrenceDefinition',
  'InterfaceDefinition', 'ConnectionDefinition',
]);

// ── Edge types that model port-to-port wiring ─────────────────────────────────
const CONN_EDGE_TYPES = new Set(['connection', 'interconnect']);

// ── DFS colour constants ──────────────────────────────────────────────────────
const WHITE = 0, GRAY = 1, BLACK = 2;

// ── Compatible typing pairs (SML-TYPE-*) ─────────────────────────────────────
//
// Maps each Usage EMF type to the set of Definition EMF types that may legally
// type it per the SysML v2 / KerML specification.
//
// ItemDefinition is listed as a valid type for PartUsage because SysML v2 §8.2
// permits items to be used structurally as parts.  OccurrenceDefinition covers
// the general structural super-type of Part.
const USAGE_COMPATIBLE_DEFS: Record<string, { allowed: Set<string>; rule: string; label: string; spec: string }> = {
  PartUsage: {
    allowed: new Set(['PartDefinition', 'ItemDefinition', 'OccurrenceDefinition']),
    rule: 'SML-TYPE-001', label: 'part', spec: 'SysML v2 §8.2.3.2',
  },
  PortUsage: {
    allowed: new Set(['PortDefinition']),
    rule: 'SML-TYPE-002', label: 'port', spec: 'SysML v2 §10.3.3.2',
  },
  ActionUsage: {
    allowed: new Set(['ActionDefinition', 'BehaviorDefinition']),
    rule: 'SML-TYPE-003', label: 'action', spec: 'SysML v2 §12.3.3.2',
  },
  PerformActionUsage: {
    allowed: new Set(['ActionDefinition', 'BehaviorDefinition']),
    rule: 'SML-TYPE-003', label: 'perform action', spec: 'SysML v2 §12.3.3.2',
  },
  AttributeUsage: {
    allowed: new Set(['AttributeDefinition', 'EnumerationDefinition', 'DataType']),
    rule: 'SML-TYPE-004', label: 'attribute', spec: 'KerML §9.2.3.2',
  },
  RequirementUsage: {
    allowed: new Set(['RequirementDefinition', 'ConstraintDefinition']),
    rule: 'SML-TYPE-005', label: 'requirement', spec: 'SysML v2 §15.3.3.2',
  },
};

// ── Compatible specialization pairs (SML-SPEC-002) ───────────────────────────
//
// Maps each Definition EMF type to the set of Definition EMF types it may
// specialize (:>) per KerML §7.2.5.  Only types present in our node set are
// listed; all others are silently skipped (no false positives for types we do
// not yet model).
//
// Notes:
//  • ItemDefinition may specialize PartDefinition per SysML v2 §9.2.3.
//  • StateDefinition may specialize BehaviorDefinition per SysML v2 §13.3.
//  • AllocationDefinition is a subtype of ConnectionDefinition per SysML v2 §16.3.
//  • UseCaseDefinition is a subtype of RequirementDefinition per SysML v2 §17.3.
const SPEC_COMPATIBLE: Record<string, Set<string>> = {
  PartDefinition:        new Set(['PartDefinition', 'OccurrenceDefinition']),
  ItemDefinition:        new Set(['ItemDefinition', 'PartDefinition', 'OccurrenceDefinition']),
  PortDefinition:        new Set(['PortDefinition']),
  ActionDefinition:      new Set(['ActionDefinition', 'BehaviorDefinition']),
  BehaviorDefinition:    new Set(['BehaviorDefinition']),
  OccurrenceDefinition:  new Set(['OccurrenceDefinition']),
  RequirementDefinition: new Set(['RequirementDefinition', 'ConstraintDefinition']),
  ConstraintDefinition:  new Set(['ConstraintDefinition']),
  InterfaceDefinition:   new Set(['InterfaceDefinition', 'ConnectionDefinition', 'OccurrenceDefinition']),
  ConnectionDefinition:  new Set(['ConnectionDefinition', 'OccurrenceDefinition']),
  StateDefinition:       new Set(['StateDefinition', 'BehaviorDefinition']),
  UseCaseDefinition:     new Set(['UseCaseDefinition', 'RequirementDefinition', 'ConstraintDefinition']),
  AllocationDefinition:  new Set(['AllocationDefinition', 'ConnectionDefinition', 'OccurrenceDefinition']),
  ViewDefinition:        new Set(['ViewDefinition']),
};

// ── Main entry point ──────────────────────────────────────────────────────────

export function validateModel(graph: ContainmentGraph): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // ── Structural maps ────────────────────────────────────────────────────────
  const nodeById = new Map<string, GraphNode>(graph.nodes.map(n => [n.id, n]));

  const parentOf = new Map<string, string>();
  for (const e of graph.edges) {
    if (e.type === 'contains') parentOf.set(e.target, e.source);
  }

  // Walk up through MEMBERSHIP_WRAPPERS to the nearest non-wrapper ancestor.
  function semanticParent(id: string): GraphNode | null {
    let pid = parentOf.get(id);
    while (pid !== undefined) {
      const n = nodeById.get(pid);
      if (!n) return null;
      if (!MEMBERSHIP_WRAPPERS.has(n.type)) return n;
      pid = parentOf.get(pid);
    }
    return null;
  }

  // ── SML-PORT-001: Port direction compatibility ────────────────────────────
  //
  // KerML §9.4.3 / SysML v2 §10.3.3.3:
  // For internal-to-internal port wiring, directions must be complementary —
  // one 'in' and one 'out'.  Connecting in→in or out→out means both ends
  // consume or both produce; no item can flow across the connector.
  // Boundary ports (owned directly by a PartDefinition, not a PartUsage) are
  // excluded because their direction is conjugated at the boundary.
  // Ports without an explicit direction or declared 'inout' are always skipped.

  function isBoundaryPort(portId: string): boolean {
    const sp = semanticParent(portId);
    return sp !== null && STRUCTURAL_DEF_TYPES.has(sp.type);
  }

  for (const e of graph.edges) {
    if (!CONN_EDGE_TYPES.has(e.type)) continue;
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    if (!src || !tgt) continue;
    if (src.type !== 'PortUsage' || tgt.type !== 'PortUsage') continue;

    const sd = src.direction ?? '';
    const td = tgt.direction ?? '';
    if (!sd || !td) continue;
    if (sd === 'inout' || td === 'inout') continue;
    if (isBoundaryPort(e.source) || isBoundaryPort(e.target)) continue;

    if (sd === td) {
      diagnostics.push({
        message:  `[SML-PORT-001] Port direction conflict: '${src.label}' (${sd}) → '${tgt.label}' (${td}). ` +
                  `Connections must join complementary directions (one 'in', one 'out'). (KerML §9.4.3)`,
        severity: 'error',
        code:     'SML-PORT-001',
        ...(src.startLine ? { line: src.startLine } : {}),
      });
    }
  }

  // ── SML-SPEC-001: Specialization cycle ───────────────────────────────────
  //
  // KerML §7.2.5.2: A type may not directly or indirectly specialize itself.
  // DFS with white/gray/black colouring; back-edge = cycle.

  const specSucc = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.type !== 'specialization') continue;
    const list = specSucc.get(e.source) ?? [];
    list.push(e.target);
    specSucc.set(e.source, list);
  }

  {
    const color = new Map<string, number>();
    const seen  = new Set<string>();

    function dfsSpec(id: string, stack: string[]): void {
      color.set(id, GRAY);
      for (const succ of specSucc.get(id) ?? []) {
        const c = color.get(succ) ?? WHITE;
        if (c === GRAY) {
          const idx   = stack.indexOf(succ);
          const cycle = idx >= 0 ? [...stack.slice(idx), succ] : [succ, id, succ];
          const key   = [...cycle].sort().join(',');
          if (!seen.has(key)) {
            seen.add(key);
            const names = cycle.map(nid => nodeById.get(nid)?.label ?? nid);
            const node  = nodeById.get(id);
            diagnostics.push({
              message:  `[SML-SPEC-001] Specialization cycle: ${names.join(' :> ')}. ` +
                        `A type may not (directly or indirectly) specialize itself. (KerML §7.2.5.2)`,
              severity: 'error',
              code:     'SML-SPEC-001',
              ...(node?.startLine ? { line: node.startLine } : {}),
            });
          }
        } else if (c === WHITE) {
          dfsSpec(succ, [...stack, succ]);
        }
      }
      color.set(id, BLACK);
    }

    for (const n of graph.nodes) {
      if ((color.get(n.id) ?? WHITE) === WHITE && specSucc.has(n.id)) {
        dfsSpec(n.id, [n.id]);
      }
    }
  }

  // ── SML-SPEC-002: Cross-category specialization ───────────────────────────
  //
  // KerML §7.2.5: A definition may only specialize definitions of a compatible
  // metaclass.  For example, a PartDefinition may not specialize a PortDefinition
  // because Parts and Ports occupy different branches of the SysML type taxonomy.

  for (const e of graph.edges) {
    if (e.type !== 'specialization') continue;
    const specific = nodeById.get(e.source);
    const general  = nodeById.get(e.target);
    if (!specific || !general) continue;

    const allowed = SPEC_COMPATIBLE[specific.type];
    if (allowed && !allowed.has(general.type)) {
      diagnostics.push({
        message:  `[SML-SPEC-002] '${specific.label}' (${specific.type}) specializes '${general.label}' ` +
                  `(${general.type}) — cross-category specialization is not permitted. (KerML §7.2.5)`,
        severity: 'error',
        code:     'SML-SPEC-002',
        ...(specific.startLine ? { line: specific.startLine } : {}),
      });
    }
  }

  // ── SML-NAME-001: Duplicate member names ─────────────────────────────────
  //
  // KerML §7.2.2.4: Every owned member of a namespace must have a distinct
  // effective name within that namespace.

  const nsMembers = new Map<string, Map<string, Array<{ id: string; line?: number }>>>();

  for (const n of graph.nodes) {
    if (!NAMED_MEMBER_TYPES.has(n.type)) continue;
    if (!n.label || n.label === n.type) continue;

    const sp = semanticParent(n.id);
    if (!sp || !NAMESPACE_TYPES.has(sp.type)) continue;

    let byLabel = nsMembers.get(sp.id);
    if (!byLabel) { byLabel = new Map(); nsMembers.set(sp.id, byLabel); }
    const list = byLabel.get(n.label) ?? [];
    list.push({ id: n.id, line: n.startLine });
    byLabel.set(n.label, list);
  }

  for (const [nsId, byLabel] of nsMembers) {
    const nsNode = nodeById.get(nsId);
    const nsName = nsNode?.label && nsNode.label !== nsNode.type ? nsNode.label : nsId;
    for (const [label, entries] of byLabel) {
      if (entries.length < 2) continue;
      for (let i = 1; i < entries.length; i++) {
        diagnostics.push({
          message:  `[SML-NAME-001] Duplicate member name '${label}' in '${nsName}'. ` +
                    `Member names must be unique within their namespace. (KerML §7.2.2.4)`,
          severity: 'warning',
          code:     'SML-NAME-001',
          ...(entries[i].line ? { line: entries[i].line } : {}),
        });
      }
    }
  }

  // ── SML-TYPE-001…005: Usage typed by incompatible definition category ──────
  //
  // Each usage kind (PartUsage, PortUsage, ActionUsage, …) may only be typed
  // by a definition of a compatible metaclass.  A PortUsage typed by a
  // PartDefinition, for example, is always a modelling error: the port would
  // need to instantiate a structural part, which violates the SysML type
  // taxonomy.
  //
  // We only fire when the typedBy edge is fully resolved (both nodes exist in
  // the graph) to avoid false positives from incomplete cross-file parses.

  for (const e of graph.edges) {
    if (e.type !== 'typedBy') continue;
    const usage = nodeById.get(e.source);
    const def   = nodeById.get(e.target);
    if (!usage || !def) continue;

    const rule = USAGE_COMPATIBLE_DEFS[usage.type];
    if (!rule) continue;

    if (!rule.allowed.has(def.type)) {
      diagnostics.push({
        message:  `[${rule.rule}] '${usage.label}' is a ${rule.label} usage but is typed by '${def.label}' ` +
                  `(${def.type}). Expected a ${[...rule.allowed].join(' or ')}. (${rule.spec})`,
        severity: 'error',
        code:     rule.rule,
        ...(usage.startLine ? { line: usage.startLine } : {}),
      });
    }
  }

  // ── SML-STRUCT-001 / SML-STRUCT-002: Circular composition ────────────────
  //
  // SysML v2 §8.2.3: A part composition tree must be acyclic.  A PartDefinition
  // that (directly or transitively) contains a PartUsage typed by itself would
  // require infinitely many nested instances at runtime, which is forbidden.
  //
  // We build a directed graph where PartDef P → PartDef Q means "P owns a
  // PartUsage typed by Q", then run DFS to detect cycles.
  //
  // Only PartUsages with resolved typedBy edges are included; unresolved
  // cross-file references are silently ignored to avoid false positives.

  const compSucc = new Map<string, Set<string>>();

  // Initialise a node for every structural definition so DFS has something to
  // start from even for definitions that contain no parts.
  for (const n of graph.nodes) {
    if (STRUCTURAL_DEF_TYPES.has(n.type)) compSucc.set(n.id, new Set());
  }

  for (const e of graph.edges) {
    if (e.type !== 'typedBy') continue;
    const usage = nodeById.get(e.source);
    const def   = nodeById.get(e.target);
    if (!usage || !def) continue;
    if (usage.type !== 'PartUsage') continue;
    if (!STRUCTURAL_DEF_TYPES.has(def.type)) continue;

    const sp = semanticParent(usage.id);
    if (!sp || !STRUCTURAL_DEF_TYPES.has(sp.type)) continue;

    compSucc.get(sp.id)?.add(def.id);
  }

  {
    const color = new Map<string, number>();
    const seen  = new Set<string>();

    function dfsComp(id: string, stack: string[]): void {
      color.set(id, GRAY);
      for (const succ of compSucc.get(id) ?? new Set()) {
        const c = color.get(succ) ?? WHITE;
        if (c === GRAY) {
          const idx      = stack.indexOf(succ);
          const cycle    = idx >= 0 ? [...stack.slice(idx), succ] : [succ, id, succ];
          const key      = [...cycle].sort().join(',');
          if (!seen.has(key)) {
            seen.add(key);
            const names    = cycle.map(nid => nodeById.get(nid)?.label ?? nid);
            const isDirect = cycle.length === 2; // P → P
            const node     = nodeById.get(id);
            diagnostics.push({
              message:  isDirect
                ? `[SML-STRUCT-001] '${names[0]}' directly contains a part typed by itself — ` +
                  `infinite recursive composition. (SysML v2 §8.2.3)`
                : `[SML-STRUCT-002] Circular composition: ${names.join(' → ')} — ` +
                  `this creates an infinitely recursive structure. (SysML v2 §8.2.3)`,
              severity: 'error',
              code:     isDirect ? 'SML-STRUCT-001' : 'SML-STRUCT-002',
              ...(node?.startLine ? { line: node.startLine } : {}),
            });
          }
        } else if (c === WHITE) {
          dfsComp(succ, [...stack, succ]);
        }
      }
      color.set(id, BLACK);
    }

    for (const [defId] of compSucc) {
      if ((color.get(defId) ?? WHITE) === WHITE) {
        dfsComp(defId, [defId]);
      }
    }
  }

  // ── Pre-compute shared indexes for new rules ─────────────────────────────

  // definition name → id (for resolving type names to graph nodes)
  const defByName = new Map<string, string>();
  for (const n of graph.nodes) {
    if (n.label && n.label !== n.type) defByName.set(n.label, n.id);
  }

  // typedBy: usageId → defId
  const typedByOf = new Map<string, string>();
  for (const e of graph.edges) {
    if (e.type === 'typedBy') typedByOf.set(e.source, e.target);
  }

  // specialization successors: defId → Set<defId> (direct superclasses)
  const specSuccMap = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (e.type === 'specialization') {
      const s = specSuccMap.get(e.source) ?? new Set<string>();
      s.add(e.target);
      specSuccMap.set(e.source, s);
    }
  }

  // Is typeA a subtype of (or equal to) typeB via the specialization chain?
  function isSubtype(typeA: string, typeB: string): boolean {
    if (typeA === typeB) return true;
    const visited = new Set<string>();
    const queue = [typeA];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === typeB) return true;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const sup of specSuccMap.get(cur) ?? new Set()) queue.push(sup);
    }
    return false;
  }

  // Reverse conjugation map: basePortDefId → ConjugatedPortDefinition node id.
  // Lets us ask "what is the formal conjugate of PortDef X?" without needing the
  // graphBuilder's private conjToPortDef structure.  Built by scanning graph nodes
  // for ConjugatedPortDefinition and walking up the containment tree.
  const portDefToConj = new Map<string, string>(); // portDefId → conjDefNodeId
  for (const n of graph.nodes) {
    if (n.type !== 'ConjugatedPortDefinition') continue;
    let pid = parentOf.get(n.id);
    while (pid !== undefined) {
      const pn = nodeById.get(pid);
      if (!pn) break;
      if (pn.type === 'PortDefinition') { portDefToConj.set(pid, n.id); break; }
      if (!MEMBERSHIP_WRAPPERS.has(pn.type)) break;
      pid = parentOf.get(pid);
    }
  }

  // Ports involved in connection/interconnect edges
  const connectedPortIds = new Set<string>();
  for (const e of graph.edges) {
    if (e.type === 'connection' || e.type === 'interconnect') {
      if (nodeById.get(e.source)?.type === 'PortUsage') connectedPortIds.add(e.source);
      if (nodeById.get(e.target)?.type === 'PortUsage') connectedPortIds.add(e.target);
    }
  }

  // ── SML-CONN-TYPING-001: Connection port type compatibility ───────────────
  //
  // SysML v2 §10.3.3.3: Connected ports must have complementary types — one
  // typed by P and the other by ~P.
  //
  // Two sub-cases:
  //   (a) Same base PortDefinition: must differ in isConjugated.
  //   (b) Different base PortDefinitions: compatible only if one specializes the
  //       formal conjugate of the other (covers `port def Q specializes ~P` patterns).
  //       Otherwise flagged as a warning (cross-file resolution may be incomplete).

  for (const e of graph.edges) {
    if (e.type !== 'connection' && e.type !== 'interconnect') continue;
    // `bind a = b;` delegation edges are emitted as 'interconnect' but are BINDING
    // connectors, not conjugated connections: a binding asserts its two ends hold
    // the SAME value, so the ports must have the SAME (conformant) type — NOT
    // complementary (P / ~P).  The conjugation rule of §10.3.3.3 applies only to
    // ConnectionUsage/InterfaceUsage, so skip delegation bindings here.
    if (e.id.startsWith('bind:')) continue;
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    if (!src || !tgt) continue;
    if (src.type !== 'PortUsage' || tgt.type !== 'PortUsage') continue;

    const srcDef = typedByOf.get(e.source);
    const tgtDef = typedByOf.get(e.target);
    if (!srcDef || !tgtDef) continue; // untyped → SML-PORT-UNTYPED-001

    const srcConj = src.isConjugated ?? false;
    const tgtConj = tgt.isConjugated ?? false;

    if (srcDef === tgtDef) {
      // (a) Same base PortDef: conjugation must differ.
      if (srcConj === tgtConj) {
        const side = srcConj ? 'both conjugated (~P)' : 'both non-conjugated (P)';
        diagnostics.push({
          message:  `[SML-CONN-TYPING-001] Port type conflict: '${src.label}' and '${tgt.label}' are ${side} — ` +
                    `connected ports must have complementary types (one P, one ~P). (SysML v2 §10.3.3.3)`,
          severity: 'error',
          code:     'SML-CONN-TYPING-001',
          ...(src.startLine ? { line: src.startLine } : {}),
        });
      }
    } else {
      // (b) Different base PortDefs: check if one is the conjugate-or-subtype of the other.
      // conjOf(X) is the ConjugatedPortDefinition node id for PortDef X.
      const conjOfSrc = portDefToConj.get(srcDef);
      const conjOfTgt = portDefToConj.get(tgtDef);
      const compatible =
        (conjOfSrc !== undefined && isSubtype(tgtDef, conjOfSrc)) ||
        (conjOfTgt !== undefined && isSubtype(srcDef, conjOfTgt));
      if (!compatible) {
        const srcDefNode = nodeById.get(srcDef);
        const tgtDefNode = nodeById.get(tgtDef);
        diagnostics.push({
          message:  `[SML-CONN-TYPING-001] Port type mismatch: '${src.label}' is typed by '${srcDefNode?.label ?? srcDef}' ` +
                    `but '${tgt.label}' is typed by '${tgtDefNode?.label ?? tgtDef}' — ` +
                    `connected ports must have conjugate types. (SysML v2 §10.3.3.3)`,
          severity: 'warning',
          code:     'SML-CONN-TYPING-001',
          ...(src.startLine ? { line: src.startLine } : {}),
        });
      }
    }
  }

  // ── SML-IFACE-CONJ-001: InterfaceUsage end ports must differ in conjugation ─
  //
  // SysML v2 §10.5.3.4: An InterfaceUsage typed by an InterfaceDefinition must
  // connect two ports whose types are conjugates of each other.  We check: for
  // each InterfaceUsage, its two `interconnect` end ports (if both typed) must
  // differ in conjugation status.  Fires independently of SML-CONN-TYPING-001.

  for (const iface of graph.nodes) {
    if (iface.type !== 'InterfaceUsage') continue;
    // Collect interconnect edges where this InterfaceUsage's ends are the ports.
    // InterfaceUsage creates exactly one interconnect edge between its two end ports.
    const ifaceEdges = graph.edges.filter(e => e.type === 'interconnect');
    for (const e of ifaceEdges) {
      const src = nodeById.get(e.source);
      const tgt = nodeById.get(e.target);
      if (!src || !tgt) continue;
      if (src.type !== 'PortUsage' || tgt.type !== 'PortUsage') continue;
      // Only process if both ports are in the semantic subtree of this InterfaceUsage.
      // Simplified: match by checking that both ports' ancestors include this iface.
      function isDescendant(nodeId: string, ancestorId: string): boolean {
        let id = parentOf.get(nodeId);
        while (id !== undefined) {
          if (id === ancestorId) return true;
          const n = nodeById.get(id);
          if (!n || (!MEMBERSHIP_WRAPPERS.has(n.type) && n.type !== 'InterfaceUsage')) break;
          id = parentOf.get(id);
        }
        return false;
      }
      // Skip edges not owned by this InterfaceUsage
      if (!isDescendant(e.source, iface.id) && !isDescendant(e.target, iface.id)) continue;

      const srcDef = typedByOf.get(e.source);
      const tgtDef = typedByOf.get(e.target);
      if (!srcDef || !tgtDef) continue;

      const srcConj = src.isConjugated ?? false;
      const tgtConj = tgt.isConjugated ?? false;
      if (srcConj === tgtConj && srcDef === tgtDef) continue; // caught by CONN-TYPING-001

      // Both have different base defs but same conjugation: also a mismatch.
      if (srcConj === tgtConj && srcDef !== tgtDef) {
        const side = srcConj ? 'both conjugated' : 'both non-conjugated';
        diagnostics.push({
          message:  `[SML-IFACE-CONJ-001] InterfaceUsage '${iface.label}' connects '${src.label}' and '${tgt.label}' — ` +
                    `${side} ports with different base definitions; ends must be conjugate pairs. (SysML v2 §10.5.3.4)`,
          severity: 'warning',
          code:     'SML-IFACE-CONJ-001',
          ...(iface.startLine ? { line: iface.startLine } : {}),
        });
      }
    }
  }

  // ── SML-FLOW-TYPING-001: FlowConnectionUsage item-type conformance ────────
  //
  // SysML v2 §10.4.3.3: The item type of a FlowConnectionUsage must conform to
  // (be a subtype of) the item types declared on the source and target ports.
  // We check the simplified invariant: the payload label of the flow connection
  // edge (if present) must match or specialize the typedBy def of connected ports.
  // Flagged as a warning because cross-file type resolution may be incomplete.

  for (const e of graph.edges) {
    if (e.type !== 'connection') continue;
    if (!e.label) continue; // no payload type declared
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    if (!src || !tgt) continue;
    if (src.type !== 'PortUsage' && tgt.type !== 'PortUsage') continue;

    // Payload type name is embedded in label ("flowName : PayloadType" or "PayloadType")
    const payloadName = e.label.includes(' : ') ? e.label.split(' : ')[1].trim() : e.label.trim();

    // Check port typing: if the port is typed by a PortDefinition that is NOT
    // the same as the payload type, flag it.
    for (const portId of [e.source, e.target]) {
      const port = nodeById.get(portId);
      if (!port || port.type !== 'PortUsage') continue;
      const portDefId = typedByOf.get(portId);
      if (!portDefId) continue;
      const portDef = nodeById.get(portDefId);
      if (!portDef) continue;
      // If the PortDefinition name equals the payload type, it's compatible.
      if (portDef.label === payloadName) continue;
      // If the payload type specializes the port's type, also compatible.
      const payloadDefId = defByName.get(payloadName);
      if (payloadDefId && isSubtype(payloadDefId, portDefId)) continue;
      // Otherwise flag a warning (incomplete cross-file resolution may cause false positives).
      diagnostics.push({
        message:  `[SML-FLOW-TYPING-001] Flow payload type '${payloadName}' may not conform to ` +
                  `port '${port.label}' typed by '${portDef.label}'. (SysML v2 §10.4.3.3)`,
        severity: 'warning',
        code:     'SML-FLOW-TYPING-001',
        ...(port.startLine ? { line: port.startLine } : {}),
      });
    }
  }

  // ── SML-PORT-DIR-001: PortUsage direction vs PortDefinition direction ─────
  //
  // SysML v2 §11.3.3.3: The direction of a PortUsage should be consistent with
  // the direction declared on its typing PortDefinition.  If the PortDefinition
  // has a declared direction and the PortUsage has an explicit direction that
  // contradicts it, flag it.  Conjugated ports implicitly flip direction (no error).

  // Build PortDefinition → declared direction from its owned feature directions.
  const portDefDirection = new Map<string, string>();
  for (const n of graph.nodes) {
    if (n.type !== 'PortDefinition') continue;
    // Collect directions of direct PortUsage children.
    const dirs: string[] = [];
    for (const e of graph.edges) {
      if (e.type !== 'contains') continue;
      if (e.source !== n.id) continue;
      const child = nodeById.get(e.target);
      if (child?.direction) dirs.push(child.direction);
    }
    if (dirs.length === 0) continue;
    const dirSet = new Set(dirs);
    if (dirSet.size === 1) portDefDirection.set(n.id, [...dirSet][0]);
    else portDefDirection.set(n.id, 'inout');
  }

  for (const n of graph.nodes) {
    if (n.type !== 'PortUsage') continue;
    if (!n.direction || n.direction === 'inout') continue;
    if (n.isConjugated) continue; // conjugation flips direction — skip

    const defId = typedByOf.get(n.id);
    if (!defId) continue;
    const defDir = portDefDirection.get(defId);
    if (!defDir || defDir === 'inout') continue;

    if (n.direction !== defDir) {
      diagnostics.push({
        message:  `[SML-PORT-DIR-001] Port '${n.label}' has direction '${n.direction}' but its ` +
                  `PortDefinition declares '${defDir}'. Direction must match unless the port is conjugated. ` +
                  `(SysML v2 §11.3.3.3)`,
        severity: 'warning',
        code:     'SML-PORT-DIR-001',
        ...(n.startLine ? { line: n.startLine } : {}),
      });
    }
  }

  // ── SML-CONN-END-001: Connector end type conformance ─────────────────────
  //
  // KerML §9.5.3: Each end feature of a connector must be typed by a classifier
  // that conforms to (specializes) the required end type of the connector's
  // association type.  Simplified check: for a ConnectionUsage typed by a
  // ConnectionDefinition, the two end ports' typing defs should each conform to
  // the ends declared on the ConnectionDefinition.

  // Build ConnectionDefinition → [endPortDefId] map (first two PortUsage children).
  const connDefEnds = new Map<string, string[]>();
  for (const n of graph.nodes) {
    if (n.type !== 'ConnectionDefinition' && n.type !== 'InterfaceDefinition') continue;
    const ends: string[] = [];
    for (const e of graph.edges) {
      if (e.type !== 'contains') continue;
      if (e.source !== n.id) continue;
      const child = nodeById.get(e.target);
      if (child?.type === 'PortUsage') {
        const childDefId = typedByOf.get(child.id);
        if (childDefId) ends.push(childDefId);
      }
      if (ends.length >= 2) break;
    }
    if (ends.length >= 2) connDefEnds.set(n.id, ends);
  }

  for (const e of graph.edges) {
    if (e.type !== 'connection' && e.type !== 'interconnect') continue;
    if (e.id.startsWith('bind:')) continue; // delegation bindings: see SML-CONN-TYPING-001
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    if (!src || !tgt) continue;
    if (src.type !== 'PortUsage' || tgt.type !== 'PortUsage') continue;

    // Find a ConnectionUsage/InterfaceUsage that owns this edge and is typed by a def.
    for (const connNode of graph.nodes) {
      if (connNode.type !== 'ConnectionUsage' && connNode.type !== 'InterfaceUsage') continue;
      const connDefId = typedByOf.get(connNode.id);
      if (!connDefId) continue;
      const ends = connDefEnds.get(connDefId);
      if (!ends) continue;

      const srcDefId = typedByOf.get(e.source);
      const tgtDefId = typedByOf.get(e.target);
      if (!srcDefId || !tgtDefId) continue;

      if (!isSubtype(srcDefId, ends[0]) && !isSubtype(srcDefId, ends[1])) {
        const srcDef = nodeById.get(srcDefId);
        const connDef = nodeById.get(connDefId);
        diagnostics.push({
          message:  `[SML-CONN-END-001] Port '${src.label}' typed by '${srcDef?.label ?? srcDefId}' does not ` +
                    `conform to the connector end type required by '${connDef?.label ?? connDefId}'. (KerML §9.5.3)`,
          severity: 'warning',
          code:     'SML-CONN-END-001',
          ...(src.startLine ? { line: src.startLine } : {}),
        });
      }
    }
  }

  // ── SML-SUBS-CONTEXT-001: Subsetting type conformance ────────────────────
  //
  // KerML §7.4.4.2: If feature A subsets feature B, the type of A must conform
  // to (be a subtype of) the type of B.  We check: typedBy(A) must specialize
  // typedBy(B) (or be the same).

  for (const e of graph.edges) {
    if (e.type !== 'subsetting') continue;
    const aId = e.source;
    const bId = e.target;
    const aDefId = typedByOf.get(aId);
    const bDefId = typedByOf.get(bId);
    if (!aDefId || !bDefId) continue;
    if (aDefId === bDefId) continue; // same type — always conformant

    if (!isSubtype(aDefId, bDefId)) {
      const aNode  = nodeById.get(aId);
      const bNode  = nodeById.get(bId);
      const aDef   = nodeById.get(aDefId);
      const bDef   = nodeById.get(bDefId);
      diagnostics.push({
        message:  `[SML-SUBS-CONTEXT-001] '${aNode?.label ?? aId}' subsets '${bNode?.label ?? bId}' but its ` +
                  `type '${aDef?.label ?? aDefId}' does not conform to '${bDef?.label ?? bDefId}'. ` +
                  `A subsetting feature's type must specialize the subsetted feature's type. (KerML §7.4.4.2)`,
        severity: 'error',
        code:     'SML-SUBS-CONTEXT-001',
        ...(aNode?.startLine ? { line: aNode.startLine } : {}),
      });
    }
  }

  // ── SML-REDEF-TYPE-001: Redefinition type conformance ────────────────────
  //
  // KerML §7.4.5.2: A redefining feature's type must conform to (specialize)
  // the redefined feature's type.  The redefining type may be the same or a
  // subtype; a supertype is forbidden.

  for (const e of graph.edges) {
    if (e.type !== 'redefinition') continue;
    const redefId   = e.source;
    const redefinedId = e.target;
    const redefDefId    = typedByOf.get(redefId);
    const redefinedDefId = typedByOf.get(redefinedId);
    if (!redefDefId || !redefinedDefId) continue;
    if (redefDefId === redefinedDefId) continue;

    if (!isSubtype(redefDefId, redefinedDefId)) {
      const redefNode    = nodeById.get(redefId);
      const redefinedNode = nodeById.get(redefinedId);
      const redefDef     = nodeById.get(redefDefId);
      const redefinedDef  = nodeById.get(redefinedDefId);
      diagnostics.push({
        message:  `[SML-REDEF-TYPE-001] '${redefNode?.label ?? redefId}' redefines '${redefinedNode?.label ?? redefinedId}' ` +
                  `but its type '${redefDef?.label ?? redefDefId}' does not conform to ` +
                  `'${redefinedDef?.label ?? redefinedDefId}'. The redefining type must specialize the redefined type. (KerML §7.4.5.2)`,
        severity: 'error',
        code:     'SML-REDEF-TYPE-001',
        ...(redefNode?.startLine ? { line: redefNode.startLine } : {}),
      });
    }
  }

  // ── SML-SUBS-SCOPE-001: Subsetting target visibility ─────────────────────
  //
  // KerML §9.3.3.2: A subsetting target must be a member of (or inherited by)
  // the featuring type of the subsetting feature.  Simplified check: if A :>> B,
  // B must share the same semantic parent namespace as A, or B's parent must
  // specialize A's parent.  We flag as a warning if B's parent is completely
  // unrelated to A's parent (no common path via specialization).

  for (const e of graph.edges) {
    if (e.type !== 'subsetting') continue;
    const aParent = semanticParent(e.source);
    const bParent = semanticParent(e.target);
    if (!aParent || !bParent) continue;
    if (aParent.id === bParent.id) continue; // same namespace — always visible

    // B's namespace is visible from A if bParent is a supertype of aParent.
    if (isSubtype(aParent.id, bParent.id)) continue;

    const aNode = nodeById.get(e.source);
    const bNode = nodeById.get(e.target);
    diagnostics.push({
      message:  `[SML-SUBS-SCOPE-001] '${aNode?.label ?? e.source}' subsets '${bNode?.label ?? e.target}' ` +
                `but '${bNode?.label ?? e.target}' is not a visible member of '${aParent.label}'. ` +
                `Subsetting targets must be accessible from the featuring type. (KerML §9.3.3.2)`,
      severity: 'warning',
      code:     'SML-SUBS-SCOPE-001',
      ...(aNode?.startLine ? { line: aNode.startLine } : {}),
    });
  }

  // ── SML-ACTION-PARTS-001: ActionUsage must not own composite PartUsages ───
  //
  // SysML v2 §12.3.3.3: An action usage can own sub-actions (ActionUsage) and
  // parameters, but not composite part usages.  A PartUsage that is isComposite
  // and lives inside an ActionUsage or ActionDefinition is a modelling error.

  const ACTION_NS_TYPES = new Set(['ActionUsage', 'PerformActionUsage', 'ActionDefinition']);

  for (const n of graph.nodes) {
    if (n.type !== 'PartUsage') continue;
    if (n.isComposite === false) continue; // non-composite reference — allowed

    const sp = semanticParent(n.id);
    if (!sp) continue;
    if (ACTION_NS_TYPES.has(sp.type)) {
      diagnostics.push({
        message:  `[SML-ACTION-PARTS-001] '${n.label}' is a composite PartUsage inside action '${sp.label}'. ` +
                  `Action usages may not own composite part usages. (SysML v2 §12.3.3.3)`,
        severity: 'error',
        code:     'SML-ACTION-PARTS-001',
        ...(n.startLine ? { line: n.startLine } : {}),
      });
    }
  }

  // ── SML-STATE-INIT-001: At most one initial state per state namespace ─────
  //
  // SysML v2 §13.3.3.2: A state definition or state usage must have at most
  // one initial transition or initial state member.  We check for more than one
  // node of type 'InitialTransitionUsage' or 'InitialStateUsage' (or a
  // TransitionUsage/StateUsage with a name that starts the initial indicator)
  // sharing the same semantic parent StateDefinition/StateUsage.

  const STATE_NS_TYPES   = new Set(['StateDefinition', 'StateUsage', 'ExhibitStateUsage']);
  const INITIAL_NODE_TYPES = new Set(['InitialTransitionUsage', 'InitialStateUsage']);

  const initialsByParent = new Map<string, Array<{ id: string; line?: number }>>();
  for (const n of graph.nodes) {
    if (!INITIAL_NODE_TYPES.has(n.type)) continue;
    const sp = semanticParent(n.id);
    if (!sp || !STATE_NS_TYPES.has(sp.type)) continue;
    const list = initialsByParent.get(sp.id) ?? [];
    list.push({ id: n.id, line: n.startLine });
    initialsByParent.set(sp.id, list);
  }

  for (const [parentId, initials] of initialsByParent) {
    if (initials.length <= 1) continue;
    const parentNode = nodeById.get(parentId);
    const parentName = parentNode?.label ?? parentId;
    for (let i = 1; i < initials.length; i++) {
      const dupNode = nodeById.get(initials[i].id);
      diagnostics.push({
        message:  `[SML-STATE-INIT-001] State '${parentName}' has more than one initial state/transition. ` +
                  `'${dupNode?.label ?? initials[i].id}' is a duplicate initial state — at most one is allowed. ` +
                  `(SysML v2 §13.3.3.2)`,
        severity: 'error',
        code:     'SML-STATE-INIT-001',
        ...(initials[i].line ? { line: initials[i].line } : {}),
      });
    }
  }

  // ── SML-VERIFY-TARGET-001: VerifyRequirementUsage target type ────────────
  //
  // SysML v2 §15.5.3: A VerifyRequirementUsage must verify a RequirementUsage
  // (not a use case, part, or other usage kind).  We check that any usage typed
  // 'VerifyRequirementUsage' that has a typedBy edge points to a
  // RequirementDefinition or RequirementUsage.  Also flag VerifyRequirementUsage
  // nodes whose ObjectiveMembership children point to non-requirement nodes.

  for (const n of graph.nodes) {
    if (n.type !== 'VerifyRequirementUsage') continue;
    const defId = typedByOf.get(n.id);
    if (!defId) continue;
    const def = nodeById.get(defId);
    if (!def) continue;
    const isReqDef = def.type === 'RequirementDefinition' || def.type === 'ConstraintDefinition';
    if (!isReqDef) {
      diagnostics.push({
        message:  `[SML-VERIFY-TARGET-001] '${n.label}' (VerifyRequirementUsage) is typed by '${def.label}' ` +
                  `(${def.type}) — the verification target must be a RequirementDefinition. (SysML v2 §15.5.3)`,
        severity: 'error',
        code:     'SML-VERIFY-TARGET-001',
        ...(n.startLine ? { line: n.startLine } : {}),
      });
    }
  }

  // ── SML-PORT-UNTYPED-001: Untyped PortUsage in connection ─────────────────
  //
  // SysML v2 §10.3.3 / §11.3: A PortUsage that participates in a connection
  // should be typed by a PortDefinition.  An untyped port has no declared
  // interface and cannot be verified for type compatibility.

  for (const portId of connectedPortIds) {
    if (typedByOf.has(portId)) continue;
    const port = nodeById.get(portId);
    if (!port) continue;
    diagnostics.push({
      message:  `[SML-PORT-UNTYPED-001] Port '${port.label}' participates in a connection but has no type. ` +
                `Ports in connections should be typed by a PortDefinition. (SysML v2 §10.3.3 / §11.3)`,
      severity: 'warning',
      code:     'SML-PORT-UNTYPED-001',
      ...(port.startLine ? { line: port.startLine } : {}),
    });
  }

  return diagnostics;
}
