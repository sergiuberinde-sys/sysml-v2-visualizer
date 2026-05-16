import json
import re
import sys
from pathlib import Path
from html import escape
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTRACT_FILE = PROJECT_ROOT / "contracts" / "component_interaction_contracts.json"
SEQUENCE_FILE = PROJECT_ROOT / "14_ComponentInteractionSequences.sysml"
REPORT_DIR = PROJECT_ROOT / "reports"
REPORT_DIR.mkdir(exist_ok=True)

PART_DEF_RE = re.compile(r'part\s+def\s+(AcpdCdd_[A-Za-z0-9_]+_Sequence)\s*\{', re.MULTILINE)
MESSAGE_RE = re.compile(
    r'\bmessage\s+([A-Za-z_][A-Za-z0-9_]*)\s+from\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s+to\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*;',
    re.MULTILINE,
)

def find_matching_brace(text, open_brace_index):
    depth = 0
    for i in range(open_brace_index, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return i
    raise ValueError("Unbalanced braces")

def parse_sequences():
    text = SEQUENCE_FILE.read_text(encoding="utf-8")
    sequences = {}
    for match in PART_DEF_RE.finditer(text):
        name = match.group(1)
        open_idx = text.find("{", match.end() - 1)
        close_idx = find_matching_brace(text, open_idx)
        block = text[open_idx:close_idx + 1]
        messages = []
        for m in MESSAGE_RE.finditer(block):
            msg, src, src_event, tgt, tgt_event = m.groups()
            messages.append([msg, src, tgt])
        sequences[name] = messages
    return sequences

def write_report(result, errors, parsed):
    path = REPORT_DIR / "component_interaction_contract_report.html"
    rows = []
    for seq, msgs in parsed.items():
        for msg, src, tgt in msgs:
            rows.append(f"<tr><td>{escape(seq)}</td><td>{escape(msg)}</td><td>{escape(src)} → {escape(tgt)}</td></tr>")
    error_rows = "".join(
        f"<tr><td>{escape(e[0])}</td><td>{escape(e[1])}</td><td>{escape(e[2])}</td></tr>"
        for e in errors
    ) or '<tr><td colspan="3">None</td></tr>'
    html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Component Interaction Contract Report</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 32px; }}
.pass {{ color: #1b7f37; font-weight: bold; }}
.fail {{ color: #b42318; font-weight: bold; }}
table {{ border-collapse: collapse; width: 100%; margin-top: 16px; }}
th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
th {{ background: #f4f4f4; }}
</style></head><body>
<h1>AcpdCdd Component Interaction Contract Report</h1>
<p>Generated: {escape(datetime.now().isoformat(timespec="seconds"))}</p>
<h2 class="{result.lower()}">Result: {result}</h2>
<h2>Parsed Messages</h2>
<table><thead><tr><th>Sequence</th><th>Message</th><th>Direction</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
<h2>Errors</h2>
<table><thead><tr><th>Sequence</th><th>Message</th><th>Problem</th></tr></thead><tbody>{error_rows}</tbody></table>
</body></html>"""
    path.write_text(html, encoding="utf-8")
    return path

def main():
    expected = json.loads(CONTRACT_FILE.read_text(encoding="utf-8"))["sequences"]
    parsed = parse_sequences()
    errors = []

    for seq_name, exp_msgs in expected.items():
        actual = parsed.get(seq_name)
        if actual is None:
            errors.append([seq_name, "-", "Missing sequence"])
            continue
        if actual != exp_msgs:
            errors.append([seq_name, "*", f"Expected {exp_msgs}, actual {actual}"])

    for seq_name in parsed:
        if seq_name not in expected:
            errors.append([seq_name, "*", "Unexpected sequence"])

    result = "PASS" if not errors else "FAIL"
    report = write_report(result, errors, parsed)

    print("=== COMPONENT INTERACTION SEQUENCE CHECK ===")
    print(f"Result: {result}")
    print(f"Expected sequences: {len(expected)}")
    print(f"Parsed sequences: {len(parsed)}")
    print(f"Errors: {len(errors)}")
    print(f"HTML report: {report.relative_to(PROJECT_ROOT)}")
    print()
    for e in errors:
        print(f"{e[0]} / {e[1]}: {e[2]}")
    sys.exit(0 if result == "PASS" else 1)

if __name__ == "__main__":
    main()
