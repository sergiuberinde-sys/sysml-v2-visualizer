#!/usr/bin/env python3
from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parents[1]
errors = []
if_re = re.compile(r'^\s*if\s+(.+?)\s*\{')
attr_bool_re = re.compile(r'\battribute\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:Boolean|boolean)\b')

for f in sorted(ROOT.glob('*.sysml')):
    text = f.read_text(encoding='utf-8')
    guards = set(attr_bool_re.findall(text))
    for ln, line in enumerate(text.splitlines(), start=1):
        m = if_re.match(line)
        if not m:
            continue
        cond = m.group(1).strip()
        # require a named boolean guard, optionally negated
        name = cond[4:].strip() if cond.startswith('not ') else cond
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', name):
            errors.append(f"{f.name}:{ln}: conditional does not use a named Boolean guard: {cond}")
        elif name not in guards:
            errors.append(f"{f.name}:{ln}: Boolean guard '{name}' is not declared as Boolean/boolean in file")

if errors:
    print('Boolean guard check FAILED:')
    for e in errors:
        print('  -', e)
    sys.exit(1)
print('Boolean guard check passed')
