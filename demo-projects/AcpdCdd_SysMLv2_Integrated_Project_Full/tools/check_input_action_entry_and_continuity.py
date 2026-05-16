#!/usr/bin/env python3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_FILE = PROJECT_ROOT / "02_Input.sysml"
REPORT = PROJECT_ROOT / "reports" / "input_action_entry_and_continuity.md"

REQUIRED_PATTERNS = [
    "action Entry",
    "first Entry then CheckAdcGroupDataNotNull;",
    "first Entry then CheckSensorDataNotNull;",
    "first Entry then GetGroup0SampleFromAdc;",
    "first Entry then ValidateGroup1SampleCountPointerAndRange;",
    "first Entry then ValidateSupplySample;",
    "first Entry then EnterSensorGroupDataHandlingExclusiveArea;",
    "flow from adcGroup0Sample to Entry.adcGroup0Sample;",
    "flow from adcGroup1Sample to Entry.adcGroup1Sample;",
    "flow from adcSupplySample to Entry.adcSupplySample;",
    "flow from ReturnUpdatedGroupDataEntryPair.updatedGroupDataEntryPair to updatedGroupDataEntryPair;",
    "flow from ReturnUpdatedSupplyData.updatedSupplyData to updatedSupplyData;",
    "flow from ReturnInputData.InputData to InputData;",
]

REQUIRED_GUARDS = [
    "if ValidateGroup1SampleCountPointerAndRange.decision.sampleCountPointerAndRangeValid",
    "if not ValidateGroup1SampleCountPointerAndRange.decision.sampleCountPointerAndRangeValid",
    "if CheckOldGroup1Cache.decision.oldGroup1CacheFilled",
    "if not CheckOldGroup1Cache.decision.oldGroup1CacheFilled",
    "if ValidateSupplySample.decision.supplySampleValid",
    "if not ValidateSupplySample.decision.supplySampleValid",
    "if ValidateCollectedInputData.decision.collectedInputDataValid",
    "if not ValidateCollectedInputData.decision.collectedInputDataValid",
]


def main() -> int:
    text = INPUT_FILE.read_text(encoding="utf-8")
    errors = []
    for pattern in REQUIRED_PATTERNS:
        if pattern not in text:
            errors.append(f"missing Input action continuity pattern: {pattern}")
    normalized = " ".join(text.split())
    for guard in REQUIRED_GUARDS:
        if guard not in normalized:
            errors.append(f"missing Input guarded succession: {guard}")

    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(
        "# Input Action Entry and Data Continuity Check\n\n"
        + ("Result: PASS\n" if not errors else "Result: FAIL\n\n" + "\n".join(f"- {e}" for e in errors) + "\n")
        + "\nChecks that the first file-by-file refactor of `02_Input.sysml` uses explicit Entry actions, guarded successions, and typed data-continuity flows.\n",
        encoding="utf-8",
    )
    print("Input action entry/data continuity: " + ("PASS" if not errors else "FAIL"))
    print(f"Report written to {REPORT.relative_to(PROJECT_ROOT)}")
    if errors:
        for e in errors:
            print("- " + e)
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
