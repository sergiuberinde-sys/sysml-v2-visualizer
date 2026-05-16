# Full SysML v2 Support — Project Roadmap

**Status:** Architecture pivot in progress (May 2026).  
**Goal:** Evolve this tool from a frozen prototype visualizer into a
conformant SysML v2 / KerML modelling assistant.

---

## Table of Contents

1. [Current Status](#1-current-status)
2. [Target State](#2-target-state)
3. [Why the Custom Parser Cannot Be Extended](#3-why-the-custom-parser-cannot-be-extended)
4. [Integration Options (summary)](#4-integration-options-summary)
5. [View Categories and Official SysML v2 Mapping](#5-view-categories-and-official-sysml-v2-mapping)
6. [Architecture Changes Already Made](#6-architecture-changes-already-made)
7. [Phased Milestones](#7-phased-milestones)
8. [Risks and Mitigations](#8-risks-and-mitigations)
9. [Decision Log](#9-decision-log)

---

## 1. Current Status

### What the tool is today

A standalone web app and VS Code extension that parses a **custom prototype
language** (internally called `legacySubset`) and renders it as interactive
diagrams. The parser is hand-written in TypeScript and handles roughly 15
constructs invented specifically for this tool.

### What the tool is NOT

- It does not parse conformant SysML v2 / KerML source files.
- The "SysML v2" label in the project name describes the tool's *intent*, not
  its current *capability*.
- Users who open real `.sysml` files from official SysML v2 projects (e.g.
  from Eclipse, SysIDE, or the Pilot Implementation examples) will receive
  parse errors on nearly every line.

### Parser mode flag

Since May 2026 the codebase uses an explicit `ParserMode` flag
(`src/core/parserMode.ts`) to distinguish the two modes:

| Mode | Status | Description |
|------|--------|-------------|
| `legacySubset` | Active, frozen | Custom prototype language. No new constructs. |
| `sysmlV2OfficialFuture` | Not implemented | Reserved for conformant SysML v2/KerML. |

### Visualizer model boundary

Since May 2026, all views consume a `VisualizerModel`
(`src/core/visualizerModel/`) rather than the parser's `ParseResult` directly.
An adapter (`src/core/adapters/legacySubsetAdapter.ts`) converts parser output
to this model. A placeholder `officialSysMLAdapter.ts` marks where the
conformant adapter will live.

---

## 2. Target State

### Short description

A VS Code extension and web app that:

1. Parses any `.sysml` file using the **official SysML v2 / KerML textual
   concrete syntax** (as specified by OMG formal/2024-11-07).
2. Renders all standard diagram kinds from that parsed model.
3. Provides full language intelligence: go-to-definition, hover, completion,
   rename, find-references, diagnostics — all conformant with the spec.
4. Interoperates with the official SysML v2 Pilot Implementation ecosystem
   (shared `.sysml` files, shared project format).

### Non-goals

- This tool will NOT implement a full SysML v2 modelling IDE.
- This tool will NOT replace Eclipse-based or SysIDE-based authoring.
- Custom syntax extensions or tool-specific keywords will NOT be added.

---

## 3. Why the Custom Parser Cannot Be Extended

The `legacySubset` grammar diverges from official SysML v2 in fundamental ways:

| Construct | Legacy behaviour | Official SysML v2 |
|-----------|-----------------|-------------------|
| Port direction | `port in/out name : Type` | `in port name : Type` or `out port name : Type` |
| Connections | `connect a.p to b.q` | `connect a::p to b::q` or `binding connector` |
| Multiplicity | Not parsed | `[0..*]`, `[1]`, etc. on all features |
| Generalisation | Not supported | `:>` with full inheritance semantics |
| Namespacing | Simple `::` for reference | Full KerML namespace + import rules |
| Typing | `part alias : Type` | `part name : Type` (standard) |
| Occurrence | `occurrence def` with messages | `occurrence def` with SysML v2 semantics |
| Requirements | Custom `id = / text = / priority =` fields | Standard `require` constraint + attributes |

Extending the legacy parser to support these constructs would require
rewriting it from scratch — at which point it is no longer the legacy parser
but a new conformant parser. The `legacySubset` freeze policy prevents this
confusion: if you are touching `astParser.ts`, you are doing it wrong.

---

## 4. Integration Options (summary)

Full analysis: `docs/OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md`.

| Option | Description | Effort | JVM needed |
|--------|-------------|--------|------------|
| **A** | Run Pilot Implementation as an LSP server; VS Code uses `LanguageClient` | 3–5 weeks | Yes |
| **B** | Call SysML v2 REST API service (HTTP); works for shared/hosted setups | 2–4 weeks | Yes |
| **C1** | Generate TypeScript parser from official ANTLR4 grammar | 8–16 weeks | No |
| **C2** | Write tree-sitter grammar (C → WASM) | 12–20 weeks | No |
| **D** | Keep legacy subset only (status quo) | 0 | No |

**Recommended sequence:** D now → A in 6–12 months → C1 if JVM proves problematic.

---

## 5. View Categories and Official SysML v2 Mapping

### Currently working views (legacy subset)

| View | What it shows | SysML v2 diagram equivalent |
|------|---------------|------------------------------|
| Structure | Part defs, ports, composition, connections | Block Definition Diagram + Internal Block Diagram |
| Sequence | Occurrence defs with message flows | Sequence Diagram |
| Behavior | Behavior defs with action instances and flows | Activity Diagram |
| State | State defs with states and transitions | State Machine Diagram |
| Requirements | Requirement defs with traceability badges | Requirements Diagram |
| Traceability | Trace links between elements and requirements | Traceability Matrix |
| Model Explorer | Package/element tree navigation | Package Diagram (partial) |
| Inspector | Selected element properties + edit actions | N/A (tool-specific panel) |

### Views required for full SysML v2 coverage

| View (new) | SysML v2 diagram kind | Key elements needed |
|------------|----------------------|---------------------|
| Parametric | Parametric Diagram | `ConstraintDefinition`, `ConstraintUsage`, bindings |
| Allocation | Allocation Diagram | `AllocationDefinition`, `AllocationUsage` |
| Use Case | Use Case Diagram | `UseCaseDefinition`, `UseCaseUsage`, actors |
| View/Rendering | View Diagram | `ViewDefinition`, `RenderingDefinition`, `ExposureUsage` |
| Geometry (future) | Geometry / SysPhS | Integration with external simulation |

### Views that extend naturally

| View | Changes needed for official SysML v2 |
|------|--------------------------------------|
| Structure | Add `AttributeUsage`, `ItemUsage`, multiplicity display, generalisation (`:>`) edges, `ConjugatedPortDefinition` |
| Sequence | Map `MessageOccurrenceSpecification` → message; handle combined fragments |
| Behavior | Add `ControlNode` kinds (fork, join, decision, merge), `AcceptActionUsage`, `SendActionUsage` |
| State | Add `DoActionUsage`, `EntryActionUsage`, `ExitActionUsage`, orthogonal states |
| Requirements | Replace custom fields with `RequirementConstraintMembership`, standard attributes |
| Traceability | Add `SatisfyRequirementUsage`, `VerifyRequirementUsage`, `FramedConcernMembership` |
| Model Explorer | Add full package import/alias tree, namespace-qualified names |

---

## 6. Architecture Changes Already Made

These changes land the codebase in a position to accept a conformant parser
without touching any view code:

### `src/core/parserMode.ts` (new, May 2026)

Defines `ParserMode`, `PARSER_MODE = 'legacySubset'`, and `PARSER_MODE_LABELS`.
Documents the freeze policy and the official mode intent.

### `src/core/visualizerModel/` (new, May 2026)

```
src/core/visualizerModel/
  types.ts    — VisualizerModel interface, VizNode/VizPackageNode/VizDiagnostic types
  index.ts    — public re-exports
```

All views now depend on `VisualizerModel`, not `ParseResult`. This is the
integration surface: when the official adapter is ready, views require no
changes.

### `src/core/adapters/` (new, May 2026)

```
src/core/adapters/
  legacySubsetAdapter.ts    — ParseResult → VisualizerModel (active)
  officialSysMLAdapter.ts   — placeholder for conformant parser output → VisualizerModel
```

### `src/core/parser/astParser.ts` (modified, May 2026)

FROZEN notice added at the top of the file. No new grammar rules.

### `src/core/modelTypes.ts` (modified, May 2026)

`ParseResult` now carries a `parserMode: ParserMode` field.

### `src/App.tsx` (modified, May 2026)

```typescript
const result   = useMemo(() => parseAndValidate(source), [source]);
const vizModel = useMemo(() => toVisualizerModel(result), [result]);
// result → internal use (diagnostics panel, Monaco markers, extension bridge)
// vizModel → all view and panel components
```

---

## 7. Phased Milestones

### Phase 0 — Stabilise and freeze (complete)

- [x] Add `ParserMode` flag
- [x] Freeze `astParser.ts` (no new grammar rules)
- [x] Create `VisualizerModel` as the view/panel API boundary
- [x] Create `legacySubsetAdapter` (active) and `officialSysMLAdapter` (placeholder)
- [x] Refactor all views to consume `VisualizerModel`
- [x] Write `docs/OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md`
- [x] Write `docs/FULL_SYSML_V2_ROADMAP.md` (this document)

### Phase 1 — Pilot Implementation integration (target: 6–12 months)

Goal: Conformant `.sysml` files from the Pilot Implementation can be loaded
and rendered in basic structure and sequence views.

- [ ] Evaluate Pilot Implementation LSP server; verify custom command feasibility
- [ ] Wire `vscode-languageclient` into VS Code extension; deprecate custom providers
- [ ] Write `sysml/getSemanticModel` patch for the Pilot LSP server
- [ ] Implement `officialSysMLAdapter`: JSON-LD → `VisualizerModel`
- [ ] Extend `VizNode` with new kinds for SysML v2 concepts not in legacy subset
- [ ] Update Structure view to render `AttributeUsage`, `ItemUsage`, generalisation edges
- [ ] Parallel mode: detect parser mode from file content; route to correct adapter
- [ ] CI: add integration tests against Pilot Implementation example models
- [ ] User-visible: `parserMode` badge changes from amber "Legacy Subset" to green "SysML v2"

### Phase 2 — Full view coverage (target: 12–24 months)

Goal: All 10 view categories work with official SysML v2 models.

- [ ] Complete Behavior view (ControlNodes, SendAction, AcceptAction)
- [ ] Complete State view (entry/do/exit actions, orthogonal regions)
- [ ] Complete Requirements view (standard attributes, `FramedConcernMembership`)
- [ ] Add Parametric view
- [ ] Add Allocation view
- [ ] Add Use Case view
- [ ] Inspector panel edit actions updated for official syntax
- [ ] Formatter updated for official textual syntax (replaces legacy formatter)

### Phase 3 — In-process parser (optional, target: 24+ months)

Goal: Remove JVM dependency (Option C1 or C2 from integration plan).

- [ ] Extract ANTLR4 grammar from Pilot Implementation build
- [ ] Generate TypeScript parser with `antlr4ng`
- [ ] Implement KerML scoping and namespace resolution in TypeScript
- [ ] Replace `legacySubsetAdapter` + LSP bridge with direct TypeScript parse pipeline
- [ ] Remove `vscode-languageclient` dependency from extension

---

## 8. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SysML v2 spec changes before we implement | Medium | High | Target the stable OMG 2024-11-07 spec; track errata on OMG portal |
| Pilot Implementation LSP is unstable or lacks custom commands | Medium | High | Spike early (2–3 days) before committing to Option A |
| JVM startup latency is unacceptable for VS Code users | Medium | Medium | Implement "warming up…" indicator; cache server between invocations; fall back to legacy mode |
| Official grammar is too complex to adapt (ANTLR4 route) | High | High | Do Option A first; treat C1 as optional optimisation |
| Structural incompatibility between VizNode and official elements | Low | Medium | VizNode kinds are designed to mirror SysML v2 vocabulary (PartDefinition → 'partDef', etc.) |
| Breaking existing legacy-mode users | Low | Low | Legacy mode stays active in parallel; mode detected from file content |
| VS Code Marketplace policy on JVM extension dependencies | Low | Medium | JAR is downloaded at install time, not bundled; same pattern as Metals (Scala) |
| tree-sitter SysML v2 grammar stays incomplete | High | Low | Use it only if Option A proves infeasible; not on the critical path |

---

## 9. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-08 | Freeze `astParser.ts`; add `ParserMode` flag | Prevent further divergence from official SysML v2; no value in extending the custom grammar |
| 2026-05-08 | Introduce `VisualizerModel` as view API boundary | Decouple views from parser internals; make adapter pattern explicit |
| 2026-05-08 | Keep legacy subset working in parallel | Avoid breaking existing demos/tests while new parser is built |
| 2026-05-08 | Choose Option A (LSP server) as Phase 1 target | Best balance of effort and spec coverage; reuses proven Xtext LSP |
| 2026-05-08 | Defer Option C (in-process parser) to Phase 3 | 8–20 weeks effort; not justified until Option A validates the architecture |

---

*Authored: 2026-05-08.*  
*Next review trigger: when Pilot Implementation LSP spike results are available,
or when Phase 1 engineering capacity is allocated.*
