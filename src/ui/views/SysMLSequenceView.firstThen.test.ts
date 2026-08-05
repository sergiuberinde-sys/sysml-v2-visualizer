import { describe, it, expect } from 'vitest';
import { orderMessagesByFirstThen } from './SysMLSequenceView';

type Msg = Parameters<typeof orderMessagesByFirstThen>[0][number];

// Minimal ParsedMessage builder (only the fields the ordering reads).
const msg = (label: string, from: string, to: string, frag = false): Msg => {
  const ep = (s: string) => { const [participant, event = ''] = s.split('.'); return { participant, event }; };
  return {
    id: label, label, from: ep(from), to: ep(to),
    ...(frag ? { fragments: [{ blockId: 'b', kind: 'alt' as const, guard: 'g' }] } : {}),
  } as Msg;
};

describe('orderMessagesByFirstThen', () => {
  it('returns messages unchanged when there are no successions', () => {
    const ms = [msg('b', 'x.e2', 'y.r'), msg('a', 'x.e1', 'z.r')];
    expect(orderMessagesByFirstThen(ms, []).map(m => m.label)).toEqual(['b', 'a']);
  });

  it('orders messages by the causal depth of their send event', () => {
    // e1 → e2 → e3 on one lifeline; three messages sent at e1, e3, e2.
    const ms = [msg('atE1', 'x.e1', 'y.r'), msg('atE3', 'x.e3', 'y.r'), msg('atE2', 'x.e2', 'y.r')];
    const succ: Array<[string, string]> = [['x.e1', 'x.e2'], ['x.e2', 'x.e3']];
    expect(orderMessagesByFirstThen(ms, succ).map(m => m.label)).toEqual(['atE1', 'atE2', 'atE3']);
  });

  it('breaks ties by original order (stable) for events at the same depth', () => {
    // e1 → e2a and e1 → e2b: both sends at depth 1 → keep source order.
    const ms = [msg('first', 'x.e2a', 'y.r'), msg('second', 'x.e2b', 'y.r')];
    const succ: Array<[string, string]> = [['x.e1', 'x.e2a'], ['x.e1', 'x.e2b']];
    expect(orderMessagesByFirstThen(ms, succ).map(m => m.label)).toEqual(['first', 'second']);
  });

  it('leaves messages untouched when any message is inside a fragment', () => {
    const ms = [msg('late', 'x.e3', 'y.r', true), msg('early', 'x.e1', 'y.r', true)];
    const succ: Array<[string, string]> = [['x.e1', 'x.e3']];
    expect(orderMessagesByFirstThen(ms, succ).map(m => m.label)).toEqual(['late', 'early']);
  });

  it('leaves messages untouched when the event graph has a cycle', () => {
    const ms = [msg('m1', 'x.a', 'y.b'), msg('m2', 'y.b', 'x.a')];
    const succ: Array<[string, string]> = [['x.a', 'y.b'], ['y.b', 'x.a']];
    expect(orderMessagesByFirstThen(ms, succ).map(m => m.label)).toEqual(['m1', 'm2']);
  });
});
