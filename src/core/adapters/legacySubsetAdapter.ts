/**
 * Legacy subset adapter.
 *
 * Converts the output of parseAndValidate() (parserMode = 'legacySubset') into
 * a VisualizerModel that the views consume.
 *
 * The conversion is intentionally explicit rather than a direct cast, so the
 * adapter boundary is clear when the official adapter eventually replaces it.
 * The structural shape is currently identical — the adapter's value is the
 * module-level isolation, not the runtime transformation.
 *
 * Do NOT add any logic specific to the legacy parser's internal representation
 * here. Such logic belongs in the parser pipeline itself (astParser → modelBuilder).
 */

import type { ParseResult } from '../modelTypes';
import type { VisualizerModel } from '../visualizerModel';

/**
 * Convert a legacy subset ParseResult into a VisualizerModel.
 *
 * All fields are passed through without transformation. The adapter enforces
 * that views depend on VisualizerModel, not on ParseResult.
 */
export function convert(result: ParseResult): VisualizerModel {
  return {
    parserMode:  result.parserMode,
    nodes:       result.nodes,
    packages:    result.packages,
    diagnostics: result.diagnostics,
  };
}
