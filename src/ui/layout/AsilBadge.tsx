/**
 * ASIL safety-level badge — shared across views.
 *
 * SysML v2 renders an applied metadata usage (`@ASIL { level = ... }`) as a
 * textual annotation on the element. We show the level as a small colour-coded
 * tag. Colours follow the ISO 26262 escalation QM < A < B < C < D (neutral →
 * red) so the highest-integrity elements stand out at a glance.
 */
import type { CSSProperties } from 'react';

const ASIL_COLORS: Record<string, { bg: string; fg: string }> = {
  QM:     { bg: '#334155', fg: '#cbd5e1' },
  ASIL_A: { bg: '#3f6212', fg: '#d9f99d' },
  ASIL_B: { bg: '#854d0e', fg: '#fde68a' },
  ASIL_C: { bg: '#9a3412', fg: '#fed7aa' },
  ASIL_D: { bg: '#7f1d1d', fg: '#fecaca' },
};

/** 'ASIL_D' → 'ASIL D'; 'QM' → 'QM'. */
export function asilLabel(level: string): string {
  return level.startsWith('ASIL_') ? `ASIL ${level.slice(5)}` : level;
}

export function asilColors(level: string): { bg: string; fg: string } {
  return ASIL_COLORS[level] ?? { bg: '#334155', fg: '#cbd5e1' };
}

export function AsilBadge({ level, style }: { level: string; style?: CSSProperties }) {
  const c = asilColors(level);
  return (
    <span
      title={`Safety integrity level (ASIL): ${asilLabel(level)}`}
      style={{
        display: 'inline-block', fontFamily: 'monospace', fontSize: 8.5, fontWeight: 700,
        lineHeight: 1, padding: '2px 4px', borderRadius: 3, letterSpacing: '0.3px',
        background: c.bg, color: c.fg, whiteSpace: 'nowrap', ...style,
      }}
    >
      {asilLabel(level)}
    </span>
  );
}

// ── Realization (@Realization { kind = HW | SW }) ─────────────────────────────
// Another applied metadata def; shown the same way. HW vs SW get distinct hues so
// hardware/software realizations are easy to tell apart.
const REALIZATION_COLORS: Record<string, { bg: string; fg: string }> = {
  HW: { bg: '#0e4a5e', fg: '#a5e8ff' },
  SW: { bg: '#3b2a6b', fg: '#d6c8ff' },
};

export function RealizationBadge({ kind, style }: { kind: string; style?: CSSProperties }) {
  const c = REALIZATION_COLORS[kind] ?? { bg: '#334155', fg: '#cbd5e1' };
  return (
    <span
      title={`Realization: ${kind}`}
      style={{
        display: 'inline-block', fontFamily: 'monospace', fontSize: 8.5, fontWeight: 700,
        lineHeight: 1, padding: '2px 4px', borderRadius: 3, letterSpacing: '0.3px',
        background: c.bg, color: c.fg, whiteSpace: 'nowrap', ...style,
      }}
    >
      {kind}
    </span>
  );
}
