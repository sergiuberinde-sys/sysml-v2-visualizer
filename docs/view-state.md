# State View — State Machine Diagrams

The **State** view renders a state machine definition as a node-and-edge
diagram: states as boxes, an initial pseudo-state indicator, and labelled
transition arrows.

> **Availability note:** The State view is not shown as a tab in the official
> SysML v2 service mode tab bar.  To open it, click the state machine name
> in the **Model Explorer** panel (under *STATE MACHINES*) — the panel
> switches to the State view automatically.  Alternatively, switch to
> standalone / developer mode where the **State** tab appears directly.

![State view](img/state-overview.png)

---

## 1. SysML v2 elements used

| Element | Keyword | What it models |
|---|---|---|
| `StateDefinition` | `state def` | The state machine container |
| `StateUsage` | `state` | An individual state |
| Initial transition | `entry; then <State>;` | Marks the initial state |
| `SuccessionAsUsage` | `first X then Y;` | Unconditional transition |
| `TransitionUsage` (guarded) | `transition first X if <guard> then Y;` | Transition with a Boolean guard label |
| `TransitionUsage` (triggered) | `transition first X accept when <trigger> then Y;` | Transition with an event trigger label |
| Entry/do/exit hooks | `entry action` / `do action` / `exit action` | Behavior hooks on a state (parsed; not yet rendered visually) |

---

## 2. Minimal working example

```sysml
package TrafficLight {

    state def TrafficLightController {

        // State declarations
        state Red;
        state Green;
        state Yellow;

        // Initial transition — marks Red as the starting state.
        entry; then Red;

        // Guarded transitions (loop).  The guard name appears on the arrow.
        transition first Red    if timer then Green;
        transition first Green  if timer then Yellow;
        transition first Yellow if timer then Red;
    }
}
```

The `transition first X if <guard> then Y` form creates a `TransitionUsage`
(a subtype of `SuccessionUsage`) that connects two states.  The guard
expression label is rendered on the transition arrow.

---

## 3. Guarded and triggered transitions

```sysml
state def ConnectionFSM {

    state Idle;
    state Connecting;
    state Connected;
    state Error;

    entry; then Idle;

    transition first Idle
        accept when connectRequested;
        then Connecting;

    transition first Connecting
        accept when connectionAck;
        then Connected;

    transition first Connecting
        accept when timeout;
        then Error;

    transition first Connected
        accept when disconnect;
        then Idle;
}
```

- `accept when <trigger>` attaches an event trigger to the transition; the
  plugin renders the trigger name as the edge label.
- `if <guard>` attaches a Boolean condition; the plugin renders the attribute
  name as the edge label.
- Multiple outgoing transitions from the same state are drawn as separate
  edges.

---

## 4. Layout: forward vs. backward transitions

The view assigns each state a vertical level based on the succession graph and
lays them out top-to-bottom:

- **Forward transitions** (source level < target level) are drawn straight
  downward — bottom of source box to top of target box.
- **Backward transitions** (loop-backs, source level ≥ target level) are
  routed to the left, exiting and entering on the left side of each box.

This keeps the diagram clean even for machines with cycle transitions.

---

## 5. Entry, do, and exit actions on a state

```sysml
state def Device {
    state Initialising {
        entry action runSelfTest;
        do    action monitorHealth;
        exit  action flushBuffers;
    }
    state Running;

    entry; then Initialising;
    transition first Initialising then Running;
}
```

- `entry action`, `do action`, and `exit action` declare behavior hooks on
  a state.
- These are parsed and appear in the containment graph but are **not yet
  rendered** as annotations inside the state box.  The state name is still
  shown correctly; only the hook labels are absent.

---

## 6. Nested sub-states (composite states)

A `state` may itself contain nested state declarations and transitions, creating
a hierarchical (composite) state machine.  For the graphical notation, see
**Figure 31** (State Membership) in SysML v2.0.

```sysml
state def OperationalFSM {

    state Idle;

    state Active {
        state Initializing;
        state Running;
        state Pausing;

        entry; then Initializing;
        transition first Initializing then Running;
        transition first Running if pauseRequested then Pausing;
        transition first Pausing  then Running;
    }

    state Shutdown;

    entry; then Idle;
    transition first Idle   if startRequested then Active;
    transition first Active if stopRequested  then Shutdown;
}
```

- `Active` is a composite state whose sub-states have their own initial
  transition and their own `transition` statements.

**Spec reference:** §7.18.2 State Definitions and Usages (SysML v2.0).

---

## 7. Concurrent (parallel) regions

SysML v2 supports composite states with concurrent (parallel) sub-regions.
Parallel regions are separated by a dashed divider inside the composite state
box and run simultaneously.

```sysml
state def SystemFSM {

    state Running {
        // PowerManagement region
        state PowerNominal;
        state PowerSaving;
        entry; then PowerNominal;
        transition first PowerNominal if lowBattery then PowerSaving;
        transition first PowerSaving  if charged    then PowerNominal;

        // DataProcessing region
        state DataIdle;
        state DataActive;
        entry; then DataIdle;
        transition first DataIdle   if requestArrived then DataActive;
        transition first DataActive if requestDone    then DataIdle;
    }

    state Stopped;

    entry; then Running;
    transition first Running if shutdown then Stopped;
}
```

**Spec reference:** §7.18.2 State Definitions and Usages (SysML v2.0).

---

## 8. ExhibitStateUsage

`exhibit state` is the state-machine analogue of `perform action` — it
references a named `state def` as a used sub-behavior rather than defining the
state machine inline.  For the graphical notation, see **Figure 32** (Exhibited
States) in SysML v2.0.

```sysml
state def TrafficLightController {
    state Red;
    state Green;
    state Yellow;

    entry; then Red;
    transition first Red    if timer then Green;
    transition first Green  if timer then Yellow;
    transition first Yellow if timer then Red;
}

part def Intersection {
    exhibit state controller : TrafficLightController;
}
```

**Spec reference:** §7.18.4 Exhibit State Usages (SysML v2.0).

---

## 9. Entry / do / exit action annotations on a state

`entry action`, `do action`, and `exit action` hooks declare behavior executed
when a state is entered, sustained, or exited.  The standard graphical notation
(see **Figure 30**, State Definition and Usage, in SysML v2.0) shows these as a
lower compartment inside the state box:

```
┌──────────────────────────┐
│       Initialising       │
├──────────────────────────┤
│ entry / runSelfTest      │
│ do    / monitorHealth    │
│ exit  / flushBuffers     │
└──────────────────────────┘
```

**Spec reference:** §7.18.2 State Definitions and Usages (SysML v2.0).

---

## 10. Multiple state machines in one file

A file can contain many `state def` blocks.  Each one appears under
*STATE MACHINES* in the Model Explorer.  Click the name to open it in the
State view.

---

## 11. Common modelling mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| `state def` missing `entry; then X;` | No initial state indicator | Add `entry; then <FirstStateName>;` |
| `transition first X then Y` targeting an unknown state name | Edge not drawn | Ensure both state names are declared with `state` inside the same `state def` |
| Very large state machine (20+ states) | Layout overlaps | Use a scoped sub-state or break into multiple smaller `state def` blocks |
| Using `first X then Y` (succession) instead of `transition first X then Y` | Edge rendered without label | Use `transition first … then …` to get guard/trigger labelling |

---

## 12. Specification references

Both documents are freely available from the OMG website and the
[SysML-v2-Release GitHub repository](https://github.com/Systems-Modeling/SysML-v2-Release/tree/master/doc).

**SysML v2.0** — OMG formal/2026-03-02 · https://www.omg.org/spec/SysML/2.0/

| Topic | Clause | Key figures |
|---|---|---|
| States overview and semantics | §7.18 | — |
| State Definitions and Usages (`state def`, `state`, composite states) | §7.18.2 | Figures 30, 31 |
| Transition Usages (`transition first X … then Y`) | §7.18.3 | Figure 33 |
| Exhibit State Usages (`exhibit state`) | §7.18.4 | Figure 32 |
| Actions — used as entry/do/exit hooks on states | §7.17 | — |
| Conditional Successions — guard expressions on transitions | §7.17.5 | — |
| Accept Action Usages — `accept when <trigger>` syntax | §7.17.8 | Figure 26 |

**KerML v1.0** — OMG formal/2026-03-01 · https://www.omg.org/spec/KerML/1.0/

| Topic | Clause |
|---|---|
| Succession Declaration (ordering between steps/states) | §7.4.6.4 |
| Behaviors and Steps (execution model underlying states) | §7.4.7 |
| Transition Performances (formal semantics of transitions) | §9.2.10 |

---

## 13. Checklist before opening in the plugin

- [ ] The `state def` contains at least two `state` declarations.
- [ ] At least one `transition first X then Y` statement is present.
- [ ] An initial transition `entry; then <State>;` marks the start state.
- [ ] The state machine name appears in the Model Explorer under
      *STATE MACHINES*.
- [ ] Click the name in the Model Explorer to activate the State view.
