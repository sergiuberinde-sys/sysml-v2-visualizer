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

import { scanSatisfiesText } from '../extractTraces';

describe('scanSatisfiesText (whole-workspace textual @Satisfies scan)', () => {
  it('attributes a multi-line reqId tuple to the enclosing named element', () => {
    const src = `package P {
    action def HvmTrapReactionAction {
        @Satisfies {
            reqId = (
                "SafeFaultManagement_MaintainHVMSS2Containment_SW_64789225",
                "SafeFaultManagement_PreserveUnaffectedHVMResourcesInSS2_SW_64789233"
            );
        }
        @ASIL { level = ASILLevel::ASIL_D; }
        action step1;
    }
}`;
    expect(scanSatisfiesText([{ text: src }])).toEqual([
      { elementName: 'HvmTrapReactionAction', reqId: 'SafeFaultManagement_MaintainHVMSS2Containment_SW_64789225' },
      { elementName: 'HvmTrapReactionAction', reqId: 'SafeFaultManagement_PreserveUnaffectedHVMResourcesInSS2_SW_64789233' },
    ]);
  });

  it('handles a single-line @Satisfies and a part-usage host, and dedupes across files', () => {
    const a = `part def Sys { part sensor : SensorDef { @Satisfies { reqId = ("R_1"); } } }`;
    const b = `part def Sys2 { part sensor : SensorDef { @Satisfies { reqId = ("R_1"); } } }`;
    const traces = scanSatisfiesText([{ text: a }, { text: b }]);
    // Both attribute to `sensor`; same (host,reqId) is de-duplicated.
    expect(traces).toEqual([{ elementName: 'sensor', reqId: 'R_1' }]);
  });
});
