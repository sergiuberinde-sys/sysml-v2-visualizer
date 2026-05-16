# AcpdCdd SysML v2 Project — Compatibility Matrix

Project: `demo-projects/AcpdCdd_SysMLv2_Integrated_Project_Full/`

Parser: Official SysML v2 Pilot Implementation 0.59.0-SNAPSHOT (via HTTP parser service)

---

## File Inventory

| File | Domain | Structure | Behavior | Sequence |
|------|--------|-----------|----------|----------|
| `00_Types.sysml` | Type library | attribute defs, enum defs, item defs | — | — |
| `01_ExternalActors.sysml` | External actors | port defs, part defs (ADC, AdcBist, RTE) | — | — |
| `02_Input.sysml` | Input module | part def (AcpdCdd_Input), port defs | 7 action defs + successions | action flow sequence |
| `03_Process.sysml` | Processing module | part def (AcpdCdd_Process), port defs | 4 action defs + successions | action flow sequence |
| `04_Powermanagement.sysml` | Power management | part def (AcpdCdd_Powermanagement), port defs | 6 action defs + branching successions | action flow sequence |
| `05_Monitoring.sysml` | Monitoring module | part def (AcpdCdd_Monitoring), port defs | 9 action defs + branching | action flow sequence |
| `06_Output.sysml` | Output module | part def (AcpdCdd_Output), port defs | 3 action defs + successions | action flow sequence |
| `07_ComponentDesign.sysml` | Top-level ECU | part def AcpdCdd (5 sub-parts) + part usage | — | — |
| `08_Behavior_Main10ms.sysml` | Main runnable | — | AcpdCdd_Main10ms (8-step linear) | runtime sequence as action flow |
| `09_Behavior_Init.sysml` | Init runnable | — | AcpdCdd_Initialization (guarded if/else) | init sequence as action flow |
| `11_ExternalInteractions.sysml` | System context | part defs + part usages (6 services) | — | — |
| `12_DynamicInteractionSequences.sysml` | Runtime sequence | part def[1] with event occurrences + messages | — | 19-message full runtime sequence |
| `13_InterfaceContracts.sysml` | Interface contracts | part defs with ports (contract-annotated) | — | — |
| `14_ComponentInteractionSequences.sysml` | Per-component sequences | part def[1] with event occurrences + messages | — | 5 per-component sequences |
| `16_FaultTrees.sysml` | Safety/FTA | — | FTA action defs (non-standard package) | — |

---

## Construct Support Matrix

| Construct | File(s) | Currently Supported | Partially Supported | Unsupported | Rendering Status | Notes |
|-----------|---------|---------------------|---------------------|-------------|-----------------|-------|
| `package` (top-level + nested) | All | ✓ | | | Renders in explorer | Both `AcpdCdd_SysMLv2 { package X { } }` nesting and flat packages work |
| `private import ScalarValues::*` | 02–06, 08–09 | ✓ | | | Ignored cleanly | Official Pilot resolves std lib imports |
| `attribute def :> Real/Integer/Boolean` | 00 | ✓ | | | Not visualized | Extracted as type nodes |
| `enum def` with enum values | 00 | ✓ | | | Not in structure view | Used for ASIL, PowerState etc. |
| `item def` with nested items/attributes | 00 | | ✓ | | Not rendered | Complex nested item types |
| `part def` with ports + attributes + actions | 02–07, 11, 13 | ✓ | | | Structure View | Part defs and owned members extracted |
| `part` usage (typed instance) | 07, 11, 13 | ✓ | | | Structure View | `part acpdCdd : AcpdCdd` extracted |
| `port def` with direction | 01–06 | ✓ | | | Structure View | `in`/`out` direction preserved |
| `port` usage on part def | 02–07 | ✓ | | | Structure View | Port ownership shown in Inspector |
| `action def` with `action` usages + `first/then` | 02–09, 16 | ✓ | | | Behavior View | Full action graph with successions |
| `first A then B` (linear succession) | 02–09 | ✓ | | | Behavior View | Renders as directed edges |
| `first A then B; first A then C` (branching) | 04, 05 | ✓ | | | Behavior View | ReactFlow handles multiple outgoing edges |
| `first X if cond then Y` (guarded transition) | 09 | ✓ | | | Behavior View | Guard label shown on edge |
| `first A if not B then C` (negated guard) | 09 | ✓ | | | Behavior View | Guard label `[not B]` shown |
| `in`/`out` parameters on action def | 02–06 | ✓ | | | Inspector | Shown in Inspector as item parameters |
| `attribute` on part def | 04 | ✓ | | | Inspector | `CurrentPowerState`, `SwitchOnEvent` etc. |
| `item` usage on part def | 02 | | ✓ | | Inspector | `group0Data`, `groupDataEntryPair` etc. |
| `action` usage on part def | 02–07 | ✓ | | | Inspector | Owned actions shown in Impact section |
| `// trlc-satisfies:` trace comments | 02–08, 14 | | | ✓ | Via TRLC JSON | Comments not parsed by official Pilot; use explicit trace JSON |
| `event occurrence` inside `part def[1]` | 12, 14 | | ✓ | | Not in official mode | Legacy sequence view only |
| `message from X.event to Y.event` | 12, 14 | | ✓ | | Not in official mode | Legacy sequence view only |
| `action def` in non-`AcpdCdd_SysMLv2` package | 16 | | ✓ | | Parsed but isolated | `AcpdCdd_FaultTrees` package: parses, behavior shows |
| `// fta-gate:`, `// safety-basic-event:` comments | 16 | | | ✓ | Ignored | Non-semantic, comment-only FTA annotations |

---

## View Rendering Status per File

| File | Structure View | Behavior View | Interaction Flow View | Sequence View | Inspector | TRLC Trace |
|------|---------------|---------------|----------------------|---------------|-----------|------------|
| `00_Types.sysml` | Empty (no parts) | Empty | — | — | Works | 4 elements |
| `01_ExternalActors.sysml` | ADC, AdcBist, RTE parts | Empty | — | — | Works | — |
| `02_Input.sysml` | AcpdCdd_Input + ports | ✓ 7 action defs | ✓ AcpdCdd_Input_Sequence_AsActionFlow | — | Works | 9 elements |
| `03_Process.sysml` | AcpdCdd_Process + ports | ✓ 4 action defs | ✓ AcpdCdd_Process_Sequence_AsActionFlow | — | Works | 6 elements |
| `04_Powermanagement.sysml` | AcpdCdd_Powermanagement + ports | ✓ 6 action defs (branching) | ✓ Sequence_AsActionFlow | — | Works | 8 elements |
| `05_Monitoring.sysml` | AcpdCdd_Monitoring + ports | ✓ 9 action defs | ✓ Sequence_AsActionFlow | — | Works | 12 elements |
| `06_Output.sysml` | AcpdCdd_Output + ports | ✓ 3 action defs | ✓ Sequence_AsActionFlow | — | Works | 5 elements |
| `07_ComponentDesign.sysml` | ✓ AcpdCdd (5 sub-parts) | Empty | — | — | Works | AcpdCdd |
| `08_Behavior_Main10ms.sysml` | Empty (no parts) | ✓ AcpdCdd_Main10ms 8-step | ✓ Runtime_Sequence_AsActionFlow | — | Works | AcpdCdd_Main10ms |
| `09_Behavior_Init.sysml` | Empty (no parts) | ✓ AcpdCdd_Initialization (guarded) | ✓ Init_Sequence_AsActionFlow | — | Works | — |
| `11_ExternalInteractions.sysml` | ✓ 6 service parts + context | Empty | — | — | Works | — |
| `12_DynamicInteractionSequences.sysml` | Part defs visible | Empty | — | Not in official mode | Partial | — |
| `13_InterfaceContracts.sysml` | ✓ Part defs + ports | Empty | — | — | Works | — |
| `14_ComponentInteractionSequences.sysml` | Part defs visible | Empty | — | Not in official mode | Partial | 4 elements |
| `16_FaultTrees.sysml` | Empty (AcpdCdd_FaultTrees pkg) | ✓ 5 FTA action defs | ✓ FTA flows | — | Works | — |

---

## Priority Constructs for Showcase

These are the constructs actually used in this project, in priority order for the showcase:

1. **Part decomposition** (`07_ComponentDesign.sysml`) — `AcpdCdd` with 5 sub-parts → **Structure View**
2. **Linear action flows** (`08_Behavior_Main10ms.sysml`) — `AcpdCdd_Main10ms` 8-step → **Behavior + Flow View**
3. **Guarded transitions** (`09_Behavior_Init.sysml`) — if active / if not active → **Behavior View**
4. **Branching action flows** (`04_Powermanagement.sysml`) — multiple outgoing edges → **Behavior View**
5. **Deep action defs** (`05_Monitoring.sysml`, `02_Input.sysml`) — 9–12 step action defs → **Behavior View**
6. **TRLC requirement traces** (all files via comment extraction) — 48 requirements, 65 trace links → **Requirements + Trace View**

---

## Known Limitations for Showcase

- **Multi-file project**: Parser service currently parses one file at a time. Open each file independently.
- **`event occurrence` + `message`**: Native sequence diagram notation (files 12, 14) is not rendered in official mode; use the `*_Sequence_AsActionFlow` action defs in each file as the visualizable alternative.
- **`item def` nesting**: Item type hierarchies from `00_Types.sysml` are not visualized in the structure view.
- **TRLC trace comments**: `// trlc-satisfies:` embedded in SysML source are comments not parsed by the official Pilot. Use the pre-built `AcpdCdd.trlc.json` for trace import.
- **`AcpdCdd_FaultTrees` package** (`16_FaultTrees.sysml`): Uses a different outer package name; renders correctly but appears isolated from the main `AcpdCdd_SysMLv2` namespace.
