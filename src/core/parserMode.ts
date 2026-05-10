/**
 * Parser mode flag for the SysML v2 Visualizer.
 *
 * Two modes are declared:
 *
 *   legacySubset
 *     A hand-written, custom prototype language invented for this visualizer.
 *     It is NOT a conformant SysML v2 subset and should not be treated as one.
 *     The grammar, node kinds, keyword set, and diagnostic messages are all
 *     internal implementation details of this tool.
 *
 *     Status: FROZEN.  No new constructs, keywords, or grammar rules will be
 *     added to this path.  Existing behaviour is preserved only so that current
 *     demos, tests, and the VS Code extension continue to work.
 *
 *   sysmlV2OfficialFuture
 *     Reserved for a future conformant implementation that follows the official
 *     SysML v2 specification (OMG formal/2024-11-07) and the KerML foundation
 *     layer, including the standard textual concrete syntax.
 *
 *     Status: NOT IMPLEMENTED.  No parser, model builder, or validator exists
 *     for this mode yet.  All new architecture work (AST shapes, symbol
 *     resolution, validators, LSP providers) must be designed so it can serve
 *     this mode when the implementation arrives.
 *
 * Architectural guidance for new code
 * ─────────────────────────────────────
 * • Never add new grammar rules or new SysMLNode kinds in legacySubset mode.
 * • New APIs should accept a ParserMode parameter and guard legacy-only paths
 *   behind `if (mode === 'legacySubset')`.
 * • If a concept exists in official SysML v2, name the new code after the
 *   spec term (e.g. `FeatureNode`, `PartUsage`) rather than the legacy term.
 * • The legacySubset parse pipeline (parseToAST → buildModel → validate) is
 *   the reference implementation to replace, not to extend.
 */

export type ParserMode = 'legacySubset' | 'sysmlV2OfficialFuture';

/**
 * Runtime mode selected by the user in the UI.
 *
 * prototypeSubset
 *   Use the frozen PrototypeSubsetParser (current default).
 *   All existing views and features work as before.
 *
 * officialSysMLV2
 *   Send source text to the HttpSysMLV2ParserService and show diagnostics
 *   from the official backend.  Visualizer views are not yet populated from
 *   official parse output — see docs/MIGRATION_TO_SYSML_V2.md.
 */
export type ModelingMode = 'prototypeSubset' | 'officialSysMLV2';

/** Human-readable labels for the runtime modeling mode selector. */
export const MODELING_MODE_LABELS: Record<ModelingMode, string> = {
  prototypeSubset: 'Prototype Subset',
  officialSysMLV2: 'Official SysML v2',
};

/**
 * The mode active in this build.
 *
 * Currently hard-coded to 'legacySubset'.  Switching to 'sysmlV2OfficialFuture'
 * requires a conformant parser — there is no implementation yet.
 */
export const PARSER_MODE: ParserMode = 'legacySubset';

/** Human-readable labels for each mode. */
export const PARSER_MODE_LABELS: Record<ParserMode, string> = {
  legacySubset:         'Legacy Subset (prototype)',
  sysmlV2OfficialFuture: 'SysML v2 Official (future)',
};
