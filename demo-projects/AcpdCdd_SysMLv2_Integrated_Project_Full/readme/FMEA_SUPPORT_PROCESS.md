# FMEA support process

The FMEA support process is intentionally model-assisted, not fully automatic.

## Inputs

```text
*.sysml
requirements/*.trlc
contracts/safety_evidence_matrix.json
contracts/
```

The guideword catalogue is generic and must not contain AcpdCdd-specific module failure modes.

Examples of allowed guidewords:

```text
missing / not provided
delayed / too late
incorrect value / corrupted data
wrong order / inconsistent sequencing
duplicated / repeated unexpectedly
wrong source / wrong target
not detected / diagnostic ineffective
```

## Generation flow

```text
SysML v2 architecture
→ parse SysML context
→ select concrete behavior items only: actions, messages, event occurrences
→ attach TRLC traces and ASIL context
→ apply generic failure guidewords
→ generate FMEA review prompts
→ engineer completes the actual FMEA
```

## Commands

From the project root:

```bash
python tools/generate_sw_fmea.py
```

Or run all project checks:

```bash
python tools/run_all_checks.py
```

## Generated reports

```text
reports/fmea_support_model.json
reports/fmea_support_matrix.md
reports/acpdcdd_sw_fmea.md
reports/acpdcdd_sw_fmea.csv
```

These files are generated outputs and should not be treated as source model content.

## Why this is better

The model does not pretend to magically invent a finished FMEA. It provides structured, traceable, architecture-derived prompts that make the engineering FMEA review more complete and auditable.

## Current limitation

The current model still has limited explicit produced/consumed data and propagation semantics. Therefore, the generated FMEA support is strongest for:

- item/function discovery
- traceability
- ASIL context
- interaction dependency points
- generic failure prompting

The next improvement should be explicit dependency, propagation and protection semantics in SysML v2.
