import type { SysMLV2ParseResult } from './SysMLV2ParseResult';

/**
 * Contract that every official SysML v2 parser backend must satisfy.
 *
 * Implementations wrap a specific backend (HTTP service, LSP server, etc.)
 * and return a normalised SysMLV2ParseResult.  They must NEVER reject the
 * returned promise — surface all errors via the result object so callers
 * need no try/catch.
 */
export interface SysMLV2ParserService {
  /**
   * Parse SysML v2 / KerML source text using the official backend.
   *
   * @param text - Full source text of a .sysml file.
   * @returns A promise that always resolves; errors appear in the result.
   */
  parse(text: string, context?: { name: string; text: string }[]): Promise<SysMLV2ParseResult>;
}
