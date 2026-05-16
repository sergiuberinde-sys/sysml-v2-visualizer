#!/usr/bin/env python3
"""Validate inline TRLC trace hygiene in SysML files."""
from __future__ import annotations
import json, re, sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ALLOC_PATH = PROJECT_ROOT / 'contracts' / 'trlc_unit_allocations.json'
TRACE_RE = re.compile(r'//\s*trlc-satisfies:\s*(\d+)')
FORBIDDEN = ['BEGIN AUTO-GENERATED TRLC TRACE BLOCK','END AUTO-GENERATED TRLC TRACE BLOCK','BEGIN TRLC UNIT ALLOCATION TRACE','END TRLC UNIT ALLOCATION TRACE']
ELEMENT_STARTS = ('action ', 'action def ', 'message ', 'event occurrence ', 'port ', 'port def ', 'item ', 'item def ', 'attribute ', 'attribute def ', 'part ', 'part def ', 'enum ', 'enum def ')
def next_code_line(lines, i):
    j=i+1
    while j < len(lines):
        s=lines[j].strip()
        if not s or s.startswith('//'):
            j+=1; continue
        return s
    return ''
def main():
    errors=[]
    for path in sorted(PROJECT_ROOT.glob('*.sysml')):
        text=path.read_text(encoding='utf-8', errors='replace')
        for marker in FORBIDDEN:
            if marker in text: errors.append(f'{path.name}: forbidden trace block marker remains: {marker}')
        lines=text.splitlines()
        for i,line in enumerate(lines):
            if TRACE_RE.search(line):
                nxt=next_code_line(lines,i)
                if not nxt.startswith(ELEMENT_STARTS):
                    errors.append(f'{path.name}:{i+1}: trace is not directly attached to a SysML element; next code line is {nxt!r}')
    data=json.loads(ALLOC_PATH.read_text(encoding='utf-8'))
    allocation=data.get('active_allocation_traced_in_sysml') or data.get('allocation') or {}
    unit_to_file=data.get('unit_to_sysml_file') or {}
    for unit, ids in allocation.items():
        filename=unit_to_file.get(unit)
        if not filename:
            errors.append(f'No SysML file mapped for active allocation unit {unit}')
            continue
        path=PROJECT_ROOT/filename
        if not path.exists():
            errors.append(f'Mapped SysML file missing for {unit}: {filename}')
            continue
        found=set(TRACE_RE.findall(path.read_text(encoding='utf-8', errors='replace')))
        for rid in ids:
            if str(rid) not in found:
                errors.append(f'{filename}: active allocation {unit} expects trace {rid}, but it is missing')
    report=PROJECT_ROOT/'reports'/'trace_block_hygiene.md'
    report.parent.mkdir(exist_ok=True)
    report.write_text('# Inline TRLC Trace Hygiene Report\n\n' + ('Result: PASS\n' if not errors else 'Result: FAIL\n\n'+'\n'.join(f'- {e}' for e in errors)+'\n'), encoding='utf-8')
    print('TRLC trace hygiene: ' + ('PASS' if not errors else 'FAIL'))
    if errors:
        for e in errors: print('- '+e)
    return 1 if errors else 0
if __name__ == '__main__': raise SystemExit(main())
