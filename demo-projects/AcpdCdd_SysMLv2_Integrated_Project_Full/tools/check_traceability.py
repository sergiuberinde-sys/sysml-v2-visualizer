import re
from pathlib import Path
import sys
from html import escape
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REQ_DIR = PROJECT_ROOT / "requirements"
REPORT_DIR = PROJECT_ROOT / "reports"
REPORT_DIR.mkdir(exist_ok=True)

TRACE_RE = re.compile(r'//\s*trlc-satisfies:\s*([A-Za-z_][A-Za-z0-9_]*|\d{5,})')

def collect_trlc_requirements():
    requirements = {}

    for file in sorted(REQ_DIR.glob("*.trlc")):
        if file.name.endswith(".example.trlc"):
            continue
        text = file.read_text(encoding="utf-8", errors="replace")

        # Real uploaded format:
        # // 28596119
        # IPF.Requirement Acpd28596119
        for match in re.finditer(r'//\s*(\d{5,})[^\n]*\n\s*IPF\.Requirement\s+Acpd\1\b', text):
            req_id = match.group(1)
            requirements[req_id] = {
                "id": req_id,
                "file": str(file.relative_to(PROJECT_ROOT)),
                "line": text[:match.start()].count("\n") + 1,
            }

        # Fallback: IPF.Requirement Acpd12345678
        for match in re.finditer(r'\bIPF\.Requirement\s+Acpd(\d{5,})\b', text):
            req_id = match.group(1)
            requirements.setdefault(req_id, {
                "id": req_id,
                "file": str(file.relative_to(PROJECT_ROOT)),
                "line": text[:match.start()].count("\n") + 1,
            })

        # Fallback for old demo format
        for match in re.finditer(r'\b([A-Za-z_][A-Za-z0-9_]*|\d{5,})\s+Requirement\s*\{', text):
            req_id = match.group(1)
            if req_id not in {"Requirement", "ASIL", "RequirementKind"}:
                requirements.setdefault(req_id, {
                    "id": req_id,
                    "file": str(file.relative_to(PROJECT_ROOT)),
                    "line": text[:match.start()].count("\n") + 1,
                })

    return requirements

def collect_sysml_traces():
    traces = []
    for file in sorted(PROJECT_ROOT.glob("*.sysml")):
        text = file.read_text(encoding="utf-8", errors="replace")
        for match in TRACE_RE.finditer(text):
            traces.append({
                "req_id": match.group(1),
                "file": str(file.relative_to(PROJECT_ROOT)),
                "line": text[:match.start()].count("\n") + 1,
            })
    return traces

def write_html_report(requirements, traces, missing_coverage, broken_refs, coverage_percent):
    trace_by_req = {}
    for trace in traces:
        trace_by_req.setdefault(trace["req_id"], []).append(trace)

    status = "PASS" if not missing_coverage and not broken_refs else "FAIL"
    report_path = REPORT_DIR / "traceability_report.html"

    rows = []
    for req_id in sorted(requirements, key=lambda x: int(x) if x.isdigit() else x):
        linked = trace_by_req.get(req_id, [])
        coverage = "COVERED" if linked else "MISSING"
        linked_text = "<br>".join(f'{escape(t["file"])}:{t["line"]}' for t in linked) if linked else "-"
        rows.append(
            f"<tr><td>{escape(req_id)}</td><td>{coverage}</td><td>{linked_text}</td></tr>"
        )

    broken_rows = []
    for trace in broken_refs:
        broken_rows.append(f"<tr><td>{escape(trace['req_id'])}</td><td>{escape(trace['file'])}:{trace['line']}</td></tr>")

    html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>AcpdCdd TRLC Traceability Report</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 32px; }}
.pass {{ color: #1b7f37; font-weight: bold; }}
.fail {{ color: #b42318; font-weight: bold; }}
table {{ border-collapse: collapse; width: 100%; margin-top: 16px; }}
th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }}
th {{ background: #f4f4f4; }}
</style></head><body>
<h1>AcpdCdd TRLC Traceability Report</h1>
<p>Generated: {escape(datetime.now().isoformat(timespec="seconds"))}</p>
<h2 class="{status.lower()}">Result: {status}</h2>
<p>Requirements: {len(requirements)} | SysML trace links: {len(traces)} | Coverage: {coverage_percent:.1f}% | Missing: {len(missing_coverage)} | Broken: {len(broken_refs)}</p>
<h2>Requirement Coverage</h2>
<table><thead><tr><th>Requirement</th><th>Status</th><th>Trace Location</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
<h2>Broken SysML References</h2>
<table><thead><tr><th>Referenced Requirement</th><th>Location</th></tr></thead><tbody>{''.join(broken_rows) if broken_rows else '<tr><td colspan="2">None</td></tr>'}</tbody></table>
</body></html>"""
    report_path.write_text(html, encoding="utf-8")
    return report_path

def main():
    requirements = collect_trlc_requirements()
    traces = collect_sysml_traces()
    req_ids = set(requirements)
    covered_ids = {t["req_id"] for t in traces if t["req_id"] in req_ids}
    missing_coverage = sorted(req_ids - covered_ids)
    broken_refs = sorted([t for t in traces if t["req_id"] not in req_ids], key=lambda x: x["req_id"])
    coverage_percent = 100.0 if not requirements else len(covered_ids) / len(requirements) * 100.0
    report = write_html_report(requirements, traces, missing_coverage, broken_refs, coverage_percent)
    result = "PASS" if not missing_coverage and not broken_refs else "FAIL"

    print("=== REQUIREMENTS TRACEABILITY REPORT ===")
    print(f"Result: {result}")
    print(f"Requirements: {len(requirements)}")
    print(f"SysML trace links: {len(traces)}")
    print(f"Coverage: {coverage_percent:.1f}%")
    print(f"Missing coverage: {len(missing_coverage)}")
    print(f"Broken references: {len(broken_refs)}")
    print(f"HTML report: {report.relative_to(PROJECT_ROOT)}")
    print()

    if missing_coverage:
        print("Missing SysML coverage:")
        for rid in missing_coverage[:100]:
            r = requirements[rid]
            print(f"  {rid} ({r['file']}:{r['line']})")
        if len(missing_coverage) > 100:
            print(f"  ... {len(missing_coverage)-100} more")
        print()

    if broken_refs:
        print("Broken SysML references:")
        for t in broken_refs:
            print(f"  {t['req_id']} referenced at {t['file']}:{t['line']}")
        print()

    sys.exit(0 if result == "PASS" else 1)

if __name__ == "__main__":
    main()
