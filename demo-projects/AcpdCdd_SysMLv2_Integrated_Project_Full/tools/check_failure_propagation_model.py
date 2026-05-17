from pathlib import Path
import re
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROP_FILE = PROJECT_ROOT / "15_FailurePropagation.sysml"
SYSML_FILES = list(PROJECT_ROOT.glob("*.sysml"))

errors = []

# Collect declarations from the source model so fp-subject anchors are enforceable.
# This intentionally checks project-level semantic anchors without trying to be a full SysML parser.
declared = set()
behavior_declared = set()

def file_package_prefix(text: str):
    pkgs = re.findall(r"\bpackage\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{", text)
    # Project files use package AcpdCdd_SysMLv2 { package X { ... } }.
    return pkgs[:2]

def find_matching_brace(text: str, open_index: int) -> int:
    depth = 0
    for i in range(open_index, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return i
    return -1

for path in SYSML_FILES:
    text = path.read_text(encoding="utf-8", errors="replace")
    prefix = file_package_prefix(text)
    if not prefix:
        continue

    for m in re.finditer(r"\b(?:part|action|item)\s+def\s+([A-Za-z_][A-Za-z0-9_]*)", text):
        kind = m.group(0).split()[0]
        name = m.group(1)
        qname = "::".join(prefix + [name])
        declared.add(qname)
        if kind == "action":
            behavior_declared.add(qname)


    # Action-def member actions are behavior-level anchors, e.g.
    # AcpdCdd_SysMLv2::Input::AcpdCdd_CollectInputData::ValidateCollectedInputData.
    # This makes failure propagation trace to actual behavior steps instead of only to
    # coarse component/port names.
    for m in re.finditer(r"\baction\s+def\s+([A-Za-z_][A-Za-z0-9_]*)[^\{;]*(\{|;)", text):
        action_def_name = m.group(1)
        if m.group(2) == ";":
            continue
        open_idx = text.find("{", m.start())
        close_idx = find_matching_brace(text, open_idx)
        if close_idx < 0:
            continue
        body = text[open_idx + 1:close_idx]
        for mm in re.finditer(r"\baction\s+([A-Za-z_][A-Za-z0-9_]*)\b", body):
            member_name = mm.group(1)
            qname = "::".join(prefix + [action_def_name, member_name])
            declared.add(qname)
            behavior_declared.add(qname)

    # Part-def members such as ports are addressable anchors.
    for m in re.finditer(r"\bpart\s+def\s+([A-Za-z_][A-Za-z0-9_]*)[^\{;]*(\{|;)", text):
        part_name = m.group(1)
        if m.group(2) == ";":
            continue
        open_idx = text.find("{", m.start())
        close_idx = find_matching_brace(text, open_idx)
        if close_idx < 0:
            continue
        body = text[open_idx + 1:close_idx]
        for member_re in (r"\bport\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::|;)",
                          r"\bpart\s+([A-Za-z_][A-Za-z0-9_]*)\s*:",
                          r"\bref\s+([A-Za-z_][A-Za-z0-9_]*)\s*:"):
            for mm in re.finditer(member_re, body):
                declared.add("::".join(prefix + [part_name, mm.group(1)]))

if not PROP_FILE.exists():
    errors.append("missing 15_FailurePropagation.sysml")
else:
    text = PROP_FILE.read_text(encoding="utf-8", errors="replace")
    if "private import CauseAndEffect::*;" not in text:
        errors.append("15_FailurePropagation.sysml does not import CauseAndEffect::*")
    event_names = re.findall(r"\bevent\s+occurrence\s+([A-Za-z_][A-Za-z0-9_]*)", text)
    causation_count = len(re.findall(r"#causation\s+connect", text))
    multicausation_count = len(re.findall(r"#multicausation\s+connection", text))
    refs_to_real_types = re.findall(r"\bref\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)", text)

    if len(event_names) < 8:
        errors.append(f"expected at least 8 failure/effect event occurrences, found {len(event_names)}")
    if causation_count < 5:
        errors.append(f"expected at least 5 #causation links, found {causation_count}")
    if multicausation_count < 1:
        errors.append("expected at least one #multicausation connection")
    if len(refs_to_real_types) < 5:
        errors.append("expected typed ref usages to real architecture/actor elements in failure propagation context")

    # No shallow duplicate architectural containers like 'part input { ... }'.
    for shallow in ("part input {", "part process {", "part monitoring {", "part output {"):
        if shallow in text:
            errors.append(f"failure propagation still contains shallow duplicate architecture container: {shallow}")

    anchors = re.findall(r"fp-subject:\s*([A-Za-z_][A-Za-z0-9_]*)\s*->\s*([^\s]+)", text)
    anchored_events = {e for e, _ in anchors}
    if set(event_names) != anchored_events:
        missing = sorted(set(event_names) - anchored_events)
        extra = sorted(anchored_events - set(event_names))
        if missing:
            errors.append("event occurrences missing fp-subject anchors: " + ", ".join(missing))
        if extra:
            errors.append("fp-subject anchors refer to non-event names: " + ", ".join(extra))

    behavior_anchored = 0
    non_behavior_anchors = []
    for event_name, target in anchors:
        target = target.rstrip(".;")
        if target not in declared:
            errors.append(f"fp-subject for {event_name} points to unknown model element: {target}")
        elif target in behavior_declared:
            behavior_anchored += 1
        else:
            non_behavior_anchors.append(f"{event_name} -> {target}")

    if non_behavior_anchors:
        errors.append("fp-subject anchors must point to action/behavior elements, not only parts/ports/items: " + "; ".join(non_behavior_anchors))

    # Ensure causation endpoints are declared event occurrences.
    for a, b in re.findall(r"#causation\s+connect\s+([A-Za-z_][A-Za-z0-9_]*)\s+to\s+([A-Za-z_][A-Za-z0-9_]*)", text):
        if a not in event_names:
            errors.append(f"#causation source is not an event occurrence: {a}")
        if b not in event_names:
            errors.append(f"#causation target is not an event occurrence: {b}")
    for role, ep in re.findall(r"end\s+#(cause|effect)\s+::>\s*([A-Za-z_][A-Za-z0-9_]*)", text):
        if ep not in event_names:
            errors.append(f"#multicausation {role} endpoint is not an event occurrence: {ep}")

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
print(f"- event occurrences: {len(event_names)}")
print(f"- anchored events: {len(anchors)}")
print(f"- behavior/action anchored events: {behavior_anchored}")
print(f"- typed architecture refs: {len(refs_to_real_types)}")
print(f"- causation links: {causation_count}")
print(f"- multicausation links: {multicausation_count}")
sys.exit(0)
