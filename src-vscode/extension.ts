import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseAndValidate } from '../src/core/modelBuilder';

export function activate(context: vscode.ExtensionContext): void {
  // Persists the last .sysml document shown in the visualizer.
  // Tracked at activate-scope so it survives focus changes and non-sysml editor switches.
  let currentSysmlUri: vscode.Uri | undefined;
  let currentSysmlText: string | undefined;

  // Publishes parser diagnostics to VS Code's native Problems panel.
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('sysml-v2');
  context.subscriptions.push(diagnosticCollection);

  // ── Diagnostic helpers ────────────────────────────────────────────────────────

  function toVsCodeRange(
    document: vscode.TextDocument,
    line?: number,
    column?: number,
  ): vscode.Range {
    const lineIndex = Math.min(Math.max((line ?? 1) - 1, 0), document.lineCount - 1);
    const textLine  = document.lineAt(lineIndex);
    const startCol  = Math.min(Math.max((column ?? 1) - 1, 0), textLine.text.length);
    const endCol    = Math.min(Math.max(startCol + 1, textLine.text.length), textLine.text.length);
    return new vscode.Range(lineIndex, startCol, lineIndex, endCol);
  }

  function updateDiagnosticsForDocument(document: vscode.TextDocument): void {
    if (!document.fileName.endsWith('.sysml')) return;
    const result = parseAndValidate(document.getText());
    const vscodeDiags = result.diagnostics.map(d => {
      const range    = toVsCodeRange(document, d.line);
      const severity =
        d.severity === 'error'   ? vscode.DiagnosticSeverity.Error   :
        d.severity === 'warning' ? vscode.DiagnosticSeverity.Warning :
                                   vscode.DiagnosticSeverity.Information;
      const diag = new vscode.Diagnostic(range, d.message, severity);
      diag.source = 'SysML v2 Visualizer';
      if (d.code) diag.code = d.code;
      console.log(
        `[sysml-visualizer] diag ${d.code} L${d.line}` +
        ` → range [${range.start.line},${range.start.character}]-[${range.end.line},${range.end.character}]`,
      );
      return diag;
    });
    diagnosticCollection.set(document.uri, vscodeDiags);
    console.log(
      `[sysml-visualizer] published ${vscodeDiags.length} diagnostics` +
      ` for ${path.basename(document.fileName)}`,
    );
  }

  // ── Activation-level listeners ────────────────────────────────────────────────
  // These fire regardless of whether the visualizer panel is open.

  // Diagnose any .sysml files already open when the extension activates.
  for (const doc of vscode.workspace.textDocuments) {
    updateDiagnosticsForDocument(doc);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(updateDiagnosticsForDocument),
    vscode.workspace.onDidChangeTextDocument(e => updateDiagnosticsForDocument(e.document)),
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
      const editor     = vscode.window.activeTextEditor;
      const activeUri  = editor?.document.uri.toString() ?? '(none)';
      const trackedUri = currentSysmlUri?.toString() ?? '(none)';
      const diags      = currentSysmlUri ? (diagnosticCollection.get(currentSysmlUri) ?? []) : [];
      const first      = diags[0];

      const lines = [
        `Active document URI : ${activeUri}`,
        `currentSysmlUri     : ${trackedUri}`,
        `Diagnostic count    : ${diags.length}`,
        `First range         : ${first
          ? `[${first.range.start.line},${first.range.start.character}]-[${first.range.end.line},${first.range.end.character}]`
          : '(none)'}`,
        `First message       : ${first?.message ?? '(none)'}`,
      ];
      const info = lines.join('\n');
      vscode.window.showInformationMessage(info);
      console.log('[sysml-visualizer] debugDiagnostics:\n' + info);
    }),
  );

  // ── Visualizer panel command ──────────────────────────────────────────────────

  const cmd = vscode.commands.registerCommand('sysmlVisualizer.openVisualizer', () => {
    // Snapshot the active sysml file BEFORE opening the panel.
    // Creating a webview panel can steal editor focus and clear activeTextEditor.
    const preLaunchSysml = getActiveSysmlEditor();
    if (preLaunchSysml) {
      currentSysmlUri  = preLaunchSysml.document.uri;
      currentSysmlText = preLaunchSysml.document.getText();
      console.log(`[sysml-visualizer] captured initial sysml file: ${path.basename(preLaunchSysml.document.fileName)}`);
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

    const disposables: vscode.Disposable[] = [];

    // ── Editor → webview cursor sync ──────────────────────────────────────────
    // Suppressed for 150 ms after we move the cursor ourselves (via revealSource)
    // to prevent the echo-loop: visualizer→revealSource→cursor→revealElementAtSource→loop.
    let editorSyncSuppressed = false;
    let editorSyncSuppressTimer: ReturnType<typeof setTimeout> | undefined;
    let editorSyncDebounce:      ReturnType<typeof setTimeout> | undefined;

    function suppressEditorSync(): void {
      editorSyncSuppressed = true;
      if (editorSyncSuppressTimer) clearTimeout(editorSyncSuppressTimer);
      editorSyncSuppressTimer = setTimeout(() => { editorSyncSuppressed = false; }, 150);
    }

    // Send the persisted sysml model to the webview — never reads activeTextEditor
    // so clicking inside the webview cannot change what is displayed.
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
    }) => {
      console.log(`[sysml-visualizer] received webview message: ${msg.type}`);

      if (msg.type === 'ready') {
        sendCurrentModelToWebview();

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
        console.log('[sysml-visualizer] applyFullTextEdit succeeded — waiting for onDidChangeTextDocument');

      } else if (msg.type === 'applyIncrementalEdit') {
        if (!currentSysmlUri || !msg.edit) {
          vscode.window.showErrorMessage('SysML Visualizer: no SysML file is loaded');
          return;
        }
        const ie = msg.edit;
        // Positions from webview are 1-based; VS Code expects 0-based.
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
        console.log(`[sysml-visualizer] applyIncrementalEdit (${ie.kind}) succeeded`);

      } else if (msg.type === 'revealSource') {
        if (!currentSysmlUri || !msg.sourceLocation) return;
        const { line, column } = msg.sourceLocation;
        // Suppress the cursor-change event that our cursor move will generate
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
      }
    }, undefined, disposables);

    // ── VS Code document changes → webview ───────────────────────────────────
    // Handles both direct user edits in VS Code AND changes applied via applyEdit.
    // The echo-loop is prevented on the React side via fromExtension.current.
    // Diagnostics are handled by the activation-level onDidChangeTextDocument.

    vscode.workspace.onDidChangeTextDocument(e => {
      if (currentSysmlUri && e.document.uri.toString() === currentSysmlUri.toString()) {
        currentSysmlText = e.document.getText();
        console.log('[sysml-visualizer] document changed — sending updateModel to webview');
        panel.webview.postMessage({ type: 'updateModel', text: currentSysmlText });
      }
    }, undefined, disposables);

    // ── VS Code cursor → webview selection ───────────────────────────────────
    // Debounced 100 ms so rapid typing/scrolling doesn't flood the webview.

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

    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor === undefined) {
        // The webview panel (or another non-editor widget) gained focus.
        // This is not a real file switch — keep showing the current model.
        console.log('[sysml-visualizer] active editor undefined (webview focused?) — keeping current model');
        return;
      }

      if (isSysml(editor.document)) {
        // Switched to a (possibly different) sysml file — update tracking and reload.
        currentSysmlUri  = editor.document.uri;
        currentSysmlText = editor.document.getText();
        console.log(`[sysml-visualizer] loading sysml file: ${path.basename(editor.document.fileName)}`);
        panel.webview.postMessage({
          type: 'loadModel',
          text: currentSysmlText,
          fileName: path.basename(editor.document.fileName),
        });
      } else {
        // Switched to a non-sysml file — keep showing the last sysml model
        console.log(`[sysml-visualizer] non-sysml editor active — keeping current model`);
      }
    }, undefined, disposables);

    // Dispose panel-scoped listeners and timers when the panel is closed.
    // The diagnostic collection stays alive (managed by context.subscriptions).
    panel.onDidDispose(() => {
      disposables.forEach(d => d.dispose());
      if (editorSyncSuppressTimer) clearTimeout(editorSyncSuppressTimer);
      if (editorSyncDebounce) clearTimeout(editorSyncDebounce);
    });
  });

  context.subscriptions.push(cmd);
}

export function deactivate(): void {}

// ── Module-level helpers ──────────────────────────────────────────────────────

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

  // Convert Vite's relative "./" asset paths to vscode-resource:// webview URIs
  const distWebviewUri = webview.asWebviewUri(distUri).toString();
  html = html.replace(/(src|href)="\.\//g, `$1="${distWebviewUri}/`);

  // Remove crossorigin — causes fetch failures on the vscode-resource:// scheme
  html = html.replace(/ crossorigin/g, '');

  // Inject Content Security Policy
  // unsafe-eval: required by Monaco Editor
  // blob: in script-src and worker-src: required for Monaco web workers
  const csp = [
    `default-src 'none'`,
    `script-src ${webview.cspSource} 'unsafe-eval' blob:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `worker-src blob:`,
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource} data:`,
  ].join('; ');

  html = html.replace(
    '<meta charset="UTF-8" />',
    `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
  );

  return html;
}
