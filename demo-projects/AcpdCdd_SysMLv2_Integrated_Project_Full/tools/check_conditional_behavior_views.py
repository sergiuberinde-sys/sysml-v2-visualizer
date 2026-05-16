#!/usr/bin/env python3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FILE = PROJECT_ROOT / "19_ConditionalBehavior.sysml"
REPORT = PROJECT_ROOT / "reports" / "conditional_behavior_views.md"

EXPECTED_ACTIONS = [
    "AcpdCdd_InputNotificationHandling_Conditional",
    "AcpdCdd_TimestampSupervision_Conditional",
    "AcpdCdd_DeviationCheck_Conditional",
    "AcpdCdd_OutputQualifier_Conditional",
    "AcpdCdd_Powermanagement_Conditional",
    "AcpdCdd_Main10ms_ConditionalOverview",
]

def main():
    errors = []
    text = FILE.read_text(encoding="utf-8")
    for action in EXPECTED_ACTIONS:
        if f"action def {action}" not in text:
            errors.append(f"missing conditional action view: {action}")
    if text.count("if ") < 6:
        errors.append("expected at least 6 if decision points")
    if text.count("else") < 5:
        errors.append("expected at least 5 else branches")
    if "first" not in text:
        errors.append("expected succession edges for behavior visualization")
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text("# Conditional Behavior View Check\n\n" + ("Result: PASS\n" if not errors else "Result: FAIL\n\n" + "\n".join(f"- {e}" for e in errors) + "\n"), encoding="utf-8")
    print("Conditional behavior views: " + ("PASS" if not errors else "FAIL"))
    print(f"Conditional views checked: {len(EXPECTED_ACTIONS)}")
    print(f"Report written to {REPORT.relative_to(PROJECT_ROOT)}")
    if errors:
        for e in errors:
            print("- " + e)
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
