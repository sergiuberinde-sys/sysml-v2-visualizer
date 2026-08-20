import { describe, it, expect } from 'vitest';
import { extractSatisfiesTraces } from '../extractTraces';

// A raw-model-node shape (mirrors the parser's containment tree the extractor walks).
type N = { type: string; name?: string | null; children?: N[] };

// Mirror of the parser's model tree for:
//   action def FarHwEpc2Action {
//     @Satisfies { reqId = ("Req_A_111", "Req_B_222"); }
//   }
//   action def Other { @ASIL { level = ASILLevel::ASIL_D; } }   // not a Satisfies
const meta = (typing: string, lits: string[]): N => ({
  type: 'MetadataUsage', children: [
    { type: 'FeatureTyping', name: typing },
    { type: 'FeatureMembership', children: [
      { type: 'AttributeUsage', name: 'reqId', children: [
        { type: 'FeatureValue', children: lits.map((v): N => ({ type: 'LiteralString', name: v })) },
      ] },
    ] },
  ],
});
const def = (name: string, m: N): N => ({
  type: 'ActionDefinition', name, children: [{ type: 'FeatureMembership', children: [m] }],
});
const model: N[] = [{
  type: 'Package', name: 'Pkg', children: [
    { type: 'OwningMembership', children: [def('FarHwEpc2Action', meta('Satisfies', ['Req_A_111', 'Req_B_222']))] },
    { type: 'OwningMembership', children: [def('Other', meta('ASIL', []))] },
  ],
}];

describe('extractSatisfiesTraces', () => {
  it('flattens @Satisfies reqId tuples into (element → requirement) traces', () => {
    expect(extractSatisfiesTraces([model])).toEqual([
      { elementName: 'FarHwEpc2Action', reqId: 'Req_A_111' },
      { elementName: 'FarHwEpc2Action', reqId: 'Req_B_222' },
    ]);
  });

  it('ignores non-Satisfies metadata (e.g. @ASIL) and undefined models', () => {
    const asilOnly: N[] = [{ type: 'ActionDefinition', name: 'X', children: [{ type: 'FeatureMembership', children: [meta('ASIL', [])] }] }];
    expect(extractSatisfiesTraces([asilOnly])).toEqual([]);
    expect(extractSatisfiesTraces([undefined])).toEqual([]);
  });

  it('attributes the trace to the nearest enclosing named element (nested)', () => {
    const nested: N[] = [{ type: 'PartDefinition', name: 'Outer', children: [
      { type: 'FeatureMembership', children: [
        { type: 'PartUsage', name: 'inner', children: [{ type: 'FeatureMembership', children: [meta('Satisfies', ['R_9'])] }] },
      ] },
    ] }];
    expect(extractSatisfiesTraces([nested])).toEqual([{ elementName: 'inner', reqId: 'R_9' }]);
  });
});
