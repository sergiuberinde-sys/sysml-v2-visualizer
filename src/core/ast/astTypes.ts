import type { ParseDiagnostic } from '../modelTypes';

export type ASTNode =
  | { kind: 'package';        name: string;                                                                                                          rawText: string; line: number }
  | { kind: 'packageDef';     name: string;                                                                                                          rawText: string; line: number; endLine?: number; children: ASTNode[] }
  | { kind: 'interfaceDef';   name: string;                                                                                                          rawText: string; line: number }
  | { kind: 'partDef';        name: string;                                                                                                          rawText: string; line: number; endLine?: number; children: ASTNode[] }
  | { kind: 'occurrenceDef';  name: string;                                                                                                          rawText: string; line: number; endLine?: number; children: ASTNode[] }
  | { kind: 'port';           name: string; direction: 'in' | 'out' | 'inout'; portType: string;                                                   rawText: string; line: number }
  | { kind: 'itemDef';        name: string;                                                                                                          rawText: string; line: number; endLine?: number; children: ASTNode[] }
  | { kind: 'itemAlias';      name: string; type: string;                                                                                            rawText: string; line: number }
  | { kind: 'partAlias';      name: string; type: string;                                                                                            rawText: string; line: number }
  | { kind: 'connection';     fromPart: string; fromPort: string; toPart: string; toPort: string;                                                   rawText: string; line: number }
  | { kind: 'message';        name: string; from: string; to: string; occurrence: string; fromColumn?: number; toColumn?: number;                   rawText: string; line: number }
  | { kind: 'actionDef';      name: string;                                                                                                          rawText: string; line: number }
  | { kind: 'behaviorDef';    name: string;                                                                                                          rawText: string; line: number; endLine?: number; children: ASTNode[] }
  | { kind: 'actionInst';     name: string; actionType: string;                                                                                     rawText: string; line: number }
  | { kind: 'flow';           from: string; to: string;                                                                                              rawText: string; line: number }
  | { kind: 'stateDef';       name: string;                                                                                                          rawText: string; line: number; endLine?: number; children: ASTNode[] }
  | { kind: 'stateEntry';     name: string;                                                                                                          rawText: string; line: number }
  | { kind: 'transition';     from: string; to: string; event: string;                                                                              rawText: string; line: number }
  | { kind: 'requirementDef'; name: string; reqId: string; text: string; priority: string;                                                          rawText: string; line: number; endLine?: number; children: ASTNode[] }
  | { kind: 'traceLink';      linkType: 'satisfy' | 'verify' | 'trace'; source: string; target: string;                                            rawText: string; line: number }
  | { kind: 'unsupported';    rawText: string;                                                                                                       line: number };

export interface ASTResult {
  nodes: ASTNode[];
  diagnostics: ParseDiagnostic[];
}
