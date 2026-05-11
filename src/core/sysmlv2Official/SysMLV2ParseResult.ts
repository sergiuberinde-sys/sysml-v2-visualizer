import type { ModelNode } from './ModelNode';
import type { ContainmentGraph } from './ContainmentGraph';

// ── Behavior data ─────────────────────────────────────────────────────────────
//
// Mirrors the BehaviorData / BehaviorFlow / BehaviorAction types produced by
// parser-service/src/behaviorBuilder.ts.  Kept as a plain object shape so the
// frontend can work with JSON directly without a runtime schema check.

export interface BehaviorAction {
  id: string;
  name: string;
  /** EMF type: ActionUsage | PerformActionUsage | ActionDefinition | DecisionNode | ForkNode | JoinNode | MergeNode */
  type: string;
  /** id of the owning ActionDefinition */
  ownerId?: string;
  /** id of the enclosing IfActionUsage or WhileLoopActionUsage, if any */
  conditionalId?: string;
  /** which branch this action lives in */
  branch?: 'then' | 'else' | 'loop';
}

export type BehaviorFlow =
  | { id: string; source: string; target: string; type: 'succession' }
  | { id: string; sourceName: string; targetName: string; type: 'succession'; unresolved: true }
  | { id: string; source: string; target: string; type: 'transition'; guard?: string }
  | { id: string; sourceName: string; targetName: string; type: 'transition'; guard?: string; unresolved: true };

/**
 * A conditional or loop construct discovered in the model.
 * Extracted from IfActionUsage and WhileLoopActionUsage EMF nodes.
 */
export interface BehaviorConditional {
  id: string;
  type: 'ifThenElse' | 'whileLoop';
  ownerId: string | null;
  conditionKind: 'LiteralBoolean' | 'FeatureReference' | 'Expression';
  conditionText?: string;
  /** ids of BehaviorAction entries in the then-branch / loop-body */
  thenActionIds: string[];
  /** ids of BehaviorAction entries in the else-branch (ifThenElse only) */
  elseActionIds?: string[];
}

export interface BehaviorData {
  actions: BehaviorAction[];
  flows:   BehaviorFlow[];
  /** Conditional / loop structures found in the model */
  conditionals: BehaviorConditional[];
}

/**
 * Result returned by every official SysML v2 parser service implementation.
 *
 * This is the wire-level contract between the visualizer and external parser
 * backends (HTTP service, LSP server, etc.).  It intentionally does NOT carry
 * a VisualizerModel — mapping raw parse output to the visualizer model is a
 * separate step that is not yet implemented.
 *
 * See docs/MIGRATION_TO_SYSML_V2.md for the planned adapter pipeline.
 */
export interface SysMLV2ParseResult {
  /** True when the backend parsed the text without fatal errors. */
  success: boolean;

  /**
   * Diagnostics from the official parser.
   * May be non-empty even when success is true (warnings/info).
   */
  diagnostics: Array<{
    message: string;
    line?: number;
    column?: number;
    severity: 'error' | 'warning' | 'info';
  }>;

  /**
   * Raw EMF containment tree from the Java parser wrapper.
   * Present on success; each node reflects one EObject from the official model.
   */
  model?: ModelNode[];

  /**
   * Containment graph derived from `model` by the officialSysMLAdapter.
   * Present when `model` is available. Only EMF containment edges are included;
   * no SysML-semantic relationships are inferred yet.
   */
  graph?: ContainmentGraph;

  /**
   * Behavior semantics extracted by parser-service/src/behaviorBuilder.ts.
   * Contains all ActionDefinitions, ActionUsage instances, and succession flows
   * found in the model.  Always present (with empty arrays) in official mode
   * once the parser-service responds.
   */
  behavior?: BehaviorData;

  /** The raw HTTP/IPC response body, for debugging. */
  rawResponse?: unknown;

  /**
   * Human-readable error string when something went wrong at the transport
   * or infrastructure level (not a parse diagnostic).
   *
   * Special sentinel values:
   *   'SERVICE_UNAVAILABLE' — network or connection failure; service is down.
   */
  error?: string;
}
