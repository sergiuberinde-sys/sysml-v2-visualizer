/**
 * Core analysis API for SysML v2 source text.
 *
 * Designed to be consumed by:
 *   - the current VS Code extension
 *   - a future Language Server Protocol implementation
 *   - the visualizer UI (via the parseAndValidate wrapper in modelBuilder.ts)
 *
 * All line/column numbers in this API are 1-based.
 * VS Code / LSP callers are responsible for converting to their own coordinate systems.
 */

import { parseToAST } from '../parser/astParser';
import { buildModel }  from '../model/modelBuilder';
import type { SemanticModel } from '../model/modelBuilder';
import { buildSymbolTable } from '../symbols/symbolTable';
import type { SymbolTable, Symbol as SysMLSymbol } from '../symbols/symbolTable';
import { Resolver } from '../symbols/resolver';
import { validate } from '../validator/validator';
import type { ASTResult } from '../ast/astTypes';
import type { ParseDiagnostic, SysMLNode } from '../modelTypes';
import { PARSER_MODE } from '../parserMode';
import type { ParserMode } from '../parserMode';

// ── Public types ──────────────────────────────────────────────────────────────

export type { SysMLSymbol };

export interface SysMLAnalysis {
  ast:         ASTResult;
  model:       SemanticModel;
  symbols:     SymbolTable;
  diagnostics: ParseDiagnostic[];
  parserMode:  ParserMode;
}

/**
 * Result of a position lookup.
 * - `symbol`: the cursor is on a named declaration in the symbol table
 * - `node`:   the cursor is on a body-level item (port, message, flow, …)
 */
export type ElementAtPosition =
  | { kind: 'symbol'; symbol: SysMLSymbol }
  | { kind: 'node';   node: SysMLNode }
  | null;

/** A location in source where a named symbol is referenced. */
export interface Reference {
  /** The node that contains the reference. */
  node: SysMLNode;
  /** The name as it appears in the source (may be a qualified name). */
  referencedName: string;
  /** 1-based line of the reference. */
  line: number;
}

/**
 * The occurrence def that contains a cursor position, plus its participants.
 * Returned by getOccurrenceAtPosition; used by completion providers.
 */
export interface OccurrenceContext {
  name: string;
  qualifiedName: string;
  participants: Array<{ alias: string; type: string }>;
  sourceLocation: { line: number; endLine?: number };
}

// ── Core analysis entry point ─────────────────────────────────────────────────

export function analyzeSysML(text: string): SysMLAnalysis {
  const ast        = parseToAST(text);
  const model      = buildModel(ast);
  const symbols    = buildSymbolTable(model.nodes);
  const semDiags   = validate({ nodes: model.nodes, packages: model.packages, diagnostics: [] });
  const diagnostics = [...ast.diagnostics, ...semDiags];
  return { ast, model, symbols, diagnostics, parserMode: PARSER_MODE };
}

// ── Query APIs ────────────────────────────────────────────────────────────────

/** Return all diagnostics from the analysis (parser + semantic). */
export function getDiagnostics(analysis: SysMLAnalysis): ParseDiagnostic[] {
  return analysis.diagnostics;
}

/**
 * Find the element at a 1-based (line, column) position.
 *
 * Checks symbol definitions first, then body-level items.
 * Column is accepted but currently used only to future-proof the signature;
 * precision is at line granularity.
 */
export function getSymbolAtPosition(
  analysis: SysMLAnalysis,
  line: number,
  _column: number,
): ElementAtPosition {
  // 1. Named declarations in the symbol table (definition sites)
  for (const sym of analysis.symbols.all()) {
    if (sym.sourceLocation.line === line) {
      return { kind: 'symbol', symbol: sym };
    }
  }

  // 2. Body-level items inside block nodes (ports, messages, connections, flows, …)
  for (const node of analysis.model.nodes) {
    if (!('body' in node)) continue;
    const body = (node as { body: SysMLNode[] }).body;
    for (const child of body) {
      if ((child as { line: number }).line === line) {
        return { kind: 'node', node: child };
      }
    }
  }

  return null;
}

/**
 * Given a name (or an ElementAtPosition) and an optional context namespace,
 * return the symbol that defines that name, or null if unresolved.
 *
 * When passed an ElementAtPosition:
 *   - kind === 'symbol': returns that symbol directly.
 *   - kind === 'node':   extracts the type reference from the node (portType,
 *     type, actionType) and resolves it via the symbol table.
 */
export function getDefinitionForSymbol(
  analysis: SysMLAnalysis,
  nameOrElement: string | ElementAtPosition,
  contextNamespace = '',
): SysMLSymbol | null {
  if (nameOrElement === null) return null;

  if (typeof nameOrElement === 'object') {
    if (nameOrElement.kind === 'symbol') return nameOrElement.symbol;

    // kind === 'node' — extract the type-reference field
    const node = nameOrElement.node as Record<string, unknown>;
    const typeName =
      typeof node['portType']   === 'string' ? node['portType']   :
      typeof node['type']       === 'string' ? node['type']       :
      typeof node['actionType'] === 'string' ? node['actionType'] :
      null;
    if (!typeName) return null;
    nameOrElement = typeName;
  }

  const resolver = new Resolver(analysis.symbols);
  const result   = resolver.resolve(nameOrElement, contextNamespace);
  return result.found ? result.symbol : null;
}

/**
 * Find all source locations that reference the given symbol by name.
 *
 * Accepts either a SysMLSymbol directly or an ElementAtPosition.
 * When given an ElementAtPosition with kind === 'symbol', uses that symbol.
 * When given kind === 'node', resolves the node's type reference to a symbol first.
 *
 * Scans all nodes and body items for type references, action types, trace
 * link source/target, and port types.  A reference matches when the written
 * name equals either the symbol's short name or its fully-qualified name.
 */
export function getReferencesToSymbol(
  analysis: SysMLAnalysis,
  symbolOrElement: SysMLSymbol | ElementAtPosition,
): Reference[] {
  // Normalize to a concrete SysMLSymbol.
  // Distinguish ElementAtPosition from SysMLSymbol via its discriminant values:
  // ElementAtPosition.kind is 'symbol' | 'node'; SymbolKind never uses those values.
  let sym: SysMLSymbol;
  if (symbolOrElement === null) return [];
  const k = (symbolOrElement as { kind: string }).kind;
  if (k === 'symbol') {
    sym = (symbolOrElement as { kind: 'symbol'; symbol: SysMLSymbol }).symbol;
  } else if (k === 'node') {
    const resolved = getDefinitionForSymbol(analysis, symbolOrElement as ElementAtPosition);
    if (!resolved) return [];
    sym = resolved;
  } else {
    sym = symbolOrElement as SysMLSymbol;
  }

  const refs: Reference[] = [];
  const { name, qualifiedName } = sym;

  function matches(ref: string): boolean {
    return ref === name || ref === qualifiedName;
  }

  function addRef(node: SysMLNode, refName: string): void {
    if (matches(refName)) {
      refs.push({ node, referencedName: refName, line: (node as { line: number }).line });
    }
  }

  for (const node of analysis.model.nodes) {
    // Top-level reference sites
    if (node.kind === 'partAlias') {
      addRef(node, (node as { type: string }).type);
    } else if (node.kind === 'traceLink') {
      const tl = node as { source: string; target: string };
      addRef(node, tl.source);
      addRef(node, tl.target);
    }

    // Body-level reference sites
    if (!('body' in node)) continue;
    const body = (node as { body: SysMLNode[] }).body;
    for (const child of body) {
      if (child.kind === 'port') {
        addRef(child, (child as { portType: string }).portType);
      } else if (child.kind === 'partAlias') {
        addRef(child, (child as { type: string }).type);
      } else if (child.kind === 'actionInst') {
        addRef(child, (child as { actionType: string }).actionType);
      }
    }
  }

  return refs;
}

/**
 * Find the innermost occurrence def that strictly contains the given cursor position.
 *
 * "Strictly contains" means the cursor is on a line after the opening brace
 * and before the closing brace (both exclusive). Returns null if the cursor
 * is not inside any occurrence def.
 *
 * The returned OccurrenceContext lists all partAlias participants declared in
 * the block's body.  Used by the completion provider for message endpoint
 * suggestions.
 */
export function getOccurrenceAtPosition(
  analysis: SysMLAnalysis,
  line: number,
  _column: number,
): OccurrenceContext | null {
  type OccNode = Extract<SysMLNode, { kind: 'occurrenceDef' }>;
  let innermost: OccNode | null = null;
  let innermostSpan = Infinity;

  for (const node of analysis.model.nodes) {
    if (node.kind !== 'occurrenceDef') continue;
    if (node.endLine === undefined) continue;
    if (line > node.line && line < node.endLine) {
      const span = node.endLine - node.line;
      if (span < innermostSpan) {
        innermostSpan = span;
        innermost = node;
      }
    }
  }

  if (!innermost) return null;

  const participants = innermost.body
    .filter((c): c is Extract<SysMLNode, { kind: 'partAlias' }> => c.kind === 'partAlias')
    .map(c => ({ alias: c.name, type: c.type }));

  const ns = innermost.namespace;
  return {
    name: innermost.name,
    qualifiedName: ns ? `${ns}::${innermost.name}` : innermost.name,
    participants,
    sourceLocation: { line: innermost.line, endLine: innermost.endLine },
  };
}

/**
 * Find all intra-block references to the body item declared at `bodyItemLine`.
 *
 * Scans the body of whichever block node contains that line for:
 *   - partAlias declarations: found in message `from`/`to` and connection `fromPart`/`toPart`
 *   - port declarations:      found in connection `fromPort`/`toPort`
 *
 * Returns an empty array when `bodyItemLine` is not inside any block or when the
 * body item has no intra-block references (e.g. it is itself a message node).
 */
export function getIntraBlockReferences(
  analysis: SysMLAnalysis,
  bodyItemLine: number,
): Reference[] {
  for (const containerNode of analysis.model.nodes) {
    if (!('body' in containerNode)) continue;
    const body = (containerNode as { body: SysMLNode[] }).body;
    const bodyItem = body.find(c => (c as { line: number }).line === bodyItemLine);
    if (!bodyItem) continue;

    const refs: Reference[] = [];

    if (bodyItem.kind === 'partAlias') {
      const alias = bodyItem as Extract<SysMLNode, { kind: 'partAlias' }>;
      const seen  = new Set<number>();
      for (const c of body) {
        if (c.kind === 'message') {
          const msg = c as Extract<SysMLNode, { kind: 'message' }>;
          if ((msg.from === alias.name || msg.to === alias.name) && !seen.has(msg.line)) {
            seen.add(msg.line);
            refs.push({ node: c, referencedName: alias.name, line: msg.line });
          }
        } else if (c.kind === 'connection') {
          const conn = c as Extract<SysMLNode, { kind: 'connection' }>;
          if ((conn.fromPart === alias.name || conn.toPart === alias.name) && !seen.has(conn.line)) {
            seen.add(conn.line);
            refs.push({ node: c, referencedName: alias.name, line: conn.line });
          }
        }
      }
    } else if (bodyItem.kind === 'port') {
      const port = bodyItem as Extract<SysMLNode, { kind: 'port' }>;
      for (const c of body) {
        if (c.kind === 'connection') {
          const conn = c as Extract<SysMLNode, { kind: 'connection' }>;
          if (conn.fromPort === port.name || conn.toPort === port.name) {
            refs.push({ node: c, referencedName: port.name, line: conn.line });
          }
        }
      }
    }

    return refs;
  }
  return [];
}
