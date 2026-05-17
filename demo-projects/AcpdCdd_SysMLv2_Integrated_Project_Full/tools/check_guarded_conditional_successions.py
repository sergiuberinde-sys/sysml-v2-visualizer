#!/usr/bin/env python3
from pathlib import Path
import re

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_FILE = PROJECT_ROOT / "02_Input.sysml"
CONDITIONAL_FILE = PROJECT_ROOT / "19_ConditionalBehavior.sysml"
REPORT = PROJECT_ROOT / "reports" / "guarded_conditional_successions.md"

REQUIRED_BOOLEAN_FEATURES = [
    "notificationArrived",
    "timestampFresh",
    "group0SampleValid",
    "group1SampleValid",
    "supplySampleValid",
    "sensorPairPlausible",
]

REQUIRED_GUARDED_EDGES = [
    "ReceiveAdcNotification.notification.notificationArrived",
    "not ReceiveAdcNotification.notification.notificationArrived",
    "DecodeAdcGroups.decodedInputData.timestampFresh",
    "not DecodeAdcGroups.decodedInputData.timestampFresh",
    "not ValidateGroup0Sample.group0CheckedInputData.group0SampleValid",
    "not ValidateGroup1Sample.group1CheckedInputData.group1SampleValid",
    "not ValidateSupplySample.supplyCheckedInputData.supplySampleValid",
    "ValidateSensorPairPlausibility.plausibilityCheckedInputData.sensorPairPlausible",
    "not ValidateSensorPairPlausibility.plausibilityCheckedInputData.sensorPairPlausible",
]

REQUIRED_INPUT_EDGES = [
    "receiveAdcNotification.notification.notificationArrived",
    "not receiveAdcNotification.notification.notificationArrived",
    "decodeAdcGroups.decodedInputData.timestampFresh",
    "not decodeAdcGroups.decodedInputData.timestampFresh",
]


def has_guarded_edge(text: str, guard: str) -> bool:
    # Avoid complex regex backtracking; normalize whitespace and check that the guard appears
    # between a `first` succession source and a `then` target.
    normalized = " ".join(text.split())
    marker = f" if {guard} then "
    if marker not in normalized:
        return False
    idx = normalized.index(marker)
    return " first " in (" " + normalized[:idx]) or normalized.startswith("first ")


def main() -> int:
    errors = []
    types_text = (PROJECT_ROOT / "00_Types.sysml").read_text(encoding="utf-8")
    input_text = INPUT_FILE.read_text(encoding="utf-8")
    conditional_text = CONDITIONAL_FILE.read_text(encoding="utf-8")

    for feature in REQUIRED_BOOLEAN_FEATURES:
        if not re.search(rf"attribute\s+{feature}\s*:\s*boolean\s*;", types_text):
            errors.append(f"missing typed Boolean guard feature in item definitions: {feature}")

    if "action def AcpdCdd_Input_Main10ms_GuardedBranching" not in input_text:
        errors.append("02_Input.sysml does not expose AcpdCdd_Input_Main10ms_GuardedBranching")

    for guard in REQUIRED_INPUT_EDGES:
        if not has_guarded_edge(input_text, guard):
            errors.append(f"02_Input.sysml missing guarded succession: if {guard}")

    for guard in REQUIRED_GUARDED_EDGES:
        if not has_guarded_edge(conditional_text, guard):
            errors.append(f"19_ConditionalBehavior.sysml missing guarded succession: if {guard}")

    for text, name in [(input_text, "02_Input.sysml"), (conditional_text, "19_ConditionalBehavior.sysml")]:
        if "flow from" not in text:
            errors.append(f"{name} missing explicit object/data flows for guarded behavior")

    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(
        "# Guarded Conditional Succession Check\n\n"
        + ("Result: PASS\n" if not errors else "Result: FAIL\n\n" + "\n".join(f"- {e}" for e in errors) + "\n")
        + "\nChecked official-style conditional successions: `first A if Boolean then B;`.\n",
        encoding="utf-8",
    )
    print("Guarded conditional successions: " + ("PASS" if not errors else "FAIL"))
    print(f"Report written to {REPORT.relative_to(PROJECT_ROOT)}")
    if errors:
        for e in errors:
            print("- " + e)
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
