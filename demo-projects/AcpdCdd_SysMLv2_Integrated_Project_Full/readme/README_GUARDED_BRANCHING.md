# Guarded Input Branching

`02_Input.sysml` now contains `AcpdCdd_Input_Main10ms_GuardedBranching` directly under the Input package.

The branching is represented with official-style conditional successions:

```sysml
first receiveAdcNotification
    if receiveAdcNotification.notification.notificationArrived
    then decodeAdcGroups;
```

This gives a visualizer concrete guarded edges to render as dotted conditional arrows with guard labels.

Guard expressions are based on typed Boolean attributes of typed items, for example:

```sysml
attribute notificationArrived : boolean;
attribute timestampFresh : boolean;
attribute group0SampleValid : boolean;
attribute group1SampleValid : boolean;
attribute supplySampleValid : boolean;
attribute sensorPairPlausible : boolean;
```

`19_ConditionalBehavior.sysml` contains the same pattern as a focused conditional behavior view.

`tools/check_guarded_conditional_successions.py` enforces that these guarded successions remain present.
