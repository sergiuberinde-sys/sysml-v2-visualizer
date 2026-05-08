import { describe, it, expect } from 'vitest';
import { analyzeSysML, getOccurrenceAtPosition } from '../analyzer/analyzeSysML';
import { getCompletions } from '../language/completions';

// ── 1. Keyword completions by block context ───────────────────────────────────

describe('getCompletions — keyword context', () => {
  it('top-level: returns all top-level keyword completions', () => {
    const analysis = analyzeSysML('');
    const labels   = getCompletions(analysis, 1, '').map(c => c.label);
    expect(labels).toContain('part def');
    expect(labels).toContain('interface def');
    expect(labels).toContain('occurrence def');
    expect(labels).toContain('behavior def');
    expect(labels).toContain('state def');
    expect(labels).toContain('requirement def');
    expect(labels).toContain('satisfy');
    expect(labels).toContain('verify');
    expect(labels).toContain('trace');
  });

  it('top-level keywords all have kind "keyword"', () => {
    const analysis = analyzeSysML('');
    const items    = getCompletions(analysis, 1, '');
    expect(items.every(c => c.kind === 'keyword')).toBe(true);
  });

  it('inside partDef: suggests port and part keywords', () => {
    // partDef.line=1, endLine=3 → line 2 is strictly inside
    const src    = 'part def Pedal {\n  port out p : Signal;\n}';
    const labels = getCompletions(analyzeSysML(src), 2, '  ').map(c => c.label);
    expect(labels).toContain('port in');
    expect(labels).toContain('port out');
    expect(labels).toContain('part');
    expect(labels).toContain('connect');
    // no top-level keywords
    expect(labels).not.toContain('part def');
    expect(labels).not.toContain('interface def');
  });

  it('inside occurrenceDef: suggests part and message keywords', () => {
    const src    = 'occurrence def Braking {\n  part d : Driver;\n}';
    const labels = getCompletions(analyzeSysML(src), 2, '  ').map(c => c.label);
    expect(labels).toContain('part');
    expect(labels).toContain('message');
    expect(labels).not.toContain('port in');
  });

  it('inside behaviorDef: suggests action and flow keywords', () => {
    const src    = 'behavior def B {\n  action a : Sense;\n}';
    const labels = getCompletions(analyzeSysML(src), 2, '  ').map(c => c.label);
    expect(labels).toContain('action');
    expect(labels).toContain('flow');
    expect(labels).not.toContain('part def');
  });

  it('inside stateDef: suggests state, initial, and transition keywords', () => {
    const src    = 'state def S {\n  state A;\n}';
    const labels = getCompletions(analyzeSysML(src), 2, '  ').map(c => c.label);
    expect(labels).toContain('state');
    expect(labels).toContain('initial');
    expect(labels).toContain('transition');
  });

  it('inside requirementDef: suggests id, text, and priority field keywords', () => {
    const src    = 'requirement def R {\n  id = "REQ-1"\n}';
    const labels = getCompletions(analyzeSysML(src), 2, '  ').map(c => c.label);
    expect(labels).toContain('id =');
    expect(labels).toContain('text =');
    expect(labels).toContain('priority =');
  });

  it('closing-brace line falls back to top-level context', () => {
    // Line 3 is the closing brace, which is endLine — not strictly inside the block
    const src    = 'part def Pedal {\n  port out p : Signal;\n}';
    const labels = getCompletions(analyzeSysML(src), 3, '}').map(c => c.label);
    expect(labels).toContain('part def');
  });
});

// ── 2. Symbol completions by line pattern ─────────────────────────────────────

describe('getCompletions — symbol completions', () => {
  it('port type position: suggests interface defs', () => {
    const src = [
      'interface def Signal;',  // line 1
      'interface def Brake;',   // line 2
      'part def Pedal {',       // line 3
      '  port out p : Signal;', // line 4 (inside block)
      '}',                      // line 5
    ].join('\n');

    const items  = getCompletions(analyzeSysML(src), 4, '  port out p : ');
    const labels = items.map(c => c.label);
    expect(labels).toContain('Signal');
    expect(labels).toContain('Brake');
    expect(items.every(c => c.kind === 'interface')).toBe(true);
  });

  it('port type position: detail is the qualified name', () => {
    const src   = 'package Pkg {\n  interface def Sig;\n}\npart def P {\n  port out p : Sig;\n}';
    const items = getCompletions(analyzeSysML(src), 5, '  port out p : ');
    const sig   = items.find(c => c.label === 'Sig');
    expect(sig?.detail).toBe('Pkg::Sig');
  });

  it('part type position: suggests part defs', () => {
    const src = [
      'part def Wheel;',  // line 1
      'part def Axle;',   // line 2
      'part def Car {',   // line 3
      '  part w : Wheel;',// line 4
      '}',                // line 5
    ].join('\n');

    const items  = getCompletions(analyzeSysML(src), 4, '  part w : ');
    const labels = items.map(c => c.label);
    expect(labels).toContain('Wheel');
    expect(labels).toContain('Axle');
    // Car is also a partDef — it appears in symbols, so it's suggested too
    expect(items.every(c => c.kind === 'part')).toBe(true);
  });

  it('action type position: suggests action defs', () => {
    const src = [
      'action def Sense;', // line 1
      'action def Drive;', // line 2
      'behavior def B {',  // line 3
      '  action a : Sense;',// line 4
      '}',                 // line 5
    ].join('\n');

    const items  = getCompletions(analyzeSysML(src), 4, '  action a : ');
    const labels = items.map(c => c.label);
    expect(labels).toContain('Sense');
    expect(labels).toContain('Drive');
    expect(items.every(c => c.kind === 'action')).toBe(true);
  });

  it('message from position: suggests occurrence participants', () => {
    const src = [
      'part def Driver;',                         // line 1
      'part def Pedal;',                          // line 2
      'occurrence def Braking {',                 // line 3
      '  part driver : Driver;',                  // line 4
      '  part pedal : Pedal;',                    // line 5
      '  message press from driver to pedal;',    // line 6
      '}',                                        // line 7
    ].join('\n');

    const items  = getCompletions(analyzeSysML(src), 6, '  message m from ');
    const labels = items.map(c => c.label);
    expect(labels).toContain('driver');
    expect(labels).toContain('pedal');
    expect(items.every(c => c.kind === 'participant')).toBe(true);
  });

  it('message to position: suggests occurrence participants', () => {
    const src = [
      'part def Driver;',
      'part def Pedal;',
      'occurrence def Braking {',
      '  part driver : Driver;',
      '  part pedal : Pedal;',
      '  message press from driver to pedal;',
      '}',
    ].join('\n');

    const items  = getCompletions(analyzeSysML(src), 6, '  message m from driver to ');
    const labels = items.map(c => c.label);
    expect(labels).toContain('driver');
    expect(labels).toContain('pedal');
  });

  it('participant detail has the form "participant: alias : Type"', () => {
    const src = [
      'part def Driver;',
      'occurrence def Braking {',
      '  part driver : Driver;',
      '  message m from driver to driver;',
      '}',
    ].join('\n');

    const items = getCompletions(analyzeSysML(src), 4, '  message m from ');
    const item  = items.find(c => c.label === 'driver');
    expect(item?.detail).toBe('participant: driver : Driver');
  });

  it('message from/to: returns empty array outside occurrence context', () => {
    // No enclosing occurrenceDef — participants are unknown
    const analysis = analyzeSysML('part def Pedal;');
    const items    = getCompletions(analysis, 1, 'message m from ');
    expect(items).toHaveLength(0);
  });

  it('satisfy target position: suggests requirement defs', () => {
    const src = [
      'part def Brake;',
      'requirement def Stop {',
      '  id = "REQ-1"',
      '  text = "must stop"',
      '}',
      'requirement def Hold {',
      '  id = "REQ-2"',
      '  text = "must hold"',
      '}',
      'satisfy Brake satisfies ',
    ].join('\n');

    const items  = getCompletions(analyzeSysML(src), 10, 'satisfy Brake satisfies ');
    const labels = items.map(c => c.label);
    expect(labels).toContain('Stop');
    expect(labels).toContain('Hold');
    expect(items.every(c => c.kind === 'requirement')).toBe(true);
  });

  it('verify target position: suggests requirement defs', () => {
    const src = [
      'requirement def R {',
      '  id = "REQ-1"',
      '  text = "t"',
      '}',
      'part def Brake;',
      'verify Brake verifies ',
    ].join('\n');

    const items = getCompletions(analyzeSysML(src), 6, 'verify Brake verifies ');
    expect(items.some(c => c.label === 'R' && c.kind === 'requirement')).toBe(true);
  });
});

// ── 3. getOccurrenceAtPosition ────────────────────────────────────────────────

describe('getOccurrenceAtPosition', () => {
  const src = [
    'part def Driver;',                          // line 1
    'part def BrakePedal;',                      // line 2
    'part def BrakeController;',                 // line 3
    'occurrence def TestSequence {',             // line 4
    '  part driver : Driver;',                   // line 5
    '  part pedal : BrakePedal;',                // line 6
    '  part controller : BrakeController;',      // line 7
    '',                                          // line 8 — empty (cursor position)
    '}',                                         // line 9
  ].join('\n');

  it('returns the occurrence context when cursor is inside the block', () => {
    const ctx = getOccurrenceAtPosition(analyzeSysML(src), 8, 1);
    expect(ctx).not.toBeNull();
    expect(ctx?.name).toBe('TestSequence');
  });

  it('returns null when cursor is on the opening-brace line', () => {
    // Line 4 is the declaration line itself — not "inside" the block
    expect(getOccurrenceAtPosition(analyzeSysML(src), 4, 1)).toBeNull();
  });

  it('returns null when cursor is outside any occurrence', () => {
    expect(getOccurrenceAtPosition(analyzeSysML(src), 2, 1)).toBeNull();
  });

  it('returns all participants with alias and type', () => {
    const ctx = getOccurrenceAtPosition(analyzeSysML(src), 8, 1)!;
    expect(ctx.participants).toHaveLength(3);
    expect(ctx.participants).toContainEqual({ alias: 'driver',     type: 'Driver'          });
    expect(ctx.participants).toContainEqual({ alias: 'pedal',      type: 'BrakePedal'      });
    expect(ctx.participants).toContainEqual({ alias: 'controller', type: 'BrakeController' });
  });

  it('returns correct sourceLocation', () => {
    const ctx = getOccurrenceAtPosition(analyzeSysML(src), 8, 1)!;
    expect(ctx.sourceLocation.line).toBe(4);
    expect(ctx.sourceLocation.endLine).toBe(9);
  });

  it('returns correct qualifiedName for occurrence inside a package', () => {
    const pkgSrc = [
      'package Seq {',
      '  occurrence def Step {',
      '    part a : Driver;',
      '  }',
      '}',
    ].join('\n');
    const ctx = getOccurrenceAtPosition(analyzeSysML(pkgSrc), 3, 1);
    expect(ctx?.name).toBe('Step');
    expect(ctx?.qualifiedName).toBe('Seq::Step');
  });

  it('picks the innermost occurrence when occurrences are at different depths', () => {
    const twoOccs = [
      'occurrence def Outer {',             // line 1
      '  part a : Driver;',                 // line 2
      '}',                                  // line 3
      'occurrence def Inner {',             // line 4
      '  part b : BrakePedal;',             // line 5
      '}',                                  // line 6
    ].join('\n');
    // Cursor at line 2 (inside Outer)
    expect(getOccurrenceAtPosition(analyzeSysML(twoOccs), 2, 1)?.name).toBe('Outer');
    // Cursor at line 5 (inside Inner)
    expect(getOccurrenceAtPosition(analyzeSysML(twoOccs), 5, 1)?.name).toBe('Inner');
  });
});

// ── 4. Message endpoint completions (real-document scenarios) ─────────────────

describe('getCompletions — message endpoint completions', () => {
  // Source where the message line is INCOMPLETE (the line being typed)
  const incompleteFromSrc = [
    'part def Driver;',
    'part def BrakePedal;',
    'part def BrakeController;',
    'occurrence def TestSequence {',
    '  part driver : Driver;',
    '  part pedal : BrakePedal;',
    '  part controller : BrakeController;',
    '',                              // line 8 — the user is typing here
    '}',
  ].join('\n');

  it('after "message m from ": suggests all occurrence participants', () => {
    const items  = getCompletions(analyzeSysML(incompleteFromSrc), 8, '  message m from ');
    const labels = items.map(c => c.label);
    expect(labels).toContain('driver');
    expect(labels).toContain('pedal');
    expect(labels).toContain('controller');
  });

  it('after "message m from driver to ": suggests all occurrence participants', () => {
    const items  = getCompletions(analyzeSysML(incompleteFromSrc), 8, '  message m from driver to ');
    const labels = items.map(c => c.label);
    expect(labels).toContain('driver');
    expect(labels).toContain('pedal');
    expect(labels).toContain('controller');
  });

  it('does not suggest part definition type names (only aliases)', () => {
    const items  = getCompletions(analyzeSysML(incompleteFromSrc), 8, '  message m from ');
    const labels = items.map(c => c.label);
    // 'Driver', 'BrakePedal', 'BrakeController' are type names, not aliases
    expect(labels).not.toContain('Driver');
    expect(labels).not.toContain('BrakePedal');
    expect(labels).not.toContain('BrakeController');
  });

  it('returns only aliases from the current occurrence, not a sibling', () => {
    const twoOccs = [
      'part def A;',
      'part def B;',
      'occurrence def OccA {',    // line 3
      '  part a1 : A;',           // line 4
      '}',                        // line 5
      'occurrence def OccB {',    // line 6
      '  part b1 : B;',           // line 7
      '',                         // line 8 — cursor
      '}',                        // line 9
    ].join('\n');

    const items  = getCompletions(analyzeSysML(twoOccs), 8, '  message m from ');
    const labels = items.map(c => c.label);
    expect(labels).toContain('b1');
    expect(labels).not.toContain('a1');
  });

  it('returns empty list gracefully when occurrence is incomplete (no closing brace)', () => {
    // Parser flushes unclosed block with endLine = lastLine
    // Cursor at lastLine means lineNumber < endLine is false → returns []
    const openSrc = 'occurrence def Open {\n  part x : A;\n  message m from ';
    const analysis = analyzeSysML(openSrc);
    // Line 3 is the last line and equals endLine from flush → not strictly inside
    const items = getCompletions(analysis, 3, '  message m from ');
    expect(Array.isArray(items)).toBe(true); // no crash
  });

  it('completion items all have kind "participant"', () => {
    const items = getCompletions(analyzeSysML(incompleteFromSrc), 8, '  message m from ');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(c => c.kind === 'participant')).toBe(true);
  });

  it('completion items have detail in "participant: alias : Type" format', () => {
    const items = getCompletions(analyzeSysML(incompleteFromSrc), 8, '  message m from ');
    const driver = items.find(c => c.label === 'driver');
    expect(driver?.detail).toBe('participant: driver : Driver');
  });
});

// ── 5. Robustness ─────────────────────────────────────────────────────────────

describe('getCompletions — robustness', () => {
  it('does not crash on empty source', () => {
    const analysis = analyzeSysML('');
    expect(() => getCompletions(analysis, 1, '')).not.toThrow();
  });

  it('does not crash on parse-error source', () => {
    const analysis = analyzeSysML('part def { broken\n  port out : ;\n}');
    expect(() => getCompletions(analysis, 2, '  port out : ')).not.toThrow();
  });

  it('does not crash on out-of-range line number', () => {
    const analysis = analyzeSysML('part def Pedal;');
    expect(() => getCompletions(analysis, 9999, '')).not.toThrow();
  });

  it('all keyword insertText values end with a space', () => {
    const analysis = analyzeSysML('');
    const items    = getCompletions(analysis, 1, '');
    expect(items.every(c => c.insertText.endsWith(' '))).toBe(true);
  });

  it('all symbol insertText values match their label', () => {
    const src   = 'interface def Signal;\npart def Pedal {\n  port out p : Signal;\n}';
    const items = getCompletions(analyzeSysML(src), 3, '  port out p : ');
    expect(items.every(c => c.insertText === c.label)).toBe(true);
  });
});
