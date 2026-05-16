# Conditional Behavior Views

The project includes a dedicated conditional behavior view:

`19_ConditionalBehavior.sysml`

This file models important if/else branches explicitly so Eclipse behavior views can show decision/merge-like structure.

## Recommended Eclipse usage

Open `19_ConditionalBehavior.sysml`, place the cursor inside one of these actions, and open the behavior view:

- `AcpdCdd_InputNotificationHandling_Conditional`
- `AcpdCdd_TimestampSupervision_Conditional`
- `AcpdCdd_DeviationCheck_Conditional`
- `AcpdCdd_OutputQualifier_Conditional`
- `AcpdCdd_Powermanagement_Conditional`
- `AcpdCdd_Main10ms_ConditionalOverview`

## Separation of concerns

- sequence views: `14_ComponentInteractionSequences.sysml`
- typed data movement: `18_ComponentDataflows.sysml`
- interaction contracts: `17_RuntimeInteractionContracts.sysml`
- conditional behavior: `19_ConditionalBehavior.sysml`
