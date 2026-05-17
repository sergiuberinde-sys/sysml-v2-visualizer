# Component-Level Message Sequence Views

`14_ComponentInteractionSequences.sysml` adds message-based component-level sequence views using official SysML v2 message syntax.

Added sequence views:

- `AcpdCdd_Input_Sequence`
- `AcpdCdd_Process_Sequence`
- `AcpdCdd_Powermanagement_Sequence`
- `AcpdCdd_Monitoring_Sequence`
- `AcpdCdd_Output_Sequence`

These complement the full runtime sequence in `12_DynamicInteractionSequences.sysml`.

Run all checks:

```powershell
python tools\run_all_checks.py
```

Generated additional report:

```text
reports/component_interaction_contract_report.html
```
