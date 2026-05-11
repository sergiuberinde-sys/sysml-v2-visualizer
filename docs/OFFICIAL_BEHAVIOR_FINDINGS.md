# Official SysML v2 Conditional Behavior — Findings

Research conducted against **Pilot Implementation 0.59.0-SNAPSHOT** (the JAR bundled in
`java-parser-wrapper/lib/`).  All examples were run through our Java wrapper with the
`--debug` flag to capture the raw EMF containment tree.

---

## 1. Validated minimal example

### Source

```sysml
package MinimalConditionalBehavior {
    action def Guarded {
        action a;
        action b;
        attribute ready : ScalarValues::Boolean;
        first a if ready then b;
    }
}
```

Parser result: `success: true`, zero diagnostics.

### Syntax rule

```
first <source> if <guard-expr> then <target> ;
```

This is standard SysML v2 **guarded succession** syntax.  The guard expression is any
boolean-valued feature reference or literal.

---

## 2. EMF structure — `TransitionUsage`

The `first a if ready then b;` statement produces a **`TransitionUsage`** node (not a
`SuccessionAsUsage`).  Its child layout (verified via `--debug` output) is:

```
TransitionUsage
  Membership 'a'                          ← source action (cross-ref resolved by wrapper)
  ParameterMembership
    ReferenceUsage [in]                   ← internal parameter node (ignored)
  TransitionFeatureMembership             ← guard container
    FeatureReferenceExpression
      Membership 'ready'                  ← guard feature name (cross-ref resolved!)
  OwningMembership
    SuccessionAsUsage                     ← the actual flow edge
      EndFeatureMembership
        ReferenceUsage
      EndFeatureMembership
        ReferenceUsage
          ReferenceSubsetting 'b'         ← target action name (resolved)
```

### Key EMF eClass names

| eClass | Role |
|---|---|
| `TransitionUsage` | Top-level guarded-succession node |
| `TransitionFeatureMembership` | Wrapper for the guard expression |
| `FeatureReferenceExpression` | Guard expression (feature ref) |
| `Membership` (child of `FeatureReferenceExpression`) | Cross-ref resolved to guard feature name |
| `OwningMembership` → `SuccessionAsUsage` | The actual successor arc |
| `ReferenceSubsetting` (inside `SuccessionAsUsage`) | Target action name |

### Extraction recipe (for `behaviorBuilder.ts`)

```
source  = Membership.name   (child[0] of TransitionUsage)
guard   = TransitionFeatureMembership → FeatureReferenceExpression → Membership.name
target  = OwningMembership → SuccessionAsUsage → … → ReferenceSubsetting.name
```

Both `source` and `guard` names are already resolved by the Java wrapper's
`crossRefName(obj, "memberElement")` call on `Membership` nodes.

---

## 3. Unguarded vs. guarded succession comparison

| Syntax | EMF type |
|---|---|
| `succession first a then b;` | `SuccessionAsUsage` |
| `first a if guard then b;` | `TransitionUsage` (contains a `SuccessionAsUsage` child) |

A `TransitionUsage` always wraps a `SuccessionAsUsage` for the actual flow edge.
The guard is surfaced via `TransitionFeatureMembership`, not a direct attribute.

---

## 4. Conditional blocks — `IfActionUsage` / `WhileLoopActionUsage`

Separately confirmed (earlier research, also integrated into `behaviorBuilder.ts`):

| Syntax | EMF type |
|---|---|
| `if cond { … } else { … }` | `IfActionUsage` |
| `loop { … } until cond` | `WhileLoopActionUsage` |

Structure for `IfActionUsage`:

```
IfActionUsage
  ParameterMembership[0]                  ← condition expression
    LiteralBoolean  name="true"/"false"
    — OR —
    FeatureReferenceExpression
      Membership  name="<feature>"
  ParameterMembership[1]                  ← then-block
    ActionUsage [in] (anonymous)          ← transparent container
      ActionUsage 'doSomething'
      SuccessionAsUsage …
  ParameterMembership[2]  (optional)      ← else-block
    ActionUsage [in] (anonymous)
```

Anonymous `ActionUsage` nodes with `direction: 'in'` and `name: null` are transparent
branch containers and should NOT be extracted as action entries.

---

## 5. Control-flow nodes

These appear in more complex diagrams (e.g. the official training "Decision Example"):

| eClass | Meaning |
|---|---|
| `DecisionNode` | Explicit decision diamond |
| `MergeNode` | Merge point |
| `ForkNode` | Fork into parallel branches |
| `JoinNode` | Join after parallel branches |

All four have been validated and are extracted as `BehaviorAction` entries in
`behaviorBuilder.ts`.

---

## 6. Known Pilot Implementation bug — `DecisionNode` + `SuccessionAsUsage`

**Symptom**: NPE thrown inside `SuccessionAsUsageAdapter.addDecisionNodeOutgoingSuccessionSpecialization`
when a `SuccessionAsUsage` is the outgoing edge of a `DecisionNode`.

**Affected version**: 0.59.0-SNAPSHOT.

**Impact**: `--debug` traversal crashes mid-tree when it tries to iterate `eContents()`
on a `SuccessionAsUsage` adjacent to a `DecisionNode`.

**Mitigation in the wrapper**: `buildNode()` and `collectDebugEntries()` both wrap
`eContents()` access and individual child visits in `try-catch`.  The affected subtree
is silently skipped rather than crashing the whole parse.

---

## 7. What can safely be extracted next

1. **`TransitionUsage` → guarded flow** — extract `source`, `guardName`, and `target` names.
   Results in a new `BehaviorFlow` variant, e.g. `{ type: 'transition', source, target, guard }`.

2. **`IfActionUsage` / `WhileLoopActionUsage`** — already fully extracted into
   `BehaviorConditional` by `behaviorBuilder.ts`.

3. **`DecisionNode`/`MergeNode`/`ForkNode`/`JoinNode`** — already extracted as
   `BehaviorAction` entries with their EMF type as the `type` field.

4. **Guard literal values** (`LiteralBoolean true/false`) — already resolved by the
   Java wrapper and surfaced as `Membership.name`.

---

## 8. What NOT to implement yet

- Do not invent `guard` fields on `SuccessionAsUsage` — unguarded successions never carry
  a guard in the EMF model.
- Do not attempt to parse `TransitionUsage` guard expressions beyond `FeatureReferenceExpression`
  and `LiteralBoolean` — arbitrary expressions (e.g. comparisons) are not yet seen in
  validated examples.
- Do not enable `DecisionNode`-originating `SuccessionAsUsage` flow extraction until the
  Pilot Implementation NPE is fixed upstream.
