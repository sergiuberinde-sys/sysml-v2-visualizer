/**
 * SysML v2 adapter interface and placeholder implementation.
 *
 * The SysMLV2Adapter interface is the single integration point between the
 * visualizer and any conformant SysML v2 / KerML parser backend.  Swapping
 * the backend later requires only a new class that implements this interface —
 * no view code, no App.tsx, no model types need to change.
 *
 * Current implementation
 * ──────────────────────
 * OfficialSysMLV2AdapterPlaceholder is the only implementation.
 * It always returns success:false.  It exists so that:
 *   - The interface can be type-checked and imported by future code.
 *   - Tests can assert that the placeholder behaves as documented.
 *   - The architectural boundary is visible in the codebase before the real
 *     implementation begins.
 *
 * Adding a real implementation (Option A example)
 * ────────────────────────────────────────────────
 *   export class PilotLspServerAdapter implements SysMLV2Adapter {
 *     readonly name = 'pilotLspServer';
 *
 *     async parse(text: string): Promise<SysMLV2ImportResult> {
 *       const jsonLd = await this.callLspServer(text);  // custom LSP command
 *       const vizModel = officialSysMLAdapter.convert(jsonLd);
 *       return { success: true, diagnostics: [], visualizerModel: vizModel, rawModel: jsonLd };
 *     }
 *
 *     private async callLspServer(_text: string): Promise<unknown> {
 *       // invoke sysml/getSemanticModel via vscode.commands.executeCommand
 *       throw new Error('not implemented');
 *     }
 *   }
 *
 * See docs/OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md for all backend options.
 */

import type { SysMLV2ImportResult } from './sysmlV2ImportResult';
import type { SysMLV2AdapterKind } from './sysmlV2Types';

// ── Adapter interface ─────────────────────────────────────────────────────────

/**
 * Contract that every official SysML v2 parser backend must satisfy.
 *
 * Implementations are expected to be stateless with respect to individual
 * parse calls.  Stateful resources (JVM process, HTTP connection, WASM module)
 * should be managed separately and injected via the constructor.
 */
export interface SysMLV2Adapter {
  /** Identifies this adapter in logs, badges, and test output. */
  readonly name: SysMLV2AdapterKind;

  /**
   * Parse SysML v2 / KerML source text and return a VisualizerModel.
   *
   * @param text - The full source text of a `.sysml` file.
   * @returns A promise that resolves to an import result.
   *          Must never reject; surface errors via `success: false` and
   *          `diagnostics` instead so callers need no try/catch.
   */
  parse(text: string): Promise<SysMLV2ImportResult>;
}

// ── Placeholder implementation ────────────────────────────────────────────────

/**
 * No-op adapter used until a real backend is integrated.
 *
 * Always returns `success: false` with a clear human-readable reason.
 * Safe to instantiate and call — it never throws, never makes network
 * requests, never spawns processes.
 */
export class OfficialSysMLV2AdapterPlaceholder implements SysMLV2Adapter {
  readonly name: SysMLV2AdapterKind = 'placeholder';

  async parse(_text: string): Promise<SysMLV2ImportResult> {
    return {
      success: false,
      diagnostics: [],
      unsupportedReason:
        'Official SysML v2 parser integration not implemented yet. ' +
        'See docs/OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md for the roadmap.',
    };
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

/**
 * The active SysML v2 adapter.
 *
 * Replace this export with a real implementation when integration begins:
 *
 *   export const activeSysMLV2Adapter: SysMLV2Adapter = new PilotLspServerAdapter();
 */
export const activeSysMLV2Adapter: SysMLV2Adapter = new OfficialSysMLV2AdapterPlaceholder();
