/**
 * Shared primitive types for the SysML v2 integration spike.
 *
 * All types here are mode-agnostic — they describe the surface used by any
 * future official SysML v2 parser adapter, regardless of which integration
 * option (LSP server, REST API, ANTLR4, tree-sitter) is eventually chosen.
 *
 * See docs/OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md for the full option analysis.
 */

// ── Diagnostics ───────────────────────────────────────────────────────────────

/**
 * A diagnostic produced by an official SysML v2 / KerML parser.
 *
 * Intentionally mirrors `ParseDiagnostic` (from core/modelTypes) so that
 * the adapter can convert between them without information loss.
 * Kept as a separate type to avoid coupling this spike to legacy internals.
 */
export interface SysMLV2Diagnostic {
  /** 1-based source line number. */
  line: number;
  /** 1-based source column number, if available. */
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  /** Optional machine-readable error code (e.g. from the Pilot Implementation). */
  code?: string;
}

// ── Integration option tag ────────────────────────────────────────────────────

/**
 * Which backend provides the parse result.
 *
 * Used to distinguish results in tests and the inspector panel.
 * Values correspond to the options in OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md.
 */
export type SysMLV2AdapterKind =
  | 'placeholder'          // OfficialSysMLV2AdapterPlaceholder — not implemented
  | 'pilotLspServer'       // Option A: Pilot Implementation LSP server
  | 'restApiService'       // Option B: SysML v2 REST API service
  | 'antlr4TypeScript'     // Option C1: generated ANTLR4 TypeScript parser
  | 'treeSitterWasm';      // Option C2: tree-sitter WASM grammar
