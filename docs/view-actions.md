# Actions View — Behavior Flows

The **Actions** tab renders the execution flow of a named action definition:
steps as boxes, sequencing arrows between them, guarded decision branches,
parallel fork/join paths, and — when data flows are present — port pins and
item-flow arrows connecting them.

---

## 1. SysML v2 elements used

| Element | Keyword | What it models |
|---|---|---|
| `ActionDefinition` | `action def` | The behavior container |
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

## 6. Port pins and item flows

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

## 7. Cross-file port inheritance

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

## 8. Multiple behaviors in one file

A file can contain many `action def` blocks.  The Actions view shows a
selector dropdown above the diagram; choose the definition you want to
inspect.  Only top-level `action def` elements appear in the list.

---

## 9. Common modelling mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Guard attribute not in scope | Guard label shows as `[condition]` | Declare `attribute name : Boolean` before the `action def` or inside it |
| No `first … then …` statements | Empty diagram | Add at least one succession to wire the steps |
| Cycle with no exit | Diagram renders but has no terminal node | Add a guard or a separate exit step |
| `PerformActionUsage` typed by an unknown definition | Step box shows no type label | Open the containing folder so Phase 2 resolves cross-file types |
| `flow` references wrong port name | Item flow arrow missing | Ensure `flow from A.portName` matches the declared port name exactly |
| Cross-file type not imported | Ports not inherited on typed step | Add `private import PkgName::*;` at the top of the package body |

---

## 10. Checklist before opening in the plugin

- [ ] The `action def` contains at least two `action` steps.
- [ ] Each step is connected by at least one `first … then …` succession.
- [ ] Boolean guard attributes are declared in scope before use.
- [ ] Port names in `flow from A.p to B.q` match the declared port names exactly.
- [ ] Cross-file action definitions are imported with `private import PkgName::*;`.
- [ ] The **Actions** tab is selected in the visualizer panel.
- [ ] If multiple `action def` blocks exist, select the desired one from the
      dropdown.
