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
