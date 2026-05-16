import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTRACT_FILE = PROJECT_ROOT / "contracts" / "trlc_unit_allocations.json"
TRACE_RE = re.compile(r'//\s*trlc-satisfies:\s*([A-Za-z_][A-Za-z0-9_]*|\d{5,})')

def main():
    contract = json.loads(CONTRACT_FILE.read_text(encoding="utf-8"))
    allocation = contract.get("active_allocation_traced_in_sysml", contract["allocation"])
    missing_from_trlc = contract.get("allocation_ids_missing_from_uploaded_trlc", {})

    traces_by_file = {}
    for file in PROJECT_ROOT.glob("*.sysml"):
        text = file.read_text(encoding="utf-8", errors="replace")
        traces_by_file[file.name] = set(TRACE_RE.findall(text))

    errors = []
    for unit, ids in allocation.items():
        target_file = contract["unit_to_sysml_file"].get(unit)
        if not target_file:
            errors.append(f"No SysML target file configured for unit {unit}")
            continue
        actual = traces_by_file.get(target_file, set())
        for rid in ids:
            if rid not in actual:
                errors.append(f"{rid} allocated to {unit} but not traced in {target_file}")

    print("=== TRLC UNIT ALLOCATION CHECK ===")
    if errors:
        print("Result: FAIL")
        for e in errors:
            print("  " + e)
        sys.exit(1)

    print("Result: PASS")
    print(f"Units checked: {len(allocation)}")
    print("All allocated requirements present in the uploaded TRLC file are traced in their target SysML files.")

    total_missing = sum(len(v) for v in missing_from_trlc.values())
    if total_missing:
        print()
        print(f"WARNING: {total_missing} allocated requirement IDs were not found in the uploaded TRLC file and were not traced:")
        for unit, ids in missing_from_trlc.items():
            print(f"  {unit}: {', '.join(ids)}")

    sys.exit(0)

if __name__ == "__main__":
    main()
