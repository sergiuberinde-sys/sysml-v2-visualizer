/**
 * VisualizerModel — the stable, parser-agnostic data model consumed by all
 * visualizer views and panels.
 *
 * Dependency rule
 * ───────────────
 * Views and panels MUST import from this module.
 * Views and panels MUST NOT import from core/modelTypes or core/parser directly.
 * Adapters (legacySubsetAdapter, officialSysMLAdapter) are the only code that
 * bridges parser-specific types to this model.
 *
 * Evolution path
 * ──────────────
 * VizNode is currently a type alias for SysMLNode (the legacy subset union).
 * When official SysML v2 / KerML support is added, new kinds will be introduced
 * here first. The alias relationship will be replaced by an independent union,
 * and the officialSysMLAdapter will map KerML/SysML v2 elements to those kinds.
 * See docs/OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md for the full migration plan.
 */

import type { SysMLNode, PackageDefNode, ParseDiagnostic } from '../modelTypes';
import type { ParserMode } from '../parserMode';

// ── Visualizer element types ──────────────────────────────────────────────────
//
// Currently aliased to the legacy parser types so views require no structural
// changes. When official SysML v2 support arrives, new variant members will be
// added to VizNode and existing aliases will be widened or replaced.

/** All model elements understood by the visualizer. */
export type VizNode = SysMLNode;

/** A top-level package node (tree root for the explorer). */
export type VizPackageNode = PackageDefNode;

/** A diagnostic emitted by parsing or semantic analysis. */
export type VizDiagnostic = ParseDiagnostic;

// Re-export so callers only need one import.
export type { ParserMode };

// ── VisualizerModel ───────────────────────────────────────────────────────────

/**
 * The complete model required to render all visualizer views.
 *
 * Produced by an adapter (legacySubsetAdapter or officialSysMLAdapter) and
 * consumed by views. It intentionally excludes parser-internal artefacts
 * (AST, raw token streams, semantic graph) that views do not need.
 */
export interface VisualizerModel {
  /**
   * Which parser produced this model.
   * Views may use this to show a mode badge or disable unsupported features.
   */
  readonly parserMode: ParserMode;

  /**
   * Flat list of all model elements (non-packageDef nodes).
   * Body-level children (ports, messages, connections, …) are embedded inside
   * their parent's `body` array and are not duplicated at the top level.
   */
  readonly nodes: VizNode[];

  /**
   * Top-level package tree used by the package explorer.
   * Package body children appear in VizPackageNode.body, not in nodes[].
   */
  readonly packages: VizPackageNode[];

  /** Parse and semantic diagnostics in source-line order. */
  readonly diagnostics: VizDiagnostic[];
}
