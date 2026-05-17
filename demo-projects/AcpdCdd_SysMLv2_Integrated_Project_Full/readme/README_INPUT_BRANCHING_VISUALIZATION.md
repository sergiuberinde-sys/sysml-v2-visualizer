# Input Conditional Branching Visualization

The project now contains a dedicated SysML v2 action-flow view for Input branching:

```text
19_ConditionalBehavior.sysml
  action def AcpdCdd_Input_Main10ms_Branching
```

The model uses official SysML v2 textual action semantics only. It does **not** add pseudo-SysML diagram syntax.

## Visualization convention

A visualizer can map normal action usages by name:

| Action name pattern | Suggested rendering |
|---|---|
| `Decision_*` | decision diamond |
| `Merge_*` | merge diamond |
| `Fork_*` | fork bar |
| `Join_*` | join bar |

These are still normal SysML action usages, so the model stays parser-safe.

## Branches modeled

The Input branching view currently models:

- notification available / missing notification
- timestamp fresh / stale
- independent group0/group1/supply checks with fork/join intent
- group0 sample valid / invalid
- group1 sample valid / invalid
- supply sample valid / invalid
- sensor pair plausible / implausible
- final valid/fallback input data composition

## Enforcement

`tools/check_conditional_behavior_views.py` now checks:

- the dedicated Input branching action exists
- boolean branch conditions are typed
- if/else branches exist for the important decisions
- explicit Decision/Merge/Fork/Join action nodes exist
- fork/join succession edges exist

Run:

```bash
python tools/run_all_checks.py
```
