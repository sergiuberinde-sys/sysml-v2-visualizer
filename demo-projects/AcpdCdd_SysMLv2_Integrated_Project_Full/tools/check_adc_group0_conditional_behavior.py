#!/usr/bin/env python3
from pathlib import Path
import re

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_FILE = PROJECT_ROOT / "02_Input.sysml"
TYPES_FILE = PROJECT_ROOT / "00_Types.sysml"
REPORT = PROJECT_ROOT / "reports" / "adc_group0_conditional_behavior.md"

REQUIRED_DECISION_ATTRIBUTES = [
    "sampleCountPointerAndRangeValid",
    "oldGroup0CacheFilled",
    "bothGroup0AndGroup1Filled",
]

REQUIRED_GUARDS = [
    "ValidateSampleCountPointerAndRange.validationResult.sampleCountPointerAndRangeValid",
    "not ValidateSampleCountPointerAndRange.validationResult.sampleCountPointerAndRangeValid",
    "CheckOldGroup0Cache.cacheState.oldGroup0CacheFilled",
    "not CheckOldGroup0Cache.cacheState.oldGroup0CacheFilled",
    "CheckBothGroup0AndGroup1Filled.pairState.bothGroup0AndGroup1Filled",
    "not CheckBothGroup0AndGroup1Filled.pairState.bothGroup0AndGroup1Filled",
]

REQUIRED_ACTIONS = [
    "Entry",
    "UseActualGroup0Sample",
    "UseInvalidGroup0Sample",
    "PushOldGroup0WithInvalidGroup1IfNeeded",
    "CacheNewGroup0Sample",
    "SetIsGroup0FilledTrue",
    "WriteConsistentPairToRingBuffer",
    "KeepPartialPairCached",
    "ResetCachePair",
    "ReturnUpdatedGroupDataEntryPair",
]

REQUIRED_FLOWS = [
    "flow from adcGroup0Sample to Entry.adcGroup0Sample;",
    "flow from Entry.adcGroup0Sample to GetGroup0SampleFromAdc.adcGroup0Sample;",
    "flow from GetGroup0SampleFromAdc.group0Sample to ValidateSampleCountPointerAndRange.group0Sample;",
    "flow from GetGroup0SampleFromAdc.group0Sample to UseActualGroup0Sample.group0Sample;",
    "flow from Entry.groupDataEntryPair to CheckOldGroup0Cache.groupDataEntryPair;",
    "flow from UseActualGroup0Sample.normalizedGroup0Sample to CacheNewGroup0Sample.group0Sample;",
    "flow from UseInvalidGroup0Sample.normalizedGroup0Sample to CacheNewGroup0Sample.group0Sample;",
    "flow from PushOldGroup0WithInvalidGroup1IfNeeded.flushedGroupDataEntryPair to CacheNewGroup0Sample.groupDataEntryPair;",
    "flow from CacheNewGroup0Sample.cachedGroupDataEntryPair to SetIsGroup0FilledTrue.groupDataEntryPair;",
    "flow from SetIsGroup0FilledTrue.updatedGroupDataEntryPair to CheckBothGroup0AndGroup1Filled.groupDataEntryPair;",
    "flow from SetIsGroup0FilledTrue.updatedGroupDataEntryPair to WriteConsistentPairToRingBuffer.groupDataEntryPair;",
    "flow from SetIsGroup0FilledTrue.updatedGroupDataEntryPair to KeepPartialPairCached.groupDataEntryPair;",
    "flow from WriteConsistentPairToRingBuffer.writtenGroupDataEntryPair to ResetCachePair.groupDataEntryPair;",
    "flow from ResetCachePair.resetGroupDataEntryPair to ReturnUpdatedGroupDataEntryPair.groupDataEntryPair;",
    "flow from KeepPartialPairCached.cachedPartialGroupDataEntryPair to ReturnUpdatedGroupDataEntryPair.groupDataEntryPair;",
    "flow from ReturnUpdatedGroupDataEntryPair.updatedGroupDataEntryPair to updatedGroupDataEntryPair;",
]


def has_guarded_edge(text: str, guard: str) -> bool:
    normalized = " ".join(text.split())
    return f" if {guard} then " in normalized


def main() -> int:
    errors = []
    input_text = INPUT_FILE.read_text(encoding="utf-8")
    types_text = TYPES_FILE.read_text(encoding="utf-8")

    if "item def AdcGroup0NewDataDecisionType" not in types_text:
        errors.append("missing AdcGroup0NewDataDecisionType")

    for attr in REQUIRED_DECISION_ATTRIBUTES:
        if not re.search(rf"attribute\s+{attr}\s*:\s*boolean\s*;", types_text):
            errors.append(f"missing Boolean decision attribute: {attr}")

    if "action def AcpdCdd_AdcGroup0NewData" not in input_text:
        errors.append("missing AcpdCdd_AdcGroup0NewData action definition")

    for action in REQUIRED_ACTIONS:
        if f"action {action}" not in input_text:
            errors.append(f"missing Group0 conditional action: {action}")

    for guard in REQUIRED_GUARDS:
        if not has_guarded_edge(input_text, guard):
            errors.append(f"missing guarded Group0 succession: if {guard}")

    for flow in REQUIRED_FLOWS:
        if flow not in input_text:
            errors.append(f"missing typed data flow: {flow}")

    if "action adcGroup0NewData : AcpdCdd_AdcGroup0NewData;" not in input_text:
        errors.append("AcpdCdd_Input.adcGroup0NewData usage is not typed by AcpdCdd_AdcGroup0NewData")

    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(
        "# AcpdCdd_AdcGroup0NewData Conditional Behavior Check\n\n"
        + ("Result: PASS\n" if not errors else "Result: FAIL\n\n" + "\n".join(f"- {e}" for e in errors) + "\n")
        + "\nChecked explicit official-style guarded successions and typed data continuity inside `AcpdCdd_AdcGroup0NewData`.\n",
        encoding="utf-8",
    )

    print("AcpdCdd_AdcGroup0NewData conditional behavior: " + ("PASS" if not errors else "FAIL"))
    print(f"Report written to {REPORT.relative_to(PROJECT_ROOT)}")
    if errors:
        for error in errors:
            print("- " + error)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
