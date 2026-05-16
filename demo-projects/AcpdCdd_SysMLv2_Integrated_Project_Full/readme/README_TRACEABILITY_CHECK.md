# TRLC Traceability Check

Trace links are intentionally stored as SysML comments so Eclipse does not validate them as model metadata.

Example:

```sysml
// trlc-satisfies: SW_ACPDCDD_IN_001
action def AcpdCdd_AdcGroup0NewData { ... }
```

Run from project root:

```powershell
python tools\check_traceability.py
```

The checker generates `reports/traceability_report.html`.


Note: This Eclipse-compatible cleanup keeps TRLC trace links as comments using `// trlc-satisfies: ...`, so they are intentionally outside SysML validation semantics.
