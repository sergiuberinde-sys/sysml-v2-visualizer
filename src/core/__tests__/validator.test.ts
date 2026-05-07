/**
 * Validator tests for the supported SysML v2 subset.
 * See SUPPORTED_SYNTAX.md for the construct reference.
 *
 * Tests use only core parser/validator functions — no React, no VS Code APIs.
 */

import { describe, it, expect } from 'vitest';
import { parseAndValidate } from '../modelBuilder';
import type { ParseDiagnostic } from '../modelTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(src: string): ParseDiagnostic[] {
  return parseAndValidate(src).diagnostics;
}

function codes(src: string): string[] {
  return run(src).map(d => d.code ?? '(no code)');
}

function errors(src: string): ParseDiagnostic[] {
  return run(src).filter(d => d.severity === 'error');
}

function warnings(src: string): ParseDiagnostic[] {
  return run(src).filter(d => d.severity === 'warning');
}

function hasCode(src: string, code: string): boolean {
  return codes(src).includes(code);
}

function errorCodes(src: string): string[] {
  return errors(src).map(d => d.code ?? '');
}

function warnCodes(src: string): string[] {
  return warnings(src).map(d => d.code ?? '');
}

// ── 1. Basic valid model — no diagnostics ────────────────────────────────────

describe('valid model — no errors', () => {
  it('minimal model with interface, parts, ports, and connection', () => {
    const src = `
interface def BrakeSignal;

part def BrakePedal {
  port out pedalOut : BrakeSignal;
}

part def BrakeController {
  port in ctrlIn : BrakeSignal;
}

part def BrakeSystem {
  part pedal      : BrakePedal;
  part controller : BrakeController;
  connect pedal.pedalOut to controller.ctrlIn;
}
`;
    expect(errors(src)).toHaveLength(0);
  });

  it('valid occurrence def with participants and messages', () => {
    const src = `
part def Driver;
part def BrakePedal;

occurrence def NormalBraking {
  part driver : Driver;
  part pedal  : BrakePedal;
  message pedalPressed from driver to pedal;
  message brakeApplied from pedal  to driver;
}
`;
    expect(errors(src)).toHaveLength(0);
  });

  it('valid behavior def with action instances and flows', () => {
    const src = `
action def Sense;
action def Compute;
action def Actuate;

behavior def BrakeControl {
  action sense   : Sense;
  action compute : Compute;
  action actuate : Actuate;
  flow sense   -> compute;
  flow compute -> actuate;
}
`;
    expect(errors(src)).toHaveLength(0);
  });

  it('valid state machine with initial transition', () => {
    const src = `
state def BrakeFSM {
  state Idle;
  state Braking;
  state Released;
  initial -> Idle;
  transition Idle     -> Braking  on pedalPressed;
  transition Braking  -> Released on pedalReleased;
  transition Released -> Idle;
}
`;
    expect(errors(src)).toHaveLength(0);
  });

  it('valid requirement with satisfy link', () => {
    const src = `
part def BrakePedal;

requirement def SafeBraking {
  id       = "REQ-001"
  text     = "The system shall decelerate within 3 s."
  priority = "High"
}

satisfy BrakePedal satisfies SafeBraking;
`;
    expect(errors(src)).toHaveLength(0);
  });

  it('valid namespaced model', () => {
    const src = `
package Braking {
  interface def Signal;

  part def Pedal {
    port out p : Signal;
  }

  part def Controller {
    port in c : Signal;
  }
}
`;
    expect(errors(src)).toHaveLength(0);
  });
});

// ── 2. interface def ─────────────────────────────────────────────────────────

describe('interface def', () => {
  it('DUPLICATE_NAME — same interface def declared twice in root namespace', () => {
    const src = `
interface def Signal;
interface def Signal;
`;
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(true);
  });

  it('UNKNOWN_INTERFACE — port type references undeclared interface', () => {
    const src = `
interface def Good;

part def Foo {
  port out p : Bad;
}
`;
    expect(hasCode(src, 'UNKNOWN_INTERFACE')).toBe(true);
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(false);
  });

  it('no error when port type matches a part def name', () => {
    // allTypeNames includes both interface defs and part defs
    const src = `
part def Signal;

part def Foo {
  port out p : Signal;
}
`;
    expect(hasCode(src, 'UNKNOWN_INTERFACE')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });
});

// ── 3. part def / part usage ─────────────────────────────────────────────────

describe('part def — part usage type resolution', () => {
  it('UNKNOWN_PART — alias references undeclared part def inside partDef', () => {
    const src = `
interface def A;

part def Container {
  part child : UnknownPart;
}
`;
    expect(hasCode(src, 'UNKNOWN_PART')).toBe(true);
  });

  it('no UNKNOWN_PART when type is properly declared', () => {
    const src = `
part def Engine;

part def Vehicle {
  part engine : Engine;
}
`;
    expect(hasCode(src, 'UNKNOWN_PART')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });
});

// ── 4. port ──────────────────────────────────────────────────────────────────

describe('port', () => {
  it('WRONG_CONTEXT — port declared at the top level', () => {
    const src = `port out p : SomeType;`;
    expect(hasCode(src, 'WRONG_CONTEXT')).toBe(true);
  });

  it('UNKNOWN_INTERFACE — port type not declared', () => {
    const src = `
interface def Good;

part def Foo {
  port out p : Bad;
}
`;
    expect(errorCodes(src)).toContain('UNKNOWN_INTERFACE');
  });
});

// ── 5. connect — port existence ───────────────────────────────────────────────
// NOTE: The parser is line-oriented — `{` and `}` must be on their own lines.
// Inline `part def A { port out p : T; }` is NOT supported.

describe('connect — port existence', () => {
  it('UNKNOWN_PORT — source port does not exist on the source part type', () => {
    const src = `
interface def Sig;

part def A {
  port out p : Sig;
}
part def B {
  port in q : Sig;
}

part def System {
  part a : A;
  part b : B;
  connect a.noSuchPort to b.q;
}
`;
    expect(hasCode(src, 'UNKNOWN_PORT')).toBe(true);
  });

  it('UNKNOWN_PORT — target port does not exist on the target part type', () => {
    const src = `
interface def Sig;

part def A {
  port out p : Sig;
}
part def B {
  port in q : Sig;
}

part def System {
  part a : A;
  part b : B;
  connect a.p to b.noSuchPort;
}
`;
    expect(hasCode(src, 'UNKNOWN_PORT')).toBe(true);
  });

  it('UNKNOWN_PART — source part instance not declared', () => {
    const src = `
interface def Sig;

part def A {
  port out p : Sig;
}
part def B {
  port in q : Sig;
}

part def System {
  part b : B;
  connect ghost.p to b.q;
}
`;
    expect(errorCodes(src)).toContain('UNKNOWN_PART');
  });
});

// ── 6. connect — port type compatibility ─────────────────────────────────────

describe('connect — port type compatibility', () => {
  it('INCOMPATIBLE_PORT_TYPES — ports carry different interface types', () => {
    const src = `
interface def SigA;
interface def SigB;

part def A {
  port out p : SigA;
}
part def B {
  port in q : SigB;
}

part def System {
  part a : A;
  part b : B;
  connect a.p to b.q;
}
`;
    expect(hasCode(src, 'INCOMPATIBLE_PORT_TYPES')).toBe(true);
  });

  it('no INCOMPATIBLE_PORT_TYPES when both ports carry the same type', () => {
    const src = `
interface def Sig;

part def A {
  port out p : Sig;
}
part def B {
  port in q : Sig;
}

part def System {
  part a : A;
  part b : B;
  connect a.p to b.q;
}
`;
    expect(hasCode(src, 'INCOMPATIBLE_PORT_TYPES')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });
});

// ── 7. connect — port direction compatibility ─────────────────────────────────

describe('connect — port direction compatibility', () => {
  it('INCOMPATIBLE_PORT_DIRECTIONS (error) — out→out', () => {
    const src = `
interface def Sig;

part def A {
  port out p : Sig;
}
part def B {
  port out q : Sig;
}

part def System {
  part a : A;
  part b : B;
  connect a.p to b.q;
}
`;
    expect(errorCodes(src)).toContain('INCOMPATIBLE_PORT_DIRECTIONS');
  });

  it('INCOMPATIBLE_PORT_DIRECTIONS (error) — in→in', () => {
    const src = `
interface def Sig;

part def A {
  port in p : Sig;
}
part def B {
  port in q : Sig;
}

part def System {
  part a : A;
  part b : B;
  connect a.p to b.q;
}
`;
    expect(errorCodes(src)).toContain('INCOMPATIBLE_PORT_DIRECTIONS');
  });

  it('INCOMPATIBLE_PORT_DIRECTIONS (warning) — in→out (reverse direction)', () => {
    const src = `
interface def Sig;

part def A {
  port in p : Sig;
}
part def B {
  port out q : Sig;
}

part def System {
  part a : A;
  part b : B;
  connect a.p to b.q;
}
`;
    expect(warnCodes(src)).toContain('INCOMPATIBLE_PORT_DIRECTIONS');
    expect(errorCodes(src)).not.toContain('INCOMPATIBLE_PORT_DIRECTIONS');
  });

  it('no direction error — out→in (standard flow)', () => {
    const src = `
interface def Sig;

part def A {
  port out p : Sig;
}
part def B {
  port in q : Sig;
}

part def System {
  part a : A;
  part b : B;
  connect a.p to b.q;
}
`;
    expect(hasCode(src, 'INCOMPATIBLE_PORT_DIRECTIONS')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });
});

// ── 8. occurrence def — participant type ─────────────────────────────────────

describe('occurrence def — participant type resolution', () => {
  it('UNKNOWN_PART — participant type is not a declared part def', () => {
    const src = `
occurrence def Test {
  part driver : UnknownType;
}
`;
    expect(hasCode(src, 'UNKNOWN_PART')).toBe(true);
  });

  it('UNKNOWN_PART — undeclared type even when no part defs exist', () => {
    // The occurrence participant check is unconditional (no partDefMap.size guard)
    const src = `
occurrence def Test {
  part x : Ghost;
  part y : Phantom;
}
`;
    const c = codes(src);
    expect(c.filter(code => code === 'UNKNOWN_PART')).toHaveLength(2);
  });

  it('no UNKNOWN_PART when participant type is declared', () => {
    const src = `
part def Driver;

occurrence def Test {
  part driver : Driver;
}
`;
    expect(hasCode(src, 'UNKNOWN_PART')).toBe(false);
  });
});

// ── 9. occurrence def — message endpoints ────────────────────────────────────

describe('occurrence def — message endpoint validation', () => {
  it('UNKNOWN_PARTICIPANT — endpoint uses part type name instead of alias', () => {
    const src = `
part def Driver;
part def BrakePedal;

occurrence def Test {
  part driver : Driver;
  part pedal  : BrakePedal;
  message msg from Driver to pedal;
}
`;
    const c = codes(src);
    expect(c).toContain('UNKNOWN_PARTICIPANT');
    // "Driver" is a type name — exactly one UNKNOWN_PARTICIPANT (for the from endpoint)
    expect(c.filter(code => code === 'UNKNOWN_PARTICIPANT')).toHaveLength(1);
  });

  it('UNKNOWN_PARTICIPANT — endpoint is a completely unknown name', () => {
    const src = `
part def Driver;
part def BrakePedal;

occurrence def Test {
  part driver : Driver;
  part pedal  : BrakePedal;
  message msg from driver to BrakePsssedal;
}
`;
    expect(hasCode(src, 'UNKNOWN_PARTICIPANT')).toBe(true);
  });

  it('UNKNOWN_PARTICIPANT × 2 — both endpoints invalid', () => {
    const src = `
part def Driver;
part def BrakePedal;

occurrence def Test {
  part driver : Driver;
  part pedal  : BrakePedal;
  message msg from Driver to BrakePsssedal;
}
`;
    const c = codes(src);
    expect(c.filter(code => code === 'UNKNOWN_PARTICIPANT')).toHaveLength(2);
  });

  it('no UNKNOWN_PARTICIPANT when endpoints use correct aliases', () => {
    const src = `
part def Driver;
part def BrakePedal;

occurrence def Test {
  part driver : Driver;
  part pedal  : BrakePedal;
  message msg from driver to pedal;
}
`;
    expect(hasCode(src, 'UNKNOWN_PARTICIPANT')).toBe(false);
  });
});

// ── 10. Duplicate names ───────────────────────────────────────────────────────

describe('duplicate names', () => {
  it('DUPLICATE_NAME — two interface defs with the same name', () => {
    const src = `
interface def Signal;
interface def Signal;
`;
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(true);
  });

  it('DUPLICATE_NAME — duplicate message name inside occurrence', () => {
    const src = `
part def A;
part def B;

occurrence def Test {
  part a : A;
  part b : B;
  message req from a to b;
  message req from b to a;
}
`;
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(true);
  });

  it('DUPLICATE_NAME — duplicate part def names', () => {
    const src = `
part def Engine;
part def Engine;
`;
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(true);
  });

  it('no DUPLICATE_NAME when names are different', () => {
    const src = `
interface def SignalA;
interface def SignalB;
part def Engine;
part def Transmission;
`;
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });

  it('no DUPLICATE_NAME across different namespaces', () => {
    const src = `
package A {
  interface def Signal;
}
package B {
  interface def Signal;
}
`;
    // AMBIGUOUS_REFERENCE fires (same short name in two namespaces), but not DUPLICATE_NAME
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(false);
  });
});

// ── 11. behavior def ─────────────────────────────────────────────────────────

describe('behavior def', () => {
  it('UNKNOWN_ACTION — flow references undeclared action instance', () => {
    const src = `
action def Act;

behavior def Behav {
  action a : Act;
  flow a -> missing;
}
`;
    expect(hasCode(src, 'UNKNOWN_ACTION')).toBe(true);
  });

  it('SELF_FLOW — flow connects an action to itself', () => {
    const src = `
action def Act;

behavior def Behav {
  action a : Act;
  flow a -> a;
}
`;
    expect(warnCodes(src)).toContain('SELF_FLOW');
    expect(errorCodes(src)).not.toContain('SELF_FLOW');
  });

  it('DUPLICATE_NAME — duplicate action instance name', () => {
    const src = `
action def Act;

behavior def Behav {
  action a : Act;
  action a : Act;
}
`;
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(true);
  });

  it('UNKNOWN_ACTION — action instance type not declared', () => {
    const src = `
behavior def Behav {
  action a : Ghost;
}
`;
    // actionDefNames is empty, so the guard prevents false positives
    // — no error when there are zero action defs
    expect(hasCode(src, 'UNKNOWN_ACTION')).toBe(false);
  });

  it('UNKNOWN_ACTION — action instance type declared but mismatched', () => {
    const src = `
action def RealAct;

behavior def Behav {
  action a : Ghost;
}
`;
    // actionDefNames has 'RealAct'; 'Ghost' is not in it → UNKNOWN_ACTION
    expect(hasCode(src, 'UNKNOWN_ACTION')).toBe(true);
  });
});

// ── 12. state def ────────────────────────────────────────────────────────────

describe('state def', () => {
  it('UNKNOWN_STATE — transition targets undeclared state', () => {
    const src = `
state def Machine {
  state A;
  state B;
  initial -> A;
  transition A -> C;
}
`;
    expect(hasCode(src, 'UNKNOWN_STATE')).toBe(true);
  });

  it('MISSING_INITIAL_STATE — state machine with states but no initial transition', () => {
    const src = `
state def Machine {
  state Idle;
  state Running;
  transition Idle -> Running on start;
}
`;
    expect(warnCodes(src)).toContain('MISSING_INITIAL_STATE');
  });

  it('no MISSING_INITIAL_STATE for empty state machine', () => {
    const src = `state def Empty;`;
    expect(hasCode(src, 'MISSING_INITIAL_STATE')).toBe(false);
  });

  it('DUPLICATE_NAME — duplicate state within the machine', () => {
    const src = `
state def Machine {
  state Idle;
  state Idle;
  initial -> Idle;
}
`;
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(true);
  });

  it('DUPLICATE_TRANSITION — same (from, event) pair declared twice', () => {
    const src = `
state def Machine {
  state A;
  state B;
  initial -> A;
  transition A -> B on trigger;
  transition A -> B on trigger;
}
`;
    expect(hasCode(src, 'DUPLICATE_TRANSITION')).toBe(true);
  });
});

// ── 13. requirement def ───────────────────────────────────────────────────────

describe('requirement def', () => {
  it('MISSING_REQUIREMENT_ID — requirement has no id field', () => {
    const src = `
requirement def R1 {
  text = "System shall brake"
}
`;
    expect(errorCodes(src)).toContain('MISSING_REQUIREMENT_ID');
  });

  it('MISSING_REQUIREMENT_TEXT — requirement has no text field', () => {
    const src = `
requirement def R1 {
  id = "REQ-001"
}
`;
    const d = run(src).find(x => x.code === 'MISSING_REQUIREMENT_TEXT');
    expect(d).toBeDefined();
    expect(d?.severity).toBe('info');
  });

  it('DUPLICATE_REQUIREMENT_ID — two requirements share the same id', () => {
    const src = `
requirement def R1 {
  id   = "REQ-001"
  text = "First"
}
requirement def R2 {
  id   = "REQ-001"
  text = "Second"
}
`;
    expect(hasCode(src, 'DUPLICATE_REQUIREMENT_ID')).toBe(true);
  });

  it('valid requirement — no errors', () => {
    const src = `
requirement def SafeBraking {
  id       = "REQ-001"
  text     = "The system shall decelerate within 3 s."
  priority = "High"
}
`;
    expect(errors(src)).toHaveLength(0);
  });
});

// ── 14. traceLinks ────────────────────────────────────────────────────────────

describe('satisfy / verify / trace', () => {
  it('BROKEN_TRACE_LINK — source element not found in model', () => {
    const src = `
requirement def R1 {
  id   = "REQ-001"
  text = "Some requirement"
}
satisfy NoSuchElement satisfies R1;
`;
    expect(hasCode(src, 'BROKEN_TRACE_LINK')).toBe(true);
  });

  it('BROKEN_TRACE_LINK — target is not a declared requirement', () => {
    const src = `
part def BrakePedal;
requirement def R1 {
  id   = "REQ-001"
  text = "Some requirement"
}
satisfy BrakePedal satisfies NotARequirement;
`;
    expect(hasCode(src, 'BROKEN_TRACE_LINK')).toBe(true);
  });

  it('no BROKEN_TRACE_LINK when source and target are both valid', () => {
    const src = `
part def BrakePedal;
requirement def R1 {
  id   = "REQ-001"
  text = "Some requirement"
}
satisfy BrakePedal satisfies R1;
`;
    expect(hasCode(src, 'BROKEN_TRACE_LINK')).toBe(false);
  });

  it('SUSPICIOUS_TRACE_LINK (warning) — satisfy from an interface def', () => {
    const src = `
interface def Signal;
requirement def R1 {
  id   = "REQ-001"
  text = "Some requirement"
}
satisfy Signal satisfies R1;
`;
    expect(warnCodes(src)).toContain('SUSPICIOUS_TRACE_LINK');
  });

  it('SUSPICIOUS_TRACE_LINK (warning) — verify from an interface def', () => {
    const src = `
interface def Signal;
requirement def R1 {
  id   = "REQ-001"
  text = "Some requirement"
}
verify Signal verifies R1;
`;
    expect(warnCodes(src)).toContain('SUSPICIOUS_TRACE_LINK');
  });

  it('no SUSPICIOUS_TRACE_LINK — satisfy from a part def', () => {
    const src = `
part def BrakePedal;
requirement def R1 {
  id   = "REQ-001"
  text = "Some requirement"
}
satisfy BrakePedal satisfies R1;
`;
    expect(hasCode(src, 'SUSPICIOUS_TRACE_LINK')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });

  it('no SUSPICIOUS_TRACE_LINK — verify from an occurrence def', () => {
    const src = `
occurrence def TestScenario;
requirement def R1 {
  id   = "REQ-001"
  text = "Some requirement"
}
verify TestScenario verifies R1;
`;
    expect(hasCode(src, 'SUSPICIOUS_TRACE_LINK')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });

  it('trace link is unrestricted by source kind', () => {
    const src = `
interface def Signal;
requirement def R1 {
  id   = "REQ-001"
  text = "Some requirement"
}
trace Signal traces R1;
`;
    expect(hasCode(src, 'SUSPICIOUS_TRACE_LINK')).toBe(false);
  });
});

// ── 15. Wrong context ─────────────────────────────────────────────────────────

describe('wrong context', () => {
  it('WRONG_CONTEXT — port at top level', () => {
    expect(hasCode('port out p : T;', 'WRONG_CONTEXT')).toBe(true);
  });

  it('WRONG_CONTEXT — connection at top level', () => {
    expect(hasCode('connect a.p to b.q;', 'WRONG_CONTEXT')).toBe(true);
  });

  it('WRONG_CONTEXT — message at top level', () => {
    expect(hasCode('message m from x to y;', 'WRONG_CONTEXT')).toBe(true);
  });

  it('WRONG_CONTEXT — flow at top level', () => {
    expect(hasCode('flow a -> b;', 'WRONG_CONTEXT')).toBe(true);
  });

  it('WRONG_CONTEXT — transition at top level', () => {
    expect(hasCode('transition A -> B;', 'WRONG_CONTEXT')).toBe(true);
  });

  it('WRONG_CONTEXT — stateEntry at top level', () => {
    expect(hasCode('state Idle;', 'WRONG_CONTEXT')).toBe(true);
  });

  it('WRONG_CONTEXT — actionInst at top level', () => {
    expect(hasCode('action a : SomeType;', 'WRONG_CONTEXT')).toBe(true);
  });
});

// ── 16. Diagnostic source line accuracy ───────────────────────────────────────

describe('diagnostic source line accuracy', () => {
  it('UNKNOWN_INTERFACE points at the port line, not the part def line', () => {
    const src = [
      'interface def Good;',   // line 1
      '',                       // line 2
      'part def Foo {',         // line 3
      '  port out p : Bad;',    // line 4 — diagnostic expected here
      '}',                      // line 5
    ].join('\n');

    const d = run(src).find(x => x.code === 'UNKNOWN_INTERFACE');
    expect(d).toBeDefined();
    expect(d?.line).toBe(4);
  });

  it('UNKNOWN_PART points at the partAlias line', () => {
    const src = [
      'part def Good;',          // line 1
      'part def Container {',    // line 2
      '  part c : Phantom;',     // line 3 — diagnostic expected here
      '}',                       // line 4
    ].join('\n');

    const d = run(src).find(x => x.code === 'UNKNOWN_PART');
    expect(d).toBeDefined();
    expect(d?.line).toBe(3);
  });

  it('UNKNOWN_PORT points at the connection line', () => {
    const src = [
      'interface def Sig;',       // line 1
      'part def A {',             // line 2
      '  port out p : Sig;',      // line 3
      '}',                        // line 4
      'part def B {',             // line 5
      '  port in q : Sig;',       // line 6
      '}',                        // line 7
      'part def System {',        // line 8
      '  part a : A;',            // line 9
      '  part b : B;',            // line 10
      '  connect a.noPort to b.q;', // line 11 — diagnostic expected here
      '}',                        // line 12
    ].join('\n');

    const d = run(src).find(x => x.code === 'UNKNOWN_PORT');
    expect(d).toBeDefined();
    expect(d?.line).toBe(11);
  });

  it('UNKNOWN_PARTICIPANT carries column pointing at the bad identifier', () => {
    const src = [
      'part def Driver;',                               // line 1
      'part def Pedal;',                                // line 2
      'occurrence def Test {',                          // line 3
      '  part driver : Driver;',                        // line 4
      '  part pedal  : Pedal;',                         // line 5
      '  message msg from Driver to pedal;',            // line 6 — bad from at col 20
      '}',                                              // line 7
    ].join('\n');

    const d = run(src).find(x => x.code === 'UNKNOWN_PARTICIPANT');
    expect(d).toBeDefined();
    expect(d?.line).toBe(6);
    // Column should be non-zero and point into the message line
    expect(d?.column).toBeGreaterThan(1);
  });

  it('MISSING_REQUIREMENT_ID points at the requirement def line', () => {
    const src = [
      'requirement def R1 {',  // line 1 — diagnostic expected here
      '  text = "no id"',      // line 2
      '}',                      // line 3
    ].join('\n');

    const d = run(src).find(x => x.code === 'MISSING_REQUIREMENT_ID');
    expect(d).toBeDefined();
    expect(d?.line).toBe(1);
  });

  it('UNKNOWN_STATE points at the transition line', () => {
    const src = [
      'state def Machine {',      // line 1
      '  state Idle;',            // line 2
      '  initial -> Idle;',       // line 3
      '  transition Idle -> X;',  // line 4 — diagnostic expected here
      '}',                        // line 5
    ].join('\n');

    const d = run(src).find(x => x.code === 'UNKNOWN_STATE');
    expect(d).toBeDefined();
    expect(d?.line).toBe(4);
  });
});
