/**
 * Lightweight TRLC requirement import format.
 *
 * TRLC requirements are EXTERNAL to the SysML v2 model.
 * They are imported separately and linked to SysML elements via explicit trace entries.
 * No semantic inference is performed — only explicit trace links are honoured.
 */

export interface TrlcRequirement {
  id: string;
  title: string;
  text: string;
  asil?: string;
  source: 'trlc';
}

export interface TrlcTrace {
  requirementId: string;
  elementName: string;
}

export interface TrlcData {
  requirements: TrlcRequirement[];
  traces: TrlcTrace[];
}

/**
 * Returns all requirement IDs that trace to the given element name.
 */
export function requirementsForElement(data: TrlcData, elementName: string): TrlcRequirement[] {
  const ids = new Set(
    data.traces
      .filter(t => t.elementName === elementName)
      .map(t => t.requirementId),
  );
  return data.requirements.filter(r => ids.has(r.id));
}

/**
 * Returns all element names that are traced from the given requirement ID.
 */
export function elementsForRequirement(data: TrlcData, requirementId: string): string[] {
  return data.traces
    .filter(t => t.requirementId === requirementId)
    .map(t => t.elementName);
}

/**
 * Parse a raw JSON string into TrlcData.
 * Returns null with an error message on invalid input.
 */
export function parseTrlcJson(raw: string): { data: TrlcData; error: null } | { data: null; error: string } {
  try {
    const obj = JSON.parse(raw) as unknown;
    if (typeof obj !== 'object' || obj === null) return { data: null, error: 'JSON root must be an object' };
    const o = obj as Record<string, unknown>;
    if (!Array.isArray(o['requirements'])) return { data: null, error: 'Missing "requirements" array' };
    if (!Array.isArray(o['traces']))       return { data: null, error: 'Missing "traces" array' };
    return {
      data: {
        requirements: o['requirements'] as TrlcRequirement[],
        traces:       o['traces'] as TrlcTrace[],
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: `Invalid JSON: ${String(e)}` };
  }
}
