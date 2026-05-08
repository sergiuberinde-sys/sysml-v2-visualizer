/**
 * Tests for the core analyzer API: analyzeSysML and query functions.
 * These APIs are designed to be shared by the VS Code extension and a future LSP.
 * All line/column numbers are 1-based.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeSysML,
  getDiagnostics,
  getSymbolAtPosition,
  getDefinitionForSymbol,
  getReferencesToSymbol,
  getIntraBlockReferences,
} from '../analyzer/analyzeSysML';

// ── 1. analyzeSysML — basic output shape ─────────────────────────────────────

describe('analyzeSysML', () => {
  it('returns ast, model, symbols, and diagnostics fields', () => {
    const result = analyzeSysML('interface def BrakeSignal;');
    expect(result).toHaveProperty('ast');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('symbols');
    expect(result).toHaveProperty('diagnostics');
  });

  it('returns diagnostics for a valid model with no errors', () => {
    const src = `
interface def Signal;
part def Pedal {
  port out p : Signal;
}
`;
    const result = analyzeSysML(src);
    const errors = getDiagnostics(result).filter(d => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('returns diagnostics including parser errors', () => {
    const src = `
interface def Signal;
part def Pedal {
  port out p : NoSuchType;
}
`;
    const result = analyzeSysML(src);
    const codes = getDiagnostics(result).map(d => d.code);
    expect(codes).toContain('UNKNOWN_INTERFACE');
  });

  it('symbols table contains declared interface def', () => {
    const result = analyzeSysML('interface def BrakeSignal;');
    const sym = result.symbols.all().find(s => s.name === 'BrakeSignal');
    expect(sym).toBeDefined();
    expect(sym?.kind).toBe('interfaceDef');
  });

  it('symbols table contains declared part def', () => {
    const src = `
part def Pedal {
}
`;
    const result = analyzeSysML(src);
    const sym = result.symbols.all().find(s => s.name === 'Pedal');
    expect(sym).toBeDefined();
    expect(sym?.kind).toBe('partDef');
  });

  it('symbols table contains symbols from packages with correct qualified names', () => {
    const src = `
package Braking {
  interface def Signal;
  part def Pedal {
  }
}
`;
    const result = analyzeSysML(src);
    const signal = result.symbols.all().find(s => s.qualifiedName === 'Braking::Signal');
    const pedal  = result.symbols.all().find(s => s.qualifiedName === 'Braking::Pedal');
    expect(signal).toBeDefined();
    expect(pedal).toBeDefined();
    expect(signal?.namespacePath).toEqual(['Braking']);
  });

  it('model nodes contain flat list of non-package nodes', () => {
    const src = `
interface def Signal;
part def Pedal {
}
`;
    const result = analyzeSysML(src);
    const kinds = result.model.nodes.map(n => n.kind);
    expect(kinds).toContain('interfaceDef');
    expect(kinds).toContain('partDef');
    expect(kinds).not.toContain('packageDef');
  });
});

// ── 2. getDiagnostics ─────────────────────────────────────────────────────────

describe('getDiagnostics', () => {
  it('returns the combined parser + semantic diagnostics array', () => {
    const src = `
interface def Signal;
part def Pedal {
  port out p : Missing;
}
`;
    const analysis = analyzeSysML(src);
    const diags = getDiagnostics(analysis);
    expect(Array.isArray(diags)).toBe(true);
    expect(diags.some(d => d.code === 'UNKNOWN_INTERFACE')).toBe(true);
  });

  it('returns empty array for fully valid model', () => {
    const src = `
interface def Signal;
part def Pedal {
  port out p : Signal;
}
`;
    const diags = getDiagnostics(analyzeSysML(src));
    const errors = diags.filter(d => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

// ── 3. getSymbolAtPosition ────────────────────────────────────────────────────

describe('getSymbolAtPosition', () => {
  it('finds a part def at its declaration line', () => {
    const src = [
      'interface def Signal;',  // line 1
      'part def Pedal {',       // line 2
      '}',                      // line 3
    ].join('\n');

    const analysis = analyzeSysML(src);
    const result = getSymbolAtPosition(analysis, 2, 1);

    expect(result).not.toBeNull();
    expect(result?.kind).toBe('symbol');
    if (result?.kind === 'symbol') {
      expect(result.symbol.name).toBe('Pedal');
      expect(result.symbol.kind).toBe('partDef');
    }
  });

  it('finds an interface def at its declaration line', () => {
    const src = [
      'interface def BrakeSignal;',  // line 1
      'part def Pedal {',            // line 2
      '}',                           // line 3
    ].join('\n');

    const analysis = analyzeSysML(src);
    const result = getSymbolAtPosition(analysis, 1, 1);

    expect(result?.kind).toBe('symbol');
    if (result?.kind === 'symbol') {
      expect(result.symbol.name).toBe('BrakeSignal');
      expect(result.symbol.kind).toBe('interfaceDef');
    }
  });

  it('finds a message node at its line', () => {
    const src = [
      'part def Driver;',                          // line 1
      'part def Pedal;',                           // line 2
      'occurrence def Braking {',                  // line 3
      '  part driver : Driver;',                   // line 4
      '  part pedal  : Pedal;',                    // line 5
      '  message press from driver to pedal;',     // line 6
      '}',                                         // line 7
    ].join('\n');

    const analysis = analyzeSysML(src);
    const result = getSymbolAtPosition(analysis, 6, 1);

    expect(result).not.toBeNull();
    expect(result?.kind).toBe('node');
    if (result?.kind === 'node') {
      expect(result.node.kind).toBe('message');
    }
  });

  it('finds a port node at its line', () => {
    const src = [
      'interface def Signal;',     // line 1
      'part def Pedal {',          // line 2
      '  port out p : Signal;',    // line 3
      '}',                         // line 4
    ].join('\n');

    const analysis = analyzeSysML(src);
    const result = getSymbolAtPosition(analysis, 3, 1);

    expect(result?.kind).toBe('node');
    if (result?.kind === 'node') {
      expect(result.node.kind).toBe('port');
    }
  });

  it('returns null for a blank/closing-brace line', () => {
    const src = [
      'part def Pedal {',  // line 1
      '}',                 // line 2 — closing brace, no symbol
    ].join('\n');

    const analysis = analyzeSysML(src);
    const result = getSymbolAtPosition(analysis, 2, 1);
    expect(result).toBeNull();
  });

  it('returns null for out-of-range line', () => {
    const analysis = analyzeSysML('part def Pedal;');
    expect(getSymbolAtPosition(analysis, 999, 1)).toBeNull();
  });
});

// ── 4. getDefinitionForSymbol ─────────────────────────────────────────────────

describe('getDefinitionForSymbol', () => {
  it('resolves a part def by short name', () => {
    const src = `
part def BrakePedal;
`;
    const analysis = analyzeSysML(src);
    const sym = getDefinitionForSymbol(analysis, 'BrakePedal');
    expect(sym).not.toBeNull();
    expect(sym?.kind).toBe('partDef');
    expect(sym?.name).toBe('BrakePedal');
  });

  it('resolves a part usage type to its definition', () => {
    const src = [
      'part def Brake;',    // line 1
      'part def System {',  // line 2
      '  part b : Brake;',  // line 3 — b references Brake
      '}',                  // line 4
    ].join('\n');

    const analysis = analyzeSysML(src);
    // From inside System (namespace ''), resolve 'Brake'
    const def = getDefinitionForSymbol(analysis, 'Brake', '');
    expect(def).not.toBeNull();
    expect(def?.kind).toBe('partDef');
    expect(def?.name).toBe('Brake');
    expect(def?.sourceLocation.line).toBe(1);
  });

  it('resolves an interface def by qualified name', () => {
    const src = `
package Signals {
  interface def BrakeSignal;
}
`;
    const analysis = analyzeSysML(src);
    const sym = getDefinitionForSymbol(analysis, 'Signals::BrakeSignal');
    expect(sym?.kind).toBe('interfaceDef');
    expect(sym?.qualifiedName).toBe('Signals::BrakeSignal');
  });

  it('resolves via local namespace context (local wins over cross-namespace)', () => {
    const src = `
package A {
  part def Brake;
}
package B {
  part def Brake;
}
`;
    const analysis = analyzeSysML(src);
    // In context of namespace 'A', 'Brake' should resolve to A::Brake
    const sym = getDefinitionForSymbol(analysis, 'Brake', 'A');
    expect(sym?.qualifiedName).toBe('A::Brake');
  });

  it('returns null for an unresolved name', () => {
    const analysis = analyzeSysML('part def Pedal;');
    expect(getDefinitionForSymbol(analysis, 'NoSuch')).toBeNull();
  });

  it('returns null for an ambiguous name without context', () => {
    const src = `
package A { part def Brake; }
package B { part def Brake; }
`;
    const analysis = analyzeSysML(src);
    // Ambiguous from root context — resolver returns ambiguous, getDefinitionForSymbol returns null
    const sym = getDefinitionForSymbol(analysis, 'Brake', '');
    expect(sym).toBeNull();
  });
});

// ── 5. getReferencesToSymbol ──────────────────────────────────────────────────

describe('getReferencesToSymbol', () => {
  it('finds port type references to an interface def', () => {
    const src = [
      'interface def Signal;',      // line 1
      'part def Pedal {',           // line 2
      '  port out p : Signal;',     // line 3
      '}',                          // line 4
      'part def Controller {',      // line 5
      '  port in  c : Signal;',     // line 6
      '}',                          // line 7
    ].join('\n');

    const analysis = analyzeSysML(src);
    const sym = analysis.symbols.all().find(s => s.name === 'Signal' && s.kind === 'interfaceDef')!;
    expect(sym).toBeDefined();

    const refs = getReferencesToSymbol(analysis, sym);
    expect(refs.length).toBeGreaterThanOrEqual(2);
    expect(refs.some(r => r.line === 3)).toBe(true);
    expect(refs.some(r => r.line === 6)).toBe(true);
    expect(refs.every(r => r.referencedName === 'Signal')).toBe(true);
  });

  it('finds part type references in composition', () => {
    const src = [
      'part def Wheel;',            // line 1
      'part def Car {',             // line 2
      '  part w1 : Wheel;',        // line 3
      '  part w2 : Wheel;',        // line 4
      '}',                          // line 5
    ].join('\n');

    const analysis = analyzeSysML(src);
    const sym = analysis.symbols.all().find(s => s.name === 'Wheel')!;
    const refs = getReferencesToSymbol(analysis, sym);

    expect(refs.length).toBeGreaterThanOrEqual(2);
    expect(refs.some(r => r.line === 3)).toBe(true);
    expect(refs.some(r => r.line === 4)).toBe(true);
  });

  it('finds participant type references in an occurrence def', () => {
    const src = [
      'part def Driver;',                        // line 1
      'part def Pedal;',                         // line 2
      'occurrence def Braking {',               // line 3
      '  part driver : Driver;',                // line 4
      '  part pedal  : Pedal;',                 // line 5
      '  message press from driver to pedal;',  // line 6
      '}',                                      // line 7
    ].join('\n');

    const analysis = analyzeSysML(src);
    const sym = analysis.symbols.all().find(s => s.name === 'Driver')!;
    const refs = getReferencesToSymbol(analysis, sym);

    expect(refs.some(r => r.line === 4)).toBe(true);
  });

  it('finds action type references in a behavior def', () => {
    const src = [
      'action def Sense;',          // line 1
      'behavior def B {',           // line 2
      '  action a : Sense;',        // line 3
      '  action b : Sense;',        // line 4
      '}',                          // line 5
    ].join('\n');

    const analysis = analyzeSysML(src);
    const sym = analysis.symbols.all().find(s => s.name === 'Sense')!;
    const refs = getReferencesToSymbol(analysis, sym);

    expect(refs.length).toBeGreaterThanOrEqual(2);
    expect(refs.some(r => r.line === 3)).toBe(true);
    expect(refs.some(r => r.line === 4)).toBe(true);
  });

  it('finds trace link references to a requirement def', () => {
    const src = [
      'part def Brake;',           // line 1
      'requirement def R {',       // line 2
      '  id   = "REQ-1"',         // line 3
      '  text = "must stop"',     // line 4
      '}',                         // line 5
      'satisfy Brake satisfies R;', // line 6
    ].join('\n');

    const analysis = analyzeSysML(src);
    const sym = analysis.symbols.all().find(s => s.name === 'R' && s.kind === 'requirementDef')!;
    const refs = getReferencesToSymbol(analysis, sym);

    expect(refs.some(r => r.line === 6)).toBe(true);
  });

  it('returns empty array for a symbol with no references', () => {
    const src = `
interface def Unused;
part def Pedal {
}
`;
    const analysis = analyzeSysML(src);
    const sym = analysis.symbols.all().find(s => s.name === 'Unused')!;
    const refs = getReferencesToSymbol(analysis, sym);
    expect(refs).toHaveLength(0);
  });

  it('finds references by qualified name', () => {
    const src = [
      'package Signals {',              // line 1
      '  interface def Sig;',           // line 2
      '}',                              // line 3
      'part def Pedal {',              // line 4
      '  port out p : Signals::Sig;',  // line 5 — qualified reference
      '}',                             // line 6
    ].join('\n');

    const analysis = analyzeSysML(src);
    const sym = analysis.symbols.all().find(s => s.qualifiedName === 'Signals::Sig')!;
    expect(sym).toBeDefined();

    const refs = getReferencesToSymbol(analysis, sym);
    expect(refs.some(r => r.line === 5)).toBe(true);
  });
});

// ── 6. getIntraBlockReferences ────────────────────────────────────────────────

describe('getIntraBlockReferences', () => {
  it('finds message from/to references for a participant alias', () => {
    const src = [
      'part def Driver;',                          // line 1
      'part def Pedal;',                           // line 2
      'occurrence def Braking {',                  // line 3
      '  part driver : Driver;',                   // line 4  ← bodyItemLine
      '  part pedal  : Pedal;',                    // line 5
      '  message press from driver to pedal;',     // line 6  ← references driver
      '}',                                         // line 7
    ].join('\n');

    const analysis = analyzeSysML(src);
    const refs = getIntraBlockReferences(analysis, 4);
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs.some(r => r.line === 6)).toBe(true);
    expect(refs.every(r => r.referencedName === 'driver')).toBe(true);
  });

  it('finds message references for a participant appearing as both from and to', () => {
    const src = [
      'part def Node;',                         // line 1
      'occurrence def Loop {',                   // line 2
      '  part n : Node;',                        // line 3  ← n
      '  message self from n to n;',             // line 4  ← n appears twice, expect one ref
      '}',                                       // line 5
    ].join('\n');

    const analysis = analyzeSysML(src);
    const refs = getIntraBlockReferences(analysis, 3);
    // One unique line (line 4), even though n appears as both from and to
    const lines = refs.map(r => r.line);
    expect(new Set(lines).size).toBe(lines.length); // no duplicate lines
    expect(refs.some(r => r.line === 4)).toBe(true);
  });

  it('returns empty for a participant with no messages that reference it', () => {
    const src = [
      'part def Driver;',           // line 1
      'occurrence def Braking {',   // line 2
      '  part driver : Driver;',    // line 3 — no messages reference driver
      '}',                          // line 4
    ].join('\n');

    const analysis = analyzeSysML(src);
    const refs = getIntraBlockReferences(analysis, 3);
    expect(refs).toHaveLength(0);
  });

  it('returns empty for a non-existent line', () => {
    const analysis = analyzeSysML('part def Driver;');
    expect(getIntraBlockReferences(analysis, 999)).toHaveLength(0);
  });
});
