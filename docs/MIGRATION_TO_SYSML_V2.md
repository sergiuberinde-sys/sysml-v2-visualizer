# Migration to SysML v2 — Developer Guide

**Status:** Architecture prepared and HTTP service boundary live (May 2026).  
**Audience:** Engineers integrating an official SysML v2 parser backend.

---

## Current state — prototype subset

The visualizer currently parses a **custom prototype language** invented for
this tool.  It is NOT conformant SysML v2.  The parser is frozen — no new
grammar rules or node kinds will be added.

Key facts:
- Parser class: `PrototypeSubsetParser` (`src/core/parser/PrototypeSubsetParser.ts`)
- Underlying grammar: `src/core/parser/astParser.ts` (FROZEN)
- Mode flag: `PARSER_MODE = 'legacySubset'` in `src/core/parserMode.ts`
- UI badge: amber "Legacy Subset" shown when Prototype Subset mode is active

---

## Target state — official SysML v2

A running official SysML v2 parser service (HTTP) that accepts source text and
returns parse diagnostics and a semantic model JSON.

The visualizer connects to this service via `HttpSysMLV2ParserService`.  When
the service is available:
- Diagnostics from the official backend are shown in the editor and Problems panel.
- The semantic model JSON is available for future VisualizerModel mapping.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Runtime mode: prototypeSubset                                  │
│                                                                 │
│  source text                                                    │
│    ──► PrototypeSubsetParser.parse(text)                       │
│          ──► astParser.ts  (FROZEN)                             │
│          ──► analyzeSysML                                       │
│          ──► legacySubsetAdapter.convert()                      │
│    ──► VisualizerModel  ◄── all views                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Runtime mode: officialSysMLV2                                  │
│                                                                 │
│  source text                                                    │
│    ──► HttpSysMLV2ParserService.parse(text)                    │
│          POST {endpoint}/parse  →  SysMLV2ParseResult          │
│    ──► diagnostics shown in editor + Problems panel             │
│    ──► [NOT YET] officialSysMLAdapter.convert(modelJson)        │
│    ──► [NOT YET] VisualizerModel  ◄── all views                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer map

| Layer | Files | Description |
|-------|-------|-------------|
| **Parsing** | `src/core/parser/IParser.ts` | Sync in-process parser interface |
| | `src/core/parser/PrototypeSubsetParser.ts` | Active legacy parser (temporary) |
| | `src/core/sysmlv2Parser/SysMLV2GrammarParser.ts` | Future grammar-based parser (placeholder) |
| **HTTP service** | `src/core/sysmlv2Official/SysMLV2ParserService.ts` | Async remote parser interface |
| | `src/core/sysmlv2Official/HttpSysMLV2ParserService.ts` | HTTP POST implementation |
| | `src/core/sysmlv2Official/SysMLV2ParseResult.ts` | Wire-level result type |
| **Adapter** | `src/core/adapters/legacySubsetAdapter.ts` | ParseResult → VisualizerModel (active) |
| | `src/core/adapters/officialSysMLAdapter.ts` | Future: modelJson → VisualizerModel |
| **Model** | `src/core/visualizerModel/` | Stable view API boundary |
| **Views** | `src/ui/views/` | All consume VisualizerModel only |

---

## HTTP service protocol

### Request

```
POST {endpoint}/parse
Content-Type: application/json

{ "text": "<full sysml source text>" }
```

### Response (200 OK)

```json
{
  "success": true,
  "diagnostics": [
    {
      "message": "Unexpected token",
      "line": 3,
      "column": 12,
      "severity": "error"
    }
  ],
  "modelJson": { ... }
}
```

### Error responses

| Condition | `success` | `error` field |
|-----------|-----------|---------------|
| Network failure / service down | `false` | `"SERVICE_UNAVAILABLE"` |
| Non-200 HTTP status | `false` | `"HTTP 500: ..."` |
| Invalid JSON body | `false` | `"Invalid JSON response..."` |
| Parse failed (valid response) | `false` | not set; diagnostics array populated |

---

## Switching the active mode

The mode is selected by the user at runtime via the Mode dropdown in the
visualizer tab bar.  The selection is persisted in `localStorage`.

| Mode | Parser | Views |
|------|--------|-------|
| `prototypeSubset` | `PrototypeSubsetParser` | All views work |
| `officialSysMLV2` | `HttpSysMLV2ParserService` | Empty (mapping not yet done) |

To change the default mode in code, update `src/core/parserMode.ts`:
```typescript
export const PARSER_MODE: ParserMode = 'sysmlV2OfficialFuture';
```

---

## Steps to complete the integration

### Step 1 — Run a compatible parser service

Start a local SysML v2 parser service that accepts `POST /parse` requests.
Compatible options:

- **Option A**: Wrap the Pilot Implementation LSP server behind an HTTP adapter.
- **Option B**: Use the official SysML v2 REST API service if available.

Default endpoint: `http://localhost:9000` (configurable in the UI or via
`VITE_SYSML_V2_PARSER_URL` environment variable).

### Step 2 — Validate with sample files

Put official `.sysml` files in `official-sysmlv2-samples/` and verify that
the service returns `success: true` for each.  See that folder's README.

### Step 3 — Implement `officialSysMLAdapter.convert()`

When `SysMLV2ParseResult.modelJson` has a stable structure, implement:

```typescript
// src/core/adapters/officialSysMLAdapter.ts
export function convert(modelJson: OfficialParseOutput): VisualizerModel { ... }
```

Map JSON-LD / model elements to `VizNode`, `VizPackageNode`, `VizDiagnostic`.

### Step 4 — Wire the adapter in App.tsx

When `modelingMode === 'officialSysMLV2'` and `officialParseResult.success`:

```typescript
const vizModel = officialSysMLAdapter.convert(officialParseResult.modelJson);
```

Replace the `OFFICIAL_EMPTY_VIZ_MODEL` constant with this call.

### Step 5 — Update `PARSER_MODE`

```typescript
export const PARSER_MODE: ParserMode = 'sysmlV2OfficialFuture';
```

---

## Files that must NOT change during a parser swap

| File | Reason |
|------|--------|
| `src/ui/views/*.tsx` | All consume VisualizerModel only |
| `src/ui/panels/*.tsx` | All consume VisualizerModel only |
| `src/app/sourceMatcher.ts` | Accepts VisualizerModel |
| `src/app/history.ts` | Accepts VisualizerModel |
| `src/core/visualizerModel/` | Stable type boundary |

---

*Authored: 2026-05-08. Updated: 2026-05-08.*
