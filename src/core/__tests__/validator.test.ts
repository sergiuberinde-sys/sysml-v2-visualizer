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
    // Same short name in different namespaces is allowed — no error at definition sites
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(false);
    expect(hasCode(src, 'AMBIGUOUS_REFERENCE')).toBe(false);
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
    // Ghost is not in the symbol table — always an error regardless of how many action defs exist
    expect(hasCode(src, 'UNKNOWN_ACTION')).toBe(true);
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

// ── 17. UNSUPPORTED_SYNTAX detection ─────────────────────────────────────────

describe('UNSUPPORTED_SYNTAX detection', () => {
  it('import statement emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('import SomePackage::*;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('alias statement emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('alias Foo = Bar;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('attribute def emits UNSUPPORTED_SYNTAX with helpful message', () => {
    const diags = warnings('attribute def Mass;');
    expect(diags.some(d => d.code === 'UNSUPPORTED_SYNTAX' && d.message.includes('interface def'))).toBe(true);
  });

  it('attribute usage emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('attribute mass : Real;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('item def emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('item def Payload;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('calc def emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('calc def Compute;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('constraint def emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('constraint def MaxLoad;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('use case def emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('use case def BrakeScenario;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('allocation def emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('allocation def HwAlloc;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('metadata def emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('metadata def Tags;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('view def emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('view def Diagram;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('allocate emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('allocate Comp to HW;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('ref usage emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('ref part brake = BrakePedal;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('doc annotation emits UNSUPPORTED_SYNTAX with comment hint', () => {
    const diags = warnings('doc /* some docs */');
    expect(diags.some(d => d.code === 'UNSUPPORTED_SYNTAX' && d.message.includes('//'))).toBe(true);
  });

  it('comment block emits UNSUPPORTED_SYNTAX with comment hint', () => {
    const diags = warnings('comment /* block comment */');
    expect(diags.some(d => d.code === 'UNSUPPORTED_SYNTAX' && d.message.includes('//'))).toBe(true);
  });

  it('perform emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('perform action Brake;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('exhibit emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('exhibit state Machine;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('send emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('send Signal via Port;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('bind emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('bind a.x = b.y;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('succession emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('succession first then second;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('generalization (:>) emits UNSUPPORTED_SYNTAX warning', () => {
    expect(warnCodes('part def Child :> Parent;')).toContain('UNSUPPORTED_SYNTAX');
  });

  it('completely unrecognized line still emits UNSUPPORTED_SYNTAX (no code)', () => {
    const diags = warnings('gibberish xyz 123');
    expect(diags.some(d => d.code === 'UNSUPPORTED_SYNTAX')).toBe(true);
  });

  it('unrecognized requirement field emits UNSUPPORTED_SYNTAX', () => {
    const src = [
      'requirement def R {',
      '  id = "REQ-1"',
      '  text = "some text"',
      '  unknown = "field"',
      '}',
    ].join('\n');
    expect(warnCodes(src)).toContain('UNSUPPORTED_SYNTAX');
  });

  it('line comments produce no diagnostics', () => {
    expect(run('// this is a comment')).toHaveLength(0);
  });

  it('empty lines produce no diagnostics', () => {
    expect(run('   \n\n   \n')).toHaveLength(0);
  });

  it('valid interface def produces no UNSUPPORTED_SYNTAX', () => {
    expect(codes('interface def BrakeSignal;')).not.toContain('UNSUPPORTED_SYNTAX');
  });

  it('valid part def produces no UNSUPPORTED_SYNTAX', () => {
    const src = [
      'part def BrakePedal {',
      '}',
    ].join('\n');
    expect(codes(src)).not.toContain('UNSUPPORTED_SYNTAX');
  });

  it('valid satisfy link produces no UNSUPPORTED_SYNTAX', () => {
    const src = [
      'part def Brake;',
      'requirement def R1 {',
      '  id = "REQ-1"',
      '  text = "must brake"',
      '}',
      'satisfy Brake satisfies R1;',
    ].join('\n');
    expect(codes(src)).not.toContain('UNSUPPORTED_SYNTAX');
  });
});

// ── 18. Symbol table & resolver ───────────────────────────────────────────────

describe('symbol table and resolver', () => {
  // ── Namespace scoping ────────────────────────────────────────────────────

  it('same short name in different packages is allowed — no error at definition site', () => {
    const src = `
package A {
  part def Brake;
}
package B {
  part def Brake;
}
`;
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(false);
    expect(hasCode(src, 'AMBIGUOUS_REFERENCE')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });

  it('duplicate short name in same package is DUPLICATE_NAME error', () => {
    const src = `
package A {
  part def Brake;
  part def Brake;
}
`;
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(true);
  });

  it('duplicate short name at root level is DUPLICATE_NAME error', () => {
    const src = `
interface def Signal;
interface def Signal;
`;
    expect(hasCode(src, 'DUPLICATE_NAME')).toBe(true);
  });

  // ── Qualified name resolution ────────────────────────────────────────────

  it('qualified port type resolves correctly — no error', () => {
    const src = `
package Signals {
  interface def BrakeSignal;
}
part def BrakePedal {
  port out p : Signals::BrakeSignal;
}
`;
    expect(hasCode(src, 'UNKNOWN_INTERFACE')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });

  it('qualified part type in composition resolves correctly — no error', () => {
    const src = `
package Parts {
  part def Wheel;
}
part def Car {
  part w : Parts::Wheel;
}
`;
    expect(hasCode(src, 'UNKNOWN_PART')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });

  it('qualified name resolves within package — no error', () => {
    const src = `
package Braking {
  interface def Signal;
  part def Pedal {
    port out p : Braking::Signal;
  }
}
`;
    expect(errors(src)).toHaveLength(0);
  });

  it('unqualified name resolves via local namespace lookup', () => {
    const src = `
package Braking {
  interface def Signal;
  part def Pedal {
    port out p : Signal;
  }
}
`;
    expect(hasCode(src, 'UNKNOWN_INTERFACE')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });

  // ── Ambiguity at reference site ─────────────────────────────────────────

  it('unqualified reference to name in two packages emits AMBIGUOUS_REFERENCE', () => {
    const src = `
package A {
  interface def Signal;
}
package B {
  interface def Signal;
}
part def Pedal {
  port out p : Signal;
}
`;
    // Signal exists in both A and B; unqualified reference from root is ambiguous
    expect(hasCode(src, 'AMBIGUOUS_REFERENCE')).toBe(true);
    expect(hasCode(src, 'UNKNOWN_INTERFACE')).toBe(false);
  });

  it('AMBIGUOUS_REFERENCE — ambiguous part type in composition', () => {
    const src = `
package A {
  part def Wheel;
}
package B {
  part def Wheel;
}
part def Car {
  part w : Wheel;
}
`;
    expect(hasCode(src, 'AMBIGUOUS_REFERENCE')).toBe(true);
  });

  it('qualified reference resolves even when short name is ambiguous', () => {
    const src = `
package A {
  interface def Signal;
}
package B {
  interface def Signal;
}
part def Pedal {
  port out p : A::Signal;
}
`;
    expect(hasCode(src, 'AMBIGUOUS_REFERENCE')).toBe(false);
    expect(hasCode(src, 'UNKNOWN_INTERFACE')).toBe(false);
    expect(errors(src)).toHaveLength(0);
  });

  // ── UNRESOLVED / UNKNOWN_* for truly missing names ──────────────────────

  it('unresolved port type emits UNKNOWN_INTERFACE', () => {
    const src = `
part def Pedal {
  port out p : NoSuchInterface;
}
`;
    expect(hasCode(src, 'UNKNOWN_INTERFACE')).toBe(true);
    expect(hasCode(src, 'AMBIGUOUS_REFERENCE')).toBe(false);
  });

  it('unresolved part type in composition emits UNKNOWN_PART', () => {
    const src = `
part def Car {
  part w : NoSuchPart;
}
`;
    expect(hasCode(src, 'UNKNOWN_PART')).toBe(true);
  });

  it('unresolved action type emits UNKNOWN_ACTION', () => {
    const src = `
behavior def B {
  action a : NoSuchAction;
}
`;
    expect(hasCode(src, 'UNKNOWN_ACTION')).toBe(true);
  });

  it('unresolved trace link source emits BROKEN_TRACE_LINK', () => {
    const src = `
requirement def R {
  id   = "REQ-1"
  text = "must work"
}
satisfy NoSuchElement satisfies R;
`;
    expect(hasCode(src, 'BROKEN_TRACE_LINK')).toBe(true);
    expect(hasCode(src, 'AMBIGUOUS_REFERENCE')).toBe(false);
  });

  it('ambiguous trace link source emits AMBIGUOUS_REFERENCE not BROKEN_TRACE_LINK', () => {
    const src = `
package A {
  part def Brake;
}
package B {
  part def Brake;
}
requirement def R {
  id   = "REQ-1"
  text = "must work"
}
satisfy Brake satisfies R;
`;
    expect(hasCode(src, 'AMBIGUOUS_REFERENCE')).toBe(true);
    expect(hasCode(src, 'BROKEN_TRACE_LINK')).toBe(false);
  });
});
