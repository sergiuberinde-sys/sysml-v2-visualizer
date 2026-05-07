import { parse } from './parser';
import { validate } from './validator';
import type { ParseResult } from './modelTypes';

export function parseAndValidate(sysmlText: string): ParseResult {
  const parsed = parse(sysmlText);
  const semDiags = validate(parsed);
  return { ...parsed, diagnostics: [...parsed.diagnostics, ...semDiags] };
}
