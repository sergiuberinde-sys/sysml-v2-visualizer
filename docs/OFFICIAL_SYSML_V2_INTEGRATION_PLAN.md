# Official SysML v2 Integration Plan

**Status:** Architecture planning — no implementation has begun.  
**Context:** The visualizer currently runs a frozen, custom prototype language
(`parserMode = 'legacySubset'`). This document evaluates four paths toward
processing real, conformant SysML v2 / KerML source files.

---

## Table of Contents

1. [Background](#1-background)
2. [Option A — Pilot Implementation as an External Process / LSP Server](#2-option-a--pilot-implementation-as-an-external-process--lsp-server)
3. [Option B — SysML v2 REST API Service](#3-option-b--sysml-v2-rest-api-service)
4. [Option C — Generate a TypeScript Parser from the Official Grammar](#4-option-c--generate-a-typescript-parser-from-the-official-grammar)
5. [Option D — Keep Legacy Subset as Permanent Fallback](#5-option-d--keep-legacy-subset-as-permanent-fallback)
6. [Comparison Matrix](#6-comparison-matrix)
7. [Recommended Path](#7-recommended-path)
8. [Integration Boundary in This Codebase](#8-integration-boundary-in-this-codebase)
9. [SysML v2 Node-Kind Mapping](#9-sysml-v2-node-kind-mapping)

---

## 1. Background

### SysML v2 specification layers

Official SysML v2 is defined in two stacked layers:

| Layer | Name | Role |
|-------|------|------|
| Foundation | **KerML** (Kernel Modeling Language) | Core type system, features, namespaces, multiplicities, expressions |
| Profile | **SysML v2** | Domain-specific vocabulary built on KerML (parts, ports, actions, states, requirements, …) |

Both layers share a single, unified textual concrete syntax. A conformant tool
must parse KerML first and then recognise SysML v2 keywords on top.

### The official pilot implementation

The OMG SysML v2 Submission Team maintains a reference implementation:

- **Repository:** `Systems-Modeling/SysML-v2-Pilot-Implementation` on GitHub
- **Technology:** Java 17, Eclipse EMF, Xtext 2.x, Gradle
- **License:** LGPL-3.0-or-later
- **Artefacts shipped:**
  - Xtext grammar files for KerML and SysML v2 (`.xtext`)
  - Eclipse-based IDE plugin
  - A Jupyter kernel (`syside`) for notebook-style modelling
  - An **LSP server** (generated automatically by Xtext)
  - A **REST API service** (`SysML-v2-API-Services`)

### What the legacy subset covers (and does not cover)

The custom parser handles roughly 15 constructs invented for this tool.
It does not parse any SysML v2 standard syntax correctly:
no `import`, no multiplicity brackets, no specialisation (`:>`), no
`attribute`, no `calc`, no `view`, no `render`, no `connect` without the
`to` keyword variant, etc.  Users who write real SysML v2 files will
get parse errors on almost every line.

---

## 2. Option A — Pilot Implementation as an External Process / LSP Server

### Concept

Run the official pilot implementation as a Language Server Protocol (LSP)
server in a child process. The VS Code extension acts as an LSP client.
The visualizer's React UI consumes the structured model produced by that
server rather than the legacy TypeScript parser.

Xtext generates a fully-functional LSP server from its grammar automatically.
The pilot implementation ships this server; it can be launched as a standalone
JAR without any Eclipse or IDE setup.

### Feasibility — High (with caveats)

The LSP server works and supports the full SysML v2 / KerML grammar.
VS Code has first-class LSP client support via `vscode-languageclient`.
The main caveats:

- **JVM dependency.** Users must have Java 17+ on `PATH`. This is a
  non-trivial install requirement for a VS Code extension aimed at engineers
  who may not have Java installed.
- **Startup latency.** JVM warm-up adds 3–8 seconds before the language
  server is ready. We mitigate this with a "warming up…" status bar message.
- **No structured model export over LSP.** Standard LSP gives us diagnostics,
  completion, hover, and go-to-definition — but not a serialised semantic
  model for the visualizer. We need to either (a) add a custom LSP extension
  command, or (b) run a separate REST API call in parallel (see Option B).

### Licensing concerns

The pilot implementation is LGPL-3.0-or-later.  Key implications:

- We can call the JAR as an external process without LGPL obligations on our
  code (it is a separate program; we are not linking against it).
- We must not bundle the JAR inside the VS Code `.vsix` without disclosing
  the LGPL dependency and providing a way for users to replace the JAR.
  The safe path is to have the extension download the JAR at install time
  (similar to how the Metals Scala extension works) and document the source
  and version.
- The Xtext runtime JARs bundled inside the pilot implementation are
  EPL-2.0. EPL-2.0 is compatible with LGPL for this distribution model.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ VS Code Extension Host (Node.js / TypeScript)           │
│                                                         │
│  ExtensionContext                                        │
│   ├─ LanguageClient (vscode-languageclient)             │
│   │   └─ spawns: java -jar sysml-v2-ls.jar             │
│   │              (stdio transport)                      │
│   │                                                     │
│   ├─ Diagnostics ←── textDocument/publishDiagnostics    │
│   ├─ Hover       ←── textDocument/hover                 │
│   ├─ Completion  ←── textDocument/completion            │
│   ├─ Definition  ←── textDocument/definition            │
│   └─ Custom cmd  ←── sysml/getSemanticModel (extension) │
│                           │                             │
│                           ▼                             │
│   WebviewPanel postMessage({type:'loadModel', …})        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Webview (React / TypeScript)                            │
│                                                         │
│  message handler sets source → parseAndValidate()        │
│  BUT: parseAndValidate is replaced by a thin adapter    │
│  that converts the structured JSON from the extension   │
│  into our ParseResult / SysMLAnalysis shape.            │
│                                                         │
│  Views (Structure, Sequence, …) unchanged.              │
└─────────────────────────────────────────────────────────┘
```

The custom LSP command `sysml/getSemanticModel` is the only non-standard
piece.  We send the document URI; the server responds with a JSON-LD
serialisation of the semantic model (the pilot implementation supports
JSON-LD export via its REST API — we would use the same serialiser).

### Expected complexity

| Task | Effort |
|------|--------|
| Evaluate JAR startup, test LSP handshake | 0.5 day |
| Wire `vscode-languageclient` into extension | 1–2 days |
| Add custom `sysml/getSemanticModel` command to pilot impl (Java patch) | 3–5 days |
| Write JSON-LD → `ParseResult` adapter in TypeScript | 3–5 days |
| JAR download / version management at install time | 1–2 days |
| Update all views for new node kinds | 5–10 days |
| End-to-end integration tests | 3–5 days |
| **Total estimate** | **3–5 weeks** |

### How it connects to the VS Code extension

- Replace all custom provider implementations (`DefinitionProvider`,
  `HoverProvider`, `CompletionProvider`, etc.) with a single `LanguageClient`
  instance.  The pilot LSP server provides all of these out of the box.
- Keep only the `WebviewPanel` management code and the custom
  `sysml/getSemanticModel` bridge command in the extension.
- The `SemanticTokensProvider` may still need a custom implementation because
  the standard LSP semantic tokens legend differs from our token types.

### How it feeds the visualizer model

The JSON-LD export from the pilot implementation is the official SysML v2
model interchange format. We write a one-time adapter:

```
JSON-LD element                   →  SysMLNode kind
─────────────────────────────────────────────────────
SysML::PartDefinition             →  'partDef'
SysML::PartUsage                  →  'partAlias'
SysML::PortDefinition             →  'interfaceDef'
SysML::PortUsage (in/out)         →  'port'
SysML::ConnectionUsage            →  'connection'
SysML::OccurrenceDefinition       →  'occurrenceDef'
SysML::MessageUsage               →  'message'
SysML::RequirementDefinition      →  'requirementDef'
SysML::SatisfyRequirementUsage    →  'traceLink' (satisfy)
KerML::Package                    →  'packageDef'
…
```

New SysML v2 concepts without a legacy equivalent (e.g. `ItemDefinition`,
`AttributeUsage`, `FlowConnectionUsage`, `ViewDefinition`) must be added as
new `SysMLNode` kinds and new visualizer view panels.

---

## 3. Option B — SysML v2 REST API Service

### Concept

The pilot implementation ships a companion project (`SysML-v2-API-Services`)
that exposes a REST/JSON-LD API based on the published SysML v2 API
OpenAPI specification. The extension (or browser app) calls HTTP endpoints
to parse, validate, and query a SysML v2 project.

The API can run locally (same machine as VS Code) or be hosted remotely.

### Feasibility — Medium

- The REST API is real and usable; the pilot project ships it.
- In VS Code extension mode, making HTTP calls from the extension host is
  straightforward using Node.js `fetch`.
- In browser / standalone mode, CORS headers must be configured if the API
  runs on a different origin.
- The biggest issue is **round-trip latency**: every keystroke in the editor
  would need to debounce and send the full document to the API, then wait
  for a response. For large models this could feel sluggish.
- The API server startup still requires a JVM.

### Licensing concerns

Same as Option A (LGPL-3.0-or-later). The API is a thin HTTP wrapper over
the same pilot implementation code. Distribution rules are identical —
we must not bundle the server binary without disclosure.

The **SysML v2 API specification** itself (the OpenAPI schema) is published
by OMG. The OMG document license allows implementors to produce compatible
software without restriction on the implementation, provided the interface
specification is not modified.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ VS Code Extension Host                                  │
│                                                         │
│  - Manages a ChildProcess for the API server JAR        │
│  - On document change (debounced, ~500 ms):             │
│      POST /projects/{id}/commits  (upload model text)   │
│      GET  /elements?project={id}  (fetch element list)  │
│  - Translates JSON-LD response → ParseResult            │
│  - Pushes result to webview via postMessage             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Standalone Web App (browser)                            │
│                                                         │
│  - User configures API server URL in settings           │
│  - Same HTTP calls, CORS must be open on the server     │
│  - Suitable for team/shared deployments                 │
└─────────────────────────────────────────────────────────┘
```

### Expected complexity

| Task | Effort |
|------|--------|
| Stand up API server, explore endpoints | 0.5–1 day |
| Write HTTP client wrapper in TypeScript | 1–2 days |
| Write JSON-LD → `ParseResult` adapter (shared with Option A) | 3–5 days |
| Debounce / cancellation for keystroke updates | 1 day |
| Server lifecycle management in extension | 1–2 days |
| Settings UI (server URL, port) for standalone mode | 1 day |
| Update views for new node kinds | 5–10 days |
| **Total estimate** | **2–4 weeks** |

### How it connects to the VS Code extension

- All custom language providers (hover, completion, definition) would need
  to call the REST API synchronously — which is awkward given the
  extension host's synchronous provider contracts.  Most providers accept
  `Thenable<T>`, so async HTTP is workable but adds latency vs. in-process.
- The REST API does not implement LSP directly, so we still need our own
  provider wiring for each language feature.
- This makes Option B slightly worse than Option A for the VS Code language
  feature surface.

### How it feeds the visualizer model

Identical to Option A — the REST API returns JSON-LD using the same
serialisation format as the LSP extension command would return. The
JSON-LD → `ParseResult` adapter is shared code.

The REST API has one advantage: **persistent project state**. The API server
maintains a project/commit model; we can query subsets of the model
(by element type, namespace) rather than re-parsing the whole file on each
request. This becomes valuable for large models.

---

## 4. Option C — Generate a TypeScript Parser from the Official Grammar

### Concept

Extract the KerML + SysML v2 grammar files from the pilot implementation and
compile them into a TypeScript (or WebAssembly) parser that runs in-process —
no JVM, no network, no child process.

Three sub-approaches exist:

| Sub-option | Mechanism | Notes |
|-----------|-----------|-------|
| C1 | ANTLR4 TypeScript target (`antlr4ng`) | Xtext generates ANTLR internally; extract the `.g4` and compile to TS |
| C2 | tree-sitter (C → WASM) | Write a tree-sitter grammar for KerML/SysML v2; compile to WASM |
| C3 | Hand-written PEG parser (Peggy / nearley) | Manually translate the grammar; most labour-intensive |

### Feasibility

**C1 (ANTLR4 TypeScript)** — Medium feasibility.  
Xtext's internal ANTLR grammar is generated into the build directory and
is not published directly, but can be retrieved by running a build.
The `.g4` files are large (KerML grammar is ~4000 lines of generated ANTLR).
The `antlr4ng` package provides a full ANTLR4 runtime for TypeScript.
Challenges: Xtext uses its own linking/scoping mechanism on top of the parse
tree; the generated ANTLR grammar alone does not include semantic resolution,
which we must re-implement.

**C2 (tree-sitter)** — Lower feasibility, higher upfront investment.  
A tree-sitter grammar must be written manually in C. The payoff is an
incremental, error-recovering parser that compiles to a small WASM module (~200 KB).
tree-sitter is already used by GitHub Linguist and Neovim's highlighting layer.
The SysML v2 community has started a tree-sitter grammar but it is incomplete
as of 2025. We would need to contribute to or fork that effort.

**C3 (hand-written PEG)** — Low feasibility at full scope.  
The SysML v2 + KerML grammar covers 300+ grammar rules. A complete
hand-written PEG parser would take months. This approach was what produced
the current legacy subset — it cannot scale to the full language.

### Licensing concerns

- The official grammar files are part of the pilot implementation (LGPL-3.0).
  Translating them into a new form (`.g4` → TypeScript) does not automatically
  inherit the LGPL, but the derivation should be documented in a `NOTICE` file.
- The ANTLR4 runtime (`antlr4ng`) is BSD-3-Clause — no concern.
- The tree-sitter runtime is MIT — no concern.
- OMG's normative grammar specification in the SysML v2 / KerML documents
  is provided for implementors and may be used to write conformant parsers
  without license restriction on the implementation.

### Architecture (C1 — ANTLR4)

```
Build time:
  SysML-v2-Pilot-Implementation/ (LGPL, not bundled)
    ├─ org.omg.kerml.xtext/src/.../KerML.xtext
    └─ org.omg.sysml.xtext/src/.../SysML.xtext
           │
           ▼  (Xtext Gradle build → generates)
    org.omg.kerml.xtext/src-gen/.../KerML*.g4
    org.omg.sysml.xtext/src-gen/.../SysML*.g4
           │
           ▼  (antlr4ng generate)
    src/core/parser/generated/KerMLParser.ts
    src/core/parser/generated/SysMLParser.ts

Runtime (in-process, no JVM):
  parseToAST(text)
    → ANTLR4 token stream
    → ANTLR4 parse tree (CST)
    → AST visitor (new ASTVisitor.ts)
    → ASTResult  (same interface as today)
    → buildModel() / validate()  (unchanged)
```

### Architecture (C2 — tree-sitter)

```
Build time:
  grammar.js (SysML v2 tree-sitter grammar, C generated)
     │
     ▼  (tree-sitter generate && emscripten)
  dist/tree-sitter-sysml.wasm  (~200 KB)

Runtime (WASM, in-process):
  import Parser from 'web-tree-sitter';
  await Parser.init();
  const lang = await Parser.Language.load('./tree-sitter-sysml.wasm');
  const tree = parser.parse(sourceText);
  // walk tree.rootNode → ASTResult
```

### Expected complexity

| Sub-option | Effort |
|-----------|--------|
| C1: Extract `.g4` from Pilot build, generate TS, wire ANTLR4 runtime | 1–2 weeks |
| C1: Write ANTLR CST → our ASTResult visitor | 2–4 weeks |
| C1: Implement scoping / resolution for full KerML type system | 4–8 weeks |
| C2: Write or adopt complete tree-sitter grammar for KerML+SysML v2 | 6–12 weeks |
| C2: Write tree-sitter CST → ASTResult visitor | 2–4 weeks |
| Shared: Extend `SysMLNode` kinds for full spec | 1–2 weeks |
| Shared: Update all visualizer views | 5–10 days |
| **C1 total estimate** | **8–16 weeks** |
| **C2 total estimate** | **12–20 weeks** |

### How it connects to the VS Code extension

This is the best option for the extension:
- The parser runs in the extension host process — no child process, no JVM,
  no network.
- All existing language provider registrations stay as-is; they call
  `analyzeSysML()` exactly as they do today.
- Response times are synchronous (milliseconds), matching Monaco's
  responsiveness expectations.
- The `.vsix` stays self-contained — no external download step.

For C2 (tree-sitter), the WASM module is bundled in the `.vsix` (typically
~200 KB gzipped). The VS Code extension API supports WebAssembly via
`vscode.Uri.joinPath` + `Buffer` loading.

### How it feeds the visualizer model

No change to the data flow. `analyzeSysML()` returns a richer `SysMLAnalysis`
with more node kinds, but the same interface:

```
source text
  → parseToAST()   (ANTLR4 or tree-sitter, replaces legacy parser)
  → buildModel()   (extended for new KerML/SysML v2 node kinds)
  → validate()     (conformant semantic checks replace legacy heuristics)
  → SysMLAnalysis  (same type, enriched parserMode = 'sysmlV2OfficialFuture')
  → visualizer views (extended for new diagram types)
```

---

## 5. Option D — Keep Legacy Subset as Permanent Fallback

### Concept

Do not integrate official SysML v2. Keep the current hand-written parser
as-is, frozen, and documented as a prototype. Accept that the tool works
only for models written in the custom subset language.

### Feasibility — Trivially high

Zero new development. The tool already works in this mode.

### Licensing concerns

None. Entirely our own code.

### Architecture

No change. `parserMode = 'legacySubset'` permanently.

### Expected complexity

Zero implementation cost. Ongoing documentation and user-expectation
management cost.

### Limitations

- Users who open real `.sysml` files from official SysML v2 projects will
  get parse errors on almost every line.
- As the SysML v2 ecosystem matures (tooling, training material, example
  models all use the official syntax) the tool becomes increasingly
  irrelevant.
- VS Code Marketplace discoverability depends on being useful to the
  growing SysML v2 community. A tool that only works with a custom language
  will be passed over in favour of official solutions.

### When to choose this option

Option D is the correct choice **right now** (May 2026), while the official
ecosystem is still evolving and before we have engineering capacity for the
integration work. The `legacySubset` freeze policy already implements this.

Option D becomes a **permanent dead end** if still active in 12–18 months.

---

## 6. Comparison Matrix

| Criterion | A: Pilot LSP Server | B: REST API | C1: ANTLR4 TypeScript | C2: tree-sitter | D: Legacy |
|-----------|--------------------|-----------|-----------------------|-----------------|-----------|
| **Spec conformance** | Full | Full | Full (if correct) | Full (if correct) | None |
| **JVM required** | Yes | Yes | No | No | No |
| **Network required** | No | Optional | No | No | No |
| **Startup latency** | 3–8 s | 3–8 s | <100 ms | <100 ms | <10 ms |
| **Bundle size impact** | +JAR (downloaded) | +JAR (downloaded) | +~2 MB (generated TS) | +~200 KB (WASM) | 0 |
| **Implementation effort** | 3–5 weeks | 2–4 weeks | 8–16 weeks | 12–20 weeks | 0 weeks |
| **License risk** | Low (LGPL, separate proc) | Low (LGPL, separate proc) | Low (BSD runtime) | Low (MIT runtime) | None |
| **VS Code provider quality** | High (LSP native) | Medium (async HTTP) | High (in-process) | High (in-process) | High (in-process) |
| **Visualizer model quality** | High | High | High | High | Low |
| **Error recovery** | Good (Xtext) | Good | Good (ANTLR) | Excellent | None |
| **Offline / air-gapped** | Yes (local JAR) | Only if local | Yes | Yes | Yes |
| **Maintenance burden** | Low (upstream grammar changes tracked via JAR version) | Low | High (must track grammar changes in generated code) | Medium | Zero |
| **Prerequisite for** | Nothing | Nothing | Nothing | VS Code web ext | Demos only |

---

## 7. Recommended Path

### Phase 0 (now — 6 months): Maintain legacySubset frozen

The parser is frozen as of May 2026. No new constructs. Continue to ship
the tool as a prototype visualizer for the custom subset language. Use this
time to:

- Monitor the official pilot implementation for stability
- Evaluate whether the Pilot LSP server's custom command mechanism is
  sufficient for our needs (spike: 2–3 days)
- Track the community tree-sitter grammar for SysML v2

### Phase 1 (6–12 months): Option A prototype

Option A has the best balance of effort, spec coverage, and maintenance
burden. It leverages existing, tested infrastructure (Xtext LSP) rather
than reimplementing the grammar.

Milestone deliverables:
1. VS Code extension launches the Pilot LSP server JAR as a child process
2. Standard LSP language features (hover, completion, definition, diagnostics)
   work against real SysML v2 files
3. Custom `sysml/getSemanticModel` command returns a JSON-LD snapshot
4. JSON-LD → `ParseResult` adapter converts the snapshot to our model shape
5. Existing visualizer views render correctly from real SysML v2 models

The legacy parser remains active in parallel behind `parserMode === 'legacySubset'`.
Users can toggle between modes in settings while the new mode matures.

### Phase 2 (12–24 months): Option C1 if Option A proves insufficient

If the JVM startup cost or the custom command approach proves unacceptable
(e.g. the VS Code Marketplace rejects extensions that spawn JVMs, or users
resist the Java dependency), migrate to C1 (ANTLR4 TypeScript).

Phase 2 builds on the JSON-LD adapter already written in Phase 1 — the
adapter becomes a reference for what the ANTLR CST visitor must produce.

---

## 8. Integration Boundary in This Codebase

The codebase is already structured to make this integration clean.
All changes needed for any option are confined to a small set of files.

### Files that change

| File | Change needed |
|------|---------------|
| `src/core/parserMode.ts` | Set `PARSER_MODE = 'sysmlV2OfficialFuture'` when ready |
| `src/core/parser/astParser.ts` | Replace with ANTLR/tree-sitter parser (Option C) or adapter (Options A/B) |
| `src/core/analyzer/analyzeSysML.ts` | Route to official parser when `PARSER_MODE !== 'legacySubset'` |
| `src/core/modelTypes.ts` | Add new `SysMLNode` kinds for KerML/SysML v2 concepts |
| `src-vscode/extension.ts` | Add `LanguageClient` (Option A) or `fetch` calls (Option B), or nothing (Option C) |

### Files that do not change

| File | Reason |
|------|--------|
| `src/ui/views/*.tsx` | Views consume `ParseResult` — same interface, just richer |
| `src/ui/layout/graphLayout.ts` | ELK layout is model-agnostic |
| `src/app/state.ts` | Project persistence is model-agnostic |
| `src/app/selection.ts` | `SelectionState` is model-agnostic |

### Guard pattern for new code

Any new code that is mode-specific should use the guard from `parserMode.ts`:

```typescript
import { PARSER_MODE } from '../parserMode';

if (PARSER_MODE === 'legacySubset') {
  // legacy behaviour — will be removed when legacySubset is retired
} else {
  // conformant behaviour
}
```

This makes legacy paths easy to grep and remove in bulk when the transition
is complete.

---

## 9. SysML v2 Node-Kind Mapping

When official parsing is available, the existing `SysMLNode` kind union in
`modelTypes.ts` must be extended. Below is a forward-looking mapping between
official SysML v2 / KerML concepts and the extended kind values needed.

### Already mapped (legacy subset → SysML v2 official equivalent)

| Legacy kind | Official SysML v2 concept | Notes |
|-------------|--------------------------|-------|
| `packageDef` | `Package` (KerML) | Direct equivalent |
| `interfaceDef` | `PortDefinition` or `InterfaceDefinition` | Legacy merges both |
| `partDef` | `PartDefinition` | Direct equivalent |
| `partAlias` | `PartUsage` | Direct equivalent |
| `port` | `PortUsage` (direction in/out) | Direct equivalent |
| `connection` | `ConnectionUsage` | Direct equivalent |
| `occurrenceDef` | `OccurrenceDefinition` | Direct equivalent |
| `message` | `MessageOccurrenceSpecification` (at UML level; SysML v2 uses `MessageUsage`) | Approximate |
| `behaviorDef` | `ActionDefinition` / `BehaviorDefinition` | Legacy oversimplifies |
| `actionDef` | `ActionDefinition` | Direct equivalent |
| `actionInst` | `ActionUsage` | Direct equivalent |
| `flow` | `SuccessionAsUsage` / `FlowConnectionUsage` | Legacy flow ≈ succession |
| `stateDef` | `StateDefinition` | Direct equivalent |
| `stateEntry` | `StateUsage` | Direct equivalent |
| `transition` | `TransitionUsage` | Direct equivalent |
| `requirementDef` | `RequirementDefinition` | Direct equivalent |
| `traceLink` | `SatisfyRequirementUsage` / `VerifyRequirementUsage` | Direct equivalent |

### New kinds required (no legacy equivalent)

| Official concept | New kind to add | Visualizer view |
|-----------------|-----------------|-----------------|
| `AttributeDefinition` / `AttributeUsage` | `attributeDef` / `attributeUsage` | Structure view (properties) |
| `ItemDefinition` / `ItemUsage` | `itemDef` / `itemUsage` | Structure view |
| `CalcDefinition` / `CalcUsage` | `calcDef` / `calcUsage` | Behavior view extension |
| `ConstraintDefinition` | `constraintDef` | Requirements view extension |
| `ViewDefinition` / `ViewUsage` | `viewDef` | New View panel |
| `RenderingDefinition` | `renderingDef` | New View panel |
| `AllocationDefinition` | `allocationDef` | New Allocation panel |
| `UseCaseDefinition` | `useCaseDef` | New Use Case panel |
| `Multiplicity` (e.g. `[0..*]`) | embedded in usage nodes | All structure views |
| `Specialization` (`:>`) | `specialization` edge | New inheritance edge type in Structure view |
| `Redefinition` (`redefines`) | `redefinition` edge | New edge type |
| `Subsetting` (`:>>`) | `subsetting` edge | New edge type |
| `ConjugatedPortDefinition` | embedded in `interfaceDef` | Structure view port side |
| `MetadataDefinition` | `metadataDef` | Inspector panel |
| `Annotation` / `Comment` | `annotation` | Inspector panel |
| `Documentation` (`doc`) | `documentation` | Inspector panel |
| `Import` | resolved at model-build time | No separate view node |

### Visualizer view coverage under SysML v2

| View panel | SysML v2 diagram kind covered | Status |
|-----------|-------------------------------|--------|
| Structure | Internal Block Diagram (ibd), Block Definition Diagram (bdd) | Extends well |
| Sequence | Sequence Diagram | Extends well |
| Behavior | Activity Diagram | Extends with `CalcUsage`, `ItemFlow` |
| State | State Machine Diagram | Direct extension |
| Requirements | Requirements Diagram | Extends with `ConstraintDefinition` |
| Traceability | Traceability / Allocation matrix | Extends well |
| **[New] Allocation** | Allocation Diagram | Needs new panel |
| **[New] Use Case** | Use Case Diagram | Needs new panel |
| **[New] View/Rendering** | View Diagram | Needs new panel |
| **[New] Parametric** | Parametric Diagram (ConstraintBlock) | Needs new panel |

---

*Document authored: 2026-05-08.*  
*Review trigger: revisit if the Pilot Implementation releases a stable 1.0 JAR,
if the community tree-sitter grammar reaches full KerML coverage, or if
engineering capacity for Phase 1 becomes available.*
