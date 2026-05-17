#!/usr/bin/env python3
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
issues=[]
for path in sorted(root.glob('*.sysml')):
    text=path.read_text(encoding='utf-8')
    for n,line in enumerate(text.splitlines(),1):
        if re.match(r'\s*if\s+[A-Za-z_]\w*\s*\{', line):
            issues.append(f'{path.name}:{n}: block-style if remains: {line.strip()}')
# Make sure we still have guarded conditional branches.
guarded_total=0
for path in sorted(root.glob('*.sysml')):
    guarded_total += len(re.findall(r'\bfirst\s+\w+\s+if\s+.+?\s+then\s+\w+\s*;', path.read_text(encoding='utf-8')))
if guarded_total < 10:
    issues.append(f'expected guarded successions, found only {guarded_total}')
if issues:
    print('Explicit guarded succession check failed:')
    for issue in issues:
        print(' -', issue)
    raise SystemExit(1)
print(f'OK: conditionals use guarded successions for Eclipse edge labels ({guarded_total} guarded edges)')
