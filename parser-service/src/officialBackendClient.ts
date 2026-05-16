import { existsSync } from 'fs';
import { JavaWrapperClient, resolveJarPath } from './javaWrapperClient';
import type { SysMLV2ParseResult } from './types';

export interface OfficialBackendClient {
  health(): Promise<boolean>;
  parse(text: string, context?: { name: string; text: string }[]): Promise<SysMLV2ParseResult>;
}

// ── Not-connected placeholder ─────────────────────────────────────────────────

export class OfficialBackendClientNotConnected implements OfficialBackendClient {
  async health(): Promise<boolean> {
    return false;
  }

  async parse(_text: string, _context?: { name: string; text: string }[]): Promise<SysMLV2ParseResult> {
    return {
      success: false,
      diagnostics: [
        {
          message: 'Official backend not connected.',
          severity: 'info',
          line: 1,
          column: 1,
        },
      ],
      error: 'Official backend not connected',
    };
  }
}

// ── HTTP client (used when OFFICIAL_SYSML_BACKEND_URL is set) ─────────────────

interface HttpClientConfig {
  baseUrl: string;
  healthPath: string;
  parsePath: string;
}

export class HttpOfficialBackendClient implements OfficialBackendClient {
  private readonly config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, ''),
    };
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}${this.config.healthPath}`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async parse(text: string, context?: { name: string; text: string }[]): Promise<SysMLV2ParseResult> {
    const url = `${this.config.baseUrl}${this.config.parsePath}`;

    let raw: unknown;
    let res: Response;

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, ...(context?.length ? { context } : {}) }),
      });
      raw = await res.json();
    } catch {
      return {
        success: false,
        diagnostics: [
          {
            message:
              'Official backend reachable status: false. Endpoint mapping not configured or backend unavailable.',
            severity: 'error',
          },
        ],
        error: 'BACKEND_UNREACHABLE',
      };
    }

    if (!res.ok) {
      return {
        success: false,
        diagnostics: [
          {
            message: `Official backend reachable status: false. Endpoint mapping not configured or backend unavailable. (HTTP ${res.status})`,
            severity: 'error',
          },
        ],
        rawResponse: raw,
        error: `HTTP ${res.status}`,
      };
    }

    if (typeof raw !== 'object' || raw === null || !('success' in raw)) {
      return {
        success: false,
        diagnostics: [
          {
            message: 'Backend returned an unexpected response shape.',
            severity: 'error',
          },
        ],
        rawResponse: raw,
        error: 'Unexpected response shape',
      };
    }

    return raw as SysMLV2ParseResult;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────
//
// Priority order:
//   1. SYSML_PARSER_JAR set explicitly → Java wrapper at that path
//   2. Default JAR exists at ../../java-parser-wrapper/target/ → Java wrapper (auto-detect)
//   3. OFFICIAL_SYSML_BACKEND_URL set → HTTP client (legacy / API-Services path)
//   4. None → NotConnected stub

export function createOfficialBackendClient(): OfficialBackendClient {
  const jarPath = resolveJarPath();

  if (process.env['SYSML_PARSER_JAR']) {
    console.log(`[sysml-v2-parser-service] Java wrapper mode (SYSML_PARSER_JAR): ${jarPath}`);
    return new JavaWrapperClient(jarPath);
  }

  if (existsSync(jarPath)) {
    console.log(`[sysml-v2-parser-service] Java wrapper mode (auto-detected JAR): ${jarPath}`);
    return new JavaWrapperClient(jarPath);
  }

  const backendUrl = process.env['OFFICIAL_SYSML_BACKEND_URL'];

  if (backendUrl) {
    const healthPath = process.env['OFFICIAL_SYSML_HEALTH_PATH'] ?? '/health';
    const parsePath  = process.env['OFFICIAL_SYSML_PARSE_PATH']  ?? '/parse';
    console.log(`[sysml-v2-parser-service] HTTP backend mode: ${backendUrl}`);
    console.log(`[sysml-v2-parser-service] Health path: ${healthPath}`);
    console.log(`[sysml-v2-parser-service] Parse path:  ${parsePath}`);
    return new HttpOfficialBackendClient({ baseUrl: backendUrl, healthPath, parsePath });
  }

  console.log('[sysml-v2-parser-service] No parser configured.');
  console.log('[sysml-v2-parser-service]   Java wrapper: build java-parser-wrapper/ then restart');
  console.log('[sysml-v2-parser-service]   HTTP backend:  set OFFICIAL_SYSML_BACKEND_URL');
  return new OfficialBackendClientNotConnected();
}
