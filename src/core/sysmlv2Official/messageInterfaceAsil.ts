/**
 * Message ↔ interface-port ASIL derivation for SysML v2 sequence views.
 *
 * The safety model deliberately keeps sequence `message`s free of any @ASIL of
 * their own. Instead, each message is linked to its two *structural* interface
 * ports through a pair of explicit `dependency` elements owned by the enclosing
 * sequence action definition:
 *
 *   message commandFsp1 of SmuFspActivationCommand
 *       from handler.fsp1CommandSent to smu.fsp1CommandReceived;
 *   dependency commandFsp1SenderInterface
 *       from commandFsp1 to SafetyExceptionHandlerSw::fspActivationCommand;
 *   dependency commandFsp1ReceiverInterface
 *       from commandFsp1 to Tc4zSmuHw::fspActivationCommand;
 *
 *   port fspActivationCommand : SmuFspActivationCommandOut { @ASIL { level = ASILLevel::ASIL_D; } }
 *
 * The AUTHORITATIVE ASIL lives on those two supplier `PortUsage`s. We resolve
 * them and derive a per-message ASIL STRICTLY from the two endpoints — never
 * from lifelines, payload/item types, owning-part ASIL, action ASIL, message
 * names, or similarly-named ports. The two dependencies are the only sanctioned
 * mapping between a message and its structural endpoint ports.
 *
 * ── Extraction source & documented limitation ────────────────────────────────
 * A `Dependency`'s client/supplier are EMF *cross-references*. The Java parser
 * wrapper emits `eContents()` (owned containment) only, so a Dependency arrives
 * in the raw model tree as a bare node with NO children — its client/supplier
 * are absent from the AST. We therefore read the client/supplier from the
 * parser's resolved *occurrence table* (`symbols`), whose `symbolKey`s are the
 * parser's fully-qualified, name-resolved identifiers (parser output — not a
 * regex of the source text). {@link extractDependencyMappings} is the single,
 * isolated place that depends on that occurrence table.
 *
 * Limitation: the occurrence table covers the PRIMARY parsed file only, so
 * dependencies are derived for the primary file's sequences — which is exactly
 * what a sequence view renders. Cross-file/context dependencies are out of scope
 * by construction (and cannot arise here: a sequence's dependencies are owned by
 * the same action definition that owns its messages).
 */

// ── Public data model ────────────────────────────────────────────────────────

/** A retained traceability/mapping `dependency` element (message → interface port). */
export interface DependencyMapping {
  /** Local declared name, e.g. `commandFsp1SenderInterface`. */
  name: string;
  /** Fully-qualified name of the client (the message), e.g. `Pkg::Seq::commandFsp1`. */
  clientQualifiedName: string;
  /** Fully-qualified name of the supplier (the structural port), e.g. `Tc4zSmuHw::fspActivationCommand`. */
  supplierQualifiedName: string;
  /** Fully-qualified name of the owner (the sequence action definition), e.g. `Pkg::Seq`. */
  ownerQualifiedName: string;
}

/** One resolved (or unresolvable) structural interface endpoint of a message. */
export interface InterfaceEndpoint {
  /** The supplier port's qualified name as written on the dependency (`Type::port`). */
  qualifiedName: string;
  /** True when that supplier port was found in the model. */
  resolved: boolean;
  /** The port's `@ASIL` level (e.g. `ASIL_D`), when the port both resolved and carries one. */
  asil?: string;
}

export type MessageAsilStatus =
  | 'resolved'    // both endpoints resolved and carry the SAME ASIL
  | 'partial'     // both ports resolved but only ONE carries an ASIL
  | 'conflict'    // both ports carry an ASIL and they DIFFER
  | 'unassigned'  // both ports resolved, NEITHER carries an ASIL
  | 'unresolved'; // a dependency or a supplier port is missing / could not be resolved

/**
 * The derived ASIL of a message. Kept intentionally separate from any explicitly
 * stored @ASIL metadata — this is a *derived* view, never written back to the model.
 */
export interface DerivedMessageAsil {
  status: MessageAsilStatus;
  /** The agreed ASIL level, present only for `resolved`. */
  level?: string;
  sender?: InterfaceEndpoint;
  receiver?: InterfaceEndpoint;
  /** The single concrete interface endpoint, for the one-`StructuralInterface`-per-message variant. */
  endpoint?: InterfaceEndpoint;
  diagnostic?: string;
}

// ── Duck-typed inputs (compatible with both parser-service and web adapter shapes) ──

interface RawNodeLike { type: string; name?: string | null; startLine?: number; endLine?: number; children?: RawNodeLike[] }
interface RawSymbolLike { role: string; symbolKey: string; line: number; column: number }
interface GraphNodeLike { id: string; label: string; type: string; asil?: string }
interface GraphEdgeLike { source: string; target: string; type: string }
interface GraphLike { nodes: GraphNodeLike[]; edges: GraphEdgeLike[] }

// ── 1. Dependency extraction (the ONLY occurrence-table dependency) ───────────

/**
 * Recover `DependencyMapping`s from the raw model tree + resolved occurrence table.
 *
 * The AST identifies WHICH declarations are dependencies (their names); the
 * occurrence table supplies each dependency's resolved client and supplier. For a
 * `dependency X from CLIENT to SUPPLIER;` the parser emits, in source order, a
 * `decl` occurrence for `X` immediately followed by two `ref` occurrences —
 * `CLIENT` then `SUPPLIER` — with no intervening declaration. We rely on exactly
 * that adjacency (there are no other identifiers on a dependency's two lines).
 */
export function extractDependencyMappings(
  model: RawNodeLike[] | undefined,
  symbols: RawSymbolLike[] | undefined,
): DependencyMapping[] {
  if (!model?.length || !symbols?.length) return [];

  // Names of every Dependency element in the AST — used to recognise dependency
  // `decl` occurrences without depending on a naming convention.
  const depNames = new Set<string>();
  const stack: RawNodeLike[] = [...model];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.type === 'Dependency' && n.name) depNames.add(n.name);
    if (n.children) for (const c of n.children) stack.push(c);
  }
  if (depNames.size === 0) return [];

  const sorted = [...symbols].sort((a, b) => a.line - b.line || a.column - b.column);
  const out: DependencyMapping[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.role !== 'decl') continue;
    const last = lastSegment(s.symbolKey);
    if (!depNames.has(last)) continue;
    // The two ref occurrences up to the next decl are `from CLIENT to SUPPLIER`.
    const refs: RawSymbolLike[] = [];
    for (let j = i + 1; j < sorted.length && refs.length < 2; j++) {
      if (sorted[j].role === 'decl') break;
      if (sorted[j].role === 'ref') refs.push(sorted[j]);
    }
    if (refs.length < 2) continue; // malformed dependency — skip rather than guess
    out.push({
      name: last,
      ownerQualifiedName: ownerOf(s.symbolKey),
      clientQualifiedName: refs[0].symbolKey,
      supplierQualifiedName: refs[1].symbolKey,
    });
  }
  return out;
}

// ── 1b. All-files dependency extraction (AST-position-driven textual fallback) ─

/** Scope element types whose names build a qualified name (mirrors the graph-side set). */
const QNAME_SCOPE_TYPES = new Set([
  'Package', 'LibraryPackage', 'PartDefinition', 'ActionDefinition', 'ItemDefinition',
  'PortDefinition', 'ConnectionDefinition', 'InterfaceDefinition', 'AttributeDefinition',
]);

// `from <client> to <Type::port>` — client is a local message name; supplier is qualified.
const DEP_FROM_TO = /\bfrom\s+([A-Za-z_]\w*(?:\.\w+)*)\s+to\s+([A-Za-z_][\w.]*(?:::[\w.]+)+)/;

export interface DependencySource { text: string; model: RawNodeLike[] | undefined }

/**
 * Extract `DependencyMapping`s for EVERY provided source file (primary + context).
 *
 * Why this exists alongside {@link extractDependencyMappings}: a Dependency's
 * client/supplier are EMF cross-references absent from the AST, and the parser's
 * resolved occurrence table (`symbols`) covers only the PRIMARY parsed file. A
 * sequence view, however, lets you browse every file's sequences at once, so the
 * badge must resolve regardless of which file is currently the parse primary.
 *
 * For each Dependency node the AST still gives us its exact source span
 * (startLine..endLine) and its position in the containment tree. We read the
 * `from CLIENT to SUPPLIER` off those precise lines and build the owner/client
 * qualified names from the Package/Definition ancestors — matching the qualified
 * names the graph produces. This is the documented textual fallback the AST cannot
 * otherwise supply; it is confined here and anchored to AST node positions rather
 * than a free-form scan of the source.
 */
export function extractDependencyMappingsFromSources(sources: DependencySource[]): DependencyMapping[] {
  const out: DependencyMapping[] = [];
  for (const { text, model } of sources) {
    if (!model?.length || !text) continue;
    const lines = text.split(/\r?\n/);
    const visit = (nodes: RawNodeLike[], ownerPath: string[]): void => {
      for (const n of nodes) {
        const scoped = QNAME_SCOPE_TYPES.has(n.type) && n.name ? [...ownerPath, n.name] : ownerPath;
        const sl = n.startLine;
        if (n.type === 'Dependency' && n.name && sl) {
          const el = n.endLine ?? sl;
          const m = DEP_FROM_TO.exec(lines.slice(sl - 1, el).join(' '));
          if (m) {
            const owner = ownerPath.join('::');
            out.push({
              name: n.name,
              ownerQualifiedName: owner,
              clientQualifiedName: owner ? `${owner}::${m[1]}` : m[1],
              supplierQualifiedName: m[2],
            });
          }
        }
        if (n.children) visit(n.children, scoped);
      }
    };
    visit(model, []);
  }
  return out;
}

// ── 2. Structural resolution: supplier `Type::port` → PortUsage ASIL ──────────

const DEF_TYPES = new Set([
  'PartDefinition', 'ItemDefinition', 'PortDefinition', 'ActionDefinition',
  'ConnectionDefinition', 'InterfaceDefinition', 'AttributeDefinition',
]);

/** Lookup tables built from the containment graph: which ports exist, and their ASILs. */
export interface PortAsilIndex {
  /** `Def::port` → ASIL level, for ports that carry an `@ASIL`. */
  asil: Map<string, string>;
  /** every `Def::port` that resolves to a real PortUsage (with or without an ASIL). */
  exists: Set<string>;
}

/** Structural endpoint element kinds a dependency supplier can name. */
const ENDPOINT_TYPES = new Set(['PortUsage', 'InterfaceUsage']);
const PACKAGE_TYPES = new Set(['Package', 'LibraryPackage']);

/**
 * Index every structural endpoint (`PortUsage` and `InterfaceUsage`) so a
 * dependency supplier can be resolved to the concrete element and its `@ASIL`
 * read off it. Each endpoint is registered under BOTH forms suppliers use across
 * model variants:
 *   • fully-qualified   `Package::…::Def::name`  (e.g. `Architecture::HvmSoftwarePartitionSw::hvmUntrustedTrapReport`)
 *   • definition-local  `Def::name`              (e.g. `SafetyExceptionHandlerSw::fspActivationCommand`)
 * Resolution then works whether the model qualifies suppliers to the package or
 * just to the owning definition.
 */
export function buildPortAsilIndex(graph: GraphLike): PortAsilIndex {
  const byId = new Map(graph.nodes.map(n => [n.id, n] as const));
  const parentOf = new Map<string, string>();
  for (const e of graph.edges) if (e.type === 'contains') parentOf.set(e.target, e.source);

  // Package/Definition ancestor labels (top-down) plus the nearest owning definition.
  const ancestry = (id: string): { path: string[]; nearestDef?: string } => {
    const path: string[] = [];
    let nearestDef: string | undefined;
    let cur = parentOf.get(id);
    while (cur) {
      const p = byId.get(cur);
      if (p && p.label && p.label !== p.type) {
        if (DEF_TYPES.has(p.type)) { if (!nearestDef) nearestDef = p.label; path.unshift(p.label); }
        else if (PACKAGE_TYPES.has(p.type)) path.unshift(p.label);
      }
      cur = parentOf.get(cur);
    }
    return { path, nearestDef };
  };

  const asil = new Map<string, string>();
  const exists = new Set<string>();
  const add = (qn: string, a?: string) => { exists.add(qn); if (a) asil.set(qn, a); };
  for (const n of graph.nodes) {
    if (!ENDPOINT_TYPES.has(n.type) || !n.label) continue;
    const { path, nearestDef } = ancestry(n.id);
    if (path.length)  add(`${path.join('::')}::${n.label}`, n.asil); // fully-qualified
    if (nearestDef)   add(`${nearestDef}::${n.label}`, n.asil);      // definition-local (legacy)
  }
  return { asil, exists };
}

/** Resolve a dependency supplier to an interface endpoint (found? ASIL?). */
export function resolveInterfaceEndpoint(supplierQualifiedName: string, index: PortAsilIndex): InterfaceEndpoint {
  if (index.asil.has(supplierQualifiedName)) {
    return { qualifiedName: supplierQualifiedName, resolved: true, asil: index.asil.get(supplierQualifiedName) };
  }
  if (index.exists.has(supplierQualifiedName)) {
    return { qualifiedName: supplierQualifiedName, resolved: true };
  }
  return { qualifiedName: supplierQualifiedName, resolved: false };
}

// ── 3. Derivation rule (pure) ────────────────────────────────────────────────

/**
 * Derive a message's ASIL from its two endpoints. Never picks a "highest" ASIL:
 *   both same        → resolved (that level)
 *   both differ      → conflict (both shown)
 *   exactly one set  → partial  (displayed as "unresolved")
 *   neither set      → unassigned (no badge)
 *   dep/port missing → unresolved
 */
export function deriveMessageAsil(
  sender: InterfaceEndpoint | undefined,
  receiver: InterfaceEndpoint | undefined,
): DerivedMessageAsil {
  if (!sender || !receiver) {
    const which = !sender && !receiver ? 'sender and receiver' : !sender ? 'sender' : 'receiver';
    return { status: 'unresolved', sender, receiver,
      diagnostic: `Missing ${which} interface dependency; ASIL is not derived (never guessed).` };
  }
  if (!sender.resolved || !receiver.resolved) {
    return { status: 'unresolved', sender, receiver,
      diagnostic: 'An interface supplier port could not be resolved in the model; ASIL is not derived.' };
  }
  const s = sender.asil, r = receiver.asil;
  if (!s && !r) return { status: 'unassigned', sender, receiver, diagnostic: 'Neither interface port carries an @ASIL.' };
  if (!s || !r) return { status: 'partial', sender, receiver,
    diagnostic: 'Only one interface port carries an @ASIL — the mapping is partial, so no single ASIL is derived.' };
  if (s !== r) return { status: 'conflict', sender, receiver,
    diagnostic: `Endpoint ASILs disagree (sender ${asilShort(s)}, receiver ${asilShort(r)}); not auto-resolved.` };
  return { status: 'resolved', level: s, sender, receiver };
}

/**
 * Derive a message's ASIL from a SINGLE concrete interface endpoint (the
 * one-`<msg>StructuralInterface`-per-message variant, where `@ASIL` sits on the
 * referenced `interface`/`InterfaceUsage`). No partial/conflict is possible with
 * a single endpoint: the interface's ASIL is the message's, or it is unassigned /
 * unresolved.
 */
export function deriveSingleInterfaceAsil(endpoint: InterfaceEndpoint): DerivedMessageAsil {
  if (!endpoint.resolved) {
    return { status: 'unresolved', endpoint,
      diagnostic: 'The interface supplier could not be resolved in the model; ASIL is not derived.' };
  }
  if (endpoint.asil) return { status: 'resolved', level: endpoint.asil, endpoint };
  return { status: 'unassigned', endpoint, diagnostic: 'The interface carries no @ASIL.' };
}

// ── 4. Convenience wiring ────────────────────────────────────────────────────

export interface MessageDependencies {
  sender?: DependencyMapping;
  receiver?: DependencyMapping;
  /** A single concrete interface (e.g. `<msg>StructuralInterface`) — used when there is no sender/receiver pair. */
  single?: DependencyMapping;
}

/**
 * Group the flat dependency list by client (message) qualified name. A message is
 * mapped either by a sender/receiver PAIR (`<msg>SenderInterface`/`ReceiverInterface`)
 * or by a SINGLE concrete interface (any other single dependency, e.g.
 * `<msg>StructuralInterface`) — whichever the model uses.
 */
export function indexDependenciesByClient(deps: DependencyMapping[]): Map<string, MessageDependencies> {
  const m = new Map<string, MessageDependencies>();
  for (const d of deps) {
    const e = m.get(d.clientQualifiedName) ?? {};
    if (/SenderInterface$/.test(d.name)) e.sender = d;
    else if (/ReceiverInterface$/.test(d.name)) e.receiver = d;
    else e.single = d;
    m.set(d.clientQualifiedName, e);
  }
  return m;
}

/**
 * Full derivation for one message qualified name. Returns `undefined` when the
 * message participates in NO interface dependency at all (it is simply outside
 * the ASIL-mapping scheme → no badge). A message with exactly one dependency is
 * derived as `unresolved` (a partial mapping is flagged, never guessed).
 */
export function deriveMessageAsilFor(
  messageQualifiedName: string,
  depsByClient: Map<string, MessageDependencies>,
  portIndex: PortAsilIndex,
): DerivedMessageAsil | undefined {
  const md = depsByClient.get(messageQualifiedName);
  if (!md) return undefined;
  // Sender/receiver PAIR variant (two structural endpoints).
  if (md.sender || md.receiver) {
    const sender = md.sender ? resolveInterfaceEndpoint(md.sender.supplierQualifiedName, portIndex) : undefined;
    const receiver = md.receiver ? resolveInterfaceEndpoint(md.receiver.supplierQualifiedName, portIndex) : undefined;
    return deriveMessageAsil(sender, receiver);
  }
  // Single concrete interface variant.
  if (md.single) {
    return deriveSingleInterfaceAsil(resolveInterfaceEndpoint(md.single.supplierQualifiedName, portIndex));
  }
  return undefined;
}

// ── 5. Presentation helpers (shared by the badge + tooltip) ───────────────────

/** 'ASIL_D' → 'D'; 'QM' → 'QM'. */
export function asilShort(level: string): string {
  return level.startsWith('ASIL_') ? level.slice(5) : level;
}

/** Short human label for the derived status, for the "Derived ASIL:" line. */
export function derivedAsilLabel(d: DerivedMessageAsil): string {
  switch (d.status) {
    case 'resolved':   return d.level ? asilShort(d.level) : 'resolved';
    case 'conflict':   return 'conflict';
    case 'partial':    return 'unresolved (partial mapping)';
    case 'unassigned': return 'unassigned';
    case 'unresolved': return 'unresolved';
  }
}

function endpointLine(role: string, ep: InterfaceEndpoint | undefined): string {
  const header = role === 'Interface' ? 'Interface:' : `${role} interface:`;
  if (!ep) return `${header}\n(no dependency)`;
  const asil = !ep.resolved ? 'unresolved' : ep.asil ? `ASIL ${asilShort(ep.asil)}` : 'ASIL unassigned';
  return `${header}\n${ep.qualifiedName}\n${asil}`;
}

/** Multi-line details text for the badge tooltip / details panel. */
export function describeMessageAsil(
  d: DerivedMessageAsil,
  opts: { message: string; payload?: string },
): string {
  const lines = [`Message: ${opts.message}`];
  if (opts.payload) lines.push(`Payload: ${opts.payload}`);
  lines.push(`Derived ASIL: ${derivedAsilLabel(d)}`);
  if (d.diagnostic) lines.push(d.diagnostic);
  if (d.endpoint) {
    lines.push('', endpointLine('Interface', d.endpoint));
  } else {
    lines.push('', endpointLine('Sender', d.sender), '', endpointLine('Receiver', d.receiver));
  }
  return lines.join('\n');
}

// ── internals ────────────────────────────────────────────────────────────────

function lastSegment(qn: string): string { const i = qn.lastIndexOf('::'); return i < 0 ? qn : qn.slice(i + 2); }
function ownerOf(qn: string): string { const i = qn.lastIndexOf('::'); return i < 0 ? '' : qn.slice(0, i); }
