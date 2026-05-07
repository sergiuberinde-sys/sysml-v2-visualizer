export type SelectionState = {
  id: string;
  type:
    | 'interface' | 'part' | 'port' | 'systemPart' | 'instance'
    | 'occurrence' | 'message' | 'connection'
    | 'action' | 'behavior' | 'actionInst' | 'behaviorFlow'
    | 'stateMachine' | 'stateEntry' | 'stateTransition'
    | 'requirement' | 'traceLink'
    | 'packageDef';
  name: string;
  extra?: Record<string, string>;
} | null;
