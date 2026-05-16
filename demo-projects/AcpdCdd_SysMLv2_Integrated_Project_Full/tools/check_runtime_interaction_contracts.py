#!/usr/bin/env python3
"""Validate runtime interactions against SysML v2 interaction contracts.

Source of truth:
- 12_DynamicInteractionSequences.sysml contains the modeled runtime messages.
- 17_RuntimeInteractionContracts.sysml contains the expected interaction contracts.
- 00_Types.sysml contains the payload item definitions.

No runtime interaction JSON contract is required.
"""
from __future__ import annotations

import re
from pathlib import Path
from html import escape
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SEQUENCE_FILE = PROJECT_ROOT / "12_DynamicInteractionSequences.sysml"
CONTRACT_FILE = PROJECT_ROOT / "17_RuntimeInteractionContracts.sysml"
TYPES_FILE = PROJECT_ROOT / "00_Types.sysml"
REPORT_DIR = PROJECT_ROOT / "reports"
REPORT_DIR.mkdir(exist_ok=True)

MESSAGE_RE = re.compile(
    r'\bmessage\s+([A-Za-z_][A-Za-z0-9_]*)\s+from\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s+to\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*;',
    re.MULTILINE,
)

FIELD_RE = re.compile(r"//\s*([a-zA-Z0-9_-]+):\s*(.*)")
ITEM_RE = re.compile(r"\bitem\s+([A-Za-z_][A-Za-z0-9_]*)_contract\s*:\s*RuntimeInteractionContract")

LIFELINE_TO_COMPONENT = {
    "adc": "ADC",
    "adcBist": "AdcBist",
    "rte": "RTE",
    "acpdCdd": "AcpdCdd",
    "acpdCddInput": "AcpdCdd_Input",
    "acpdCddProcess": "AcpdCdd_Process",
    "acpdCddPowermanagement": "AcpdCdd_Powermanagement",
    "acpdCddMonitoring": "AcpdCdd_Monitoring",
    "acpdCddOutput": "AcpdCdd_Output",
}


def parse_defined_item_types() -> set[str]:
    text = TYPES_FILE.read_text(encoding="utf-8")
    return set(re.findall(r'\bitem\s+def\s+([A-Za-z_][A-Za-z0-9_]*)\b', text))


def parse_sysml_contracts() -> dict:
    text = CONTRACT_FILE.read_text(encoding="utf-8")
    contracts = []
    current = {}

    for line in text.splitlines():
        field = FIELD_RE.search(line)
        if field:
            current[field.group(1).strip()] = field.group(2).strip()
            continue

        item = ITEM_RE.search(line)
        if item and current.get("interaction-contract"):
            contracts.append({
                "message": current["interaction-contract"],
                "sequence_index": int(current.get("sequence-index", "0")),
                "from": current.get("from", ""),
                "to": current.get("to", ""),
                "caller_port": current.get("caller-port", ""),
                "callee_port": current.get("callee-port", ""),
                "operation": current.get("operation", ""),
                "operation_owner": current.get("operation-owner", ""),
                "payload_type": current.get("payload-type", ""),
            })
            current = {}

    return {"contracts": sorted(contracts, key=lambda c: c["sequence_index"])}


def validate_payload_types(model: dict) -> list[dict]:
    defined_types = parse_defined_item_types()
    errors = []
    for contract in model.get("contracts", []):
        payload_type = contract.get("payload_type")
        if not payload_type:
            errors.append({
                "message": contract.get("message", "-"),
                "problem": "missing payload_type",
                "details": "SysML interaction contract does not declare a payload type.",
            })
        elif payload_type not in defined_types:
            errors.append({
                "message": contract.get("message", "-"),
                "problem": "unknown payload_type",
                "details": f"Payload type {payload_type} is not defined as an item def in 00_Types.sysml.",
            })
    return errors


def parse_sequence_messages() -> list[dict]:
    text = SEQUENCE_FILE.read_text(encoding="utf-8")
    parsed = []
    for match in MESSAGE_RE.finditer(text):
        msg, src_life, src_event, tgt_life, tgt_event = match.groups()
        parsed.append({
            "message": msg,
            "from_lifeline": src_life,
            "from_component": LIFELINE_TO_COMPONENT.get(src_life, src_life),
            "from_event": src_event,
            "to_lifeline": tgt_life,
            "to_component": LIFELINE_TO_COMPONENT.get(tgt_life, tgt_life),
            "to_event": tgt_event,
            "line": text[:match.start()].count("\n") + 1,
        })
    return parsed


def write_html_report(result, checks, missing_messages, extra_messages, order_errors, contract_errors):
    path = REPORT_DIR / "runtime_interaction_contract_report.html"

    def rows(items):
        if not items:
            return '<tr><td colspan="3">None</td></tr>'
        return "".join(
            "<tr>"
            f"<td>{escape(item.get('message', '-'))}</td>"
            f"<td>{escape(item.get('problem', '-'))}</td>"
            f"<td>{escape(item.get('details', '-'))}</td>"
            "</tr>"
            for item in items
        )

    checked_rows = "".join(
        "<tr>"
        f"<td>{escape(chk['message'])}</td>"
        f"<td>{escape(chk['from_component'])} → {escape(chk['to_component'])}</td>"
        f"<td>{escape(chk.get('payload_type', '-'))}</td>"
        f"<td>{escape(chk['status'])}</td>"
        "</tr>"
        for chk in checks
    )

    html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>AcpdCdd Runtime Interaction Contract Report</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 32px; color: #222; }}
.pass {{ color: #1b7f37; font-weight: bold; }}
.fail {{ color: #b42318; font-weight: bold; }}
table {{ border-collapse: collapse; width: 100%; margin-top: 16px; }}
th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }}
th {{ background: #f4f4f4; }}
</style>
</head>
<body>
<h1>AcpdCdd Runtime Interaction Contract Report</h1>
<p>Generated: {escape(datetime.now().isoformat(timespec="seconds"))}</p>
<h2 class="{result.lower()}">Result: {result}</h2>
<p>Validated sequence messages against SysML v2 runtime interaction contracts and payload types.</p>
<h2>Checked Messages</h2>
<table>
<thead><tr><th>Message</th><th>Direction</th><th>Payload Type</th><th>Status</th></tr></thead>
<tbody>{checked_rows}</tbody>
</table>
<h2>Missing Messages</h2>
<table><thead><tr><th>Message</th><th>Problem</th><th>Details</th></tr></thead><tbody>{rows(missing_messages)}</tbody></table>
<h2>Extra Messages</h2>
<table><thead><tr><th>Message</th><th>Problem</th><th>Details</th></tr></thead><tbody>{rows(extra_messages)}</tbody></table>
<h2>Order Errors</h2>
<table><thead><tr><th>Message</th><th>Problem</th><th>Details</th></tr></thead><tbody>{rows(order_errors)}</tbody></table>
<h2>Contract Errors</h2>
<table><thead><tr><th>Message</th><th>Problem</th><th>Details</th></tr></thead><tbody>{rows(contract_errors)}</tbody></table>
</body>
</html>
"""
    path.write_text(html, encoding="utf-8")
    return path


def main() -> int:
    model = parse_sysml_contracts()
    expected = model["contracts"]
    expected_by_message = {c["message"]: c for c in expected}
    expected_order = [c["message"] for c in expected]

    actual = parse_sequence_messages()
    actual_by_message = {m["message"]: m for m in actual}
    actual_order = [m["message"] for m in actual]

    missing_messages = []
    extra_messages = []
    order_errors = []
    contract_errors = validate_payload_types(model)
    checks = []

    for message in expected_order:
        if message not in actual_by_message:
            missing_messages.append({
                "message": message,
                "problem": "Expected message missing from sequence",
                "details": "Declared in 17_RuntimeInteractionContracts.sysml but not found in 12_DynamicInteractionSequences.sysml",
            })

    for message in actual_order:
        if message not in expected_by_message:
            extra_messages.append({
                "message": message,
                "problem": "Undeclared runtime interaction",
                "details": "Found in sequence but not declared in 17_RuntimeInteractionContracts.sysml",
            })

    common_actual_order = [m for m in actual_order if m in expected_by_message]
    common_expected_order = [m for m in expected_order if m in actual_by_message]
    if common_actual_order != common_expected_order:
        order_errors.append({
            "message": "AcpdCdd_Runtime_Sequence",
            "problem": "Message order mismatch",
            "details": f"Expected {common_expected_order}, actual {common_actual_order}",
        })

    for seq_msg in actual:
        message = seq_msg["message"]
        if message not in expected_by_message:
            continue

        contract = expected_by_message[message]
        status = "OK"
        details = []

        if seq_msg["from_component"] != contract["from"]:
            details.append(f"caller component expected {contract['from']}, actual {seq_msg['from_component']}")

        if seq_msg["to_component"] != contract["to"]:
            details.append(f"callee component expected {contract['to']}, actual {seq_msg['to_component']}")

        if not contract.get("caller_port"):
            details.append("missing caller-port in SysML contract")
        if not contract.get("callee_port"):
            details.append("missing callee-port in SysML contract")
        if not contract.get("operation"):
            details.append("missing operation in SysML contract")
        if not contract.get("operation_owner"):
            details.append("missing operation-owner in SysML contract")

        if details:
            status = "ERROR"
            contract_errors.append({
                "message": message,
                "problem": "Contract mismatch",
                "details": "; ".join(details),
            })

        checks.append({
            "message": message,
            "from_component": seq_msg["from_component"],
            "to_component": seq_msg["to_component"],
            "payload_type": contract.get("payload_type", "-"),
            "status": status,
        })

    result = "PASS" if not (missing_messages or extra_messages or order_errors or contract_errors) else "FAIL"
    report_path = write_html_report(result, checks, missing_messages, extra_messages, order_errors, contract_errors)

    print("=== RUNTIME INTERACTION CONTRACT CHECK ===")
    print(f"Result: {result}")
    print("Contract source: 17_RuntimeInteractionContracts.sysml")
    print(f"Expected messages: {len(expected_order)}")
    print(f"Actual messages: {len(actual_order)}")
    print(f"Missing messages: {len(missing_messages)}")
    print(f"Extra messages: {len(extra_messages)}")
    print(f"Order errors: {len(order_errors)}")
    print(f"Contract errors: {len(contract_errors)}")
    print(f"Payload type checks: {len(expected)}")
    print(f"HTML report: {report_path.relative_to(PROJECT_ROOT)}")
    print()

    for group_name, group in [
        ("Missing messages", missing_messages),
        ("Extra messages", extra_messages),
        ("Order errors", order_errors),
        ("Contract errors", contract_errors),
    ]:
        if group:
            print(group_name + ":")
            for item in group:
                print(f"  {item['message']}: {item['problem']} - {item['details']}")
            print()

    return 0 if result == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
