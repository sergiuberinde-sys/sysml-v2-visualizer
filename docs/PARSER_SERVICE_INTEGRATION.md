# Parser Service Integration

**Status:** Interface defined. Service not yet implemented.  
**Goal:** Replace the frozen prototype parser with an official SysML v2 / KerML
parsing backend reachable over HTTP.

---

## What this document covers

- The three recommended integration targets (A, B, C)
- The HTTP API contract the visualizer expects
- How to configure the endpoint in VS Code and the standalone web app
- What happens when the service is unavailable

---

## Integration targets

### A — SysML v2 Pilot Implementation

**Repository:** `github.com/Systems-Modeling/SysML-v2-Pilot-Implementation`  
**Language:** Java / Xtext / Eclipse  
**License:** LGPL-3.0

The official open-source reference implementation of the SysML v2 specification.
It includes:
- A full KerML + SysML v2 textual grammar (ANTLR4 via Xtext)
- An LSP server (`sysml-lang.ide` module) supporting diagnostics, hover, completion
- A REST-based API service (`sysml-lang.services` module) that serialises parsed
  models to JSON-LD

**Integration path:**

1. Run the Pilot Implementation REST service locally (requires JDK 17+):
   ```
   ./run.sh
   # or via the published Docker image (not yet official)
   ```
2. Wrap the `/sysml/v2/projects/.../commits/.../elements` endpoints behind the
   simple `POST /parse` adapter described below.
3. Point the visualizer at `http://localhost:9000`.

**Effort estimate:** 2–4 days for the adapter wrapper.

---

### B — SysML v2 API Services

**Specification:** OMG SysML v2 API and Services specification (formal/2023-12-01)  
**Reference implementation:** Pilot Implementation REST service (same as Option A)

The SysML v2 specification defines a standard REST API for accessing model
repositories.  If a hosted instance is available (corporate SysML repository,
cloud-based tooling), the same adapter can target it.

The relevant endpoint is `POST /parse` on whatever wrapper proxies the
official API to our simplified contract.

---

### C — Official SysML v2 Release / Example Models

**Repository:** `github.com/Systems-Modeling/SysML-v2-Release`

The official model library and example files distributed with each SysML v2
release.  These are used as integration test fixtures — put them in
`official-sysmlv2-samples/` and verify the parser service returns `success: true`
for each.

They are **not** a parser implementation; they are test inputs.

---

## HTTP API contract

The visualizer expects the following endpoints at the configured base URL
(default: `http://localhost:9000`).

### `GET /health`

Liveness check. Called before parse attempts to give an early error if the
service is down.

**Response — 200 OK**
```json
{ "status": "ok" }
```

Any non-200 or network failure is treated as service unavailable.

---

### `POST /parse`

Parse SysML v2 / KerML source text.

**Request**
```
POST http://localhost:9000/parse
Content-Type: application/json

{
  "text": "<full source text of a .sysml or .kerml file>"
}
```

**Response — 200 OK**
```json
{
  "success": true,
  "diagnostics": [
    {
      "message": "Unexpected token ';'",
      "line": 12,
      "column": 4,
      "severity": "error"
    }
  ],
  "modelJson": { "...": "semantic model in JSON-LD or similar format" },
  "rawResponse": null,
  "error": null
}
```

**Response schema**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | `boolean` | yes | `true` if parsed without fatal errors |
| `diagnostics` | `array` | yes | Parse/semantic diagnostics (may be non-empty when `success` is `true`) |
| `diagnostics[].message` | `string` | yes | Human-readable description |
| `diagnostics[].line` | `number` | no | 1-based source line |
| `diagnostics[].column` | `number` | no | 1-based source column |
| `diagnostics[].severity` | `"error"\|"warning"\|"info"` | yes | Severity level |
| `modelJson` | `unknown` | no | Semantic model (reserved for future VisualizerModel adapter) |
| `rawResponse` | `unknown` | no | Raw backend response, for debugging |
| `error` | `string` | no | Infrastructure-level error (not a parse diagnostic) |

**Non-200 responses**

Return JSON with an `"error"` field describing the failure:
```json
{ "success": false, "diagnostics": [], "error": "Internal server error" }
```

---

## CORS

If the service runs as a separate process (not inside the VS Code extension
host), it must return:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type
```

The VS Code webview and the standalone web app both require this header to
reach an external HTTP service.

---

## Endpoint configuration

### In VS Code

Set `sysmlVisualizer.parserServiceUrl` in VS Code settings (UI or `settings.json`):

```json
{
  "sysmlVisualizer.parserServiceUrl": "http://localhost:9000"
}
```

The extension reads this setting and sends it to the webview automatically.
Changes take effect immediately — no reload required.

### In the standalone web app

- **UI**: enter the URL in the endpoint input next to the "Official SysML v2"
  mode selector in the tab bar. The value is saved in `localStorage`.
- **Build-time default**: set the `VITE_SYSML_V2_PARSER_URL` environment
  variable before running `npm run build` or `npm run dev`.

---

## What the visualizer shows when the service is unavailable

When Official SysML v2 mode is selected but the service cannot be reached:

> Official SysML v2 parser service is not available.  
> Check endpoint: http://localhost:9000

The prototype (Legacy Subset) views are not affected — switch back to
**Prototype Subset** mode to continue using them.

---

## Source locations

| File | Purpose |
|------|---------|
| `src/core/sysmlv2Official/SysMLV2ParseResult.ts` | TypeScript response type |
| `src/core/sysmlv2Official/SysMLV2ParserService.ts` | Service interface |
| `src/core/sysmlv2Official/HttpSysMLV2ParserService.ts` | `fetch`-based HTTP implementation |
| `parser-service/README.md` | Service wrapper development guide |
| `parser-service/contract/openapi.yaml` | Machine-readable API contract |
| `parser-service/sample-response.json` | Example response payloads |
| `official-sysmlv2-samples/` | Official `.sysml` files for integration tests |
| `docs/MIGRATION_TO_SYSML_V2.md` | Full migration roadmap |
