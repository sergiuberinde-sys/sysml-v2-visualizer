// Pure text insertion utilities. All functions return a new source string.
// Line numbers in ParseResult are 1-based; array indices are 0-based.

import type { ParseResult, SysMLNode, PackageDefNode } from './types';

// Returns 0-based index of the first `}` line after openLineNum (1-based).
// openLineNum as a 0-based index IS the line after the opening (e.g. opening at
// ls[openLineNum-1] → first body line at ls[openLineNum]).
function findCloseIdx(ls: string[], openLineNum: number): number {
  for (let i = openLineNum; i < ls.length; i++) {
    if (/^\}/.test(ls[i].replace(/\/\/.*$/, '').trim())) return i;
  }
  return ls.length - 1;
}

// Returns 0-based index of the `}` that matches the `{` on openIdx (0-based).
// Handles nesting by tracking brace depth.
function findMatchingClose(ls: string[], openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < ls.length; i++) {
    const text = ls[i].replace(/\/\/.*$/, '').trim();
    for (const ch of text) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return i; }
    }
  }
  return ls.length - 1;
}

// ── Interface ─────────────────────────────────────────────────────────────────

export function insertInterface(source: string, result: ParseResult, name: string): string {
  const ls = source.split('\n');
  const ifaces = result.nodes.filter(n => n.kind === 'interfaceDef');
  const pkg    = result.nodes.find(n => n.kind === 'package');
  // splice(N, 0, x) inserts BEFORE ls[N], i.e. AFTER line N (1-based)
  const idx = ifaces.length > 0
    ? Math.max(...ifaces.map(n => n.line))
    : (pkg ? pkg.line : 0);
  ls.splice(idx, 0, `interface def ${name};`);
  return ls.join('\n');
}

// ── Part definition ───────────────────────────────────────────────────────────

export function insertPartDef(source: string, result: ParseResult, name: string): string {
  const ls = source.split('\n');
  type PD = Extract<SysMLNode, { kind: 'partDef' }>;
  const typeParts = result.nodes
    .filter((n): n is PD => n.kind === 'partDef' && !n.body.some(b => b.kind === 'partAlias'))
    .sort((a, b) => a.line - b.line);
  const ifaces = result.nodes.filter(n => n.kind === 'interfaceDef');
  const pkg    = result.nodes.find(n => n.kind === 'package');

  let idx: number;
  if (typeParts.length > 0) {
    const last = typeParts[typeParts.length - 1];
    // If the last type part has a block, jump past its closing }
    idx = /{/.test(ls[last.line - 1])
      ? findCloseIdx(ls, last.line) + 1
      : last.line;
  } else if (ifaces.length > 0) {
    idx = Math.max(...ifaces.map(n => n.line));
  } else {
    idx = pkg ? pkg.line : 0;
  }

  ls.splice(idx, 0, `part def ${name} {`, `}`);
  return ls.join('\n');
}

// ── Port ──────────────────────────────────────────────────────────────────────

export function insertPort(
  source: string,
  result: ParseResult,
  partName: string,
  direction: 'in' | 'out',
  portName: string,
  portType: string,
): string {
  const ls = source.split('\n');
  type PD = Extract<SysMLNode, { kind: 'partDef' }>;
  const pd = result.nodes.find((n): n is PD => n.kind === 'partDef' && n.name === partName);
  if (!pd) return source;
  const closeIdx = findCloseIdx(ls, pd.line);
  ls.splice(closeIdx, 0, `  port ${direction} ${portName} : ${portType};`);
  return ls.join('\n');
}

// ── Connection ────────────────────────────────────────────────────────────────

export function insertConnection(
  source: string,
  result: ParseResult,
  systemPartName: string,
  fromPart: string,
  fromPort: string,
  toPart: string,
  toPort: string,
): string {
  const ls = source.split('\n');
  type PD = Extract<SysMLNode, { kind: 'partDef' }>;
  const pd = result.nodes.find((n): n is PD => n.kind === 'partDef' && n.name === systemPartName);
  if (!pd) return source;
  const closeIdx = findCloseIdx(ls, pd.line);
  ls.splice(closeIdx, 0, `  connect ${fromPart}.${fromPort} to ${toPart}.${toPort};`);
  return ls.join('\n');
}

// ── Occurrence ────────────────────────────────────────────────────────────────

export function insertOccurrence(source: string, name: string): string {
  const ls = source.split('\n');
  while (ls.length > 0 && ls[ls.length - 1].trim() === '') ls.pop();
  ls.push('', `occurrence def ${name} {`, `}`);
  return ls.join('\n');
}

// ── State machine ─────────────────────────────────────────────────────────────

export function insertStateDef(source: string, name: string): string {
  const ls = source.split('\n');
  while (ls.length > 0 && ls[ls.length - 1].trim() === '') ls.pop();
  ls.push('', `state def ${name} {`, `}`);
  return ls.join('\n');
}

export function insertStateEntry(
  source: string, result: ParseResult, smName: string, stateName: string,
): string {
  const ls = source.split('\n');
  type SD = Extract<SysMLNode, { kind: 'stateDef' }>;
  const sm = result.nodes.find((n): n is SD => n.kind === 'stateDef' && n.name === smName);
  if (!sm) return source;
  const closeIdx = findCloseIdx(ls, sm.line);
  ls.splice(closeIdx, 0, `  state ${stateName};`);
  return ls.join('\n');
}

export function insertStateTransition(
  source: string,
  result: ParseResult,
  smName: string,
  from: string,
  to: string,
  event?: string,
): string {
  const ls = source.split('\n');
  type SD = Extract<SysMLNode, { kind: 'stateDef' }>;
  const sm = result.nodes.find((n): n is SD => n.kind === 'stateDef' && n.name === smName);
  if (!sm) return source;
  const closeIdx = findCloseIdx(ls, sm.line);
  const text = event
    ? `  transition ${from} -> ${to} on ${event};`
    : `  transition ${from} -> ${to};`;
  ls.splice(closeIdx, 0, text);
  return ls.join('\n');
}

// ── Requirement ───────────────────────────────────────────────────────────────

export function insertRequirementDef(source: string, name: string): string {
  const ls = source.split('\n');
  while (ls.length > 0 && ls[ls.length - 1].trim() === '') ls.pop();
  ls.push('', `requirement def ${name} {`, `  id = "REQ-XXX";`, `  text = "";`, `  priority = "Medium";`, `}`);
  return ls.join('\n');
}

export function insertTraceLink(
  source: string,
  linkType: 'satisfy' | 'verify' | 'trace',
  sourceEl: string,
  targetReq: string,
): string {
  const ls = source.split('\n');
  while (ls.length > 0 && ls[ls.length - 1].trim() === '') ls.pop();
  const verb = linkType === 'satisfy' ? 'satisfies' : linkType === 'verify' ? 'verifies' : 'traces';
  ls.push(`${linkType} ${sourceEl} ${verb} ${targetReq};`);
  return ls.join('\n');
}

// ── Message ───────────────────────────────────────────────────────────────────

// ── Package ───────────────────────────────────────────────────────────────────

export function insertPackage(source: string, name: string): string {
  const ls = source.split('\n');
  while (ls.length > 0 && ls[ls.length - 1].trim() === '') ls.pop();
  ls.push('', `package ${name} {`, `}`);
  return ls.join('\n');
}

export function insertElementIntoPackage(
  source: string,
  result: ParseResult,
  packagePath: string,
  elementText: string,
): string {
  const ls = source.split('\n');
  const pathParts = packagePath.split('::').filter(Boolean);

  function findPkg(pkgs: PackageDefNode[], path: string[]): PackageDefNode | undefined {
    for (const pkg of pkgs) {
      if (pkg.name === path[0]) {
        if (path.length === 1) return pkg;
        const children = pkg.body.filter((n): n is PackageDefNode => n.kind === 'packageDef');
        return findPkg(children, path.slice(1));
      }
    }
    return undefined;
  }

  const targetPkg = findPkg(result.packages, pathParts);
  if (!targetPkg) return source;

  const closeIdx = findMatchingClose(ls, targetPkg.line - 1);
  const indent = '  '.repeat(pathParts.length);
  const indentedLines = elementText.split('\n').map(l => indent + l);
  ls.splice(closeIdx, 0, ...indentedLines);
  return ls.join('\n');
}

// ── Message ───────────────────────────────────────────────────────────────────

export function insertMessage(
  source: string,
  result: ParseResult,
  occName: string,
  msgName: string,
  from: string,
  to: string,
): string {
  const ls = source.split('\n');
  type OD = Extract<SysMLNode, { kind: 'occurrenceDef' }>;
  const occ = result.nodes.find((n): n is OD => n.kind === 'occurrenceDef' && n.name === occName);
  if (!occ) return source;
  const closeIdx = findCloseIdx(ls, occ.line);
  ls.splice(closeIdx, 0, `  message ${msgName} from ${from} to ${to};`);
  return ls.join('\n');
}
