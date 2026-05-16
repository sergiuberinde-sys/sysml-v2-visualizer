from __future__ import annotations
import json
import re
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = PROJECT_ROOT / "contracts" / "safety_goal_allocations.json"
ALLOC_PATH = PROJECT_ROOT / "contracts" / "trlc_unit_allocations.json"
REPORT_DIR = PROJECT_ROOT / "reports"
REPORT_DIR.mkdir(exist_ok=True)

REQ_RE = re.compile(
    r'//\s*(\d{5,})[^\n]*\n\s*IPF\.Requirement\s+Acpd\1\s*\{(?P<body>.*?)\n\}',
    re.DOTALL,
)
ASIL_RE = re.compile(r'\basil\s*=\s*"([^"]+)"')
TRLC_TRACE_RE = re.compile(r'//\s*trlc-satisfies:\s*(\d{5,})')


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"ERROR: Missing file: {path.relative_to(PROJECT_ROOT)}")
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"ERROR: Invalid JSON in {path.relative_to(PROJECT_ROOT)}: {exc}")
        sys.exit(1)


def collect_asil_requirements(req_path: Path):
    text = req_path.read_text(encoding="utf-8", errors="replace")
    reqs = {}
    for match in REQ_RE.finditer(text):
        req_id = match.group(1)
        body = match.group("body")
        asil_match = ASIL_RE.search(body)
        if asil_match:
            reqs[req_id] = {
                "asil": asil_match.group(1),
                "line": text[: match.start()].count("\n") + 1,
                "file": str(req_path.relative_to(PROJECT_ROOT)),
            }
    return reqs


def collect_requirement_traces(unit_to_file):
    """Return req_id -> set(unit names) and req_id -> set(file names) from real SysML trlc-satisfies comments."""
    req_to_units = {}
    req_to_files = {}
    file_status = {}
    for unit, rel_file in unit_to_file.items():
        path = PROJECT_ROOT / rel_file
        if not path.exists():
            file_status[unit] = {"missing_file": True, "file": rel_file}
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        ids = set(TRLC_TRACE_RE.findall(text))
        file_status[unit] = {"missing_file": False, "file": rel_file, "traced_ids": ids}
        for req_id in ids:
            req_to_units.setdefault(req_id, set()).add(unit)
            req_to_files.setdefault(req_id, set()).add(rel_file)
    return req_to_units, req_to_files, file_status


def write_report(contract, asil_reqs, req_to_goals, goal_to_units, req_to_units, problems, warnings):
    report_path = REPORT_DIR / "safety_goal_coverage.md"
    goals = contract.get("safety_goals", {})

    lines = []
    lines.append("# AcpdCdd Safety Goal Coverage Report")
    lines.append("")
    lines.append(f"Generated: {datetime.now().isoformat(timespec='seconds')}")
    lines.append("")
    lines.append(f"Result: {'PASS' if not problems else 'FAIL'}")
    lines.append("")
    lines.append("## Traceability strategy")
    lines.append("")
    lines.append("Safety goals are linked only to ASIL-tagged TRLC requirement IDs. SysML component/file support is derived from the existing `// trlc-satisfies: <id>` comments in the model. No direct `// safety-goal:` comments are required in SysML files.")
    lines.append("")
    lines.append(f"ASIL-tagged AcpdCdd requirements: {len(asil_reqs)}")
    lines.append(f"Safety goals: {len(goals)}")
    lines.append(f"Covered ASIL requirements: {len(req_to_goals)} / {len(asil_reqs)}")
    lines.append("")

    lines.append("## Safety goals with derived component support")
    lines.append("")
    for goal_id, goal in sorted(goals.items()):
        units = sorted(goal_to_units.get(goal_id, []))
        lines.append(f"### {goal_id} — {goal.get('title', '-')}")
        lines.append("")
        lines.append(f"ASIL: {goal.get('asil', '-')}")
        lines.append("")
        lines.append("Covered requirements: " + ", ".join(goal.get("covered_requirements", [])))
        lines.append("")
        lines.append("Derived SysML support: " + (", ".join(units) if units else "MISSING"))
        lines.append("")

    lines.append("## ASIL requirement coverage")
    lines.append("")
    lines.append("| Requirement | ASIL | Safety goal(s) | Derived SysML unit(s) |")
    lines.append("|---|---:|---|---|")
    for req_id in sorted(asil_reqs, key=int):
        goals_for_req = ", ".join(sorted(req_to_goals.get(req_id, []))) or "MISSING"
        units_for_req = ", ".join(sorted(req_to_units.get(req_id, []))) or "NO SYSML TRACE"
        lines.append(f"| {req_id} | {asil_reqs[req_id]['asil']} | {goals_for_req} | {units_for_req} |")
    lines.append("")

    lines.append("## Problems")
    lines.append("")
    if problems:
        for p in problems:
            lines.append(f"- {p}")
    else:
        lines.append("None.")
    lines.append("")

    lines.append("## Warnings")
    lines.append("")
    if warnings:
        for w in warnings:
            lines.append(f"- {w}")
    else:
        lines.append("None.")
    lines.append("")

    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def main():
    contract = load_json(CONTRACT_PATH)
    alloc = load_json(ALLOC_PATH)
    req_path = PROJECT_ROOT / contract.get("requirements_source", "requirements/trlc_AccPdCdd.trlc")
    if not req_path.exists():
        print(f"ERROR: Missing requirements source: {req_path.relative_to(PROJECT_ROOT)}")
        return 1

    asil_reqs = collect_asil_requirements(req_path)
    goals = contract.get("safety_goals", {})
    unit_to_file = alloc.get("unit_to_sysml_file", {})
    req_to_units, req_to_files, file_status = collect_requirement_traces(unit_to_file)

    problems = []
    warnings = []
    req_to_goals = {}
    goal_to_units = {}

    if not goals:
        problems.append("No safety goals are defined in contracts/safety_goal_allocations.json.")

    for unit, info in file_status.items():
        if info.get("missing_file"):
            problems.append(f"Mapped SysML file for unit '{unit}' is missing: {info.get('file')}")

    for goal_id, goal in sorted(goals.items()):
        goal_asil = goal.get("asil")
        covered = goal.get("covered_requirements", [])
        if not goal_asil:
            problems.append(f"{goal_id} has no ASIL.")
        if not covered:
            problems.append(f"{goal_id} covers no requirements.")

        units = set()
        for req_id in covered:
            if req_id not in asil_reqs:
                problems.append(f"{goal_id} references requirement {req_id}, but it is not present as an ASIL-tagged AcpdCdd requirement.")
                continue
            req_to_goals.setdefault(req_id, set()).add(goal_id)
            units.update(req_to_units.get(req_id, set()))
            if goal_asil and asil_reqs[req_id]["asil"] != goal_asil:
                warnings.append(
                    f"{goal_id} has ASIL {goal_asil}, but linked requirement {req_id} has ASIL {asil_reqs[req_id]['asil']}."
                )
            if req_id not in req_to_units:
                problems.append(
                    f"{goal_id} covers requirement {req_id}, but no SysML `// trlc-satisfies: {req_id}` trace was found in mapped unit files."
                )
        goal_to_units[goal_id] = units
        if not units:
            problems.append(f"{goal_id} has no derived SysML component/file support from its covered requirements.")

    missing_asil_reqs = sorted(set(asil_reqs) - set(req_to_goals), key=int)
    for req_id in missing_asil_reqs:
        problems.append(f"ASIL-tagged requirement {req_id} is not covered by any safety goal.")

    report = write_report(contract, asil_reqs, req_to_goals, goal_to_units, req_to_units, problems, warnings)

    print("=== SAFETY GOAL COVERAGE CHECK ===")
    print(f"Result: {'PASS' if not problems else 'FAIL'}")
    print(f"ASIL-tagged requirements: {len(asil_reqs)}")
    print(f"Safety goals: {len(goals)}")
    print(f"Covered ASIL requirements: {len(req_to_goals)} / {len(asil_reqs)}")
    print("Trace strategy: SG -> TRLC requirement IDs -> SysML trlc-satisfies comments -> derived units")
    print(f"Report: {report.relative_to(PROJECT_ROOT)}")
    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"  - {warning}")
    if problems:
        print("Problems:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
