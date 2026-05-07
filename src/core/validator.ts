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

// Only requires 'name' in n — nodes that have a namespace property (even undefined)
// and those that don't are both included.
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

  // Union of all known type names — used to validate port types and action types
  // without requiring a separate interface def per category.
  const allTypeNames = new Set<string>([...ifaceNames, ...partDefMap.keys()]);

  // All named element names in the model (for trace-link and reference checks).
  const allNames    = new Set<string>();
  const nameCount   = new Map<string, number>();
  for (const n of nodes) {
    if (!('name' in n)) continue;
    const node = n as { name: string; namespace?: string };
    allNames.add(node.name);
    if (node.namespace) allNames.add(`${node.namespace}::${node.name}`);
    nameCount.set(node.name, (nameCount.get(node.name) ?? 0) + 1);
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

  // ── 2. UNKNOWN_INTERFACE / UNKNOWN_PART / UNKNOWN_PORT ────────────────────

  for (const node of nodes) {
    if (node.kind !== 'partDef') continue;

    // Port type check — uses allTypeNames (interface defs + part defs) so it
    // fires whenever any type declarations exist in the model, not only when
    // there are interface defs.
    for (const child of node.body) {
      if (child.kind === 'port' && allTypeNames.size > 0 && !allTypeNames.has((child as PortNode).portType)) {
        diagnostics.push(diag((child as PortNode).line, 'error', 'UNKNOWN_INTERFACE',
          `Unknown interface type "${(child as PortNode).portType}" on port "${(child as PortNode).name}"`,
        ));
      }
    }

    // Part-composition type check — verifies that each sub-part alias references
    // a known part definition.
    for (const child of node.body) {
      if (child.kind === 'partAlias' && partDefMap.size > 0 && !partDefMap.has((child as AliasNode).type)) {
        diagnostics.push(diag((child as AliasNode).line, 'error', 'UNKNOWN_PART',
          `Unknown part type "${(child as AliasNode).type}" for part "${(child as AliasNode).name}" in "${node.name}"`,
        ));
      }
    }

    // Connection reference checks.
    const instanceTypes = new Map<string, string>();
    for (const child of node.body) {
      if (child.kind === 'partAlias') instanceTypes.set((child as AliasNode).name, (child as AliasNode).type);
    }

    const portNamesOf = (typeName: string): Set<string> | undefined => {
      const def = partDefMap.get(typeName);
      if (!def) return undefined;
      return new Set(def.body.filter((b): b is PortNode => b.kind === 'port').map(p => p.name));
    };

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

      const fromPorts = portNamesOf(instanceTypes.get(conn.fromPart)!);
      if (fromPorts && !fromPorts.has(conn.fromPort)) {
        diagnostics.push(diag(conn.line, 'error', 'UNKNOWN_PORT',
          `"${instanceTypes.get(conn.fromPart)}" has no port "${conn.fromPort}"`,
        ));
      }

      const toPorts = portNamesOf(instanceTypes.get(conn.toPart)!);
      if (toPorts && !toPorts.has(conn.toPort)) {
        diagnostics.push(diag(conn.line, 'error', 'UNKNOWN_PORT',
          `"${instanceTypes.get(conn.toPart)}" has no port "${conn.toPort}"`,
        ));
      }
    }
  }

  // ── 3. Occurrence def — unknown message participants ──────────────────────

  for (const node of nodes) {
    if (node.kind !== 'occurrenceDef') continue;
    const occ = node as OccNode;

    // Participants declared with "part name : Type;" inside the occurrence.
    const participants = new Set<string>(
      occ.body.filter((b): b is AliasNode => b.kind === 'partAlias').map(a => a.name),
    );

    if (participants.size > 0) {
      for (const child of occ.body) {
        if (child.kind !== 'message') continue;
        const msg = child as MsgNode;
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

  // ── 4. UNKNOWN_STATE / MISSING_INITIAL_STATE / DUPLICATE_STATE ───────────

  for (const node of nodes) {
    if (node.kind !== 'stateDef') continue;

    const seen       = new Set<string>();
    const stateNames = new Set<string>();
    let   hasInitial = false;

    for (const child of node.body) {
      if (child.kind === 'stateEntry') {
        if (seen.has(child.name)) {
          diagnostics.push(diag(child.line, 'warning', 'DUPLICATE_STATE',
            `Duplicate state "${child.name}" in "${node.name}"`,
          ));
        }
        seen.add(child.name);
        stateNames.add(child.name);
      }
    }

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
      }
    }

    if (stateNames.size > 0 && !hasInitial) {
      diagnostics.push(diag(node.line, 'warning', 'MISSING_INITIAL_STATE',
        `State machine "${node.name}" has no initial transition`,
      ));
    }
  }

  // ── 5. UNKNOWN_ACTION / DUPLICATE_ACTION ─────────────────────────────────

  for (const node of nodes) {
    if (node.kind !== 'behaviorDef') continue;

    const seen        = new Set<string>();
    const localActionNames = new Set<string>();

    for (const child of node.body) {
      if (child.kind !== 'actionInst') continue;
      const ai = child as AInstNode;
      if (seen.has(ai.name)) {
        diagnostics.push(diag(ai.line, 'warning', 'DUPLICATE_ACTION',
          `Duplicate action "${ai.name}" in behavior "${node.name}"`,
        ));
      }
      seen.add(ai.name);
      localActionNames.add(ai.name);

      // Check that the referenced action type is a known action definition.
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

  // ── 6. BROKEN_TRACE_LINK / AMBIGUOUS_REFERENCE / DUPLICATE_REQUIREMENT_ID ─

  const reqs  = nodes.filter((n): n is RD => n.kind === 'requirementDef');
  const links = nodes.filter((n): n is TL => n.kind === 'traceLink');

  const reqNames = new Set<string>();
  for (const n of nodes) {
    if (n.kind !== 'requirementDef') continue;
    const node = n as { name: string; namespace?: string };
    reqNames.add(node.name);
    if (node.namespace) reqNames.add(`${node.namespace}::${node.name}`);
  }

  const seenIds = new Map<string, number>();
  for (const req of reqs) {
    if (!req.reqId) {
      diagnostics.push(diag(req.line, 'warning', 'MISSING_REQUIREMENT_ID',
        `Requirement "${req.name}" is missing an id field`,
      ));
    } else if (seenIds.has(req.reqId)) {
      diagnostics.push(diag(req.line, 'error', 'DUPLICATE_REQUIREMENT_ID',
        `Duplicate requirement id "${req.reqId}"`,
      ));
    } else {
      seenIds.set(req.reqId, req.line);
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
          ? `Ambiguous reference "${link.source}" (exists in multiple namespaces)`
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

  for (const node of namedNodes(nodes)) {
    const count = nameCount.get(node.name) ?? 0;
    if (count > 1 && node.namespace) {
      diagnostics.push(diag(node.line, 'info', 'AMBIGUOUS_REFERENCE',
        `"${node.name}" exists in multiple namespaces; use "${node.namespace}::${node.name}" for unambiguous references`,
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
