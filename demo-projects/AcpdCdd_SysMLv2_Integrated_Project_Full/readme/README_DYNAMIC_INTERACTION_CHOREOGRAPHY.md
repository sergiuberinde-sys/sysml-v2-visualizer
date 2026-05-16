# Dynamic Interaction Choreography Modeling

This project intentionally models runtime interaction choreography using official SysML v2 action-flow semantics.

Example:

```sysml
action InputRequestsAdcGroup0Conversion;
action AdcProvidesGroup0Data;

first InputRequestsAdcGroup0Conversion
then AdcProvidesGroup0Data;
```

This is NOT a UML sequence diagram.

It is:
- official SysML v2 `action` and `first ... then ...` syntax,
- interpreted as runtime interaction choreography,
- intended for Eclipse SysML v2 Action View visualization.

The goal is to make:
- component interactions,
- runtime collaboration,
- service-call direction,
- execution order

visible despite current Eclipse SysML v2 sequence-view limitations.


## Important viewpoint rule

Do not model ADC, AdcBist, Dio, Dem, or RTE as owned parts of AcpdCdd.

They are external collaborators. Their runtime interaction with AcpdCdd is represented in choreography action flows, while their architectural context is represented in `11_ExternalInteractions.sysml`.
