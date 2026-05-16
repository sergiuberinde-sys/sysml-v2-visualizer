/**
 * Configurable endpoint map for official SysML v2 backend integrations.
 *
 * When the real backend is running, inspect its API routes and update the
 * relevant entry here.  The `HttpOfficialBackendClient` reads from this map
 * so endpoint changes require touching only this file.
 */

export interface BackendEndpoints {
  /** Liveness / readiness probe. Must return HTTP 200 when healthy. */
  health: string;
  /** Accepts { text: string } and returns a parse result. */
  parse: string;
}

/**
 * Pilot Implementation (https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation)
 *
 * The Pilot REST service exposes a Xtext-based HTTP API.  Endpoint paths
 * below are placeholders — update once you have the service running locally
 * and can inspect its Swagger UI (typically at /swagger-ui.html).
 */
export const PILOT_IMPLEMENTATION_ENDPOINTS: BackendEndpoints = {
  health: '/health',
  parse: '/parse',
};

/**
 * SysML v2 REST API (hosted / cloud instance).
 *
 * Same placeholder paths as the Pilot Implementation.  Override these once
 * you have access to a live instance.
 */
export const REST_API_ENDPOINTS: BackendEndpoints = {
  health: '/health',
  parse: '/parse',
};

/**
 * Returns the endpoint map to use for the given backend URL.
 *
 * Currently all known backends share the same path conventions, so this
 * always returns the Pilot Implementation endpoints.  Add URL-pattern
 * matching here if different hosted instances need different paths.
 */
export function endpointsForUrl(_backendUrl: string): BackendEndpoints {
  return PILOT_IMPLEMENTATION_ENDPOINTS;
}
