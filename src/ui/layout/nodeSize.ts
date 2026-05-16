/**
 * Canvas-based text measurement for content-aware node sizing.
 *
 * A single hidden <canvas> is reused for all measurements — accurate to
 * within ~3% of the browser's actual layout engine, which is close enough
 * that ELK and React Flow receive consistent, non-overflowing dimensions.
 */

let _ctx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D | null {
  if (_ctx) return _ctx;
  if (typeof document === 'undefined') return null;
  _ctx = document.createElement('canvas').getContext('2d');
  return _ctx;
}

/** Pixel width of a single string at the given CSS font spec (e.g. "bold 13px sans-serif"). */
export function textPx(text: string, font: string): number {
  const ctx = getCtx();
  if (!ctx) return text.length * 8; // SSR / test fallback: ~8 px/char
  ctx.font = font;
  return ctx.measureText(text).width;
}

export interface TextRow {
  text: string;
  font: string;
}

/**
 * Minimum node width needed to fit all provided text rows without clipping,
 * plus horizontal padding, clamped to minW.
 */
export function fitNodeWidth(rows: TextRow[], hPad: number, minW: number): number {
  const max = rows.length ? Math.max(...rows.map(r => textPx(r.text, r.font))) : 0;
  return Math.max(minW, Math.ceil(max) + hPad);
}

/**
 * Estimate how many display lines a string occupies at innerPx pixels of
 * available width.  Handles both whitespace-delimited words and long
 * identifier strings (no spaces → character-level wrap via break-word).
 */
export function estimateWrapLines(text: string, font: string, innerPx: number): number {
  const ctx = getCtx();
  if (!ctx || innerPx <= 0 || !text) return 1;
  ctx.font = font;
  const totalW = ctx.measureText(text).width;
  if (totalW <= innerPx) return 1;
  // For text with spaces, word-wrap; for identifiers, character-wrap.
  if (text.includes(' ')) {
    const words = text.split(/\s+/);
    let line = '';
    let lines = 1;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > innerPx && line) { lines++; line = w; }
      else line = test;
    }
    return lines;
  }
  return Math.ceil(totalW / innerPx);
}
