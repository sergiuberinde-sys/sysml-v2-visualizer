#!/usr/bin/env python3
from pathlib import Path
import re, sys
PROJECT_ROOT = Path(__file__).resolve().parent.parent
FILES = ["02_Input.sysml", "03_Process.sysml", "04_Powermanagement.sysml", "05_Monitoring.sysml", "06_Output.sysml", "09_Behavior_Init.sysml", "19_ConditionalBehavior.sysml"]
errors=[]
for rel in FILES:
    text=(PROJECT_ROOT/rel).read_text(encoding="utf-8")
    bool_attrs=set(re.findall(r"attribute\s+([A-Za-z_]\w*)\s*:\s*Boolean\b", text))
    for ln,line in enumerate(text.splitlines(),1):
        if re.match(r"\s*if\s+[A-Za-z_]\w*\s*\{", line):
            errors.append(f"{rel}:{ln}: block-style if remains; use guarded succession so Eclipse renders the guard label")
        m=re.search(r"\bfirst\s+\w+\s+if\s+(.+?)\s+then\s+\w+\s*;", line)
        if m:
            # Each guard expression shall reference at least one declared Boolean guard in the same file.
            names=re.findall(r"[A-Za-z_]\w*", m.group(1))
            names=[n for n in names if n not in {"not", "and", "or", "true", "false"}]
            if not names:
                errors.append(f"{rel}:{ln}: guarded succession has no Boolean guard expression")
            for name in names:
                if name not in bool_attrs:
                    errors.append(f"{rel}:{ln}: guard '{name}' is not declared as Boolean in the same file")
if errors:
    print("Guarded conditional successions: FAIL")
    for e in errors:
        print("-", e)
    sys.exit(1)
print("Guarded conditional successions: PASS")
