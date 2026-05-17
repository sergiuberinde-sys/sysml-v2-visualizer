# Typed Interface Contract Direction

`00_Types.sysml` is the shared semantic foundation for runtime interfaces.

It contains:
- primitive/value types
- signal qualifiers
- ADC sample/timestamp structures
- input/output data structures
- runtime payload item definitions

The runtime interaction contract now uses `payload_type` entries in:

`contracts/runtime_interaction_contracts.json`

The runtime checker verifies that each declared payload type exists as an `item def` in:

`00_Types.sysml`

This makes the interaction contract stronger than name-only message checking.

## Example

```sysml
item def AdcNotificationPayloadType {
    attribute Group0NotificationArrived : boolean;
    attribute Group1NotificationArrived : boolean;
    attribute SupplyNotificationArrived : boolean;
    item Timestamps : AdcTimestampBufferType;
}
```

The ADC notification messages are mapped to this type in the runtime contract JSON.

This supports the project direction:

```text
port/message contract
→ typed payload
→ runtime interaction checker
→ CI-checkable interface consistency
```
