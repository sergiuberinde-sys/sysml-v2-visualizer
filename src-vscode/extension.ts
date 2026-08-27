import * as vscode from 'vscode';
import * as fs from 'fs';
import { promises as fsAsync } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { JavaWrapperClient } from '../parser-service/src/javaWrapperClient';
import { buildGraphWithContext, type ContainmentGraph } from '../parser-service/src/graphBuilder';
import { buildBehavior } from '../parser-service/src/behaviorBuilder';
import { validateModel } from '../parser-service/src/validator';
import type { SysMLV2ParseResult, SourceOccurrence } from '../parser-service/src/types';
import { ensureJava } from './javaInstaller';

// ── In-memory parse cache ─────────────────────────────────────────────────────
// Fast same-session cache. Keyed by SHA-256(GRAPH_VERSION + primary text + sorted context texts).
// Bump GRAPH_VERSION whenever buildGraph or buildBehavior changes so stale disk entries are evicted.
const GRAPH_VERSION      = 'g58';
const PARSE_CACHE_TTL_MS = 5 * 60 * 1000;
const PARSE_CACHE_MAX    = 20;
interface ParseCacheEntry { result: SysMLV2ParseResult; ts: number }
const parseCache = new Map<string, ParseCacheEntry>();

function parseCacheKey(text: string, context: { name: string; text: string }[]): string {
  const h = createHash('sha256');
  h.update(GRAPH_VERSION);
  h.update(text);
  for (const c of [...context].sort((a, b) => a.name.localeCompare(b.name))) {
    h.update('\x00' + c.name + '\x00' + c.text);
  }
  return h.digest('hex');
}

function parseCacheGet(key: string): SysMLV2ParseResult | null {
  const e = parseCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > PARSE_CACHE_TTL_MS) { parseCache.delete(key); return null; }
  return e.result;
}

function parseCacheSet(key: string, result: SysMLV2ParseResult): void {
  // Never cache a failed parse (no model/graph, e.g. the JVM couldn't start). Otherwise
  // a transient failure gets replayed on every reopen even after the cause is fixed.
  if (!result.model && !result.graph) return;
  if (parseCache.size >= PARSE_CACHE_MAX) {
    let oldestKey = ''; let oldestTs = Infinity;
    for (const [k, v] of parseCache) { if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; } }
    if (oldestKey) parseCache.delete(oldestKey);
  }
  parseCache.set(key, { result, ts: Date.now() });
}

// ── Persistent on-disk cache ──────────────────────────────────────────────────
// Survives VS Code restarts. Same content hash → instant load, no JVM call.
// Stored in context.globalStorageUri (set during activate).
const DISK_CACHE_MAX = 50;
let diskCacheDir: string | null = null;

async function diskCacheGet(key: string): Promise<SysMLV2ParseResult | null> {
  if (!diskCacheDir) return null;
  try {
    const text = await fsAsync.readFile(path.join(diskCacheDir, `${key}.json`), 'utf8');
    return JSON.parse(text) as SysMLV2ParseResult;
  } catch {
    return null;
  }
}

async function diskCacheSet(key: string, result: SysMLV2ParseResult): Promise<void> {
  if (!diskCacheDir) return;
  // Never persist a failed parse (see parseCacheSet) — a poisoned entry would survive
  // restarts and keep replaying the failure after the real cause is resolved.
  if (!result.model && !result.graph) return;
  try {
    await fsAsync.mkdir(diskCacheDir, { recursive: true });
    await fsAsync.writeFile(path.join(diskCacheDir, `${key}.json`), JSON.stringify(result), 'utf8');
    // Evict oldest entries when over limit
    const names = (await fsAsync.readdir(diskCacheDir)).filter(f => f.endsWith('.json'));
    if (names.length > DISK_CACHE_MAX) {
      const stats = await Promise.all(
        names.map(async f => ({ name: f, mtime: (await fsAsync.stat(path.join(diskCacheDir!, f))).mtimeMs }))
      );
      stats.sort((a, b) => a.mtime - b.mtime);
      while (stats.length > DISK_CACHE_MAX) {
        const oldest = stats.shift()!;
        try { await fsAsync.unlink(path.join(diskCacheDir, oldest.name)); } catch { /* ignore */ }
      }
    }
  } catch (e) {
    console.warn('[sysml-visualizer] disk cache write failed:', e);
  }
}
import { formatSysML } from '../src/core/language/formatter';
import { scanRawAnnotations, extractSatisfiesTraces } from '../src/core/trlc/extractTraces';
import { parseTrlcFile } from '../src/core/trlc/parseTrlcFile';
import { extractDependencyMappingsFromSources } from '../src/core/sysmlv2Official/messageInterfaceAsil';
import { extractSequenceTiming } from '../src/core/sysmlv2Official/sequenceTiming';


export async function activate(context: vscode.ExtensionContext): Promise<void> {
  let currentSysmlUri: vscode.Uri | undefined;
  let currentSysmlText: string | undefined;

  // The currently open visualizer panel, if any.
  // Captured by publishDiagnosticsOfficial via closure so it can post graph data.
  let activePanel: vscode.WebviewPanel | undefined;

  // Index rebuilt on every official parse: graph-node path → 1-based source range.
  // Populated by publishDiagnosticsOfficial; read by the revealSemanticElement handler.
  type NodeRange = { startLine: number; endLine: number };
  let nodeIdToRange = new Map<string, NodeRange>();

  diskCacheDir = context.globalStorageUri.fsPath;

  const diagnosticCollection          = vscode.languages.createDiagnosticCollection('sysml-v2');
  const validatorDiagCollection       = vscode.languages.createDiagnosticCollection('sysml-v2-checker');
  context.subscriptions.push(diagnosticCollection, validatorDiagCollection);

  // On-demand visualization: when auto-refresh is OFF, a `.sysml` edit (or opening a
  // file) marks the diagram stale (a red marker in the webview) instead of triggering
  // the slow full re-parse; the user clicks "Visualize" to refresh. Default: OFF
  // (manual) — best for large multi-file projects where a full parse is slow.
  let autoRefresh = false;
  // Staleness is a real content diff, not just "an edit happened": snapshot the content
  // that was last visualized (primary + context, keyed by URI) and compare hashes — so
  // editing then reverting to the visualized content turns the marker green again.
  let visualizedPrimaryUri: string | null = null;
  const visualizedHashes = new Map<string, string>(); // uri → content hash at last visualize
  const dirtyFiles = new Set<string>();               // uris whose content now differs
  const contentHash = (text: string): string => createHash('sha256').update(text).digest('hex');
  // Stale when the active file isn't the one currently visualized, or any file differs.
  const isStale = (): boolean =>
    (currentSysmlUri?.toString() ?? null) !== visualizedPrimaryUri || dirtyFiles.size > 0;
  const postStaleMarker = (): void => {
    void activePanel?.webview.postMessage({ type: 'staleState', stale: isStale() });
  };
  const snapshotVisualized = (primaryUri: string, primaryText: string, ctx: { uri: string; text: string }[]): void => {
    visualizedPrimaryUri = primaryUri;
    visualizedHashes.clear();
    visualizedHashes.set(primaryUri, contentHash(primaryText));
    for (const c of ctx) visualizedHashes.set(c.uri, contentHash(c.text));
    dirtyFiles.clear();
    postStaleMarker();
  };

  // Most-recently built graph + owning document — used by on-demand validation.
  let lastGraph:    ContainmentGraph | null          = null;
  let lastDocument: vscode.TextDocument | null       = null;
  // Summary of the parse that produced lastGraph — lets the on-demand validator warn
  // when it ran over a partial model (the parse itself had errors).
  let lastParse:    { success: boolean; errorCount: number } | null = null;

  // ── Java runtime — resolve automatically, out of the box ─────────────────────
  // Order: (0) the `sysmlVisualizer.javaHome` setting — a user-level escape hatch
  // needing no admin rights and no OS environment variable; then (1) an optional
  // JRE bundled inside the extension (usually NOT shipped — keeps the VSIX small);
  // then (2) ensureJava, which reuses a previously-downloaded copy / a system JDK,
  // or downloads Temurin and sets SYSML_JAVA_HOME. Either way the parser client
  // (resolveJavaExe) reads SYSML_JAVA_HOME first, so no manual setup is needed.
  const cfgJavaHome = (vscode.workspace.getConfiguration('sysmlVisualizer').get<string>('javaHome') ?? '').trim();
  if (cfgJavaHome) {
    const exe = process.platform === 'win32' ? 'java.exe' : 'java';
    if (fs.existsSync(path.join(cfgJavaHome, 'bin', exe))) {
      process.env['SYSML_JAVA_HOME'] = cfgJavaHome;
      console.log(`[sysml-visualizer] Using Java from setting sysmlVisualizer.javaHome: ${cfgJavaHome}`);
    } else {
      console.warn(`[sysml-visualizer] sysmlVisualizer.javaHome is set to "${cfgJavaHome}" but no ${exe} was found under its bin/ — ignoring.`);
    }
  }

  const bundledJreHome = path.join(context.extensionUri.fsPath, 'jre', `${process.platform}-${process.arch}`);
  const bundledJavaExe = path.join(bundledJreHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  if (!process.env['SYSML_JAVA_HOME']) {
    const bundledExists = fs.existsSync(bundledJavaExe);
    console.log(`[sysml-visualizer] Bundled JRE check: ${bundledJavaExe} → exists=${bundledExists}`);
    if (bundledExists) {
      process.env['SYSML_JAVA_HOME'] = bundledJreHome;
      console.log(`[sysml-visualizer] Using bundled JRE.`);
    }
  }

  // Runs before JavaWrapperClient is created so SYSML_JAVA_HOME is set first.
  const javaJustInstalled = await ensureJava(context.globalStorageUri.fsPath);

  // Diagnostic: make the resolved Java visible in the Dev Tools console so a
  // "spawn java.exe ENOENT" is immediately explainable (unset = no Java was found
  // and the download did not succeed).
  console.log(
    `[sysml-visualizer] Java resolved: SYSML_JAVA_HOME=${process.env['SYSML_JAVA_HOME'] ?? '(unset)'} · ` +
    `JAVA_HOME=${process.env['JAVA_HOME'] ?? '(unset)'} · downloadedThisRun=${javaJustInstalled}`,
  );

  // ── Direct Java parser client (no HTTP) ──────────────────────────────────────
  // Paths resolved from the extension installation directory so they work
  // both during development and in the packaged VSIX.
  const extRoot   = context.extensionUri.fsPath;
  const jarPath   = path.join(extRoot, 'java-parser-wrapper', 'target', 'sysml-parse-cli.jar');
  const stdlibDir = path.join(extRoot, 'parser-service', 'sysml-stdlib');
  if (fs.existsSync(stdlibDir) && !process.env['SYSML_STDLIB_PATH']) {
    process.env['SYSML_STDLIB_PATH'] = stdlibDir;
  }
  const javaClient = new JavaWrapperClient(jarPath);

  // After a fresh Java install the JVM stdlib load can take 30–90 s on Windows.
  // Show a progress notification so the user knows the parser is starting up.
  if (javaJustInstalled) {
    void vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title:    'SysML v2 Visualizer: Starting parser (one-time initialisation, ~30–90 s)…',
        cancellable: false,
      },
      () => javaClient.waitForReady().catch(() => { /* startup errors are reported separately */ }),
    );
  }

  // ── Diagnostic helpers ────────────────────────────────────────────────────────

  function toVsCodeRange(
    document: vscode.TextDocument,
    line?: number,
    column?: number,
  ): vscode.Range {
    const lineIndex = Math.min(Math.max((line ?? 1) - 1, 0), document.lineCount - 1);
    const textLine  = document.lineAt(lineIndex);
    const startCol  = Math.min(Math.max((column ?? 1) - 1, 0), textLine.text.length);
    const endCol    = textLine.text.length > 0 ? Math.max(startCol + 1, textLine.text.length) : 0;
    return new vscode.Range(lineIndex, startCol, lineIndex, endCol);
  }

  function mapSeverity(d: { severity: string }): vscode.DiagnosticSeverity {
    return d.severity === 'error'   ? vscode.DiagnosticSeverity.Error   :
           d.severity === 'warning' ? vscode.DiagnosticSeverity.Warning :
                                      vscode.DiagnosticSeverity.Information;
  }

  const pendingDiagnosticTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function publishDiagnosticsForDocument(document: vscode.TextDocument): void {
    if (!document.fileName.endsWith('.sysml')) return;
    const key = document.uri.toString();
    const existing = pendingDiagnosticTimers.get(key);
    if (existing) clearTimeout(existing);
    pendingDiagnosticTimers.set(key, setTimeout(() => {
      pendingDiagnosticTimers.delete(key);
      void publishDiagnosticsOfficial(document);
    }, 500));
  }

  // On-demand visualize: re-parse the tracked file NOW (no debounce) and refresh the
  // diagram. applyResult clears the stale marker on success.
  async function doVisualize(): Promise<void> {
    const target = currentSysmlUri;
    if (!target) return;
    try {
      const doc = await vscode.workspace.openTextDocument(target);
      await publishDiagnosticsOfficial(doc, /* forceFullContext */ true);
    } catch (err) {
      console.error('[sysml-visualizer] visualize failed:', err);
    }
  }

  // ── TRLC annotation scanner ───────────────────────────────────────────────────
  // Sends { type: 'trlcAnnotations' } to the webview independently of the parse
  // pipeline. Called on ready and on every editor switch so the trace view is
  // always populated even when the parser service is unavailable.

  async function sendTrlcAnnotations(): Promise<void> {
    if (!activePanel) return;
    const allSysml = await vscode.workspace.findFiles('**/*.sysml', '**/node_modules/**');
    const sources: { text: string }[] = [];
    if (currentSysmlText) sources.push({ text: currentSysmlText });
    await Promise.all(allSysml.map(async (u) => {
      if (currentSysmlUri && u.toString() === currentSysmlUri.toString()) return;
      try {
        const bytes = await vscode.workspace.fs.readFile(u);
        sources.push({ text: Buffer.from(bytes).toString('utf8') });
      } catch { /* skip */ }
    }));
    const trlcAnnotations = scanRawAnnotations(sources);
    console.log(`[sysml-visualizer] sendTrlcAnnotations: ${trlcAnnotations.length} annotations from ${sources.length} files`);
    void activePanel.webview.postMessage({ type: 'trlcAnnotations', trlcAnnotations });
  }

  // Auto-load every `.trlc` requirement file in the workspace and send the merged
  // requirement set to the webview (so traceability populates without a manual import).
  async function sendTrlcRequirements(): Promise<void> {
    if (!activePanel) return;
    const trlcFiles = await vscode.workspace.findFiles('**/*.trlc', '**/node_modules/**');
    const requirements: ReturnType<typeof parseTrlcFile>['requirements'] = [];
    const seen = new Set<string>();
    await Promise.all(trlcFiles.map(async (u) => {
      try {
        const text = Buffer.from(await vscode.workspace.fs.readFile(u)).toString('utf8');
        for (const r of parseTrlcFile(text).requirements) if (!seen.has(r.id)) { seen.add(r.id); requirements.push(r); }
      } catch { /* skip unreadable files */ }
    }));
    console.log(`[sysml-visualizer] sendTrlcRequirements: ${requirements.length} requirements from ${trlcFiles.length} .trlc file(s)`);
    void activePanel.webview.postMessage({ type: 'trlcRequirements', requirements });
  }

  /** True when the parse result contains unresolved cross-file reference errors. */
  function hasResolveErrors(result: SysMLV2ParseResult): boolean {
    return result.diagnostics.some(
      d => d.severity === 'error' && d.message.startsWith("Couldn't resolve reference to"),
    );
  }

  /**
   * True when the SysML source contains import statements.
   * A file with imports is cross-file by definition: even when the JVM parser
   * reports 0 diagnostics in Phase 1 (it silently accepts unresolved imports),
   * the model is incomplete without the imported namespaces.
   */
  function hasImports(text: string): boolean {
    return /(^|\n)\s*(?:private\s+)?import\b/.test(text);
  }

  /** Read all .sysml files in the workspace except primaryUri.
   *  Prefers the in-memory text of open documents so unsaved edits (including
   *  programmatic cross-file edits) are reflected in the parse. */
  async function collectContextFiles(primaryUri: vscode.Uri): Promise<{ name: string; text: string; uri: string }[]> {
    const allSysml = await vscode.workspace.findFiles('**/*.sysml', '**/node_modules/**');
    const openByUri = new Map(vscode.workspace.textDocuments.map(d => [d.uri.toString(), d]));
    const contextFiles: { name: string; text: string; uri: string }[] = [];
    await Promise.all(allSysml.map(async (u) => {
      if (u.toString() === primaryUri.toString()) return;
      const name = u.path.split('/').pop() ?? u.path;
      const openDoc = openByUri.get(u.toString());
      if (openDoc) { contextFiles.push({ name, text: openDoc.getText(), uri: u.toString() }); return; }
      try {
        const bytes = await vscode.workspace.fs.readFile(u);
        contextFiles.push({ name, text: Buffer.from(bytes).toString('utf8'), uri: u.toString() });
      } catch { /* skip unreadable files */ }
    }));
    return contextFiles;
  }

  /** Apply a parse result to VS Code squiggles and the webview. */
  function applyResult(document: vscode.TextDocument, result: SysMLV2ParseResult): void {
    if (result.graph) {
      lastGraph = result.graph; lastDocument = document;
      lastParse = { success: result.success, errorCount: result.diagnostics.filter(d => d.severity === 'error').length };
    }
    const diags = result.diagnostics.map(d => {
      const vd = new vscode.Diagnostic(toVsCodeRange(document, d.line, d.column), d.message, mapSeverity(d));
      vd.source = 'SysML v2 (official)';
      return vd;
    });
    diagnosticCollection.set(document.uri, diags);

    if (activePanel) {
      const graph    = result.graph    ?? { nodes: [], edges: [] };
      const behavior = result.behavior ?? null;
      // Message→interface-port dependencies for sequence-view ASIL derivation
      // (computed across all source files at parse time; see below).
      const dependencies = result.dependencies ?? [];
      const timing = result.timing ?? [];
      const satisfies = result.satisfies ?? [];
      void activePanel.webview.postMessage({
        type: 'updateGraph',
        graph,
        behavior,
        dependencies,
        timing,
        satisfies,
        success: result.success,
        diagnostics: result.diagnostics,
      });
      type GNode = { id: string; startLine?: number; endLine?: number };
      const gNodes = (graph as { nodes: GNode[] }).nodes;
      nodeIdToRange = new Map();
      for (const n of gNodes) {
        if (n.startLine != null && n.startLine > 0) {
          nodeIdToRange.set(n.id, { startLine: n.startLine, endLine: n.endLine ?? n.startLine });
        }
      }
      console.log(`[sysml-visualizer] updateGraph: ${gNodes.length} nodes, rangeIndex=${nodeIdToRange.size}`);
      // The stale marker is driven by snapshotVisualized() (called by the parse paths),
      // which records exactly what content this render reflects.
    }
  }

  async function publishDiagnosticsOfficial(document: vscode.TextDocument, forceFullContext = false): Promise<void> {
    const uri         = document.uri;
    const primaryText = document.getText();
    console.log(`[sysml-visualizer] START parse: ${path.basename(uri.fsPath)}`);

    // Best result available if a later phase throws — used to clear the webview's
    // parsing overlay even on failure.
    let phase1ForFallback: SysMLV2ParseResult | undefined;

    try {
      // ── Phase 1: primary-only parse (no context file reads) ──────────────────
      // Gives immediate feedback without touching the workspace filesystem.
      // Cache key uses an empty context list so it is stable regardless of what
      // other files exist in the workspace.
      const primaryOnlyKey = parseCacheKey(primaryText, []);

      let phase1 = parseCacheGet(primaryOnlyKey) ?? await diskCacheGet(primaryOnlyKey);
      const phase1FromCache = !!phase1;
      if (!phase1) {
        phase1 = await javaClient.parse(primaryText, []);
      } else if (!parseCacheGet(primaryOnlyKey)) {
        parseCacheSet(primaryOnlyKey, phase1); // promote disk hit to memory
      }

      if (phase1.model && !phase1.graph) {
        phase1.graph    = buildGraphWithContext(phase1.model, phase1.contextModels ?? []);
        phase1.behavior = buildBehavior(phase1.model, phase1.contextModels ?? []);
        // Primary-only (self-contained): a file's message dependencies reference its own ports.
        phase1.dependencies = extractDependencyMappingsFromSources([{ text: primaryText, model: phase1.model }]);
        phase1.timing = extractSequenceTiming([{ text: primaryText, model: phase1.model }]);
        phase1.satisfies = extractSatisfiesTraces([phase1.model]);
      }
      phase1ForFallback = phase1;

      // Decide whether a context (Phase 2) parse is needed. When it is, we do NOT
      // publish the primary-only result: the webview keeps its "parsing" overlay up
      // until the full result is ready, so the diagram never flashes a partial
      // (portless / wireless) render mid-parse. The JVM parser silently accepts
      // unresolved imports in Phase 1, so 0 diagnostics does not mean self-contained
      // when `import` statements are present.
      // On an explicit Visualize we ALWAYS do the full cross-file parse, so the shown
      // diagram is guaranteed fully resolved (port names via type defs, cross-file
      // references, interfaces) rather than a fast phase-1 approximation.
      const needsPhase2 = forceFullContext || hasResolveErrors(phase1) || hasImports(primaryText);
      if (!needsPhase2) {
        applyResult(document, phase1); // self-contained → this is the final result
        snapshotVisualized(uri.toString(), primaryText, []);
        if (!phase1FromCache) {
          parseCacheSet(primaryOnlyKey, phase1);
          void diskCacheSet(primaryOnlyKey, phase1);
        }
        console.log('[sysml-visualizer] parse done (phase 1, self-contained)');
        return;
      }

      // ── Phase 2: re-parse with context (file has cross-file references) ──────
      const contextFiles   = await collectContextFiles(uri);
      if (contextFiles.length === 0) {
        // No other workspace files — Phase 1 is the best we can do; publish it.
        applyResult(document, phase1);
        snapshotVisualized(uri.toString(), primaryText, []);
        if (!phase1FromCache) {
          parseCacheSet(primaryOnlyKey, phase1);
          void diskCacheSet(primaryOnlyKey, phase1);
        }
        console.log('[sysml-visualizer] parse done (phase 1, no context files available)');
        return;
      }
      const fullKey        = parseCacheKey(primaryText, contextFiles);

      let result = parseCacheGet(fullKey) ?? await diskCacheGet(fullKey);
      const fromCache = !!result;
      if (!result) {
        result = await javaClient.parse(primaryText, contextFiles);
      } else if (!parseCacheGet(fullKey)) {
        parseCacheSet(fullKey, result);
      }

      if (result.model && !result.graph) {
        result.graph    = buildGraphWithContext(result.model, result.contextModels ?? []);
        result.behavior = buildBehavior(result.model, result.contextModels ?? []);
        // Dependencies across ALL files (primary + context), so message ASIL resolves
        // for every file's sequences — not only the currently-active file's.
        const sources = [
          { text: primaryText, model: result.model },
          ...contextFiles.map((c, i) => ({ text: c.text, model: result.contextModels?.[i] })),
        ];
        result.dependencies = extractDependencyMappingsFromSources(sources);
        result.timing = extractSequenceTiming(sources);
        result.satisfies = extractSatisfiesTraces([result.model, ...(result.contextModels ?? [])]);
      }

      applyResult(document, result);
      snapshotVisualized(uri.toString(), primaryText, contextFiles);

      if (!fromCache) {
        parseCacheSet(fullKey, result);
        void diskCacheSet(fullKey, result);
      }
      console.log(`[sysml-visualizer] parse done (phase 2 with context, fromCache=${fromCache})`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[sysml-visualizer] parse ERROR:', msg);
      // Clear the webview's parsing overlay even on failure: publish the best result
      // we have (primary-only), or an empty graph if we never got that far.
      if (phase1ForFallback) {
        applyResult(document, phase1ForFallback);
        snapshotVisualized(uri.toString(), primaryText, []);
      } else if (activePanel) {
        void activePanel.webview.postMessage({
          type: 'updateGraph', graph: { nodes: [], edges: [] }, behavior: null,
          success: false, diagnostics: [],
        });
      }
      if (msg.includes('ENOENT') || msg.includes('spawn')) {
        void vscode.window.showErrorMessage(
          'SysML v2 Visualizer: no Java runtime could be started. The automatic ' +
          'Temurin download may be blocked by your network/firewall. Fix: install ' +
          'Java 17+ (e.g. Temurin 21 from https://adoptium.net) and fully restart ' +
          'VS Code, or set SYSML_JAVA_HOME to an existing JDK. See the Dev Tools ' +
          'console (Help → Toggle Developer Tools) for the resolved Java path.',
        );
      }
    }
  }

  // ── Activation-level listeners ────────────────────────────────────────────────

  // Diagnose any .sysml files already open when the extension activates.
  for (const doc of vscode.workspace.textDocuments) {
    publishDiagnosticsForDocument(doc);
  }

  context.subscriptions.push(
    // Re-publish whenever any .sysml document changes. Re-parse the file currently
    // being visualized (the primary): a change to a context file affects the
    // primary's cross-file resolution, and a change to the primary itself needs
    // re-parsing — either way, keep the view on the current primary rather than
    // switching it to whichever file was edited.
    vscode.workspace.onDidChangeTextDocument(e => {
      if (!e.document.fileName.endsWith('.sysml')) return;
      // Compare the edited file's content to what was last visualized: if it now matches
      // (e.g. the user typed then reverted), clear its dirty flag → green; otherwise mark
      // it → red. Marker = red while any file differs (or the active file isn't visualized).
      const u = e.document.uri.toString();
      const vh = visualizedHashes.get(u);
      if (vh !== undefined && contentHash(e.document.getText()) === vh) dirtyFiles.delete(u);
      else dirtyFiles.add(u);
      postStaleMarker();
      // Manual mode: do NOT trigger the (potentially slow) re-parse — the user clicks
      // "Visualize" when ready. Auto mode: re-parse as before.
      if (!autoRefresh) return;
      if (currentSysmlUri && currentSysmlUri.toString() !== e.document.uri.toString()) {
        void vscode.workspace.openTextDocument(currentSysmlUri).then(
          doc => publishDiagnosticsForDocument(doc),
          () => publishDiagnosticsForDocument(e.document),
        );
      } else {
        publishDiagnosticsForDocument(e.document);
      }
    }),

    // Diagnose newly opened .sysml files.
    vscode.workspace.onDidOpenTextDocument(doc => {
      publishDiagnosticsForDocument(doc);
    }),

    // Clear diagnostics only when the document is explicitly closed.
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.fileName.endsWith('.sysml')) {
        diagnosticCollection.delete(doc.uri);
        validatorDiagCollection.delete(doc.uri);
        console.log(`[sysml-visualizer] ${path.basename(doc.fileName)} closed — cleared diagnostics`);
      }
    }),
  );

  // ── Debug command ─────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('sysmlVisualizer.debugDiagnostics', () => {
      const trackedUri = currentSysmlUri?.toString() ?? '(none)';
      const diags      = currentSysmlUri
        ? (diagnosticCollection.get(currentSysmlUri) ?? [])
        : [];
      const first = diags[0];

      const lines = [
        `currentSysmlUri  : ${trackedUri}`,
        `Diagnostic count : ${diags.length}`,
        `First range      : ${first
          ? `[${first.range.start.line},${first.range.start.character}]-[${first.range.end.line},${first.range.end.character}]`
          : '(none)'}`,
        `First message    : ${first?.message ?? '(none)'}`,
      ];
      const info = lines.join('\n');
      vscode.window.showInformationMessage(info);
      console.log('[sysml-visualizer] debugDiagnostics:\n' + info);
    }),
  );

  // ── Reveal source command ─────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('sysmlVisualizer.revealModelSource', async () => {
      if (!currentSysmlUri) {
        vscode.window.showWarningMessage('SysML Visualizer: no SysML file is currently tracked.');
        return;
      }
      const doc    = await vscode.workspace.openTextDocument(currentSysmlUri);
      const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
      const pos    = new vscode.Position(0, 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
      console.log(`[sysml-visualizer] revealModelSource — opened ${path.basename(doc.fileName)}`);
    }),
  );

  // ── Visualizer panel command ──────────────────────────────────────────────────

  const cmd = vscode.commands.registerCommand('sysmlVisualizer.openVisualizer', async () => {
    // If a panel is already open, just bring it into view — no duplicate panels.
    if (activePanel) {
      activePanel.reveal(activePanel.viewColumn ?? vscode.ViewColumn.Beside, false);
      return;
    }

    // Snapshot the active sysml file BEFORE opening the panel, then move it
    // to column 1 so the visualizer can open in column 2 beside it.
    const preLaunchSysml = getActiveSysmlEditor();
    if (preLaunchSysml) {
      currentSysmlUri  = preLaunchSysml.document.uri;
      currentSysmlText = preLaunchSysml.document.getText();
      console.log(`[sysml-visualizer] captured initial sysml file: ${path.basename(preLaunchSysml.document.fileName)}`);
      // Move the SysML file to column 1 and focus it so that ViewColumn.Beside
      // reliably opens the panel in column 2 to the right.
      try {
        await vscode.window.showTextDocument(preLaunchSysml.document, {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: false,
        });
      } catch (e) {
        console.warn('[sysml-visualizer] showTextDocument to col1 failed:', e);
      }
    } else {
      console.log('[sysml-visualizer] no active .sysml editor at launch time');
    }

    const panel = vscode.window.createWebviewPanel(
      'sysmlVisualizer',
      'SysML v2 Visualizer',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
        retainContextWhenHidden: true,
      },
    );

    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
    activePanel = panel;

    const disposables: vscode.Disposable[] = [];

    // ── Editor → webview cursor sync ──────────────────────────────────────────
    let editorSyncSuppressed = false;
    let editorSyncSuppressTimer: ReturnType<typeof setTimeout> | undefined;
    let editorSyncDebounce:      ReturnType<typeof setTimeout> | undefined;

    function suppressEditorSync(): void {
      editorSyncSuppressed = true;
      if (editorSyncSuppressTimer) clearTimeout(editorSyncSuppressTimer);
      editorSyncSuppressTimer = setTimeout(() => { editorSyncSuppressed = false; }, 150);
    }

    function sendCurrentModelToWebview(): void {
      if (currentSysmlUri !== undefined && currentSysmlText !== undefined) {
        panel.webview.postMessage({
          type: 'loadModel',
          text: currentSysmlText,
          fileName: path.basename(currentSysmlUri.fsPath),
          parsing: autoRefresh,
        });
      } else {
        panel.webview.postMessage({ type: 'noModel' });
      }
    }

    // ── Webview → extension messages ─────────────────────────────────────────

    panel.webview.onDidReceiveMessage(async (msg: {
      type: string;
      newText?: string;
      edit?: {
        kind: 'insert' | 'replace' | 'delete';
        position?: { line: number; column: number };
        range?: { start: { line: number; column: number }; end: { line: number; column: number } };
        text?: string;
      };
      sourceLocation?: { line: number; column: number };
      semanticId?: string;
      startLine?: number;
      name?: string;
      defName?: string;
      memberText?: string;
      enabled?: boolean;
    }) => {
      console.log(`[sysml-visualizer] received webview message: ${msg.type}`);

      if (msg.type === 'ready') {
        // If there is a tracked .sysml file, open it (makes VS Code register the
        // document) and publish fresh diagnostics before sending the model.
        if (currentSysmlUri) {
          const doc = await vscode.workspace.openTextDocument(currentSysmlUri);
          // Only auto-visualize on open in auto mode. In manual mode (the default) the
          // panel shows the General view with a red marker and waits for Visualize.
          if (autoRefresh) {
            publishDiagnosticsForDocument(doc);
          } else {
            postStaleMarker(); // nothing visualized yet → red
          }
        }
        sendCurrentModelToWebview();
        // Send trlc annotations immediately so the Trace view is ready
        // even before the parse completes.
        sendTrlcAnnotations().catch(err => console.error('[sysml-visualizer] trlcAnnotations error:', err));
        sendTrlcRequirements().catch(err => console.error('[sysml-visualizer] trlcRequirements error:', err));

      } else if (msg.type === 'requestVisualize') {
        await doVisualize();

      } else if (msg.type === 'setAutoRefresh') {
        autoRefresh = msg.enabled !== false;
        console.log(`[sysml-visualizer] auto-refresh set to ${autoRefresh}`);
        if (autoRefresh && isStale()) await doVisualize();

      } else if (msg.type === 'applyFullTextEdit') {
        if (!currentSysmlUri) {
          vscode.window.showErrorMessage('SysML Visualizer: no SysML file is loaded');
          return;
        }
        if (typeof msg.newText !== 'string' || msg.newText === '') {
          vscode.window.showErrorMessage('SysML Visualizer: applyFullTextEdit received empty text');
          return;
        }
        console.log(`[sysml-visualizer] applyFullTextEdit — replacing ${path.basename(currentSysmlUri.fsPath)}`);
        const doc = await vscode.workspace.openTextDocument(currentSysmlUri);
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length),
        );
        const wsEdit = new vscode.WorkspaceEdit();
        wsEdit.replace(currentSysmlUri, fullRange, msg.newText);
        const ok = await vscode.workspace.applyEdit(wsEdit);
        if (!ok) {
          vscode.window.showErrorMessage('SysML Visualizer: failed to apply edit to document');
          return;
        }
        currentSysmlText = msg.newText;
        // onDidChangeTextDocument fires from applyEdit → publishDiagnosticsForDocument called automatically.
        console.log('[sysml-visualizer] applyFullTextEdit succeeded');

      } else if (msg.type === 'applyIncrementalEdit') {
        if (!currentSysmlUri || !msg.edit) {
          vscode.window.showErrorMessage('SysML Visualizer: no SysML file is loaded');
          return;
        }
        const ie = msg.edit;
        function toPos(p: { line: number; column: number }): vscode.Position {
          return new vscode.Position(p.line - 1, p.column - 1);
        }
        const wsEdit = new vscode.WorkspaceEdit();
        if (ie.kind === 'insert' && ie.position && typeof ie.text === 'string') {
          wsEdit.insert(currentSysmlUri, toPos(ie.position), ie.text);
        } else if (ie.kind === 'replace' && ie.range && typeof ie.text === 'string') {
          const range = new vscode.Range(toPos(ie.range.start), toPos(ie.range.end));
          wsEdit.replace(currentSysmlUri, range, ie.text);
        } else if (ie.kind === 'delete' && ie.range) {
          const range = new vscode.Range(toPos(ie.range.start), toPos(ie.range.end));
          wsEdit.delete(currentSysmlUri, range);
        } else {
          vscode.window.showErrorMessage('SysML Visualizer: malformed incremental edit');
          return;
        }
        const ok = await vscode.workspace.applyEdit(wsEdit);
        if (!ok) {
          vscode.window.showErrorMessage('SysML Visualizer: failed to apply incremental edit');
          return;
        }
        // onDidChangeTextDocument fires from applyEdit → publishDiagnosticsForDocument called automatically.
        console.log(`[sysml-visualizer] applyIncrementalEdit (${ie.kind}) succeeded`);

      } else if (msg.type === 'addMemberToDef') {
        // Cross-file add: insert `memberText` as the first member of the definition
        // named `defName`, wherever in the workspace it lives (a part usage's ports
        // belong to its type definition, often in another file than the assembly).
        const defName = msg.defName, memberText = msg.memberText;
        if (!defName || !memberText) {
          vscode.window.showErrorMessage('SysML Visualizer: malformed addMemberToDef');
          return;
        }
        const escaped = defName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const declRe  = new RegExp(`^([ \\t]*)(?:abstract\\s+)?(?:part|port|item|action|interface|connection|attribute)\\s+def\\s+${escaped}\\b`, 'm');
        const files   = await vscode.workspace.findFiles('**/*.sysml', '**/node_modules/**');
        let done = false;
        for (const uri of files) {
          const doc  = await vscode.workspace.openTextDocument(uri);
          const text = doc.getText();
          const m    = declRe.exec(text);
          if (!m) continue;
          const braceIdx = text.indexOf('{', m.index);
          if (braceIdx < 0) continue;
          const indent   = (m[1] ?? '') + '    ';
          const wsEdit   = new vscode.WorkspaceEdit();
          wsEdit.insert(uri, doc.positionAt(braceIdx + 1), `\n${indent}${memberText}`);
          const ok = await vscode.workspace.applyEdit(wsEdit);
          if (!ok) { vscode.window.showErrorMessage('SysML Visualizer: failed to add member'); return; }
          console.log(`[sysml-visualizer] addMemberToDef — added to ${defName} in ${path.basename(uri.fsPath)}`);
          done = true;
          break;
        }
        if (!done) vscode.window.showErrorMessage(`SysML Visualizer: definition '${defName}' not found in the workspace`);

      } else if (msg.type === 'revealSource') {
        if (!currentSysmlUri || !msg.sourceLocation) return;
        const { line, column } = msg.sourceLocation;
        suppressEditorSync();
        const doc = await vscode.workspace.openTextDocument(currentSysmlUri);
        const position = new vscode.Position(line - 1, (column ?? 1) - 1);
        const editor = await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: true,
        });
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenterIfOutsideViewport,
        );
        console.log(`[sysml-visualizer] revealSource — line ${line}, col ${column}`);

      } else if (msg.type === 'revealElementInSource' && typeof msg.name === 'string') {
        // Text-search fallback: find the element definition without needing the parser service.
        // Reuses findSysMLDefinition (same logic as go-to-definition / F12).
        const name = msg.name;
        const filesToSearch: vscode.Uri[] = [];
        if (currentSysmlUri) filesToSearch.push(currentSysmlUri);
        try {
          const all = await vscode.workspace.findFiles('**/*.sysml', '**/node_modules/**');
          for (const u of all) {
            if (!filesToSearch.some(f => f.toString() === u.toString())) filesToSearch.push(u);
          }
        } catch { /* ignore */ }

        let found: vscode.Location | null = null;
        for (const uri of filesToSearch) {
          try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            found = findSysMLDefinition(Buffer.from(bytes).toString('utf8'), name, uri);
          } catch { /* skip */ }
          if (found) break;
        }
        if (!found) {
          console.warn(`[sysml-visualizer] revealElementInSource: "${name}" not found`);
        } else {
          suppressEditorSync();
          const doc = await vscode.workspace.openTextDocument(found.uri);
          const editor = await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true,
          });
          editor.selection = new vscode.Selection(found.range.start, found.range.start);
          editor.revealRange(found.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
          console.log(`[sysml-visualizer] revealElementInSource "${name}" → ${path.basename(found.uri.fsPath)}:${found.range.start.line + 1}`);
        }

      } else if (msg.type === 'runValidator') {
        if (!lastGraph || !lastDocument) {
          void panel.webview.postMessage({ type: 'validatorResult', diagnostics: [], noGraph: true });
          return;
        }
        const valDiags = validateModel(lastGraph);
        void panel.webview.postMessage({
          type: 'validatorResult',
          diagnostics: valDiags,
          // So the webview can flag that these checks ran over a PARTIAL model when the
          // parse itself failed (validateModel checks graph rules, not syntax/linking).
          parsePartial: lastParse ? !lastParse.success : false,
          parseErrorCount: lastParse?.errorCount ?? 0,
        });
        // Persist as VS Code squiggles in a separate collection so they don't
        // mix with parser diagnostics and survive until the next explicit run.
        const vsValDiags = valDiags.map(d => {
          const vd = new vscode.Diagnostic(
            toVsCodeRange(lastDocument!, d.line, d.column),
            d.message,
            mapSeverity(d),
          );
          vd.source = 'SysML v2 Model Checker';
          if (d.code) vd.code = d.code;
          return vd;
        });
        validatorDiagCollection.set(lastDocument.uri, vsValDiags);
        console.log(`[sysml-visualizer] validator: ${valDiags.length} issue(s)`);

      } else if (msg.type === 'revealSemanticElement') {
        const semanticId = msg.semanticId;
        if (!semanticId || !currentSysmlUri) return;
        // Prefer the pre-built nodeIdToRange (populated by publishDiagnosticsOfficial).
        // Fall back to the startLine embedded in the message when the map is empty,
        // which happens in prototype mode where publishDiagnosticsOfficial never runs.
        const range = nodeIdToRange.get(semanticId) ??
          (msg.startLine ? { startLine: msg.startLine, endLine: msg.startLine } : null);
        if (!range) {
          console.warn(`[sysml-visualizer] revealSemanticElement: no range for "${semanticId}" (nodeIdToRange size=${nodeIdToRange.size}, no startLine fallback)`);
          return;
        }
        suppressEditorSync();
        const doc = await vscode.workspace.openTextDocument(currentSysmlUri);
        const startPos = new vscode.Position(range.startLine - 1, 0);
        const endPos   = new vscode.Position(range.endLine - 1, Number.MAX_SAFE_INTEGER);
        const editor = await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: true,
        });
        editor.selection = new vscode.Selection(startPos, startPos);
        editor.revealRange(
          new vscode.Range(startPos, endPos),
          vscode.TextEditorRevealType.InCenterIfOutsideViewport,
        );
        console.log(`[sysml-visualizer] revealSemanticElement "${semanticId}" → L${range.startLine}–${range.endLine}`);

      }
    }, undefined, disposables);

    // ── VS Code document changes → webview ───────────────────────────────────

    vscode.workspace.onDidChangeTextDocument(e => {
      if (currentSysmlUri && e.document.uri.toString() === currentSysmlUri.toString()) {
        currentSysmlText = e.document.getText();
        console.log('[sysml-visualizer] document changed — sending updateModel to webview');
        // `parsing` tells the webview whether a graph refresh follows this text sync.
        // In manual mode (autoRefresh off) no parse runs, so the webview must NOT show
        // a "parsing" overlay — it just updates its source copy.
        panel.webview.postMessage({ type: 'updateModel', text: currentSysmlText, parsing: autoRefresh });
      }
    }, undefined, disposables);

    // ── VS Code cursor → webview selection ───────────────────────────────────

    vscode.window.onDidChangeTextEditorSelection(e => {
      if (editorSyncSuppressed) return;
      if (!currentSysmlUri || e.textEditor.document.uri.toString() !== currentSysmlUri.toString()) return;

      clearTimeout(editorSyncDebounce);
      editorSyncDebounce = setTimeout(() => {
        const pos = e.selections[0].active;
        console.log(`[sysml-visualizer] cursor moved — line ${pos.line + 1}`);
        panel.webview.postMessage({
          type: 'revealElementAtSource',
          sourceLocation: { line: pos.line + 1, column: pos.character + 1 },
        });
      }, 100);
    }, undefined, disposables);

    // ── Active editor switches ────────────────────────────────────────────────
    // When the panel is open we enforce a two-column layout: SysML file on the
    // left (column 1), visualizer on the right (column 2).  If a SysML file
    // becomes active in any column other than 1 we silently move it there;
    // the resulting re-activation carries the file in column 1 and proceeds
    // normally.  A flag guards against the move triggering a second re-entry.
    let movingToCol1 = false;

    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor === undefined) {
        // Webview or non-editor widget gained focus — do not clear diagnostics.
        console.log('[sysml-visualizer] active editor undefined — keeping current model');
        return;
      }

      if (isSysml(editor.document)) {
        // Enforce column-1 placement while the visualizer panel is open.
        // moveEditorToFirstGroup moves the active tab without creating a duplicate,
        // unlike showTextDocument which would open a second copy in col 1.
        if (!movingToCol1 && editor.viewColumn !== vscode.ViewColumn.One) {
          movingToCol1 = true;
          void vscode.commands.executeCommand('workbench.action.moveEditorToFirstGroup')
            .then(() => { movingToCol1 = false; }, () => { movingToCol1 = false; });
          // The move re-triggers onDidChangeActiveTextEditor with viewColumn === One;
          // that event handles the loadModel update.
          return;
        }

        const newUri = editor.document.uri.toString();
        const oldUri = currentSysmlUri;
        const sameFile = oldUri?.toString() === newUri;
        currentSysmlUri  = editor.document.uri;
        currentSysmlText = editor.document.getText();

        // Close the previous SysML tab so col1 never accumulates more than one
        // SysML file. This handles the case where VS Code opens a new file as a
        // fresh tab (rather than replacing the preview tab) after the user has
        // clicked inside the visualizer panel.
        if (!sameFile && oldUri) {
          const oldStr = oldUri.toString();
          for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
              if (tab.input instanceof vscode.TabInputText &&
                  tab.input.uri.toString() === oldStr) {
                void vscode.window.tabGroups.close(tab, false);
                break;
              }
            }
          }
        }

        // Only reload the model when switching to a DIFFERENT .sysml file.
        // Same-file activations happen when revealSemanticElement (element chip
        // click in the trace view) calls showTextDocument — sending loadModel in
        // that case would reset selection to null in the webview.
        if (!sameFile) {
          console.log(`[sysml-visualizer] loading sysml file: ${path.basename(editor.document.fileName)}`);
          panel.webview.postMessage({
            type: 'loadModel',
            text: currentSysmlText,
            fileName: path.basename(editor.document.fileName),
            parsing: autoRefresh,
          });
          if (autoRefresh) {
            // Auto mode: re-scope the views to the newly focused file — parse it as the
            // new primary (others as context) and post a fresh updateGraph.
            publishDiagnosticsForDocument(editor.document);
          } else {
            // Manual mode: the new file becomes active and the view resets to General,
            // but we do NOT auto-visualize it — the marker goes red because the active
            // file no longer matches the visualized one. Wait for Visualize.
            postStaleMarker();
          }
        } else {
          console.log(`[sysml-visualizer] same sysml file refocused — skipping loadModel`);
        }
        // Resend trlc annotations so new file's traces appear immediately.
        sendTrlcAnnotations().catch(err => console.error('[sysml-visualizer] trlcAnnotations error:', err));
        sendTrlcRequirements().catch(err => console.error('[sysml-visualizer] trlcRequirements error:', err));
      } else {
        console.log('[sysml-visualizer] non-sysml editor active — keeping current model');
      }
    }, undefined, disposables);

    panel.onDidDispose(() => {
      if (activePanel === panel) activePanel = undefined;
      disposables.forEach(d => d.dispose());
      if (editorSyncSuppressTimer) clearTimeout(editorSyncSuppressTimer);
      if (editorSyncDebounce) clearTimeout(editorSyncDebounce);
    });
  });

  context.subscriptions.push(cmd);

  // ── Reveal TRLC requirement in Trace view ─────────────────────────────────────
  // Invoked by Cmd/Ctrl+Click on a // trlc-satisfies: annotation via DocumentLink.

  context.subscriptions.push(
    vscode.commands.registerCommand('sysmlVisualizer.revealTrlcReq', (numericId: string) => {
      if (!activePanel) {
        vscode.window.showWarningMessage('SysML Visualizer: open the visualizer panel first.');
        return;
      }
      activePanel.reveal(activePanel.viewColumn ?? vscode.ViewColumn.Beside, true);
      void activePanel.webview.postMessage({ type: 'revealTrlcReq', numericId });
    }),
  );

  // ── Go-to-definition (F12) and Cmd/Ctrl+Click ────────────────────────────────
  //
  // Also intercepts Cmd/Ctrl+Click on `// trlc-satisfies: NNNNN` lines to reveal
  // the requirement in the Trace view. Returns the number's own range so VS Code
  // doesn't navigate or show "No definition found".
  //
  // For regular symbols: text-based search across all workspace .sysml files.
  // Looks for `<kw> def Word` or `package Word` patterns; no parser needed.
  // Current file is searched first so same-file defs are instant.

  // ── Official-parser symbol index (replaces the retired TypeScript analyzer) ────
  // All IDE language features below resolve identifiers through the occurrence table
  // (`symbols`) emitted by the official parser — a per-file list of declaration/reference
  // positions keyed by resolved qualified name. No second parser is involved.

  interface SymbolIndex {
    occurrences: SourceOccurrence[];
    /** Occurrence covering a 0-based (line, col), if any. */
    atPosition(line: number, col: number): SourceOccurrence | undefined;
    /** All occurrences (decl + refs) sharing a symbolKey. */
    byKey(key: string): SourceOccurrence[];
    /** Declaration occurrences only. */
    decls(): SourceOccurrence[];
  }

  function buildSymbolIndex(symbols: SourceOccurrence[]): SymbolIndex {
    const byKeyMap = new Map<string, SourceOccurrence[]>();
    for (const o of symbols) {
      const arr = byKeyMap.get(o.symbolKey);
      if (arr) arr.push(o); else byKeyMap.set(o.symbolKey, [o]);
    }
    return {
      occurrences: symbols,
      atPosition: (line, col) => symbols.find(
        o => o.line === line && col >= o.column && col <= o.column + o.length),
      byKey: (key) => byKeyMap.get(key) ?? [],
      decls: () => symbols.filter(o => o.role === 'decl'),
    };
  }

  /** Content-fresh phase-1 official parse for a document (reuses the parse cache). */
  async function officialParseFor(document: vscode.TextDocument): Promise<SysMLV2ParseResult> {
    const text = document.getText();
    const key  = parseCacheKey(text, []);
    let r = parseCacheGet(key) ?? await diskCacheGet(key);
    if (!r) {
      r = await javaClient.parse(text, []);
      parseCacheSet(key, r);
      void diskCacheSet(key, r);
    }
    if (r.model && !r.graph) r.graph = buildGraphWithContext(r.model, r.contextModels ?? []);
    return r;
  }

  async function symbolIndexFor(document: vscode.TextDocument): Promise<SymbolIndex> {
    const r = await officialParseFor(document);
    return buildSymbolIndex(r.symbols ?? []);
  }

  /** Last `::` segment of a symbolKey — the bare identifier name. */
  const lastSeg = (key: string): string => { const i = key.lastIndexOf('::'); return i >= 0 ? key.slice(i + 2) : key; };

  /** SysML semantic-token type name → legend index. */
  const TOKEN_TYPE_INDEX: Record<string, number> = {
    class: ST.class, interface: ST.interface, property: ST.property, variable: ST.variable,
    function: ST.function, type: ST.type, keyword: ST.keyword, string: ST.string,
  };

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider({ language: 'sysml' }, {
      async provideDefinition(document, position) {
        if (!document.fileName.endsWith('.sysml')) return;

        // Cmd/Ctrl+Click on trlc-satisfies annotation → reveal in Trace view.
        const lineText = document.lineAt(position.line).text;
        const trlcMatch = lineText.match(/\/\/\s*trlc-satisfies:\s*(\d+)/);
        if (trlcMatch) {
          const numericId = trlcMatch[1];
          void vscode.commands.executeCommand('sysmlVisualizer.revealTrlcReq', numericId);
          const numStart = lineText.indexOf(numericId);
          return [new vscode.Location(
            document.uri,
            new vscode.Range(position.line, numStart, position.line, numStart + numericId.length),
          )];
        }

        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
        if (!wordRange) return;
        const word = document.getText(wordRange);
        if (!word || SYSML_KEYWORDS.has(word)) return;

        // Current file first.
        const local = findSysMLDefinition(document.getText(), word, document.uri);
        if (local) return local;

        // Remaining workspace files.
        const all = await vscode.workspace.findFiles('**/*.sysml', '**/node_modules/**');
        for (const uri of all) {
          if (uri.toString() === document.uri.toString()) continue;
          try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            const hit   = findSysMLDefinition(Buffer.from(bytes).toString('utf8'), word, uri);
            if (hit) return hit;
          } catch { /* unreadable file — skip */ }
        }
      },
    }),
  );

  // ── Find-references (Shift+F12) ───────────────────────────────────────────────

  context.subscriptions.push(
    vscode.languages.registerReferenceProvider({ language: 'sysml' }, {
      async provideReferences(document, position) {
        if (!document.fileName.endsWith('.sysml')) return [];
        const index = await symbolIndexFor(document);
        const occ   = index.atPosition(position.line, position.character);
        if (!occ) return [];
        return index.byKey(occ.symbolKey).map(o => new vscode.Location(
          document.uri,
          new vscode.Range(o.line, o.column, o.line, o.column + o.length),
        ));
      },
    }),
  );

  // ── Hover provider ────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ language: 'sysml' }, {
      async provideHover(document, position) {
        if (!document.fileName.endsWith('.sysml')) return;
        const parse = await officialParseFor(document);
        const index = buildSymbolIndex(parse.symbols ?? []);
        const occ   = index.atPosition(position.line, position.character);
        if (!occ) return;

        const name  = lastSeg(occ.symbolKey);
        const graph = parse.graph;
        // Resolve to the declared element in the graph (prefer a same-position declaration).
        const node =
          graph?.nodes.find(n => n.label === name && n.startLine === occ.line + 1) ??
          graph?.nodes.find(n => n.label === name);

        const contents: vscode.MarkdownString[] = [];
        const kindLabel = node?.type ?? (occ.tokenType === 'type' ? 'type' : 'symbol');
        contents.push(hoverMd(`**${kindLabel}**: \`${name}\``));
        if (occ.symbolKey.includes('::')) contents.push(hoverMd(`Qualified: \`${occ.symbolKey}\``));

        // For a definition/usage, list its direct ports resolved by the official parser.
        if (node && graph) {
          const prefix = node.id + '.';
          const ports = graph.nodes.filter(n =>
            n.id.startsWith(prefix) &&
            (n.type === 'PortUsage' || n.type === 'PortDefinition') &&
            n.label !== n.type);
          if (ports.length > 0) {
            const list = ports.map(p => `- \`${p.direction ? p.direction + ' ' : ''}${p.label}\``).join('\n');
            contents.push(hoverMd(`---\n**Ports**:\n${list}`));
          }
        }
        return new vscode.Hover(contents);
      },
    }),
  );

  // ── Completion provider ───────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: 'sysml' },
      {
        async provideCompletionItems(document) {
          if (!document.fileName.endsWith('.sysml')) return [];
          const index = await symbolIndexFor(document);
          const seen  = new Set<string>();
          const items: vscode.CompletionItem[] = [];
          for (const d of index.decls()) {
            const name = lastSeg(d.symbolKey);
            if (!name || seen.has(name)) continue;
            seen.add(name);
            const kind = d.tokenType === 'class'    ? vscode.CompletionItemKind.Class
                       : d.tokenType === 'interface' ? vscode.CompletionItemKind.Interface
                       : d.tokenType === 'property'  ? vscode.CompletionItemKind.Property
                       : d.tokenType === 'function'  ? vscode.CompletionItemKind.Function
                       :                               vscode.CompletionItemKind.Variable;
            const ci = new vscode.CompletionItem(name, kind);
            if (d.symbolKey.includes('::')) ci.detail = d.symbolKey;
            items.push(ci);
          }
          return items;
        },
      },
      ':', ' ',
    ),
  );

  // ── Semantic tokens ───────────────────────────────────────────────────────────

  console.log('[sysml-visualizer] Registering SysML semantic tokens provider');

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'sysml' },
      {
        async provideDocumentSemanticTokens(document) {
          if (!document.fileName.endsWith('.sysml')) return;
          try {
            const index = await symbolIndexFor(document);
            // Occurrences are already exact (line, col, length) from the parser; sort for the builder.
            const sorted = [...index.occurrences].sort(
              (a, b) => a.line !== b.line ? a.line - b.line : a.column - b.column);
            const builder = new vscode.SemanticTokensBuilder(SYSML_LEGEND);
            for (const o of sorted) {
              const tt = TOKEN_TYPE_INDEX[o.tokenType] ?? ST.variable;
              builder.push(o.line, o.column, o.length, tt, 0);
            }
            const result = builder.build();
            console.log(`[sysml-visualizer] semantic tokens: ${sorted.length} tokens emitted`);
            return result;
          } catch (err) {
            console.error('[sysml-visualizer] semantic tokens error:', err);
            return;
          }
        },
      },
      SYSML_LEGEND,
    ),
  );

  // ── Rename symbol (F2) ───────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.languages.registerRenameProvider({ language: 'sysml' }, {
      async prepareRename(document, position) {
        if (!document.fileName.endsWith('.sysml')) return;
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
        if (!wordRange) throw new Error('No renameable symbol at this position.');
        const word = document.getText(wordRange);
        if (SYSML_KEYWORDS.has(word)) throw new Error(`"${word}" is a keyword and cannot be renamed.`);
        const index = await symbolIndexFor(document);
        const occ   = index.atPosition(position.line, position.character);
        if (!occ) throw new Error('No renameable symbol at this position.');
        return { range: new vscode.Range(occ.line, occ.column, occ.line, occ.column + occ.length), placeholder: lastSeg(occ.symbolKey) };
      },

      async provideRenameEdits(document, position, newName) {
        if (!document.fileName.endsWith('.sysml')) return;
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(newName)) {
          throw new Error(`"${newName}" is not a valid SysML identifier.`);
        }
        const index = await symbolIndexFor(document);
        const occ   = index.atPosition(position.line, position.character);
        if (!occ) return;
        // Rename every occurrence sharing this symbol's resolved key (scope-precise).
        const wsEdit = new vscode.WorkspaceEdit();
        for (const o of index.byKey(occ.symbolKey)) {
          wsEdit.replace(document.uri, new vscode.Range(o.line, o.column, o.line, o.column + o.length), newName);
        }
        return wsEdit;
      },
    }),
  );

  // ── Format document (Shift+Alt+F) ────────────────────────────────────────────

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider({ language: 'sysml' }, {
      provideDocumentFormattingEdits(document) {
        if (!document.fileName.endsWith('.sysml')) return [];
        const original  = document.getText();
        const formatted = formatSysML(original);
        if (formatted === original) return [];
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(original.length),
        );
        return [vscode.TextEdit.replace(fullRange, formatted)];
      },
    }),
  );

  // ── Document symbols / Outline (Ctrl+Shift+O) ────────────────────────────────

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider({ language: 'sysml' }, {
      async provideDocumentSymbols(document) {
        if (!document.fileName.endsWith('.sysml')) return [];
        try {
          const parse = await officialParseFor(document);
          const graph = parse.graph;
          const decls = (parse.symbols ?? []).filter(o => o.role === 'decl');

          const symKind = (tt: string): vscode.SymbolKind =>
              tt === 'class'     ? vscode.SymbolKind.Class
            : tt === 'interface' ? vscode.SymbolKind.Interface
            : tt === 'property'  ? vscode.SymbolKind.Property
            : tt === 'function'  ? vscode.SymbolKind.Function
            :                      vscode.SymbolKind.Variable;

          const byKey  = new Map<string, vscode.DocumentSymbol>();
          const roots: vscode.DocumentSymbol[] = [];
          // Shallow keys first so a parent exists before its children are attached.
          const sorted = [...decls].sort(
            (a, b) => a.symbolKey.split('::').length - b.symbolKey.split('::').length);

          for (const d of sorted) {
            const name = lastSeg(d.symbolKey);
            const node = graph?.nodes.find(n => n.label === name && n.startLine === d.line + 1);
            const selRange = new vscode.Range(d.line, d.column, d.line, d.column + d.length);
            let range = selRange;
            if (node?.startLine) {
              const full = new vscode.Range(node.startLine - 1, 0,
                (node.endLine ?? node.startLine) - 1, Number.MAX_SAFE_INTEGER);
              if (full.contains(selRange)) range = full;
            }
            const ds = new vscode.DocumentSymbol(name, node?.type ?? '', symKind(d.tokenType), range, selRange);
            byKey.set(d.symbolKey, ds);
            const sep    = d.symbolKey.lastIndexOf('::');
            const parent = sep >= 0 ? byKey.get(d.symbolKey.slice(0, sep)) : undefined;
            if (parent) parent.children.push(ds); else roots.push(ds);
          }
          return roots;
        } catch {
          return [];
        }
      },
    }),
  );

  // ── Debug semantic tokens command ─────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('sysmlVisualizer.debugSemanticTokens', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !editor.document.fileName.endsWith('.sysml')) {
        vscode.window.showWarningMessage('SysML: open a .sysml file first');
        return;
      }
      const document = editor.document;
      const parse    = await officialParseFor(document);
      const symbols  = parse.symbols ?? [];
      const decls    = symbols.filter(o => o.role === 'decl').length;
      const refs     = symbols.filter(o => o.role === 'ref').length;

      const lines = [
        `Language ID : ${document.languageId}`,
        `File        : ${path.basename(document.fileName)}`,
        `Line count  : ${document.lineCount}`,
        `Occurrences : ${symbols.length} (${decls} decl, ${refs} ref)`,
        `Graph nodes : ${parse.graph?.nodes.length ?? 0}`,
        `Diagnostics : ${parse.diagnostics.length}`,
      ];
      const info = lines.join('\n');
      vscode.window.showInformationMessage(info);
      console.log('[sysml-visualizer] debugSemanticTokens:\n' + info);
    }),
  );
}

export function deactivate(): void {
  // No managed processes to clean up — the Java client uses a persistent JVM
  // that is owned by the extension host process and exits with it.
}

// ── Module-level helpers ──────────────────────────────────────────────────────

// ── SysML keyword set (used by rename provider to reject keywords) ────────────

const SYSML_KEYWORDS = new Set([
  'package', 'part', 'def', 'interface', 'action', 'behavior', 'occurrence',
  'state', 'requirement', 'satisfy', 'verify', 'trace', 'satisfies', 'verifies',
  'traces', 'from', 'to', 'port', 'in', 'out', 'connect', 'flow', 'message',
  'transition', 'initial', 'id', 'text', 'priority',
]);

// ── Go-to-definition helper ───────────────────────────────────────────────────

/**
 * Scan `text` for the canonical declaration of `word`.
 *
 * Pass 1 — explicit def:
 *   `<keyword> def Word`  — part/port/interface/behavior/action/occurrence/
 *                           state/requirement/enum/attribute/item def
 *   `package Word`
 *
 * Pass 2 — usage declaration (no def):
 *   `<keyword> Word` followed by `{`, `:`, `;`, or end-of-line — covers
 *   anonymous usage declarations like `action detectSensorPairImplausiblePath;`
 *
 * Comment lines and inline comments are stripped before matching to avoid
 * false positives from commented-out or documented code.
 *
 * Returns the Location of the word token itself, or null if not found.
 */
function findSysMLDefinition(
  text: string,
  word: string,
  uri: vscode.Uri,
): vscode.Location | null {
  const esc    = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const defRe  = new RegExp(
    `\\b(?:part|port|interface|behavior|action|occurrence|state|requirement|enum|attribute|item|calc|constraint|flow)\\s+def\\s+${esc}\\b` +
    `|\\bpackage\\s+${esc}\\b`,
  );
  // Usage pattern: keyword directly before name, name ends at {, :, ; or EOL.
  const usageRe = new RegExp(
    `\\b(?:part|port|interface|behavior|action|occurrence|state|requirement|enum|attribute|item|calc|constraint|flow|connection)\\s+${esc}(?=\\s*(?:[{:;]|$))`,
  );

  const lines = text.split('\n');
  let usageFallback: vscode.Location | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    // Skip pure comment lines.
    if (lineText.trimStart().startsWith('//')) continue;
    // Strip inline comments before matching to avoid false positives.
    const code = lineText.replace(/\/\/.*$/, '');

    const defM = defRe.exec(code);
    if (defM) {
      const col = lineText.indexOf(word, defM.index);
      return new vscode.Location(uri, new vscode.Position(i, col < 0 ? 0 : col));
    }

    if (!usageFallback) {
      const usageM = usageRe.exec(code);
      if (usageM) {
        const col = lineText.indexOf(word, usageM.index);
        usageFallback = new vscode.Location(uri, new vscode.Position(i, col < 0 ? 0 : col));
      }
    }
  }

  return usageFallback;
}

// ── Semantic token constants ──────────────────────────────────────────────────

const SYSML_TOKEN_TYPES = [
  'class',       // 0 — partDef, occurrenceDef, behaviorDef, stateDef, requirementDef
  'interface',   // 1 — interfaceDef
  'property',    // 2 — port names
  'variable',    // 3 — participant alias names (partAlias)
  'function',    // 4 — message names, action names
  'type',        // 5 — type references (portType, part type, action type)
  'keyword',     // 6 — keyword occurrences (e.g. 'part def')
  'string',      // 7 — requirement string literals
];

const SYSML_LEGEND = new vscode.SemanticTokensLegend(SYSML_TOKEN_TYPES);

const ST = {
  class: 0, interface: 1, property: 2, variable: 3,
  function: 4, type: 5, keyword: 6, string: 7,
} as const;

function hoverMd(text: string): vscode.MarkdownString {
  return new vscode.MarkdownString(text);
}

function getActiveSysmlEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  return editor && isSysml(editor.document) ? editor : undefined;
}


function isSysml(doc: vscode.TextDocument): boolean {
  return doc.fileName.endsWith('.sysml');
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const distUri = vscode.Uri.joinPath(extensionUri, 'dist');
  const indexPath = path.join(distUri.fsPath, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  const distWebviewUri = webview.asWebviewUri(distUri).toString();
  html = html.replace(/(src|href)="\.\//g, `$1="${distWebviewUri}/`);
  html = html.replace(/ crossorigin/g, '');

  const csp = [
    `default-src 'none'`,
    `script-src ${webview.cspSource} 'unsafe-eval' blob:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `worker-src blob:`,
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource} data:`,
    // Allow fetch() calls to the external SysML v2 parser service.
    // The URL is user-configurable (sysmlVisualizer.parserServiceUrl), so
    // wildcard is required. Only applies when Official SysML v2 mode is active.
    `connect-src *`,
  ].join('; ');

  html = html.replace(
    '<meta charset="UTF-8" />',
    `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
  );

  return html;
}
