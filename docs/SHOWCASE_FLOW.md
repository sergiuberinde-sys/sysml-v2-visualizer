# Showcase Demo Flow — AcpdCdd Automotive ECU

This document describes the recommended demo walkthrough for the SysML v2 Visualizer
using the AcpdCdd (Accelerator Pedal Complex Device Driver) project as the showcase model.

---

## Prerequisites

### 1. Start the parser service

```bash
cd parser-service
node dist/server.js
# or: npm start
# Runs at http://localhost:9001 by default
```

### 2. Start the visualizer (standalone mode)

```bash
npm run dev
# Opens at http://localhost:5173
```

### 3. OR: Launch via VS Code

```
F5 → "Launch Extension"
Open any .sysml file from demo-projects/AcpdCdd_SysMLv2_Integrated_Project_Full/
```

### 4. Switch to Official SysML v2 Mode

In the visualizer toolbar:
- Set **Mode** dropdown to **Official SysML v2**
- Endpoint: `http://localhost:9001`

### 5. Load TRLC Requirements

Click **Import TRLC** button → select:
```
demo-projects/AcpdCdd_SysMLv2_Integrated_Project_Full/AcpdCdd.trlc.json
```

Button turns green and shows requirement count when loaded.

---

## Recommended Demo Files

Open these files in this sequence for the demo:

| Step | File | Focus |
|------|------|-------|
| 1 | `07_ComponentDesign.sysml` | Component structure |
| 2 | `08_Behavior_Main10ms.sysml` | Main 10 ms runnable |
| 3 | `09_Behavior_Init.sysml` | Initialization with guards |
| 4 | `05_Monitoring.sysml` | Monitoring behavior (safety-critical) |
| 5 | `03_Process.sysml` | ADC processing pipeline |
| 6 | `04_Powermanagement.sysml` | Power management (branching flow) |

---

## Demo Walkthrough

### Act 1 — System Structure

**File:** `07_ComponentDesign.sysml`

**Story:** Show the AcpdCdd ECU decomposed into its five subsystems.

1. Open file → **Structure View** tab
2. Observe:
   - `AcpdCdd` part definition
   - Sub-parts: `input`, `process`, `powermanagement`, `monitoring`, `output`
   - Usage instance: `acpdCdd : AcpdCdd`
3. Click on `AcpdCdd` → Inspector opens
4. In Inspector: click through **Owner**, **Owned Elements** to navigate
5. Point out: This is the canonical AUTOSAR-aligned ECU decomposition

**Key message:** Structure extracted directly from official SysML v2 syntax —
no diagrams, no custom DSL.

---

### Act 2 — Main 10 ms Runnable

**File:** `08_Behavior_Main10ms.sysml`

**Story:** Show the cyclic orchestration of all ECU subsystems.

1. Open file → **Behavior** tab
2. Select `AcpdCdd_Main10ms` in the Behavior dropdown
3. Observe the 8-step action flow:
   ```
   AcpdCdd_Activation
     → AcpdCdd_CollectInputData
     → AcpdCdd_Process
     → AcpdCdd_PowermanagementCalcStatus
     → AdcBist_GetVaref1ErrorStatus
     → AdcBist_GetVaref2ErrorStatus
     → AcpdCdd_Monitoring
     → AcpdCdd_Output
   ```
4. Switch to **Flow** tab → same steps as readable ordered list
5. Click individual steps → Inspector shows action type

**Key message:** The complete 10 ms runnable extracted from official SysML v2 succession edges.

---

### Act 3 — Initialization with Guarded Transitions

**File:** `09_Behavior_Init.sysml`

**Story:** Show safety-critical conditional initialization logic.

1. Open file → **Behavior** tab
2. Select `AcpdCdd_Initialization` in the Behavior dropdown
3. Observe:
   - Decision branch: `[AcpdCdd_active]` → `ExecuteCyclicTasksIfActive`
   - Alternate branch: `[not AcpdCdd_active]` → `CheckSetupTrialCounterAgainstMaxAttempts`
   - Sequential path through startup
4. Point out guard labels on edges
5. Click decision node → Inspector shows guard text

**Key message:** Official SysML v2 `first X if condition then Y` guarded succession
rendered as conditional branches — no custom parsing.

---

### Act 4 — Monitoring Module (Safety-Critical Behavior)

**File:** `05_Monitoring.sysml`

**Story:** Show the safety-critical monitoring chain that protects sensor signals.

1. Open file → **Behavior** tab
2. Select `AcpdCdd_Monitoring` in the Behavior dropdown
3. Observe the 10-step chain:
   ```
   InitializeQualifiersFromProcessedData
     → AcpdCdd_MissingDataCheck
     → AcpdCdd_CheckTimestamps
     → CombineWithAdcErrorCallbackCounters
     → PowerStateVsQualifiers
     → AcpdCdd_DeviationCheck
     → ResultPlausibilityCheck
     → SupplyVoltageCheck
     → ApplyVARef1ErrorFlag
     → ApplyVARef2ErrorFlag
     → ReturnAcceleratorData
   ```
4. Click `AcpdCdd_DeviationCheck` node → Inspector shows:
   - Impact trace (typed by, ownership)
   - **TRLC Requirements**: Acpd25128928 (±40 mV deviation), Acpd44879718/44879786 (per-sensor checks)
5. Click requirement in Inspector → Requirements view jumps to that requirement

**Key message:** Semantic navigation from behavior step → safety requirement
directly within the tool.

---

### Act 5 — Processing Pipeline

**File:** `03_Process.sysml`

**Story:** Show the ADC signal processing chain (scaling, averaging, output).

1. Open file → **Behavior** tab
2. Select `AcpdCdd_Process` in the Behavior dropdown
3. Observe the 28-step detailed processing chain
4. Switch to **Flow** tab → readable ordered projection of the same steps
5. Click any step → Inspector shows impact

**Key message:** Deep action flow with 28 steps — readable in Flow view even when
the Behavior graph becomes dense.

---

### Act 6 — Requirement Traceability

**Tab:** Requirements + Trace

**Story:** Show the TRLC requirement integration.

1. Click **Reqts** tab
2. Show 48 requirements from the TRLC JSON (all ASIL-C/D)
3. Click `Acpd28711565` — "Supervise Notification Arrivals" (ASIL-C)
4. Switch to **Trace** tab → shows trace matrix
5. Click `Acpd28596119` (10 ms Main Runnable) → shows traced elements:
   - `AcpdCdd_Main10ms` (action def)
6. Click the element chip → navigates to element in Structure/Behavior

**Key message:** Requirements are external TRLC data. Trace links are explicit.
No inference — only declared relationships.

---

### Act 7 — Semantic Navigation via Inspector

**Story:** Demonstrate the Inspector as semantic navigation hub.

1. Open any behavior file → click any action node
2. Inspector shows:
   - **Typed by**: definition the action usage references
   - **Owner**: parent action def or part def
   - **Owned elements**: sub-actions, parameters
   - **Related behaviors**: linked behavior graphs
   - **TRLC Requirements**: requirements traced to this element
3. Click any linked element → selection follows through views
4. Try clicking a port → see connected elements

**Key message:** The Inspector is a clickable semantic map.
Every relationship is navigable.

---

### Act 8 — Power Management (Branching Flow)

**File:** `04_Powermanagement.sysml`

**Story:** Show non-linear execution paths (power-on vs. power-off transitions).

1. Open file → **Behavior** tab
2. Select `AcpdCdd_PowermanagementExecute` in the Behavior dropdown
3. Observe branching:
   - `StoreNewPowerState` branches to either `SetPowerDioOn` or `SetPowerDioOff` or `LatchPreviousSwitchOnEvent`
4. Click `DeterminePowerOffToPowerOnTransition` → Inspector shows:
   - TRLC Requirement: Acpd28826666 (DEACTIVATE→ACTIVATE behavior)
5. In Requirements view, click Acpd28826666 → see trace back to the action

**Key message:** Multi-path behavior flows with requirement traceability
down to individual action steps.

---

## Semantic Relationships to Demonstrate

| Click this | See in Inspector |
|-----------|-----------------|
| `AcpdCdd` (part def) | 5 owned sub-parts, TRLC: Acpd25093540 (ASIL D partitioning) |
| `AcpdCdd_Main10ms` (action def) | 8 owned actions, TRLC: Acpd28596119 (10 ms runnable) |
| `AcpdCdd_CheckTimestamps` | TRLC: 6 safety requirements |
| `AcpdCdd_DeviationCheck` | TRLC: 5 safety requirements (deviation check) |
| `SupplyVoltageCheck` | TRLC: Acpd28883887 + Acpd28883920 (voltage range monitoring) |
| `ADC_Error_Callbacks` | TRLC: Acpd30477411 + Acpd30477478 (ADC error handling) |
| `AcpdCdd_UpdateOutput` | TRLC: 5 requirements (RTE write integrity) |
| `ValueQualifierType` | TRLC: Acpd25187609 (qualifier enum specification) |

---

## Known Limitations

- **Multi-file project**: Parser service parses one file at a time. Navigate by opening different files.
- **Sequence diagrams**: Files 12 and 14 use `event occurrence + message` notation. The official mode does not render these as sequence diagrams. Use the `*_Sequence_AsActionFlow` action defs in each file as the visualizable alternative (Behavior/Flow view).
- **Type library** (`00_Types.sysml`): `attribute def`, `enum def`, `item def` type definitions are not rendered in the Structure view. The parser extracts them, but the visualizer does not currently show a type hierarchy view.
- **Cross-file references**: The SysML files reference elements across packages (e.g., `action AcpdCdd_Main10ms` in `08_` references action defs defined in `02_`–`06_`). The single-file parser resolves locally. Cross-file type resolution requires the full project to be passed together (future work).
- **TRLC comments**: `// trlc-satisfies:` comments embedded in SysML source are not parsed by the official Pilot. The pre-built `AcpdCdd.trlc.json` captures these relationships for import.

---

## Architecture Reference

```
User opens .sysml file
       ↓
VS Code extension sends text to webview
       ↓
Webview sends text to parser-service (HTTP POST)
       ↓
parser-service → Java parser wrapper → Official SysML v2 Pilot JAR
       ↓
Pilot emits EMF containment tree (JSON)
       ↓
Semantic adapter layer:
  - ContainmentGraph (nodes + typed/contains/connection edges)
  - BehaviorData (action defs, successions, guards, conditionals)
  - ImpactTrace (ownership, typedBy, connected, flows, requirements)
       ↓
React visualizer:
  - Structure View (part defs, ports, connections)
  - Behavior View (action graph with ReactFlow)
  - Interaction Flow View (ordered step list)
  - Requirements View (TRLC list)
  - Traceability View (requirement → element matrix)
  - Inspector (semantic navigation hub)
```
