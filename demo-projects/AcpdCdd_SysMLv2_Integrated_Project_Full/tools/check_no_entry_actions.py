#!/usr/bin/env python3
from pathlib import Path
import re, sys
root = Path(__file__).resolve().parents[1]
violations=[]
for p in root.rglob("*.sysml"):
    text=p.read_text(encoding="utf-8")
    for i,line in enumerate(text.splitlines(),1):
        if re.search(r"\baction\s+(?:entry|Entry)\b", line):
            violations.append(f"{p.relative_to(root)}:{i}: {line.strip()}")
        if re.search(r"\bfirst\s+(?:entry|Entry)\s+then\b", line):
            violations.append(f"{p.relative_to(root)}:{i}: {line.strip()}")
        if re.search(r"(?:entry|Entry)\.", line):
            violations.append(f"{p.relative_to(root)}:{i}: {line.strip()}")
if violations:
    print("ERROR: entry action remnants found:")
    print("\n".join(violations))
    sys.exit(1)
print("OK: no entry action remnants found")
