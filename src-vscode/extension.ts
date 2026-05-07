import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext): void {
  // Persists the last .sysml document shown in the visualizer.
  // Tracked at activate-scope so it survives focus changes and non-sysml editor switches.
  let currentSysmlUri: vscode.Uri | undefined;
  let currentSysmlText: string | undefined;

  // Publishes parser diagnostics to VS Code's native Problems panel.
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('sysml-v2');
  context.subscriptions.push(diagnosticCollection);

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
        diagnosticCollection.clear();
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
      diagnostics?: Array<{
        line: number;
        column?: number;
        severity: string;
        message: string;
        code?: string;
      }>;
      sourceLocation?: { line: number; column: number };
    }) => {
      console.log(`[sysml-visualizer] received webview message: ${msg.type}`);

      if (msg.type === 'ready') {
        sendCurrentModelToWebview();

      } else if (msg.type === 'diagnosticsUpdate') {
        if (!currentSysmlUri || !msg.diagnostics) return;
        const doc = await vscode.workspace.openTextDocument(currentSysmlUri);
        const vscodeDiags = msg.diagnostics.map(d => {
          // Parser locations are 1-based; VS Code positions are 0-based.
          const lineIndex = Math.min(Math.max(0, d.line - 1), doc.lineCount - 1);
          const lineObj   = doc.lineAt(lineIndex);
          const startCol  = d.column ? Math.max(0, d.column - 1) : 0;
          const endCol    = Math.max(startCol + 1, lineObj.text.length);
          const range     = new vscode.Range(lineIndex, startCol, lineIndex, endCol);

          const severity =
            d.severity === 'error'   ? vscode.DiagnosticSeverity.Error :
            d.severity === 'warning' ? vscode.DiagnosticSeverity.Warning :
                                       vscode.DiagnosticSeverity.Information;
          const diag = new vscode.Diagnostic(range, d.message, severity);
          diag.source = 'SysML v2 Visualizer';
          if (d.code) diag.code = d.code;
          console.log(`[sysml-visualizer] diag ${d.code} L${d.line} → range [${lineIndex},${startCol}]-[${lineIndex},${endCol}]`);
          return diag;
        });
        diagnosticCollection.set(currentSysmlUri, vscodeDiags);
        console.log(`[sysml-visualizer] published ${vscodeDiags.length} diagnostics for ${path.basename(currentSysmlUri.fsPath)}`);

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
        // Clear stale diagnostics from the previous file before fresh ones arrive.
        diagnosticCollection.clear();
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

    // ── Document close → clear diagnostics ───────────────────────────────────

    vscode.workspace.onDidCloseTextDocument(doc => {
      if (currentSysmlUri && doc.uri.toString() === currentSysmlUri.toString()) {
        diagnosticCollection.clear();
        console.log('[sysml-visualizer] tracked document closed — cleared diagnostics');
      }
    }, undefined, disposables);

    // Dispose listeners, timers, and diagnostics when the panel is closed
    panel.onDidDispose(() => {
      disposables.forEach(d => d.dispose());
      if (editorSyncSuppressTimer) clearTimeout(editorSyncSuppressTimer);
      if (editorSyncDebounce) clearTimeout(editorSyncDebounce);
      diagnosticCollection.clear();
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
