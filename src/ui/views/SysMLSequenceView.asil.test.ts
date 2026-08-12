import { describe, it, expect } from 'vitest';
import { buildIndexes, parseSequenceDefs, type AsilDerivationCtx } from './SysMLSequenceView';
import type { ContainmentGraph } from '../../core/sysmlv2Official/ContainmentGraph';
import { indexDependenciesByClient, type DependencyMapping, type PortAsilIndex } from '../../core/sysmlv2Official/messageInterfaceAsil';

// A hand-built containment graph mirroring the EMF shape of one sequence action
// definition `Pkg::Seq` with two messages and two (traceability) dependencies:
//
//   Pkg (Package)
//     Seq (ActionDefinition)
//       alpha, beta                 (ref part lifelines)
//       commandFsp1  (FlowUsage @10)  from alpha to beta
//       commandFsp1SenderInterface   (Dependency @11)  ← must NOT become a message/lifeline
//       reportTrap   (FlowUsage @12)  from alpha to beta
type N = ContainmentGraph['nodes'][number];
type E = ContainmentGraph['edges'][number];

function fixture(): ContainmentGraph {
  const nodes: N[] = [];
  const edges: E[] = [];
  const add = (n: N) => { nodes.push(n); return n.id; };
  const contains = (p: string, c: string) => edges.push({ id: `${p}>${c}`, source: p, target: c, type: 'contains' });

  add({ id: 'Pkg', label: 'Pkg', type: 'Package' });
  add({ id: 'om', label: '', type: 'OwningMembership' });
  add({ id: 'Seq', label: 'Seq', type: 'ActionDefinition' });
  contains('Pkg', 'om'); contains('om', 'Seq');

  // A message: FlowUsage with two ParameterMembership→EventOccurrenceUsage→ReferenceSubsetting endpoints.
  const message = (id: string, label: string, line: number, from: string, to: string, asil?: string) => {
    const fm = `fm_${id}`;
    add({ id: fm, label: '', type: 'FeatureMembership' }); contains('Seq', fm);
    add({ id, label, type: 'FlowUsage', startLine: line, ...(asil ? { asil } : {}) }); contains(fm, id);
    [['0', from], ['1', to]].forEach(([slot, part]) => {
      const pm = `${id}_pm${slot}`, eou = `${id}_eou${slot}`, rs = `${id}_rs${slot}`;
      add({ id: pm, label: '', type: 'ParameterMembership' }); contains(id, pm);
      add({ id: eou, label: '', type: 'EventOccurrenceUsage' }); contains(pm, eou);
      add({ id: rs, label: part, type: 'ReferenceSubsetting' }); contains(eou, rs);
    });
  };
  const lifeline = (id: string, label: string, line: number) => {
    const fm = `fm_${id}`;
    add({ id: fm, label: '', type: 'FeatureMembership' }); contains('Seq', fm);
    add({ id, label, type: 'PartUsage', startLine: line }); contains(fm, id);
  };
  const dependency = (id: string, label: string, line: number) => {
    const fm = `fm_${id}`;
    add({ id: fm, label: '', type: 'FeatureMembership' }); contains('Seq', fm);
    add({ id, label, type: 'Dependency', startLine: line, children: [] } as N); contains(fm, id);
  };

  lifeline('alpha', 'alpha', 1);
  lifeline('beta', 'beta', 2);
  message('commandFsp1', 'commandFsp1', 10, 'alpha', 'beta', 'ASIL_A'); // note the direct node @ASIL_A
  dependency('commandFsp1SenderInterface', 'commandFsp1SenderInterface', 11);
  message('reportTrap', 'reportTrap', 12, 'alpha', 'beta');

  return { nodes, edges };
}

const portIndex: PortAsilIndex = {
  asil: new Map([
    ['SafetyExceptionHandlerSw::fspActivationCommand', 'ASIL_D'],
    ['Tc4zSmuHw::fspActivationCommand', 'ASIL_D'],
    ['HvmTrapHandlerSw::trap', 'ASIL_D'],
  ]),
  exists: new Set([
    'SafetyExceptionHandlerSw::fspActivationCommand', 'Tc4zSmuHw::fspActivationCommand',
    'HvmTrapHandlerSw::trap', 'HvmUntrustedApplicationAreaSw::trap',
  ]),
};

const deps: DependencyMapping[] = [
  { name: 'commandFsp1SenderInterface',  clientQualifiedName: 'Pkg::Seq::commandFsp1', supplierQualifiedName: 'SafetyExceptionHandlerSw::fspActivationCommand', ownerQualifiedName: 'Pkg::Seq' },
  { name: 'commandFsp1ReceiverInterface', clientQualifiedName: 'Pkg::Seq::commandFsp1', supplierQualifiedName: 'Tc4zSmuHw::fspActivationCommand', ownerQualifiedName: 'Pkg::Seq' },
  { name: 'reportTrapSenderInterface',   clientQualifiedName: 'Pkg::Seq::reportTrap',  supplierQualifiedName: 'HvmUntrustedApplicationAreaSw::trap', ownerQualifiedName: 'Pkg::Seq' },
  { name: 'reportTrapReceiverInterface', clientQualifiedName: 'Pkg::Seq::reportTrap',  supplierQualifiedName: 'HvmTrapHandlerSw::trap', ownerQualifiedName: 'Pkg::Seq' },
];

describe('parseSequenceDefs — message ASIL derivation', () => {
  const graph = fixture();
  const { nodeById, childrenOf, parentOf } = buildIndexes(graph);
  const asilCtx: AsilDerivationCtx = { parentOf, depsByClient: indexDependenciesByClient(deps), portIndex };
  const [seq] = parseSequenceDefs(graph, childrenOf, nodeById, asilCtx);

  it('the dependency elements do NOT become sequence messages', () => {
    expect(seq.messages.map(m => m.label)).toEqual(['commandFsp1', 'reportTrap']);
  });

  it('the dependency elements do NOT become lifelines', () => {
    expect(seq.participants.map(p => p.label)).toEqual(['alpha', 'beta']);
  });

  it('preserves message (source-line) order', () => {
    expect(seq.messages.map(m => m.line)).toEqual([10, 12]);
  });

  it('derives ASIL D for a both-D message', () => {
    const m = seq.messages.find(m => m.label === 'commandFsp1')!;
    expect(m.asil?.status).toBe('resolved');
    expect(m.asil?.level).toBe('ASIL_D');
  });

  it('derives a partial/unresolved state for reportTrap', () => {
    const m = seq.messages.find(m => m.label === 'reportTrap')!;
    expect(m.asil?.status).toBe('partial');
  });

  it('keeps a direct message @ASIL distinct from the derived interface ASIL (no silent override)', () => {
    // The commandFsp1 FLOW node carries a direct @ASIL_A; the DERIVED interface ASIL is D.
    // Derivation must come only from the two interface dependencies, leaving the node's
    // own metadata untouched and distinguishable.
    const node = graph.nodes.find(n => n.id === 'commandFsp1')!;
    expect(node.asil).toBe('ASIL_A');                       // direct metadata, unchanged
    expect(seq.messages.find(m => m.label === 'commandFsp1')!.asil?.level).toBe('ASIL_D'); // derived
  });
});
