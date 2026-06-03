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
| `TransitionUsage` | `transition first X then Y;` | An unconditional transition |
| Guarded transition | `transition first X accept when <trigger>; then Y;` | Transition with a trigger or guard |

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

        // Unconditional transitions (loop).
        transition first Red    then Green;
        transition first Green  then Yellow;
        transition first Yellow then Red;
    }
}
```

The `transition first X then Y` form creates a `TransitionUsage` (a
subtype of `SuccessionUsage`) that connects two states.

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

- `accept when <trigger>` attaches a trigger to the transition, which the
  plugin renders as the edge label.
- Trigger names appear above the transition arrow.
- Multiple outgoing transitions from the same state are drawn as separate
  edges.

---

## 4. Entry, do, and exit actions on a state

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
- These are recognised by the SysML v2 parser but may be rendered as
  annotations inside the state box depending on the plugin version.

---

## 5. Multiple state machines in one file

A file can contain many `state def` blocks.  Each one appears under
*STATE MACHINES* in the Model Explorer.  Click the name to open it in the
State view.

---

## 6. Current rendering support

| Feature | Supported |
|---|---|
| State boxes with name | ✓ |
| Initial pseudo-state (`entry; then X`) | ✓ |
| Transition edges with labels | ✓ (via transition trigger label) |
| Guard expressions on transitions | Partial — guard label may not appear |
| `entry`/`do`/`exit` action annotations | Not yet rendered |

Transition rendering requires that the Java parser produces `TransitionUsage`
nodes in the model tree.  If a transition does not appear, verify that the
file parses without errors (0 errors in Model Health) and that the workspace
folder is open so Phase 2 completes.

---

## 7. Common modelling mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| `state def` missing `entry; then X;` | No initial state indicator | Add `entry; then <FirstStateName>;` |
| `transition first X then Y` targeting an unknown state name | Edge not drawn | Ensure both state names are declared with `state` inside the same `state def` |
| Very large state machine (20+ states) | Layout overlaps | Use a scoped sub-state or break into multiple smaller `state def` blocks |

---

## 8. Checklist before opening in the plugin

- [ ] The `state def` contains at least two `state` declarations.
- [ ] At least one `transition first X then Y` statement is present.
- [ ] An initial transition `entry; then <State>;` marks the start state.
- [ ] The state machine name appears in the Model Explorer under
      *STATE MACHINES*.
- [ ] Click the name in the Model Explorer to activate the State view.
