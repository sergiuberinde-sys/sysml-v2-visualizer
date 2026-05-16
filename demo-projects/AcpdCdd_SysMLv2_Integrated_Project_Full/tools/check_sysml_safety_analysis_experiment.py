#!/usr/bin/env python3
from pathlib import Path
import re

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FILE = PROJECT_ROOT / "20_SysMLSafetyAnalysisExperiment.sysml"
REPORT = PROJECT_ROOT / "reports" / "sysml_safety_analysis_experiment.md"

REQUIRED_TEXT = [
    "part def FailureMode",
    "part def ControlMeasure",
    "part def SafetyGap",
    "part missingAdcNotification : FailureMode",
    "attribute controlCoverage",
    "attribute hasSafetyGap",
    "require timestampSupervisionRequired",
    "require errorQualifierFallbackRequired",
    "part timestampSupervision : ControlMeasure",
    "part errorQualifierFallback : ControlMeasure",
    "trlc-failure-mode: AcpdCddSafety.MissingAdcNotification",
]

def main():
    errors = []
    text = FILE.read_text(encoding="utf-8")
    for token in REQUIRED_TEXT:
        if token not in text:
            errors.append(f"missing expected safety-model token: {token}")

    # Simple consistency check for the positive pilot model.
    positive_block = re.search(
        r"part def MissingAdcNotification_FailureModeModel \{(?P<body>.*?)\n        \}",
        text,
        re.DOTALL,
    )
    if positive_block:
        body = positive_block.group("body")
        if "hasSafetyGap = false" not in body:
            errors.append("positive failure-mode model should have hasSafetyGap = false")
        if "controlCoverage = FullControlMeasure" not in body:
            errors.append("positive failure-mode model should have FullControlMeasure coverage")
        if "part timestampSupervision : ControlMeasure" not in body:
            errors.append("positive failure-mode model lacks timestamp supervision control measure")
        if "part errorQualifierFallback : ControlMeasure" not in body:
            errors.append("positive failure-mode model lacks error qualifier fallback control measure")

    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(
        "# SysML Safety Analysis Experiment Check\n\n"
        + ("Result: PASS\n" if not errors else "Result: FAIL\n\n" + "\n".join(f"- {e}" for e in errors) + "\n"),
        encoding="utf-8",
    )

    print("SysML safety-analysis experiment: " + ("PASS" if not errors else "FAIL"))
    print("Pattern: FailureMode part + required ControlMeasure parts + gap attribute")
    print(f"Report written to {REPORT.relative_to(PROJECT_ROOT)}")
    if errors:
        for e in errors:
            print("- " + e)
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
