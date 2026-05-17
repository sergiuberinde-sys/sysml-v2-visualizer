#!/usr/bin/env python3
from pathlib import Path
import re

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FILE = PROJECT_ROOT / "19_ConditionalBehavior.sysml"
REPORT = PROJECT_ROOT / "reports" / "conditional_behavior_views.md"

EXPECTED_ACTIONS = [
    "AcpdCdd_Input_Main10ms_Branching",
    "AcpdCdd_InputNotificationHandling_Conditional",
    "AcpdCdd_TimestampSupervision_Conditional",
    "AcpdCdd_DeviationCheck_Conditional",
    "AcpdCdd_OutputQualifier_Conditional",
    "AcpdCdd_Powermanagement_Conditional",
    "AcpdCdd_Main10ms_ConditionalOverview",
]

EXPECTED_INPUT_BRANCH_CONDITIONS = [
    "AdcNotification_hasArrived",
    "DecodedAdcTimestamp_isFresh",
    "Group0Sample_isInvalid",
    "Group1Sample_isInvalid",
    "SupplySample_isInvalid",
    "SensorPair_isPlausible",
]

EXPECTED_VISUALIZATION_NODES = [
    "Fork_IndependentInputChecks",
    "Join_IndependentInputChecks",
]

def main():
    errors = []
    text = FILE.read_text(encoding="utf-8")

    for action in EXPECTED_ACTIONS:
        if f"action def {action}" not in text:
            errors.append(f"missing conditional action view: {action}")

    if len(re.findall(r"\bfirst\s+\w+\s+if\s+.+?\s+then\s+\w+\s*;", text)) < 9:
        errors.append("expected at least 9 Boolean guarded successions")
    if "then" not in text:
        errors.append("expected explicit action successions with Boolean guards")

    for condition in EXPECTED_INPUT_BRANCH_CONDITIONS:
        if condition not in text:
            errors.append(f"missing Boolean condition reference: {condition}")

    for node in EXPECTED_VISUALIZATION_NODES:
        if f"action {node};" not in text:
            errors.append(f"missing explicit visualizer node action: {node}")

    if "first Fork_IndependentInputChecks then ValidateGroup0Sample;" not in text:
        errors.append("missing fork edge to ValidateGroup0Sample")
    if "first ValidateGroup0Sample then Join_IndependentInputChecks;" not in text:
        errors.append("missing join edge from ValidateGroup0Sample")
    if "first ValidateGroup1Sample then Join_IndependentInputChecks;" not in text:
        errors.append("missing join edge from ValidateGroup1Sample")
    if "first ValidateSupplySample then Join_IndependentInputChecks;" not in text:
        errors.append("missing join edge from ValidateSupplySample")

    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(
        "# Conditional Behavior View Check\n\n"
        + ("Result: PASS\n" if not errors else "Result: FAIL\n\n" + "\n".join(f"- {e}" for e in errors) + "\n")
        + "\nChecked: decisions, merges, fork/join visualization nodes, typed Boolean guarded successions.\n",
        encoding="utf-8",
    )
    print("Conditional behavior views: " + ("PASS" if not errors else "FAIL"))
    print(f"Conditional views checked: {len(EXPECTED_ACTIONS)}")
    print(f"Report written to {REPORT.relative_to(PROJECT_ROOT)}")
    if errors:
        for e in errors:
            print("- " + e)
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
