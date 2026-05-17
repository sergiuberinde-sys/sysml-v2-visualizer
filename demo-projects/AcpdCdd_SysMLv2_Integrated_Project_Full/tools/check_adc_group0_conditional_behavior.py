#!/usr/bin/env python3
from pathlib import Path
import re, sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_FILE = PROJECT_ROOT / "02_Input.sysml"

REQUIRED_GUARDS = [
    "Group0SampleCountPointerAndRange_isValid",
    "OldGroup0Cache_isFilled",
    "Group0AndGroup1Cache_areBothFilled",
]
REQUIRED_ACTIONS = [
    "GetGroup0SampleFromAdc",
    "ValidateSampleCountPointerAndRange",
    "UseActualGroup0Sample",
    "UseInvalidGroup0Sample",
    "CheckOldGroup0Cache",
    "PushOldGroup0WithInvalidGroup1IfNeeded",
    "CacheNewGroup0Sample",
    "SetIsGroup0FilledTrue",
    "WriteConsistentPairToRingBuffer",
    "KeepPartialPairCached",
    "ResetCachePair",
    "ReturnUpdatedGroupDataEntryPair",
]
REQUIRED_FLOWS = [
    "flow from adcGroup0Sample to GetGroup0SampleFromAdc.adcGroup0Sample;",
    "flow from GetGroup0SampleFromAdc.group0Sample to ValidateSampleCountPointerAndRange.group0Sample;",
    "flow from GetGroup0SampleFromAdc.group0Sample to UseActualGroup0Sample.group0Sample;",
    "flow from groupDataEntryPair to CheckOldGroup0Cache.groupDataEntryPair;",
    "flow from UseActualGroup0Sample.normalizedGroup0Sample to CacheNewGroup0Sample.group0Sample;",
    "flow from UseInvalidGroup0Sample.normalizedGroup0Sample to CacheNewGroup0Sample.group0Sample;",
    "flow from ReturnUpdatedGroupDataEntryPair.updatedGroupDataEntryPair to updatedGroupDataEntryPair;",
]

def main() -> int:
    text = INPUT_FILE.read_text(encoding="utf-8")
    errors=[]
    if "action def AcpdCdd_AdcGroup0NewData" not in text:
        errors.append("missing AcpdCdd_AdcGroup0NewData action definition")
    for guard in REQUIRED_GUARDS:
        if not re.search(rf"attribute\s+{guard}\s*:\s*Boolean\b", text):
            errors.append(f"missing Boolean guard attribute: {guard}")
        if not re.search(rf"first\s+\w+\s+if\s+(?:not\s+)?{guard}\s+then\s+\w+;", text):
            errors.append(f"missing guarded succession using Boolean guard: {guard}")
    for action in REQUIRED_ACTIONS:
        if f"action {action}" not in text:
            errors.append(f"missing Group0 conditional action: {action}")
    for flow in REQUIRED_FLOWS:
        if flow not in text:
            errors.append(f"missing typed data flow: {flow}")
    if re.search(r"\baction\s+(?:entry|Entry)\b", text) or re.search(r"(?:entry|Entry)\.", text):
        errors.append("synthetic entry action remnant found in 02_Input.sysml")
    if errors:
        print("AcpdCdd_AdcGroup0NewData conditional behavior: FAIL")
        for e in errors:
            print("-", e)
        return 1
    print("AcpdCdd_AdcGroup0NewData conditional behavior: PASS")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
