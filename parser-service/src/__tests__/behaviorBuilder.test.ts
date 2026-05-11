/**
 * Regression tests for buildBehavior().
 *
 * Each test constructs a minimal ModelNode[] tree that mirrors the EMF output
 * produced by the Java parser wrapper for a validated SysML v2 example.
 * The structures are documented in docs/OFFICIAL_BEHAVIOR_FINDINGS.md.
 *
 * Fixture .sysml source files live in test/fixtures/behavior/ at the project root.
 */

import { describe, it, expect } from 'vitest';
import { buildBehavior } from '../behaviorBuilder';
import type { ModelNode } from '../types';

// ── Node builder helpers ───────────────────────────────────────────────────────

const n = (type: string, name: string | null, children: ModelNode[], direction?: string): ModelNode =>
  ({ type, name, children, ...(direction !== undefined ? { direction } : {}) });

const fm   = (child: ModelNode)    => n('FeatureMembership', null, [child]);
const om   = (child: ModelNode)    => n('OwningMembership', null, [child]);
const pm   = (child: ModelNode)    => n('ParameterMembership', null, [child]);
const efm  = (children: ModelNode[]) => n('EndFeatureMembership', null, children);
const membership    = (name: string)   => n('Membership', name, []);
const refSubsetting = (name: string)   => n('ReferenceSubsetting', name, []);
const refUsage      = (children: ModelNode[] = []) => n('ReferenceUsage', null, children);
const actionUsage   = (name: string | null, children: ModelNode[] = [], direction?: string) =>
  n('ActionUsage', name, children, direction);
const actionDef = (name: string, children: ModelNode[]) => n('ActionDefinition', name, children);

const successionNode = (source: string, target: string): ModelNode =>
  n('SuccessionAsUsage', null, [
    efm([refUsage([refSubsetting(source)])]),
    efm([refUsage([refSubsetting(target)])]),
  ]);

const fre = (memberName: string, direction?: string): ModelNode =>
  n('FeatureReferenceExpression', null, [membership(memberName)], direction);

// Anonymous ActionUsage[in] — transparent container used in conditionals.
const anonContainer = (children: ModelNode[]): ModelNode =>
  actionUsage(null, children, 'in');

// ── 1. Unguarded succession ────────────────────────────────────────────────────

describe('unguarded succession', () => {
  const root = actionDef('Main', [
    fm(actionUsage('a')),
    fm(actionUsage('b')),
    fm(successionNode('a', 'b')),
  ]);

  const { actions, flows, conditionals } = buildBehavior([root]);

  it('emits action definition', () => {
    expect(actions.find(a => a.type === 'ActionDefinition')?.name).toBe('Main');
  });

  it('emits both action instances', () => {
    const names = actions.filter(a => a.type === 'ActionUsage').map(a => a.name);
    expect(names).toContain('a');
    expect(names).toContain('b');
  });

  it('emits no anonymous action instances', () => {
    expect(actions.filter(a => a.type === 'ActionUsage').every(a => a.name !== null)).toBe(true);
  });

  it('emits a resolved succession flow a -> b', () => {
    const flow = flows.find(f => 'source' in f && f.source === 'a');
    expect(flow).toBeDefined();
    expect(flow).toMatchObject({ source: 'a', target: 'b', type: 'succession' });
  });

  it('emits no guard', () => {
    expect(flows.find(f => 'guard' in f)).toBeUndefined();
  });

  it('emits no conditionals', () => {
    expect(conditionals).toHaveLength(0);
  });
});

// ── 2. Guarded transition ──────────────────────────────────────────────────────
//
// EMF structure (§2 of OFFICIAL_BEHAVIOR_FINDINGS.md):
//   TransitionUsage
//     Membership 'a'
//     ParameterMembership → ReferenceUsage [in]
//     TransitionFeatureMembership → FeatureReferenceExpression → Membership 'ready'
//     OwningMembership → SuccessionAsUsage → ... → ReferenceSubsetting 'b'

describe('guarded transition (TransitionUsage)', () => {
  const transitionUsage: ModelNode = n('TransitionUsage', null, [
    membership('a'),
    pm(n('ReferenceUsage', null, [], 'in')),
    n('TransitionFeatureMembership', null, [fre('ready')]),
    om(n('SuccessionAsUsage', null, [
      efm([]),
      efm([refUsage([refSubsetting('b')])]),
    ])),
  ]);

  const root = actionDef('Main', [
    fm(actionUsage('a')),
    fm(actionUsage('b')),
    fm(transitionUsage),
  ]);

  const { actions, flows, conditionals } = buildBehavior([root]);

  it('emits both action instances', () => {
    const names = actions.filter(a => a.type === 'ActionUsage').map(a => a.name);
    expect(names).toContain('a');
    expect(names).toContain('b');
  });

  it('emits a resolved transition flow a -> b', () => {
    const flow = flows.find(f => 'source' in f && f.source === 'a');
    expect(flow).toBeDefined();
    expect(flow).toMatchObject({ source: 'a', target: 'b', type: 'transition' });
  });

  it('emits guard: ready', () => {
    const flow = flows.find(f => 'guard' in f);
    expect(flow).toBeDefined();
    expect((flow as { guard: string }).guard).toBe('ready');
  });

  it('emits no conditionals', () => {
    expect(conditionals).toHaveLength(0);
  });
});

// ── 3. IfActionUsage ──────────────────────────────────────────────────────────
//
// EMF structure (§4 of OFFICIAL_BEHAVIOR_FINDINGS.md):
//   IfActionUsage
//     ParameterMembership[0] → FeatureReferenceExpression[in] → Membership 'ready'
//     ParameterMembership[1] → ActionUsage[in] → FeatureMembership → ActionUsage 'ok'
//     ParameterMembership[2] → ActionUsage[in] → FeatureMembership → ActionUsage 'fault'

describe('IfActionUsage', () => {
  const ifNode: ModelNode = n('IfActionUsage', null, [
    pm(fre('ready', 'in')),
    pm(anonContainer([fm(actionUsage('ok'))])),
    pm(anonContainer([fm(actionUsage('fault'))])),
  ]);

  const root = actionDef('Main', [fm(ifNode)]);
  const { actions, flows, conditionals } = buildBehavior([root]);

  it('emits no anonymous action instances', () => {
    const usages = actions.filter(a => a.type === 'ActionUsage');
    expect(usages.every(a => a.name !== null)).toBe(true);
  });

  it('emits action ok in the then-branch', () => {
    const ok = actions.find(a => a.name === 'ok');
    expect(ok).toBeDefined();
    expect(ok?.branch).toBe('then');
  });

  it('emits action fault in the else-branch', () => {
    const fault = actions.find(a => a.name === 'fault');
    expect(fault).toBeDefined();
    expect(fault?.branch).toBe('else');
  });

  it('emits one ifThenElse conditional', () => {
    expect(conditionals).toHaveLength(1);
    expect(conditionals[0].type).toBe('ifThenElse');
  });

  it('extracts condition text: ready', () => {
    expect(conditionals[0].conditionText).toBe('ready');
    expect(conditionals[0].conditionKind).toBe('FeatureReference');
  });

  it('thenActionIds references ok', () => {
    const okId = actions.find(a => a.name === 'ok')!.id;
    expect(conditionals[0].thenActionIds).toContain(okId);
  });

  it('elseActionIds references fault', () => {
    const faultId = actions.find(a => a.name === 'fault')!.id;
    expect(conditionals[0].elseActionIds).toBeDefined();
    expect(conditionals[0].elseActionIds).toContain(faultId);
  });

  it('emits no flows', () => {
    expect(flows).toHaveLength(0);
  });
});

// ── 4. WhileLoopActionUsage — loop…until form ─────────────────────────────────
//
// EMF structure (§4, Form 2):
//   WhileLoopActionUsage
//     ParameterMembership[0] → ReferenceUsage[in]    (empty placeholder)
//     ParameterMembership[1] → ActionUsage[in] → FeatureMembership → ActionUsage 'step'
//     ParameterMembership[2] → FeatureReferenceExpression[in] → Membership 'done'

describe('WhileLoopActionUsage — loop…until form', () => {
  const loopNode: ModelNode = n('WhileLoopActionUsage', null, [
    pm(n('ReferenceUsage', null, [], 'in')),
    pm(anonContainer([fm(actionUsage('step'))])),
    pm(fre('done', 'in')),
  ]);

  const root = actionDef('Main', [fm(loopNode)]);
  const { actions, flows, conditionals } = buildBehavior([root]);

  it('emits no anonymous action instances', () => {
    const usages = actions.filter(a => a.type === 'ActionUsage');
    expect(usages.every(a => a.name !== null)).toBe(true);
  });

  it('emits action step in the loop-branch', () => {
    const step = actions.find(a => a.name === 'step');
    expect(step).toBeDefined();
    expect(step?.branch).toBe('loop');
  });

  it('emits one whileLoop conditional', () => {
    expect(conditionals).toHaveLength(1);
    expect(conditionals[0].type).toBe('whileLoop');
  });

  it('extracts condition text: done (from ParameterMembership[2])', () => {
    expect(conditionals[0].conditionText).toBe('done');
    expect(conditionals[0].conditionKind).toBe('FeatureReference');
  });

  it('thenActionIds (loop body) references step', () => {
    const stepId = actions.find(a => a.name === 'step')!.id;
    expect(conditionals[0].thenActionIds).toContain(stepId);
  });

  it('emits no flows', () => {
    expect(flows).toHaveLength(0);
  });
});

// ── 5. WhileLoopActionUsage — while form ──────────────────────────────────────
//
// EMF structure (§4, Form 1):
//   WhileLoopActionUsage
//     ParameterMembership[0] → FeatureReferenceExpression[in] → Membership 'ready'
//     ParameterMembership[1] → ActionUsage[in] → FeatureMembership → ActionUsage 'step'

describe('WhileLoopActionUsage — while form', () => {
  const loopNode: ModelNode = n('WhileLoopActionUsage', null, [
    pm(fre('ready', 'in')),
    pm(anonContainer([fm(actionUsage('step'))])),
  ]);

  const root = actionDef('Main', [fm(loopNode)]);
  const { actions, conditionals } = buildBehavior([root]);

  it('emits action step in the loop-branch', () => {
    expect(actions.find(a => a.name === 'step')?.branch).toBe('loop');
  });

  it('extracts condition text: ready (from ParameterMembership[0])', () => {
    expect(conditionals[0].conditionText).toBe('ready');
    expect(conditionals[0].conditionKind).toBe('FeatureReference');
  });

  it('does not fall back to ParameterMembership[2] when [0] has a condition', () => {
    expect(conditionals).toHaveLength(1);
    expect(conditionals[0].conditionText).not.toBeUndefined();
  });
});

// ── 6. Control-flow nodes ─────────────────────────────────────────────────────

describe('ForkNode and JoinNode', () => {
  const root = actionDef('Flow', [
    fm(actionUsage('a')),
    fm(n('ForkNode', null, [])),
    fm(actionUsage('b')),
    fm(actionUsage('c')),
    fm(n('JoinNode', null, [])),
    fm(actionUsage('d')),
  ]);

  const { actions } = buildBehavior([root]);

  it('emits ForkNode as a behavior action with name ForkNode', () => {
    const fork = actions.find(a => a.type === 'ForkNode');
    expect(fork).toBeDefined();
    expect(fork?.name).toBe('ForkNode');
  });

  it('emits JoinNode as a behavior action with name JoinNode', () => {
    const join = actions.find(a => a.type === 'JoinNode');
    expect(join).toBeDefined();
    expect(join?.name).toBe('JoinNode');
  });

  it('assigns ownerId from the enclosing ActionDefinition', () => {
    const defId = actions.find(a => a.type === 'ActionDefinition')?.id;
    expect(actions.find(a => a.type === 'ForkNode')?.ownerId).toBe(defId);
    expect(actions.find(a => a.type === 'JoinNode')?.ownerId).toBe(defId);
  });
});

describe('MergeNode', () => {
  const root = actionDef('Flow', [
    fm(actionUsage('a')),
    fm(n('MergeNode', null, [])),
    fm(actionUsage('b')),
  ]);

  const { actions } = buildBehavior([root]);

  it('emits MergeNode as a behavior action', () => {
    const merge = actions.find(a => a.type === 'MergeNode');
    expect(merge).toBeDefined();
    expect(merge?.name).toBe('MergeNode');
  });
});

describe('DecisionNode — unnamed (decide;)', () => {
  const root = actionDef('Flow', [
    fm(actionUsage('a')),
    fm(n('DecisionNode', null, [])),
  ]);

  const { actions } = buildBehavior([root]);

  it('emits DecisionNode with type name as display name', () => {
    const d = actions.find(a => a.type === 'DecisionNode');
    expect(d).toBeDefined();
    expect(d?.name).toBe('DecisionNode');
  });
});

describe('DecisionNode — named (decide d;)', () => {
  const root = actionDef('Flow', [
    fm(actionUsage('a')),
    fm(n('DecisionNode', 'd', [])),
  ]);

  const { actions } = buildBehavior([root]);

  it('emits DecisionNode with the declared name', () => {
    const d = actions.find(a => a.type === 'DecisionNode');
    expect(d?.name).toBe('d');
  });
});

// ── 7. DecisionNode outgoing succession — unresolved (Pilot NPE §6, §10) ──────
//
// When a SuccessionAsUsage is the outgoing edge of a DecisionNode, the Pilot
// Implementation NPE leaves both EndFeatureMembership nodes empty.
// extractEndpointNames() returns [] → flow marked unresolved: true.

describe('DecisionNode outgoing succession — unresolved', () => {
  const emptySuccession: ModelNode = n('SuccessionAsUsage', null, [
    efm([]),
    efm([]),
  ]);

  // Incoming succession (a -> d) resolves normally.
  const incomingSuccession = successionNode('a', 'd');

  const root = actionDef('Flow', [
    fm(actionUsage('a')),
    fm(n('DecisionNode', 'd', [])),
    fm(actionUsage('b')),
    fm(incomingSuccession),
    fm(emptySuccession),   // outgoing d -> ? — both endpoints empty
  ]);

  const { flows } = buildBehavior([root]);

  it('incoming succession a -> d is resolved', () => {
    const f = flows.find(f => 'source' in f && f.source === 'a');
    expect(f).toBeDefined();
    expect(f).toMatchObject({ source: 'a', target: 'd', type: 'succession' });
  });

  it('outgoing succession from DecisionNode is marked unresolved', () => {
    const unresolved = flows.filter(f => 'unresolved' in f && f.unresolved === true);
    expect(unresolved.length).toBeGreaterThanOrEqual(1);
  });

  it('does not crash', () => {
    expect(flows).toBeDefined();
  });
});

// ── 8. Structural ownership: ActionDefinition inside PartDefinition ────────────
//
// EMF structure (validated against Pilot 0.59.0-SNAPSHOT, §ComponentBehaviorExample):
//   PartDefinition "Controller"
//     OwningMembership
//       ActionDefinition "Startup"
//         FeatureMembership → ActionUsage "read"
//         FeatureMembership → ActionUsage "evaluate"
//         ...
//
// Expected: ActionDefinition entry carries owningDefName='Controller', owningDefType='PartDefinition'

describe('structural ownership — ActionDefinition inside PartDefinition', () => {
  const startupDef = actionDef('Startup', [
    fm(actionUsage('read')),
    fm(actionUsage('evaluate')),
    fm(actionUsage('activate')),
    fm(successionNode('read', 'evaluate')),
    fm(successionNode('evaluate', 'activate')),
  ]);

  const controllerDef: ModelNode = n('PartDefinition', 'Controller', [
    n('OwningMembership', null, [startupDef]),
  ]);

  const { actions, flows } = buildBehavior([controllerDef]);

  it('emits the ActionDefinition with owningDefName = Controller', () => {
    const def = actions.find(a => a.type === 'ActionDefinition' && a.name === 'Startup');
    expect(def).toBeDefined();
    expect(def?.owningDefName).toBe('Controller');
  });

  it('emits the ActionDefinition with owningDefType = PartDefinition', () => {
    const def = actions.find(a => a.type === 'ActionDefinition' && a.name === 'Startup');
    expect(def?.owningDefType).toBe('PartDefinition');
  });

  it('emits action instances with correct ownerId', () => {
    const def   = actions.find(a => a.type === 'ActionDefinition' && a.name === 'Startup')!;
    const names = actions.filter(a => a.ownerId === def.id).map(a => a.name);
    expect(names).toContain('read');
    expect(names).toContain('evaluate');
    expect(names).toContain('activate');
  });

  it('emits resolved succession flows', () => {
    const readToEval = flows.find(f => 'source' in f && f.source === 'read' && f.target === 'evaluate');
    const evalToAct  = flows.find(f => 'source' in f && f.source === 'evaluate' && f.target === 'activate');
    expect(readToEval).toBeDefined();
    expect(evalToAct).toBeDefined();
  });

  it('does not set owningDefName on top-level ActionDefinitions (no structural parent)', () => {
    const bare = buildBehavior([actionDef('Bare', [fm(actionUsage('a'))])]);
    const def  = bare.actions.find(a => a.type === 'ActionDefinition');
    expect(def?.owningDefName).toBeUndefined();
  });
});
