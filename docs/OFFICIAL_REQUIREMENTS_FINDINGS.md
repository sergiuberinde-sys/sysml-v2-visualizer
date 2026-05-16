# Official SysML v2 Requirement Findings

Research conducted against the SysML v2 Pilot Implementation 0.59.0-SNAPSHOT
(Java 21, `sysml-parse-cli.jar`).

---

## 1. Research goals

Identify which official SysML v2 requirement constructs:
1. Parse without errors (`success: true`)
2. Produce resolved EMF cross-references (non-null names)
3. Are safe to extract and visualize

---

## 2. Constructs validated through the JAR parser

### 2.1 RequirementDefinition — ✅ Fully supported

```sysml
package RequirementDefExample {
    requirement def BrakeResponse {
        doc /* The brake response time shall be less than 200ms. */
    }
    requirement def SafeStop;
}
```

**EMF structure:**
```
Package 'RequirementDefExample'
  OwningMembership
    RequirementDefinition 'BrakeResponse'
      OwningMembership
        Documentation name=None
  OwningMembership
    RequirementDefinition 'SafeStop'
```

- `success: true`, no diagnostics
- Named node with resolved `name` field
- Appears as a named node in the ContainmentGraph
- Already in `TYPED_DEF_TYPES` in graphBuilder — can be referenced by `FeatureTyping`

---

### 2.2 RequirementUsage (package-level) — ✅ Fully supported

```sysml
requirement brakeReq : BrakeResponse;
```

**EMF structure:**
```
RequirementUsage 'brakeReq'
  FeatureTyping 'BrakeResponse'   ← cross-ref resolved
```

- `success: true`, no diagnostics
- `FeatureTyping name='BrakeResponse'` is resolved
- **RequirementUsage must be added to `TYPED_USAGE_TYPES`** to generate `typedBy` edges
  in the ContainmentGraph

---

### 2.3 RequirementUsage inside PartDefinition — ✅ Fully supported

```sysml
part def BrakeController {
    requirement brakeReq : BrakeResponse;
}
```

**EMF structure:**
```
PartDefinition 'BrakeController'
  FeatureMembership
    RequirementUsage 'brakeReq'
      FeatureTyping 'BrakeResponse'   ← cross-ref resolved
```

- `success: true`, no diagnostics
- This is the recommended pattern for associating requirements with parts
- Once `RequirementUsage` is in `TYPED_USAGE_TYPES`, the graph will include:
  `typedBy edge: RequirementUsage('brakeReq') → RequirementDefinition('BrakeResponse')`

---

### 2.4 Nested RequirementDefinition — ✅ Fully supported

```sysml
requirement def Safety {
    requirement def BrakeResponse;
    requirement def SteerResponse;
}
```

**EMF structure:**
```
RequirementDefinition 'Safety'
  OwningMembership
    RequirementDefinition 'BrakeResponse'
  OwningMembership
    RequirementDefinition 'SteerResponse'
```

- `success: true`, no diagnostics
- Requirement decomposition is represented through EMF containment

---

### 2.5 Subject type (SubjectMembership) — ✅ Parses, cross-ref resolved

```sysml
requirement def BrakeResponse {
    subject ctrl : BrakeController;
}
```

**EMF structure:**
```
RequirementDefinition 'BrakeResponse'
  SubjectMembership
    ReferenceUsage 'ctrl'
      FeatureTyping 'BrakeController'   ← cross-ref resolved
```

- `success: true`, no diagnostics
- Subject type name is available via `SubjectMembership → ReferenceUsage → FeatureTyping.name`
- Note: `SubjectMembership` is in `MEMBERSHIP_WRAPPERS` so it is transparent in containment traversal;
  the `ReferenceUsage` is a named meaningful child but NOT treated as a part/action/port

---

### 2.6 Specialization (:>) — ✅ Parses, cross-ref NOT resolved

```sysml
requirement def BrakeResponseDetailed :> BrakeResponse { }
```

**EMF structure:**
```
RequirementDefinition 'BrakeResponseDetailed'
  Subclassification name=None   ← cross-ref UNRESOLVED
```

- `success: true`, no diagnostics
- `Subclassification.name = None` — the parent requirement cross-reference is never resolved
  in Pilot 0.59.0-SNAPSHOT
- **Cannot be used for requirement hierarchy visualization** (same class of bug as
  DecisionNode outgoing successions)

---

## 3. Constructs NOT supported in Pilot 0.59.0-SNAPSHOT

### 3.1 SatisfyRequirementUsage — ⚠️ Parses but cross-ref ALWAYS unresolved

```sysml
satisfy BrakeResponse by BrakeController;     // package-level form
satisfy BrakeResponse;                         // nested form (inside part/usage)
```

**EMF structure:**
```
SatisfyRequirementUsage name=None
  ReferenceSubsetting name=None    ← requirement cross-ref UNRESOLVED
  SubjectMembership                ← 'by' clause (only in package-level form)
    ReferenceUsage name=None
      FeatureValue
        FeatureReferenceExpression
          Membership name='BrakeController'   ← satisfier IS resolved
```

- `success: false` (no diagnostic messages — semantic validation failure)
- The requirement being satisfied (`BrakeResponse`) is NEVER resolved in `ReferenceSubsetting`
- The satisfier (`BrakeController` in the `by` clause) IS resolved via `Membership.name`
- **Cannot be used to build satisfy links** — the requirement side is always null
- Known Pilot Implementation limitation (similar to succession endpoint NPE on DecisionNode)

---

### 3.2 verify keyword — ❌ Parse error

```sysml
verify BrakeResponse by BrakeTest;
```
Error: `mismatched input 'verify' expecting '}'`

The `verify` keyword is not supported in this grammar version.

---

### 3.3 derive keyword — ❌ Parse error

```sysml
derive BrakeResponse;
```
Error: `no viable alternative at input 'derive'`

---

### 3.4 stakeholder def — ❌ Parse error

```sysml
stakeholder def SafetyEngineer;
```
Error: `mismatched input 'stakeholder' expecting '}'`

---

### 3.5 require constraint — ❌ Parse error

```sysml
require constraint brakeReq : BrakeResponse;
```
Error: `mismatched input 'require' expecting '}'`

---

### 3.6 verification case — ❌ Parse error

The `verification case` construct is not recognized.

---

## 4. EMF eClass summary

| Construct | EMF eClass | success | Cross-ref resolved | Safe to extract |
|-----------|-----------|---------|-------------------|-----------------|
| `requirement def X` | `RequirementDefinition` | ✅ true | n/a | ✅ yes |
| `requirement r : X` | `RequirementUsage` | ✅ true | FeatureTyping ✅ | ✅ yes |
| Nested req def | `RequirementDefinition` (child) | ✅ true | n/a | ✅ yes |
| `subject s : T` | `SubjectMembership/ReferenceUsage` | ✅ true | FeatureTyping ✅ | ✅ partial |
| `:> Parent` | `Subclassification` | ✅ true | ❌ name=None | ❌ no |
| `satisfy R by S` | `SatisfyRequirementUsage` | ❌ false | ❌ ReferenceSubsetting=None | ❌ no |
| `verify R by T` | n/a | ❌ parse error | n/a | ❌ no |
| `derive R` | n/a | ❌ parse error | n/a | ❌ no |
| `stakeholder def` | n/a | ❌ parse error | n/a | ❌ no |

---

## 5. Key conclusions

1. **RequirementDefinition and RequirementUsage are the only safely extractable requirement types** in Pilot 0.59.0-SNAPSHOT.

2. **Adding `RequirementUsage` to `TYPED_USAGE_TYPES`** in both graph builders
   (`parser-service/src/graphBuilder.ts` and `src/core/adapters/officialSysMLAdapter.ts`)
   enables automatic `typedBy` edges from usages to definitions.

3. **Satisfy/verify/trace/derive/refine relationships all fail** to produce usable data:
   - `satisfy` parses but the requirement cross-reference is always null
   - `verify`/`derive` are parse errors in this grammar version
   - `Subclassification` (`:>`) parses but the parent name is always null

4. **The recommended pattern** for associating requirements with parts is:
   ```sysml
   part def BrakeController {
       requirement brakeReq : BrakeResponse;
   }
   ```
   This puts a named `RequirementUsage` inside the `PartDefinition`, with a resolved
   `FeatureTyping` linking it to the `RequirementDefinition`.

5. **No satisfy/verify/trace link visualization** is implemented because the cross-references
   are never resolved by the Pilot Implementation.

---

## 6. Validated test fixtures

| File | EMF types | success | Notes |
|------|-----------|---------|-------|
| `test/fixtures/requirements/01_requirement_def.sysml` | RequirementDefinition | ✅ | Bare definitions |
| `test/fixtures/requirements/02_requirement_usage.sysml` | RequirementDefinition, RequirementUsage | ✅ | Usage typed by def |
| `test/fixtures/requirements/03_req_in_part.sysml` | PartDefinition, RequirementUsage | ✅ | Part owns requirement |
| `test/fixtures/requirements/04_nested_requirements.sysml` | RequirementDefinition hierarchy | ✅ | Requirement decomposition |
