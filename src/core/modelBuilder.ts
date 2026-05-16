/**
 * Public entry point for the visualizer UI and VS Code extension.
 *
 * parseAndValidate() is the backward-compatible surface used by the UI.
 * New code (extension, future LSP) should prefer analyzeSysML() directly.
 */

import { analyzeSysML } from './analyzer/analyzeSysML';
import { elementLines } from './validator/validator';
import type { ParseResult, ParseDiagnostic, SysMLNode, PackageDefNode } from './modelTypes';
import type { ASTResult } from './ast/astTypes';
import type { SemanticModel } from './model/modelBuilder';

export interface ParseAndValidateResult extends ParseResult {
  ast:   ASTResult;
  model: SemanticModel;
}

/** @deprecated Prefer analyzeSysML() for new code. */
export function parseAndValidate(sysmlText: string): ParseAndValidateResult {
  const analysis = analyzeSysML(sysmlText);
  return {
    ast:          analysis.ast,
    model:        analysis.model,
    nodes:        analysis.model.nodes,
    packages:     analysis.model.packages,
    diagnostics:  analysis.diagnostics,
    parserMode:   analysis.parserMode,
  };
}

export { elementLines };
export { PARSER_MODE, PARSER_MODE_LABELS } from './parserMode';
export type { ParseResult, ParseDiagnostic, SysMLNode, PackageDefNode, SemanticModel };
export type { ParserMode } from './parserMode';
