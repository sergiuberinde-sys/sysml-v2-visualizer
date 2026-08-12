import { describe, it, expect } from 'vitest';
import {
  extractDependencyMappings,
  extractDependencyMappingsFromSources,
  buildPortAsilIndex,
  resolveInterfaceEndpoint,
  deriveMessageAsil,
  deriveSingleInterfaceAsil,
  indexDependenciesByClient,
  deriveMessageAsilFor,
  describeMessageAsil,
  type DependencyMapping,
  type InterfaceEndpoint,
  type PortAsilIndex,
} from '../messageInterfaceAsil';

// ── helpers ──────────────────────────────────────────────────────────────────

const ep = (qn: string, resolved: boolean, asil?: string): InterfaceEndpoint =>
  ({ qualifiedName: qn, resolved, ...(asil ? { asil } : {}) });

const sym = (line: number, column: number, role: 'decl' | 'ref', symbolKey: string) =>
  ({ line, column, role, symbolKey, tokenType: 'x' });

// A minimal raw model tree with the given Dependency names (children-less, as the
// real parser emits — a Dependency's client/supplier are cross-refs, not eContents).
const modelWithDeps = (...depNames: string[]) => [{
  type: 'Package', name: 'Pkg',
  children: [{ type: 'ActionDefinition', name: 'Seq',
    children: depNames.map(n => ({ type: 'Dependency', name: n, children: [] })) }],
}];

// ── 3. Derivation rule (pure) ─────────────────────────────────────────────────

describe('deriveMessageAsil — the endpoint rule', () => {
  it('D sender and D receiver → resolved D', () => {
    const d = deriveMessageAsil(ep('S::p', true, 'ASIL_D'), ep('R::p', true, 'ASIL_D'));
    expect(d.status).toBe('resolved');
    expect(d.level).toBe('ASIL_D');
  });

  it('unassigned sender and D receiver → partial (never guesses the D)', () => {
    const d = deriveMessageAsil(ep('S::p', true), ep('R::p', true, 'ASIL_D'));
    expect(d.status).toBe('partial');
    expect(d.level).toBeUndefined();
  });

  it('D sender and C receiver → conflict, both retained, no auto-max', () => {
    const d = deriveMessageAsil(ep('S::p', true, 'ASIL_D'), ep('R::p', true, 'ASIL_C'));
    expect(d.status).toBe('conflict');
    expect(d.level).toBeUndefined();
    expect(d.sender?.asil).toBe('ASIL_D');
    expect(d.receiver?.asil).toBe('ASIL_C');
  });

  it('neither endpoint assigned → unassigned', () => {
    const d = deriveMessageAsil(ep('S::p', true), ep('R::p', true));
    expect(d.status).toBe('unassigned');
  });

  it('missing sender dependency → unresolved', () => {
    const d = deriveMessageAsil(undefined, ep('R::p', true, 'ASIL_D'));
    expect(d.status).toBe('unresolved');
    expect(d.diagnostic).toMatch(/sender/i);
  });

  it('unresolved Type::port supplier → unresolved', () => {
    const d = deriveMessageAsil(ep('S::p', true, 'ASIL_D'), ep('R::missing', false));
    expect(d.status).toBe('unresolved');
  });
});

// ── 1. Dependency extraction (from resolved occurrence table, not regex) ───────

describe('extractDependencyMappings', () => {
  // Two dependencies for one message, laid out as the parser emits them:
  //   decl <dep>  ref <client>  ref <supplier>
  const symbols = [
    sym(2, 8, 'decl', 'Pkg::Seq::commandFsp1SenderInterface'),
    sym(2, 20, 'ref', 'Pkg::Seq::commandFsp1'),
    sym(2, 40, 'ref', 'SafetyExceptionHandlerSw::fspActivationCommand'),
    sym(3, 8, 'decl', 'Pkg::Seq::commandFsp1ReceiverInterface'),
    sym(3, 20, 'ref', 'Pkg::Seq::commandFsp1'),
    sym(3, 40, 'ref', 'Tc4zSmuHw::fspActivationCommand'),
  ];

  it('recovers client / supplier / owner for each dependency', () => {
    const deps = extractDependencyMappings(
      modelWithDeps('commandFsp1SenderInterface', 'commandFsp1ReceiverInterface'), symbols);
    expect(deps).toHaveLength(2);
    expect(deps[0]).toEqual({
      name: 'commandFsp1SenderInterface',
      ownerQualifiedName: 'Pkg::Seq',
      clientQualifiedName: 'Pkg::Seq::commandFsp1',
      supplierQualifiedName: 'SafetyExceptionHandlerSw::fspActivationCommand',
    });
    expect(deps[1].supplierQualifiedName).toBe('Tc4zSmuHw::fspActivationCommand');
  });

  it('keeps duplicate message names in different action definitions distinctly scoped', () => {
    const dup = [
      ...symbols,
      sym(9, 8, 'decl', 'Pkg::OtherSeq::commandFsp1SenderInterface'),
      sym(9, 20, 'ref', 'Pkg::OtherSeq::commandFsp1'),
      sym(9, 40, 'ref', 'OtherSender::fspActivationCommand'),
    ];
    const deps = extractDependencyMappings(
      modelWithDeps('commandFsp1SenderInterface', 'commandFsp1ReceiverInterface'), dup);
    const clients = new Set(deps.map(d => d.clientQualifiedName));
    // Same local message name, two distinct fully-qualified clients → not conflated.
    expect(clients.has('Pkg::Seq::commandFsp1')).toBe(true);
    expect(clients.has('Pkg::OtherSeq::commandFsp1')).toBe(true);
    expect(deps.find(d => d.clientQualifiedName === 'Pkg::OtherSeq::commandFsp1')?.supplierQualifiedName)
      .toBe('OtherSender::fspActivationCommand');
  });

  it('emits a mapping (data), never a message/flow node', () => {
    const deps = extractDependencyMappings(modelWithDeps('commandFsp1SenderInterface'), symbols);
    // Result is DependencyMapping records only — nothing that a sequence renderer
    // would treat as a FlowUsage message or a lifeline.
    expect(deps.every(d => typeof d.name === 'string' && 'supplierQualifiedName' in d)).toBe(true);
  });

  it('returns nothing without a resolved occurrence table (no regex fallback)', () => {
    expect(extractDependencyMappings(modelWithDeps('x'), undefined)).toEqual([]);
    expect(extractDependencyMappings(modelWithDeps('x'), [])).toEqual([]);
  });
});

// ── 1b. All-files extraction (AST-position-driven textual fallback) ───────────

describe('extractDependencyMappingsFromSources', () => {
  // A model tree with source spans (as the parser emits) + the matching text.
  const text = [
    'package Pkg {',                                                        // 1
    '    action def Seq {',                                                 // 2
    '        message commandFsp1 of P from a.s to b.r;',                    // 3
    '        dependency commandFsp1SenderInterface',                        // 4
    '            from commandFsp1 to SafetyExceptionHandlerSw::fspActivationCommand;', // 5
    '        dependency commandFsp1ReceiverInterface',                      // 6
    '            from commandFsp1 to Tc4zSmuHw::fspActivationCommand;',     // 7
    '    }',                                                                // 8
    '}',                                                                    // 9
  ].join('\n');
  const model = [{
    type: 'Package', name: 'Pkg', startLine: 1, endLine: 9,
    children: [{ type: 'OwningMembership', name: null, children: [
      { type: 'ActionDefinition', name: 'Seq', startLine: 2, endLine: 8, children: [
        { type: 'FeatureMembership', name: null, children: [
          { type: 'Dependency', name: 'commandFsp1SenderInterface', startLine: 4, endLine: 5, children: [] },
        ]},
        { type: 'FeatureMembership', name: null, children: [
          { type: 'Dependency', name: 'commandFsp1ReceiverInterface', startLine: 6, endLine: 7, children: [] },
        ]},
      ]},
    ]}],
  }];

  it('reads client/supplier from the AST-reported source span and qualifies via the tree', () => {
    const deps = extractDependencyMappingsFromSources([{ text, model }]);
    expect(deps).toHaveLength(2);
    expect(deps[0]).toEqual({
      name: 'commandFsp1SenderInterface',
      ownerQualifiedName: 'Pkg::Seq',
      clientQualifiedName: 'Pkg::Seq::commandFsp1',
      supplierQualifiedName: 'SafetyExceptionHandlerSw::fspActivationCommand',
    });
    expect(deps[1].supplierQualifiedName).toBe('Tc4zSmuHw::fspActivationCommand');
  });

  it('covers multiple files (all-files, not just a primary)', () => {
    const text2 = 'package Q {\n  action def S2 {\n    dependency mReceiverInterface\n      from m to Def::port;\n  }\n}';
    const model2 = [{ type: 'Package', name: 'Q', startLine: 1, endLine: 6, children: [
      { type: 'OwningMembership', name: null, children: [
        { type: 'ActionDefinition', name: 'S2', startLine: 2, endLine: 5, children: [
          { type: 'Dependency', name: 'mReceiverInterface', startLine: 3, endLine: 4, children: [] },
        ]},
      ]},
    ]}];
    const deps = extractDependencyMappingsFromSources([{ text, model }, { text: text2, model: model2 }]);
    expect(deps.map(d => d.clientQualifiedName)).toContain('Q::S2::m');
    expect(deps.find(d => d.clientQualifiedName === 'Q::S2::m')?.supplierQualifiedName).toBe('Def::port');
  });

  it('ignores sources without a model or text', () => {
    expect(extractDependencyMappingsFromSources([{ text: '', model }])).toEqual([]);
    expect(extractDependencyMappingsFromSources([{ text, model: undefined }])).toEqual([]);
  });
});

// ── 2. Structural resolution ──────────────────────────────────────────────────

describe('buildPortAsilIndex / resolveInterfaceEndpoint', () => {
  const graph = {
    nodes: [
      { id: 'A', label: 'SafetyExceptionHandlerSw', type: 'PartDefinition' },
      { id: 'A.m', label: '', type: 'FeatureMembership' },
      { id: 'A.p', label: 'fspActivationCommand', type: 'PortUsage', asil: 'ASIL_D' },
      { id: 'B', label: 'HvmUntrustedApplicationAreaSw', type: 'PartDefinition' },
      { id: 'B.m', label: '', type: 'FeatureMembership' },
      { id: 'B.p', label: 'trap', type: 'PortUsage' }, // exists, but no @ASIL
    ],
    edges: [
      { source: 'A', target: 'A.m', type: 'contains' },
      { source: 'A.m', target: 'A.p', type: 'contains' },
      { source: 'B', target: 'B.m', type: 'contains' },
      { source: 'B.m', target: 'B.p', type: 'contains' },
    ],
  };
  const index = buildPortAsilIndex(graph);

  it('resolves a port with @ASIL', () => {
    const e = resolveInterfaceEndpoint('SafetyExceptionHandlerSw::fspActivationCommand', index);
    expect(e).toEqual({ qualifiedName: 'SafetyExceptionHandlerSw::fspActivationCommand', resolved: true, asil: 'ASIL_D' });
  });

  it('resolves a port with no @ASIL as resolved-but-unassigned (distinct from missing)', () => {
    const e = resolveInterfaceEndpoint('HvmUntrustedApplicationAreaSw::trap', index);
    expect(e.resolved).toBe(true);
    expect(e.asil).toBeUndefined();
  });

  it('marks an unknown Type::port as unresolved', () => {
    expect(resolveInterfaceEndpoint('Nope::gone', index).resolved).toBe(false);
  });
});

// ── Single concrete-interface variant (InterfaceUsage + StructuralInterface) ──

describe('single concrete-interface variant', () => {
  // `interface hvmUntrustedTrapReport { @ASIL D }` inside part def HvmSoftwarePartitionSw,
  // package Architecture → supplier is fully-qualified `Architecture::HvmSoftwarePartitionSw::hvmUntrustedTrapReport`.
  const graph = {
    nodes: [
      { id: 'pkg', label: 'Architecture', type: 'Package' },
      { id: 'pkg.m', label: '', type: 'OwningMembership' },
      { id: 'def', label: 'HvmSoftwarePartitionSw', type: 'PartDefinition' },
      { id: 'def.m', label: '', type: 'FeatureMembership' },
      { id: 'if', label: 'hvmUntrustedTrapReport', type: 'InterfaceUsage', asil: 'ASIL_D' },
      { id: 'if2.m', label: '', type: 'FeatureMembership' },
      { id: 'if2', label: 'plainInterface', type: 'InterfaceUsage' }, // no @ASIL
    ],
    edges: [
      { source: 'pkg', target: 'pkg.m', type: 'contains' },
      { source: 'pkg.m', target: 'def', type: 'contains' },
      { source: 'def', target: 'def.m', type: 'contains' },
      { source: 'def.m', target: 'if', type: 'contains' },
      { source: 'def', target: 'if2.m', type: 'contains' },
      { source: 'if2.m', target: 'if2', type: 'contains' },
    ],
  };
  const index = buildPortAsilIndex(graph);

  it('indexes an InterfaceUsage under both the fully-qualified and definition-local names', () => {
    expect(resolveInterfaceEndpoint('Architecture::HvmSoftwarePartitionSw::hvmUntrustedTrapReport', index).asil).toBe('ASIL_D');
    expect(resolveInterfaceEndpoint('HvmSoftwarePartitionSw::hvmUntrustedTrapReport', index).asil).toBe('ASIL_D');
  });

  it('deriveSingleInterfaceAsil: resolved / unassigned / unresolved', () => {
    expect(deriveSingleInterfaceAsil({ qualifiedName: 'x', resolved: true, asil: 'ASIL_D' }).status).toBe('resolved');
    expect(deriveSingleInterfaceAsil({ qualifiedName: 'x', resolved: true }).status).toBe('unassigned');
    expect(deriveSingleInterfaceAsil({ qualifiedName: 'x', resolved: false }).status).toBe('unresolved');
  });

  it('routes a `StructuralInterface` dependency to a single endpoint and derives its ASIL', () => {
    const deps: DependencyMapping[] = [{
      name: 'trapReportStructuralInterface',
      clientQualifiedName: 'HvmEpc3::Seq::trapReport',
      supplierQualifiedName: 'Architecture::HvmSoftwarePartitionSw::hvmUntrustedTrapReport',
      ownerQualifiedName: 'HvmEpc3::Seq',
    }];
    const idx = indexDependenciesByClient(deps);
    expect(idx.get('HvmEpc3::Seq::trapReport')?.single?.name).toBe('trapReportStructuralInterface');
    const d = deriveMessageAsilFor('HvmEpc3::Seq::trapReport', idx, index)!;
    expect(d.status).toBe('resolved');
    expect(d.level).toBe('ASIL_D');
    expect(d.endpoint?.qualifiedName).toBe('Architecture::HvmSoftwarePartitionSw::hvmUntrustedTrapReport');
    // Tooltip shows a single "Interface:" line, not Sender/Receiver.
    const text = describeMessageAsil(d, { message: 'trapReport' });
    expect(text).toMatch(/Interface:/);
    expect(text).not.toMatch(/Sender interface/);
  });

  it('an interface with no @ASIL → unassigned (no badge)', () => {
    const deps: DependencyMapping[] = [{
      name: 'xStructuralInterface', clientQualifiedName: 'P::S::x',
      supplierQualifiedName: 'Architecture::HvmSoftwarePartitionSw::plainInterface', ownerQualifiedName: 'P::S',
    }];
    expect(deriveMessageAsilFor('P::S::x', indexDependenciesByClient(deps), index)!.status).toBe('unassigned');
  });
});

// ── 4. End-to-end derivation via client index ─────────────────────────────────

describe('deriveMessageAsilFor — integration with real examples', () => {
  const portIndex: PortAsilIndex = {
    asil: new Map([
      ['SafetyExceptionHandlerSw::fspActivationCommand', 'ASIL_D'],
      ['Tc4zSmuHw::fspActivationCommand', 'ASIL_D'],
      ['HvmTrapHandlerSw::trap', 'ASIL_D'],
    ]),
    exists: new Set([
      'SafetyExceptionHandlerSw::fspActivationCommand',
      'Tc4zSmuHw::fspActivationCommand',
      'HvmTrapHandlerSw::trap',
      'HvmUntrustedApplicationAreaSw::trap', // exists, no ASIL
    ]),
  };

  const dep = (name: string, client: string, supplier: string): DependencyMapping =>
    ({ name, clientQualifiedName: client, supplierQualifiedName: supplier, ownerQualifiedName: client.split('::').slice(0, -1).join('::') });

  it('commandFsp1 (D sender, D receiver) → derived ASIL D', () => {
    const deps = [
      dep('commandFsp1SenderInterface', 'HvmEpc3::Seq::commandFsp1', 'SafetyExceptionHandlerSw::fspActivationCommand'),
      dep('commandFsp1ReceiverInterface', 'HvmEpc3::Seq::commandFsp1', 'Tc4zSmuHw::fspActivationCommand'),
    ];
    const d = deriveMessageAsilFor('HvmEpc3::Seq::commandFsp1', indexDependenciesByClient(deps), portIndex)!;
    expect(d.status).toBe('resolved');
    expect(d.level).toBe('ASIL_D');
  });

  it('reportTrap (unassigned sender, D receiver) → partial/unresolved', () => {
    const deps = [
      dep('reportTrapSenderInterface', 'HvmEpc3::Seq::reportTrap', 'HvmUntrustedApplicationAreaSw::trap'),
      dep('reportTrapReceiverInterface', 'HvmEpc3::Seq::reportTrap', 'HvmTrapHandlerSw::trap'),
    ];
    const d = deriveMessageAsilFor('HvmEpc3::Seq::reportTrap', indexDependenciesByClient(deps), portIndex)!;
    expect(d.status).toBe('partial');
    expect(d.receiver?.asil).toBe('ASIL_D');
    expect(d.sender?.asil).toBeUndefined();
    // Details panel text names both interfaces and does NOT print a single derived level.
    const text = describeMessageAsil(d, { message: 'reportTrap' });
    expect(text).toMatch(/HvmUntrustedApplicationAreaSw::trap/);
    expect(text).toMatch(/HvmTrapHandlerSw::trap/);
    expect(text).toMatch(/unresolved/);
  });

  it('missing sender dependency → unresolved', () => {
    const deps = [dep('xReceiverInterface', 'P::S::x', 'HvmTrapHandlerSw::trap')];
    const d = deriveMessageAsilFor('P::S::x', indexDependenciesByClient(deps), portIndex)!;
    expect(d.status).toBe('unresolved');
  });

  it('unresolved Type::port supplier → unresolved', () => {
    const deps = [
      dep('ySenderInterface', 'P::S::y', 'Ghost::port'),
      dep('yReceiverInterface', 'P::S::y', 'HvmTrapHandlerSw::trap'),
    ];
    const d = deriveMessageAsilFor('P::S::y', indexDependenciesByClient(deps), portIndex)!;
    expect(d.status).toBe('unresolved');
  });

  it('a message with no dependencies at all yields no badge (undefined)', () => {
    expect(deriveMessageAsilFor('P::S::none', indexDependenciesByClient([]), portIndex)).toBeUndefined();
  });

  it('the two same-named messages in different defs derive independently (scoping)', () => {
    const deps = [
      dep('reportTrapSenderInterface', 'A::S1::reportTrap', 'HvmTrapHandlerSw::trap'),      // D
      dep('reportTrapReceiverInterface', 'A::S1::reportTrap', 'Tc4zSmuHw::fspActivationCommand'), // D
      dep('reportTrapSenderInterface', 'A::S2::reportTrap', 'HvmUntrustedApplicationAreaSw::trap'), // unassigned
      dep('reportTrapReceiverInterface', 'A::S2::reportTrap', 'HvmTrapHandlerSw::trap'),    // D
    ];
    const idx = indexDependenciesByClient(deps);
    expect(deriveMessageAsilFor('A::S1::reportTrap', idx, portIndex)!.status).toBe('resolved');
    expect(deriveMessageAsilFor('A::S2::reportTrap', idx, portIndex)!.status).toBe('partial');
  });
});
