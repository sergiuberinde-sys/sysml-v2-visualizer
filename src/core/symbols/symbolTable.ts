import type { SysMLNode } from '../modelTypes';

export type SymbolKind =
  | 'packageDef' | 'interfaceDef' | 'partDef' | 'occurrenceDef'
  | 'actionDef' | 'behaviorDef' | 'stateDef' | 'requirementDef';

export interface Symbol {
  name: string;
  qualifiedName: string;
  kind: SymbolKind;
  namespacePath: string[];
  sourceLocation: { line: number; endLine?: number };
  astNodeId?: string;
  node: SysMLNode;
}

export class SymbolTable {
  private byQualified = new Map<string, Symbol>();
  private byShort     = new Map<string, Symbol[]>();

  define(symbol: Symbol): void {
    // First definition wins for qualified lookup; duplicates tracked in diagnostics separately
    if (!this.byQualified.has(symbol.qualifiedName)) {
      this.byQualified.set(symbol.qualifiedName, symbol);
    }
    const arr = this.byShort.get(symbol.name) ?? [];
    arr.push(symbol);
    this.byShort.set(symbol.name, arr);
  }

  lookupQualified(qualifiedName: string): Symbol | undefined {
    return this.byQualified.get(qualifiedName);
  }

  /** All symbols sharing this short name (across any namespace). */
  lookupShort(name: string): Symbol[] {
    return this.byShort.get(name) ?? [];
  }

  all(): Symbol[] {
    return [...this.byQualified.values()];
  }
}

const SYMBOL_KINDS = new Set<string>([
  'packageDef', 'interfaceDef', 'partDef', 'occurrenceDef',
  'actionDef', 'behaviorDef', 'stateDef', 'requirementDef',
]);

export function buildSymbolTable(nodes: SysMLNode[]): SymbolTable {
  const table = new SymbolTable();

  for (const node of nodes) {
    if (!SYMBOL_KINDS.has(node.kind)) continue;
    if (!('name' in node)) continue;

    const n = node as { name: string; namespace?: string; kind: string; line: number; endLine?: number };
    const namespacePath = n.namespace ? n.namespace.split('::').filter(Boolean) : [];
    const qualifiedName = n.namespace ? `${n.namespace}::${n.name}` : n.name;

    table.define({
      name: n.name,
      qualifiedName,
      kind: n.kind as SymbolKind,
      namespacePath,
      sourceLocation: { line: n.line, endLine: n.endLine },
      node,
    });
  }

  return table;
}
