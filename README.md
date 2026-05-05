# SysML v2 Visualizer

A browser-based live editor and visualizer for a subset of SysML v2 syntax. Edit a model in the left pane and see structure diagrams, sequence diagrams, and an interactive model explorer update in real time.

## Features

- **Live parser** — regex-based SysML v2 parser with semantic diagnostics (unknown interface types, unknown ports, unknown part instances)
- **Monaco editor** — syntax highlighting, squiggle markers, click-to-navigate diagnostics
- **Structure View** — React Flow canvas showing interface defs, part type library, composed system parts with connection edges, and scenarios
- **Sequence View** — SVG sequence diagram for any `occurrence def` scenario
- **Model Explorer** — collapsible tree of all model elements (interfaces, part types, system parts, scenarios)
- **Inspector Panel** — contextual details for whatever is selected: ports, instances, connections, messages
- **Global selection** — clicking any node, edge, lifeline, or explorer item highlights the element across all views simultaneously

## Supported syntax

```sysml
package MySystem;

// Interface definitions
interface def DataSignal;

// Part definitions with ports
part def Sensor {
  port out reading : DataSignal;
}

part def Controller {
  port in reading : DataSignal;
}

// Composed system with connections
part def System {
  part s : Sensor;
  part c : Controller;

  connect s.reading to c.reading;
}

// Behavioral scenarios
occurrence def NormalOp {
  message data from Sensor to Controller;
}
```

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The editor loads a Brake-by-Wire demo model — edit it freely and watch the views update live.

## Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`)
- [React Flow](https://reactflow.dev/) (`@xyflow/react`)
