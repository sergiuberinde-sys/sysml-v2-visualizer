from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    '02_Input.sysml',
    '03_Process.sysml',
    '04_Powermanagement.sysml',
    '05_Monitoring.sysml',
    '06_Output.sysml',
    '08_Behavior_Main10ms.sysml',
    '09_Behavior_Init.sysml',
]

def find_matching(text, open_idx):
    depth = 0
    for i in range(open_idx, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return i
    return -1

errors = []
checked = 0
guarded = 0

for rel in FILES:
    path = ROOT / rel
    text = path.read_text()
    for m in re.finditer(r'action\s+def\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\([^)]*\))?\s*\{', text):
        name = m.group(1)
        open_idx = text.find('{', m.end() - 1)
        close_idx = find_matching(text, open_idx)
        if close_idx < 0:
            errors.append(f'{rel}: unmatched action body for {name}')
            continue
        body = text[open_idx + 1:close_idx]
        nested_actions = re.findall(r'(?m)^\s*action\s+([A-Za-z_][A-Za-z0-9_]*)\b(?!\s*def)', body)
        if not nested_actions:
            continue
        checked += 1
        if not re.search(r'(?m)^\s*action\s+(entry|Entry)\b', body):
            errors.append(f'{rel}: action def {name} has nested actions but no explicit entry action')
        if not re.search(r'first\s+(entry|Entry)\s+then\s+', body):
            errors.append(f'{rel}: action def {name} has no first entry transition')
        guarded += len(re.findall(r'first\s+\w+\s+if\s+.+?\s+then\s+\w+\s*;', body))

report = ROOT / 'reports' / 'file_by_file_action_refactor.md'
report.parent.mkdir(exist_ok=True)
report.write_text(
    '# File-by-file action refactor check\n\n'
    f'Action definitions with nested behavior checked: {checked}\n\n'
    f'Guarded conditional successions found: {guarded}\n\n'
    f'Result: {"PASS" if not errors else "FAIL"}\n\n'
    + ('\n'.join(f'- {e}' for e in errors) if errors else 'All checked action definitions have explicit entry actions and entry transitions.\n')
)

if errors:
    print('File-by-file action refactor: FAIL')
    for e in errors:
        print('ERROR:', e)
    sys.exit(1)

print('File-by-file action refactor: PASS')
print(f'Action definitions checked: {checked}')
print(f'Guarded successions found: {guarded}')
print(f'Report written to {report.relative_to(ROOT)}')
