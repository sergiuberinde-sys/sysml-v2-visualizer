#!/usr/bin/env python3
"""Validate component dataflow view basics.

Checks:
- 18_ComponentDataflows.sysml exists
- every flow has a payload type comment
- every payload type is defined as an item def in 00_Types.sysml
- every flow has from/to endpoints
"""
from __future__ import annotations
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATAFLOW_FILE = PROJECT_ROOT / "18_ComponentDataflows.sysml"
TYPES_FILE = PROJECT_ROOT / "00_Types.sysml"
REPORT = PROJECT_ROOT / "reports" / "component_dataflows.md"

FLOW_RE = re.compile(
    r'//\s*payload-type:\s*([A-Za-z_][A-Za-z0-9_]*)\s*'
    r'flow\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*'
    r'from\s+([A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*)\s*'
    r'to\s+([A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*)\s*;',
    re.MULTILINE,
)

def main() -> int:
    errors = []
    type_text = TYPES_FILE.read_text(encoding="utf-8")
    defined_types = set(re.findall(r'\bitem\s+def\s+([A-Za-z_][A-Za-z0-9_]*)\b', type_text))

    text = DATAFLOW_FILE.read_text(encoding="utf-8")
    flows = []
    for m in FLOW_RE.finditer(text):
        comment_payload, flow_name, flow_type, src, dst = m.groups()
        flows.append((flow_name, flow_type, src, dst))
        if comment_payload != flow_type:
            errors.append(f"{flow_name}: payload comment {comment_payload} does not match flow type {flow_type}")
        if flow_type not in defined_types:
            errors.append(f"{flow_name}: payload type {flow_type} is not defined in 00_Types.sysml")

    if not flows:
        errors.append("No typed dataflows were parsed from 18_ComponentDataflows.sysml")

    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(
        "# Component Dataflow Check\n\n"
        + ("Result: PASS\n" if not errors else "Result: FAIL\n\n" + "\n".join(f"- {e}" for e in errors) + "\n")
        + f"\nFlows checked: {len(flows)}\n",
        encoding="utf-8",
    )

    print("Component dataflows: " + ("PASS" if not errors else "FAIL"))
    print(f"Flows checked: {len(flows)}")
    print(f"Report written to {REPORT.relative_to(PROJECT_ROOT)}")
    if errors:
        for e in errors:
            print("- " + e)
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
