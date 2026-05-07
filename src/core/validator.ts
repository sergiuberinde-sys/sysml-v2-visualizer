/*
 * This validator checks semantic consistency for the currently supported
 * SysML v2 subset. It is not yet a full SysML v2 conformance checker,
 * but supported constructs are validated strictly.
 */

import type { SysMLNode, ParseDiagnostic, ParseResult, PackageDefNode } from './modelTypes';

function diag(
  line: number,
  severity: ParseDiagnostic['severity'],
  code: string,
  message: string,
): ParseDiagnostic {
  return { line, severity, code, message };
}

// ── Type aliases ──────────────────────────────────────────────────────────────

type PartDefNode  = Extract<SysMLNode, { kind: 'partDef' }>;
type PortNode     = Extract<SysMLNode, { kind: 'port' }>;
type ConnNode     = Extract<SysMLNode, { kind: 'connection' }>;
type AliasNode    = Extract<SysMLNode, { kind: 'partAlias' }>;
type MsgNode      = Extract<SysMLNode, { kind: 'message' }>;
type AInstNode    = Extract<SysMLNode, { kind: 'actionInst' }>;
type ADefNode     = Extract<SysMLNode, { kind: 'actionDef' }>;
type OccNode      = Extract<SysMLNode, { kind: 'occurrenceDef' }>;
type RD           = Extract<SysMLNode, { kind: 'requirementDef' }>;
type TL           = Extract<SysMLNode, { kind: 'traceLink' }>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function namedNodes(nodes: SysMLNode[]): Array<{ name: string; namespace?: string; line: number; kind: string }> {
  return nodes.filter(n => 'name' in n) as never;
}

// ── Validator ─────────────────────────────────────────────────────────────────

export function validate(result: ParseResult): ParseDiagnostic[] {
  const { nodes } = result;
  const diagnostics: ParseDiagnostic[] = [];

  // ── Derived maps (built upfront so every check can reuse them) ────────────

  const ifaceNames = new Set<string>(
    nodes.filter(n => n.kind === 'interfaceDef').map(n => (n as { name: string }).name),
  );

  const partDefMap = new Map<string, PartDefNode>(
    nodes.filter((n): n is PartDefNode => n.kind === 'partDef').map(n => [n.name, n]),
  );

  const actionDefNames = new Set<string>(
    nodes.filter((n): n is ADefNode => n.kind === 'actionDef').map(n => n.name),
  );

  // Union of all declared type names — covers port types, part composition types.
  const allTypeNames = new Set<string>([...ifaceNames, ...partDefMap.keys()]);

  // All named element names — for reference resolution and ambiguity detection.
  const allNames  = new Set<string>();
  const nameCount = new Map<string, number>();
  for (const n of nodes) {
    if (!('name' in n)) continue;
    const node = n as { name: string; namespace?: string };
    allNames.add(node.name);
    if (node.namespace) allNames.add(`${node.namespace}::${node.name}`);
    nameCount.set(node.name, (nameCount.get(node.name) ?? 0) + 1);
  }

  // ── 0. WRONG_CONTEXT ─────────────────────────────────────────────────────
  // These kinds are only valid as children of a specific parent block.
  // Appearing in the flat node list means they were written outside any parent.

  const BODY_ONLY_KINDS = new Set([
    'port', 'connection', 'message', 'actionInst', 'flow', 'stateEntry', 'transition',
  ]);

  for (const node of nodes) {
    if (!BODY_ONLY_KINDS.has(node.kind)) continue;
    diagnostics.push(diag((node as { line: number }).line, 'error', 'WRONG_CONTEXT',
      `"${node.kind}" may only appear inside its parent block`,
    ));
  }

  // Also validate type reference for top-level / package-scope part usages.
  for (const node of nodes) {
    if (node.kind !== 'partAlias') continue;
    const alias = node as AliasNode;
    if (partDefMap.size > 0 && !partDefMap.has(alias.type)) {
      diagnostics.push(diag(alias.line, 'error', 'UNKNOWN_PART',
        `Unknown part type "${alias.type}" for part usage "${alias.name}"`,
      ));
    }
  }

  // Detect body items placed in a wrong parent block, e.g. a flow inside stateDef.
  const ALLOWED_BODY_KINDS: Partial<Record<string, Set<string>>> = {
    partDef:       new Set(['port', 'partAlias', 'connection']),
    occurrenceDef: new Set(['partAlias', 'message']),
    behaviorDef:   new Set(['actionInst', 'flow']),
    stateDef:      new Set(['stateEntry', 'transition']),
    requirementDef: new Set(),
  };

  for (const node of nodes) {
    if (!('body' in node) || node.kind === 'packageDef') continue;
    const allowed = ALLOWED_BODY_KINDS[node.kind];
    if (!allowed) continue;
    const parent = node as { kind: string; name: string; body: SysMLNode[]; line: number };
    for (const child of parent.body) {
      if (!allowed.has(child.kind)) {
        diagnostics.push(diag((child as { line: number }).line, 'error', 'WRONG_CONTEXT',
          `"${child.kind}" cannot appear inside "${parent.kind} ${parent.name}"`,
        ));
      }
    }
  }

  // ── 1. DUPLICATE_NAME — duplicate short name in the same namespace ─────────

  const seenNsKey = new Map<string, number>();
  for (const n of namedNodes(nodes)) {
    const key = n.namespace ? `${n.namespace}::${n.name}` : n.name;
    if (seenNsKey.has(key)) {
      diagnostics.push(diag(n.line, 'error', 'DUPLICATE_NAME',
        `Duplicate name "${n.name}" in namespace "${n.namespace || '(root)'}"`,
      ));
    } else {
      seenNsKey.set(key, n.line);
    }
  }

  // ── 2. Part def semantic checks ───────────────────────────────────────────

  for (const node of nodes) {
    if (node.kind !== 'partDef') continue;

    // Returns a map of port name → port node for a given part def type name.
    const portMapOf = (typeName: string): Map<string, PortNode> | undefined => {
      const def = partDefMap.get(typeName);
      if (!def) return undefined;
      return new Map(
        def.body.filter((b): b is PortNode => b.kind === 'port').map(p => [p.name, p]),
      );
    };

    // Port type resolution.
    for (const child of node.body) {
      if (child.kind !== 'port') continue;
      if (allTypeNames.size > 0 && !allTypeNames.has((child as PortNode).portType)) {
        diagnostics.push(diag((child as PortNode).line, 'error', 'UNKNOWN_INTERFACE',
          `Unknown interface type "${(child as PortNode).portType}" on port "${(child as PortNode).name}"`,
        ));
      }
    }

    // Part composition type resolution.
    for (const child of node.body) {
      if (child.kind !== 'partAlias') continue;
      if (partDefMap.size > 0 && !partDefMap.has((child as AliasNode).type)) {
        diagnostics.push(diag((child as AliasNode).line, 'error', 'UNKNOWN_PART',
          `Unknown part type "${(child as AliasNode).type}" for part "${(child as AliasNode).name}" in "${node.name}"`,
        ));
      }
    }

    // Connection checks: instances must exist, ports must exist, directions must be complementary.
    const instanceTypes = new Map<string, string>();
    for (const child of node.body) {
      if (child.kind === 'partAlias') instanceTypes.set((child as AliasNode).name, (child as AliasNode).type);
    }

    for (const child of node.body) {
      if (child.kind !== 'connection') continue;
      const conn = child as ConnNode;

      if (!instanceTypes.has(conn.fromPart)) {
        diagnostics.push(diag(conn.line, 'error', 'UNKNOWN_PART',
          `Unknown part instance "${conn.fromPart}" in "${node.name}"`,
        ));
        continue;
      }
      if (!instanceTypes.has(conn.toPart)) {
        diagnostics.push(diag(conn.line, 'error', 'UNKNOWN_PART',
          `Unknown part instance "${conn.toPart}" in "${node.name}"`,
        ));
        continue;
      }

      const fromPortMap = portMapOf(instanceTypes.get(conn.fromPart)!);
      const toPortMap   = portMapOf(instanceTypes.get(conn.toPart)!);

      if (fromPortMap && !fromPortMap.has(conn.fromPort)) {
        diagnostics.push(diag(conn.line, 'error', 'UNKNOWN_PORT',
          `"${instanceTypes.get(conn.fromPart)}" has no port "${conn.fromPort}"`,
        ));
      }
      if (toPortMap && !toPortMap.has(conn.toPort)) {
        diagnostics.push(diag(conn.line, 'error', 'UNKNOWN_PORT',
          `"${instanceTypes.get(conn.toPart)}" has no port "${conn.toPort}"`,
        ));
      }

      // Port direction compatibility: connected ports must have complementary directions
      // (one in, one out) so data flows correctly between components.
      if (fromPortMap && toPortMap) {
        const fp = fromPortMap.get(conn.fromPort);
        const tp = toPortMap.get(conn.toPort);
        if (fp && tp && fp.direction === tp.direction) {
          diagnostics.push(diag(conn.line, 'error', 'INCOMPATIBLE_PORT_DIRECTION',
            `Port "${conn.fromPort}" (${fp.direction}) and "${conn.toPort}" (${tp.direction}) have the same direction — connected ports must be complementary`,
          ));
        }
      }
    }
  }

  // ── 3. Occurrence def — participants / duplicate messages ─────────────────

  for (const node of nodes) {
    if (node.kind !== 'occurrenceDef') continue;
    const occ = node as OccNode;

    const participants = new Set<string>(
      occ.body.filter((b): b is AliasNode => b.kind === 'partAlias').map(a => a.name),
    );

    const seenMsgNames = new Set<string>();

    for (const child of occ.body) {
      if (child.kind !== 'message') continue;
      const msg = child as MsgNode;

      if (seenMsgNames.has(msg.name)) {
        diagnostics.push(diag(msg.line, 'error', 'DUPLICATE_NAME',
          `Duplicate message "${msg.name}" in occurrence "${occ.name}"`,
        ));
      } else {
        seenMsgNames.add(msg.name);
      }

      if (participants.size > 0) {
        if (!participants.has(msg.from)) {
          diagnostics.push(diag(msg.line, 'error', 'UNKNOWN_PART',
            `Message "from" participant "${msg.from}" not declared in "${occ.name}"`,
          ));
        }
        if (!participants.has(msg.to)) {
          diagnostics.push(diag(msg.line, 'error', 'UNKNOWN_PART',
            `Message "to" participant "${msg.to}" not declared in "${occ.name}"`,
          ));
        }
      }
    }
  }

  // ── 4. State machine — states / transitions / determinism ────────────────

  for (const node of nodes) {
    if (node.kind !== 'stateDef') continue;

    const seen       = new Set<string>();
    const stateNames = new Set<string>();
    let   hasInitial = false;

    for (const child of node.body) {
      if (child.kind !== 'stateEntry') continue;
      if (seen.has(child.name)) {
        diagnostics.push(diag(child.line, 'error', 'DUPLICATE_NAME',
          `Duplicate state "${child.name}" in "${node.name}"`,
        ));
      }
      seen.add(child.name);
      stateNames.add(child.name);
    }

    // key: "fromState::event" — two transitions from the same state on the same event
    // would create a non-deterministic state machine.
    const seenTransitions = new Map<string, number>();

    for (const child of node.body) {
      if (child.kind !== 'transition') continue;

      if (child.from === '') {
        hasInitial = true;
        if (!stateNames.has(child.to)) {
          diagnostics.push(diag(child.line, 'error', 'UNKNOWN_STATE',
            `Initial transition targets unknown state "${child.to}"`,
          ));
        }
      } else {
        if (stateNames.size > 0 && !stateNames.has(child.from)) {
          diagnostics.push(diag(child.line, 'error', 'UNKNOWN_STATE',
            `Transition from unknown state "${child.from}"`,
          ));
        }
        if (stateNames.size > 0 && !stateNames.has(child.to)) {
          diagnostics.push(diag(child.line, 'error', 'UNKNOWN_STATE',
            `Transition to unknown state "${child.to}"`,
          ));
        }

        const transKey = `${child.from}::${child.event}`;
        if (seenTransitions.has(transKey)) {
          const eventDesc = child.event ? ` on event "${child.event}"` : ' (no event)';
          diagnostics.push(diag(child.line, 'error', 'DUPLICATE_TRANSITION',
            `Non-deterministic transition: "${child.from}"${eventDesc} already has a transition in "${node.name}"`,
          ));
        } else {
          seenTransitions.set(transKey, child.line);
        }
      }
    }

    if (stateNames.size > 0 && !hasInitial) {
      diagnostics.push(diag(node.line, 'warning', 'MISSING_INITIAL_STATE',
        `State machine "${node.name}" has no initial transition`,
      ));
    }
  }

  // ── 5. Behavior def — action instances / flows ───────────────────────────

  for (const node of nodes) {
    if (node.kind !== 'behaviorDef') continue;

    const seen             = new Set<string>();
    const localActionNames = new Set<string>();

    for (const child of node.body) {
      if (child.kind !== 'actionInst') continue;
      const ai = child as AInstNode;
      if (seen.has(ai.name)) {
        diagnostics.push(diag(ai.line, 'error', 'DUPLICATE_NAME',
          `Duplicate action "${ai.name}" in behavior "${node.name}"`,
        ));
      }
      seen.add(ai.name);
      localActionNames.add(ai.name);

      if (actionDefNames.size > 0 && !actionDefNames.has(ai.actionType)) {
        diagnostics.push(diag(ai.line, 'error', 'UNKNOWN_ACTION',
          `Unknown action type "${ai.actionType}" in behavior "${node.name}"`,
        ));
      }
    }

    for (const child of node.body) {
      if (child.kind !== 'flow') continue;
      if (!localActionNames.has(child.from)) {
        diagnostics.push(diag(child.line, 'error', 'UNKNOWN_ACTION',
          `Flow references unknown action "${child.from}"`,
        ));
      }
      if (!localActionNames.has(child.to)) {
        diagnostics.push(diag(child.line, 'error', 'UNKNOWN_ACTION',
          `Flow references unknown action "${child.to}"`,
        ));
      }
    }
  }

  // ── 6. Requirements / trace links ────────────────────────────────────────

  const reqs  = nodes.filter((n): n is RD => n.kind === 'requirementDef');
  const links = nodes.filter((n): n is TL => n.kind === 'traceLink');

  const reqNames = new Set<string>();
  for (const n of nodes) {
    if (n.kind !== 'requirementDef') continue;
    const node = n as { name: string; namespace?: string };
    reqNames.add(node.name);
    if (node.namespace) reqNames.add(`${node.namespace}::${node.name}`);
  }

  const seenReqIds = new Map<string, number>();
  for (const req of reqs) {
    if (!req.reqId) {
      diagnostics.push(diag(req.line, 'error', 'MISSING_REQUIREMENT_ID',
        `Requirement "${req.name}" is missing an id field`,
      ));
    } else if (seenReqIds.has(req.reqId)) {
      diagnostics.push(diag(req.line, 'error', 'DUPLICATE_REQUIREMENT_ID',
        `Duplicate requirement id "${req.reqId}"`,
      ));
    } else {
      seenReqIds.set(req.reqId, req.line);
    }
    if (!req.text) {
      diagnostics.push(diag(req.line, 'info', 'MISSING_REQUIREMENT_TEXT',
        `Requirement "${req.name}" has no text field`,
      ));
    }
  }

  for (const link of links) {
    if (!allNames.has(link.source)) {
      const ambiguous = (nameCount.get(link.source) ?? 0) > 1;
      diagnostics.push(diag(link.line, 'error',
        ambiguous ? 'AMBIGUOUS_REFERENCE' : 'BROKEN_TRACE_LINK',
        ambiguous
          ? `Ambiguous reference "${link.source}" (exists in multiple namespaces) — use a qualified name`
          : `Traceability source "${link.source}" not found in model`,
      ));
    }
    if (!reqNames.has(link.target)) {
      diagnostics.push(diag(link.line, 'error', 'BROKEN_TRACE_LINK',
        `Traceability target "${link.target}" is not a defined requirement`,
      ));
    }
  }

  // ── 7. AMBIGUOUS_REFERENCE — names that exist in multiple namespaces ──────
  // These are not errors in themselves, but any unqualified reference to such a
  // name is ambiguous and must be qualified to be valid.

  for (const node of namedNodes(nodes)) {
    const count = nameCount.get(node.name) ?? 0;
    if (count > 1 && node.namespace) {
      diagnostics.push(diag(node.line, 'error', 'AMBIGUOUS_REFERENCE',
        `"${node.name}" exists in multiple namespaces — use "${node.namespace}::${node.name}" for unambiguous references`,
      ));
    }
  }

  // ── Debug summary ─────────────────────────────────────────────────────────

  const countsByCode: Record<string, number> = {};
  for (const d of diagnostics) {
    countsByCode[d.code ?? '(no code)'] = (countsByCode[d.code ?? '(no code)'] ?? 0) + 1;
  }
  console.log('Validator diagnostics by code', countsByCode);

  return diagnostics;
}

// ── Element line collector (for inspector "related diagnostics") ───────────────

export function elementLines(
  name: string,
  namespace: string | undefined,
  nodes: SysMLNode[],
  packages: PackageDefNode[],
): Set<number> {
  const lines = new Set<number>();

  function scanNodes(ns: SysMLNode[]) {
    for (const node of ns) {
      if ('name' in node && (node as { name: string }).name === name) {
        lines.add((node as { line: number }).line);
        if ('body' in node) {
          for (const child of (node as { body: SysMLNode[] }).body) {
            if ('line' in child) lines.add((child as { line: number }).line);
          }
        }
      }
      if ('body' in node) scanNodes((node as { body: SysMLNode[] }).body);
    }
  }

  function scanPkgs(pkgs: PackageDefNode[]) {
    for (const pkg of pkgs) {
      if (pkg.name === name && (namespace === undefined || pkg.namespace === namespace)) {
        lines.add(pkg.line);
      }
      scanPkgs(pkg.body.filter((n): n is PackageDefNode => n.kind === 'packageDef'));
    }
  }

  scanNodes(nodes);
  scanPkgs(packages);
  return lines;
}
