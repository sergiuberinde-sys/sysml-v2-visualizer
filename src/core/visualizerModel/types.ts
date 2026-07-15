/**
 * VisualizerModel — the stable, parser-agnostic data model consumed by all
 * visualizer views and panels.
 *
 * Dependency rule
 * ───────────────
 * Views and panels MUST import from this module.
 * Views and panels MUST NOT import from core/modelTypes directly.
 * The officialSysMLAdapter (convertGraph) is the only code that bridges the
 * official parser's output to this model.
 */

import type { SysMLNode, PackageDefNode, ParseDiagnostic } from '../modelTypes';

// ── Visualizer element types ──────────────────────────────────────────────────
// The shared, view-facing element shapes produced by the official parser adapter.

/** All model elements understood by the visualizer. */
export type VizNode = SysMLNode;

/** A top-level package node (tree root for the explorer). */
export type VizPackageNode = PackageDefNode;

/** A diagnostic emitted by parsing or semantic analysis. */
export type VizDiagnostic = ParseDiagnostic;

// ── VisualizerModel ───────────────────────────────────────────────────────────

/**
 * The complete model required to render all visualizer views.
 *
 * Produced by the official parser adapter (convertGraph) and consumed by views.
 * It intentionally excludes parser-internal artefacts (raw token streams,
 * semantic graph) that views do not need.
 */
export interface VisualizerModel {
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
