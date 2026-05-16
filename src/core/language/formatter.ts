/**
 * UI-independent SysML v2 formatter.
 *
 * Consumed by the VS Code DocumentFormattingEditProvider.
 * Pure function: no VS Code imports, no side effects.
 */

// ── Public API ────────────────────────────────────────────────────────────────

export function formatSysML(text: string): string {
  const lines  = text.split('\n');
  const output: string[] = [];
  let   depth  = 0;
  let   blanks = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();

    if (trimmed === '') {
      if (blanks < 1) { output.push(''); blanks++; }
      continue;
    }
    blanks = 0;

    if (trimmed === '}') depth = Math.max(0, depth - 1);
    output.push('  '.repeat(depth) + normalizeContent(trimmed));
    if (trimmed.endsWith('{')) depth++;
  }

  // Strip trailing blank lines; guarantee a single trailing newline.
  while (output.length > 0 && output[output.length - 1] === '') output.pop();
  output.push('');

  return output.join('\n');
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Normalize content of a single trimmed, non-empty line.
 *
 * String literals (from the first `"` to end-of-line) are kept verbatim so
 * that requirement text / ids / priorities are not touched.
 */
function normalizeContent(line: string): string {
  const qi = line.indexOf('"');
  if (qi < 0) return normalizeCode(line);
  const codePart = normalizeCode(line.slice(0, qi).trimEnd());
  const litPart  = line.slice(qi);
  return codePart ? codePart + ' ' + litPart : litPart;
}

/**
 * Apply spacing rules to a segment that contains no string literals:
 *  - collapse multiple spaces to one
 *  - one space on each side of a single `:` (not `::`)
 *  - one space on each side of `->`
 *  - one space on each side of `=`
 *  - no space before a trailing `;`
 */
function normalizeCode(s: string): string {
  return s
    .replace(/  +/g, ' ')
    .replace(/\s*(?<!:):(?!:)\s*/g, ' : ')
    .replace(/\s*->\s*/g, ' -> ')
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s*;$/, ';')
    .trim();
}
