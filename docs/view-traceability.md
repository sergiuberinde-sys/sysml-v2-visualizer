# Trace View — Requirement Traceability & Derivation Hierarchy

The **Trace** tab links the SysML v2 model to external **TRLC** requirements. It answers
two questions at once:

1. **Which model element satisfies which requirement?** — a requirement → element trace
   matrix built from `@Satisfies` metadata in the model.
2. **How do requirements derive from one another?** — a collapsible **derivation tree**
   built from each requirement's `derived_from_trlc` parent links.

Both are **purely presentational** — they never change the model or its diagnostics — and
they compose with the ASIL surfacing of the Sequence view.

> This view documents rendering. For the formal specification see
> `../Extra_features_requirements.md` Feature 10 (traceability) and Feature 11 (hierarchy).

---

## 1. Where requirements come from

Requirements are **external** to the SysML model and live in native IPF **`.trlc`** files.
The extension **auto-loads every `**/*.trlc` in the workspace** — no manual import step.
Each record's **name is the requirement id**:

```
IpfRMBase.SystemRequirement SafeFaultManagement_IndependentFaultMgmt_65347186 {
    description = '''
        The Driving domain and the HVM domain shall provide independent
        fault-management paths.
        '''
    asil = IpfRMBase.ASIL.D
    derived_from_trlc = [ SafeFaultManagement_TopGoal_65347100, ]
}
```

Supported per record:
- **id** — the record name.
- **description** — triple-quoted `''' … '''` (multi-line) or legacy double-quoted `"…"`.
- **asil** — enum `IpfRMBase.ASIL.D` → `D` (or legacy `asil = "D"`).
- **kind** — the record type → short category: `SystemRequirement → SYS`,
  `HardwareRequirement → HW`, `SoftwareRequirement → SW`.
- **derived_from_trlc** — a list of parent requirement ids (single-line or multi-line).

## 2. Linking a model element to a requirement (`@Satisfies`)

The model declares that an element satisfies one or more requirements with a **`@Satisfies`**
metadata element carrying the requirement **names**:

```
metadata def Satisfies { attribute reqId : String[*]; }

part def SafetyExceptionHandler {
    @Satisfies { reqId = ("SafeFaultManagement_PerDomainSWMechanisms_SW_65347715"); }
}
```

- The trace is attributed to the **nearest enclosing named element** (here the part def).
- Requirement ids are matched by **exact name**; a `reqId` with no matching requirement is
  **silently dropped** (never guessed or fuzzy-matched).
- The older `// trlc-satisfies: N` comment convention still works and is **merged**
  (de-duplicated) with the `@Satisfies` traces.

## 3. The derivation hierarchy (`derived_from_trlc`)

Each requirement that declares `derived_from_trlc` is placed **under its parent**, forming a
forest:

- **Roots** are requirements with no resolvable parent (typically system-level goals).
- A requirement attaches under its **first** resolvable parent, so the display is a strict
  tree; unresolved parent ids are ignored.
- A requirement with **more than one** parent is a **multi-parent (DAG)** node — it appears
  once (under its first parent) with a `⑂` marker whose tooltip lists the extra parents.

The demo project, for example, has 156 requirements → 13 roots, depth 3, stratified
System → Hardware/Software.

## 4. Reading the tree

Each row shows:

| Element | Meaning |
|---|---|
| ▶ / ▼ | Expand / collapse this requirement's children (rows with children only) |
| `SYS` / `HW` / `SW` badge | Requirement category (colour-coded) |
| Title | The requirement title |
| `⑂N` | Multi-parent marker — derives from N parents (extra parents on hover) |
| `↳ N` | Number of model elements that satisfy this requirement |
| `ASIL-x` | The requirement's ASIL (colour-coded QM→D) |
| *N descendants* | Shown on a **collapsed** parent — how many requirements it hides |

Controls & interactions:
- **Expand all / Collapse all** — in the panel header, flip the whole tree at once.
- **Select a requirement** — reveals its **description** and its **satisfying-element chips**
  inline; each chip is clickable to **jump to that element's declaration** in the editor.
- The header reports totals, e.g. *156 reqts · 13 roots · 143 derived · N links*.

## 5. Reqts vs Trace

- **Reqts** ([view-requirements.md](view-requirements.md)) — a flat list of every TRLC
  requirement (id, title, ASIL, description). Use it to browse or search requirements.
- **Trace** — the same requirements arranged by **derivation** and cross-linked to the
  **model elements** that satisfy them. Use it for reviews and coverage.

## 6. Authoring checklist

- [ ] Requirements are in `**/*.trlc` files inside the open workspace folder.
- [ ] `.trlc` records use the IPF form (`IpfRMBase.<Type> <Name_id> { … }`); the record
      name is the requirement id.
- [ ] Parent links use `derived_from_trlc = [ <ReqId>, … ]` naming existing requirement ids.
- [ ] Model elements link with `@Satisfies { reqId = ("<ReqId>", …); }` (exact names).
- [ ] The **Trace** tab is selected in the visualizer panel.
