import { describe, it, expect } from 'vitest';
import { extractSequenceTiming } from '../sequenceTiming';

// Mirror of FarHwEpc2Sequence's timing block, with 1-based line numbers matching
// the model node startLine/endLine spans the AST reports.
const LINES: Record<number, string> = {
  1: 'package FarEpc2 {',
  2: '    action def FarHwEpc2Sequence {',
  10: '        attribute alarmAcceptedElapsed : DurationValue =',
  11: '            TimeOf(smu.alarmAccepted) - TimeOf(faultOccurred);',
  12: '        attribute transmissionSilentElapsed : DurationValue =',
  13: '            TimeOf(communicationSilent) - TimeOf(faultOccurred);',
  14: '        attribute resoutReceivedElapsed : DurationValue =',
  15: '            TimeOf(reset.resoutReceived) - TimeOf(faultOccurred);',
  16: '        attribute drivingFttiLimit : DurationValue = 0.010 [s];',
  18: '        assert constraint timingContract {',
  19: '            alarmAcceptedElapsed >= 0 [s] and',
  20: '            transmissionSilentElapsed >= alarmAcceptedElapsed and',
  21: '            transmissionSilentElapsed < resoutReceivedElapsed and',
  22: '            resoutReceivedElapsed <= drivingFttiLimit',
  23: '        }',
  24: '    }',
  25: '}',
};
// Line N (1-based) lives at split index N-1, matching real `text.split('\n')`.
const text = Array.from({ length: 25 }, (_, i) => LINES[i + 1] ?? '').join('\n');

const attr = (name: string, s: number, e: number) => ({ type: 'AttributeUsage', name, startLine: s, endLine: e, children: [] });
const model = [{
  type: 'Package', name: 'FarEpc2', startLine: 1, endLine: 25,
  children: [{ type: 'OwningMembership', children: [
    { type: 'ActionDefinition', name: 'FarHwEpc2Sequence', startLine: 2, endLine: 24, children: [
      { type: 'FeatureMembership', children: [attr('alarmAcceptedElapsed', 10, 11)] },
      { type: 'FeatureMembership', children: [attr('transmissionSilentElapsed', 12, 13)] },
      { type: 'FeatureMembership', children: [attr('resoutReceivedElapsed', 14, 15)] },
      { type: 'FeatureMembership', children: [attr('drivingFttiLimit', 16, 16)] },
      { type: 'FeatureMembership', children: [{ type: 'AssertConstraintUsage', name: 'timingContract', startLine: 18, endLine: 23, children: [] }] },
    ] },
  ] }],
}];

describe('extractSequenceTiming', () => {
  const [t] = extractSequenceTiming([{ text, model }]);

  it('scopes timing to its owning sequence definition', () => {
    expect(t.ownerQualifiedName).toBe('FarEpc2::FarHwEpc2Sequence');
  });

  it('extracts the three elapsed measurements with target and origin', () => {
    expect(t.measures.map(m => m.name)).toEqual([
      'alarmAcceptedElapsed', 'transmissionSilentElapsed', 'resoutReceivedElapsed',
    ]);
    expect(t.measures[0].target).toEqual({ participant: 'smu', event: 'alarmAccepted' });
    expect(t.measures[0].origin).toEqual({ event: 'faultOccurred' });
    expect(t.measures[2].target).toEqual({ participant: 'reset', event: 'resoutReceived' });
  });

  it('extracts the budget and normalises the unit to milliseconds', () => {
    expect(t.budgets).toHaveLength(1);
    expect(t.budgets[0].name).toBe('drivingFttiLimit');
    expect(t.budgets[0].ms).toBeCloseTo(10);
    expect(t.budgets[0].display).toBe('10 ms');
  });

  it('captures the asserted contract text', () => {
    expect(t.constraintName).toBe('timingContract');
    expect(t.contract).toMatch(/resoutReceivedElapsed <= drivingFttiLimit/);
  });

  it('derives the deadline: resoutReceivedElapsed ≤ 10 ms at reset.resoutReceived', () => {
    expect(t.deadlines).toHaveLength(1);
    expect(t.deadlines[0]).toMatchObject({
      measureName: 'resoutReceivedElapsed', ms: 10, display: '10 ms',
      target: { participant: 'reset', event: 'resoutReceived' },
    });
  });

  it('returns nothing for sources without timing', () => {
    expect(extractSequenceTiming([{ text: 'package P { part def A; }', model: [{ type: 'Package', name: 'P', children: [] }] }])).toEqual([]);
  });
});
