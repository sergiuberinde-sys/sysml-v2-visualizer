# Architecture Viewpoint Separation

The project now separates ownership from external runtime collaboration.

## Internal ownership

`07_ComponentDesign.sysml` shows only the parts owned by AcpdCdd:

- Input
- Process
- Powermanagement
- Monitoring
- Output

This represents internal software decomposition.

## External collaborators

`11_ExternalInteractions.sysml` shows external services/collaborators:

- ADC
- ADC BIST
- DIO
- DEM
- RTE

These are not owned by AcpdCdd. They are modeled separately as external collaborators.

## Dynamic interaction

Runtime collaboration is still represented by the `*_Sequence_AsActionFlow` action definitions, for example:

- `AcpdCdd_Input_Sequence_AsActionFlow`
- `AcpdCdd_Powermanagement_Sequence_AsActionFlow`
- `AcpdCdd_Monitoring_Sequence_AsActionFlow`
- `AcpdCdd_Output_Sequence_AsActionFlow`

These use official SysML v2 `action` and `first ... then ...` syntax to represent runtime interaction choreography.
