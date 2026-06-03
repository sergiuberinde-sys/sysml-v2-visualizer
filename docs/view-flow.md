# Interconnect View — Structural Wiring

The **Interconnect** tab renders the internal wiring of a structural assembly:
which parts it contains, which ports each part exposes, and how those ports are
connected to each other or to the assembly's own boundary.

---

## 1. SysML v2 elements used

| Element | Keyword | What it models |
|---|---|---|
| `PartDefinition` | `part def` | A reusable component type |
| `PortDefinition` | `port def` | A port type, optionally with directional features |
| `PartUsage` | `part` | An instance of a component inside an assembly |
| `PortUsage` | `port` | A port instance on a component |
| `ConnectionUsage` | `connect` | A structural wire between two ports |
| `ItemDefinition` | `item def` | A data type carried over a port |

---

## 2. Minimal working example

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

### What the plugin shows for `SensorNetwork`

![Interconnect view — SensorNetwork assembly](img/interconnect-overview.png)

- Each `part` appears as a box labelled `name : TypeName`.
- Each `port` appears as a small labelled square on the box boundary.
- The symbol inside the square shows the port's declared direction:
  `▸` out · `◂` in · `⇄` inout.
- The `connect` statement is drawn as a wire between the two port squares.
- The `control` port (`⇄`) has both `in` and `out` features inside `ControlPort`,
  so it is rendered as bidirectional.

---

## 3. Port direction

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

## 4. Cross-file models

Ports and part types are often defined in separate files.  Open the **entire
project folder** as a VS Code workspace (File → Open Folder) so all `.sysml`
files are visible. The plugin performs a two-phase parse:

1. **Phase 1** — the active file only (instant, low accuracy for cross-file refs).
2. **Phase 2** — all workspace `.sysml` files together (full accuracy).

Port direction symbols only appear reliably after Phase 2 completes.  A loading
spinner in the toolbar indicates Phase 2 is in progress.

---

## 5. Scope selector

When a file defines more than one `part def` that contains nested `part`
usages, a **scope selector** dropdown appears above the diagram.  Pick the
assembly you want to inspect.  Only assemblies with nested parts appear;
leaf-level component definitions appear in a separate group below.

---

## 6. Common modelling mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Direction declared on the `port` usage, not inside the `port def` | No symbol shown | Move `in`/`out` features into the `port def` body |
| `port def` defined in a different file but workspace not opened as a folder | No symbol after Phase 2 | Open the project root as a folder, not individual files |
| `connect` uses qualified name outside the containing `part def` | Wire not drawn | Put `connect` inside the `part def` that owns both parts |
| Two `part def` definitions with the same port label | Wrong symbol on one | Qualify port names or use distinct `port def` types |

---

## 7. Advanced: boundary ports

A `part def` can expose ports on its own boundary (i.e. ports that are part of
the assembly's external interface, not just internal wiring).

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

## 8. Checklist before opening in the plugin

- [ ] Each `part def` that models an assembly contains at least two `part`
      usages and at least one `connect` statement.
- [ ] Each `port` usage is typed by a `port def`.
- [ ] The `port def` declares directional features with `in` / `out` / `inout`.
- [ ] The file (or its imports) is inside the open VS Code workspace folder.
- [ ] The **Interconnect** tab is selected in the visualizer panel.
