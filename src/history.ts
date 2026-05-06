import type { ParseResult } from './types';

export interface HistorySnapshot {
  id: string;
  text: string;
  timestamp: number;
  parts: number;
  interfaces: number;
  occurrences: number;
  messages: number;
}

export const MAX_HISTORY        = 50;
export const HISTORY_DEBOUNCE_MS = 800;

export function makeSnapshot(text: string, result: ParseResult): HistorySnapshot {
  let messages = 0;
  for (const n of result.nodes) {
    if (n.kind === 'occurrenceDef') {
      messages += n.body.filter(b => b.kind === 'message').length;
    }
  }
  return {
    id:          `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    timestamp:   Date.now(),
    parts:       result.nodes.filter(n => n.kind === 'partDef').length,
    interfaces:  result.nodes.filter(n => n.kind === 'interfaceDef').length,
    occurrences: result.nodes.filter(n => n.kind === 'occurrenceDef').length,
    messages,
  };
}
