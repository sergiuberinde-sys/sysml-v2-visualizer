# SysML v2 Message-Based Runtime Sequence

`12_DynamicInteractionSequences.sysml` models the runtime sequence directly from `ComponentDesign_Behavior.json`.

The `message` usage names are now based on the actual called functions / return messages from the JSON, sanitized only as needed to be valid SysML identifiers.

Examples:

```sysml
message AcpdCdd_Activation
message Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
message AcpdCdd_CollectInputData
message AcpdCdd_Process
message AdcBist_GetVaref1ErrorStatus
message AcpdCdd_Output
message Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
```

Return messages are named explicitly, for example:

```sysml
message returnInputData
message returnProcessedData
message returnPowerState
```

The ADC interrupt notification is represented as:

```sysml
message AcpdCdd_AdcNotificationGroup0_1_Supply
```

Open:

```text
AcpdCdd_Runtime_Sequence
```
