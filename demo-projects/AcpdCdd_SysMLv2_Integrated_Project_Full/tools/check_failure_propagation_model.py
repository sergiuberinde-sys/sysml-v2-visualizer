from pathlib import Path
import re
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROP_FILE = PROJECT_ROOT / "15_FailurePropagation.sysml"
SYSML_FILES = list(PROJECT_ROOT.glob("*.sysml"))

errors = []

if not PROP_FILE.exists():
    errors.append("missing 15_FailurePropagation.sysml")
else:
    text = PROP_FILE.read_text(encoding="utf-8", errors="replace")
    if "private import CauseAndEffect::*;" not in text:
        errors.append("15_FailurePropagation.sysml does not import CauseAndEffect::*")
    event_count = len(re.findall(r"\bevent\s+occurrence\b", text))
    causation_count = len(re.findall(r"#causation\s+connect", text))
    multicausation_count = len(re.findall(r"#multicausation\s+connection", text))
    if event_count < 8:
        errors.append(f"expected at least 8 failure/effect event occurrences, found {event_count}")
    if causation_count < 5:
        errors.append(f"expected at least 5 #causation links, found {causation_count}")
    if multicausation_count < 1:
        errors.append("expected at least one #multicausation connection")

for path in SYSML_FILES:
    text = path.read_text(encoding="utf-8", errors="replace")
    if "ActionFailureModeKind" in text or re.search(r"failureMode_\w+", text):
        errors.append(f"{path.name}: still contains old behavior-owned failureMode artifacts")
    if "item def FmeaEntry" in text or "FMEA_Index" in text:
        errors.append(f"{path.name}: still contains old FMEA-entry/index artifacts")

if (PROJECT_ROOT / "15_FMEA.sysml").exists():
    errors.append("old 15_FMEA.sysml still exists")

if errors:
    print("Failure propagation model check FAILED:")
    for e in errors:
        print(f"- {e}")
    sys.exit(1)

print("Failure propagation model check passed.")
print(f"- event occurrences: {event_count}")
print(f"- causation links: {causation_count}")
print(f"- multicausation links: {multicausation_count}")
sys.exit(0)
