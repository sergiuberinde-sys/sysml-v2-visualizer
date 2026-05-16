#!/usr/bin/env python3
"""Validate that architectural/component ports use declared port definitions.

This is a project enforcement checker, not the official OMG language validator.
It verifies that reusable architectural nodes expose typed ports and that
component dataflow endpoints resolve through typed part usages to typed ports.
"""
from __future__ import annotations
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REPORT = PROJECT_ROOT / "reports" / "typed_ports.md"

PORT_DEF_RE = re.compile(r'\bport\s+def\s+([A-Za-z_][A-Za-z0-9_]*)\b')
PORT_USAGE_RE = re.compile(r'\bport\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([A-Za-z_][A-Za-z0-9_]*))?\s*;')
PART_DEF_RE = re.compile(r'\bpart\s+def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{(?P<body>.*?)\n\s*\}', re.DOTALL)
PART_USAGE_TYPED_RE = re.compile(r'\bpart\s+([A-Za-z_][A-Za-z0-9_]*)(?:\[[^\]]+\])?\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*;')
FLOW_RE = re.compile(
    r'\bflow\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*'
    r'from\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*'
    r'to\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*;',
    re.MULTILINE,
)

TARGET_FILES = [
    "02_Input.sysml",
    "03_Process.sysml",
    "04_Powermanagement.sysml",
    "05_Monitoring.sysml",
    "06_Output.sysml",
    "13_InterfaceContracts.sysml",
    "18_ComponentDataflows.sysml",
]

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")

def collect_port_defs() -> set[str]:
    defs = set()
    for path in PROJECT_ROOT.glob("*.sysml"):
        defs.update(PORT_DEF_RE.findall(read(path)))
    return defs

def collect_part_def_ports(text: str) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for pm in PART_DEF_RE.finditer(text):
        part_def_name = pm.group(1)
        body = pm.group("body")
        ports: dict[str, str] = {}
        for m in PORT_USAGE_RE.finditer(body):
            name, typ = m.groups()
            prefix = body[max(0, m.start()-12):m.start()]
            if "def " in prefix:
                continue
            if typ:
                ports[name] = typ
        result[part_def_name] = ports
    return result

def main() -> int:
    errors: list[str] = []
    port_defs = collect_port_defs()

    for filename in TARGET_FILES:
        path = PROJECT_ROOT / filename
        if not path.exists():
            continue
        text = read(path)
        for m in PORT_USAGE_RE.finditer(text):
            port_name, port_type = m.groups()
            line = text[:m.start()].count("\n") + 1
            prefix = text[max(0, m.start()-12):m.start()]
            if "def " in prefix:
                continue
            if not port_type:
                errors.append(f"{filename}:{line}: port {port_name} is untyped")
            elif port_type not in port_defs:
                errors.append(f"{filename}:{line}: port {port_name} uses unknown port def {port_type}")

    # Strong endpoint check for 18_ComponentDataflows.sysml:
    # each flow endpoint must resolve as part usage -> part def -> typed port.
    dataflow = PROJECT_ROOT / "18_ComponentDataflows.sysml"
    if dataflow.exists():
        text = read(dataflow)
        part_def_ports = collect_part_def_ports(text)
        usage_types = {name: typ for name, typ in PART_USAGE_TYPED_RE.findall(text)}

        for flow_name, flow_type, src_part, src_port, dst_part, dst_port in FLOW_RE.findall(text):
            for role, part_name, port_name in [
                ("source", src_part, src_port),
                ("target", dst_part, dst_port),
            ]:
                if part_name not in usage_types:
                    errors.append(f"18_ComponentDataflows.sysml: flow {flow_name} {role} part {part_name} is not a typed part usage")
                    continue
                part_type = usage_types[part_name]
                ports = part_def_ports.get(part_type)
                if ports is None:
                    errors.append(f"18_ComponentDataflows.sysml: flow {flow_name} {role} part {part_name} uses unknown part def {part_type}")
                    continue
                if port_name not in ports:
                    errors.append(f"18_ComponentDataflows.sysml: flow {flow_name} {role} port {part_name}.{port_name} is not declared by part def {part_type}")

    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(
        "# Typed Port Check\n\n"
        + ("Result: PASS\n" if not errors else "Result: FAIL\n\n" + "\n".join(f"- {e}" for e in errors) + "\n")
        + f"\nPort definitions found: {len(port_defs)}\n",
        encoding="utf-8",
    )

    print("Typed ports: " + ("PASS" if not errors else "FAIL"))
    print(f"Port definitions found: {len(port_defs)}")
    print(f"Report written to {REPORT.relative_to(PROJECT_ROOT)}")
    if errors:
        for e in errors:
            print("- " + e)
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
