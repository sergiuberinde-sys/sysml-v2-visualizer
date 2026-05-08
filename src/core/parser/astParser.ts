import type { ASTNode, ASTResult } from '../ast/astTypes';
import type { ParseDiagnostic } from '../modelTypes';
import { UNSUPPORTED_SYNTAX } from '../diagnostics';

// ── Known-unsupported SysML v2 patterns ───────────────────────────────────────
// When a line reaches the fallthrough, we check these to give a targeted hint.

const UNSUPPORTED_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/^import\s+/,            '"import" is not supported in this subset'],
  [/^alias\s+/,             '"alias" is not supported in this subset'],
  [/^attribute\s+def\b/,    '"attribute def" is not supported; use "interface def" for type declarations'],
  [/^attribute\b/,          '"attribute" usage is not supported in this subset'],
  [/^item\s+def\b/,         '"item def" is not supported in this subset'],
  [/^calc\s+def\b/,         '"calc def" is not supported in this subset'],
  [/^constraint\s+def\b/,   '"constraint def" is not supported in this subset'],
  [/^use\s+case\s+def\b/,   '"use case def" is not supported in this subset'],
  [/^allocation\s+def\b/,   '"allocation def" is not supported in this subset'],
  [/^metadata\s+def\b/,     '"metadata def" is not supported in this subset'],
  [/^view\s+def\b/,         '"view def" is not supported in this subset'],
  [/^allocate\b/,           '"allocate" is not supported in this subset'],
  [/^ref\b/,                '"ref" usages are not supported in this subset'],
  [/^doc\b/,                '"doc" annotations are not supported; use // line comments'],
  [/^comment\b/,            '"comment" blocks are not supported; use // line comments'],
  [/^perform\b/,            '"perform" is not supported in this subset'],
  [/^exhibit\b/,            '"exhibit" is not supported in this subset'],
  [/^send\b/,               '"send" is not supported in this subset'],
  [/^bind\b/,               '"bind" is not supported in this subset'],
  [/^succession\b/,         '"succession" is not supported in this subset'],
  [/:>/,                    'generalization (":>") is not supported in this subset'],
];

// ── Main AST parser ───────────────────────────────────────────────────────────

export function parseToAST(source: string): ASTResult {
  const rawLines = source.split('\n');
  const nodes: ASTNode[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  type Frame = {
    kind: 'packageDef' | 'partDef' | 'occurrenceDef' | 'behaviorDef' | 'stateDef' | 'requirementDef';
    name: string;
    rawText: string;
    children: ASTNode[];
    startLine: number;
    reqId?: string;
    reqText?: string;
    reqPriority?: string;
  };
  const stack: Frame[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const line = rawLines[i].replace(/\/\/.*$/, '').trim();
    if (!line) continue;

    const target = stack.length > 0 ? stack[stack.length - 1].children : nodes;

    // Close block
    if (/^\}/.test(line)) {
      const frame = stack.pop();
      if (frame) {
        const dest = stack.length > 0 ? stack[stack.length - 1].children : nodes;
        switch (frame.kind) {
          case 'packageDef':
            dest.push({ kind: 'packageDef', name: frame.name, rawText: frame.rawText, children: frame.children, line: frame.startLine, endLine: lineNum });
            break;
          case 'partDef':
            dest.push({ kind: 'partDef', name: frame.name, rawText: frame.rawText, children: frame.children, line: frame.startLine, endLine: lineNum });
            break;
          case 'occurrenceDef':
            dest.push({ kind: 'occurrenceDef', name: frame.name, rawText: frame.rawText, children: frame.children, line: frame.startLine, endLine: lineNum });
            break;
          case 'behaviorDef':
            dest.push({ kind: 'behaviorDef', name: frame.name, rawText: frame.rawText, children: frame.children, line: frame.startLine, endLine: lineNum });
            break;
          case 'stateDef':
            dest.push({ kind: 'stateDef', name: frame.name, rawText: frame.rawText, children: frame.children, line: frame.startLine, endLine: lineNum });
            break;
          case 'requirementDef':
            dest.push({ kind: 'requirementDef', name: frame.name, rawText: frame.rawText, reqId: frame.reqId ?? '', text: frame.reqText ?? '', priority: frame.reqPriority ?? '', children: frame.children, line: frame.startLine, endLine: lineNum });
            break;
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
      diagnostics.push({ line: lineNum, severity: 'warning', code: UNSUPPORTED_SYNTAX, message: `Unrecognized requirement field "${line}"; valid fields are id, text, and priority` });
      continue;
    }

    // package Name {
    let m = line.match(/^package\s+(\w+)\s*\{/);
    if (m) {
      stack.push({ kind: 'packageDef', name: m[1], rawText: line, children: [], startLine: lineNum });
      continue;
    }

    // package Name;
    m = line.match(/^package\s+(\w+)/);
    if (m) { target.push({ kind: 'package', name: m[1], rawText: line, line: lineNum }); continue; }

    // interface def Name;
    m = line.match(/^interface\s+def\s+(\w+)/);
    if (m) { target.push({ kind: 'interfaceDef', name: m[1], rawText: line, line: lineNum }); continue; }

    // part def Name {
    m = line.match(/^part\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'partDef', name: m[1], rawText: line, children: [], startLine: lineNum }); continue; }

    // part def Name;
    m = line.match(/^part\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'partDef', name: m[1], rawText: line, children: [], line: lineNum }); continue; }

    // occurrence def Name {
    m = line.match(/^occurrence\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'occurrenceDef', name: m[1], rawText: line, children: [], startLine: lineNum }); continue; }

    // occurrence def Name;
    m = line.match(/^occurrence\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'occurrenceDef', name: m[1], rawText: line, children: [], line: lineNum }); continue; }

    // port in|out name : Type;  (Type may be qualified, e.g. Pkg::Signal)
    m = line.match(/^port\s+(in|out)\s+(\w+)\s*:\s*([\w][\w:]*\w|[\w]+)/);
    if (m) {
      target.push({ kind: 'port', name: m[2], direction: m[1] as 'in' | 'out', portType: m[3], rawText: line, line: lineNum });
      continue;
    }

    // connect part.port to part.port;
    m = line.match(/^connect\s+(\w+)\.(\w+)\s+to\s+(\w+)\.(\w+)/);
    if (m) {
      target.push({ kind: 'connection', fromPart: m[1], fromPort: m[2], toPart: m[3], toPort: m[4], rawText: line, line: lineNum });
      continue;
    }

    // part name : Type;  (Type may be qualified)
    m = line.match(/^part\s+(\w+)\s*:\s*([\w][\w:]*\w|[\w]+)/);
    if (m) { target.push({ kind: 'partAlias', name: m[1], type: m[2], rawText: line, line: lineNum }); continue; }

    // message name from A to B;
    m = line.match(/^message\s+(\w+)\s+from\s+(\w+)\s+to\s+(\w+)/);
    if (m) {
      const occurrence = stack.length > 0 ? stack[stack.length - 1].name : '';
      const rawLine = rawLines[i];
      const indent  = rawLine.length - rawLine.trimStart().length;
      const fromPfx = /^message\s+\w+\s+from\s+/.exec(line);
      const toPfx   = /^message\s+\w+\s+from\s+\w+\s+to\s+/.exec(line);
      const fromColumn = fromPfx ? indent + fromPfx[0].length + 1 : undefined;
      const toColumn   = toPfx   ? indent + toPfx[0].length   + 1 : undefined;
      target.push({ kind: 'message', name: m[1], from: m[2], to: m[3], occurrence, fromColumn, toColumn, rawText: line, line: lineNum });
      continue;
    }

    // action def Name;
    m = line.match(/^action\s+def\s+(\w+)/);
    if (m) { target.push({ kind: 'actionDef', name: m[1], rawText: line, line: lineNum }); continue; }

    // behavior def Name {
    m = line.match(/^behavior\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'behaviorDef', name: m[1], rawText: line, children: [], startLine: lineNum }); continue; }

    // behavior def Name;
    m = line.match(/^behavior\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'behaviorDef', name: m[1], rawText: line, children: [], line: lineNum }); continue; }

    // action name : Type;  (action instance inside behavior, Type may be qualified)
    m = line.match(/^action\s+(\w+)\s*:\s*([\w][\w:]*\w|[\w]+)/);
    if (m) { target.push({ kind: 'actionInst', name: m[1], actionType: m[2], rawText: line, line: lineNum }); continue; }

    // flow from -> to;
    m = line.match(/^flow\s+(\w+)\s*->\s*(\w+)/);
    if (m) { target.push({ kind: 'flow', from: m[1], to: m[2], rawText: line, line: lineNum }); continue; }

    // state def Name {
    m = line.match(/^state\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'stateDef', name: m[1], rawText: line, children: [], startLine: lineNum }); continue; }

    // state def Name;
    m = line.match(/^state\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'stateDef', name: m[1], rawText: line, children: [], line: lineNum }); continue; }

    // state Name;  (state entry inside state machine)
    m = line.match(/^state\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'stateEntry', name: m[1], rawText: line, line: lineNum }); continue; }

    // initial -> StateName;
    m = line.match(/^initial\s*->\s*(\w+)/);
    if (m) { target.push({ kind: 'transition', from: '', to: m[1], event: '', rawText: line, line: lineNum }); continue; }

    // transition From -> To on Event;
    m = line.match(/^transition\s+(\w+)\s*->\s*(\w+)\s+on\s+(\w+)/);
    if (m) { target.push({ kind: 'transition', from: m[1], to: m[2], event: m[3], rawText: line, line: lineNum }); continue; }

    // transition From -> To;  (no event)
    m = line.match(/^transition\s+(\w+)\s*->\s*(\w+)/);
    if (m) { target.push({ kind: 'transition', from: m[1], to: m[2], event: '', rawText: line, line: lineNum }); continue; }

    // requirement def Name {
    m = line.match(/^requirement\s+def\s+(\w+)\s*\{/);
    if (m) { stack.push({ kind: 'requirementDef', name: m[1], rawText: line, children: [], startLine: lineNum }); continue; }

    // requirement def Name;
    m = line.match(/^requirement\s+def\s+(\w+)\s*;?\s*$/);
    if (m) { target.push({ kind: 'requirementDef', name: m[1], rawText: line, reqId: '', text: '', priority: '', children: [], line: lineNum }); continue; }

    // satisfy Source satisfies Target;  (names may be qualified)
    m = line.match(/^satisfy\s+([\w][\w:]*\w|[\w]+)\s+satisfies\s+([\w][\w:]*\w|[\w]+)/);
    if (m) { target.push({ kind: 'traceLink', linkType: 'satisfy', source: m[1], target: m[2], rawText: line, line: lineNum }); continue; }

    // verify Source verifies Target;
    m = line.match(/^verify\s+([\w][\w:]*\w|[\w]+)\s+verifies\s+([\w][\w:]*\w|[\w]+)/);
    if (m) { target.push({ kind: 'traceLink', linkType: 'verify', source: m[1], target: m[2], rawText: line, line: lineNum }); continue; }

    // trace Source traces Target;
    m = line.match(/^trace\s+([\w][\w:]*\w|[\w]+)\s+traces\s+([\w][\w:]*\w|[\w]+)/);
    if (m) { target.push({ kind: 'traceLink', linkType: 'trace', source: m[1], target: m[2], rawText: line, line: lineNum }); continue; }

    const hit = UNSUPPORTED_PATTERNS.find(([pat]) => pat.test(line));
    diagnostics.push({
      line: lineNum,
      severity: 'warning',
      code: UNSUPPORTED_SYNTAX,
      message: hit ? hit[1] : `Unrecognized statement: "${line}"`,
    });
    target.push({ kind: 'unsupported', rawText: line, line: lineNum });
  }

  // Flush unclosed blocks — use last line of file as endLine
  const lastLine = rawLines.length;
  while (stack.length > 0) {
    const frame = stack.pop()!;
    diagnostics.push({ line: frame.startLine, severity: 'error', message: `Unclosed block: ${frame.kind} ${frame.name}` });
    const dest = stack.length > 0 ? stack[stack.length - 1].children : nodes;
    switch (frame.kind) {
      case 'packageDef':
        dest.push({ kind: 'packageDef', name: frame.name, rawText: frame.rawText, children: frame.children, line: frame.startLine, endLine: lastLine });
        break;
      case 'partDef':
        dest.push({ kind: 'partDef', name: frame.name, rawText: frame.rawText, children: frame.children, line: frame.startLine, endLine: lastLine });
        break;
      case 'occurrenceDef':
        dest.push({ kind: 'occurrenceDef', name: frame.name, rawText: frame.rawText, children: frame.children, line: frame.startLine, endLine: lastLine });
        break;
      case 'behaviorDef':
        dest.push({ kind: 'behaviorDef', name: frame.name, rawText: frame.rawText, children: frame.children, line: frame.startLine, endLine: lastLine });
        break;
      case 'stateDef':
        dest.push({ kind: 'stateDef', name: frame.name, rawText: frame.rawText, children: frame.children, line: frame.startLine, endLine: lastLine });
        break;
      case 'requirementDef':
        dest.push({ kind: 'requirementDef', name: frame.name, rawText: frame.rawText, reqId: frame.reqId ?? '', text: frame.reqText ?? '', priority: frame.reqPriority ?? '', children: frame.children, line: frame.startLine, endLine: lastLine });
        break;
    }
  }

  return { nodes, diagnostics };
}
