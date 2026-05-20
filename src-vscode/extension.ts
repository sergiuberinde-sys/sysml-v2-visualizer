import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { JavaWrapperClient } from '../parser-service/src/javaWrapperClient';
import { buildGraph } from '../parser-service/src/graphBuilder';
import { buildBehavior } from '../parser-service/src/behaviorBuilder';
import type { SysMLV2ParseResult } from '../parser-service/src/types';

// ── Parse result cache ────────────────────────────────────────────────────────
// Keyed by SHA-256(primary text + sorted context texts). Avoids redundant JVM
// round-trips when switching back to a file that hasn't changed.
const PARSE_CACHE_TTL_MS = 5 * 60 * 1000;
const PARSE_CACHE_MAX    = 10;
interface ParseCacheEntry { result: SysMLV2ParseResult; ts: number }
const parseCache = new Map<string, ParseCacheEntry>();

function parseCacheKey(text: string, context: { name: string; text: string }[]): string {
  const h = createHash('sha256');
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
  if (parseCache.size >= PARSE_CACHE_MAX) {
    let oldestKey = ''; let oldestTs = Infinity;
    for (const [k, v] of parseCache) { if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; } }
    if (oldestKey) parseCache.delete(oldestKey);
  }
  parseCache.set(key, { result, ts: Date.now() });
}
import {
  analyzeSysML,
  getSymbolAtPosition,
  getDefinitionForSymbol,
  getReferencesToSymbol,
  getIntraBlockReferences,
} from '../src/core/analyzer/analyzeSysML';
import { getCompletions } from '../src/core/language/completions';
import type { SysMLCompletion } from '../src/core/language/completions';
import { formatSysML } from '../src/core/language/formatter';
import type { SysMLNode } from '../src/core/modelTypes';
import { scanRawAnnotations } from '../src/core/trlc/extractTraces';


export function activate(context: vscode.ExtensionContext): void {
  let currentSysmlUri: vscode.Uri | undefined;
  let currentSysmlText: string | undefined;

  // The currently open visualizer panel, if any.
  // Captured by publishDiagnosticsOfficial via closure so it can post graph data.
  let activePanel: vscode.WebviewPanel | undefined;

  // Index rebuilt on every official parse: graph-node path → 1-based source range.
  // Populated by publishDiagnosticsOfficial; read by the revealSemanticElement handler.
  type NodeRange = { startLine: number; endLine: number };
  let nodeIdToRange = new Map<string, NodeRange>();

  const diagnosticCollection = vscode.languages.createDiagnosticCollection('sysml-v2');
  context.subscriptions.push(diagnosticCollection);

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

  async function publishDiagnosticsOfficial(document: vscode.TextDocument): Promise<void> {
    const uri = document.uri;
    console.log(`[sysml-visualizer] START parse: ${path.basename(uri.fsPath)}`);
    try {
      // Collect all other .sysml files as cross-file import context.
      const contextFiles: { name: string; text: string }[] = [];
      const allSysml = await vscode.workspace.findFiles('**/*.sysml', '**/node_modules/**');
      await Promise.all(allSysml.map(async (u) => {
        if (u.toString() === uri.toString()) return;
        try {
          const bytes = await vscode.workspace.fs.readFile(u);
          contextFiles.push({ name: u.path.split('/').pop() ?? u.path, text: Buffer.from(bytes).toString('utf8') });
        } catch { /* skip */ }
      }));

      const primaryText = document.getText();
      const cacheKey    = parseCacheKey(primaryText, contextFiles);
      const cached      = parseCacheGet(cacheKey);
      if (cached) {
        console.log(`[sysml-visualizer] cache hit — skipping JVM parse`);
      }
      const result: SysMLV2ParseResult = cached ?? await javaClient.parse(primaryText, contextFiles);
      if (!cached) parseCacheSet(cacheKey, result);

      // VS Code diagnostic squiggles
      const diags = result.diagnostics.map(d => {
        const vd = new vscode.Diagnostic(toVsCodeRange(document, d.line, d.column), d.message, mapSeverity(d));
        vd.source = 'SysML v2 (official)';
        return vd;
      });
      diagnosticCollection.set(uri, diags);
      console.log(`[sysml-visualizer] diagnostics: ${diags.length}`);

      if (activePanel) {
        // Build graph + behavior from the model tree (Java wrapper returns model[]).
        if (result.model && !result.graph) {
          result.graph    = buildGraph(result.model);
          result.behavior = buildBehavior(result.model);
        }
        const graph    = result.graph    ?? { nodes: [], edges: [] };
        const behavior = result.behavior ?? null;

        void activePanel.webview.postMessage({
          type: 'updateGraph',
          graph,
          behavior,
          success: result.success,
          diagnostics: result.diagnostics,
        });

        // Rebuild semantic-ID → source range index for reverse (visualizer → editor) sync.
        type GNode = { id: string; startLine?: number; endLine?: number };
        const gNodes = (graph as { nodes: GNode[] }).nodes;
        nodeIdToRange = new Map();
        for (const n of gNodes) {
          if (n.startLine != null && n.startLine > 0) {
            nodeIdToRange.set(n.id, { startLine: n.startLine, endLine: n.endLine ?? n.startLine });
          }
        }
        console.log(`[sysml-visualizer] updateGraph: ${gNodes.length} nodes, rangeIndex=${nodeIdToRange.size}`);
      }
    } catch (err) {
      console.error('[sysml-visualizer] parse ERROR:', err);
    }
  }

  // ── Activation-level listeners ────────────────────────────────────────────────

  // Diagnose any .sysml files already open when the extension activates.
  for (const doc of vscode.workspace.textDocuments) {
    publishDiagnosticsForDocument(doc);
  }

  context.subscriptions.push(
    // Re-publish whenever any .sysml document changes.
    // Uses e.document (the actual changed document) directly — no currentSysmlUri filter.
    vscode.workspace.onDidChangeTextDocument(e => {
      publishDiagnosticsForDocument(e.document);
    }),

    // Diagnose newly opened .sysml files.
    vscode.workspace.onDidOpenTextDocument(doc => {
      publishDiagnosticsForDocument(doc);
    }),

    // Clear diagnostics only when the document is explicitly closed.
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.fileName.endsWith('.sysml')) {
        diagnosticCollection.delete(doc.uri);
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
    }) => {
      console.log(`[sysml-visualizer] received webview message: ${msg.type}`);

      if (msg.type === 'ready') {
        // If there is a tracked .sysml file, open it (makes VS Code register the
        // document) and publish fresh diagnostics before sending the model.
        if (currentSysmlUri) {
          const doc = await vscode.workspace.openTextDocument(currentSysmlUri);
          publishDiagnosticsForDocument(doc);
        }
        sendCurrentModelToWebview();
        // Send trlc annotations immediately so the Trace view is ready
        // even before the parse completes.
        void sendTrlcAnnotations();

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
        panel.webview.postMessage({ type: 'updateModel', text: currentSysmlText });
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
          });
        } else {
          console.log(`[sysml-visualizer] same sysml file refocused — skipping loadModel`);
        }
        // Resend trlc annotations so new file's traces appear immediately.
        void sendTrlcAnnotations();
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
      provideReferences(document, position) {
        if (!document.fileName.endsWith('.sysml')) return [];
        const analysis = analyzeSysML(document.getText());
        const element  = getSymbolAtPosition(analysis, position.line + 1, position.character + 1);
        if (!element) return [];
        const refs = getReferencesToSymbol(analysis, element);
        return refs.map(r => new vscode.Location(
          document.uri,
          new vscode.Position(r.line - 1, 0),
        ));
      },
    }),
  );

  // ── Hover provider ────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ language: 'sysml' }, {
      provideHover(document, position) {
        if (!document.fileName.endsWith('.sysml')) return;
        const analysis = analyzeSysML(document.getText());
        const element  = getSymbolAtPosition(analysis, position.line + 1, position.character + 1);
        if (!element) return;

        const contents: vscode.MarkdownString[] = [];

        if (element.kind === 'symbol') {
          const { symbol } = element;

          contents.push(hoverMd(`**${prettyKind(symbol.kind)}**: \`${symbol.name}\``));
          if (symbol.namespacePath.length > 0) {
            contents.push(hoverMd(`Qualified: \`${symbol.qualifiedName}\``));
          }

          const node = symbol.node;
          if (node.kind === 'requirementDef') {
            if (node.reqId)    contents.push(hoverMd(`ID: \`${node.reqId}\``));
            if (node.text)     contents.push(hoverMd(`---\n${node.text}`));
            if (node.priority) contents.push(hoverMd(`Priority: \`${node.priority}\``));
          } else if (node.kind === 'partDef') {
            const ports = node.body.filter(c => c.kind === 'port') as
              Array<{ direction: string; name: string; portType: string }>;
            if (ports.length > 0) {
              const list = ports.map(p => `- \`${p.direction} ${p.name}: ${p.portType}\``).join('\n');
              contents.push(hoverMd(`---\n**Ports**:\n${list}`));
            }
          } else if (node.kind === 'occurrenceDef') {
            const parts = node.body.filter(c => c.kind === 'partAlias') as
              Array<{ name: string; type: string }>;
            const msgs  = node.body.filter(c => c.kind === 'message') as
              Array<{ name: string; from: string; to: string }>;
            if (parts.length > 0) {
              const list = parts.map(p => `- \`${p.name}: ${p.type}\``).join('\n');
              contents.push(hoverMd(`---\n**Participants**:\n${list}`));
            }
            if (msgs.length > 0) {
              const list = msgs.map(m => `- \`${m.name}\`: \`${m.from}\` → \`${m.to}\``).join('\n');
              contents.push(hoverMd(`---\n**Messages**:\n${list}`));
            }
          } else if (node.kind === 'behaviorDef') {
            const actions = node.body.filter(c => c.kind === 'actionInst') as
              Array<{ name: string; actionType: string }>;
            if (actions.length > 0) {
              const list = actions.map(a => `- \`${a.name}: ${a.actionType}\``).join('\n');
              contents.push(hoverMd(`---\n**Actions**:\n${list}`));
            }
          } else if (node.kind === 'stateDef') {
            const transitions = node.body.filter(c => c.kind === 'transition') as
              Array<{ from: string; to: string; event: string }>;
            if (transitions.length > 0) {
              const list = transitions
                .map(t => `- \`${t.from}\` → \`${t.to}\`${t.event ? ` on \`${t.event}\`` : ''}`)
                .join('\n');
              contents.push(hoverMd(`---\n**Transitions**:\n${list}`));
            }
          }
        } else {
          // element.kind === 'node' — body-level items
          const { node } = element;

          if (node.kind === 'port') {
            contents.push(hoverMd(`**port** \`${node.direction} ${node.name}: ${node.portType}\``));
            const def = getDefinitionForSymbol(analysis, element);
            if (def) contents.push(hoverMd(`Type: \`${def.qualifiedName}\``));
          } else if (node.kind === 'partAlias') {
            contents.push(hoverMd(`**part** \`${node.name}: ${node.type}\``));
            const def = getDefinitionForSymbol(analysis, element);
            if (def) contents.push(hoverMd(`Type: \`${def.qualifiedName}\``));
          } else if (node.kind === 'actionInst') {
            contents.push(hoverMd(`**action** \`${node.name}: ${node.actionType}\``));
          } else if (node.kind === 'message') {
            contents.push(hoverMd(`**message** \`${node.name}\``));
            contents.push(hoverMd(`From: \`${node.from}\`  →  To: \`${node.to}\``));
          } else if (node.kind === 'transition') {
            contents.push(hoverMd(`**transition** \`${node.from}\` → \`${node.to}\``));
            if (node.event) contents.push(hoverMd(`Event: \`${node.event}\``));
          } else if (node.kind === 'connection') {
            contents.push(hoverMd(
              `**connection** \`${node.fromPart}.${node.fromPort}\` → \`${node.toPart}.${node.toPort}\``,
            ));
          } else if (node.kind === 'flow') {
            contents.push(hoverMd(`**flow** \`${node.from}\` → \`${node.to}\``));
          } else if (node.kind === 'stateEntry') {
            contents.push(hoverMd(`**state** \`${node.name}\``));
          }
        }

        if (contents.length === 0) return;
        return new vscode.Hover(contents);
      },
    }),
  );

  // ── Completion provider ───────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: 'sysml' },
      {
        provideCompletionItems(document, position) {
          if (!document.fileName.endsWith('.sysml')) return [];
          const analysis  = analyzeSysML(document.getText());
          const lineText  = document.lineAt(position.line).text.substring(0, position.character);
          const items     = getCompletions(analysis, position.line + 1, lineText);

          return items.map(item => {
            const ci      = new vscode.CompletionItem(item.label, completionKind(item.kind));
            ci.insertText = item.insertText;
            if (item.detail) ci.detail = item.detail;
            return ci;
          });
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
        provideDocumentSemanticTokens(document) {
          if (!document.fileName.endsWith('.sysml')) return;
          try {
            const analysis  = analyzeSysML(document.getText());
            // Collected tokens: [0-based line, 0-based char, length, token-type-index]
            const collected: Array<[number, number, number, number]> = [];

            function lineAt(line1: number): string {
              const i = line1 - 1;
              return i >= 0 && i < document.lineCount ? document.lineAt(i).text : '';
            }

            function add(line1: number, col: number, len: number, tt: number): void {
              if (col < 0 || len <= 0) return;
              const lineIdx = line1 - 1;
              if (lineIdx < 0 || lineIdx >= document.lineCount) return;
              const lineLen = lineAt(line1).length;
              if (col >= lineLen) return;
              collected.push([lineIdx, col, Math.min(len, lineLen - col), tt]);
            }

            function addName(line1: number, name: string, tt: number): void {
              if (!name) return;
              add(line1, semWordCol(lineAt(line1), name), name.length, tt);
            }

            function addTypeRef(line1: number, typeName: string): void {
              if (!typeName) return;
              add(line1, semTypeCol(lineAt(line1), typeName), typeName.length, ST.type);
            }

            for (const node of analysis.model.nodes) {
              switch (node.kind) {
                case 'partDef':
                  addName(node.line, node.name, ST.class);
                  for (const c of node.body) {
                    if (c.kind === 'port') {
                      addName(c.line, c.name, ST.property);
                      addTypeRef(c.line, c.portType);
                    } else if (c.kind === 'partAlias') {
                      addName(c.line, c.name, ST.variable);
                      addTypeRef(c.line, c.type);
                    }
                  }
                  break;
                case 'interfaceDef':
                  addName(node.line, node.name, ST.interface);
                  break;
                case 'actionDef':
                  addName(node.line, node.name, ST.function);
                  break;
                case 'behaviorDef':
                  addName(node.line, node.name, ST.class);
                  for (const c of node.body) {
                    if (c.kind === 'actionInst') {
                      addName(c.line, c.name, ST.function);
                      addTypeRef(c.line, c.actionType);
                    }
                  }
                  break;
                case 'occurrenceDef':
                  addName(node.line, node.name, ST.class);
                  for (const c of node.body) {
                    if (c.kind === 'partAlias') {
                      addName(c.line, c.name, ST.variable);
                      addTypeRef(c.line, c.type);
                    } else if (c.kind === 'message') {
                      addName(c.line, c.name, ST.function);
                    }
                  }
                  break;
                case 'stateDef':
                  addName(node.line, node.name, ST.class);
                  break;
                case 'requirementDef': {
                  addName(node.line, node.name, ST.class);
                  // Highlight string literals inside requirement body
                  if (node.endLine !== undefined) {
                    for (let l = node.line + 1; l < node.endLine; l++) {
                      const lt = lineAt(l);
                      const eqIdx = lt.indexOf('=');
                      if (eqIdx < 0) continue;
                      const q1 = lt.indexOf('"', eqIdx);
                      if (q1 < 0) continue;
                      const q2  = lt.indexOf('"', q1 + 1);
                      const len = q2 >= 0 ? q2 - q1 + 1 : lt.length - q1;
                      add(l, q1, len, ST.string);
                    }
                  }
                  break;
                }
              }
            }

            // Fallback: highlight every 'part def' occurrence to verify provider is active
            for (let i = 0; i < document.lineCount; i++) {
              const lt  = document.lineAt(i).text;
              let   idx = lt.indexOf('part def');
              while (idx >= 0) {
                collected.push([i, idx, 8, ST.keyword]);
                idx = lt.indexOf('part def', idx + 1);
              }
            }

            // SemanticTokensBuilder requires tokens in ascending (line, char) order
            collected.sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);

            const builder = new vscode.SemanticTokensBuilder(SYSML_LEGEND);
            for (const [line, char, len, tt] of collected) {
              builder.push(line, char, len, tt, 0);
            }

            const result = builder.build();
            console.log(`[sysml-visualizer] semantic tokens: ${collected.length} tokens emitted`);
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
      prepareRename(document, position) {
        if (!document.fileName.endsWith('.sysml')) return;
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
        if (!wordRange) throw new Error('No renameable symbol at this position.');
        const word = document.getText(wordRange);
        if (SYSML_KEYWORDS.has(word)) throw new Error(`"${word}" is a keyword and cannot be renamed.`);
        const analysis = analyzeSysML(document.getText());
        // Accept if the word is a known top-level symbol name
        if (analysis.symbols.all().some(s => s.name === word)) {
          return { range: wordRange, placeholder: word };
        }
        // Accept if the word is the name of the body item at this line
        const element = getSymbolAtPosition(analysis, position.line + 1, position.character + 1);
        if (element?.kind === 'node') {
          const nodeName = (element.node as { name?: string }).name;
          if (nodeName === word) return { range: wordRange, placeholder: word };
        }
        throw new Error('No renameable symbol at this position.');
      },

      provideRenameEdits(document, position, newName) {
        if (!document.fileName.endsWith('.sysml')) return;
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(newName)) {
          throw new Error(`"${newName}" is not a valid SysML identifier.`);
        }
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
        if (!wordRange) return;
        const word = document.getText(wordRange);
        const analysis = analyzeSysML(document.getText());
        const wsEdit = new vscode.WorkspaceEdit();
        const linesToRename = new Set<number>();

        const sym = analysis.symbols.all().find(s => s.name === word);
        if (sym) {
          // Collision check: reject if any other symbol already has the new name
          if (analysis.symbols.all().some(s => s.name === newName)) {
            throw new Error(`A symbol named "${newName}" already exists.`);
          }
          linesToRename.add(sym.sourceLocation.line);
          for (const ref of getReferencesToSymbol(analysis, sym)) {
            linesToRename.add(ref.line);
          }
        } else {
          // Body-item rename (port, participant alias, action instance, …)
          const element = getSymbolAtPosition(analysis, position.line + 1, position.character + 1);
          if (!element || element.kind !== 'node') return;
          const nodeName = (element.node as { name?: string }).name;
          if (!nodeName || nodeName !== word) return;
          const line1 = (element.node as { line: number }).line;
          linesToRename.add(line1);
          for (const ref of getIntraBlockReferences(analysis, line1)) {
            linesToRename.add(ref.line);
          }
        }

        for (const line1 of linesToRename) {
          addRenameEdits(wsEdit, document, line1, word, newName);
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
      provideDocumentSymbols(document) {
        if (!document.fileName.endsWith('.sysml')) return [];
        try {
          const analysis = analyzeSysML(document.getText());
          const result: vscode.DocumentSymbol[] = [];

          // Top-level packages (preserves nesting via body)
          for (const pkg of analysis.model.packages) {
            const sym = sysmlNodeToDocSymbol(document, pkg);
            if (sym) result.push(sym);
          }

          // Top-level non-package declarations (namespace === '')
          for (const node of analysis.model.nodes) {
            const ns = (node as { namespace?: string }).namespace;
            if (ns !== '') continue;
            const sym = sysmlNodeToDocSymbol(document, node);
            if (sym) result.push(sym);
          }

          return result;
        } catch {
          return [];
        }
      },
    }),
  );

  // ── Debug semantic tokens command ─────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('sysmlVisualizer.debugSemanticTokens', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !editor.document.fileName.endsWith('.sysml')) {
        vscode.window.showWarningMessage('SysML: open a .sysml file first');
        return;
      }
      const document = editor.document;
      const analysis = analyzeSysML(document.getText());

      // Re-run the same collection logic to count tokens
      let tokenCount = 0;
      for (const node of analysis.model.nodes) {
        tokenCount++; // declaration name
        if ('body' in node) {
          tokenCount += (node as { body: unknown[] }).body.length * 2; // name + type ref (upper bound)
        }
      }
      // Count fallback 'part def' tokens
      for (let i = 0; i < document.lineCount; i++) {
        let idx = document.lineAt(i).text.indexOf('part def');
        while (idx >= 0) {
          tokenCount++;
          idx = document.lineAt(i).text.indexOf('part def', idx + 1);
        }
      }

      const lines = [
        `Language ID : ${document.languageId}`,
        `File        : ${path.basename(document.fileName)}`,
        `Line count  : ${document.lineCount}`,
        `Symbols     : ${analysis.symbols.all().length}`,
        `Model nodes : ${analysis.model.nodes.length}`,
        `Token est.  : ~${tokenCount}`,
        `Diagnostics : ${analysis.diagnostics.length}`,
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

// ── Rename helpers ────────────────────────────────────────────────────────────

/** Return the 0-based column of every whole-word occurrence of `word` in `lineText`. */
function findAllWordOccurrences(lineText: string, word: string): number[] {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re  = new RegExp(`\\b${esc}\\b`, 'g');
  const cols: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(lineText)) !== null) cols.push(m.index);
  return cols;
}

/** Add a replace edit for every whole-word occurrence of `oldName` on `line1` (1-based). */
function addRenameEdits(
  wsEdit: vscode.WorkspaceEdit,
  document: vscode.TextDocument,
  line1: number,
  oldName: string,
  newName: string,
): void {
  const lineIdx  = line1 - 1;
  if (lineIdx < 0 || lineIdx >= document.lineCount) return;
  const lineText = document.lineAt(lineIdx).text;
  for (const col of findAllWordOccurrences(lineText, oldName)) {
    wsEdit.replace(document.uri, new vscode.Range(lineIdx, col, lineIdx, col + oldName.length), newName);
  }
}

// ── Document symbol helper ────────────────────────────────────────────────────

/**
 * Convert a SysMLNode to a VS Code DocumentSymbol (with children for block nodes).
 * Returns null for node kinds that should be omitted from the outline.
 */
function sysmlNodeToDocSymbol(document: vscode.TextDocument, node: SysMLNode): vscode.DocumentSymbol | null {
  try {
    const lc = document.lineCount;

    function blockRange(line1: number, endLine1?: number): vscode.Range {
      const s = Math.max(0, Math.min(line1 - 1, lc - 1));
      const e = Math.max(s, Math.min((endLine1 ?? line1) - 1, lc - 1));
      return new vscode.Range(s, 0, e, document.lineAt(e).text.length);
    }

    function nameSelRange(line1: number, name: string): vscode.Range {
      const l    = Math.max(0, Math.min(line1 - 1, lc - 1));
      const text = document.lineAt(l).text;
      const col  = semWordCol(text, name);
      if (col < 0) return new vscode.Range(l, 0, l, text.length);
      return new vscode.Range(l, col, l, Math.min(col + name.length, text.length));
    }

    function fullLineRange(line1: number): vscode.Range {
      const l = Math.max(0, Math.min(line1 - 1, lc - 1));
      return new vscode.Range(l, 0, l, document.lineAt(l).text.length);
    }

    function children(body: SysMLNode[]): vscode.DocumentSymbol[] {
      return body.flatMap(c => { const s = sysmlNodeToDocSymbol(document, c); return s ? [s] : []; });
    }

    switch (node.kind) {
      case 'packageDef': {
        const sym = new vscode.DocumentSymbol(node.name, 'package', vscode.SymbolKind.Package,
          blockRange(node.line, node.endLine), nameSelRange(node.line, node.name));
        sym.children = children(node.body);
        return sym;
      }
      case 'partDef': {
        const sym = new vscode.DocumentSymbol(node.name, 'part def', vscode.SymbolKind.Class,
          blockRange(node.line, node.endLine), nameSelRange(node.line, node.name));
        sym.children = children(node.body);
        return sym;
      }
      case 'interfaceDef':
        return new vscode.DocumentSymbol(node.name, 'interface def', vscode.SymbolKind.Interface,
          blockRange(node.line), nameSelRange(node.line, node.name));
      case 'actionDef':
        return new vscode.DocumentSymbol(node.name, 'action def', vscode.SymbolKind.Function,
          blockRange(node.line), nameSelRange(node.line, node.name));
      case 'behaviorDef': {
        const sym = new vscode.DocumentSymbol(node.name, 'behavior def', vscode.SymbolKind.Function,
          blockRange(node.line, node.endLine), nameSelRange(node.line, node.name));
        sym.children = children(node.body);
        return sym;
      }
      case 'occurrenceDef': {
        const sym = new vscode.DocumentSymbol(node.name, 'occurrence def', vscode.SymbolKind.Event,
          blockRange(node.line, node.endLine), nameSelRange(node.line, node.name));
        sym.children = children(node.body);
        return sym;
      }
      case 'stateDef': {
        const sym = new vscode.DocumentSymbol(node.name, 'state def', vscode.SymbolKind.Enum,
          blockRange(node.line, node.endLine), nameSelRange(node.line, node.name));
        sym.children = children(node.body);
        return sym;
      }
      case 'requirementDef': {
        const detail = [node.reqId && `id: ${node.reqId}`, node.priority && `priority: ${node.priority}`]
          .filter(Boolean).join(' · ') || 'requirement def';
        return new vscode.DocumentSymbol(node.name, detail, vscode.SymbolKind.String,
          blockRange(node.line, node.endLine), nameSelRange(node.line, node.name));
      }
      // Body-only items (ports, participants, messages, …)
      case 'port':
        return new vscode.DocumentSymbol(node.name, `${node.direction} : ${node.portType}`,
          vscode.SymbolKind.Property, blockRange(node.line), nameSelRange(node.line, node.name));
      case 'partAlias':
        return new vscode.DocumentSymbol(node.name, `: ${node.type}`,
          vscode.SymbolKind.Field, blockRange(node.line), nameSelRange(node.line, node.name));
      case 'message':
        return new vscode.DocumentSymbol(node.name, `${node.from} → ${node.to}`,
          vscode.SymbolKind.Method, blockRange(node.line), nameSelRange(node.line, node.name));
      case 'actionInst':
        return new vscode.DocumentSymbol(node.name, `: ${node.actionType}`,
          vscode.SymbolKind.Method, blockRange(node.line), nameSelRange(node.line, node.name));
      case 'stateEntry':
        return new vscode.DocumentSymbol(node.name, 'state',
          vscode.SymbolKind.EnumMember, blockRange(node.line), nameSelRange(node.line, node.name));
      case 'transition': {
        const label = `${node.from} → ${node.to}${node.event ? ` on ${node.event}` : ''}`;
        const r = fullLineRange(node.line);
        return new vscode.DocumentSymbol(label || 'transition', 'transition',
          vscode.SymbolKind.EnumMember, r, r);
      }
      case 'flow': {
        const label = `${node.from} → ${node.to}`;
        const r = fullLineRange(node.line);
        return new vscode.DocumentSymbol(label || 'flow', 'flow',
          vscode.SymbolKind.Constant, r, r);
      }
      case 'traceLink': {
        const label = `${node.linkType}: ${node.source} → ${node.target}`;
        const r = fullLineRange(node.line);
        return new vscode.DocumentSymbol(label || node.linkType, node.linkType,
          vscode.SymbolKind.TypeParameter, r, r);
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
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

// ── Semantic token helpers ────────────────────────────────────────────────────

/** Find the column of the first whole-word occurrence of `word` in `lineText`. */
function semWordCol(lineText: string, word: string): number {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m   = new RegExp(`\\b${esc}\\b`).exec(lineText);
  return m ? m.index : -1;
}

/**
 * Find the column of `typeName` in `lineText` after the first `:`.
 * Handles qualified names (e.g. `Pkg::Signal`) via literal indexOf.
 */
function semTypeCol(lineText: string, typeName: string): number {
  const colon = lineText.indexOf(':');
  const start = colon >= 0 ? colon + 1 : 0;
  return lineText.indexOf(typeName, start);
}

function completionKind(kind: SysMLCompletion['kind']): vscode.CompletionItemKind {
  switch (kind) {
    case 'keyword':     return vscode.CompletionItemKind.Keyword;
    case 'interface':   return vscode.CompletionItemKind.Interface;
    case 'part':        return vscode.CompletionItemKind.Class;
    case 'action':      return vscode.CompletionItemKind.Function;
    case 'requirement': return vscode.CompletionItemKind.Module;
    case 'participant': return vscode.CompletionItemKind.Variable;
  }
}

function hoverMd(text: string): vscode.MarkdownString {
  return new vscode.MarkdownString(text);
}

// 'partDef' → 'part def', 'requirementDef' → 'requirement def', etc.
function prettyKind(kind: string): string {
  return kind.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
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
