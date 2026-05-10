/**
 * Placeholder for the future grammar-based SysML v2 / KerML in-process parser.
 *
 * This class will eventually be the primary parser when one of the following
 * integration options is implemented:
 *
 *   Option C1: Generated TypeScript parser from the official ANTLR4 grammar
 *              (antlr4ng — no JVM required at runtime)
 *   Option C2: tree-sitter WASM grammar compiled from official grammar sources
 *
 * See docs/OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md for full option analysis.
 * See docs/MIGRATION_TO_SYSML_V2.md for the migration guide.
 *
 * When this parser is ready, set it as the active parser in the app entry point
 * and update PARSER_MODE to 'sysmlV2OfficialFuture' in src/core/parserMode.ts.
 */

import type { IParser } from '../parser/IParser';
import type { VisualizerModel } from '../visualizerModel';

export class SysMLV2GrammarParser implements IParser {
  readonly name = 'sysmlV2Grammar' as const;

  parse(_text: string): VisualizerModel {
    throw new Error(
      'SysML v2 grammar-based parser is not yet implemented. ' +
      'See docs/MIGRATION_TO_SYSML_V2.md and docs/OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md.',
    );
  }
}
