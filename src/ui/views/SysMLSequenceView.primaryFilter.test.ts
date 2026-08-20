import { describe, it, expect } from 'vitest';
import { buildIndexes, parseSequenceDefs } from './SysMLSequenceView';
import type { ContainmentGraph } from '../../core/sysmlv2Official/ContainmentGraph';

// The Sequence view's selectable items must be (a) message sequences declared in the
// currently-open (primary) file, and nothing else. Two things are excluded:
//   • context/imported defs (`fromPrimary === false`) — kept in the graph only for
//     cross-file resolution;
//   • behaviour *action* definitions, which own `flow` item-flows that also parse to
//     FlowUsage but carry no lifeline endpoints (not messages).
type N = ContainmentGraph['nodes'][number];
type E = ContainmentGraph['edges'][number];

function fixture(): ContainmentGraph {
  const nodes: N[] = [];
  const edges: E[] = [];
  const add = (id: string, label: string, type: string, extra: Partial<N> = {}) => { nodes.push({ id, label, type, ...extra } as N); return id; };
  const contains = (p: string, c: string) => edges.push({ id: `${p}>${c}`, source: p, target: c, type: 'contains' });

  add('Pkg', 'Pkg', 'Package');

  // A def with one message that has resolved endpoints (alpha → beta).
  const messageSeq = (id: string, label: string, primary: boolean) => {
    const ctx: Partial<N> = primary ? {} : { fromPrimary: false };
    add(id, label, 'ActionDefinition', ctx); contains('Pkg', id);
    const fm = `${id}.fm`; add(fm, '', 'FeatureMembership', ctx); contains(id, fm);
    const msg = `${id}.msg`; add(msg, `${id}Msg`, 'FlowUsage', { startLine: 1, ...ctx }); contains(fm, msg);
    [['0', 'alpha'], ['1', 'beta']].forEach(([slot, part]) => {
      const pm = `${msg}.pm${slot}`, eou = `${msg}.eou${slot}`, rs = `${msg}.rs${slot}`;
      add(pm, '', 'ParameterMembership', ctx); contains(msg, pm);
      add(eou, '', 'EventOccurrenceUsage', ctx); contains(pm, eou);
      add(rs, part, 'ReferenceSubsetting', ctx); contains(eou, rs);
    });
  };

  // A behaviour action def with a `flow` item-flow: a FlowUsage with NO
  // ParameterMembership endpoints (from/to resolve to null) — not a message.
  const actionDef = (id: string, label: string) => {
    add(id, label, 'ActionDefinition'); contains('Pkg', id);
    const fm = `${id}.fm`; add(fm, '', 'FeatureMembership'); contains(id, fm);
    const flow = `${id}.flow`; add(flow, `${id}ItemFlow`, 'FlowUsage', { startLine: 1 }); contains(fm, flow);
  };

  messageSeq('primSeq', 'PrimarySequence', true);
  messageSeq('ctxSeq', 'ContextSequence', false);
  actionDef('behaviorAction', 'HvmTrapReactionAction');

  return { nodes, edges };
}

describe('parseSequenceDefs — selectable items', () => {
  const graph = fixture();
  const { nodeById, childrenOf } = buildIndexes(graph);
  const defs = parseSequenceDefs(graph, childrenOf, nodeById);
  const labels = defs.map(d => d.node.label);

  it('lists the open file’s message sequence', () => {
    expect(labels).toContain('PrimarySequence');
  });

  it('excludes context-file sequences (fromPrimary === false)', () => {
    expect(labels).not.toContain('ContextSequence');
  });

  it('excludes behaviour action definitions (item-flows, no lifeline messages)', () => {
    expect(labels).not.toContain('HvmTrapReactionAction');
  });

  it('lists exactly the one real sequence', () => {
    expect(labels).toEqual(['PrimarySequence']);
  });
});
