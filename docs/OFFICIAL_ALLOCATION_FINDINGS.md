# Official SysML v2 Allocation / Dependency Findings

**Pilot Implementation**: 0.59.0-SNAPSHOT (Java 21 JAR parser)  
**Date**: 2026-05-13  
**Method**: Parse minimal fixture files through JAR, inspect containment trees.

---

## 1. Constructs Probed

| Keyword | EMF type(s) | Parses? | Endpoints in tree? |
|---|---|---|---|
| `allocation def` | `AllocationDefinition` | ✅ | ends as `ReferenceUsage` |
| `allocation usage : Def` (named) | `AllocationUsage` | ✅ | via `FeatureTyping` |
| `allocate A to B` (shorthand) | `AllocationUsage` (anonymous) | ✅ | ✅ via `ReferenceSubsetting` |
| `bind a = b.c` | `BindingConnectorAsUsage` | ✅ | ✅ via `ReferenceSubsetting`/`FeatureChaining` |
| `dependency X from A to B` | `Dependency` | ✅ | ❌ cross-refs only, absent from tree |
| `ref part r : T` | `PartUsage` (same as plain `part`) | ✅ | N/A — no EMF distinction |
| `connect a.p to b.p` | `ConnectionUsage` (anonymous) | ✅ | ✅ via `FeatureChaining` |

---

## 2. Detailed EMF Patterns

### 2.1 `allocation def` → `AllocationDefinition`

```sysml
allocation def FunctionToNode {
    end logicalEnd : LogicalFunction;
    end hardwareEnd : HardwareNode;
}
```

EMF tree:
```
AllocationDefinition "FunctionToNode"
  FeatureMembership
    ReferenceUsage "logicalEnd"
      FeatureTyping "LogicalFunction"
  FeatureMembership
    ReferenceUsage "hardwareEnd"
      FeatureTyping "HardwareNode"
```

- Ends appear as **`ReferenceUsage`** (not `PartUsage`) inside `FeatureMembership`
- Each end has a `FeatureTyping` naming the typed endpoint element
- `AllocationDefinition` is a first-class EMF type (subtype of `ConnectionDefinition`)

### 2.2 Named `allocation a1 : AllocDef` → `AllocationUsage`

```sysml
allocation alloc1 : SensorToECU;
```

EMF tree:
```
AllocationUsage "alloc1"
  FeatureTyping "SensorToECU"
```

- Named `AllocationUsage` with `FeatureTyping` pointing to `AllocationDefinition` — same pattern as `PartUsage : PartDefinition`
- Gets a `typedBy` edge to the `AllocationDefinition` if added to `TYPED_USAGE_TYPES`

With explicit endpoint binding:
```sysml
allocation a1 : SensorAlloc {
    end sensorEnd references s;
    end ecuEnd references e;
}
```

EMF tree:
```
AllocationUsage "a1"
  FeatureTyping "SensorAlloc"
  FeatureMembership
    ReferenceUsage "sensorEnd"
      ReferenceSubsetting "s"       ← local part name, RESOLVED
  FeatureMembership
    ReferenceUsage "ecuEnd"
      ReferenceSubsetting "e"       ← local part name, RESOLVED
```

### 2.3 `allocate A to B` shorthand → anonymous `AllocationUsage`

```sysml
allocate sw1 to hw1;
```

EMF tree:
```
AllocationUsage                           ← no name
  EndFeatureMembership
    ReferenceUsage
      ReferenceSubsetting "sw1"           ← source, RESOLVED
  EndFeatureMembership
    ReferenceUsage
      ReferenceSubsetting "hw1"           ← target, RESOLVED
```

**Key finding**: Unlike `SatisfyRequirementUsage`, the `ReferenceSubsetting.name` inside `allocate ... to ...`
IS resolved by the Pilot. Both endpoint names are available in the containment tree.

Extraction path:
```
AllocationUsage → EndFeatureMembership[0] → ReferenceUsage → ReferenceSubsetting.name  (source)
AllocationUsage → EndFeatureMembership[1] → ReferenceUsage → ReferenceSubsetting.name  (target)
```

### 2.4 `bind a = b.c` → `BindingConnectorAsUsage`

```sysml
bind speed = sensor.speed;
```

EMF tree:
```
BindingConnectorAsUsage                   ← anonymous
  EndFeatureMembership
    ReferenceUsage
      ReferenceSubsetting "speed"         ← left side, single name
  EndFeatureMembership
    ReferenceUsage
      ReferenceSubsetting                 ← right side, chained
        Feature
          FeatureChaining "sensor"
          FeatureChaining "speed"
```

- Both endpoints are resolved
- Dot-chained paths use `Feature → FeatureChaining[]`
- Reconstruction: join `FeatureChaining` names with `.`

### 2.5 `dependency X from A to B` → `Dependency`

```sysml
dependency controllerOnSensor from Controller to Sensor;
```

EMF tree:
```
Dependency "controllerOnSensor"
  (no children)
```

- **Name is preserved**
- **`from` and `to` endpoints are cross-references** in the EMF model, NOT containment children
- The JSON parse output does NOT serialize cross-reference targets
- Conclusion: only the dependency name is available — endpoints are inaccessible

### 2.6 `ref part r : T` → `PartUsage` (same as `part r : T`)

```sysml
ref part sensorRef : Sensor;
```

EMF tree:
```
PartUsage "sensorRef"
  FeatureTyping "Sensor"
```

- **No EMF distinction** between `ref part` and `part` in the JSON output
- Both produce `PartUsage` with `FeatureTyping`
- `ref` is a syntactic qualifier that affects subsetting semantics but is not surfaced in the JSON

### 2.7 `connect a.p to b.p` → anonymous `ConnectionUsage`

```sysml
connect n1.busPort to n2.busPort;
```

EMF tree:
```
ConnectionUsage                           ← anonymous
  EndFeatureMembership
    ReferenceUsage
      ReferenceSubsetting
        Feature
          FeatureChaining "n1"
          FeatureChaining "busPort"
  EndFeatureMembership
    ReferenceUsage
      ReferenceSubsetting
        Feature
          FeatureChaining "n2"
          FeatureChaining "busPort"
```

- Endpoints via `FeatureChaining` chain (same pattern as `BindingConnectorAsUsage`)
- Already handled by existing `connection` edge extraction in `graphBuilder.ts`

---

## 3. Is Allocation First-Class or Pattern-Based?

**First-class.** `AllocationDefinition` and `AllocationUsage` are dedicated EMF types
(subtypes of `ConnectionDefinition`/`ConnectionUsage`). They are not implemented as
stereotypes on generic connections.

---

## 4. What Is Safely Visualizable

### ✅ Safe to implement

| Construct | Source | Target | Edge type |
|---|---|---|---|
| `allocate A to B` | `EndFeatureMembership[0] → ReferenceSubsetting.name` | `EndFeatureMembership[1] → ReferenceSubsetting.name` | `allocates` |
| Named `AllocationUsage : AllocDef` | `AllocationUsage.id` | `AllocationDefinition.id` | `typedBy` (existing) |
| `AllocationDefinition` / `AllocationUsage` | as definition / usage nodes | — | node in graph |
| `BindingConnectorAsUsage` | left `ReferenceSubsetting.name` | right `FeatureChaining` join | `binds` or `connection` |

### ❌ Not safely implementable

| Construct | Reason |
|---|---|
| `Dependency from A to B` | `from`/`to` are cross-references, absent from JSON |
| `ref part` vs `part` distinction | No EMF type difference |
| Semantic meaning of logical-to-physical | Would require external mapping not in SysML model |

---

## 5. Recommended Implementation Strategy

**Priority 1 — `allocate A to B` as `allocates` edge:**

In `graphBuilder.ts`, detect anonymous `AllocationUsage` with two `EndFeatureMembership`
children and extract endpoints from `ReferenceSubsetting.name`. Emit a new `allocates`
edge type in the `ContainmentGraph`.

```typescript
// Detection pattern in graphBuilder:
if (node.type === 'AllocationUsage' && !node.name) {
    const ends = node.children.filter(c => c.type === 'EndFeatureMembership');
    const getEndName = (em: ModelNode) =>
        em.children[0]?.children
            .find(c => c.type === 'ReferenceSubsetting')?.name;
    const src = getEndName(ends[0]);
    const tgt = getEndName(ends[1]);
    if (src && tgt) {
        // look up IDs for src/tgt in the same containing scope
        // emit { type: 'allocates', source: srcId, target: tgtId }
    }
}
```

**Priority 2 — Named `AllocationUsage`/`AllocationDefinition` as typed nodes:**

Add `AllocationUsage` to `TYPED_USAGE_TYPES` and `AllocationDefinition` to `TYPED_DEF_TYPES`
in both `graphBuilder.ts` and `officialSysMLAdapter.ts`.

**Priority 3 (deferred) — `BindingConnectorAsUsage`:**

Can be extracted similarly to `allocate`, but attribute bindings within a part definition
are local to that part's scope. Visualizing them requires scoped ID resolution. Defer
until allocations are proven working.

---

## 6. Pilot-Specific Limitations

- `Dependency` endpoints are cross-references: not serialized → name only
- `ref part` vs `part`: no JSON distinction
- Anonymous `AllocationUsage` `from`/`to` IS resolved — unlike `SatisfyRequirementUsage`
- Multi-allocation in one part works: each `allocate A to B` produces a separate anonymous `AllocationUsage`

---

## 7. Validated Fixtures

All fixtures parse with `success:true`:

| File | Construct | Result |
|---|---|---|
| `01_allocation_def.sysml` | `allocation def` with ends | ✅ |
| `02_allocation_usage.sysml` | Named `AllocationUsage : AllocDef` | ✅ |
| `03_allocate_shorthand.sysml` | `allocate A to B` shorthand | ✅ |
| `04_binding_connector.sysml` | `bind a = b.c` | ✅ |
| `05_dependency.sysml` | `dependency X from A to B` | ✅ |
| `06_reference_usage.sysml` | `ref part r : T` | ✅ |
| `07_interface_connection.sysml` | `connect a.p to b.p` | ✅ |
| `08_allocate_endpoints.sysml` | Multiple `allocate A to B` | ✅ |
| `09_named_allocation_endpoints.sysml` | Named allocation with endpoint binding | ✅ |
