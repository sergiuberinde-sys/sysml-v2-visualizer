#!/usr/bin/env python3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_FILE = PROJECT_ROOT / "02_Input.sysml"

# This checker intentionally rejects the old synthetic Entry/entry actions.
FORBIDDEN_PATTERNS = [
    "action Entry",
    "action entry",
    "first Entry then",
    "first entry then",
    "Entry.",
    "entry.",
]

# Keep the important behavior/data continuity after removing synthetic Entry actions.
REQUIRED_PATTERNS = [
    "if Group0SampleCountPointerAndRange_isValid",
    "if Group1SampleCountPointerAndRange_isValid",
    "if SupplySample_isValid",
    "if CollectedInputData_isValid",
    "flow from adcGroup0Sample to GetGroup0SampleFromAdc.adcGroup0Sample;",
    "flow from adcGroup1Sample to ValidateGroup1SampleCountPointerAndRange.group1Sample;",
    "flow from adcSupplySample to ValidateSupplySample.supplySample;",
    "flow from group0Data to GetGroup0Data.group0Data;",
    "flow from group1Data to GetGroup1Data.group1Data;",
    "flow from supplyData to GetSupplyData.supplyData;",
    "flow from ReturnUpdatedGroupDataEntryPair.updatedGroupDataEntryPair to updatedGroupDataEntryPair;",
    "flow from ReturnUpdatedSupplyData.updatedSupplyData to updatedSupplyData;",
    "flow from ReturnInputData.InputData to InputData;",
]

def main() -> int:
    text = INPUT_FILE.read_text(encoding="utf-8")
    errors = []
    for pattern in FORBIDDEN_PATTERNS:
        if pattern in text:
            errors.append(f"forbidden synthetic entry action remnant: {pattern}")
    for pattern in REQUIRED_PATTERNS:
        if pattern not in text:
            errors.append(f"missing Input continuity/branching pattern: {pattern}")

    print("Input no-entry/data continuity: " + ("PASS" if not errors else "FAIL"))
    if errors:
        for e in errors:
            print("- " + e)
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
