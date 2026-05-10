# `src/core/sysmlv2/` — Official SysML v2 Integration Spike

This folder is the integration boundary between the visualizer and any
conformant SysML v2 / KerML parser backend.

---

## Current mode: `legacySubset` (working)

The visualizer currently parses a **custom prototype language** — not
conformant SysML v2.  The legacy parser is in `src/core/parser/astParser.ts`
and is **frozen**: no new grammar rules or node kinds will be added there.

All views consume a `VisualizerModel` (from `src/core/visualizerModel/`) that
the `legacySubsetAdapter` produces from the frozen parser's output.

```
source text
  ──► astParser.ts            (FROZEN — legacySubset grammar)
  ──► modelBuilder.ts
  ──► legacySubsetAdapter.ts
  ──► VisualizerModel         ◄── all views read from here
```

---

## Future mode: `sysmlV2OfficialFuture` (not yet implemented)

When a conformant backend is available, the data flow becomes:

```
source text
  ──► SysMLV2Adapter.parse()  ◄── this folder
        │  (Option A: Pilot Implementation LSP server)
        │  (Option B: SysML v2 REST API service)
        │  (Option C1: ANTLR4 TypeScript parser)
        │  (Option C2: tree-sitter WASM grammar)
        ▼
  SysMLV2ImportResult
        │
        ▼ .visualizerModel
  VisualizerModel             ◄── same views, unchanged
```

The adapter boundary means **zero changes to any view** when the parser is
replaced.  Only `activeSysMLV2Adapter` in `sysmlV2Adapter.ts` needs to
point to a real implementation.

---

## Files in this folder

| File | Purpose |
|------|---------|
| `sysmlV2Types.ts` | Shared primitive types: `SysMLV2Diagnostic`, `SysMLV2AdapterKind` |
| `sysmlV2ImportResult.ts` | `SysMLV2ImportResult` — what every adapter returns |
| `sysmlV2Adapter.ts` | `SysMLV2Adapter` interface + `OfficialSysMLV2AdapterPlaceholder` + `activeSysMLV2Adapter` singleton |
| `README.md` | This file |

---

## Integration options

See `docs/OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md` for a full comparison of
all four backend options (effort, licensing, architecture, complexity).

See `docs/FULL_SYSML_V2_ROADMAP.md` for the phased delivery plan.

---

## How to add a real adapter (quick guide)

1. Create a new class that implements `SysMLV2Adapter`:

   ```typescript
   // src/core/sysmlv2/pilotLspServerAdapter.ts
   import type { SysMLV2Adapter, SysMLV2ImportResult } from './sysmlV2Adapter';

   export class PilotLspServerAdapter implements SysMLV2Adapter {
     readonly name = 'pilotLspServer' as const;

     async parse(text: string): Promise<SysMLV2ImportResult> {
       // 1. Send text to the LSP server via a custom command.
       // 2. Receive JSON-LD; pass to officialSysMLAdapter.convert().
       // 3. Return { success: true, visualizerModel: ... }.
     }
   }
   ```

2. Replace the singleton in `sysmlV2Adapter.ts`:

   ```typescript
   export const activeSysMLV2Adapter: SysMLV2Adapter = new PilotLspServerAdapter();
   ```

3. In `src/App.tsx`, route to `activeSysMLV2Adapter.parse(source)` when
   `PARSER_MODE === 'sysmlV2OfficialFuture'`.

4. Update `src/core/parserMode.ts` to set `PARSER_MODE = 'sysmlV2OfficialFuture'`.

No view files change.  No model type files change.

---

## Testing the placeholder

The placeholder can be tested without any external dependencies:

```typescript
import { activeSysMLV2Adapter } from './sysmlV2Adapter';

const result = await activeSysMLV2Adapter.parse('part def Foo;');
// result.success          → false
// result.diagnostics      → []
// result.visualizerModel  → undefined
// result.unsupportedReason → 'Official SysML v2 parser integration not implemented yet. ...'
```
