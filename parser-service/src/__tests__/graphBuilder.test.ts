/**
 * Regression tests for buildGraph() connection-edge resolution.
 *
 * Each test constructs a minimal ModelNode[] tree that mirrors the EMF output
 * produced by the Java parser wrapper, then asserts on the emitted edges.
 */

import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graphBuilder';
import type { ModelNode } from '../types';

// ── Node builder helpers ───────────────────────────────────────────────────────

const n = (type: string, name: string | null, children: ModelNode[]): ModelNode =>
  ({ type, name, children });

const partDef      = (name: string, children: ModelNode[]) => n('PartDefinition', name, children);
const port         = (name: string) => n('PortUsage', name, []);
const efm          = (children: ModelNode[]) => n('EndFeatureMembership', null, children);
const refUsage     = (children: ModelNode[]) => n('ReferenceUsage', null, children);
const refSubsetting = (name: string) => n('ReferenceSubsetting', name, []);

// `flow from <a> to <b>` — a FlowConnectionUsage with two single-segment ends.
const flowConn = (a: string, b: string): ModelNode =>
  n('FlowConnectionUsage', null, [
    efm([refUsage([refSubsetting(a)])]),
    efm([refUsage([refSubsetting(b)])]),
  ]);

// ── Boundary-port name resolves within the flow's own PartDef ───────────────────
//
// Two PartDefs each declare a `pmicFault` port. A flow inside the SECOND def
// references the unqualified name `pmicFault`. It must resolve to that def's own
// port, not the same-named port in the first def (which is earlier in document
// order and would win a naive "first match" resolution).

describe('flow boundary-port resolution is scoped to the enclosing PartDef', () => {
  const roots = [
    // Root 0 "Outer": Outer.pmicFault = "0.0"
    partDef('Outer', [port('pmicFault')]),
    // Root 1 "Inner": Inner.pmicFault = "1.0", Inner.q = "1.1", flow = "1.2"
    partDef('Inner', [
      port('pmicFault'),
      port('q'),
      flowConn('pmicFault', 'q'),
    ]),
  ];

  const { edges } = buildGraph(roots);
  const conn = edges.filter(e => e.type === 'connection');

  it('emits exactly one connection edge for the flow', () => {
    expect(conn).toHaveLength(1);
  });

  it('resolves the unqualified port to the enclosing def, not the earlier same-named port', () => {
    expect(conn[0]).toMatchObject({ source: '1.0', target: '1.1' });
    // Guard against the pre-fix behaviour (first-in-document-order match).
    expect(conn[0].source).not.toBe('0.0');
  });
});

// ── A flow endpoint naming a PORT SUB-FEATURE anchors to the port ───────────────
//
// `flow from a.signal to b.signal` names the `signal` payload feature INSIDE ports
// a and b (a common delegation pattern). The last chain segment (`signal`) is not the
// port — and when some other element is genuinely named `signal`, the pre-fix resolver
// mis-anchored the wire to that unrelated port (or dropped it), so a boundary port
// showed unconnected. The wire must anchor to the enclosing PORT (a → b).

describe('flow endpoint that names a port sub-feature anchors to the enclosing port', () => {
  // FlowUsage end `<port>.<subfeature>`: ReferenceSubsetting(port) + FeatureMembership→ReferenceUsage(subfeature).
  const flowEnd = (portName: string, subName: string) =>
    efm([ n('FlowEnd', null, [
      refSubsetting(portName),
      n('FeatureMembership', null, [ n('ReferenceUsage', subName, []) ]),
    ]) ]);
  const flowUsage = (endA: [string, string], endB: [string, string]) =>
    n('FlowUsage', null, [ flowEnd(...endA), flowEnd(...endB) ]);

  const roots = [
    partDef('Ctrl', [
      port('a'),                        // 0.0
      port('b'),                        // 0.1
      port('signal'),                   // 0.2 — decoy port; makes `signal` a resolvable name
      flowUsage(['a', 'signal'], ['b', 'signal']), // flow from a.signal to b.signal
    ]),
  ];
  const { edges } = buildGraph(roots);
  const conn = edges.filter(e => e.type === 'connection');

  it('emits one edge anchored to the ports (a → b), not the sub-feature decoy', () => {
    expect(conn).toHaveLength(1);
    expect(conn[0]).toMatchObject({ source: '0.0', target: '0.1' });
    // Pre-fix: both ends resolved to the decoy `signal` port (0.2).
    expect(conn[0].source).not.toBe('0.2');
    expect(conn[0].target).not.toBe('0.2');
  });
});

// ── The sub-feature trim must NOT collapse a genuine `part.port` when the part
//    name also exists as a port name elsewhere (a real collision in the demo, e.g.
//    `configuration`, `timeBase`). Such a flow must still resolve to part.port. ─────

describe('sub-feature trim does not misfire on a part whose name is also a port', () => {
  const flowEnd = (partName: string, portName: string) =>
    efm([ n('FlowEnd', null, [
      refSubsetting(partName),
      n('FeatureMembership', null, [ n('ReferenceUsage', portName, []) ]),
    ]) ]);
  const flowUsage = (endA: [string, string], endB: [string, string]) =>
    n('FlowUsage', null, [ flowEnd(...endA), flowEnd(...endB) ]);

  // `timeBase` is used BOTH as a port (in Provider) and as a part (in Ctrl).
  const roots = [
    partDef('Provider', [ port('timeBase') ]),          // 0.0 — a PORT named timeBase
    partDef('Ctrl', [
      n('PartUsage', 'timeBase', [ port('clk') ]),      // 1.0 part timeBase; 1.0.0 its port clk
      port('sink'),                                      // 1.1
      flowUsage(['timeBase', 'clk'], ['sink', 'sink']),  // flow from timeBase.clk to sink
    ]),
  ];
  const { edges } = buildGraph(roots);
  const conn = edges.filter(e => e.type === 'connection');

  it('resolves timeBase.clk to the part port (not the collided timeBase port)', () => {
    expect(conn).toHaveLength(1);
    // Source must resolve to the `clk` port of the `timeBase` PART (1.0.0), qualified by the
    // part usage — NOT collapsed onto the `timeBase` PORT in Provider (0.0).
    expect(conn[0].source).toContain('1.0.0');
    expect(conn[0].source).not.toBe('0.0');
  });
});

// ── Abstract flag propagates from the parsed node to the graph node ─────────────

describe('isAbstract flows through to the graph node', () => {
  const roots: ModelNode[] = [
    { type: 'PartDefinition', name: 'AbstractBase', children: [], isAbstract: true },
    { type: 'PartDefinition', name: 'Concrete',     children: [] },
  ];
  const { nodes } = buildGraph(roots);

  it('marks only the abstract definition', () => {
    const base = nodes.find(n => n.label === 'AbstractBase');
    const conc = nodes.find(n => n.label === 'Concrete');
    expect(base?.isAbstract).toBe(true);
    expect(conc?.isAbstract).toBeUndefined();
  });
});
