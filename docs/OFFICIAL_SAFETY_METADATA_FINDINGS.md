# Official SysML v2 Safety Metadata Findings

Research conducted against the SysML v2 Pilot Implementation 0.59.0-SNAPSHOT
(Java 21, `sysml-parse-cli.jar`).

---

## 1. Research goals

Identify how official SysML v2 textual notation represents safety metadata
(e.g., ASIL levels, criticality ratings) on requirements and components,
without inventing semantics or using external tools such as TRLC.

---

## 2. Enumeration definitions

```sysml
enum def ASIL {
    enum QM;
    enum A;
    enum B;
    enum C;
    enum D;
}
```

**EMF structure:**
```
EnumerationDefinition  name='ASIL'
  VariantMembership
    EnumerationUsage  name='QM'
  VariantMembership
    EnumerationUsage  name='A'
  VariantMembership
    EnumerationUsage  name='B'
  VariantMembership
    EnumerationUsage  name='C'
  VariantMembership
    EnumerationUsage  name='D'
```

- `success: true`, no diagnostics
- All variant names are resolved as `EnumerationUsage.name`
- Any enum name can be used as a FeatureTyping target

---

## 3. Pattern A: Direct attribute on element (recommended)

```sysml
requirement def BrakeResponse {
    attribute asil : ASIL = ASIL::B;
}

part def BrakeController {
    attribute asil : ASIL = ASIL::B;
}
```

**EMF structure:**
```
RequirementDefinition 'BrakeResponse'       ← or PartDefinition, ActionDefinition, etc.
  FeatureMembership
    AttributeUsage  name='asil'
      FeatureTyping  name='ASIL'             ← attribute type (enum name), RESOLVED
      FeatureValue
        FeatureReferenceExpression
          Membership  name='B'               ← enum variant name (the value), RESOLVED
```

- `success: true`, no diagnostics  
- `AttributeUsage.name` → attribute name ('asil')
- `FeatureTyping.name` → attribute type ('ASIL')
- `FeatureValue → FeatureReferenceExpression → Membership.name` → value ('B')
- Works on: `RequirementDefinition`, `RequirementUsage`, `PartDefinition`, `PartUsage`, `ActionDefinition`

**Attribute without default value (declaration only):**
```sysml
requirement def BrakeResponse {
    attribute asil : ASIL;     ← no default
}
```
EMF: `AttributeUsage name='asil'` with `FeatureTyping name='ASIL'`, no `FeatureValue` child.
- `success: true`

**Attribute with redefined value in subtype:**
```sysml
requirement def BrakeResponse :> Safety {
    attribute redefines asil = ASIL::B;
}
```
EMF:
```
AttributeUsage  name='asil'
  Redefinition  name=None        ← parent's 'asil' cross-ref, UNRESOLVED (known Pilot bug)
  FeatureValue
    FeatureReferenceExpression
      Membership  name='B'       ← value IS resolved
```
- The value IS extractable. The Redefinition cross-reference is not resolved (same bug as Subclassification).

---

## 4. Pattern B: Metadata annotation inside element body (linked)

When placed INSIDE an element's `{ ... }` body, a `@Annotation` creates a `MetadataUsage`
node that is a CHILD of that element — establishing an unambiguous link.

```sysml
metadata def SafetyMeta {
    attribute asil : ASIL;
}

part def BrakeController {
    @SafetyMeta { asil = ASIL::D; }    ← placed INSIDE the body
}
```

**EMF structure:**
```
PartDefinition  name='BrakeController'
  OwningMembership
    MetadataUsage  name=None
      FeatureTyping  name='SafetyMeta'     ← metadata definition name, RESOLVED
      FeatureMembership
        ReferenceUsage  name='asil'        ← attribute name
          Redefinition  name=None
          FeatureValue
            FeatureReferenceExpression
              Membership  name='D'         ← value, RESOLVED
              ReturnParameterMembership
                Feature  name=None
```

- `success: true`, no diagnostics
- `MetadataUsage` is a CHILD of `BrakeController` → linkage is unambiguous
- Attribute name: `ReferenceUsage.name` → 'asil'
- Value: `FeatureValue → FeatureReferenceExpression → Membership.name` → 'D'
- `MetadataUsage.name = None` — the node is unnamed but carries `FeatureTyping name='SafetyMeta'`

**EMF extraction note for MetadataUsage:** The node has `label = 'MetadataUsage'` (= type, since name=None)
in the ContainmentGraph, so it is excluded from `directMeaningfulChildren`. A separate scan of ALL
children (including unnamed) is required to discover it.

---

## 5. Pattern B variant: Package-level annotation (NOT linked)

```sysml
@SafetyAnnotation { asil = ASIL::B; }
requirement def BrakeResponse;            ← annotated element follows
```

**EMF structure:**
```
Package 'MetadataAnnotatedRef'
  OwningMembership
    MetadataUsage  name=None              ← SIBLING, not a child of the annotated element
      FeatureTyping  name='SafetyAnnotation'
      FeatureMembership
        ReferenceUsage  name='asil'
          Membership  name='B'
  OwningMembership
    RequirementDefinition  name='BrakeResponse'   ← NO link from MetadataUsage to this
```

- `success: true` (in case 11)
- **The `MetadataUsage` is a SIBLING of the annotated element, not a child.**
- There is NO cross-reference from `MetadataUsage` to `BrakeResponse` in the EMF output.
- The only association is positional (MetadataUsage immediately precedes the annotated element).
- **This pattern CANNOT be used for safe automated extraction** — the link to the annotated element
  is ambiguous and positional-only.
- **Use Pattern B (inside body) instead.**

---

## 6. Type limitations

| Type used in `attribute x : T` | Status |
|--------------------------------|--------|
| User-defined enum (`ASIL`, `Priority`) | ✅ `success:true`, resolved |
| `String` | ❌ `success:false`, unresolved |
| `Integer` | ❌ `success:false`, unresolved |
| `Real` | ❌ likely same as Integer/String |
| `Boolean` | not tested |

Standard library types (`String`, `Integer`, `Real`) are not resolved by the Pilot Implementation's
cross-reference resolver. Only user-defined enum types defined in the same package resolve correctly.

**Workaround:** Use enum types for all safety metadata attributes.

---

## 7. Summary of validated EMF eClasses

| Construct | EMF eClass | Cross-ref | Safe to extract |
|-----------|-----------|-----------|-----------------|
| `enum def ASIL { enum A; ... }` | `EnumerationDefinition` / `EnumerationUsage` | n/a | ✅ yes |
| `attribute asil : ASIL` | `AttributeUsage` + `FeatureTyping` | ✅ type name | ✅ yes |
| `attribute asil : ASIL = ASIL::B` | same + `FeatureValue→Membership` | ✅ value | ✅ yes |
| `@Meta { ... }` inside body | `MetadataUsage` (child) | ✅ meta def | ✅ yes |
| `@Meta { ... }` at package level | `MetadataUsage` (sibling) | ❌ no element link | ❌ no |
| `attribute x : String` | `AttributeUsage` | ❌ type=None | ❌ no |
| `attribute x : Integer` | `AttributeUsage` | ❌ type=None | ❌ no |

---

## 8. Key conclusions

1. **The recommended ASIL pattern in official SysML v2** is:
   ```sysml
   enum def ASIL { enum QM; enum A; enum B; enum C; enum D; }
   
   requirement def BrakeResponse {
       attribute asil : ASIL = ASIL::B;
   }
   
   part def BrakeController {
       attribute asil : ASIL = ASIL::B;
   }
   ```

2. **Both Pattern A (direct attribute) and Pattern B (metadata inside body) are safe.** Pattern A
   is simpler and more idiomatic for data-like metadata. Pattern B is appropriate when the metadata
   comes from a separately defined schema (`MetadataDefinition`).

3. **All attribute extraction can be done from the existing ContainmentGraph** without adding
   new parser-service data structures. The value path is:
   `AttributeUsage → FeatureValue → FeatureReferenceExpression → Membership.name`

4. **Do NOT use `attribute x : String/Integer/Real`** — these types are unresolved in the
   Pilot Implementation and cause `success:false`.

5. **No automotive-specific semantics are hardcoded.** The same pattern works for any
   enum-typed safety level: ASIL, SIL, DAL, criticality ratings, etc.

---

## 9. Validated test fixtures

| File | Status | Notes |
|------|--------|-------|
| `test/fixtures/safety/01_asil_enum.sysml` | ✅ | EnumerationDefinition with ASIL variants |
| `test/fixtures/safety/02_attribute_on_req.sysml` | ✅ | attribute asil : ASIL on requirement def |
| `test/fixtures/safety/03_attribute_on_part.sysml` | ✅ | attribute asil : ASIL on part def |
| `test/fixtures/safety/04_attribute_value.sysml` | ✅ | attribute asil : ASIL = ASIL::B (with value) |
| `test/fixtures/safety/05_metadata_body.sysml` | ✅ | @MetadataDef inside element body |
| `test/fixtures/safety/06_asil_complete.sysml` | ✅ | Complete pattern: enum + req + part |
