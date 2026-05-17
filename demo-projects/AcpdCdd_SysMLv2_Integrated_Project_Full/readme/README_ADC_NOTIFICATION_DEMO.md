# ADC Notification Safety Demo Sequence

This short demo shows how one runtime behavior is connected across SysML v2, TRLC, FTA, and CI-style checks.

## 1. Runtime interaction

Open:

`14_ComponentInteractionSequences.sysml`

Show the ADC notification messages:

```sysml
// trlc-satisfies: 28711565
event occurrence receiveAdcGroup0Notification;

message AcpdCdd_AdcNotificationGroup0
    from adc.notifyGroup0
    to acpdCddInput.receiveAdcGroup0Notification;
```

Explain that this is the modeled runtime interaction between ADC and AcpdCdd input handling.

## 2. Requirement traceability

Open:

`requirements/trlc_AccPdCdd.trlc`

Show requirement `28711565`, which requires supervision of ADC Group0, Group1, and Supply notification arrivals and update frequency.

Then show that the same requirement is traced in:

- `14_ComponentInteractionSequences.sysml` on the ADC notification interactions
- `05_Monitoring.sysml` on `AcpdCdd_CheckTimestamps`

This demonstrates that the requirement is linked both to the incoming architectural interaction and to the monitoring behavior.

## 3. Runtime interaction checker

Run:

```bash
python tools/check_runtime_interaction_contracts.py
```

or:

```bash
python tools/run_all_checks.py
```

Show that expected messages, actual messages, missing messages, and extra messages are checked.

## 4. Failure mode

Open:

`requirements/failure_modes.trlc`

Show the missing/delayed ADC notification failure modes.

## 5. FTA/root-cause model

Open:

`16_FaultTrees.sysml`

Show the FTA actions and the `// trlc-failure-mode:` link to the TRLC FailureMode.

## 6. Control measure

Open:

`requirements/control_measures.trlc`

Show the timestamp supervision control measures that mitigate the ADC notification basic events.

## 7. Safety-analysis checker

Run:

```bash
python tools/check_safety_analysis_traceability.py
```

Show that the checker verifies the chain:

```text
FailureMode
→ SysML FTA/root-cause model
→ BasicEvent
→ ControlMeasure
```

## Key message

PlantUML can document this chain, but SysML v2 allows the runtime architecture, behavior, requirement traces, FTA context, and checkers to operate on a common model backbone.
