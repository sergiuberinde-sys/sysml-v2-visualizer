# SysML v2 Parser Service

This package contains the Node.js bridge between the VS Code extension and the official OMG SysML v2 Java parser.

## Role in the architecture

```
Extension host (src-vscode/extension.ts)
        │
        ▼
JavaWrapperClient  (parser-service/src/javaWrapperClient.ts)
  • Manages a persistent JVM process via stdin/stdout JSON protocol
  • Locates Java automatically (JAVA_HOME, well-known install dirs, PATH)
        │
        ▼
JVM process  (java-parser-wrapper/target/sysml-parse-cli.jar)
```

The extension host imports `JavaWrapperClient`, `buildGraph`, and `buildBehavior` directly from this package's source — no HTTP server is involved in the normal VS Code extension flow.

## Source files

| File | Purpose |
|------|---------|
| `javaWrapperClient.ts` | Persistent JVM process manager; the main integration point |
| `graphBuilder.ts` | Converts the Java parser's AST model into a graph for the structure view |
| `behaviorBuilder.ts` | Extracts behavior/action flow data from the AST model |
| `types.ts` | Shared TypeScript types (`SysMLV2ParseResult`, etc.) |
| `officialBackendClient.ts` | Interface implemented by `JavaWrapperClient` |
| `index.ts` | Optional standalone HTTP server (see below) |

## Optional: standalone HTTP server mode

`index.ts` exposes the parser as an HTTP service (`POST /parse`, `GET /health`) on port 9001. This is useful for running the parser outside VS Code (CI pipelines, other tooling).

```bash
# From the repo root
npm run parser:dev    # development (ts-node, hot reload)
npm run parser:start  # production (requires npm run parser:build first)
```

The VS Code extension setting `sysmlVisualizer.parserServiceUrl` can point to this service if you prefer HTTP mode over the embedded JVM.

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `SYSML_PARSER_JAR` | *(auto-detected)* | Explicit path to `sysml-parse-cli.jar` |
| `SYSML_STDLIB_PATH` | *(auto-detected)* | Path to the SysML standard library directory |
| `SYSML_JAVA_HOME` | *(auto-detected)* | Override Java installation to use |
| `PARSER_SERVICE_PORT` | `9001` | Port for the optional HTTP server |

## SysML standard library

`sysml-stdlib/` contains the official OMG SysML v2 standard library files. The JVM loads these on startup. The path is resolved from `SYSML_STDLIB_PATH`, or auto-detected relative to the JAR location.
