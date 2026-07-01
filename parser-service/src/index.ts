/**
 * SysML v2 Parser Service — wrapper
 *
 * Forwards parse requests to the official SysML v2 backend when
 * OFFICIAL_SYSML_BACKEND_URL is set; otherwise returns a "not connected" stub.
 *
 * See README.md for setup and docs/OFFICIAL_BACKEND_OPTIONS.md for backend options.
 */

import express, { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { createOfficialBackendClient } from './officialBackendClient';
import { buildGraphWithContext } from './graphBuilder';
import { buildBehavior } from './behaviorBuilder';
import type { SysMLV2ParseResult } from './types';

// ── Parse result cache ────────────────────────────────────────────────────────
// Key = sha256 of (primary text + sorted context texts). Avoids redundant JVM
// invocations when the user switches between already-seen files or the extension
// triggers a re-parse for a file that hasn't actually changed.

const CACHE_TTL_MS  = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX     = 10;

interface CacheEntry { result: SysMLV2ParseResult; ts: number }
const parseCache = new Map<string, CacheEntry>();

function makeCacheKey(text: string, context: { name: string; text: string }[]): string {
  const h = createHash('sha256');
  h.update(text);
  for (const c of [...context].sort((a, b) => a.name.localeCompare(b.name))) {
    h.update('\x00' + c.name + '\x00' + c.text);
  }
  return h.digest('hex');
}

function cacheGet(key: string): SysMLV2ParseResult | null {
  const entry = parseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { parseCache.delete(key); return null; }
  return entry.result;
}

function cacheSet(key: string, result: SysMLV2ParseResult): void {
  if (parseCache.size >= CACHE_MAX) {
    // Evict the oldest entry
    let oldestKey = '';
    let oldestTs  = Infinity;
    for (const [k, v] of parseCache) {
      if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; }
    }
    if (oldestKey) parseCache.delete(oldestKey);
  }
  parseCache.set(key, { result, ts: Date.now() });
}

const app = express();
const PORT = parseInt(process.env['PARSER_SERVICE_PORT'] ?? process.env['PORT'] ?? '9001', 10);

const backendClient = createOfficialBackendClient();

// ── CORS ──────────────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

app.options('*', (_req: Request, res: Response): void => {
  res.sendStatus(204);
});

app.use(express.json({ limit: '50mb' }));

// ── GET /health ───────────────────────────────────────────────────────────────

app.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const officialParserConnected = await backendClient.health();
  res.json({
    status: 'ok',
    service: 'sysml-v2-parser-wrapper',
    officialParserConnected,
  });
});

// ── POST /parse ───────────────────────────────────────────────────────────────

interface ParseRequest {
  text?: unknown;
  context?: unknown;
}

app.post('/parse', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as ParseRequest;

  if (typeof body.text !== 'string') {
    res.status(400).json({
      success: false,
      diagnostics: [],
      error: 'Request body must be { "text": "<sysml source>" }',
    });
    return;
  }

  const rawContext = Array.isArray(body.context) ? body.context as { name: string; text: string }[] : [];
  const context = rawContext.filter(
    (f): f is { name: string; text: string } =>
      typeof f === 'object' && f !== null &&
      typeof (f as Record<string, unknown>).name === 'string' &&
      typeof (f as Record<string, unknown>).text === 'string'
  );

  const cacheKey = makeCacheKey(body.text, context);
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log('[sysml-v2-parser-service] Cache hit — returning cached result');
    res.json(cached);
    return;
  }

  const result = await backendClient.parse(body.text, context);

  // Build and embed the containment graph (including connection edges) so
  // callers can read graph.edges without running the frontend adapter.
  if (result.model) {
    result.graph    = buildGraphWithContext(result.model, result.contextModels ?? []);
    result.behavior = buildBehavior(result.model, result.contextModels ?? []);
  } else {
    if (!result.graph)    result.graph    = { nodes: [], edges: [] };
    if (!result.behavior) result.behavior = { actions: [], flows: [], conditionals: [] };
  }

  cacheSet(cacheKey, result);
  res.json(result);
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[sysml-v2-parser-service] Listening on http://localhost:${PORT}`);
});
