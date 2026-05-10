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
  children: ModelNode[];
}

export interface BehaviorAction {
  id: string;
  name: string;
  type: string;
  ownerId?: string;
}

export type BehaviorFlow =
  | { id: string; source: string; target: string; type: 'succession' }
  | { id: string; sourceName: string; targetName: string; type: 'succession'; unresolved: true };

export interface BehaviorData {
  actions: BehaviorAction[];
  flows: BehaviorFlow[];
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
