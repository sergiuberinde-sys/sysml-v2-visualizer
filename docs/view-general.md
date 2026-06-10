# General View — Element Type Hierarchy

The **General** tab renders all named element definitions in the model and the
relationships between them: typing, composition, specialization, subsetting,
connections, and item flows.  It gives a bird's-eye, class-diagram-style
overview of what a package or file defines and how those definitions relate.

---

## 1. SysML v2 elements shown

### Definitions (center column)

| Element | Keyword | Visual style |
|---|---|---|
| `PartDefinition` | `part def` | Blue box — `«part def»` |
| `InterfaceDefinition` | `interface def` | Violet box — `«interface def»` |
| `ConnectionDefinition` | `connection def` | Violet box — `«interface def»` |
| `PortDefinition` | `port def` | Indigo box — `«port def»` |
| `ItemDefinition` | `item def` | Amber/gold box — `«item def»` |
| `AttributeDefinition` | `attribute def` | Cyan box — `«attribute def»` |
| `ActionDefinition` | `action def` | Lime-green box — `«action def»` |
| `BehaviorDefinition` | `behavior def` | Lime-green box — `«action def»` |
| `StateDefinition` | `state def` | Lime-green box — `«action def»` |
| `RequirementDefinition` | `requirement def` | Blue box — `«part def»` |
| `AllocationDefinition` | `allocation def` | Blue box — `«part def»` |
| `UseCaseDefinition` | `use case def` | Blue box — `«part def»` |
| `ViewDefinition` | `view def` | Blue box — `«part def»` |
| `MetadataDefinition` | `metadata def` | Blue box — `«part def»` |

### Usages and instances (left / right columns)

| Element | Keyword | Visual style |
|---|---|---|
| `PortDefinition` | `port def` | Left column — indigo |
| `InterfaceDefinition` | `interface def` | Left column — violet |
| `PartUsage` (inside assembly) | `part` | Right column — green `«part»` |
| `ItemUsage` (inline) | `item` | Right column — amber `«item»` |
| `OccurrenceDefinition` (structural) | `occurrence def` | Right column — green `«occurrence def»` |
| `OccurrenceDefinition` (no body) | `occurrence def` | Right column — orange `«scenario»` |

---

## 2. Relationship arrows

| Arrow | Color | Meaning | SysML keyword |
|---|---|---|---|
| Solid line + hollow triangle | Gray | `FeatureTyping` — usage typed by a definition | `: TypeName` |
| Solid line + hollow triangle | Indigo | `Specialization` — sub-definition inherits from super | `:> SuperName` |
| Solid line + hollow triangle | Violet | `Subsetting` — usage subsets another usage | `:>> OtherUsage` |
| Solid line + open arrowhead | Green | `ConnectionUsage` — structural wiring | `connect A::p to B::q` |
| Directed solid arrow | Blue/teal | `FlowUsage` / `FlowConnectionUsage` — directed item flow | `flow` / `flow connection` |
| Directed dashed arrow | Light-blue | `SuccessionItemFlow` — succession-driven item transfer | `succession flow` |
| Directed arrow + message label | Teal | Behavioral message (participant → participant) | `message M from A to B` |
| Filled diamond + solid line | Gray | Composite feature membership — part owned by container | `part` inside a def body |
| Open diamond + solid line | Gray | Non-composite membership — referenced, not owned | `ref part` |

The NOTATION legend in the bottom-right corner of the diagram explains each arrow
type with a mini-sample.

---

## 3. Three-column layout

The General view arranges nodes in three columns automatically:

| Column | Contents |
|---|---|
| Left | `PortDefinition` and `InterfaceDefinition` nodes |
| Centre | All definition types (`part def`, `item def`, `attribute def`, `action def`, …) |
| Right | Part usages, item usages, occurrence defs, and scenario nodes |

Typing arrows flow left-to-right (usage → definition).  Specialization and
subsetting arrows flow within the centre column.  Connection / flow arrows are
routed by ELK between whichever nodes they link.

---

## 4. Minimal working example

```sysml
package VehicleSystem {

    item def Speed;
    item def Torque;
    item def Pressure;

    port def DrivePort {
        out torque : Torque;
        in  speed  : Speed;
    }

    port def SensorPort {
        out pressure : Pressure;
    }

    part def Engine {
        port drive : DrivePort;
    }

    part def Transmission {
        port input : DrivePort;
    }

    part def BrakeSensor {
        port data  : SensorPort;
    }

    part def Vehicle {
        part engine       : Engine;
        part transmission : Transmission;
        part brakeSensor  : BrakeSensor;
    }
}
```

### What the plugin shows

![General view — VehicleSystem package](img/general-overview.png)

- Left column: port definitions (indigo), with arrows to the part definitions
  that own a port of that type.
- Centre column: part definitions (blue) and item definitions (gold).
- Right column: part usages (green) — the concrete instances declared inside
  `Vehicle` typed by the surrounding part definitions.
- Bottom-right: NOTATION legend explaining each arrow type.

---

## 5. Specialization (`part def A :> B`)

When one definition specializes another with `:>`, the view draws an indigo
hollow-triangle arrow from the sub-definition to the super-definition.

```sysml
part def Sensor;
part def TemperatureSensor :> Sensor;
part def PressureSensor    :> Sensor;
```

Both `TemperatureSensor` and `PressureSensor` show an indigo arrow pointing to
`Sensor`.

---

## 6. Subsetting (`part A :>> B`)

When a usage subsets another usage with `:>>`, the view draws a violet
hollow-triangle arrow from the subsetting usage to the subsetted usage.

```sysml
part def System {
    part primary   : Sensor;
    part redundant : Sensor :>> primary;
}
```

`redundant` shows a violet arrow pointing to `primary`.

---

## 7. Connections and item flows

`connect`, `flow`, and `flow connection` statements appear as directed arrows
between the port usages they link.  The arrow label shows the flow name and
payload type when declared.

```sysml
part def Vehicle {
    part engine       : Engine;
    part transmission : Transmission;

    connect engine::drive to transmission::input;
}
```

---

## 8. Filtering elements

The **— Show all elements —** dropdown at the top-left lets you hide element
types you are not interested in (e.g. show only `part def` nodes to focus on
the structural decomposition).

---

## 9. Cross-file models

When a workspace folder is open in VS Code the plugin performs a two-phase
parse.  After Phase 2 completes, type edges that cross file boundaries (e.g. a
`part def` in one file typed by an `interface def` in another) appear as
normal `FeatureTyping` arrows.

---

## 10. Specification references

Both documents are freely available from the OMG website and the
[SysML-v2-Release GitHub repository](https://github.com/Systems-Modeling/SysML-v2-Release/tree/master/doc).

**SysML v2.0** — OMG formal/2026-03-02 · https://www.omg.org/spec/SysML/2.0/

| Topic | Clause |
|---|---|
| Namespaces, packages, and imports | §7.5 |
| Definition and Usage (general pattern, FeatureTyping) | §7.6 |
| Reference Usages (bare `in`/`out` on a feature) | §7.6.4 |
| Attributes (`attribute def`, `attribute`) | §7.7 |
| Occurrences (`occurrence def`, `event occurrence`) | §7.9 |
| Items (`item def`, `item`) | §7.10 |
| Parts (`part def`, `part`) | §7.11 |
| Ports (`port def`, `port`, conjugated ports) | §7.12 |
| Connections (`connect`, `ConnectionUsage`, `SuccessionAsUsage`) | §7.13 |
| Interfaces (`interface def`) | §7.14 |
| Allocations (`allocation def`) | §7.15 |
| Flows and Messages (`flow`, `flow connection`, `message`) | §7.16 |
| States (`state def`) | §7.18 |
| Requirements (`requirement def`) | §7.21 |
| Use Cases (`use case def`) | §7.25 |
| Views and Viewpoints (`view def`) | §7.26 |
| Metadata (`metadata def`) | §7.27 |

**KerML v1.0** — OMG formal/2026-03-01 · https://www.omg.org/spec/KerML/1.0/

| Topic | Clause |
|---|---|
| Specialization (`:>`) — concrete syntax | §8.2.4.1.2 |
| Subclassification between classifiers | §8.2.4.2.2 |
| Feature Typing (`: TypeName`) | §8.2.4.3.2 |
| Subsetting (`:>>`) | §8.2.4.3.3 |
| Redefinition | §8.2.4.3.4 |
| Connectors and Successions | §7.4.6 |
| Behaviors and Steps | §7.4.7 |

---

## 11. Checklist before opening in the plugin

- [ ] The model contains at least one definition element (`part def`,
      `port def`, `item def`, etc.).
- [ ] The file (or its imports) is inside the open VS Code workspace folder.
- [ ] The **General** tab is selected in the visualizer panel.
- [ ] For specialization / subsetting arrows, use the `:>` / `:>>` keywords
      inside the same package so both ends are visible in the same graph.
