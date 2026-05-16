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

## 4. Conditional and loop blocks — `IfActionUsage` / `WhileLoopActionUsage`

### IfActionUsage — validated structure

Syntax: `if cond { … } else { … }`

```
IfActionUsage
  ParameterMembership[0]                  ← condition (FeatureReferenceExpression [in])
    FeatureReferenceExpression [in]
      Membership "ready"                  ← cross-ref resolved to feature name
    — OR —
    LiteralBoolean "true"/"false"         ← direct child of ParameterMembership[0]
  ParameterMembership[1]                  ← then-block
    ActionUsage [in] (anonymous)          ← transparent container
      FeatureMembership
        ActionUsage "ok"                  ← real then-action
  ParameterMembership[2]  (optional)      ← else-block
    ActionUsage [in] (anonymous)
      FeatureMembership
        ActionUsage "fault"               ← real else-action
```

Note: the condition is a `FeatureReferenceExpression [in]` (with `direction: 'in'`), not a
bare `FeatureReferenceExpression`.  `extractCondition()` matches on `type` only, so the
direction field is irrelevant.  Branch actions are wrapped in `FeatureMembership`, not
direct children of the anonymous container — handled transparently by `visit()`.

### WhileLoopActionUsage — two syntactic forms

Both forms share `WhileLoopActionUsage` as the EMF type, but the condition position differs.

#### Form 1 — `while cond { body }` (pre-condition)

```
WhileLoopActionUsage
  ParameterMembership[0]                  ← while-condition
    FeatureReferenceExpression [in]
      Membership "ready"
  ParameterMembership[1]                  ← loop body
    ActionUsage [in] (anonymous)
      FeatureMembership
        ActionUsage "step"
```

Condition is at `children[0]`.

#### Form 2 — `loop { body } until cond` (post-condition / do-while)

```
WhileLoopActionUsage
  ParameterMembership[0]                  ← empty "while" param — always a ReferenceUsage [in]
    ReferenceUsage [in]
  ParameterMembership[1]                  ← loop body (same position as Form 1)
    ActionUsage [in] (anonymous)
      FeatureMembership
        ActionUsage "step"
  ParameterMembership[2]                  ← until-condition
    FeatureReferenceExpression [in]
      Membership "done"
```

Condition is at `children[2]`.  `children[0]` is a placeholder `ReferenceUsage [in]`
(its `name` is `null`); `extractCondition()` returns `{ kind: 'Expression', text: undefined }`
for it, signalling the fallback to `children[2]`.

#### Extraction rule in `behaviorBuilder.ts`

```typescript
let condition = extractCondition(node.children[0]);
if (condition.text === undefined && node.children[2] !== undefined) {
  condition = extractCondition(node.children[2]);  // 'loop ... until' form
}
```

Both forms produce identical `BehaviorConditional` entries — the consumer cannot tell which
form was used.  Body is always at `children[1]` for both forms.

### Anonymous container transparency

Anonymous `ActionUsage` nodes with `direction: 'in'` and `name: null` are transparent
in `visit()` — they are never pushed as action entries.  Direct body actions are wrapped
in `FeatureMembership` inside the container; the transparent wrapper case in `visit()`
recurses through it automatically.

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
   `BehaviorAction` entries and rendered in `OfficialBehaviorView` as teal `«decide»` /
   `«fork»` / `«join»` / `«merge»` nodes.  Outgoing edges from `DecisionNode` remain
   unresolved (see §6, §10) and are filtered out of the renderer.

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

---

## 10. Control node validation (Pilot Implementation 0.59.0-SNAPSHOT)

Validated against the standalone JAR with `--debug`.  All four node types were confirmed
to parse without errors and traverse without NPE.

### Examples used

**ForkNode / JoinNode** — smallest passing example:

```sysml
package ForkTest {
    action def A; action def B; action def C; action def D;
    action def Flow {
        action a : A;
        fork;
        action b : B;
        action c : C;
        join;
        action d : D;
    }
}
```

Parser result: `success: true`, zero diagnostics.

**MergeNode** — smallest passing example:

```sysml
package MergeTest {
    action def A; action def B; action def C;
    action def Flow {
        action a : A;
        action b : B;
        merge;
        action c : C;
    }
}
```

Parser result: `success: true`, zero diagnostics.

**DecisionNode (unnamed, no successions)** — smallest passing example:

```sysml
package DecideSolo {
    action def A;
    action def Flow {
        action a : A;
        decide;
    }
}
```

Parser result: `success: true`, zero diagnostics.

**DecisionNode (named, with explicit successions)** — successor-edge stress test:

```sysml
package Decision5 {
    action def A; action def B; action def C;
    action def Flow {
        action a : A;
        decide d;
        action b : B;
        action c : C;
        succession first a then d;
        succession first d then b;
        succession first d then c;
    }
}
```

Parser result: `success: true`, zero diagnostics.

---

### EMF structure — all four node types

All four appear identically inside the model tree: wrapped in a `FeatureMembership`
with no children.

```
FeatureMembership
  ForkNode      (name: null)     ← or JoinNode / MergeNode / DecisionNode
```

Named variants (`decide d;`) carry `name: "d"`.

---

### `--debug` traversal safety

| Node type | With successions? | Debug traversal | NPE? |
|---|---|---|---|
| `ForkNode` | no | ✅ clean | no |
| `JoinNode` | no | ✅ clean | no |
| `MergeNode` | no | ✅ clean | no |
| `DecisionNode` | no (solo `decide;`) | ✅ clean | no |
| `DecisionNode` | yes — outgoing only | ✅ clean (try-catch skips empty subtrees) | adapter-level only |

The Pilot NPE documented in §6 occurs inside EMF adapter initialization, not in
the `eContents()` traversal our wrapper performs.  The try-catch guards in
`collectDebugEntries()` and `buildNode()` are sufficient mitigation — the wrapper
completes traversal and the node is present in the model output.

---

### What the outgoing DecisionNode SuccessionAsUsage looks like

`succession first d then b;` (outgoing from a `DecisionNode`) produces:

```
SuccessionAsUsage
  EndFeatureMembership   ← empty, no ReferenceUsage child
  EndFeatureMembership   ← empty, no ReferenceUsage child
```

Both endpoint memberships are empty — `extractEndpointNames()` returns `[]`.
The flow is pushed as `{ unresolved: true }` and is **filtered out** of the
renderer (only resolved flows with `source` and `target` are drawn).

The **incoming** succession `succession first a then d;` resolves normally:

```
SuccessionAsUsage
  EndFeatureMembership → ReferenceUsage → ReferenceSubsetting "a"
  EndFeatureMembership → ReferenceUsage → ReferenceSubsetting "d"
```

---

### Invalid syntax rejected

`decide; then action b; else action c;` — **not valid SysML v2 syntax**.  The
parser rejects the `then` and `else` keywords; they are not part of the
`ActionBodyStatement` grammar rule.  Do not use this form.

---

### What is safely rendered

| Control node | Syntax | Rendered? | Edges rendered? |
|---|---|---|---|
| `ForkNode` | `fork;` | ✅ as `«fork»` node | ❌ no implicit edges extracted |
| `JoinNode` | `join;` | ✅ as `«join»` node | ❌ no implicit edges extracted |
| `MergeNode` | `merge;` | ✅ as `«merge»` node | ❌ no implicit edges extracted |
| `DecisionNode` (no successions) | `decide;` | ✅ as `«decide»` node | ❌ no edges |
| `DecisionNode` (incoming succession) | `succession first a then d;` | ✅ node + edge `a → d` | ✅ incoming edge safe |
| `DecisionNode` (outgoing successions) | `succession first d then b;` | ✅ node only | ❌ outgoing edges unresolved — filtered out |

---

## 11. Action reuse / invocation semantics

Research conducted 2026-05-12.  All examples run through `sysml-parse-cli.jar` with
`--debug`; Java 21 required (class-file version 65).

### 11.1 Research question

Does official SysML v2 give us safe "call-like" relationships between action definitions?
What EMF types carry those relationships, and which are visualizable without fabricating runtime semantics?

### 11.2 EMF types examined

Seven syntactic forms were tested with the standalone JAR.

#### Form A — ActionUsage typed by ActionDefinition (already implemented)

```sysml
action def Read   { action fetch;    }
action def Pipeline {
    action r : Read;
    ...
}
```

**Result: `success: true`.**

```
ActionUsage "r"
  FeatureTyping "Read"     ← cross-ref to ActionDefinition "Read"
```

**Semantic**: `r` is a feature occurrence that *conforms to type* `Read`.  This is type
conformance — the SysML equivalent of "here is an action slot whose classifier is `Read`".
It is **not** a procedure call or invocation.

**Already in our system**: the containment graph produces a `typedBy` edge
`(ActionUsage "r") → (ActionDefinition "Read")`, surfaced in the Inspector under
"Used as type by" when selecting `Read`.

**What can be shown**: "r is typed by Read" — a classifier relationship.
**What must not be said**: "r invokes Read", "r calls Read", "Read is executed here".

---

#### Form B — PerformActionUsage (inline)

```sysml
action def Calibrate { action measure; action adjust; succession first measure then adjust; }

action def ControlLoop {
    action init;
    perform action cal : Calibrate;
    action execute;
    succession first init then cal;
    succession first cal then execute;
}
```

**Result: `success: true`.**

```
PerformActionUsage "cal"
  FeatureTyping "Calibrate"    ← cross-ref to ActionDefinition "Calibrate"
```

The `--debug` output on the `PerformActionUsage` node shows:

```
"type": [ActionDefinition "Calibrate"]
"actionDefinition": [ActionDefinition "Calibrate"]
"performedAction": {PerformActionUsage "cal"}    ← self-reference
"behavior": [ActionDefinition "Calibrate"]
"inheritedMembership": [FeatureMembership, FeatureMembership, FeatureMembership]
"member": ["measure", "adjust", SuccessionAsUsage]   ← INHERITED from Calibrate
```

Key observations:
- `performedAction` is **self-referential** — it points back to `cal` itself, not to `Calibrate`.
  This is the SysML v2 specification's way of saying "this occurrence IS the performed action".
- The `member` list includes `measure`, `adjust`, and the succession *via inheritance*, not via
  containment.  These are not separate contained steps in `ControlLoop`.
- In succession chains, `PerformActionUsage "cal"` participates **identically** to a plain
  `ActionUsage`: `succession first init then cal;` resolves with source=`init`, target=`cal`.

**Semantic**: `perform action cal : Calibrate` asserts that occurrence `cal` in this context
performs the behavior defined by `Calibrate`.  It is a *classifier conformance with perform
semantics*, not a sub-routine call.  The internal steps of `Calibrate` (measure, adjust) do
not appear as nodes in `ControlLoop`'s behavior graph.

**Safe to visualize**: `cal` as a node labelled `«perform»` or `cal : Calibrate` in
`ControlLoop`'s flow, with a `typedBy` edge to `Calibrate`.  The succession edges `init → cal`
and `cal → execute` are fully resolved and safe.

**Not safe**: Drawing edges from `ControlLoop`'s flow into `Calibrate`'s internal actions.
`Calibrate`'s internal structure is a separate behavior definition.

---

#### Form C — PerformActionUsage (two-step: declare then perform)

```sysml
action def Main {
    action sub : SubA;
    perform sub;
}
```

**Result: `success: true`.**

```
ActionUsage "sub"
  FeatureTyping "SubA"

PerformActionUsage "sub"
  ReferenceSubsetting "sub"    ← points to the pre-declared ActionUsage
```

Both nodes share the same name `"sub"`.  The `PerformActionUsage` carries a
`ReferenceSubsetting` child (not a `FeatureTyping`) because it is referencing a pre-declared
usage rather than typing inline.

**Extractor note**: When walking the containment tree, both `ActionUsage "sub"` and
`PerformActionUsage "sub"` appear as siblings under `FeatureMembership`.  Our current
`behaviorBuilder.ts` would emit two entries for the same name.  This form is rare in practice;
prefer the inline `perform action sub : SubA;` form.

---

#### Form D — AcceptActionUsage

```sysml
action def Handler {
    accept start : StartSignal;
    action process;
    succession first start then process;
}
```

**Result: `success: false`** (cross-ref to `StartSignal` fails without stdlib, but the structure
is present).

```
AcceptActionUsage                  name: null  ← the accept itself is ANONYMOUS
  ParameterMembership
    ReferenceUsage "start"  [in]   ← trigger binding variable
      FeatureTyping "StartSignal"  ← (null if cross-ref fails)
```

**Critical finding — succession source is unresolvable**:

`succession first start then process;` produces:

```
SuccessionAsUsage
  EndFeatureMembership
    ReferenceUsage
      ReferenceSubsetting  name: null    ← source endpoint UNRESOLVED
  EndFeatureMembership
    ReferenceUsage
      ReferenceSubsetting "process"      ← target resolves fine
```

The source `ReferenceSubsetting` is `null` because `start` is a *parameter binding* inside
`AcceptActionUsage`, not a named peer-level feature accessible from the enclosing scope.
The parser resolves `start` in the succession but the wrapper cannot extract its name via
the standard `ReferenceSubsetting.name` path.

**What is safe**: Recognising `AcceptActionUsage` as an event-wait node.  The trigger type
(`StartSignal`) is readable from `ParameterMembership → ReferenceUsage → FeatureTyping.name`.

**What must not be done**: Using `AcceptActionUsage` as a named source in a succession flow —
the source endpoint is unresolvable and the flow must be treated as unresolved.

---

#### Form E — SendActionUsage

```sysml
action def SendAction {
    out port out1;
    send Signal() to out1;
}
```

**Result: `success: true`.**

```
SendActionUsage    name: null
  ParameterMembership [0]          ← payload
    ReferenceUsage [in]
      FeatureValue
        InvocationExpression
          Membership "Signal"      ← signal type name
  ParameterMembership [1]          ← via clause (empty)
    ReferenceUsage [in]
  ParameterMembership [2]          ← receiver
    ReferenceUsage [in]
      FeatureValue
        FeatureReferenceExpression
          Membership "out1"        ← receiver port name
```

`SendActionUsage` is structurally equivalent to a function call expression.  It has no `name`,
does not participate in succession chains, and its payload/receiver are buried three levels
deep in `ParameterMembership` chains.

**Safe**: Recognising `SendActionUsage` exists and noting the signal type name.
**Not safe**: Treating `SendActionUsage` as a named action node or succession endpoint.
Extraction would require dedicated handling of the `ParameterMembership` chain.

---

#### Form F — ExhibitStateUsage

```sysml
action def Main {
    exhibit state sm : ControlSM;
}
```

**Result: `success: true`.**

```
ExhibitStateUsage "sm"
  FeatureTyping "ControlSM"
```

Structurally identical to `PerformActionUsage` but for `StateDefinition` types.
The `name` is present when the state usage is named inline.

**Safe**: Treating `ExhibitStateUsage` like `PerformActionUsage` — it is a named occurrence
in the parent action's flow, typed by a `StateDefinition`.  Succession edges work normally.
Can be shown as `«exhibit»` or `sm : ControlSM` in the behavior graph.

---

#### Form G — Cross-definition composition (key negative result)

```sysml
action def Initialize { action setup; action calibrate; succession first setup then calibrate; }
action def Process    { action transform; action validate; succession first transform then validate; }

action def Pipeline {
    action init : Initialize;
    action proc : Process;
    succession first init then proc;
}
```

**Result: `success: true`.**

```
ActionDefinition "Pipeline"
  ActionUsage "init"  →  FeatureTyping "Initialize"
  ActionUsage "proc"  →  FeatureTyping "Process"
  SuccessionAsUsage   →  source "init",  target "proc"
```

**There is no edge** from `Pipeline`'s containment tree into `Initialize`'s internal actions
(`setup`, `calibrate`).  The `--debug` output confirms that `init`'s `inheritedMembership`
includes `Initialize`'s internal features, but these are *inherited*, not *contained*:
they live in `Initialize`'s own subtree and do not appear as nodes in `Pipeline`'s
containment children.

The succession `first init then proc` is a *temporal ordering* of two typed occurrences
within `Pipeline`.  It has no connection to Initialize's internal `setup → calibrate` chain.

**Verdict**: Cross-definition composition in SysML v2 is type conformance, not invocation.
There are no call edges between `Pipeline` and the internals of `Initialize` or `Process`.

---

### 11.3 EMF eClass summary

| eClass | Syntax | Name in tree | FeatureTyping? | Succession source safe? | Safe to visualize? |
|---|---|---|---|---|---|
| `ActionUsage` | `action r : Read;` | ✅ `"r"` | ✅ | ✅ | ✅ already implemented |
| `PerformActionUsage` | `perform action cal : Calibrate;` | ✅ `"cal"` | ✅ | ✅ | ✅ already in emfTypeToSelType |
| `PerformActionUsage` (two-step) | `action sub : SubA; perform sub;` | ✅ `"sub"` | via ReferenceSubsetting | ✅ | ⚠️ may emit duplicate — prefer inline form |
| `AcceptActionUsage` | `accept start : Signal;` | ❌ null | inside ParameterMembership | ❌ source null | ⚠️ event-wait node only, no flow extraction |
| `SendActionUsage` | `send S() to port;` | ❌ null | buried in ParameterMembership chain | N/A | ⚠️ payload/receiver readable but not a succession node |
| `ExhibitStateUsage` | `exhibit state sm : ControlSM;` | ✅ `"sm"` | ✅ | ✅ | ✅ safe, treat like PerformActionUsage |

---

### 11.4 Key conclusions

**There is no call-graph semantics in official SysML v2.**

`ActionUsage : ActionDefinition` is *classifier conformance* — the usage is an occurrence
slot whose type is the definition.  It is **not** a procedure call, sub-routine invocation,
or message send.  The internal steps of the typed definition do not flow into the using
definition's behavior graph.

`PerformActionUsage` adds *perform semantics* (the occurrence identity is asserted to be
the performer) but is structurally identical to `ActionUsage` for flow extraction purposes.

**What can be safely shown**:
1. `ActionUsage` / `PerformActionUsage` typed by an `ActionDefinition` → a `typedBy` classifier
   edge.  Already in the ContainmentGraph and surfaced in the Inspector.
2. `PerformActionUsage` in a succession chain → safe, already extracted as a named node.
3. `ExhibitStateUsage` in a succession chain → safe, treat identically to `PerformActionUsage`.
4. `AcceptActionUsage` as an event-wait node with a trigger type label — recognisable but
   cannot be a named succession source endpoint.
5. `SendActionUsage` with payload and receiver names — recognisable but not a succession node.

**What must NOT be implemented**:
1. Cross-definition "call arrows" from one `ActionDefinition`'s flow into another's internals.
2. `AcceptActionUsage` as a named succession source — source endpoint is null/unresolvable.
3. Any "invocation" label on a `typedBy` edge — the relationship is type conformance.
4. Expanding a typed `ActionUsage` inline into its definition's body — definitions are separate scopes.
5. Sequence-diagram lifelines for these relationships — no message semantics exist at this level.

---

### 11.5 Validated test fixtures

All seven examples were run through `sysml-parse-cli.jar --debug` on 2026-05-12.

| Fixture | `success` | Key finding |
|---|---|---|
| `action r : Read` (ActionTyped) | ✅ true | FeatureTyping child naming ActionDefinition |
| `perform action cal : Calibrate` (PerformInline) | ✅ true | PerformActionUsage + FeatureTyping, participates in succession |
| `action sub : SubA; perform sub;` (PerformTwoStep) | ✅ true | PerformActionUsage + ReferenceSubsetting (not FeatureTyping) |
| `accept start : StartSignal` (Accept) | ❌ false* | AcceptActionUsage anonymous, source null in succession |
| `send Signal() to out1` (Send) | ✅ true | SendActionUsage anonymous, payload/receiver in ParameterMembership chain |
| `exhibit state sm : ControlSM` (Exhibit) | ✅ true | ExhibitStateUsage, identical structure to PerformActionUsage |
| Cross-definition composition Pipeline | ✅ true | No cross-definition edges, internal structures are separate |

\* `success: false` due to missing stdlib cross-reference; model structure is correct.
