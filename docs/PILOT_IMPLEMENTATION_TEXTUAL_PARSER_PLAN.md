# Pilot Implementation Textual Parser — Integration Plan

**Status:** Investigation milestone — no implementation has begun.  
**Context:** `SysML-v2-API-Services` endpoint inspection confirmed it is a
repository/model API.  It cannot parse raw `.sysml` text.  This document
describes the next step: integrating the official textual notation parser from
the SysML v2 Pilot Implementation.

See also `OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md` for the full multi-option
analysis and phased roadmap.

---

## Why API Services Is Not Enough

`SysML-v2-API-Services` exposes:

| Endpoint group | What it does |
|---|---|
| `/projects`, `/branches`, `/commits` | Version and store element graphs |
| `/elements`, `/relationships` | Query already-committed model elements |
| `/queries` | Execute model queries against stored elements |
| `/meta/datatypes` | Inspect the meta-model type registry |

It does **not** expose:

- Any endpoint that accepts raw SysML v2 or KerML source text.
- Any endpoint that returns parse diagnostics (errors, warnings).
- Any endpoint that converts textual notation into element objects.

Conclusion: API Services requires elements to be submitted in their already-parsed
form.  A separate textual parser must run before API Services can be used.

---

## Target: SysML v2 Pilot Implementation Textual Parser

**Repository:** `Systems-Modeling/SysML-v2-Pilot-Implementation`  
**Technology:** Java 17, Eclipse EMF, Xtext 2.x, Gradle  
**License:** LGPL-3.0-or-later (we invoke as a separate process — no LGPL obligations on our code)

The Pilot Implementation includes the only authoritative, OMG-maintained
parser for the full KerML + SysML v2 textual notation.  Its Xtext grammar
covers all language constructs in the current specification drafts.

### What the parser can provide

| Output | Availability | Notes |
|---|---|---|
| Parse diagnostics | Yes | Xtext `IssueList` — errors, warnings, infos with line/column |
| Abstract syntax tree (AST) | Yes | Xtext `EObject` tree (EMF model) |
| Model serialization as JSON-LD | Likely | The companion API Services uses JSON-LD for element interchange |
| Model serialization as XMI | Yes | Xtext/EMF native serialization format |
| Source location on each element | Yes | Xtext `INode` / `NodeModelUtils` attaches offset/length to every AST node |

---

## Goal: Headless or Wrapper Invocation

The parser must be reachable from the VS Code extension (Node.js process) and
from the `parser-service` wrapper.  Two viable invocation strategies exist:

### Strategy 1 — Pilot Implementation as an LSP server (preferred)

Xtext auto-generates a Language Server Protocol (LSP) server from its grammar.
The Pilot Implementation ships this server as a standalone JAR.

```
VS Code extension
  └─ spawns: java -jar sysml-v2-ls.jar  (stdio transport)
       ↕ LSP (textDocument/publishDiagnostics, textDocument/hover, …)
  └─ custom command: sysml/getSemanticModel
       → JSON snapshot of the current file's element graph
       → forwarded to the webview as the visualizer model
```

Diagnostics arrive via standard LSP `textDocument/publishDiagnostics`.  The
model snapshot is returned by a custom LSP command (non-standard extension
to the protocol, implemented server-side in Java).

**Investigation needed:** confirm the JAR can be launched headlessly (without
Eclipse UI), and confirm or prototype the custom command mechanism.
See `parser-service/docs/TEXTUAL_PARSER_SPIKE.md`.

### Strategy 2 — HTTP wrapper around the Pilot parser (interim)

If the LSP approach requires non-trivial Java changes, an interim HTTP wrapper
can be written that:

1. Receives `POST /parse { "text": "..." }` from the `parser-service` wrapper.
2. Invokes the Xtext `StandaloneSetup` + `IResourceValidator` programmatically.
3. Returns diagnostics and an XMI or JSON-LD serialization of the model.

This satisfies the `parser-service` contract (`contract/openapi.yaml`) without
any LSP wiring.

```
VS Code extension → parser-service (port 9001) → HTTP wrapper (port 9000)
                                                    └─ Xtext headless parse
                                                    └─ returns JSON { diagnostics, modelJson }
```

---

## Expected Output Shape

Regardless of invocation strategy, the parser must return:

```json
{
  "success": true,
  "diagnostics": [
    {
      "severity": "error",
      "message": "Unexpected token 'part'",
      "line": 3,
      "column": 5
    }
  ],
  "modelJson": {
    "elements": [
      {
        "@type": "SysML::PartDefinition",
        "name": "Vehicle",
        "ownedFeature": [ ... ],
        "sourceLocation": { "line": 1, "column": 1 }
      }
    ]
  }
}
```

This is the contract defined in `parser-service/contract/openapi.yaml`.  The
`modelJson` shape will be refined once the Pilot Implementation's actual
serialization format is confirmed by the spike investigation.

---

## Integration Boundary in This Codebase

No existing files need to change until the spike is complete and a strategy
is chosen.  When implementation begins:

| File | Change |
|---|---|
| `src-vscode/extension.ts` | Add LSP client (Strategy 1) or HTTP polling (Strategy 2) |
| `parser-service/src/officialBackendClient.ts` | Implement HTTP forwarding to Pilot wrapper (Strategy 2) |
| `src/core/parserMode.ts` | Enable `'sysmlV2OfficialFuture'` mode when parser is available |
| `src/core/parser/astParser.ts` | Add adapter from Pilot Implementation JSON-LD → internal AST |
| `src/core/modelTypes.ts` | Extend `SysMLNode` kind union for official element types |

Existing visualizer views, the legacy parser, and all `legacySubset` paths are
unchanged.

---

## Next Steps

1. Complete the spike in `parser-service/docs/TEXTUAL_PARSER_SPIKE.md`.
2. Confirm whether the Pilot JAR can be launched headlessly (Strategy 1
   depends on this).
3. Identify the JSON-LD or XMI output format to write the adapter.
4. Choose Strategy 1 or 2 and document the decision.
5. Implement the chosen strategy in `parser-service/src/officialBackendClient.ts`.

---

*Document authored: 2026-05-09.*  
*Review trigger: revisit after the spike in `TEXTUAL_PARSER_SPIKE.md` is complete.*
