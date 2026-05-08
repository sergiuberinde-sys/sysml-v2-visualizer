import type { Symbol, SymbolKind } from './symbolTable';
import { SymbolTable } from './symbolTable';

export type ResolveResult =
  | { found: true;  symbol: Symbol }
  | { found: false; ambiguous: true;  candidates: Symbol[] }
  | { found: false; ambiguous: false };

export class Resolver {
  private table: SymbolTable;
  constructor(table: SymbolTable) { this.table = table; }

  /**
   * Resolve a name in the given namespace context.
   *
   * Algorithm:
   * 1. Qualified name (contains ::) → exact table lookup.
   * 2. Short name → walk up the namespace hierarchy from deepest to root,
   *    trying `ns::name` at each level.
   * 3. If the hierarchy walk fails, fall back to a cross-namespace search:
   *    - 0 candidates → not found
   *    - 1 candidate  → found (unambiguous cross-namespace reference)
   *    - 2+ candidates → ambiguous
   */
  resolve(name: string, contextNamespace: string): ResolveResult {
    if (name.includes('::')) {
      const sym = this.table.lookupQualified(name);
      return sym ? { found: true, symbol: sym } : { found: false, ambiguous: false };
    }

    const parts = contextNamespace ? contextNamespace.split('::').filter(Boolean) : [];

    for (let depth = parts.length; depth >= 0; depth--) {
      const prefix = parts.slice(0, depth).join('::');
      const qualified = prefix ? `${prefix}::${name}` : name;
      const sym = this.table.lookupQualified(qualified);
      if (sym) return { found: true, symbol: sym };
    }

    const candidates = this.table.lookupShort(name);
    if (candidates.length === 0) return { found: false, ambiguous: false };
    if (candidates.length === 1) return { found: true, symbol: candidates[0] };
    return { found: false, ambiguous: true, candidates };
  }

  /**
   * Resolve a name and require the result to be one of the given kinds.
   * If the name resolves to a symbol of the wrong kind, returns not-found.
   */
  resolveOfKind(name: string, contextNamespace: string, ...kinds: SymbolKind[]): ResolveResult {
    const result = this.resolve(name, contextNamespace);
    if (!result.found) return result;
    if (!kinds.includes(result.symbol.kind)) return { found: false, ambiguous: false };
    return result;
  }
}
