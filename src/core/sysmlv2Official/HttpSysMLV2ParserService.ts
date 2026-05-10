import type { SysMLV2ParserService } from './SysMLV2ParserService';
import type { SysMLV2ParseResult, BehaviorData } from './SysMLV2ParseResult';
import type { ModelNode } from './ModelNode';
import { buildContainmentGraph } from '../adapters/officialSysMLAdapter';

/**
 * HTTP-based implementation of SysMLV2ParserService.
 *
 * POSTs the source text to a running SysML v2 parser HTTP service and
 * normalises the response into SysMLV2ParseResult.  All error conditions
 * (network failure, non-200 status, invalid JSON) are caught and returned
 * as structured results — this method never rejects.
 *
 * Expected request:
 *   POST {endpoint}/parse
 *   Content-Type: application/json
 *   Body: { "text": "<sysml source>" }
 *
 * Expected response (200):
 *   Content-Type: application/json
 *   Body: SysMLV2ParseResult JSON
 *
 * Compatible backends:
 *   - Any HTTP wrapper around the official SysML v2 Pilot Implementation
 *   - The SysML v2 REST API service (Option B in OFFICIAL_SYSML_V2_INTEGRATION_PLAN.md)
 */
export class HttpSysMLV2ParserService implements SysMLV2ParserService {
  private readonly endpoint: string;

  constructor(endpoint: string) {
    // Strip trailing slash for consistent URL construction
    this.endpoint = endpoint.replace(/\/+$/, '');
  }

  async parse(text: string): Promise<SysMLV2ParseResult> {
    let rawResponse: unknown;

    try {
      const response = await fetch(`${this.endpoint}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return {
          success: false,
          diagnostics: [],
          error: `Invalid JSON response from parser service (HTTP ${response.status})`,
        };
      }

      rawResponse = body;

      if (!response.ok) {
        const msg = typeof (body as Record<string, unknown>)?.['error'] === 'string'
          ? (body as Record<string, unknown>)['error'] as string
          : `HTTP ${response.status}: ${response.statusText}`;
        return {
          success: false,
          diagnostics: [],
          error: msg,
          rawResponse,
        };
      }

      // Validate response shape
      const result = body as Partial<SysMLV2ParseResult>;
      if (typeof result.success !== 'boolean') {
        return {
          success: false,
          diagnostics: [],
          error: 'Unexpected response shape from parser service (missing "success" field)',
          rawResponse,
        };
      }

      const rawBody = body as Record<string, unknown>;
      const model: ModelNode[] | undefined =
        Array.isArray(rawBody['model']) ? rawBody['model'] as ModelNode[] : undefined;

      // Prefer the server-built graph (parser-service embeds it since graphBuilder was added).
      // Fall back to client-side buildContainmentGraph when the server doesn't include one.
      const serverGraph = rawBody['graph'] != null &&
        typeof rawBody['graph'] === 'object' &&
        Array.isArray((rawBody['graph'] as Record<string, unknown>)['edges'])
          ? rawBody['graph'] as SysMLV2ParseResult['graph']
          : undefined;
      const graph = serverGraph ?? (model ? buildContainmentGraph(model) : undefined);

      // Extract behavior data emitted by parser-service/src/behaviorBuilder.ts.
      const rawBehavior = rawBody['behavior'];
      const behavior: BehaviorData | undefined =
        rawBehavior != null &&
        typeof rawBehavior === 'object' &&
        Array.isArray((rawBehavior as Record<string, unknown>)['actions'])
          ? rawBehavior as BehaviorData
          : undefined;

      console.log('[HttpSysMLV2ParserService] parser response behavior:', behavior);

      return {
        success:     result.success,
        diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics : [],
        model,
        graph,
        behavior,
        rawResponse,
        error:       result.error,
      };

    } catch (err) {
      // Network failure, DNS resolution failure, CORS, etc.
      return {
        success: false,
        diagnostics: [],
        error: 'SERVICE_UNAVAILABLE',
        rawResponse,
      };
    }
  }
}
