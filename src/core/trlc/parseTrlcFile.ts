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
    const recordMatch = line.match(/^([\w.]+)\s+(\w+)\s*(\{)?/);
    if (!recordMatch) {
      pendingTitle = null;
      continue;
    }

    const recordId = recordMatch[2];
    const kind     = reqKind(recordMatch[1].split('.').pop() ?? '');
    const title = pendingTitle ?? recordId;
    pendingTitle = null;

    // If '{' is not on the declaration line, expect it on the next line
    if (!recordMatch[3]) {
      if (i < lines.length && lines[i].trim() === '{') i++;
    }

    // Parse field block until '}'
    let description = '';
    let asil: string | undefined;
    let derivedFrom: string[] = [];

    while (i < lines.length) {
      const fieldLine = lines[i].trim();
      i++;
      if (fieldLine === '}') break;

      const eqIdx = fieldLine.indexOf('=');
      if (eqIdx < 0) continue;

      const key    = fieldLine.slice(0, eqIdx).trim();
      const valRaw = fieldLine.slice(eqIdx + 1).trim().replace(/;$/, '').trim();

      // Native-IPF triple-quoted string (possibly multi-line): key = ''' … '''
      if (valRaw.startsWith("'''")) {
        let body = valRaw.slice(3);
        const inlineEnd = body.indexOf("'''");
        if (inlineEnd >= 0) {
          body = body.slice(0, inlineEnd);                    // opens and closes on one line
        } else {
          const parts = body ? [body] : [];
          while (i < lines.length) {
            const l = lines[i]; i++;
            const end = l.indexOf("'''");
            if (end >= 0) { parts.push(l.slice(0, end)); break; }
            parts.push(l);
          }
          body = parts.join('\n');
        }
        if (key === 'description') description = body.replace(/\s+/g, ' ').trim();
        continue;
      }

      // Array value: key = [ a, b, ] — possibly spanning multiple lines.
      if (valRaw.startsWith('[')) {
        let body = valRaw.slice(1);
        const closeInline = body.indexOf(']');
        if (closeInline >= 0) {
          body = body.slice(0, closeInline);
        } else {
          while (i < lines.length) {
            const l = lines[i]; i++;
            const end = l.indexOf(']');
            if (end >= 0) { body += ' ' + l.slice(0, end); break; }
            body += ' ' + l;
          }
        }
        const items = body.split(',').map(s => s.trim()).filter(Boolean);
        if (key === 'derived_from_trlc') derivedFrom = items;
        continue;
      }

      // Legacy double-quoted string: key = "…"
      const quoted = extractStringLiteral(valRaw);
      if (quoted !== null) {
        if (key === 'description') description = quoted;
        else if (key === 'asil')   asil = quoted || undefined;
        continue;
      }

      // Bare enum value, e.g. asil = IpfRMBase.ASIL.D  →  D
      if (key === 'asil') asil = (valRaw.split('.').pop() ?? '').trim() || undefined;
    }

    requirements.push({
      id: recordId, title, text: description, asil, kind,
      derivedFrom: derivedFrom.length ? derivedFrom : undefined,
      source: 'trlc',
    });
  }

  return { requirements, traces: [] };
}

// Record type ("SystemRequirement", "HardwareRequirement", …) → short category.
function reqKind(type: string): string {
  if (/Hardware/i.test(type)) return 'HW';
  if (/Software/i.test(type)) return 'SW';
  if (/System/i.test(type))   return 'SYS';
  return type.replace(/Requirement$/, '') || type;
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
