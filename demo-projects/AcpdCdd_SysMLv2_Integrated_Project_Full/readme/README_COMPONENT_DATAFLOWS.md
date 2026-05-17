# Component Dataflow / Interconnection View

The project includes a dedicated component-level dataflow view:

`18_ComponentDataflows.sysml`

This view is intended for the SysML v2 interconnection view.

## Purpose

The file shows typed data movement between runtime participants, for example:

```sysml
flow adcNotificationData : AdcNotificationPayloadType
    from adc.adcNotificationOut
    to acpdCddInput.adcNotificationIn;
```

This is different from the sequence view:

- sequence view = ordered runtime interactions
- dataflow/interconnection view = typed data movement between components

## Checker

Run:

```bash
python tools/check_component_dataflows.py
```

or:

```bash
python tools/run_all_checks.py
```

The checker verifies that:

- dataflows can be parsed
- payload type comments match flow types
- flow payload types are defined in `00_Types.sysml`

## Recommended Eclipse usage

Open `18_ComponentDataflows.sysml` and use the interconnection view on:

```text
AcpdCdd_DataflowInterconnection
```

This should show the component-level dataflow graph more clearly than the behavior/sequence views.
