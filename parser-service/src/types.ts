export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  line?: number;
  column?: number;
}

export interface ModelNode {
  type: string;
  name: string | null;
  direction?: string | null;
  isComposite?: boolean;
  startLine?: number;
  endLine?: number;
  children: ModelNode[];
}

export interface BehaviorAction {
  id: string;
  name: string;
  /** EMF type: ActionUsage | PerformActionUsage | ActionDefinition | DecisionNode | ForkNode | JoinNode | MergeNode */
  type: string;
  ownerId?: string;
  /** id of the containing IfActionUsage or WhileLoopActionUsage, if any */
  conditionalId?: string;
  /** which branch this action belongs to, if inside a conditional */
  branch?: 'then' | 'else' | 'loop';
  /** For ActionDefinition entries: name of the directly enclosing structural definition (e.g. "Controller") */
  owningDefName?: string;
  /** For ActionDefinition entries: EMF type of the enclosing structural definition (e.g. "PartDefinition") */
  owningDefType?: string;
  /** For ActionUsage/PerformActionUsage: resolved type name from FeatureTyping (e.g. "ReadSensor") */
  actionType?: string;
}

export type BehaviorFlow =
  | { id: string; source: string; target: string; type: 'succession' }
  | { id: string; sourceName: string; targetName: string; type: 'succession'; unresolved: true }
  | { id: string; source: string; target: string; type: 'transition'; guard?: string }
  | { id: string; sourceName: string; targetName: string; type: 'transition'; guard?: string; unresolved: true };

/**
 * Represents a discovered conditional / loop construct.
 * Extracted from IfActionUsage and WhileLoopActionUsage EMF nodes.
 */
export interface BehaviorConditional {
  id: string;
  /** 'ifThenElse' = IfActionUsage, 'whileLoop' = WhileLoopActionUsage */
  type: 'ifThenElse' | 'whileLoop';
  ownerId: string | null;
  /** What kind of expression is used as the condition */
  conditionKind: 'LiteralBoolean' | 'FeatureReference' | 'Expression';
  /** Resolved condition text: "true", "false", or a feature name */
  conditionText?: string;
  /** ids of BehaviorAction entries in the then-branch / loop-body */
  thenActionIds: string[];
  /** ids of BehaviorAction entries in the else-branch (ifThenElse only) */
  elseActionIds?: string[];
}

export interface BehaviorData {
  actions: BehaviorAction[];
  flows: BehaviorFlow[];
  /** Conditional/loop structures discovered in the model */
  conditionals: BehaviorConditional[];
}

export interface SysMLV2ParseResult {
  success: boolean;
  diagnostics: Diagnostic[];
  model?: ModelNode[];
  graph?: import('./graphBuilder').ContainmentGraph;
  behavior?: BehaviorData;
  rawResponse?: unknown;
  error?: string;
}
