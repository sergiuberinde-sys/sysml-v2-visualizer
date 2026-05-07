// 1-based line and column numbers (to match parser output).
// The extension converts to 0-based VS Code Positions.

export interface SourcePosition { line: number; column: number }
export interface SourceRange { start: SourcePosition; end: SourcePosition }

export type IncrementalEdit =
  | { kind: 'insert';  position: SourcePosition; text: string }
  | { kind: 'replace'; range: SourceRange;        text: string }
  | { kind: 'delete';  range: SourceRange };
