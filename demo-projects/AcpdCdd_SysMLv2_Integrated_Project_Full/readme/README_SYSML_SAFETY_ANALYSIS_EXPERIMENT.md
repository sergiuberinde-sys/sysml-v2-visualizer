# SysML v2 Failure Mode / Control Measure Experiment

The SysML safety-analysis experiment models the failure mode itself as a part with attributes.

File:

`20_SysMLSafetyAnalysisExperiment.sysml`

## Core pattern

```text
FailureMode part
→ assumes failure has occurred
→ has safety objective
→ requires ControlMeasure parts
→ exposes SafetyGap if required controls are missing
```

## Main modeled example

`MissingAdcNotification_FailureModeModel`

This contains:

- `missingAdcNotification : FailureMode`
- `timestampSupervision : ControlMeasure`
- `errorQualifierFallback : ControlMeasure`
- `noControlMeasureGap : SafetyGap`

The `FailureMode` has attributes such as:

- `asil`
- `assumedOccurred`
- `controlCoverage`
- `state`
- `hasSafetyGap`
- `localEffect`
- `endEffect`

## Gap logic

The key attribute is:

```sysml
attribute hasSafetyGap : boolean;
```

The intended interpretation is:

```text
required control measure present and implemented
→ hasSafetyGap = false

required control measure missing
→ hasSafetyGap = true
```

The file also contains a negative demo part:

`MissingAdcNotification_FailureModeGapExample`

This intentionally shows a partial-control scenario with:

```sysml
attribute hasSafetyGap = true;
```

## Recommended Eclipse views

### Interconnection / dependency view

Open:

`MissingAdcNotification_FailureModeModel`

This should show the failure mode part, required control measure parts, and safety gap part.

### Behavior view

Open:

`MissingAdcNotification_ControlCoverageBehavior`

This shows conditional gap reasoning:

- timestamp supervision implemented?
- error qualifier fallback implemented?
- all required controls implemented?
- controlled vs uncontrolled result
