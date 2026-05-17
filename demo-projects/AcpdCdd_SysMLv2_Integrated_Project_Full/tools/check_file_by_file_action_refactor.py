#!/usr/bin/env python3
from pathlib import Path
import re, sys
ROOT = Path(__file__).resolve().parent.parent
FILES = ['02_Input.sysml', '03_Process.sysml', '04_Powermanagement.sysml', '05_Monitoring.sysml', '06_Output.sysml', '08_Behavior_Main10ms.sysml', '09_Behavior_Init.sysml', '19_ConditionalBehavior.sysml']
errors=[]
checked=0
for rel in FILES:
    text=(ROOT/rel).read_text(encoding='utf-8')
    checked += len(re.findall(r'\baction\s+def\s+', text))
    for ln,line in enumerate(text.splitlines(),1):
        if re.search(r'\baction\s+(?:entry|Entry)\b', line):
            errors.append(f'{rel}:{ln}: synthetic entry action declaration remains')
        if re.search(r'\bfirst\s+(?:entry|Entry)\s+then\b', line):
            errors.append(f'{rel}:{ln}: first entry transition remains')
        if re.search(r'(?:entry|Entry)\.', line):
            errors.append(f'{rel}:{ln}: flow through entry action remains')
if errors:
    print('File-by-file action refactor: FAIL')
    for e in errors:
        print('ERROR:', e)
    sys.exit(1)
print('File-by-file action refactor: PASS')
print(f'Action definitions checked: {checked}')
