import type { SysMLNode, ParseDiagnostic, ParseResult, PackageDefNode } from './modelTypes';

// ── Package tree → flat nodes + top-level packages ────────────────────────────

function flattenPackages(topNodes: SysMLNode[]): { flatNodes: SysMLNode[]; packages: PackageDefNode[] } {
  const packages = topNodes.filter((n): n is PackageDefNode => n.kind === 'packageDef');
  const flatNodes: SysMLNode[] = [];
  function walk(nodes: SysMLNode[]) {
    for (const n of nodes) {
      if (n.kind === 'packageDef') walk(n.body);
      else flatNodes.push(n);
    }
  }
  walk(topNodes);
  return { flatNodes, packages };
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parse(source: string): ParseResult {
  const rawLines = source.split('\n');
  const nodes: SysMLNode[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  const namespaceStack: string[] = [];
  const currentNs = () => namespaceStack.join('::');

  type Frame = {
    kind: 'packageDef' | 'partDef' | 'occurrenceDef' | 'behaviorDef' | 'stateDef' | 'requirementDef';
    name: string; body: SysMLNode[]; startLine: number;
    reqId?: string; reqText?: string; reqPriority?: string;
  };
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
        if (frame.kind === 'packageDef') {
          namespaceStack.pop();
          dest.push({ kind: 'packageDef', name: frame.name, namespace: currentNs(), body: frame.body, line: frame.startLine });
        } else if (frame.kind === 'requirementDef') {
          dest.push({ kind: 'requirementDef', name: frame.name, namespace: currentNs(), reqId: frame.reqId ?? '', text: frame.reqText ?? '', priority: frame.reqPriority ?? '', line: frame.startLine });
        } else {
          dest.push({ kind: frame.kind, name: frame.name, namespace: currentNs(), body: frame.body, line: frame.startLine } as SysMLNode);
        }
      } else {
        diagnostics.push({ line: lineNum, severity: 'error', message: 'Unexpected }' });
      }
      continue;
    }

    // Field assignments inside requirementDef block
    if (stack.length > 0 && stack[stack.length - 1].kind === 'requirementDef') {
      const frame = stack[stack.length - 1];
      let fm = line.match(/^id\s*=\s*"([^"]*)"/);
      if (fm) { frame.reqId = fm[1]; continue; }
      fm = line.match(/^text\s*=\s*"([^"]*)"/);
      if (fm) { frame.reqText = fm[1]; continue; }
      fm = line.match(/^priority\s*=\s*"([^"]*)"/);
      if (fm) { frame.reqPriority = fm[1]; continue; }
      diagnostics.push({ line: lineNum, severity: 'warning', message: `Unrecognized requirement field: "${line}"` });
      continue;
    }

    // package Name {
    let m = line.match(/^package\s+(\w+)\s*\{/);
    if (m) {
      namespaceStack.push(m[1]);
      stack.push({ kind: 'packageDef', name: m[1], body: [], startLine: lineNum });
      continue;
    }

    // package Name;
    m = line.match(/^package\s+(\w+)/);
    if (m) { target.push({ kind: 'package', name: m[1], line: lineNum }); continue; }

    // interface def Name;
    m = line.match(/^interface\s+def\s+(\w+)/);
    if (m) { target.push({ kind: 'interfaceDef', name: m[1], namespace: currentNs(), line: lineNum }); continue; }

    // part def Name {
    m = line.match(/^part\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'partDef', name: m[1], body: [], startLine: lineNum }); continue; }

    // part def Name;
    m = line.match(/^part\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'partDef', name: m[1], namespace: currentNs(), body: [], line: lineNum }); continue; }

    // occurrence def Name {
    m = line.match(/^occurrence\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'occurrenceDef', name: m[1], body: [], startLine: lineNum }); continue; }

    // occurrence def Name;
    m = line.match(/^occurrence\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'occurrenceDef', name: m[1], namespace: currentNs(), body: [], line: lineNum }); continue; }

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
    if (m) { target.push({ kind: 'actionDef', name: m[1], namespace: currentNs(), line: lineNum }); continue; }

    // behavior def Name {
    m = line.match(/^behavior\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'behaviorDef', name: m[1], body: [], startLine: lineNum }); continue; }

    // behavior def Name;
    m = line.match(/^behavior\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'behaviorDef', name: m[1], namespace: currentNs(), body: [], line: lineNum }); continue; }

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
    if (m) { target.push({ kind: 'stateDef', name: m[1], namespace: currentNs(), body: [], line: lineNum }); continue; }

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

    // requirement def Name {
    m = line.match(/^requirement\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'requirementDef', name: m[1], body: [], startLine: lineNum }); continue; }

    // requirement def Name;
    m = line.match(/^requirement\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'requirementDef', name: m[1], namespace: currentNs(), reqId: '', text: '', priority: '', line: lineNum }); continue; }

    // satisfy Source satisfies Target;
    m = line.match(/^satisfy\s+(\w+)\s+satisfies\s+(\w+)/);
    if (m) { target.push({ kind: 'traceLink', namespace: currentNs(), linkType: 'satisfy', source: m[1], target: m[2], line: lineNum }); continue; }

    // verify Source verifies Target;
    m = line.match(/^verify\s+(\w+)\s+verifies\s+(\w+)/);
    if (m) { target.push({ kind: 'traceLink', namespace: currentNs(), linkType: 'verify', source: m[1], target: m[2], line: lineNum }); continue; }

    // trace Source traces Target;
    m = line.match(/^trace\s+(\w+)\s+traces\s+(\w+)/);
    if (m) { target.push({ kind: 'traceLink', namespace: currentNs(), linkType: 'trace', source: m[1], target: m[2], line: lineNum }); continue; }

    diagnostics.push({ line: lineNum, severity: 'warning', message: `Unrecognized statement: "${line}"` });
  }

  // Flush unclosed blocks
  while (stack.length > 0) {
    const frame = stack.pop()!;
    diagnostics.push({ line: frame.startLine, severity: 'error', message: `Unclosed block: ${frame.kind} ${frame.name}` });
    const dest = stack.length > 0 ? stack[stack.length - 1].body : nodes;
    if (frame.kind === 'packageDef') {
      namespaceStack.pop();
      dest.push({ kind: 'packageDef', name: frame.name, namespace: currentNs(), body: frame.body, line: frame.startLine });
    } else if (frame.kind === 'requirementDef') {
      dest.push({ kind: 'requirementDef', name: frame.name, namespace: currentNs(), reqId: frame.reqId ?? '', text: frame.reqText ?? '', priority: frame.reqPriority ?? '', line: frame.startLine });
    } else {
      dest.push({ kind: frame.kind, name: frame.name, namespace: currentNs(), body: frame.body, line: frame.startLine } as SysMLNode);
    }
  }

  const { flatNodes, packages } = flattenPackages(nodes);
  return { nodes: flatNodes, packages, diagnostics };
}
