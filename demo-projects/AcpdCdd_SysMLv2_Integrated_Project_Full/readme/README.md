# AcpdCdd SysML v2 Integrated Full Project

This version restores detailed per-module behavior definitions so Eclipse action views have renderable content.

Recommended places to open for Action View:
- 02_Input.sysml: `AcpdCdd_Input_Behavior`, `AcpdCdd_CollectInputData`, `AcpdCdd_StartInputCollector`, `AcpdCdd_AdcGroup0NewData`, `AcpdCdd_AdcGroup1NewData`, `AcpdCdd_AdcSupplyNewData`
- 03_Process.sysml: `AcpdCdd_Process_Behavior`, `AcpdCdd_Process`
- 04_Powermanagement.sysml: `AcpdCdd_Powermanagement_Behavior`, `AcpdCdd_PowermanagementExecute`, `AcpdCdd_Activation`
- 05_Monitoring.sysml: `AcpdCdd_Monitoring_Behavior`, `AcpdCdd_Monitoring`, `AcpdCdd_CheckTimestamps`, `AcpdCdd_MissingDataCheck`, `AcpdCdd_DeviationCheck`
- 06_Output.sysml: `AcpdCdd_Output_Behavior`, `AcpdCdd_UpdateOutput`
- 08_Behavior_Main10ms.sysml: `AcpdCdd_Main10ms`, `AcpdCdd_Runtime_Sequence_AsActionFlow`
- 09_Behavior_Init.sysml: `AcpdCdd_Initialization`

Recommended place for structural view:
- 07_ComponentDesign.sysml: `AcpdCdd`

Note:
Classic UML-style lifeline sequence rendering is not guaranteed by the Eclipse SysML v2 tooling. The file `08_Behavior_Main10ms.sysml` includes an action-flow representation of the sequence JSON so it can still render as behavior.


## Generated outputs

The source package intentionally does not include generated reports under `reports/`.
Recreate validation reports locally with:

```bash
python tools/run_all_checks.py
```

## Cause-and-effect safety-analysis layer

This baseline uses the official SysML v2 `CauseAndEffect` domain-library direction rather than a custom FMEA metamodel or behavior-owned `failureMode_*` attributes.

Open `15_FailurePropagation.sysml` to review the source-only propagation model:

- `event occurrence` elements represent relevant failure/effect occurrences.
- `#causation connect` relationships represent direct cause/effect propagation.
- `#multicausation connection` relationships represent combined-cause propagation.

This is intentionally not an ISO 26262 FMEA table and does not introduce S/O/D/RPN fields in the SysML model.

## README organization

All project README files are grouped in the `readme/` folder. The source package root intentionally contains only model, requirements, contracts, tools, reports and docs folders/files.

## Failure propagation traceability update

`15_FailurePropagation.sysml` now uses the SysML v2 `CauseAndEffect` library without duplicating the architecture as shallow local safety-analysis parts.

The failure propagation context contains typed `ref` usages to the real architecture/actor elements, for example `AcpdCdd_Input`, `AcpdCdd_Process`, `AcpdCdd_Monitoring`, `AcpdCdd_Output`, and `RTE`.

Each failure/effect `event occurrence` has an `fp-subject` anchor comment pointing to an existing behavior/action element. Anchors now resolve to action definitions or nested action usages, for example `AcpdCdd_CollectInputData::ValidateCollectedInputData`, rather than only to component parts or ports. The checker `tools/check_failure_propagation_model.py` validates that:

- `CauseAndEffect::*` is imported.
- failure/effect event occurrences exist.
- `#causation` and `#multicausation` links refer to declared events.
- every event has an `fp-subject` anchor.
- every `fp-subject` target exists in the current SysML model.
- every `fp-subject` target is behavior/action-level, not merely a shallow part or port anchor.
- old FMEA/FMEA-entry/failureMode artifacts are absent.

This keeps the CauseAndEffect layer traceable to actual AcpdCdd behavior steps while staying source-only.


## JSON behavior alignment update

The behavior files were rechecked against the uploaded JSON references. Conditional behavior is kept as explicit Boolean `if { ... } else { ... }` blocks. Artificial branches that were not supported by the JSON reference, such as a safe-output branch inside the normal `AcpdCdd_Main10ms` pipeline or a separate process start/stop branch in `AcpdCdd_Process`, were removed or simplified. CauseAndEffect failure propagation remains in `15_FailurePropagation.sysml`.
