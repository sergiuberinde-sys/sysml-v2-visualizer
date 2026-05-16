import type { VisualizerModel } from '../visualizerModel';

/**
 * Shared contract for all in-process parser implementations.
 *
 * Both the legacy prototype parser and any future grammar-based parser must
 * satisfy this interface so that the app layer can swap them without touching
 * view or panel code.
 *
 * Note: this is distinct from SysMLV2Adapter (src/core/sysmlv2/), which
 * describes *remote* backends (LSP server, REST API).  IParser is for
 * *in-process* parsers that run synchronously on the main thread.
 */
export interface IParser {
  /** Identifies this parser in logs, badges, and diagnostics. */
  readonly name: string;

  /**
   * Parse SysML source text and return a VisualizerModel.
   *
   * Must never throw for recoverable parse errors — surface them via
   * `diagnostics` on the returned model instead.  May throw only for
   * unrecoverable internal errors (e.g. WASM module failed to load).
   */
  parse(text: string): VisualizerModel;
}
