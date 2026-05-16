/**
 * Unit tests for computeImpactTrace().
 *
 * Tests use minimal hand-crafted ContainmentGraph + BehaviorData objects that
 * mirror the EMF output for the documented fixture models:
 *
 *   ComponentBehaviorExample  (07_structural_ownership.sysml)
 *   FlowExample               (hand-crafted connection model)
 *   GuardedTransitionExample  (02_guarded_transition.sysml)
 *
 * No full parser invocation — pure unit test over the utility function.
 */

import { describe, it, expect } from 'vitest';
import { computeImpactTrace } from '../sysmlv2Official/impactTrace';
import type { ContainmentGraph, GraphNode, GraphEdge } from '../sysmlv2Official/ContainmentGraph';
import type { BehaviorData } from '../sysmlv2Official/SysMLV2ParseResult';

// ── Graph builder helpers ─────────────────────────────────────────────────────

const gn = (id: string, label: string, type: string): GraphNode => ({ id, label, type });

const contains  = (src: string, tgt: string): GraphEdge =>
  ({ id: `${src}->${tgt}`, source: src, target: tgt, type: 'contains' });

const typedBy   = (src: string, tgt: string): GraphEdge =>
  ({ id: `${src}->typedBy->${tgt}`, source: src, target: tgt, type: 'typedBy' });

const connection = (src: string, tgt: string): GraphEdge =>
  ({ id: `connection:${src}:${tgt}`, source: src, target: tgt, type: 'connection' });

// ── ComponentBehaviorExample ──────────────────────────────────────────────────
//
// EMF tree (abbreviated):
//   Package "ComponentBehaviorExample"  [0]
//     OwningMembership                  [0.0]
//       PartDefinition "Controller"     [0.0.0]
//         OwningMembership              [0.0.0.0]
//           ActionDefinition "Startup"  [0.0.0.0.0]
//             FeatureMembership         [0.0.0.0.0.0]
//               ActionUsage "read"      [0.0.0.0.0.0.0]
//             FeatureMembership         [0.0.0.0.0.1]
//               ActionUsage "evaluate"  [0.0.0.0.0.1.0]
//             FeatureMembership         [0.0.0.0.0.2]
//               ActionUsage "activate"  [0.0.0.0.0.2.0]
//     OwningMembership                  [0.1]
//       PartUsage "system"              [0.1.0]
//         FeatureMembership             [0.1.0.0]
//           PartUsage "ctrl"            [0.1.0.0.0]
//             FeatureTyping "Controller"[0.1.0.0.0.0]

const compBehGraph: ContainmentGraph = {
  nodes: [
    gn('0',           'ComponentBehaviorExample', 'Package'),
    gn('0.0',         'OwningMembership',         'OwningMembership'),
    gn('0.0.0',       'Controller',               'PartDefinition'),
    gn('0.0.0.0',     'OwningMembership',         'OwningMembership'),
    gn('0.0.0.0.0',   'Startup',                  'ActionDefinition'),
    gn('0.0.0.0.0.0', 'FeatureMembership',        'FeatureMembership'),
    gn('0.0.0.0.0.0.0', 'read',                   'ActionUsage'),
    gn('0.0.0.0.0.1', 'FeatureMembership',        'FeatureMembership'),
    gn('0.0.0.0.0.1.0', 'evaluate',               'ActionUsage'),
    gn('0.0.0.0.0.2', 'FeatureMembership',        'FeatureMembership'),
    gn('0.0.0.0.0.2.0', 'activate',               'ActionUsage'),
    gn('0.1',         'OwningMembership',         'OwningMembership'),
    gn('0.1.0',       'system',                   'PartUsage'),
    gn('0.1.0.0',     'FeatureMembership',        'FeatureMembership'),
    gn('0.1.0.0.0',   'ctrl',                     'PartUsage'),
    gn('0.1.0.0.0.0', 'Controller',               'FeatureTyping'),
  ],
  edges: [
    contains('0', '0.0'),
    contains('0.0', '0.0.0'),
    contains('0.0.0', '0.0.0.0'),
    contains('0.0.0.0', '0.0.0.0.0'),
    contains('0.0.0.0.0', '0.0.0.0.0.0'),
    contains('0.0.0.0.0.0', '0.0.0.0.0.0.0'),
    contains('0.0.0.0.0', '0.0.0.0.0.1'),
    contains('0.0.0.0.0.1', '0.0.0.0.0.1.0'),
    contains('0.0.0.0.0', '0.0.0.0.0.2'),
    contains('0.0.0.0.0.2', '0.0.0.0.0.2.0'),
    contains('0', '0.1'),
    contains('0.1', '0.1.0'),
    contains('0.1.0', '0.1.0.0'),
    contains('0.1.0.0', '0.1.0.0.0'),
    contains('0.1.0.0.0', '0.1.0.0.0.0'),
    // typedBy: ctrl → Controller
    typedBy('0.1.0.0.0', '0.0.0'),
  ],
};

const compBehBehavior: BehaviorData = {
  actions: [
    { id: '0.0.0.0.0',       name: 'Startup',  type: 'ActionDefinition',
      owningDefName: 'Controller', owningDefType: 'PartDefinition' },
    { id: '0.0.0.0.0.0.0',   name: 'read',     type: 'ActionUsage',   ownerId: '0.0.0.0.0' },
    { id: '0.0.0.0.0.1.0',   name: 'evaluate', type: 'ActionUsage',   ownerId: '0.0.0.0.0' },
    { id: '0.0.0.0.0.2.0',   name: 'activate', type: 'ActionUsage',   ownerId: '0.0.0.0.0' },
  ],
  flows: [
    { id: 'f1', source: 'read',     target: 'evaluate', type: 'succession' },
    { id: 'f2', source: 'evaluate', target: 'activate', type: 'succession' },
  ],
  conditionals: [],
};

// ── Tests: Selecting "Controller" (PartDefinition) ────────────────────────────

describe('ComponentBehaviorExample — selecting Controller (PartDefinition)', () => {
  const trace = computeImpactTrace(
    compBehGraph,
    compBehBehavior,
    'Controller',
    'part',
  );

  it('relatedBehaviors includes Startup with qualified name Controller::Startup', () => {
    expect(trace.relatedBehaviors).toHaveLength(1);
    expect(trace.relatedBehaviors[0]).toMatchObject({
      name:          'Startup',
      qualifiedName: 'Controller::Startup',
    });
  });

  it('ownedElements includes ActionDefinition Startup', () => {
    const startup = trace.ownedElements.find(e => e.label === 'Startup');
    expect(startup).toBeDefined();
    expect(startup?.type).toBe('ActionDefinition');
  });

  it('usedAsTypeBy includes ctrl (PartUsage)', () => {
    const ctrl = trace.usedAsTypeBy.find(e => e.label === 'ctrl');
    expect(ctrl).toBeDefined();
    expect(ctrl?.type).toBe('PartUsage');
  });

  it('ownerChain reaches the package', () => {
    expect(trace.ownerChain.some(e => e.label === 'ComponentBehaviorExample')).toBe(true);
  });

  it('connectedElements is empty (no connection edges on Controller)', () => {
    expect(trace.connectedElements).toHaveLength(0);
  });

  it('relatedFlows includes read→evaluate and evaluate→activate', () => {
    expect(trace.relatedFlows).toHaveLength(2);
    const names = trace.relatedFlows.map(f => `${f.source}->${f.target}`);
    expect(names).toContain('read->evaluate');
    expect(names).toContain('evaluate->activate');
  });
});

// ── Tests: Selecting "Startup" (ActionDefinition) ─────────────────────────────

describe('ComponentBehaviorExample — selecting Startup (ActionDefinition)', () => {
  const trace = computeImpactTrace(
    compBehGraph,
    compBehBehavior,
    'Startup',
    'behavior',
  );

  it('relatedBehaviors includes Startup itself', () => {
    expect(trace.relatedBehaviors.some(b => b.name === 'Startup')).toBe(true);
  });

  it('relatedBehaviors qualifiedName is Controller::Startup', () => {
    expect(trace.relatedBehaviors[0]?.qualifiedName).toBe('Controller::Startup');
  });

  it('ownedElements includes read, evaluate, activate', () => {
    const labels = trace.ownedElements.map(e => e.label);
    expect(labels).toContain('read');
    expect(labels).toContain('evaluate');
    expect(labels).toContain('activate');
  });

  it('ownedActions includes read, evaluate, activate', () => {
    const labels = trace.ownedActions.map(e => e.label);
    expect(labels).toContain('read');
    expect(labels).toContain('evaluate');
    expect(labels).toContain('activate');
  });

  it('ownedActions items carry behavior context Controller::Startup', () => {
    for (const a of trace.ownedActions) {
      expect(a.extra?.behavior).toBe('Controller::Startup');
    }
  });

  it('relatedFlows includes read→evaluate', () => {
    const f = trace.relatedFlows.find(f => f.source === 'read' && f.target === 'evaluate');
    expect(f).toBeDefined();
    expect(f?.flowType).toBe('succession');
  });

  it('relatedFlows includes evaluate→activate', () => {
    const f = trace.relatedFlows.find(f => f.source === 'evaluate' && f.target === 'activate');
    expect(f).toBeDefined();
  });
});

// ── Tests: Selecting "action read" (ActionUsage) ──────────────────────────────

describe('ComponentBehaviorExample — selecting action read (actionInst)', () => {
  const trace = computeImpactTrace(
    compBehGraph,
    compBehBehavior,
    'read',
    'actionInst',
    { behavior: 'Controller::Startup' },
  );

  it('relatedFlows has outgoing flow read→evaluate', () => {
    const f = trace.relatedFlows.find(f => f.source === 'read');
    expect(f).toBeDefined();
    expect(f?.target).toBe('evaluate');
    expect(f?.flowType).toBe('succession');
  });

  it('relatedFlows does not include evaluate→activate (read not involved)', () => {
    const evalToAct = trace.relatedFlows.find(
      f => f.source === 'evaluate' && f.target === 'activate',
    );
    expect(evalToAct).toBeUndefined();
  });

  it('relatedBehaviors includes Controller::Startup', () => {
    expect(trace.relatedBehaviors.some(b => b.qualifiedName === 'Controller::Startup')).toBe(true);
  });

  it('outgoingFlows has read→evaluate with behaviorContext', () => {
    expect(trace.outgoingFlows).toHaveLength(1);
    expect(trace.outgoingFlows[0].source).toBe('read');
    expect(trace.outgoingFlows[0].target).toBe('evaluate');
    expect(trace.outgoingFlows[0].behaviorContext).toBe('Controller::Startup');
  });

  it('incomingFlows is empty (no flow targets read)', () => {
    expect(trace.incomingFlows).toHaveLength(0);
  });
});

// ── Tests: Selecting "action evaluate" shows both incoming and outgoing ────────

describe('ComponentBehaviorExample — selecting action evaluate (actionInst)', () => {
  const trace = computeImpactTrace(
    compBehGraph,
    compBehBehavior,
    'evaluate',
    'actionInst',
    { behavior: 'Controller::Startup' },
  );

  it('relatedFlows includes incoming read→evaluate', () => {
    const f = trace.relatedFlows.find(f => f.target === 'evaluate');
    expect(f?.source).toBe('read');
  });

  it('relatedFlows includes outgoing evaluate→activate', () => {
    const f = trace.relatedFlows.find(f => f.source === 'evaluate');
    expect(f?.target).toBe('activate');
  });

  it('incomingFlows has read→evaluate', () => {
    expect(trace.incomingFlows).toHaveLength(1);
    expect(trace.incomingFlows[0].source).toBe('read');
    expect(trace.incomingFlows[0].target).toBe('evaluate');
    expect(trace.incomingFlows[0].behaviorContext).toBe('Controller::Startup');
  });

  it('outgoingFlows has evaluate→activate', () => {
    expect(trace.outgoingFlows).toHaveLength(1);
    expect(trace.outgoingFlows[0].source).toBe('evaluate');
    expect(trace.outgoingFlows[0].target).toBe('activate');
  });
});

// ── FlowExample (connection trace) ────────────────────────────────────────────
//
// package FlowExample {
//   port def FuelPort;
//   part def Tank { port fuelOut : FuelPort; }
//   part def Engine { port fuelIn : FuelPort; }
//   part system {
//     part tank : Tank;
//     part eng  : Engine;
//     connect tank.fuelOut to eng.fuelIn;
//   }
// }
//
// Only the minimal graph fragment needed for the connection test is modelled here.
// Path assignments:
//   0      Package "FlowExample"
//   0.0    OwningMembership → PartDefinition "Tank"
//   0.0.0  PartDefinition "Tank"
//   0.0.0.0  FeatureMembership → PortUsage "fuelOut"
//   0.0.0.0.0  PortUsage "fuelOut"
//   0.1    OwningMembership → PartDefinition "Engine"
//   0.1.0  PartDefinition "Engine"
//   0.1.0.0  FeatureMembership → PortUsage "fuelIn"
//   0.1.0.0.0  PortUsage "fuelIn"

const flowGraph: ContainmentGraph = {
  nodes: [
    gn('0',           'FlowExample',      'Package'),
    gn('0.0',         'OwningMembership', 'OwningMembership'),
    gn('0.0.0',       'Tank',             'PartDefinition'),
    gn('0.0.0.0',     'FeatureMembership','FeatureMembership'),
    gn('0.0.0.0.0',   'fuelOut',          'PortUsage'),
    gn('0.1',         'OwningMembership', 'OwningMembership'),
    gn('0.1.0',       'Engine',           'PartDefinition'),
    gn('0.1.0.0',     'FeatureMembership','FeatureMembership'),
    gn('0.1.0.0.0',   'fuelIn',           'PortUsage'),
  ],
  edges: [
    contains('0', '0.0'),
    contains('0.0', '0.0.0'),
    contains('0.0.0', '0.0.0.0'),
    contains('0.0.0.0', '0.0.0.0.0'),
    contains('0', '0.1'),
    contains('0.1', '0.1.0'),
    contains('0.1.0', '0.1.0.0'),
    contains('0.1.0.0', '0.1.0.0.0'),
    // ConnectionUsage resolved endpoint: fuelOut ↔ fuelIn
    connection('0.0.0.0.0', '0.1.0.0.0'),
  ],
};

const flowBehavior: BehaviorData = { actions: [], flows: [], conditionals: [] };

describe('FlowExample — selecting Tank (PartDefinition)', () => {
  const trace = computeImpactTrace(flowGraph, flowBehavior, 'Tank', 'part');

  it('ownedPorts includes fuelOut', () => {
    const fuelOut = trace.ownedPorts.find(e => e.label === 'fuelOut');
    expect(fuelOut).toBeDefined();
    expect(fuelOut?.type).toBe('PortUsage');
  });

  it('ownedActions is empty (no ActionUsages)', () => {
    expect(trace.ownedActions).toHaveLength(0);
  });
});

describe('FlowExample — selecting port fuelOut', () => {
  const trace = computeImpactTrace(flowGraph, flowBehavior, 'fuelOut', 'port');

  it('connectedElements includes fuelIn', () => {
    const fuelIn = trace.connectedElements.find(e => e.label === 'fuelIn');
    expect(fuelIn).toBeDefined();
    expect(fuelIn?.type).toBe('PortUsage');
  });

  it('ownerChain reaches Tank', () => {
    expect(trace.ownerChain.some(e => e.label === 'Tank')).toBe(true);
  });
});

describe('FlowExample — selecting port fuelIn', () => {
  const trace = computeImpactTrace(flowGraph, flowBehavior, 'fuelIn', 'port');

  it('connectedElements includes fuelOut (reverse direction)', () => {
    const fuelOut = trace.connectedElements.find(e => e.label === 'fuelOut');
    expect(fuelOut).toBeDefined();
  });
});

// ── GuardedTransitionExample ──────────────────────────────────────────────────
//
// action def Main { action a; action b; first a if ready then b; }
//
// BehaviorData (no structural ownership):
//   ActionDefinition "Main" id="0.0"
//   ActionUsage "a"  id="0.0.0.0" ownerId="0.0"
//   ActionUsage "b"  id="0.0.0.1" ownerId="0.0"
//   TransitionFlow: a → b guard=ready

const guardedGraph: ContainmentGraph = {
  nodes: [
    gn('0',       'BehaviorGuardedTransitionTest', 'Package'),
    gn('0.0',     'OwningMembership',              'OwningMembership'),
    gn('0.0.0',   'Main',                          'ActionDefinition'),
    gn('0.0.0.0', 'FeatureMembership',             'FeatureMembership'),
    gn('0.0.0.0.0', 'a',                           'ActionUsage'),
    gn('0.0.0.1', 'FeatureMembership',             'FeatureMembership'),
    gn('0.0.0.1.0', 'b',                           'ActionUsage'),
  ],
  edges: [
    contains('0', '0.0'),
    contains('0.0', '0.0.0'),
    contains('0.0.0', '0.0.0.0'),
    contains('0.0.0.0', '0.0.0.0.0'),
    contains('0.0.0', '0.0.0.1'),
    contains('0.0.0.1', '0.0.0.1.0'),
  ],
};

const guardedBehavior: BehaviorData = {
  actions: [
    { id: '0.0.0',     name: 'Main', type: 'ActionDefinition' },
    { id: '0.0.0.0.0', name: 'a',    type: 'ActionUsage', ownerId: '0.0.0' },
    { id: '0.0.0.1.0', name: 'b',    type: 'ActionUsage', ownerId: '0.0.0' },
  ],
  flows: [
    { id: 'f1', source: 'a', target: 'b', type: 'transition', guard: 'ready' },
  ],
  conditionals: [],
};

describe('GuardedTransitionExample — selecting action a (actionInst)', () => {
  const trace = computeImpactTrace(
    guardedGraph,
    guardedBehavior,
    'a',
    'actionInst',
    { behavior: 'Main' },
  );

  it('relatedFlows includes guarded transition a→b', () => {
    const f = trace.relatedFlows.find(f => f.source === 'a' && f.target === 'b');
    expect(f).toBeDefined();
    expect(f?.flowType).toBe('transition');
    expect(f?.guard).toBe('ready');
  });

  it('relatedBehaviors includes Main', () => {
    expect(trace.relatedBehaviors.some(b => b.name === 'Main')).toBe(true);
  });
});

describe('GuardedTransitionExample — selecting Main (ActionDefinition)', () => {
  const trace = computeImpactTrace(guardedGraph, guardedBehavior, 'Main', 'behavior');

  it('ownedElements includes a and b', () => {
    const labels = trace.ownedElements.map(e => e.label);
    expect(labels).toContain('a');
    expect(labels).toContain('b');
  });

  it('ownedActions includes a and b with behavior context Main', () => {
    const labels = trace.ownedActions.map(e => e.label);
    expect(labels).toContain('a');
    expect(labels).toContain('b');
    for (const a of trace.ownedActions) {
      expect(a.extra?.behavior).toBe('Main');
    }
  });

  it('relatedFlows includes guarded transition with guard=ready', () => {
    const f = trace.relatedFlows.find(f => f.guard === 'ready');
    expect(f).toBeDefined();
    expect(f?.source).toBe('a');
    expect(f?.target).toBe('b');
  });
});

// ── ActionReuseExample ────────────────────────────────────────────────────────
//
// action def ReadSensor { }
// part def Controller {
//   action def Startup {
//     action read : ReadSensor;
//   }
// }
//
// typedBy edge: read ActionUsage → ReadSensor ActionDefinition

const reuseGraph: ContainmentGraph = {
  nodes: [
    gn('ar.0',       'ActionReuseExample', 'Package'),
    gn('ar.0.0',     'OwningMembership',   'OwningMembership'),
    gn('ar.0.0.0',   'ReadSensor',         'ActionDefinition'),
    gn('ar.0.1',     'OwningMembership',   'OwningMembership'),
    gn('ar.0.1.0',   'Controller',         'PartDefinition'),
    gn('ar.0.1.0.0', 'OwningMembership',   'OwningMembership'),
    gn('ar.0.1.0.0.0',     'Startup',      'ActionDefinition'),
    gn('ar.0.1.0.0.0.0',   'FeatureMembership', 'FeatureMembership'),
    gn('ar.0.1.0.0.0.0.0', 'read',         'ActionUsage'),
    gn('ar.0.1.0.0.0.0.0.0', 'FeatureTyping', 'FeatureTyping'),
  ],
  edges: [
    contains('ar.0',           'ar.0.0'),
    contains('ar.0.0',         'ar.0.0.0'),
    contains('ar.0',           'ar.0.1'),
    contains('ar.0.1',         'ar.0.1.0'),
    contains('ar.0.1.0',       'ar.0.1.0.0'),
    contains('ar.0.1.0.0',     'ar.0.1.0.0.0'),
    contains('ar.0.1.0.0.0',   'ar.0.1.0.0.0.0'),
    contains('ar.0.1.0.0.0.0', 'ar.0.1.0.0.0.0.0'),
    contains('ar.0.1.0.0.0.0.0', 'ar.0.1.0.0.0.0.0.0'),
    // typedBy: read → ReadSensor
    typedBy('ar.0.1.0.0.0.0.0', 'ar.0.0.0'),
  ],
};

const reuseBehavior: BehaviorData = {
  actions: [
    { id: 'ar.0.0.0',         name: 'ReadSensor', type: 'ActionDefinition' },
    { id: 'ar.0.1.0.0.0',     name: 'Startup',    type: 'ActionDefinition',
      owningDefName: 'Controller', owningDefType: 'PartDefinition' },
    { id: 'ar.0.1.0.0.0.0.0', name: 'read',       type: 'ActionUsage',
      ownerId: 'ar.0.1.0.0.0', actionType: 'ReadSensor' },
  ],
  flows: [],
  conditionals: [],
};

describe('ActionReuseExample — selecting read (actionInst)', () => {
  const trace = computeImpactTrace(
    reuseGraph, reuseBehavior, 'read', 'actionInst', { behavior: 'Controller::Startup' },
  );

  it('typedByDef is ReadSensor (ActionDefinition)', () => {
    expect(trace.typedByDef).toBeDefined();
    expect(trace.typedByDef?.label).toBe('ReadSensor');
    expect(trace.typedByDef?.type).toBe('ActionDefinition');
  });
});

describe('ActionReuseExample — selecting ReadSensor (behavior)', () => {
  const trace = computeImpactTrace(reuseGraph, reuseBehavior, 'ReadSensor', 'behavior');

  it('usedAsTypeBy includes read (ActionUsage)', () => {
    const read = trace.usedAsTypeBy.find(e => e.label === 'read');
    expect(read).toBeDefined();
    expect(read?.type).toBe('ActionUsage');
  });

  it('typedByDef is undefined for a behavior selection', () => {
    expect(trace.typedByDef).toBeUndefined();
  });
});

// ── RequirementExample ────────────────────────────────────────────────────────
//
// package ReqInPart {
//   requirement def BrakeResponse;
//   requirement def SteeringResponse;
//   part def BrakeController {
//     requirement brakeReq : BrakeResponse;
//   }
// }
//
// typedBy: brakeReq RequirementUsage → BrakeResponse RequirementDefinition

const reqGraph: ContainmentGraph = {
  nodes: [
    gn('rq.0',           'ReqInPart',          'Package'),
    gn('rq.0.0',         'OwningMembership',   'OwningMembership'),
    gn('rq.0.0.0',       'BrakeResponse',      'RequirementDefinition'),
    gn('rq.0.1',         'OwningMembership',   'OwningMembership'),
    gn('rq.0.1.0',       'SteeringResponse',   'RequirementDefinition'),
    gn('rq.0.2',         'OwningMembership',   'OwningMembership'),
    gn('rq.0.2.0',       'BrakeController',    'PartDefinition'),
    gn('rq.0.2.0.0',     'FeatureMembership',  'FeatureMembership'),
    gn('rq.0.2.0.0.0',   'brakeReq',           'RequirementUsage'),
    gn('rq.0.2.0.0.0.0', 'FeatureTyping',      'FeatureTyping'),
  ],
  edges: [
    contains('rq.0',         'rq.0.0'),
    contains('rq.0.0',       'rq.0.0.0'),
    contains('rq.0',         'rq.0.1'),
    contains('rq.0.1',       'rq.0.1.0'),
    contains('rq.0',         'rq.0.2'),
    contains('rq.0.2',       'rq.0.2.0'),
    contains('rq.0.2.0',     'rq.0.2.0.0'),
    contains('rq.0.2.0.0',   'rq.0.2.0.0.0'),
    contains('rq.0.2.0.0.0', 'rq.0.2.0.0.0.0'),
    // typedBy: brakeReq → BrakeResponse
    typedBy('rq.0.2.0.0.0', 'rq.0.0.0'),
  ],
};

const reqBehavior: BehaviorData = { actions: [], flows: [], conditionals: [] };

describe('RequirementExample — selecting BrakeController (part)', () => {
  const trace = computeImpactTrace(reqGraph, reqBehavior, 'BrakeController', 'part');

  it('ownedRequirements contains brakeReq', () => {
    expect(trace.ownedRequirements).toHaveLength(1);
    expect(trace.ownedRequirements[0].label).toBe('brakeReq');
    expect(trace.ownedRequirements[0].type).toBe('RequirementUsage');
  });

  it('ownedRequirements[0].extra.requirementDef is BrakeResponse', () => {
    expect(trace.ownedRequirements[0].extra?.requirementDef).toBe('BrakeResponse');
  });

  it('RequirementUsage is excluded from nonSpecificOwned (ownedElements filtered in Inspector)', () => {
    const reqUsages = trace.ownedElements.filter(e => e.type === 'RequirementUsage');
    expect(reqUsages).toHaveLength(1); // still in ownedElements
    // Inspector filters it out via nonSpecificOwned, but ownedElements is the source
  });
});

describe('RequirementExample — selecting BrakeResponse (requirement definition)', () => {
  const trace = computeImpactTrace(reqGraph, reqBehavior, 'BrakeResponse', 'requirement');

  it('usedAsTypeBy includes brakeReq', () => {
    const req = trace.usedAsTypeBy.find(e => e.label === 'brakeReq');
    expect(req).toBeDefined();
    expect(req?.type).toBe('RequirementUsage');
  });

  it('ownedRequirements is empty (not a part selection)', () => {
    expect(trace.ownedRequirements).toHaveLength(0);
  });
});

describe('RequirementExample — selecting SteeringResponse (unused requirement)', () => {
  const trace = computeImpactTrace(reqGraph, reqBehavior, 'SteeringResponse', 'requirement');

  it('usedAsTypeBy is empty (no usages typed by SteeringResponse)', () => {
    expect(trace.usedAsTypeBy).toHaveLength(0);
  });
});

// ── AttributeExample ──────────────────────────────────────────────────────────
//
// package ASILExample {
//   part def BrakeController {
//     attribute asil : ASIL = ASIL::B;
//     attribute version : Version;    // typed but no value
//   }
// }
//
// EMF tree:
//   Package "ASILExample"
//     OwningMembership
//       PartDefinition "BrakeController"
//         FeatureMembership
//           AttributeUsage "asil"
//             FeatureTyping "ASIL"
//             FeatureValue                  (label == type → wrapper)
//               Membership "B"              (label != type → value)
//         FeatureMembership
//           AttributeUsage "version"
//             FeatureTyping "Version"
//             (no FeatureValue)

const attrGraph: ContainmentGraph = {
  nodes: [
    gn('at.0',               'ASILExample',       'Package'),
    gn('at.0.0',             'OwningMembership',  'OwningMembership'),
    gn('at.0.0.0',           'BrakeController',   'PartDefinition'),
    gn('at.0.0.0.0',         'FeatureMembership', 'FeatureMembership'),
    gn('at.0.0.0.0.0',       'asil',              'AttributeUsage'),
    gn('at.0.0.0.0.0.0',     'ASIL',              'FeatureTyping'),
    gn('at.0.0.0.0.0.1',     'FeatureValue',      'FeatureValue'),
    gn('at.0.0.0.0.0.1.0',   'B',                 'Membership'),
    gn('at.0.0.0.1',         'FeatureMembership', 'FeatureMembership'),
    gn('at.0.0.0.1.0',       'version',           'AttributeUsage'),
    gn('at.0.0.0.1.0.0',     'Version',           'FeatureTyping'),
  ],
  edges: [
    contains('at.0',           'at.0.0'),
    contains('at.0.0',         'at.0.0.0'),
    contains('at.0.0.0',       'at.0.0.0.0'),
    contains('at.0.0.0.0',     'at.0.0.0.0.0'),
    contains('at.0.0.0.0.0',   'at.0.0.0.0.0.0'),
    contains('at.0.0.0.0.0',   'at.0.0.0.0.0.1'),
    contains('at.0.0.0.0.0.1', 'at.0.0.0.0.0.1.0'),
    contains('at.0.0.0',       'at.0.0.0.1'),
    contains('at.0.0.0.1',     'at.0.0.0.1.0'),
    contains('at.0.0.0.1.0',   'at.0.0.0.1.0.0'),
  ],
};

const attrBehavior: BehaviorData = { actions: [], flows: [], conditionals: [] };

describe('AttributeExample — selecting BrakeController (part)', () => {
  const trace = computeImpactTrace(attrGraph, attrBehavior, 'BrakeController', 'part');

  it('ownedAttributes has two entries', () => {
    expect(trace.ownedAttributes).toHaveLength(2);
  });

  it('ownedAttributes[0] has name=asil, typeName=ASIL, value=B', () => {
    const asil = trace.ownedAttributes.find(a => a.name === 'asil');
    expect(asil).toBeDefined();
    expect(asil?.typeName).toBe('ASIL');
    expect(asil?.value).toBe('B');
  });

  it('ownedAttributes[1] has name=version, typeName=Version, value undefined', () => {
    const ver = trace.ownedAttributes.find(a => a.name === 'version');
    expect(ver).toBeDefined();
    expect(ver?.typeName).toBe('Version');
    expect(ver?.value).toBeUndefined();
  });

  it('AttributeUsage nodes are still present in ownedElements', () => {
    const attrs = trace.ownedElements.filter(e => e.type === 'AttributeUsage');
    expect(attrs).toHaveLength(2);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('unknown selection name returns empty trace', () => {
  const trace = computeImpactTrace(compBehGraph, compBehBehavior, 'DoesNotExist', 'part');

  it('all arrays are empty and typedByDef is undefined', () => {
    expect(trace.ownedElements).toHaveLength(0);
    expect(trace.ownedPorts).toHaveLength(0);
    expect(trace.ownedActions).toHaveLength(0);
    expect(trace.ownedRequirements).toHaveLength(0);
    expect(trace.ownedAttributes).toHaveLength(0);
    expect(trace.ownerChain).toHaveLength(0);
    expect(trace.usedAsTypeBy).toHaveLength(0);
    expect(trace.connectedElements).toHaveLength(0);
    expect(trace.relatedBehaviors).toHaveLength(0);
    expect(trace.relatedFlows).toHaveLength(0);
    expect(trace.incomingFlows).toHaveLength(0);
    expect(trace.outgoingFlows).toHaveLength(0);
    expect(trace.typedByDef).toBeUndefined();
  });
});
