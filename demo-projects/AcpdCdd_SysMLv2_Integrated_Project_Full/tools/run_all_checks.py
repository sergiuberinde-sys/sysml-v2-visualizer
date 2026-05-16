import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

checks = [
    ("TRLC traceability", PROJECT_ROOT / "tools" / "check_traceability.py"),
    ("TRLC unit allocations", PROJECT_ROOT / "tools" / "check_trlc_allocations.py"),
    ("TRLC trace block hygiene", PROJECT_ROOT / "tools" / "check_trace_block_hygiene.py"),
    ("Safety goal coverage", PROJECT_ROOT / "tools" / "check_safety_goal_coverage.py"),
    ("Safety evidence matrix", PROJECT_ROOT / "tools" / "check_safety_evidence_matrix.py"),
    ("Safety analysis traceability", PROJECT_ROOT / "tools" / "check_safety_analysis_traceability.py"),
    ("Runtime interaction contracts", PROJECT_ROOT / "tools" / "check_runtime_interaction_contracts.py"),
    ("Component dataflows", PROJECT_ROOT / "tools" / "check_component_dataflows.py"),
    ("Typed ports", PROJECT_ROOT / "tools" / "check_typed_ports.py"),
    ("Typed parts", PROJECT_ROOT / "tools" / "check_typed_parts.py"),
    ("Typed items", PROJECT_ROOT / "tools" / "check_typed_items.py"),
    ("Conditional behavior views", PROJECT_ROOT / "tools" / "check_conditional_behavior_views.py"),
    ("SysML safety analysis experiment", PROJECT_ROOT / "tools" / "check_sysml_safety_analysis_experiment.py"),
    ("Component interaction sequences", PROJECT_ROOT / "tools" / "check_component_interaction_sequences.py"),
]

failed = False
for name, script in checks:
    print(f"\n=== Running {name} ===")
    result = subprocess.run([sys.executable, str(script)], cwd=PROJECT_ROOT)
    if result.returncode != 0:
        failed = True

print("\n=== SUMMARY ===")
if failed:
    print("One or more checks failed.")
    sys.exit(1)

print("All checks passed.")
sys.exit(0)
