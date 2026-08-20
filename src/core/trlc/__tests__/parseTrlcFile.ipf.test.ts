import { describe, it, expect } from 'vitest';
import { parseTrlcFile } from '../parseTrlcFile';

describe('parseTrlcFile — native IPF format', () => {
  const ipf = `// Codebeamer ID: 65347186; chapter: 6.1.2.1; source summary: Independent Fault Management
IpfRMBase.SystemRequirement SafeFaultManagement_IndependentFaultManagementPerDomain_65347186 {
    description = '''
        The Driving domain and the HVM domain shall provide independent
        fault-management paths.
        '''
    asil = IpfRMBase.ASIL.D
    verificationmethod = IpfRMBase.VerificationMethod.Test // TODO
    status = IpfRMBase.Status.Draft
    feature = IpfFeatures.Feature.SafeFaultManagement
    ecu = [ IpfRMBase.Ecu.IPF02, ]
    ecuvariant = [
        IpfRMBase.EcuVariant.FAR,
        IpfRMBase.EcuVariant.HVM,
    ]
}`;

  it('reads the record name as the requirement id, plus multi-line description and enum ASIL', () => {
    const { requirements } = parseTrlcFile(ipf);
    expect(requirements).toHaveLength(1);
    const r = requirements[0];
    expect(r.id).toBe('SafeFaultManagement_IndependentFaultManagementPerDomain_65347186');
    expect(r.asil).toBe('D');
    expect(r.text).toBe('The Driving domain and the HVM domain shall provide independent fault-management paths.');
    expect(r.kind).toBe('SYS');
    expect(r.derivedFrom).toBeUndefined(); // root requirement — no derived_from_trlc
    // the [ … ] ecu lists must not spill into another record
  });
});

describe('parseTrlcFile — requirement hierarchy (derived_from_trlc)', () => {
  const src = `IpfRMBase.SystemRequirement Parent_1 {
    description = "root"
    asil = IpfRMBase.ASIL.D
}

IpfRMBase.HardwareRequirement Child_HW_2 {
    description = "hw child"
    asil = IpfRMBase.ASIL.D
    derived_from_trlc = [ Parent_1, ]
}

IpfRMBase.SoftwareRequirement Child_SW_3 {
    description = "sw child, two parents"
    derived_from_trlc = [
        Parent_1,
        Child_HW_2,
    ]
}`;

  it('captures the record category as kind and parses single-line + multi-line derived_from lists', () => {
    const { requirements } = parseTrlcFile(src);
    expect(requirements).toHaveLength(3);
    const [p, hw, sw] = requirements;

    expect(p.kind).toBe('SYS');
    expect(p.derivedFrom).toBeUndefined();

    expect(hw.kind).toBe('HW');
    expect(hw.derivedFrom).toEqual(['Parent_1']);

    expect(sw.kind).toBe('SW');
    expect(sw.derivedFrom).toEqual(['Parent_1', 'Child_HW_2']);
  });
});

describe('parseTrlcFile — legacy double-quoted format still works (no regression)', () => {
  const legacy = `package P
import T

// 25093540 – Some Title (Cat)
T.Requirement Req_25093540
{
    description = "A single-line requirement."
    asil = "B"
}`;
  it('parses id, title, description and asil as before', () => {
    const { requirements } = parseTrlcFile(legacy);
    expect(requirements).toHaveLength(1);
    expect(requirements[0]).toMatchObject({ id: 'Req_25093540', title: 'Some Title (Cat)', text: 'A single-line requirement.', asil: 'B' });
  });
});
