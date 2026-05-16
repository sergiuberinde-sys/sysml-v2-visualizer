import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MATRIX = PROJECT_ROOT / "contracts" / "safety_evidence_matrix.json"
TRLC = PROJECT_ROOT / "requirements" / "trlc_AccPdCdd.trlc"
REPORT = PROJECT_ROOT / "reports" / "safety_evidence_matrix.md"
ALLOWED = {"TRACED_ONLY", "ALLOCATED", "BEHAVIOR_MODELED", "INTERACTION_MODELED", "GAP"}

REQ_RE = re.compile(r"//\s*(\d+)[^\n]*\n\s*IPF\.Requirement\s+\w+\s*\{.*?asil\s*=\s*\"([A-Z]+)\"", re.S)

def read_req_ids():
    text = TRLC.read_text(encoding="utf-8")
    return {rid: asil for rid, asil in REQ_RE.findall(text)}

def main():
    errors = []
    reqs = read_req_ids()
    data = json.loads(MATRIX.read_text(encoding="utf-8"))
    entries = data.get("entries", [])
    by_id = {e.get("requirement_id"): e for e in entries}

    asil_reqs = {rid: asil for rid, asil in reqs.items() if asil and asil != "QM"}

    missing = sorted(set(asil_reqs) - set(by_id))
    extra = sorted(set(by_id) - set(reqs))
    if missing:
        errors.append("ASIL requirements missing from safety evidence matrix: " + ", ".join(missing))
    if extra:
        errors.append("Matrix contains requirement IDs not present in TRLC: " + ", ".join(extra))

    for rid, entry in sorted(by_id.items()):
        status = entry.get("evidence_status")
        if status not in ALLOWED:
            errors.append(f"{rid}: invalid evidence_status {status!r}")
        if not entry.get("safety_concern"):
            errors.append(f"{rid}: missing safety_concern")
        if not entry.get("rationale"):
            errors.append(f"{rid}: missing rationale")
        if reqs.get(rid) != entry.get("asil"):
            errors.append(f"{rid}: ASIL mismatch matrix={entry.get('asil')} trlc={reqs.get(rid)}")
        refs = entry.get("evidence_refs", [])
        if status in {"BEHAVIOR_MODELED", "INTERACTION_MODELED"} and not refs:
            errors.append(f"{rid}: {status} requires at least one evidence_ref")
        for ref in refs:
            f = ref.get("file")
            if not f or not (PROJECT_ROOT / f).exists():
                errors.append(f"{rid}: evidence_ref file missing: {f}")
            if not ref.get("claim"):
                errors.append(f"{rid}: evidence_ref missing claim")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    status_order = ["INTERACTION_MODELED", "BEHAVIOR_MODELED", "ALLOCATED", "TRACED_ONLY", "GAP"]
    counts = {s: 0 for s in status_order}
    for e in entries:
        counts[e.get("evidence_status")] = counts.get(e.get("evidence_status"), 0) + 1
    lines = []
    lines.append("# Safety Evidence Matrix Report")
    lines.append("")
    lines.append("This report is intentionally evidence-based. It does not introduce new safety behavior; it classifies the evidence already present in the current TRLC/SysML project.")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    for s in status_order:
        lines.append(f"- {s}: {counts.get(s, 0)}")
    lines.append("")
    lines.append("## Requirement Evidence")
    lines.append("")
    lines.append("| Requirement | ASIL | Safety Goals | Units | Status | Safety concern |")
    lines.append("|---|---:|---|---|---|---|")
    for e in sorted(entries, key=lambda x: x["requirement_id"]):
        lines.append("| {rid} | {asil} | {sg} | {units} | {st} | {concern} |".format(
            rid=e["requirement_id"], asil=e["asil"], sg=", ".join(e.get("safety_goals", [])) or "-",
            units=", ".join(e.get("allocated_units", [])) or "-", st=e["evidence_status"],
            concern=e["safety_concern"].replace("|", "/")
        ))
    lines.append("")
    lines.append("## Important interpretation")
    lines.append("")
    lines.append("- `INTERACTION_MODELED` means a current SysML message sequence or runtime interaction supports the requirement-level interaction claim.")
    lines.append("- `BEHAVIOR_MODELED` means current SysML actions/behavior naming plus trace allocation support the requirement-level behavior claim.")
    lines.append("- `ALLOCATED` / `TRACED_ONLY` are weaker evidence states and should not be presented as behavioral proof.")
    lines.append("- This report is not code verification and not a vehicle-level HARA. It is MBSE evidence governance for the available AcpdCdd model.")
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    if errors:
        print("Safety evidence matrix: FAIL")
        for e in errors:
            print(" - " + e)
        return 1
    print("Safety evidence matrix: PASS")
    print(f"Report written to {REPORT.relative_to(PROJECT_ROOT)}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
