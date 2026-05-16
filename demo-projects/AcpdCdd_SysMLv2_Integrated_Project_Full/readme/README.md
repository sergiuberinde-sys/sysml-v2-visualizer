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
Recreate validation reports and the architecture-driven SW FMEA locally with:

```bash
python tools/run_all_checks.py
```

## README organization

All project README files are grouped in the `readme/` folder. The source package root intentionally contains only model, requirements, contracts, tools, reports and docs folders/files.

## safety-analysis traceability verification

Use:

```bash
```

This generates `reports/fmea_support_model.json` and `reports/fmea_support_matrix.md` from current SysML v2, TRLC and contract evidence. See `readme/FMEA_SUPPORT_PROCESS.md`.
- `README_SAFETY_ANALYSIS_TRACEABILITY.md` — TRLC FailureMode + SysML propagation + TRLC ControlMeasure placeholder workflow.
