# Real TRLC Requirements Integration

This project integrates the uploaded real TRLC requirement file:

```text
requirements/trlc_AccPdCdd.trlc
```

The allocation table is copied to:

```text
docs/trlc_alloc.txt
```

A machine-readable allocation contract is generated at:

```text
contracts/trlc_unit_allocations.json
```

## Trace placement

Requirement trace comments were added to the SysML units according to the provided allocation table:

- AcpdCdd Component Level → `07_ComponentDesign.sysml`
- Input → `02_Input.sysml`
- Process → `03_Process.sysml`
- Powermanagement → `04_Powermanagement.sysml`
- Monitoring → `05_Monitoring.sysml`
- Output → `06_Output.sysml`

Trace syntax remains a plain SysML comment so Eclipse does not reject it:

```sysml
// trlc-satisfies: 25093540
```

## Checks

Run:

```powershell
python tools\run_all_checks.py
```

This validates:

- TRLC requirement coverage
- TRLC allocation-to-unit coverage
- runtime interaction contracts
- component interaction sequence contracts


## Important data quality note

The allocation table references some requirement IDs that are not present in the uploaded TRLC file.

To avoid broken model traceability, this project traces only requirement IDs that exist in:

```text
requirements/trlc_AccPdCdd.trlc
```

The missing allocation IDs are reported in:

```text
reports/allocation_ids_missing_from_uploaded_trlc.md
```
