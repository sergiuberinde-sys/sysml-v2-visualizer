# Actions View — Behavior Flows

The **Actions** tab renders the execution flow of a named action definition:
steps as boxes, sequencing arrows between them, guarded decision branches,
parallel fork/join paths, and — when data flows are present — port pins and
item-flow arrows connecting them.

---

## 1. SysML v2 elements used

| Element | Keyword | What it models |
|---|---|---|
| `ActionDefinition` | `action def` | The behavior container (full support: ports, item flows, control nodes) |
| `PartDefinition` | `part def` | Alternative container — shows `action` usages and successions only |
| `ActionUsage` | `action` | A named step |
| `PerformActionUsage` | `perform action` | Invoke another action definition |
| `SuccessionAsUsage` | `first X then Y` | Unconditional flow |
| `TransitionUsage` | `first X if guard then Y` | Guarded (conditional) flow |
| `ForkNode` | `fork` | Parallel split (one input, multiple outputs) |
| `JoinNode` | `join` | Parallel merge (multiple inputs, one output) |
| `DecisionNode` | `decide` | Decision point (one input, guarded outputs) |
| `MergeNode` | `merge` | Merge point (multiple inputs, one output) |
| `AttributeUsage` | `attribute` | Boolean guard variable |
| `ItemUsage` (with direction) | `in item` / `out item` | Typed data port on an action step |
| `ReferenceUsage` (with direction) | `in` / `out` | Untyped or typed data port (idiomatic form) |
| `FlowUsage` | `flow from A.p to B.q` | Item flow between two port pins |

---

## 2. Minimal working example

```sysml
package Authentication {

    private import ScalarValues::Boolean;

    // Guard attribute visible to guarded successions.
    attribute credentialsValid : Boolean;

    action def Authenticate {

        // ── Step declarations ──────────────────────────────────────────────
        action receiveRequest;
        action validateCredentials;
        action issueToken;
        action returnError;
        action sendResponse;

        // ── Sequencing ─────────────────────────────────────────────────────
        first receiveRequest then validateCredentials;

        // Guarded flows — each uses a Boolean attribute as the guard.
        first validateCredentials if credentialsValid     then issueToken;
        first validateCredentials if not credentialsValid then returnError;

        // Both branches converge at sendResponse.
        first issueToken   then sendResponse;
        first returnError  then sendResponse;
    }
}
```

### What the plugin shows

![Actions view — Authenticate flow](img/actions-overview.png)

- Each `action` step is a rounded box labelled `«action» name`.
- An unconditional `first X then Y` draws a plain arrow from X to Y.
- Guarded flows (`first X if … then Y`) appear as coloured arrows labelled
  with the guard expression; the source node shows a `◆ N branches` badge.
- Steps with no outgoing successors show a terminal circle at the bottom.
- The initial step (the one with no incoming flow) shows an entry circle.

---

## 3. Guard conditions

Guards reference Boolean attributes declared in the same `action def` or at
package level.

```sysml
attribute inputValid : Boolean;

action def Validate {
    action checkInput;
    action processInput;
    action rejectInput;

    first checkInput if inputValid     then processInput;
    first checkInput if not inputValid then rejectInput;
}
```

- The guard expression may be `<attribute>` (true branch) or
  `not <attribute>` (false/negated branch).
- The plugin uses the attribute name as the guard label.  More complex
  expressions (comparisons, compound conditions) are not resolved to a
  label and may appear as `[condition]`.

---

## 4. Parallel paths (fork / join)

```sysml
action def ParallelChecks {

    action collectData;
    fork  splitChecks;           // ForkNode
    action checkA;
    action checkB;
    action checkC;
    join  mergeChecks;           // JoinNode
    action publishResult;

    first collectData  then splitChecks;
    first splitChecks  then checkA;
    first splitChecks  then checkB;
    first splitChecks  then checkC;
    first checkA       then mergeChecks;
    first checkB       then mergeChecks;
    first checkC       then mergeChecks;
    first mergeChecks  then publishResult;
}
```

- `fork` creates a `ForkNode`, rendered as a horizontal bar with one
  incoming and multiple outgoing arrows.
- `join` creates a `JoinNode`, rendered as a horizontal bar with multiple
  incoming and one outgoing arrow.

---

## 5. Decision / merge pattern

```sysml
action def ConditionalFlow {

    attribute condition : Boolean;

    action start;
    decide check;          // DecisionNode
    action pathA;
    action pathB;
    merge  converge;       // MergeNode
    action finish;

    first start   then check;
    first check if condition     then pathA;
    first check if not condition then pathB;
    first pathA   then converge;
    first pathB   then converge;
    first converge then finish;
}
```

- `decide` creates a `DecisionNode`, rendered as a diamond.
- `merge` creates a `MergeNode`, rendered as a diamond.

---

## 6. Action usages inside a `part def`

The Actions view is not limited to `action def` containers.  When a `part def`
directly owns `action` usages (typed or inline), those steps and their
successions are also rendered — the `part def` appears in the selector dropdown
labelled `"partDefName (part def)"`.

```sysml
part def Controller {

    // Typed action usage — step typed by an external action def.
    action init    : Initialise;
    action process : ProcessData;
    action shutdown : Shutdown;

    first init    then process;
    first process then shutdown;
}
```

- Each `action` usage becomes an `«action»` box; the type name (`Initialise`,
  `ProcessData`, …) is shown below the step name.
- Succession arrows are drawn exactly as in the `action def` case.

**Limitations compared to `action def` containers:**  Port pins and item flows
(`flow from A.p to B.q`) are only rendered when the container is an `action def`.
A `part def` container shows steps and control flow only.

---

## 7. Port pins and item flows

When action steps exchange data, you can declare ports on each step and connect
them with `flow` statements.  The Actions view renders these as small coloured
pins on the left (in-ports) and right (out-ports) edge of the action box, with
dashed sky-blue arrows carrying the item type label between them.

### Port declaration — two equivalent forms

**Explicit form** (`in item` / `out item`):

```sysml
action def DataPipeline {

    action readSensor {
        out item rawReading : SensorReading;
    }

    then action process {
        in  item inRaw     : SensorReading;
        out item outResult : ControlCommand;
    }

    then action actuate {
        in item cmd : ControlCommand;
    }

    flow from readSensor.rawReading to process.inRaw;
    flow from process.outResult     to actuate.cmd;
}
```

**Idiomatic form** (bare `in` / `out` — standard per the OMG SysML v2 spec):

```sysml
action def DataPipeline2 {

    action readSensor {
        out rawReading : SensorReading;
    }

    then action process {
        in  inRaw     : SensorReading;
        out outResult : ControlCommand;
    }

    then action actuate {
        in cmd : ControlCommand;
    }

    flow from readSensor.rawReading to process.inRaw;
    flow from process.outResult     to actuate.cmd;
}
```

Both forms produce identical diagrams.  Choose whichever reads more naturally
for your model.

### What the plugin shows

- Each `in` port appears as a small pin on the **left** edge of the action box,
  labelled with the port name (and item type if declared).
- Each `out` port appears as a small pin on the **right** edge.
- A `flow from A.p to B.q` draws a dashed arrow from the `p` out-pin on `A` to
  the `q` in-pin on `B`, labelled with the item type.
- Action nodes that have no ports look exactly as they do in the basic flow
  examples above — ports are additive, not required.

---

## 8. Cross-file port inheritance

If an action step is typed by an `action def` declared in another file, the
plugin automatically inherits that definition's ports onto the step.

```sysml
// sensors.sysml
package Sensors {
    action def ReadSensor {
        out item rawReading : SensorReading;
    }
}

// pipeline.sysml
package Pipeline {
    private import Sensors::*;

    action def Process {
        action readSensor : ReadSensor;   // typed by external def

        then action filter {
            in item inRaw : SensorReading;
        }

        flow from readSensor.rawReading to filter.inRaw;
    }
}
```

`readSensor` inherits `rawReading` from `ReadSensor` even though `ReadSensor`
is defined in `sensors.sysml`.  Open both files in the same VS Code workspace
folder and Phase 2 resolution handles the rest automatically.

---

## 9. Multiple behaviors in one file

A file can contain many `action def` blocks.  The Actions view shows a
selector dropdown above the diagram; choose the definition you want to
inspect.  Only top-level `action def` elements appear in the list.

---

## 10. PerformActionUsage — delegating to an external action definition

A `perform action` usage invokes an action defined elsewhere.  The step appears
in the Actions view as a normal action box; the type name shown below the step
label identifies which external `action def` is being performed.

```sysml
package SystemBoot {

    action def PowerOnSequence {
        action startPSU;
        action runPOST;
        action loadFirmware;

        first startPSU  then runPOST;
        first runPOST   then loadFirmware;
    }

    action def FullBoot {
        action initHardware;

        // Delegates execution to the externally-defined PowerOnSequence.
        perform action powerOn : PowerOnSequence;

        action launchOS;

        first initHardware then powerOn;
        first powerOn      then launchOS;
    }
}
```

- The step `powerOn` renders as `«action» powerOn` with `PowerOnSequence`
  shown below the label.
- Ports declared on `PowerOnSequence` are inherited onto `powerOn` after Phase
  2 resolves the cross-file type.

---

## 11. Nested action bodies

An `action` step may contain its own sub-body with nested steps and successions.
**The Actions view renders only the top-level steps** of the selected definition;
nested bodies are not unrolled into the diagram.

```sysml
action def ComplexProcess {

    // step1 has an internal sub-body — shown as a single box in the diagram.
    action step1 {
        action substep1a;
        action substep1b;
        first substep1a then substep1b;
    }

    action step2;

    first step1 then step2;
}
```

- `step1` renders as a single `«action» step1` box.  Its sub-steps
  (`substep1a`, `substep1b`) are **not** expanded.
- This matches standard UML activity diagram conventions where a composite
  action is an atomic step at the parent level.

> **Not yet implemented:** There is no drill-down capability.  Clicking a
> composite step does not open its sub-body.  A future enhancement could
> render nested bodies on double-click or in a separate panel.

---

## 12. Loop actions — not yet rendered

The SysML v2 spec defines three `LoopActionUsage` forms (§7.17.12).  The Java
parser produces `LoopActionUsage` nodes, but the Actions view does **not yet
visualize** them as loop regions.

### Until loop

```sysml
action def RepeatUntil {
    attribute x         : Real;
    attribute y         : Real;
    attribute increment : Real;

    action loop1 loop {
        assign y := 2 * x;
        then assign x := x + increment;
    } until x >= 10;
}
```

### While loop

```sysml
action def WhileLoop {
    attribute x : Real;
    attribute y : Real;

    action loop2 while x < 10 {
        assign y := 2 * x;
        then assign x := x + 1;
    }
}
```

### For loop

```sysml
action def ForLoop {
    attribute n : Integer;
    attribute y : Real;

    action forLoop1 for i : Integer in 1..n {
        assign y := y + i;
    }
}
```

> **Planned rendering:** Loop nodes could appear as a UML activity loop region
> (back-edge arrow with the exit guard label on the arc).

**Spec reference:** §7.17.12 Loop Action Usages (SysML v2.0).

---

## 13. Send and Accept actions — not yet rendered

### SendActionUsage (§7.17.7)

Sends a value or object via a port.

```sysml
action def ProduceAndSend {
    out port displayPort;

    attribute picture : Picture;

    action capturePicture;
    action send1 send picture via displayPort;

    first capturePicture then send1;
}
```

### AcceptActionUsage (§7.17.8)

Waits for an incoming event or value on a port.  Also used in state machine
transitions (`accept when <trigger>`).

```sysml
action def ReceiveScene {
    in port viewPort;

    action trigger1 accept scene : Scene via viewPort;
    action processScene;

    first trigger1 then processScene;
}
```

> **Not yet rendered.**  A future implementation could use the UML activity
> notation: filled-pentagon for Send, concave-pentagon (signal receipt) for
> Accept.

**Spec references:** §7.17.7 Send Action Usages, §7.17.8 Accept Action Usages
(SysML v2.0).

---

## 14. Assignment actions — not yet rendered

`AssignmentActionUsage` (`assign x := value`) sets a feature value.  Assignment
steps appear inside loop bodies, if-branches, and entry/exit actions.

```sysml
action def Counter {
    attribute counter : Integer;
    attribute limit   : Integer;

    action init      { assign counter := 0; }
    action increment { assign counter := counter + 1; }
    action check;
    action done;

    first init      then check;
    first check if counter < limit     then increment;
    first check if not counter < limit then done;
    first increment then check;
}
```

The `assign` steps inside the composite bodies are parsed but not displayed
as individual nodes — only the outer named steps (`init`, `increment`, `check`,
`done`) appear in the diagram.

> **Not yet rendered.**  Assignment steps could appear as small tagged boxes
> (`«assign»`) or as inline annotations on composite action nodes.

**Spec reference:** §7.17.9 Assignment Action Usages (SysML v2.0).

---

## 15. Terminate actions — not yet rendered

A `terminate` action (§7.17.10) stops the enclosing behavior.  It is
referenced via `then terminate;` in a succession.

```sysml
action def EmergencyShutdown {
    attribute emergency : Boolean;

    action monitor;
    action safeShutdown;

    first monitor    if emergency     then safeShutdown;
    first monitor    if not emergency then monitor;      // self-loop
    first safeShutdown then terminate;
}
```

The `then terminate;` currently produces no visible terminal node in the
diagram — the preceding step shows no outgoing arrow.  A future enhancement
would render it as a UML activity flow-final node (filled circle with outer
ring).

**Spec reference:** §7.17.10 Terminate Action Usages (SysML v2.0).

---

## 16. Inline IfActionUsage — not yet rendered

Beyond the guarded succession pattern (§3), SysML v2 supports inline
structured `if-then-else` action bodies within a step (§7.17.11):

```sysml
action def ThresholdCheck {
    attribute a : Real;
    attribute b : Real;

    action classify {
        // Structured if inside a composite step — not unrolled in the diagram.
        if a >= 20 {
            assign b := 100;
        } else {
            assign b := 0;
        }
    }

    action report;

    first classify then report;
}
```

**Distinction from guarded successions:** This is a self-contained
`IfActionUsage` *inside* an action body, not a `TransitionUsage` connecting
two named steps.  The outer `classify` box is shown; its internal if-else
structure is currently not expanded.

**Spec reference:** §7.17.11 If Action Usages (SysML v2.0).

---

## 17. Rendering support summary

| Feature | Rendered | Spec clause |
|---|---|---|
| `action` steps as boxes | ✓ | §7.17.2 |
| `first X then Y` (SuccessionAsUsage) | ✓ | §7.17.4 |
| Guarded flow (`first X if guard then Y`) | ✓ | §7.17.5 |
| `fork` / `join` nodes | ✓ | §7.17.3 |
| `decide` / `merge` nodes | ✓ | §7.17.3 |
| `perform action` (PerformActionUsage) | ✓ | §7.17.6 |
| Port pins (`in` / `out` features on steps) | ✓ | §7.6.4, §7.16.2 |
| Item flow arrows (`flow from A.p to B.q`) | ✓ | §7.16 |
| Cross-file port inheritance | ✓ | §7.5 |
| `action def` and `part def` containers | ✓ | §7.17.2, §7.11 |
| Entry / terminal pseudo-state circles | ✓ | — |
| Nested action body | Shown as single opaque box | §7.17.2 |
| LoopActionUsage (`loop` / `while` / `for`) | Not yet rendered | §7.17.12 |
| SendActionUsage (`send X via port`) | Not yet rendered | §7.17.7 |
| AcceptActionUsage (`accept X via port`) | Not yet rendered | §7.17.8 |
| AssignmentActionUsage (`assign x := v`) | Not yet rendered | §7.17.9 |
| TerminateActionUsage (`then terminate`) | Not yet rendered | §7.17.10 |
| Inline IfActionUsage (structured if body) | Not yet rendered | §7.17.11 |
| Nested sub-action drill-down | Not yet implemented | §7.17.2 |

---

## 18. Common modelling mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Guard attribute not in scope | Guard label shows as `[condition]` | Declare `attribute name : Boolean` before the `action def` or inside it |
| No `first … then …` statements | Empty diagram | Add at least one succession to wire the steps |
| Cycle with no exit | Diagram renders but has no terminal node | Add a guard or a separate exit step |
| `PerformActionUsage` typed by an unknown definition | Step box shows no type label | Open the containing folder so Phase 2 resolves cross-file types |
| `flow` references wrong port name | Item flow arrow missing | Ensure `flow from A.portName` matches the declared port name exactly |
| Cross-file type not imported | Ports not inherited on typed step | Add `private import PkgName::*;` at the top of the package body |

---

## 19. Specification references

Both documents are freely available from the OMG website and the
[SysML-v2-Release GitHub repository](https://github.com/Systems-Modeling/SysML-v2-Release/tree/master/doc).

**SysML v2.0** — OMG formal/2026-03-02 · https://www.omg.org/spec/SysML/2.0/

| Topic | Clause |
|---|---|
| Actions overview and execution semantics | §7.17 |
| Action Definitions and Usages (`action def`, `action`) | §7.17.2 |
| Control Nodes (`fork`, `join`, `decide`, `merge`) | §7.17.3 |
| Succession Shorthands (`first X then Y`) | §7.17.4 |
| Conditional Successions (`first X if guard then Y`) | §7.17.5 |
| Perform Action Usages (`perform action`) | §7.17.6 |
| Send Action Usages (`send X via port`) | §7.17.7 |
| Accept Action Usages (`accept X via port`) | §7.17.8 |
| Assignment Action Usages (`assign x := v`) | §7.17.9 |
| Terminate Action Usages (`then terminate`) | §7.17.10 |
| If Action Usages (structured inline `if … else …`) | §7.17.11 |
| Loop Action Usages (`loop` / `while` / `for`) | §7.17.12 |
| Flows and Messages — `flow from A.p to B.q` between actions | §7.16 |
| Flow Definitions and Usages (port-to-port item flows) | §7.16.2 |
| Reference Usages — bare `in`/`out` port syntax | §7.6.4 |
| Parts (`part def` as container, `part` for typed steps) | §7.11 |
| Namespaces/imports — `private import` for cross-file types | §7.5 |

**KerML v1.0** — OMG formal/2026-03-01 · https://www.omg.org/spec/KerML/1.0/

| Topic | Clause |
|---|---|
| Behaviors and Steps (action execution model) | §7.4.7 |
| Succession Declaration (ordering between steps) | §7.4.6.4 |
| Feature Typing (`: TypeName` on a step or port) | §8.2.4.3.2 |
| Subsetting / Redefinition (`:>>`) on ports | §8.2.4.3.3, §8.2.4.3.4 |

---

## 20. Checklist before opening in the plugin

- [ ] The `action def` contains at least two `action` steps.
- [ ] Each step is connected by at least one `first … then …` succession.
- [ ] Boolean guard attributes are declared in scope before use.
- [ ] Port names in `flow from A.p to B.q` match the declared port names exactly.
- [ ] Cross-file action definitions are imported with `private import PkgName::*;`.
- [ ] The **Actions** tab is selected in the visualizer panel.
- [ ] If multiple `action def` blocks exist, select the desired one from the
      dropdown.
