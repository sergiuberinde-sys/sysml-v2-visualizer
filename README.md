# SysML v2 Visualizer — VS Code Extension

A VS Code extension that parses SysML v2 files using the official OMG reference implementation and visualizes the model as interactive diagrams: structure, sequence, state, behavior, requirements, and traceability views.

---

## Architecture

The extension has four layers that work together:

```
VS Code Editor (.sysml file)
        │
        ▼
Extension Host  (src-vscode/extension.ts)
  • Debounced parse trigger
  • Content-hash cache (memory + disk)
  • Diagnostic squiggles, go-to-definition, hover, rename, completions
        │
        ▼
JavaWrapperClient  (parser-service/src/javaWrapperClient.ts)
  • Manages a persistent JVM process (stdin/stdout JSON protocol)
  • Finds Java on PATH / well-known install dirs (Windows + macOS)
  • Pre-flight Java version check (requires Java 17+)
        │
        ▼
JVM Process  (java-parser-wrapper/target/sysml-parse-cli.jar)
  • Fat JAR bundling the official OMG SysML v2 pilot implementation
  • Loads the SysML standard library once on startup (~30 s cold, <1 s warm)
  • Accepts parse requests as line-delimited JSON on stdin
  • Returns diagnostics + AST model as JSON on stdout
        │
        ▼
React Webview  (src/)
  • Receives graph/behavior data from the extension host via postMessage
  • Renders structure, sequence, state, behavior, requirements, traceability views
  • Bidirectional cursor sync with the editor
```

**Parse result caching** — results are cached by SHA-256 of the file content, first in memory (5-minute TTL) and then on disk (VS Code global storage, up to 50 files). An unchanged file loads instantly on every subsequent open, even after restarting VS Code.

---

## Repository layout

```
src/                    React webview (TypeScript)
  core/                 Parser, model builder, analyzer, validator
  ui/                   Views, panels, layout components
src-vscode/
  extension.ts          VS Code extension entry point
parser-service/
  src/                  JavaWrapperClient, graph builder, behavior builder
  sysml-stdlib/         Official SysML v2 standard library (tracked in git)
java-parser-wrapper/
  src/                  Java source for the stdin/stdout JVM wrapper
  target/
    sysml-parse-cli.jar Pre-built fat JAR (tracked in git)
syntaxes/               TextMate grammar for .sysml syntax highlighting
scripts/                Build helper scripts
demo-projects/          Example .sysml files
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Build the extension and webview |
| npm | bundled with Node | Package management |
| Java | 17 or 21 | Run the JVM parser at runtime — **auto-installed** by the extension if missing |
| Maven | 3.8+ | Rebuild the JAR (only needed if changing Java wrapper source) |
| vsce | bundled via `@vscode/vsce` | Package the `.vsix` |

The pre-built JAR is committed to the repository so **Maven is not required** unless the Java wrapper source is changed.

> **Java auto-installation** — if Java 17 or 21 is not found on activation, the extension downloads Eclipse Temurin 21 from [Adoptium](https://adoptium.net) (~200 MB) and stores it in VS Code's global storage. Supported platforms: macOS (x64, arm64), Linux (x64, arm64), Windows (x64). The download happens once; subsequent launches reuse the cached runtime.

---

## Development setup

```bash
# 1. Install Node dependencies
npm install

# 2. Start the webview dev server (hot reload)
npm run dev
# Opens http://localhost:5173 — useful for working on the React views without VS Code.

# 3. Compile the VS Code extension
npm run compile:extension

# 4. Open the repo in VS Code and press F5 to launch an Extension Development Host.
```

### Rebuilding the JAR

Only needed when changing `java-parser-wrapper/src/`:

```bash
cd java-parser-wrapper
mvn clean package -DskipTests
# Output: target/sysml-parse-cli.jar
```

---

## Building and packaging

```bash
# Full production build (type-check + bundle webview)
npm run build

# Compile the extension TypeScript
npm run compile:extension

# Package as a .vsix installer
npm run package:extension
# Output: sysml-v2-visualizer-0.0.1.vsix
```

### Installing the VSIX

In VS Code: **Extensions** → **...** → **Install from VSIX…** → select the `.vsix` file.

Or from the command line:

```bash
code --install-extension sysml-v2-visualizer-0.0.1.vsix
```

---

## Running tests

```bash
npm test
```

---

## Key VS Code commands

| Command | Description |
|---------|-------------|
| `Open SysML v2 Visualizer` | Open the visualizer panel beside the active `.sysml` file |
| `SysML: Debug Diagnostics` | Show current diagnostic state in a popup |
| `SysML: Debug Semantic Tokens` | Show token counts for the active file |

**Language features** (active on any `.sysml` file):
- Syntax highlighting
- Semantic token coloring
- Diagnostic squiggles (powered by the official OMG parser)
- Go-to-definition (F12) and Ctrl/Cmd+Click
- Find references (Shift+F12)
- Hover documentation
- Rename symbol (F2)
- Format document (Shift+Alt+F)
- Document outline (Ctrl+Shift+O)
- Code completion

---

## Extension settings

| Setting | Default | Description |
|---------|---------|-------------|
| `sysmlVisualizer.parserServiceUrl` | `http://localhost:9001` | Legacy HTTP parser URL (not used in current architecture) |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Webview UI | React 19 + TypeScript |
| Build tool | Vite |
| Diagrams | React Flow (`@xyflow/react`), ELK layout (`elkjs`) |
| Editor widget | Monaco Editor |
| SysML parser | OMG SysML v2 pilot implementation (Java, Xtext/EMF) |
| Extension host | VS Code Extension API |
| Testing | Vitest |
