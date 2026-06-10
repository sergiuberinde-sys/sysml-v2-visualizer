# Interconnect View — Structural Wiring

The **Interconnect** tab renders the internal wiring of a structural assembly:
which parts it contains, which ports each part exposes, and how those ports are
connected to each other or to the assembly's own boundary.  Both structural
connections and directed item flows are shown.

---

## 1. SysML v2 elements used

| Element | Keyword | What it models |
|---|---|---|
| `PartDefinition` | `part def` | A reusable component type (selectable as scope) |
| `PortDefinition` | `port def` | A port type, optionally with directional features |
| `PartUsage` | `part` | An instance of a component inside an assembly |
| `PortUsage` | `port` | A port instance on a component |
| `ItemUsage` | `item` | A data item inside a component (visible in leaf view) |
| `ActionUsage` | `action` | An action step inside a component (visible in leaf view) |
| `ItemDefinition` | `item def` | A data type carried over a port |
| `ConnectionUsage` | `connect` | Structural (undirected) wire between two ports |
| `FlowUsage` | `flow from A.p to B.q` | Directed item flow between two port pins |
| `FlowConnectionUsage` | `flow connection` | Directed connection with typed payload |
| `SuccessionItemFlow` | `succession flow` | Succession-driven directed item transfer |
| `FlowUsage` (message form) | `message M from A to B` | Behavioral message between parts (no port) |

---

## 2. Structural connections vs. item flows

The view distinguishes between two kinds of edges:

| Edge kind | Keyword | Arrowhead | Animated | Label |
|---|---|---|---|---|
| `ConnectionUsage` | `connect` | None (undirected) | No | — |
| `FlowUsage` / `FlowConnectionUsage` / `SuccessionItemFlow` | `flow` / `flow connection` / `succession flow` | Filled arrowhead | Yes | Flow name and/or item type |
| Message (`FlowUsage` message form) | `message` | Arrowhead | No | Message name (dashed line) |

---

## 3. Minimal working example

```sysml
package SensorNetwork {

    item def Reading;
    item def Command;

    port def DataOutPort {
        out value : Reading;
    }

    port def DataInPort {
        in value : Reading;
    }

    port def ControlPort {
        in  cmd    : Command;
        out status : Reading;
    }

    part def Sensor {
        port output  : DataOutPort;
    }

    part def Logger {
        port input   : DataInPort;
        port control : ControlPort;
    }

    part def Monitor {
        port feed    : DataInPort;
    }

    part def SensorNetwork {
        part sensor  : Sensor;
        part logger  : Logger;
        part monitor : Monitor;

        connect sensor.output  to logger.input;
        connect sensor.output  to monitor.feed;
    }
}
```

### Graphical notation

For the canonical graphical representation of parts and ports, see **Figure 15**
(Part Definition and Usage), **Figure 16** (Port Definition and Usage), and
**Figure 64** (Parts Interconnection for `vehicle_b`) in SysML v2.0.

- Each `part` appears as a box labelled `name : TypeName`.
- Each `port` appears as a small labelled square on the box boundary.
- The symbol inside the square shows the port's declared direction:
  `▸` out · `◂` in · `⇄` inout.
- The `connect` statement is drawn as a plain undirected wire between the two
  port squares.
- The `control` port (`⇄`) has both `in` and `out` features inside `ControlPort`,
  so it is rendered as bidirectional.

---

## 4. Directed item flows

`flow`, `flow connection`, and `succession flow` statements create directed,
animated arrows.  A flow edge carries its name and payload type as a label.

```sysml
part def Pipeline {

    part source  : SourcePart;
    part sink    : SinkPart;

    flow sensorData
        from source.output
        to   sink.input;
}
```

- The flow arrow is animated (moving dashes) and carries an arrowhead at the
  target end.
- The label shows the flow name and, if present, the item type:
  `sensorData : Reading`.

---

## 5. Port direction

Direction is declared on the **features inside the `port def`**, not on the
port usage itself.

```sysml
port def BidirectionalBus {
    in  request  : CommandFrame;
    out response : DataFrame;
}

part def Controller {
    port bus : BidirectionalBus;   // ⇄ — has both in and out features
}
```

| Features inside `port def` | Displayed symbol |
|---|---|
| Only `out` features | `▸` |
| Only `in` features | `◂` |
| Both `in` and `out` features | `⇄` |
| No directional features | square with no symbol |

**Note on `ref` features:** A `ReferenceUsage` declared with a direction
modifier (e.g. `out ref :>> someFeature`) inside a `port def` is also
recognised by the plugin and contributes to the direction shown.

---

## 6. Behavioral message flows

`message` statements inside a `part def` produce dashed arrows drawn directly
between part boxes (bypassing port squares).  This is typical for interaction
or sequence scenarios modelled at the part level.

```sysml
part def UserSession_Interconnect {

    part client      : Client_Participant;
    part authService : AuthService_Participant;

    message login
        from client.sendLoginRequest
        to   authService.receiveLoginRequest;
}
```

- Message arrows are dashed and carry the message name as a label.
- They connect the participating `part` boxes, not port squares.

---

## 7. Leaf-part view

When the selected scope `part def` has **no nested `part` usages** (a leaf
component rather than an assembly), the view renders the definition itself as a
single container box showing:

- Its **port** squares on the boundary.
- Any **item** children listed inside the box.
- Any **action** children listed inside the box (in violet).

This makes it easy to inspect a component's interface without needing to switch
to the General view.

---

## 8. Boundary ports

A `part def` can expose ports on its own boundary (the assembly's external
interface, separate from internal wiring).

```sysml
part def Subsystem {
    port externalPort : SomePortDef;   // boundary port

    part internal : InternalComponent;

    connect externalPort to internal.somePort;
}
```

Boundary ports appear on the **left edge** of the assembly box in the
Interconnect view, separate from the internal part boxes.

---

## 9. Binding connectors (BindingConnectorAsUsage)

A `BindingConnectorAsUsage` (`bind a = b`) equates two features so that they
always hold the same value.  It is common for wiring a property through a
structural boundary (e.g. passing a port feature from an outer boundary port
into an inner part).  For the graphical notation, see **Figure 18** (Connectors
as Usages) in SysML v2.0.

```sysml
part def Vehicle {

    part fuelTank : FuelTank;
    part engine   : Engine;

    // Equate the tank's output feature to the engine's input feature.
    bind fuelTank.fuelFlowOut = engine.fuelIn;
}
```

**Difference from `connect`:** `connect` creates a structural link between
two port *instances*; `bind` equates the *values* of two features.

**Spec reference:** §7.13.3 Binding Connectors as Usages (SysML v2.0).

---

## 10. InterfaceUsage

An `interface` usage connects two conjugated ports and carries typed flows.
It is conceptually similar to a `connect` but is typed by an `interface def`
that declares the expected flows between the ports.  For the graphical
notation, see **Figure 20** (Interface Definition and Usage) in SysML v2.0.

```sysml
interface def DriveInterface {
    end source : DrivePort;
    end target : ~DrivePort;    // conjugated port
    flow torqueFlow : Torque from source to target;
}

part def PowerTrain {
    part engine       : Engine;
    part transmission : Transmission;

    interface driveLink : DriveInterface
        connect engine.drive to transmission.input;
}
```

**Spec reference:** §7.14 Interfaces (SysML v2.0).

---

## 11. AllocationUsage

`allocation` statements (and `allocation def` types) express that one element
is allocated to another — for instance, that a logical function is allocated
to a physical hardware part.  For the graphical notation, see **Figure 21**
(Allocation Definition and Usage) in SysML v2.0.

```sysml
allocation def FunctionToHardware {
    end function : LogicalFunction;
    end hardware : HardwarePart;
}

part def System {
    part controller : LogicalFunction;
    part processor  : HardwarePart;

    allocate controller to processor;
}
```

**Spec reference:** §7.15 Allocations (SysML v2.0).

---

## 12. Conjugated ports

A conjugated port (`~PortDef`) reverses the direction of all features in the
port definition.  For the graphical notation, see **Figure 17** (Port
Conjugation) in SysML v2.0.

```sysml
port def DrivePort {
    out torque : Torque;
    in  speed  : Speed;
}

part def Engine {
    port drive  : DrivePort;    // ▸ torque out,  ◂ speed in  → rendered ⇄
}

part def Transmission {
    port input  : ~DrivePort;   // ◂ torque in,   ▸ speed out → rendered ⇄
}
```

The symbol `⇄` is shown when both `in` and `out` features exist (whether
from the original or conjugated port).

**Spec reference:** §7.12 Ports, conjugated ports (SysML v2.0).

---

## 13. Cross-file models

Ports and part types are often defined in separate files.  Open the **entire
project folder** as a VS Code workspace (File → Open Folder) so all `.sysml`
files are visible. The plugin performs a two-phase parse:

1. **Phase 1** — the active file only (instant, low accuracy for cross-file refs).
2. **Phase 2** — all workspace `.sysml` files together (full accuracy).

Port direction symbols only appear reliably after Phase 2 completes.  A loading
spinner in the toolbar indicates Phase 2 is in progress.

---

## 14. Scope selector

When a file defines more than one `part def` that contains nested `part`
usages, a **scope selector** dropdown appears above the diagram.  Pick the
assembly you want to inspect.  Only assemblies with nested parts appear in the
primary list; leaf-level component definitions appear in a separate group.

---

## 15. Common modelling mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Direction declared on the `port` usage, not inside the `port def` | No symbol shown | Move `in`/`out` features into the `port def` body |
| `port def` defined in a different file but workspace not opened as a folder | No symbol after Phase 2 | Open the project root as a folder, not individual files |
| `connect` uses qualified name outside the containing `part def` | Wire not drawn | Put `connect` inside the `part def` that owns both parts |
| Two `part def` definitions with the same port label | Wrong symbol on one | Qualify port names or use distinct `port def` types |
| Using `flow` instead of `connect` expecting undirected line | Line is animated/directed | `flow` is always directed; use `connect` for undirected structural wiring |

---

## 16. Specification references

Both documents are freely available from the OMG website and the
[SysML-v2-Release GitHub repository](https://github.com/Systems-Modeling/SysML-v2-Release/tree/master/doc).

**SysML v2.0** — OMG formal/2026-03-02 · https://www.omg.org/spec/SysML/2.0/

| Topic | Clause | Key figures |
|---|---|---|
| Parts (`part def`, `part`) | §7.11 | Figures 15, 64 |
| Ports (`port def`, `port`, direction, conjugated ports) | §7.12 | Figures 16, 17 |
| Connections (`connect`, `ConnectionUsage`) | §7.13 | Figure 19 |
| Binding Connectors as Usages (`bind a = b`) | §7.13.3 | Figure 18 |
| Successions as Usages (`first X then Y` inside an assembly) | §7.13.5 | — |
| Interfaces (`interface def`, `interface`) | §7.14 | Figure 20 |
| Allocations (`allocation def`, `allocate`) | §7.15 | Figure 21 |
| Flows and Messages (`flow`, `flow connection`, `succession flow`, `message`) | §7.16 | Figure 22 |
| Flow Definitions and Usages (semantics of directed flows) | §7.16.2 | — |
| Items (`item def`) | §7.10 | Figure 14 |

**KerML v1.0** — OMG formal/2026-03-01 · https://www.omg.org/spec/KerML/1.0/

| Topic | Clause |
|---|---|
| Connectors (structural wiring) | §7.4.6 |
| Succession Declaration (ordering) | §7.4.6.4 |
| Interactions and Flows (payload semantics) | §8.3.4.9 |

---

## 17. Checklist before opening in the plugin

- [ ] Each `part def` that models an assembly contains at least two `part`
      usages and at least one `connect` or `flow` statement.
- [ ] Each `port` usage is typed by a `port def`.
- [ ] The `port def` declares directional features with `in` / `out` / `inout`.
- [ ] The file (or its imports) is inside the open VS Code workspace folder.
- [ ] The **Interconnect** tab is selected in the visualizer panel.
