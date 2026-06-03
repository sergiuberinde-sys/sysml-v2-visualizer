# Actions View — Behavior Flows

The **Actions** tab renders the execution flow of a named action definition:
steps as boxes, sequencing arrows between them, guarded decision branches, and
parallel fork/join paths.

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

## 6. Multiple behaviors in one file

A file can contain many `action def` blocks.  The Actions view shows a
selector dropdown above the diagram; choose the definition you want to
inspect.  Only top-level `action def` elements appear in the list.

---

## 7. Cross-file references

`perform action` usages that call an action defined in another file resolve
their type name after Phase 2 completes.  The step box is labelled
`name : TypeName`; if the type cannot be resolved, only `name` is shown.

---

## 8. Common modelling mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Guard attribute not in scope | Guard label shows as `[condition]` | Declare `attribute name : Boolean` before the `action def` or inside it |
| No `first … then …` statements | Empty diagram | Add at least one succession to wire the steps |
| Cycle with no exit | Diagram renders but has no terminal node | Add a guard or a separate exit step |
| `PerformActionUsage` typed by an unknown definition | Step box shows no type label | Open the containing folder so Phase 2 resolves cross-file types |

---

## 9. Checklist before opening in the plugin

- [ ] The `action def` contains at least two `action` steps.
- [ ] Each step is connected by at least one `first … then …` succession.
- [ ] Boolean guard attributes are declared in scope before use.
- [ ] The **Actions** tab is selected in the visualizer panel.
- [ ] If multiple `action def` blocks exist, select the desired one from the
      dropdown.
