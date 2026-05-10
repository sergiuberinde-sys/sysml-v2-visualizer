/**
 * Result type returned by every SysML v2 adapter implementation.
 *
 * On success the adapter populates `visualizerModel` so that all existing
 * views (Structure, Sequence, Behavior, …) can render the parsed model without
 * modification.  On failure the adapter populates `diagnostics` and/or
 * `unsupportedReason` to explain what went wrong.
 *
 * The optional `rawModel` field carries the adapter-specific parse tree before
 * adaptation (JSON-LD from the LSP server, an ANTLR4 ParseTree, etc.).  Views
 * must never depend on `rawModel` — it is provided only for debugging and for
 * writing new adapter unit tests.
 */

import type { VisualizerModel } from '../visualizerModel';
import type { SysMLV2Diagnostic } from './sysmlV2Types';

export interface SysMLV2ImportResult {
  /**
   * True when the adapter produced a usable `visualizerModel`.
   * False when the adapter is not implemented, the source has fatal errors,
   * or the backend is unavailable.
   */
  success: boolean;

  /**
   * Parse and semantic diagnostics from the official parser.
   * May be non-empty even when `success` is true (warnings).
   */
  diagnostics: SysMLV2Diagnostic[];

  /**
   * The visualizer model ready for consumption by all view components.
   * Present only when `success` is true.
   */
  visualizerModel?: VisualizerModel;

  /**
   * The raw parser output before adaptation, for debugging and adapter tests.
   * The concrete type depends on which backend produced the result:
   *   - Pilot LSP server  → JSON-LD document (Record<string, unknown>)
   *   - REST API          → OpenAPI response object
   *   - ANTLR4            → ANTLR4 ParseTree root
   *   - tree-sitter       → web-tree-sitter SyntaxNode
   * Typed as `unknown` to avoid coupling the spike to any specific backend.
   */
  rawModel?: unknown;

  /**
   * Human-readable explanation of why parsing did not succeed.
   * Set by placeholder adapters or when the backend is unreachable.
   */
  unsupportedReason?: string;
}
