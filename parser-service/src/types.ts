export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  line?: number;
  column?: number;
  code?: string;
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

export interface ActionPort {
  name: string;
  direction: 'in' | 'out';
  itemType?: string;
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
  /** Name of the directly enclosing structural definition (e.g. "Controller"); set for ActionDefinition and ActionUsage entries inside PartDefinition etc. */
  owningDefName?: string;
  /** EMF type of the enclosing structural definition (e.g. "PartDefinition") */
  owningDefType?: string;
  /** For ActionUsage/PerformActionUsage: resolved type name from FeatureTyping (e.g. "ReadSensor") */
  actionType?: string;
  /** Name of the enclosing `ref part` (performer/swimlane) for a `perform action`, if any.
   *  Disambiguates two actions that share a name under different parts (e.g. can.inhibitTx vs flexRay.inhibitTx). */
  performer?: string;
  /** ASIL safety level (e.g. 'ASIL_D', 'QM') from an applied `@ASIL` metadata usage. */
  asil?: string;
  /** In/out item ports (parameters) on this action */
  ports?: ActionPort[];
}

export type BehaviorFlow =
  // `sourceQual` / `targetQual` carry the FULL qualified endpoint (e.g. `can.inhibitTx`) when the
  // reference was qualified; `source` / `target` stay the bare last segment. Used to disambiguate
  // two actions that share a name but live under different `ref part`s (different swimlanes).
  | { id: string; source: string; target: string; type: 'succession'; sourceQual?: string; targetQual?: string }
  | { id: string; sourceName: string; targetName: string; type: 'succession'; unresolved: true }
  | { id: string; source: string; target: string; type: 'transition'; guard?: string; sourceQual?: string; targetQual?: string }
  | { id: string; sourceName: string; targetName: string; type: 'transition'; guard?: string; unresolved: true }
  | { id: string; source: string; sourcePort: string | null; target: string; targetPort: string | null; type: 'itemFlow'; sourceQual?: string; targetQual?: string };

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

/**
 * A single `allocate X.Y to Z` statement (SysML v2 §16.3 AllocationUsage).
 * Represents the assignment of an action to a responsible structural part —
 * the semantic basis for swimlane partitioning in action diagrams.
 */
export interface BehaviorAllocation {
  /** Dotted source path, e.g. ['voltageTemperatureMonitoring', 'acquireSupplyVoltages'] */
  sourcePath: string[];
  /** Target part/element name, e.g. 'signalConversion' */
  targetName: string;
  /** How the assignment was authored: an explicit `allocate` (default) or a `perform action`
   *  inside a `ref part` — `ref part P { perform action A; }` ⇒ A on lane P. */
  kind?: 'allocate' | 'perform';
  /** For `perform` allocations: name of the enclosing ActionDefinition, so the swimlane mapping
   *  is scoped to the right behavior. */
  behaviorScope?: string;
}

export interface BehaviorData {
  actions: BehaviorAction[];
  flows: BehaviorFlow[];
  /** Conditional/loop structures discovered in the model */
  conditionals: BehaviorConditional[];
  /** Allocation statements (allocate X to Y) — swimlane assignments */
  allocations?: BehaviorAllocation[];
}

/**
 * A single identifier occurrence in the primary source file, emitted by the official
 * parser (SysmlParseCli). Powers the extension's IDE language features (hover, references,
 * rename, semantic tokens, completion, document symbols) — replacing the retired
 * TypeScript analyzer's symbol table.
 */
export interface SourceOccurrence {
  /** 0-based line. */
  line: number;
  /** 0-based column. */
  column: number;
  /** Length of the identifier in characters. */
  length: number;
  /** 'decl' = declaration of the symbol; 'ref' = a reference/use of it. */
  role: 'decl' | 'ref';
  /** Stable symbol identity — the resolved qualified name when available, else the source text. */
  symbolKey: string;
  /** Semantic token type (see SYSML_TOKEN_TYPES in the extension). */
  tokenType: string;
}

export interface SysMLV2ParseResult {
  success: boolean;
  diagnostics: Diagnostic[];
  model?: ModelNode[];
  /** Raw model trees for context (imported) files — used to resolve cross-file port directions. */
  contextModels?: ModelNode[][];
  graph?: import('./graphBuilder').ContainmentGraph;
  behavior?: BehaviorData;
  /** Identifier occurrence table for the primary file (IDE language features). */
  symbols?: SourceOccurrence[];
  /**
   * Message→interface-port `dependency` mappings across all parsed files, used to
   * derive per-message ASIL in the sequence view (see messageInterfaceAsil.ts).
   */
  dependencies?: {
    name: string;
    clientQualifiedName: string;
    supplierQualifiedName: string;
    ownerQualifiedName: string;
  }[];
  rawResponse?: unknown;
  error?: string;
}
