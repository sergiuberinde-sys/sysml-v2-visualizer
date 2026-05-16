# Safety Layer

This project uses an evidence-based safety traceability layer for the AcpdCdd SysML v2 + TRLC model.

## Important modeling decision

Safety goals are **not** duplicated as direct comments inside SysML component files.

Instead, the trace chain is:

```text
Safety Goal
  -> ASIL-tagged TRLC requirement IDs
  -> SysML `// trlc-satisfies: <id>` comments
  -> derived SysML unit/component support
```

This avoids redundant trace data such as direct `// safety-goal: SG_...` comments in every component. Component support for a safety goal is derived automatically by the checker from the requirement traces that already exist in the model.

## Main files

- `requirements/trlc_AccPdCdd.trlc` — ASIL-tagged AcpdCdd requirements
- `requirements/safety_goals.trlc` — derived software-level safety goals / safety evidence clusters
- `contracts/safety_goal_allocations.json` — safety goal to requirement-ID mapping only
- `contracts/safety_evidence_matrix.json` — evidence classification per ASIL requirement
- `contracts/trlc_unit_allocations.json` — requirement-to-unit allocation and unit-to-SysML-file mapping
- `tools/check_safety_goal_coverage.py` — derives component support from `trlc-satisfies` comments
- `tools/check_safety_evidence_matrix.py` — validates the evidence matrix
- `reports/safety_goal_coverage.md` — generated safety-goal coverage report
- `reports/safety_evidence_matrix.md` — generated safety evidence matrix report

## What is validated

The safety checkers validate consistency and coverage:

- every ASIL-tagged TRLC requirement is covered by at least one safety goal
- every safety goal references valid ASIL-tagged TRLC requirements
- every safety goal has derived SysML support through `trlc-satisfies` comments
- safety evidence entries use valid evidence states and existing evidence references

They do **not** claim formal ISO 26262 compliance or prove implementation correctness.
