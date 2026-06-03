# General View — Element Type Hierarchy

The **General** tab renders all named element definitions in the model and the
typing relationships between them.  It gives a bird's-eye, class-diagram-style
overview of what a package or file defines and how those definitions relate.

---

## 1. SysML v2 elements shown

| Element | Keyword | Visual style |
|---|---|---|
| `PartDefinition` | `part def` | Blue box labelled `«part def»` |
| `PortDefinition` | `port def` | Violet box labelled `«port def»` |
| `ItemDefinition` | `item def` | Gold box labelled `«item def»` |
| `AttributeDefinition` | `attribute def` | Shown as attribute node |
| `ActionDefinition` | `action def` | Blue box labelled `«action def»` |
| `StateDefinition` | `state def` | Blue box labelled `«state def»` |
| `OccurrenceDefinition` | `occurrence def` | Blue box |
| `PartUsage` (inside an assembly) | `part` | Green box labelled `«part»` |

Arrow notation (shown in the NOTATION legend):

| Arrow | Meaning |
|---|---|
| Gray `→` | `FeatureTyping` — a usage is typed by a definition |
| Green `→` | `ConnectionUsage` — a structural connection |
| Gray `◆→` | Composite feature membership |
| Gray `◇→` | Non-composite feature membership |

---

## 2. Minimal working example

The General view renders any package that contains definition elements — the
same model used for the Interconnect view works directly:

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

### What the plugin shows

![General view — SensorNetwork package](img/general-overview.png)

- Left column: port definitions (violet), with arrows to the part definitions
  that own a port of that type.
- Centre column: part definitions (blue) and item definitions (gold).
- Right column: part usages (green) — the concrete instances declared inside
  `SensorNetwork` with their wiring visible as `ConnectionUsage` arrows.
- Bottom-right: NOTATION legend explaining each arrow type.

---

## 3. Filtering elements

The **— Show all elements —** dropdown at the top-left lets you hide element
types you are not interested in (e.g. show only `part def` nodes to focus on
the structural decomposition).

---

## 4. Cross-file models

When a workspace folder is open in VS Code the plugin performs a two-phase
parse.  After Phase 2 completes, type edges that cross file boundaries (e.g. a
`part def` in one file typed by an `interface def` in another) appear as
normal `FeatureTyping` arrows.

---

## 5. Checklist before opening in the plugin

- [ ] The model contains at least one definition element (`part def`,
      `port def`, `item def`, etc.).
- [ ] The file (or its imports) is inside the open VS Code workspace folder.
- [ ] The **General** tab is selected in the visualizer panel.
