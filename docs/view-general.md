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

### Graphical notation

For the canonical graphical representation of definitions and usages, see
**Figure 8** (Definition and Usage) and **Figure 15** (Part Definition and
Usage) in SysML v2.0.  The SimpleVehicleModel annex (Figures 56–76) shows a
complete worked example of how all definition types fit together.

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

## 8. EnumerationDefinition

`EnumerationDefinition` (`enum def`) is a classifier that lists a fixed set of
named values (enum literals).  For the graphical notation, see **Figure 11**
(Enumeration Definition and Usage) in SysML v2.0.

```sysml
package Signals {

    enum def TrafficColor {
        enum Red;
        enum Yellow;
        enum Green;
    }

    attribute def SignalState {
        attribute color : TrafficColor;
    }
}
```

**Spec reference:** §7.8 Enumerations (SysML v2.0).

---

## 9. ConstraintDefinition

`ConstraintDefinition` (`constraint def`) declares a Boolean constraint that
can be attached to parts, attributes, or the system boundary.  For the
graphical notation, see **Figure 35** (Constraint Definition and Usage) in
SysML v2.0.

```sysml
package Physics {

    attribute def Mass { attribute value : Real; }
    attribute def Force { attribute value : Real; }
    attribute def Acceleration { attribute value : Real; }

    constraint def NewtonsSecondLaw {
        attribute m : Mass;
        attribute a : Acceleration;
        attribute f : Force;

        f.value == m.value * a.value
    }
}
```

**Spec reference:** §7.20 Constraints (SysML v2.0).

---

## 10. BindingConnectorAsUsage

`bind a = b` creates a `BindingConnectorAsUsage` that equates two feature
values.  For the graphical notation, see **Figure 18** (Connectors as Usages)
in SysML v2.0.

```sysml
part def Vehicle {
    part fuelTank : FuelTank;
    part engine   : Engine;

    bind fuelTank.fuelFlowOut = engine.fuelIn;
}
```

**Spec reference:** §7.13.3 Binding Connectors as Usages (SysML v2.0).

---

## 11. VariationUsage / variant modeling

SysML v2 supports product-line variation modeling through `variation` and
`variant` keywords.  A `variation` feature owns mutually exclusive `variant`
usages; only one variant applies in each configuration.  For the graphical
notation, see **Figure 9** (Variant Membership) in SysML v2.0.

```sysml
part def Engine {
    variation part powerUnit {
        variant part gasolineEngine : GasolineEngine;
        variant part electricMotor  : ElectricMotor;
        variant part hybridPower    : HybridSystem;
    }
}
```

**Spec reference:** §7.6.7 Variation and Variant Usages (SysML v2.0).

---

## 12. Filtering elements

The **— Show all elements —** dropdown at the top-left lets you hide element
types you are not interested in (e.g. show only `part def` nodes to focus on
the structural decomposition).

---

## 13. Cross-file models

When a workspace folder is open in VS Code the plugin performs a two-phase
parse.  After Phase 2 completes, type edges that cross file boundaries (e.g. a
`part def` in one file typed by an `interface def` in another) appear as
normal `FeatureTyping` arrows.

---

## 14. Specification references

Both documents are freely available from the OMG website and the
[SysML-v2-Release GitHub repository](https://github.com/Systems-Modeling/SysML-v2-Release/tree/master/doc).

**SysML v2.0** — OMG formal/2026-03-02 · https://www.omg.org/spec/SysML/2.0/

| Topic | Clause | Key figures |
|---|---|---|
| Namespaces, packages, and imports | §7.5 | Figures 5–7 |
| Definition and Usage (general pattern, FeatureTyping) | §7.6 | Figure 8 |
| Reference Usages (bare `in`/`out` on a feature) | §7.6.4 | — |
| Variation and Variant Usages | §7.6.7 | Figure 9 |
| Attributes (`attribute def`, `attribute`) | §7.7 | Figure 10 |
| Enumerations (`enum def`) | §7.8 | Figure 11 |
| Occurrences (`occurrence def`, `event occurrence`) | §7.9 | Figures 12, 13 |
| Items (`item def`, `item`) | §7.10 | Figure 14 |
| Parts (`part def`, `part`) | §7.11 | Figures 15, 64 |
| Ports (`port def`, `port`, conjugated ports) | §7.12 | Figures 16, 17 |
| Connections (`connect`, `ConnectionUsage`, `SuccessionAsUsage`) | §7.13 | Figure 19 |
| Binding Connectors as Usages (`bind a = b`) | §7.13.3 | Figure 18 |
| Interfaces (`interface def`) | §7.14 | Figure 20 |
| Allocations (`allocation def`) | §7.15 | Figure 21 |
| Flows and Messages (`flow`, `flow connection`, `message`) | §7.16 | Figure 22 |
| States (`state def`) | §7.18 | Figures 30, 31 |
| Constraints (`constraint def`) | §7.20 | Figure 35 |
| Requirements (`requirement def`) | §7.21 | Figure 37 |
| Use Cases (`use case def`) | §7.25 | Figure 47 |
| Views and Viewpoints (`view def`, `viewpoint def`) | §7.26 | Figures 49, 50 |
| Metadata (`metadata def`) | §7.27 | Figure 54 |

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

## 15. Checklist before opening in the plugin

- [ ] The model contains at least one definition element (`part def`,
      `port def`, `item def`, etc.).
- [ ] The file (or its imports) is inside the open VS Code workspace folder.
- [ ] The **General** tab is selected in the visualizer panel.
- [ ] For specialization / subsetting arrows, use the `:>` / `:>>` keywords
      inside the same package so both ends are visible in the same graph.
