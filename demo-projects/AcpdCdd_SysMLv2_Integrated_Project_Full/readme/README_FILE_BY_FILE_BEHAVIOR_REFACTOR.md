# File-by-file behavior refactor

This project version extends the proven Input conditional-branching pattern across the remaining behavior-bearing SysML files.

Updated files include:

- `02_Input.sysml`
- `03_Process.sysml`
- `04_Powermanagement.sysml`
- `05_Monitoring.sysml`
- `06_Output.sysml`
- `08_Behavior_Main10ms.sysml`
- `09_Behavior_Init.sysml`

Applied pattern:

- explicit `entry` / `Entry` action for visual start-point rendering
- `first entry then ...` transition into the first real action
- guarded successions for multi-branch behavior
- Boolean guard attributes for branch labels
- retention of typed item/port/part enforcement

Additional checker:

- `tools/check_file_by_file_action_refactor.py`

This checker verifies that action definitions with nested behavior have explicit entry actions and entry transitions, and reports the number of guarded conditional successions found.
