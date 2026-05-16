import { describe, it, expect } from 'vitest';
import { formatSysML } from '../language/formatter';

// Helpers
const lines = (...ls: string[]) => ls.join('\n');
const doc   = (...ls: string[]) => ls.join('\n') + '\n';  // formatted output always has trailing \n

// ── 1. Indentation ────────────────────────────────────────────────────────────

describe('formatSysML — indentation', () => {
  it('indents body inside a single block', () => {
    const input    = lines('part def Pedal {', 'port in p : Signal;', '}');
    const expected = doc('part def Pedal {', '  port in p : Signal;', '}');
    expect(formatSysML(input)).toBe(expected);
  });

  it('handles already-correct indentation (idempotent)', () => {
    const input = doc('part def Pedal {', '  port in p : Signal;', '}');
    expect(formatSysML(input)).toBe(input);
  });

  it('indents nested packages and part defs', () => {
    const input = lines(
      'package Braking {',
      'part def Pedal {',
      'port in p : Signal;',
      '}',
      '}',
    );
    const expected = doc(
      'package Braking {',
      '  part def Pedal {',
      '    port in p : Signal;',
      '  }',
      '}',
    );
    expect(formatSysML(input)).toBe(expected);
  });

  it('never produces negative indent (extra closing braces)', () => {
    const input = lines('}', '}', 'part def X;');
    const result = formatSysML(input);
    expect(result).not.toMatch(/^\s{2}/m); // no indented lines (depth clamped to 0)
  });
});

// ── 2. Trailing spaces ────────────────────────────────────────────────────────

describe('formatSysML — trailing spaces', () => {
  it('removes trailing spaces from every line', () => {
    const input    = 'part def Pedal;   \ninterface def Signal;  \n';
    const expected = 'part def Pedal;\ninterface def Signal;\n';
    expect(formatSysML(input)).toBe(expected);
  });

  it('removes trailing spaces inside blocks', () => {
    const input = lines('part def Foo {', '  port in p : Signal;   ', '}');
    expect(formatSysML(input)).not.toMatch(/ +\n/);
  });
});

// ── 3. Blank line collapsing ──────────────────────────────────────────────────

describe('formatSysML — blank lines', () => {
  it('collapses two consecutive blank lines to one', () => {
    const input    = lines('part def A;', '', '', 'part def B;');
    const expected = doc('part def A;', '', 'part def B;');
    expect(formatSysML(input)).toBe(expected);
  });

  it('collapses many consecutive blank lines to one', () => {
    const input = lines('part def A;', '', '', '', '', 'part def B;');
    expect(formatSysML(input)).toBe(doc('part def A;', '', 'part def B;'));
  });

  it('preserves a single blank line', () => {
    const input = doc('part def A;', '', 'part def B;');
    expect(formatSysML(input)).toBe(input);
  });

  it('strips trailing blank lines from the file', () => {
    const input = 'part def A;\n\n\n';
    expect(formatSysML(input)).toBe('part def A;\n');
  });
});

// ── 4. Part block ─────────────────────────────────────────────────────────────

describe('formatSysML — part block', () => {
  it('formats a complete part def with ports and part usages', () => {
    const input = lines(
      'part def System {',
      'port in  p : Signal;',
      'port out q : Signal;',
      'part sub : SubPart;',
      'connect sub.p to sub.q;',
      '}',
    );
    const result = formatSysML(input);
    expect(result).toBe(doc(
      'part def System {',
      '  port in p : Signal;',
      '  port out q : Signal;',
      '  part sub : SubPart;',
      '  connect sub.p to sub.q;',
      '}',
    ));
  });
});

// ── 5. Occurrence block ───────────────────────────────────────────────────────

describe('formatSysML — occurrence block', () => {
  it('formats participants and messages', () => {
    const input = lines(
      'occurrence def Braking {',
      'part driver : Driver;',
      'part pedal : Pedal;',
      'message press from driver to pedal;',
      '}',
    );
    expect(formatSysML(input)).toBe(doc(
      'occurrence def Braking {',
      '  part driver : Driver;',
      '  part pedal : Pedal;',
      '  message press from driver to pedal;',
      '}',
    ));
  });
});

// ── 6. Requirement block ──────────────────────────────────────────────────────

describe('formatSysML — requirement block', () => {
  it('formats id, text, priority and preserves string content', () => {
    const input = lines(
      'requirement def R1 {',
      'id = "REQ-001"',
      'text = "Must stop in time"',
      'priority = "High"',
      '}',
    );
    expect(formatSysML(input)).toBe(doc(
      'requirement def R1 {',
      '  id = "REQ-001"',
      '  text = "Must stop in time"',
      '  priority = "High"',
      '}',
    ));
  });

  it('preserves spaces inside string literals', () => {
    const input = lines(
      'requirement def R {',
      'text = "hello   world  !"',
      '}',
    );
    expect(formatSysML(input)).toContain('"hello   world  !"');
  });

  it('normalizes spacing around = when missing', () => {
    const input = lines(
      'requirement def R {',
      'id="REQ-1"',
      '}',
    );
    expect(formatSysML(input)).toContain('id = "REQ-1"');
  });
});

// ── 7. Spacing normalization ──────────────────────────────────────────────────

describe('formatSysML — spacing normalization', () => {
  it('adds spaces around a single colon', () => {
    expect(formatSysML('part def Foo {\n  port in p:Signal;\n}\n'))
      .toContain('port in p : Signal;');
  });

  it('preserves :: in qualified names', () => {
    expect(formatSysML('part def Foo {\n  port in p : Signals::BrakeSignal;\n}\n'))
      .toContain('port in p : Signals::BrakeSignal;');
  });

  it('adds spaces around ->', () => {
    expect(formatSysML('behavior def B {\n  flow a->b;\n}\n'))
      .toContain('flow a -> b;');
  });

  it('collapses extra spaces around ->', () => {
    expect(formatSysML('behavior def B {\n  flow a  ->  b;\n}\n'))
      .toContain('flow a -> b;');
  });

  it('adds spaces around = outside string literals', () => {
    expect(formatSysML('requirement def R {\n  id="REQ-1"\n}\n'))
      .toContain('id = "REQ-1"');
  });

  it('collapses multiple consecutive spaces', () => {
    expect(formatSysML('part   def   Foo;\n'))
      .toContain('part def Foo;');
  });

  it('removes space before semicolon', () => {
    expect(formatSysML('part def Foo   ;\n'))
      .toContain('part def Foo;');
  });

  it('formats transition arrow', () => {
    expect(formatSysML('state def S {\n  transition A->B on click;\n}\n'))
      .toContain('transition A -> B on click;');
  });
});

// ── 8. Idempotency ────────────────────────────────────────────────────────────

describe('formatSysML — idempotency', () => {
  it('formatting an already-formatted document produces the same result', () => {
    const src = doc(
      'package Braking {',
      '  interface def Signal;',
      '',
      '  part def Pedal {',
      '    port in p : Signal;',
      '    port out q : Signal;',
      '  }',
      '',
      '  occurrence def BrakingSeq {',
      '    part driver : Driver;',
      '    part pedal : Pedal;',
      '    message press from driver to pedal;',
      '  }',
      '',
      '  requirement def R1 {',
      '    id = "REQ-001"',
      '    text = "Must stop"',
      '    priority = "High"',
      '  }',
      '}',
    );
    expect(formatSysML(formatSysML(src))).toBe(formatSysML(src));
  });
});
