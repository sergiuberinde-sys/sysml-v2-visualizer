#!/usr/bin/env python3
"""Validate that architectural part usages are typed by declared part definitions.

This is a project semantic-enforcement checker. It intentionally goes beyond
basic textual parsing by requiring reusable architecture/sequence/dataflow
participants to be explicit usages of part defs.
"""
from __future__ import annotations
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REPORT = PROJECT_ROOT / "reports" / "typed_parts.md"

PART_DEF_RE = re.compile(r'\bpart\s+def\s+([A-Za-z_][A-Za-z0-9_]*)\b')
# Matches simple part usages, including multiplicity. Excludes 'part def'.
PART_USAGE_RE = re.compile(
    r'(?<!def\s)\bpart\s+([A-Za-z_][A-Za-z0-9_]*)(?:\[[^\]]+\])?\s*(?::\s*([A-Za-z_][A-Za-z0-9_]*))?\s*(?:;|\{)'
)

TARGET_FILES = [
    "07_ComponentDesign.sysml",
    "11_ExternalInteractions.sysml",
    "12_DynamicInteractionSequences.sysml",
    "13_InterfaceContracts.sysml",
    "14_ComponentInteractionSequences.sysml",
    "18_ComponentDataflows.sysml",
]

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")

def collect_part_defs() -> set[str]:
    defs: set[str] = set()
    for path in PROJECT_ROOT.glob("*.sysml"):
        defs.update(PART_DEF_RE.findall(read(path)))
    return defs

def main() -> int:
    errors: list[str] = []
    part_defs = collect_part_defs()

    for filename in TARGET_FILES:
        path = PROJECT_ROOT / filename
        if not path.exists():
            continue
        text = read(path)
        for m in PART_USAGE_RE.finditer(text):
            name, typ = m.groups()
            line = text[:m.start()].count("\n") + 1
            # Defensive skip for any accidental match inside a 'part def'.
            prefix = text[max(0, m.start()-12):m.start()]
            if "def " in prefix:
                continue
            if not typ:
                errors.append(f"{filename}:{line}: part {name} is untyped")
            elif typ not in part_defs:
                errors.append(f"{filename}:{line}: part {name} uses unknown part def {typ}")

    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(
        "# Typed Part Check\n\n"
        + ("Result: PASS\n" if not errors else "Result: FAIL\n\n" + "\n".join(f"- {e}" for e in errors) + "\n")
        + f"\nPart definitions found: {len(part_defs)}\n",
        encoding="utf-8",
    )

    print("Typed parts: " + ("PASS" if not errors else "FAIL"))
    print(f"Part definitions found: {len(part_defs)}")
    print(f"Report written to {REPORT.relative_to(PROJECT_ROOT)}")
    if errors:
        for e in errors:
            print("- " + e)
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
