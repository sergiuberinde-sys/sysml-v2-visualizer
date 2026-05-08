/**
 * UI-independent completion logic for SysML v2 source files.
 *
 * Consumed by the VS Code CompletionItemProvider in the extension.
 * Pure functions: no VS Code imports, no side effects.
 */

import type { SysMLAnalysis } from '../analyzer/analyzeSysML';
import { getOccurrenceAtPosition } from '../analyzer/analyzeSysML';
import type { SysMLNode } from '../modelTypes';

// ── Public types ──────────────────────────────────────────────────────────────

export interface SysMLCompletion {
  label: string;
  kind: 'keyword' | 'interface' | 'part' | 'action' | 'requirement' | 'participant';
  detail?: string;
  insertText: string;
}

// ── Line patterns for detecting type-reference positions ──────────────────────
// Regexes match the text from the start of the line up to the cursor.
// Trailing \s* allows for a trailing space after the colon / keyword.

const PORT_TYPE_RE    = /^\s*port\s+(?:in|out)\s+\w+\s*:\s*\w*\s*$/;
const PART_TYPE_RE    = /^\s*part\s+\w+\s*:\s*\w*\s*$/;
const ACTION_TYPE_RE  = /^\s*action\s+\w+\s*:\s*\w*\s*$/;
// Note: MSG_TO_RE is checked before MSG_FROM_RE — it is more specific.
const MSG_TO_RE       = /^\s*message\s+\w+\s+from\s+\w+\s+to\s*\w*\s*$/;
const MSG_FROM_RE     = /^\s*message\s+\w+\s+from\s*\w*\s*$/;
const SATISFY_RE      = /^\s*satisfy\s+\S+\s+satisfies\s*\w*\s*$/;
const VERIFY_RE       = /^\s*verify\s+\S+\s+verifies\s*\w*\s*$/;
const TRACE_TARGET_RE = /^\s*trace\s+\S+\s+traces\s*\w*\s*$/;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return completion items for the given cursor position.
 *
 * @param analysis   Result of analyzeSysML() for the current document.
 * @param lineNumber 1-based line of the cursor.
 * @param lineText   Text from the start of the line up to the cursor.
 */
export function getCompletions(
  analysis: SysMLAnalysis,
  lineNumber: number,
  lineText: string,
): SysMLCompletion[] {
  try {
    const blockCtx = detectBlockContext(analysis, lineNumber);
    const symbols  = analysis.symbols.all();

    // ── Symbol type positions ────────────────────────────────────────────────
    // Return only the appropriate symbol set when the cursor is in a
    // type-reference position; keyword completions don't apply there.

    if (PORT_TYPE_RE.test(lineText)) {
      return symbols
        .filter(s => s.kind === 'interfaceDef')
        .map(s => ({ label: s.name, kind: 'interface' as const, detail: s.qualifiedName, insertText: s.name }));
    }

    // Check MSG_TO_RE before MSG_FROM_RE (more specific pattern)
    if (MSG_TO_RE.test(lineText) || MSG_FROM_RE.test(lineText)) {
      const occ = getOccurrenceAtPosition(analysis, lineNumber, 0);
      if (!occ) return [];
      return occ.participants.map(p => ({
        label:      p.alias,
        kind:       'participant' as const,
        detail:     `participant: ${p.alias} : ${p.type}`,
        insertText: p.alias,
      }));
    }

    if (PART_TYPE_RE.test(lineText)) {
      return symbols
        .filter(s => s.kind === 'partDef')
        .map(s => ({ label: s.name, kind: 'part' as const, detail: s.qualifiedName, insertText: s.name }));
    }

    if (ACTION_TYPE_RE.test(lineText)) {
      return symbols
        .filter(s => s.kind === 'actionDef')
        .map(s => ({ label: s.name, kind: 'action' as const, detail: s.qualifiedName, insertText: s.name }));
    }

    if (SATISFY_RE.test(lineText) || VERIFY_RE.test(lineText) || TRACE_TARGET_RE.test(lineText)) {
      return symbols
        .filter(s => s.kind === 'requirementDef')
        .map(s => ({ label: s.name, kind: 'requirement' as const, detail: s.qualifiedName, insertText: s.name }));
    }

    // ── Keyword completions based on enclosing block ─────────────────────────

    return keywordsForContext(blockCtx?.kind ?? 'top-level');
  } catch {
    return [];
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type BlockCtx = { kind: string; node: SysMLNode } | null;

/**
 * Find the innermost block node (partDef, occurrenceDef, …) that strictly
 * contains the given 1-based line number.
 */
function detectBlockContext(analysis: SysMLAnalysis, lineNumber: number): BlockCtx {
  const blockKinds = new Set(['partDef', 'occurrenceDef', 'behaviorDef', 'stateDef', 'requirementDef']);
  let innermost: BlockCtx = null;
  let innermostSpan = Infinity;

  for (const node of analysis.model.nodes) {
    if (!blockKinds.has(node.kind)) continue;
    const n = node as { line: number; endLine?: number };
    if (n.endLine === undefined) continue;
    if (lineNumber > n.line && lineNumber < n.endLine) {
      const span = n.endLine - n.line;
      if (span < innermostSpan) {
        innermostSpan = span;
        innermost = { kind: node.kind, node };
      }
    }
  }

  return innermost;
}


function keywordsForContext(blockKind: string): SysMLCompletion[] {
  switch (blockKind) {
    case 'partDef':
      return [
        kw('port in',  'port in '),
        kw('port out', 'port out '),
        kw('part',     'part '),
        kw('connect',  'connect '),
      ];
    case 'occurrenceDef':
      return [kw('part', 'part '), kw('message', 'message ')];
    case 'behaviorDef':
      return [kw('action', 'action '), kw('flow', 'flow ')];
    case 'stateDef':
      return [kw('state', 'state '), kw('initial', 'initial '), kw('transition', 'transition ')];
    case 'requirementDef':
      return [kw('id =', 'id = '), kw('text =', 'text = '), kw('priority =', 'priority = ')];
    default:
      return [
        kw('package',         'package '),
        kw('part def',        'part def '),
        kw('interface def',   'interface def '),
        kw('action def',      'action def '),
        kw('behavior def',    'behavior def '),
        kw('occurrence def',  'occurrence def '),
        kw('state def',       'state def '),
        kw('requirement def', 'requirement def '),
        kw('satisfy',         'satisfy '),
        kw('verify',          'verify '),
        kw('trace',           'trace '),
      ];
  }
}

function kw(label: string, insertText: string): SysMLCompletion {
  return { label, kind: 'keyword', insertText };
}
