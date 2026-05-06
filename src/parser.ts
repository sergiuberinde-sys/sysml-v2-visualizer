import type { SysMLNode, ParseDiagnostic, ParseResult } from './types';

// ── helpers ───────────────────────────────────────────────────────────────────

type PartDefNode      = Extract<SysMLNode, { kind: 'partDef' }>;
type InterfaceDefNode = Extract<SysMLNode, { kind: 'interfaceDef' }>;
type PortNode         = Extract<SysMLNode, { kind: 'port' }>;
type ConnectionNode   = Extract<SysMLNode, { kind: 'connection' }>;

// ── semantic validation ───────────────────────────────────────────────────────

function validate(nodes: SysMLNode[], diagnostics: ParseDiagnostic[]) {
  const ifaceNames = new Set<string>(
    nodes
      .filter((n): n is InterfaceDefNode => n.kind === 'interfaceDef')
      .map(n => n.name),
  );

  const partDefMap = new Map<string, PartDefNode>(
    nodes
      .filter((n): n is PartDefNode => n.kind === 'partDef')
      .map(n => [n.name, n]),
  );

  for (const node of nodes) {
    if (node.kind !== 'partDef') continue;

    // Port types must reference a known interface
    for (const child of node.body) {
      if (child.kind === 'port' && ifaceNames.size > 0 && !ifaceNames.has(child.portType)) {
        diagnostics.push({
          line: child.line,
          message: `Unknown interface type: "${child.portType}"`,
          severity: 'warning',
        });
      }
    }

    // Build instance map for this partDef's body
    const instanceTypes = new Map<string, string>();
    for (const child of node.body) {
      if (child.kind === 'partAlias') instanceTypes.set(child.name, child.type);
    }

    // Build port name sets per type
    const portNamesOf = (typeName: string): Set<string> | undefined => {
      const def = partDefMap.get(typeName);
      if (!def) return undefined;
      return new Set(
        def.body
          .filter((b): b is PortNode => b.kind === 'port')
          .map(p => p.name),
      );
    };

    // Validate connections
    for (const child of node.body) {
      if (child.kind !== 'connection') continue;
      const conn = child as ConnectionNode;

      if (!instanceTypes.has(conn.fromPart)) {
        diagnostics.push({ line: conn.line, message: `Unknown part instance: "${conn.fromPart}"`, severity: 'warning' });
        continue;
      }
      if (!instanceTypes.has(conn.toPart)) {
        diagnostics.push({ line: conn.line, message: `Unknown part instance: "${conn.toPart}"`, severity: 'warning' });
        continue;
      }

      const fromPorts = portNamesOf(instanceTypes.get(conn.fromPart)!);
      if (fromPorts && !fromPorts.has(conn.fromPort)) {
        diagnostics.push({
          line: conn.line,
          message: `"${instanceTypes.get(conn.fromPart)}" has no port "${conn.fromPort}"`,
          severity: 'warning',
        });
      }

      const toPorts = portNamesOf(instanceTypes.get(conn.toPart)!);
      if (toPorts && !toPorts.has(conn.toPort)) {
        diagnostics.push({
          line: conn.line,
          message: `"${instanceTypes.get(conn.toPart)}" has no port "${conn.toPort}"`,
          severity: 'warning',
        });
      }
    }
  }
}

// ── state machine validation ──────────────────────────────────────────────────

function validateStateMachines(nodes: SysMLNode[], diagnostics: ParseDiagnostic[]) {
  for (const node of nodes) {
    if (node.kind !== 'stateDef') continue;

    const seen       = new Set<string>();
    const stateNames = new Set<string>();
    let   hasInitial = false;

    for (const child of node.body) {
      if (child.kind === 'stateEntry') {
        if (seen.has(child.name)) {
          diagnostics.push({
            line: child.line,
            message: `Duplicate state "${child.name}" in "${node.name}"`,
            severity: 'warning',
          });
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
          diagnostics.push({
            line: child.line,
            message: `Initial transition targets unknown state "${child.to}"`,
            severity: 'warning',
          });
        }
      } else {
        if (stateNames.size > 0 && !stateNames.has(child.from)) {
          diagnostics.push({
            line: child.line,
            message: `Transition from unknown state "${child.from}"`,
            severity: 'warning',
          });
        }
        if (stateNames.size > 0 && !stateNames.has(child.to)) {
          diagnostics.push({
            line: child.line,
            message: `Transition to unknown state "${child.to}"`,
            severity: 'warning',
          });
        }
      }
    }

    if (stateNames.size > 0 && !hasInitial) {
      diagnostics.push({
        line: node.line,
        message: `State machine "${node.name}" has no initial transition`,
        severity: 'warning',
      });
    }
  }
}

// ── behavior validation ───────────────────────────────────────────────────────

function validateBehaviors(nodes: SysMLNode[], diagnostics: ParseDiagnostic[]) {
  for (const node of nodes) {
    if (node.kind !== 'behaviorDef') continue;

    const seen = new Set<string>();
    const actionNames = new Set<string>();

    for (const child of node.body) {
      if (child.kind === 'actionInst') {
        if (seen.has(child.name)) {
          diagnostics.push({
            line: child.line,
            message: `Duplicate action name "${child.name}" in behavior "${node.name}"`,
            severity: 'warning',
          });
        }
        seen.add(child.name);
        actionNames.add(child.name);
      }
    }

    for (const child of node.body) {
      if (child.kind !== 'flow') continue;
      if (!actionNames.has(child.from)) {
        diagnostics.push({
          line: child.line,
          message: `Flow references unknown action "${child.from}"`,
          severity: 'warning',
        });
      }
      if (!actionNames.has(child.to)) {
        diagnostics.push({
          line: child.line,
          message: `Flow references unknown action "${child.to}"`,
          severity: 'warning',
        });
      }
    }
  }
}

// ── main parser ───────────────────────────────────────────────────────────────

export function parse(source: string): ParseResult {
  const rawLines = source.split('\n');
  const nodes: SysMLNode[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  type Frame = { kind: 'partDef' | 'occurrenceDef' | 'behaviorDef' | 'stateDef'; name: string; body: SysMLNode[]; startLine: number };
  const stack: Frame[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const line = rawLines[i].replace(/\/\/.*$/, '').trim();
    if (!line) continue;

    const target = stack.length > 0 ? stack[stack.length - 1].body : nodes;

    // Close block
    if (/^\}/.test(line)) {
      const frame = stack.pop();
      if (frame) {
        const dest = stack.length > 0 ? stack[stack.length - 1].body : nodes;
        dest.push({ kind: frame.kind, name: frame.name, body: frame.body, line: frame.startLine } as SysMLNode);
      } else {
        diagnostics.push({ line: lineNum, message: 'Unexpected }', severity: 'error' });
      }
      continue;
    }

    // package Name;
    let m = line.match(/^package\s+(\w+)/);
    if (m) { target.push({ kind: 'package', name: m[1], line: lineNum }); continue; }

    // interface def Name;
    m = line.match(/^interface\s+def\s+(\w+)/);
    if (m) { target.push({ kind: 'interfaceDef', name: m[1], line: lineNum }); continue; }

    // part def Name {
    m = line.match(/^part\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'partDef', name: m[1], body: [], startLine: lineNum }); continue; }

    // part def Name;
    m = line.match(/^part\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'partDef', name: m[1], body: [], line: lineNum }); continue; }

    // occurrence def Name {
    m = line.match(/^occurrence\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'occurrenceDef', name: m[1], body: [], startLine: lineNum }); continue; }

    // occurrence def Name;
    m = line.match(/^occurrence\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'occurrenceDef', name: m[1], body: [], line: lineNum }); continue; }

    // port in|out name : Type;
    m = line.match(/^port\s+(in|out)\s+(\w+)\s*:\s*(\w+)/);
    if (m) {
      target.push({ kind: 'port', name: m[2], direction: m[1] as 'in' | 'out', portType: m[3], line: lineNum });
      continue;
    }

    // connect part.port to part.port;
    m = line.match(/^connect\s+(\w+)\.(\w+)\s+to\s+(\w+)\.(\w+)/);
    if (m) {
      target.push({ kind: 'connection', fromPart: m[1], fromPort: m[2], toPart: m[3], toPort: m[4], line: lineNum });
      continue;
    }

    // part name : Type;
    m = line.match(/^part\s+(\w+)\s*:\s*(\w+)/);
    if (m) { target.push({ kind: 'partAlias', name: m[1], type: m[2], line: lineNum }); continue; }

    // message name from A to B;
    m = line.match(/^message\s+(\w+)\s+from\s+(\w+)\s+to\s+(\w+)/);
    if (m) {
      const occurrence = stack.length > 0 ? stack[stack.length - 1].name : '';
      target.push({ kind: 'message', name: m[1], from: m[2], to: m[3], occurrence, line: lineNum });
      continue;
    }

    // action def Name;
    m = line.match(/^action\s+def\s+(\w+)/);
    if (m) { target.push({ kind: 'actionDef', name: m[1], line: lineNum }); continue; }

    // behavior def Name {
    m = line.match(/^behavior\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'behaviorDef', name: m[1], body: [], startLine: lineNum }); continue; }

    // behavior def Name;
    m = line.match(/^behavior\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'behaviorDef', name: m[1], body: [], line: lineNum }); continue; }

    // action name : Type;  (action instance inside behavior)
    m = line.match(/^action\s+(\w+)\s*:\s*(\w+)/);
    if (m) { target.push({ kind: 'actionInst', name: m[1], actionType: m[2], line: lineNum }); continue; }

    // flow from -> to;
    m = line.match(/^flow\s+(\w+)\s*->\s*(\w+)/);
    if (m) { target.push({ kind: 'flow', from: m[1], to: m[2], line: lineNum }); continue; }

    // state def Name {
    m = line.match(/^state\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'stateDef', name: m[1], body: [], startLine: lineNum }); continue; }

    // state def Name;
    m = line.match(/^state\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'stateDef', name: m[1], body: [], line: lineNum }); continue; }

    // state Name;  (state entry inside state machine)
    m = line.match(/^state\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'stateEntry', name: m[1], line: lineNum }); continue; }

    // initial -> StateName;
    m = line.match(/^initial\s*->\s*(\w+)/);
    if (m) { target.push({ kind: 'transition', from: '', to: m[1], event: '', line: lineNum }); continue; }

    // transition From -> To on Event;
    m = line.match(/^transition\s+(\w+)\s*->\s*(\w+)\s+on\s+(\w+)/);
    if (m) { target.push({ kind: 'transition', from: m[1], to: m[2], event: m[3], line: lineNum }); continue; }

    // transition From -> To;  (no event)
    m = line.match(/^transition\s+(\w+)\s*->\s*(\w+)/);
    if (m) { target.push({ kind: 'transition', from: m[1], to: m[2], event: '', line: lineNum }); continue; }

    diagnostics.push({ line: lineNum, message: `Unrecognized statement: "${line}"`, severity: 'warning' });
  }

  // Flush unclosed blocks
  while (stack.length > 0) {
    const frame = stack.pop()!;
    diagnostics.push({ line: frame.startLine, message: `Unclosed block: ${frame.kind} ${frame.name}`, severity: 'error' });
    nodes.push({ kind: frame.kind, name: frame.name, body: frame.body, line: frame.startLine } as SysMLNode);
  }

  validateStateMachines(nodes, diagnostics);
  validateBehaviors(nodes, diagnostics);
  validate(nodes, diagnostics);
  return { nodes, diagnostics };
}
