#!/usr/bin/env python3
from pathlib import Path
import re, sys
ROOT = Path(__file__).resolve().parents[1]
errors=[]
pat=re.compile(r"\b(?:first|then)\s+(\w+)\s+if\s+(.+?)\s+then\s+(\w+)\s*;", re.S)
for path in sorted(ROOT.glob('*.sysml')):
    text=path.read_text(encoding='utf-8')
    for m in pat.finditer(text):
        src, guard, tgt=m.groups()
        g=' '.join(guard.split())
        base=g[4:].strip() if g.startswith('not ') else g
        prefix=f'{src}.decision.'
        if not base.startswith(prefix):
            errors.append(f'{path.name}: {src}->{tgt} guard is not a decision Boolean: {g}')
            continue
        attr=base.split('.')[-1]
        if not re.search(rf'attribute\s+{re.escape(attr)}\s*:\s*(?:ScalarValues::)?Boolean\s*;', text):
            errors.append(f'{path.name}: guard {base} has no explicit Boolean attribute declaration')
        if not re.search(rf'action\s+{re.escape(src)}\s*\{{[^}}]*out\s+item\s+decision\s*:\s*{re.escape(src)}DecisionType\s*;', text, re.S):
            errors.append(f'{path.name}: action {src} has no out item decision : {src}DecisionType')
if errors:
    print('Boolean guard check: FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('Boolean guard check: PASS')
