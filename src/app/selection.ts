export type SelectionState = {
  id: string;
  type:
    | 'interface' | 'part' | 'port' | 'systemPart' | 'instance'
    | 'occurrence' | 'message' | 'connection'
    | 'action' | 'behavior' | 'actionInst' | 'behaviorFlow' | 'condition'
    | 'stateMachine' | 'stateEntry' | 'stateTransition'
    | 'requirement' | 'traceLink'
    | 'packageDef';
  name: string;
  line?: number;
  extra?: Record<string, string>;
} | null;
