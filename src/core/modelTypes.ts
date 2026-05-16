import type { ParserMode } from './parserMode';

export interface ParseDiagnostic {
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
}

// ── Node kinds ─────────────────────────────────────────────────────────────────
// "namespace" = parent namespace path, e.g. "VehicleSystems::Braking".
// Internal body-only nodes (port, partAlias, etc.) live inside their parent's
// body and don't have a namespace.

export type SysMLNode =
  | { kind: 'package';        name: string;                                                                                         line: number }
  | { kind: 'packageDef';     name: string; namespace: string; body: SysMLNode[];                                        line: number; endLine?: number }
  | { kind: 'interfaceDef';   name: string; namespace: string;                                                                      line: number }
  | { kind: 'portDef';        name: string; namespace: string; body?: SysMLNode[];                                               line: number }
  | { kind: 'partDef';        name: string; namespace: string; body: SysMLNode[];                                        line: number; endLine?: number }
  | { kind: 'itemDef';        name: string; namespace: string; body: SysMLNode[];                                        line: number; endLine?: number }
  | { kind: 'partUsage';      name: string; namespace: string; type: string; body: SysMLNode[];                          line: number; endLine?: number }
  | { kind: 'attributeDef';   name: string; namespace: string; body: SysMLNode[];                                        line: number; endLine?: number }
  | { kind: 'attributeUsage'; name: string; type: string;                                                                line: number }
  | { kind: 'occurrenceDef';  name: string; namespace: string; body: SysMLNode[];                                        line: number; endLine?: number }
  | { kind: 'port';           name: string; direction: 'in' | 'out' | 'inout' | ''; portType: string;                              line: number }
  | { kind: 'partAlias';      name: string; type: string;                                                                           line: number }
  | { kind: 'itemAlias';      name: string; type: string;                                                                           line: number }
  | { kind: 'connection';     fromPart: string; fromPort: string; toPart: string; toPort: string; connType?: string;             line: number }
  | { kind: 'message';        name: string; from: string; to: string; occurrence: string; fromColumn?: number; toColumn?: number;  line: number }
  | { kind: 'actionDef';      name: string; namespace: string;                                                                      line: number }
  | { kind: 'behaviorDef';    name: string; namespace: string; body: SysMLNode[];                                        line: number; endLine?: number }
  | { kind: 'actionInst';     name: string; actionType: string;                                                                     line: number }
  | { kind: 'flow';           from: string; to: string;                                                                             line: number }
  | { kind: 'stateDef';       name: string; namespace: string; body: SysMLNode[];                                        line: number; endLine?: number }
  | { kind: 'stateEntry';     name: string;                                                                                         line: number }
  | { kind: 'transition';     from: string; to: string; event: string;                                                              line: number }
  | { kind: 'requirementDef'; name: string; namespace: string; reqId: string; text: string; priority: string;           line: number; endLine?: number }
  | { kind: 'traceLink';      namespace: string; linkType: 'satisfy' | 'verify' | 'trace'; source: string; target: string;         line: number };

export type PackageDefNode = Extract<SysMLNode, { kind: 'packageDef' }>;

export interface ParseResult {
  /** Flat list of every non-packageDef node (namespace field is set on each). */
  nodes: SysMLNode[];
  /** Top-level packageDef nodes (tree, for the package explorer). */
  packages: PackageDefNode[];
  diagnostics: ParseDiagnostic[];
  /**
   * The parser mode that produced this result.
   * Currently always 'legacySubset' — see parserMode.ts.
   */
  parserMode: ParserMode;
}
