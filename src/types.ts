export interface ParseDiagnostic {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

export type SysMLNode =
  | { kind: 'package';       name: string;                                                            line: number }
  | { kind: 'interfaceDef';  name: string;                                                            line: number }
  | { kind: 'partDef';       name: string; body: SysMLNode[];                                         line: number }
  | { kind: 'occurrenceDef'; name: string; body: SysMLNode[];                                         line: number }
  | { kind: 'port';          name: string; direction: 'in' | 'out'; portType: string;                 line: number }
  | { kind: 'partAlias';     name: string; type: string;                                              line: number }
  | { kind: 'connection';    fromPart: string; fromPort: string; toPart: string; toPort: string;      line: number }
  | { kind: 'message';       name: string; from: string; to: string; occurrence: string;              line: number }
  | { kind: 'actionDef';     name: string;                                                            line: number }
  | { kind: 'behaviorDef';   name: string; body: SysMLNode[];                                         line: number }
  | { kind: 'actionInst';    name: string; actionType: string;                                        line: number }
  | { kind: 'flow';          from: string; to: string;                                                line: number };

export interface ParseResult {
  nodes: SysMLNode[];
  diagnostics: ParseDiagnostic[];
}

export type SelectionState = {
  id: string;
  type:
    | 'interface' | 'part' | 'port' | 'systemPart' | 'instance'
    | 'occurrence' | 'message' | 'connection'
    | 'action' | 'behavior' | 'actionInst' | 'behaviorFlow';
  name: string;
  extra?: Record<string, string>;
} | null;
