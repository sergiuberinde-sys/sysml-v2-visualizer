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

Parser result: `success: false` (cross-reference to `ScalarValues::Boolean` cannot be resolved
without the standard library), zero diagnostics, model fully present.
The `TransitionUsage` node is extracted correctly regardless of success flag.

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

## 7. Guard expression variants tested

All four variants were run through the Java wrapper (`--debug` mode) to inspect raw EMF features.
`success: false` in cases below is due to the standalone JAR not loading the SysML standard
library (`ScalarValues`); the guard expression itself parses correctly in all cases.

### Results table

| Guard form | Syntax example | `success` | EMF structure | Extractable now | Guard text |
|---|---|---|---|---|---|
| Feature reference | `if ready then` | false* | `FeatureReferenceExpression → Membership "ready"` | ✅ | `"ready"` |
| Boolean literal | `if true then` | **true** | `LiteralBoolean "true"` (direct child of TFM) | ✅ | `"true"` |
| Negated reference | `if not ready then` | false* | `OperatorExpression(operator="not") → … → "ready"` | ❌ now | future |
| Comparison | `if value > limit then` | false* | `OperatorExpression(operator=">") → "value", "limit"` | ❌ now | future |

\* `success: false` due to missing `ScalarValues` library, not an error in the guard expression.

### EMF details — feature reference guard (already supported)

```
TransitionFeatureMembership
  FeatureReferenceExpression
    Membership "ready"          ← name resolved via memberElement cross-ref
```

### EMF details — boolean literal guard (already supported)

```
TransitionFeatureMembership
  LiteralBoolean "true"         ← name resolved via literalValue("value")
```

Note: `LiteralBoolean` is a **direct** child of `TransitionFeatureMembership`, NOT nested inside
`FeatureReferenceExpression`.  The current `extractGuardName()` handles this via a fallback check.

### EMF details — negated reference guard (future work)

```
TransitionFeatureMembership
  OperatorExpression                        ← no name in containment tree
    ParameterMembership
      Feature [in]
        FeatureValue
          FeatureReferenceExpression
            Membership "ready"
```

Debug `--debug` reveals `OperatorExpression.features.operator = "not"` — a native EMF string
attribute.  To surface this in the normal parse output, the Java wrapper would need:

```java
if ("OperatorExpression".equals(emfType) && name == null) {
    name = literalValue(obj, "operator");   // emits "not" as the node name
}
```

With that, `extractGuardName()` could reconstruct `"not ready"` from the operator node name
plus the first operand's `FeatureReferenceExpression → Membership.name`.

### EMF details — comparison guard (future work)

```
TransitionFeatureMembership
  OperatorExpression                        ← operator = ">"
    ParameterMembership                     ← operand 1
      Feature [in]
        FeatureValue
          FeatureReferenceExpression
            Membership "value"
    ParameterMembership                     ← operand 2
      Feature [in]
        FeatureValue
          FeatureReferenceExpression
            Membership "limit"
```

`OperatorExpression.features.operator = ">"`.  With the same Java wrapper change above,
`extractGuardName()` could produce `"value > limit"` from operator + two operand names.

### What the current `extractGuardName()` does for unknown forms

When neither `FeatureReferenceExpression` nor `LiteralBoolean` is a direct child of
`TransitionFeatureMembership`, `extractGuardName()` returns `undefined`.  The flow is still
emitted as `{ type: 'transition', source, target }` — no guard label, but the edge renders.

---

## 8. What can safely be extracted next

1. **`TransitionUsage` → guarded flow** — ✅ implemented.  Emits
   `{ type: 'transition', source, target, guard? }`.

2. **`IfActionUsage` / `WhileLoopActionUsage`** — ✅ implemented.  Extracted into
   `BehaviorConditional` entries by `behaviorBuilder.ts`.

3. **`DecisionNode`/`MergeNode`/`ForkNode`/`JoinNode`** — ✅ implemented.  Extracted as
   `BehaviorAction` entries.

4. **`LiteralBoolean` guard values** — ✅ implemented.  The Java wrapper resolves
   `LiteralBoolean.value → name`; `extractGuardName()` reads it directly.

5. **`OperatorExpression` guards** (future) — requires adding
   `name = literalValue(obj, "operator")` to the Java wrapper's `buildNode()` for
   `OperatorExpression` nodes, then extending `extractGuardName()` to recurse into
   operand `FeatureReferenceExpression` children.

---

## 9. What NOT to implement

- Do not invent `guard` fields on `SuccessionAsUsage` — unguarded successions never carry
  a guard in the EMF model.
- Do not emit guard text by string-scanning source text or by parsing node `name` fields
  that were not set by the Java wrapper from official EMF attributes.
- Do not enable `DecisionNode`-originating `SuccessionAsUsage` flow extraction until the
  Pilot Implementation NPE is fixed upstream.
