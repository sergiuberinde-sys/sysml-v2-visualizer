# SignalConditioningAndProcessing — private-import model map

## Primary model element

```text
SCP_Assembly::SignalConditioningAndProcessing
```

## Source ownership and private dependencies

| Source file | Package | Private imports | Owns |
|---|---|---|---|
| `00_foundation/00_SCP_Foundation.sysml` | `SCP_Foundation` | — | Item types; ASIL and Realization metadata |
| `10_interfaces/10_SCP_InterfaceDefinitions.sysml` | `SCP_Interfaces` | `SCP_Foundation::*` | Port definitions |
| `20_behavior/20_SCP_MainActionSignatures.sysml` | `SCP_MainActionSignatures` | `SCP_Foundation::*` | Main action signatures |
| `20_behavior/21_SCP_AcpdActionSignatures.sysml` | `SCP_AcpdActionSignatures` | `SCP_Foundation::*` | Acpd action signatures |
| `20_behavior/22_SCP_AcpdSignalProcessingBehavior.sysml` | `SCP_AcpdBehavior` | `SCP_Foundation::*`, `SCP_AcpdActionSignatures::*` | AcceleratorPedalSignalProcessing body |
| `20_behavior/23_SCP_MainBehavior.sysml` | `SCP_MainBehavior` | `SCP_Foundation::*`, `SCP_MainActionSignatures::*` | Main activity body |
| `30_functions/30_SCP_LogicalFunctionDefinitions.sysml` | `SCP_LogicalFunctions` | `SCP_Foundation::*`, `SCP_Interfaces::*`, `SCP_MainActionSignatures::*`, `SCP_AcpdBehavior::*` | Logical-function part definitions |
| `40_interactions/40_SCP_InteractionBehavior.sysml` | `SCP_Interactions` | `SCP_LogicalFunctions::*` | Sequence action |
| `50_assembly/50_SCP_ClusterAssembly.sysml` | `SCP_Assembly` | `SCP_Foundation::*`, `SCP_Interfaces::*`, `SCP_LogicalFunctions::*`, `SCP_MainBehavior::*`, `SCP_Interactions::*` | Cluster assembly |
| `99_integration/99_SCP_Integration.sysml` | `SCP_Integration` | `SCP_Assembly::*` | Optional entry point only |

All imports in this project use the exact form `private import <Package>::*;`.
