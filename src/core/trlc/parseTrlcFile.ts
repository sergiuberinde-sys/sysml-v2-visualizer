import type { TrlcData, TrlcRequirement } from './types';

/**
 * Parse a .trlc source file into TrlcData.
 *
 * Handles the TRLC format used by the SysML v2 demo projects:
 *   package PkgName
 *   import TypePkg
 *
 *   // NUMBER – Title (Category)
 *   TypePkg.RecordType RecordId
 *   {
 *       description = "..."
 *       asil = "X"
 *   }
 *
 * Titles are extracted from the comment immediately preceding each record.
 * Multi-line string values are not supported (single-line strings only).
 */
export function parseTrlcFile(text: string): TrlcData {
  const requirements: TrlcRequirement[] = [];
  const lines = text.split('\n');
  let pendingTitle: string | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    i++;

    if (line === '') {
      pendingTitle = null;
      continue;
    }

    if (line.startsWith('package ') || line.startsWith('import ')) {
      continue;
    }

    if (line.startsWith('//')) {
      pendingTitle = extractTitle(line.slice(2).trim());
      continue;
    }

    // Record declaration: "Pkg.Type RecordId" or "Pkg.Type RecordId {"
    const recordMatch = line.match(/^[\w.]+\s+(\w+)\s*(\{)?/);
    if (!recordMatch) {
      pendingTitle = null;
      continue;
    }

    const recordId = recordMatch[1];
    const title = pendingTitle ?? recordId;
    pendingTitle = null;

    // If '{' is not on the declaration line, expect it on the next line
    if (!recordMatch[2]) {
      if (i < lines.length && lines[i].trim() === '{') i++;
    }

    // Parse field block until '}'
    let description = '';
    let asil: string | undefined;

    while (i < lines.length) {
      const fieldLine = lines[i].trim();
      i++;
      if (fieldLine === '}') break;

      const eqIdx = fieldLine.indexOf('=');
      if (eqIdx < 0) continue;

      const key = fieldLine.slice(0, eqIdx).trim();
      const valRaw = fieldLine.slice(eqIdx + 1).trim().replace(/;$/, '').trim();
      const val = extractStringLiteral(valRaw);
      if (val === null) continue;

      if (key === 'description') description = val;
      else if (key === 'asil') asil = val || undefined;
    }

    requirements.push({ id: recordId, title, text: description, asil, source: 'trlc' });
  }

  return { requirements, traces: [] };
}

// "25093540 – Title (Category)" → "Title (Category)"
// Handles en dash (–), em dash (—), and plain hyphen separators.
function extractTitle(comment: string): string {
  const m = comment.match(/^\S+\s*[–—\-]\s*(.*)/);
  return m ? m[1].trim() : comment;
}

// Extract value from a quoted string literal, unescaping \" and \\.
function extractStringLiteral(raw: string): string | null {
  if (raw.length < 2 || !raw.startsWith('"') || !raw.endsWith('"')) return null;
  return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
