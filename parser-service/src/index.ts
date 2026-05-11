/**
 * SysML v2 Parser Service — wrapper
 *
 * Forwards parse requests to the official SysML v2 backend when
 * OFFICIAL_SYSML_BACKEND_URL is set; otherwise returns a "not connected" stub.
 *
 * See README.md for setup and docs/OFFICIAL_BACKEND_OPTIONS.md for backend options.
 */

import express, { Request, Response, NextFunction } from 'express';
import { createOfficialBackendClient } from './officialBackendClient';
import { buildGraph } from './graphBuilder';
import { buildBehavior } from './behaviorBuilder';

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

app.use(express.json());

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

  const result = await backendClient.parse(body.text);

  // Build and embed the containment graph (including connection edges) so
  // callers can read graph.edges without running the frontend adapter.
  if (result.model) {
    result.graph    = buildGraph(result.model);
    result.behavior = buildBehavior(result.model);
  } else {
    if (!result.graph)    result.graph    = { nodes: [], edges: [] };
    if (!result.behavior) result.behavior = { actions: [], flows: [], conditionals: [] };
  }

  res.json(result);
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[sysml-v2-parser-service] Listening on http://localhost:${PORT}`);
});
