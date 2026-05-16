# SysML v2 Parser Service

This is the **wrapper service** that the SysML v2 Visualizer calls when
Official SysML v2 mode is active (both in the webview and VS Code Problems panel).

It exposes `POST /parse` and `GET /health` and routes to whichever backend is
configured (Java wrapper → HTTP backend → stub).

---

## Quick start — Java wrapper mode (recommended)

**Requirements:** Java 21, Maven, the `java-parser-wrapper` JAR built.

### Step 1 — build the Java CLI wrapper

```bash
# One-time: install the Pilot Implementation fat JAR into local Maven repo.
# (Skip if you have already done this.)
mvn install:install-file \
  -Dfile=$HOME/official-backends/SysML-v2-Pilot-Implementation/org.omg.sysml.interactive/target/org.omg.sysml.interactive-0.59.0-SNAPSHOT-all.jar \
  -DgroupId=org.omg.sysml \
  -DartifactId=org.omg.sysml.interactive \
  -Dversion=0.59.0-SNAPSHOT \
  -Dclassifier=all \
  -Dpackaging=jar \
  -DgeneratePom=true

# Build the CLI wrapper JAR
cd java-parser-wrapper
mvn clean package
# Produces: java-parser-wrapper/target/sysml-parse-cli.jar
```

### Step 2 — start the parser service

```bash
# From the repo root — set JAVA_HOME to Java 21 (required; JAR is compiled for Java 21)
JAVA_HOME=/opt/homebrew/Cellar/openjdk@21/21.0.11/libexec/openjdk.jdk/Contents/Home \
  npm run parser:start
```

The service auto-detects the JAR at `java-parser-wrapper/target/sysml-parse-cli.jar`
relative to the project root and logs `Java wrapper mode (auto-detected JAR)`.

### Step 3 — enable official mode in VS Code

In VS Code settings, set:

```json
{
  "sysmlVisualizer.officialParserMode": true
}
```

This routes VS Code Problems panel diagnostics through the parser service.
The `parserServiceUrl` setting defaults to `http://localhost:9001`.

---

## Port layout

| Service | Default port | Role |
|---|---|---|
| **This wrapper** | `9001` | Parser gateway called by the extension |

---

## Quick start (stub mode — no backend)

```bash
# From the repo root:
npm run parser:build   # compile TypeScript
npm run parser:start   # start on http://localhost:9001
```

Or from inside this folder:

```bash
npm install
npm run dev     # ts-node (development, live-reload)
npm run build   # tsc → dist/
npm run start   # node dist/index.js
```

---

## Configuration

| Env var | Default | Description |
|---|---|---|
| `PARSER_SERVICE_PORT` | `9001` | Port this wrapper listens on |
| `PORT` | `9001` | Fallback if `PARSER_SERVICE_PORT` is not set |
| `SYSML_PARSER_JAR` | *(auto)* | Explicit path to `sysml-parse-cli.jar` |
| `JAVA_HOME` | *(system)* | Java 21 home — **required** when system `java` is not Java 21 |
| `OFFICIAL_SYSML_BACKEND_URL` | *(unset)* | HTTP backend URL (legacy fallback) |

**Backend selection priority:**
1. `SYSML_PARSER_JAR` set → Java wrapper at that path
2. JAR auto-detected at `java-parser-wrapper/target/sysml-parse-cli.jar` → Java wrapper
3. `OFFICIAL_SYSML_BACKEND_URL` set → HTTP client
4. None → stub (returns "not connected")

---

## Endpoints

### `GET /health`

```json
{
  "status": "ok",
  "service": "sysml-v2-parser-wrapper",
  "officialParserConnected": false
}
```

`officialParserConnected` reflects a live probe of the upstream backend.

### `POST /parse`

**Request body:** `{ "text": "<sysml source text>" }`

**Response when backend is not connected:**
```json
{
  "success": false,
  "diagnostics": [
    { "message": "Official backend not connected.", "severity": "info", "line": 1, "column": 1 }
  ],
  "error": "Official backend not connected"
}
```

**Response when backend is connected:** forwarded from the upstream backend
(see `contract/openapi.yaml` and `sample-response.json`).

---

## Response format

The TypeScript interface the visualizer uses:
```typescript
// src/core/sysmlv2Official/SysMLV2ParseResult.ts
interface SysMLV2ParseResult {
  success: boolean;
  diagnostics: Array<{
    message: string;
    line?: number;
    column?: number;
    severity: 'error' | 'warning' | 'info';
  }>;
  modelJson?: unknown;
  rawResponse?: unknown;
  error?: string;
}
```

Full schema: `contract/openapi.yaml`.  Examples: `sample-response.json`.

---

## Further reading

- `docs/OFFICIAL_BACKEND_OPTIONS.md` — which backend to use for text parsing vs storage
- `docs/OFFICIAL_BACKEND_ENDPOINT_MAPPING.md` — confirmed endpoint findings and integration path
- `docs/RUN_OFFICIAL_SYSML_API_SERVICES.md` — API Services local setup (storage layer, not parser)
