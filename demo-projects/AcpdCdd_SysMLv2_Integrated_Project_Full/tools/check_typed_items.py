#!/usr/bin/env python3
"""Validate that relevant SysML item usages are explicitly typed by item definitions.

This is a project semantic-enforcement checker, not the official OMG language
validator. It strengthens the model by requiring payloads, buffers, action
parameters, and runtime-contract items to be typed instead of name-only.
"""
from __future__ import annotations
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REPORT = PROJECT_ROOT / "reports" / "typed_items.md"

ITEM_DEF_RE = re.compile(r'\bitem\s+def\s+([A-Za-z_][A-Za-z0-9_]*)\b')
ITEM_USAGE_RE = re.compile(
    r'(?<!def\s)\b(?:in\s+|out\s+|inout\s+)?item\s+'
    r'([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([A-Za-z_][A-Za-z0-9_]*))?\s*;'
)

TARGET_FILES = [
    "00_Types.sysml",
    "01_ExternalActors.sysml",
    "02_Input.sysml",
    "03_Process.sysml",
    "04_Powermanagement.sysml",
    "05_Monitoring.sysml",
    "06_Output.sysml",
    "13_InterfaceContracts.sysml",
    "17_RuntimeInteractionContracts.sysml",
    "18_ComponentDataflows.sysml",
    "19_ConditionalBehavior.sysml",
]

# Some item usages may intentionally be typed by item definitions in external
# libraries in future. Keep this small and explicit; do not use it for project
# data because that would weaken enforcement.
ALLOWED_EXTERNAL_TYPES: set[str] = set()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def collect_item_defs() -> set[str]:
    defs: set[str] = set()
    for path in PROJECT_ROOT.glob("*.sysml"):
        defs.update(ITEM_DEF_RE.findall(read(path)))
    return defs


def line_for(text: str, pos: int) -> int:
    return text[:pos].count("\n") + 1


def main() -> int:
    errors: list[str] = []
    item_defs = collect_item_defs()

    for filename in TARGET_FILES:
        path = PROJECT_ROOT / filename
        if not path.exists():
            continue
        text = read(path)
        for m in ITEM_USAGE_RE.finditer(text):
            item_name, item_type = m.groups()
            line = line_for(text, m.start())
            prefix = text[max(0, m.start() - 20):m.start()]
            if "item def" in prefix:
                continue
            if not item_type:
                errors.append(f"{filename}:{line}: item {item_name} is untyped")
            elif item_type not in item_defs and item_type not in ALLOWED_EXTERNAL_TYPES:
                errors.append(f"{filename}:{line}: item {item_name} uses unknown item def {item_type}")

    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(
        "# Typed Item Check\n\n"
        + ("Result: PASS\n" if not errors else "Result: FAIL\n\n" + "\n".join(f"- {e}" for e in errors) + "\n")
        + f"\nItem definitions found: {len(item_defs)}\n",
        encoding="utf-8",
    )

    print("Typed items: " + ("PASS" if not errors else "FAIL"))
    print(f"Item definitions found: {len(item_defs)}")
    print(f"Report written to {REPORT.relative_to(PROJECT_ROOT)}")
    if errors:
        for e in errors:
            print("- " + e)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
