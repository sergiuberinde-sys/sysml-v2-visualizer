import json
import re
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FAILURE_MODES_FILE = PROJECT_ROOT / "requirements" / "failure_modes.trlc"
CONTROL_MEASURES_FILE = PROJECT_ROOT / "requirements" / "control_measures.trlc"
SYSML_FILES = sorted(PROJECT_ROOT.glob("*.sysml"))
OUT_JSON = PROJECT_ROOT / "reports" / "safety_analysis_traceability.json"
OUT_MD = PROJECT_ROOT / "reports" / "safety_analysis_traceability.md"

FM_BLOCK_RE = re.compile(r"(?m)^\s*(?P<name>[A-Za-z_]\w*)\s+FailureMode\s*\{(?P<body>.*?)^\s*\}", re.S)
CM_BLOCK_RE = re.compile(r"(?m)^\s*(?P<name>[A-Za-z_]\w*)\s+ControlMeasure\s*\{(?P<body>.*?)^\s*\}", re.S)
PACKAGE_RE = re.compile(r"(?m)^\s*package\s+(?P<package>[A-Za-z_]\w*)\b")
STRING_FIELD_RE = re.compile(r"(?m)^\s*(?P<field>[A-Za-z_]\w*)\s*=\s*\"(?P<value>.*?)\"", re.S)
ENUM_FIELD_RE = re.compile(r"(?m)^\s*(?P<field>[A-Za-z_]\w*)\s*=\s*(?P<value>[A-Za-z_][\w.]*)\s*$")
FAILURE_MODE_COMMENT_RE = re.compile(r"//\s*trlc-failure-mode:\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)")
BASIC_EVENT_COMMENT_RE = re.compile(r"//\s*safety-basic-event:\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)")
ACTION_DEF_RE = re.compile(r"(?m)^\s*action\s+def\s+(?P<name>[A-Za-z_]\w*)\s*\{")


def package_name(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
    m = PACKAGE_RE.search(text)
    return m.group("package") if m else path.stem


def parse_fields(body: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for m in STRING_FIELD_RE.finditer(body):
        fields[m.group("field")] = re.sub(r"\s+", " ", m.group("value")).strip()
    for m in ENUM_FIELD_RE.finditer(body):
        fields.setdefault(m.group("field"), m.group("value"))
    return fields


def parse_failure_modes() -> dict[str, dict[str, Any]]:
    if not FAILURE_MODES_FILE.exists():
        return {}
    text = FAILURE_MODES_FILE.read_text(encoding="utf-8", errors="replace")
    pkg = package_name(FAILURE_MODES_FILE)
    result: dict[str, dict[str, Any]] = {}
    for m in FM_BLOCK_RE.finditer(text):
        name = m.group("name")
        if name == "type":
            continue
        qid = f"{pkg}.{name}"
        result[qid] = {
            "id": qid,
            "name": name,
            "file": str(FAILURE_MODES_FILE.relative_to(PROJECT_ROOT)),
            "line": text[:m.start()].count("\n") + 1,
            **parse_fields(m.group("body")),
        }
    return result


def parse_control_measures() -> dict[str, dict[str, Any]]:
    if not CONTROL_MEASURES_FILE.exists():
        return {}
    text = CONTROL_MEASURES_FILE.read_text(encoding="utf-8", errors="replace")
    pkg = package_name(CONTROL_MEASURES_FILE)
    result: dict[str, dict[str, Any]] = {}
    for m in CM_BLOCK_RE.finditer(text):
        name = m.group("name")
        if name == "type":
            continue
        qid = f"{pkg}.{name}"
        result[qid] = {
            "id": qid,
            "name": name,
            "file": str(CONTROL_MEASURES_FILE.relative_to(PROJECT_ROOT)),
            "line": text[:m.start()].count("\n") + 1,
            **parse_fields(m.group("body")),
        }
    return result


def find_enclosing_action(text: str, offset: int) -> tuple[str, int] | tuple[None, None]:
    last = None
    for m in ACTION_DEF_RE.finditer(text[:offset]):
        last = (m.group("name"), text[:m.start()].count("\n") + 1)
    return last if last else (None, None)


def parse_sysml_safety_links() -> dict[str, Any]:
    failure_links: dict[str, list[dict[str, Any]]] = {}
    basic_events: dict[str, list[dict[str, Any]]] = {}
    for path in SYSML_FILES:
        text = path.read_text(encoding="utf-8", errors="replace")
        for m in FAILURE_MODE_COMMENT_RE.finditer(text):
            action, action_line = find_enclosing_action(text, m.start())
            qid = m.group(1)
            failure_links.setdefault(qid, []).append({
                "file": path.name,
                "line": text[:m.start()].count("\n") + 1,
                "action_def": action,
                "action_line": action_line,
            })
        for m in BASIC_EVENT_COMMENT_RE.finditer(text):
            action, action_line = find_enclosing_action(text, m.start())
            qid = m.group(1)
            basic_events.setdefault(qid, []).append({
                "file": path.name,
                "line": text[:m.start()].count("\n") + 1,
                "action_def": action,
                "action_line": action_line,
            })
    return {"failure_links": failure_links, "basic_events": basic_events}


def build_model() -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    fms = parse_failure_modes()
    cms = parse_control_measures()
    links = parse_sysml_safety_links()
    failure_links = links["failure_links"]
    basic_events = links["basic_events"]

    if not fms:
        errors.append("No FailureMode records found in requirements/failure_modes.trlc")
    if not cms:
        errors.append("No ControlMeasure records found in requirements/control_measures.trlc")

    for fm_id in sorted(fms):
        if fm_id not in failure_links:
            errors.append(f"FailureMode {fm_id} has no SysML FTA/root-cause link")

    for linked_fm in sorted(failure_links):
        if linked_fm not in fms:
            errors.append(f"SysML references unknown FailureMode {linked_fm}")

    mitigated_by_event: dict[str, list[str]] = {}
    for cm_id, cm in cms.items():
        mitigates = cm.get("mitigates", "")
        if not mitigates:
            errors.append(f"ControlMeasure {cm_id} has no mitigates field")
            continue
        mitigated_by_event.setdefault(mitigates, []).append(cm_id)
        if mitigates not in basic_events:
            errors.append(f"ControlMeasure {cm_id} mitigates unknown BasicEvent {mitigates}")

    for be_id in sorted(basic_events):
        if be_id not in mitigated_by_event:
            errors.append(f"BasicEvent {be_id} has no ControlMeasure")

    model = {
        "purpose": "Placeholder dependability-analysis traceability report for TRLC FailureMode + SysML FTA/basic-event comments + TRLC ControlMeasure records.",
        "failure_modes": fms,
        "control_measures": cms,
        "sysml_failure_links": failure_links,
        "sysml_basic_events": basic_events,
        "basic_event_control_measure_coverage": mitigated_by_event,
        "errors": errors,
    }
    return model, errors


def write_reports(model: dict[str, Any]) -> None:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(model, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    lines: list[str] = []
    lines.append("# Safety Analysis Traceability Report")
    lines.append("")
    lines.append("This is a lightweight placeholder for a Lobster-style dependability traceability check.")
    lines.append("")
    lines.append("Checked chain:")
    lines.append("")
    lines.append("```text")
    lines.append("TRLC FailureMode → SysML FTA/root-cause model → SysML BasicEvent → TRLC ControlMeasure")
    lines.append("```")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Failure modes: {len(model['failure_modes'])}")
    lines.append(f"- SysML failure links: {len(model['sysml_failure_links'])}")
    lines.append(f"- SysML basic events: {len(model['sysml_basic_events'])}")
    lines.append(f"- Control measures: {len(model['control_measures'])}")
    lines.append(f"- Findings: {len(model['errors'])}")
    lines.append("")
    if model["errors"]:
        lines.append("## Findings")
        lines.append("")
        for e in model["errors"]:
            lines.append(f"- {e}")
        lines.append("")
    else:
        lines.append("No traceability gaps detected.")
        lines.append("")

    lines.append("## Failure mode coverage")
    lines.append("")
    lines.append("| Failure mode | Interface | Safety | SysML FTA/root-cause evidence |")
    lines.append("|---|---|---:|---|")
    for fm_id, fm in sorted(model["failure_modes"].items()):
        locations = []
        for link in model["sysml_failure_links"].get(fm_id, []):
            locations.append(f"`{link['file']}:{link['line']}` action `{link.get('action_def') or '-'}`")
        lines.append(f"| `{fm_id}` | {fm.get('interface', '-')} | {fm.get('safety', '-')} | {'<br>'.join(locations) or 'GAP'} |")
    lines.append("")

    lines.append("## Basic event control-measure coverage")
    lines.append("")
    lines.append("| Basic event | SysML evidence | Control measures |")
    lines.append("|---|---|---|")
    for be_id, links in sorted(model["sysml_basic_events"].items()):
        locations = [f"`{x['file']}:{x['line']}` action `{x.get('action_def') or '-'}`" for x in links]
        cms = [f"`{x}`" for x in model["basic_event_control_measure_coverage"].get(be_id, [])]
        lines.append(f"| `{be_id}` | {'<br>'.join(locations) or '-'} | {', '.join(cms) or 'GAP'} |")
    lines.append("")
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    model, errors = build_model()
    write_reports(model)
    if errors:
        print("Safety analysis traceability: FAIL")
        for e in errors:
            print(f"- {e}")
        print(f"Report written to {OUT_MD.relative_to(PROJECT_ROOT)}")
        return 1
    print("Safety analysis traceability: PASS")
    print(f"Report written to {OUT_MD.relative_to(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
