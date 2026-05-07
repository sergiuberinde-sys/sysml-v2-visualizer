import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext): void {
  // Persists the last .sysml document shown in the visualizer.
  // Tracked at activate-scope so it survives focus changes and non-sysml editor switches.
  let currentSysmlUri: vscode.Uri | undefined;
  let currentSysmlText: string | undefined;

  const cmd = vscode.commands.registerCommand('sysmlVisualizer.openVisualizer', () => {
    // Snapshot the active sysml file BEFORE opening the panel.
    // Creating a webview panel can steal editor focus and clear activeTextEditor.
    const preLaunchSysml = getActiveSysmlEditor();
    if (preLaunchSysml) {
      currentSysmlUri  = preLaunchSysml.document.uri;
      currentSysmlText = preLaunchSysml.document.getText();
      console.log(`[sysml-visualizer] captured initial sysml file: ${path.basename(preLaunchSysml.document.fileName)}`);
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

    // Prevents echoing our own applyEdit back to the webview as an updateModel
    let applyingEdit = false;

    const disposables: vscode.Disposable[] = [];

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
      text?: string;
      newText?: string;
      textToAppend?: string;
    }) => {
      // Log every incoming message for diagnostics
      console.log('[sysml-visualizer] received webview message', JSON.stringify(msg));

      if (msg.type === 'ready') {
        // Webview has mounted — send current model or empty state
        sendCurrentModelToWebview();

      } else if (msg.type === 'testEdit') {
        // ── Phase 1 diagnostic: append a comment to verify the edit pipeline ──
        if (!currentSysmlUri) {
          vscode.window.showErrorMessage('[sysml-visualizer] testEdit: no SysML file is loaded');
          return;
        }
        const textToAppend = typeof msg.textToAppend === 'string'
          ? msg.textToAppend
          : '\n// Test edit from webview';
        console.log(`[sysml-visualizer] testEdit — appending to ${path.basename(currentSysmlUri.fsPath)}`);
        const doc = await vscode.workspace.openTextDocument(currentSysmlUri);
        const endPos = doc.positionAt(doc.getText().length);
        const appendEdit = new vscode.WorkspaceEdit();
        appendEdit.insert(currentSysmlUri, endPos, textToAppend);
        applyingEdit = true;
        const ok = await vscode.workspace.applyEdit(appendEdit);
        applyingEdit = false;
        if (!ok) {
          vscode.window.showErrorMessage('[sysml-visualizer] testEdit: WorkspaceEdit failed');
          return;
        }
        currentSysmlText = (await vscode.workspace.openTextDocument(currentSysmlUri)).getText();
        console.log('[sysml-visualizer] testEdit succeeded');

      } else if (msg.type === 'applyEdit') {
        // ── Phase 2: replace full document with new text from a UI action ──
        if (!currentSysmlUri) {
          vscode.window.showErrorMessage('[sysml-visualizer] applyEdit: no SysML file is loaded');
          return;
        }
        if (typeof msg.newText !== 'string' || msg.newText === '') {
          vscode.window.showErrorMessage('[sysml-visualizer] applyEdit: newText is missing or empty');
          return;
        }
        console.log(`[sysml-visualizer] applyEdit — replacing ${path.basename(currentSysmlUri.fsPath)}`);
        const doc = await vscode.workspace.openTextDocument(currentSysmlUri);
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length),
        );
        const replaceEdit = new vscode.WorkspaceEdit();
        replaceEdit.replace(currentSysmlUri, fullRange, msg.newText);
        applyingEdit = true;
        const ok = await vscode.workspace.applyEdit(replaceEdit);
        applyingEdit = false;
        if (!ok) {
          vscode.window.showErrorMessage('[sysml-visualizer] applyEdit: WorkspaceEdit failed');
          return;
        }
        currentSysmlText = msg.newText;
        // Send updateModel so the webview re-renders from the saved text.
        // onDidChangeTextDocument is suppressed via the applyingEdit flag for sync events.
        panel.webview.postMessage({ type: 'updateModel', text: msg.newText });
        console.log('[sysml-visualizer] applyEdit succeeded');
      }
    }, undefined, disposables);

    // ── VS Code document changes → webview ───────────────────────────────────

    vscode.workspace.onDidChangeTextDocument(e => {
      if (applyingEdit) {
        // This change was caused by our own applyEdit.  Suppress the echo — the
        // applyEdit handler already sent updateModel explicitly.
        applyingEdit = false;
        return;
      }
      // Only forward changes for the document we are currently tracking
      if (currentSysmlUri && e.document.uri.toString() === currentSysmlUri.toString()) {
        currentSysmlText = e.document.getText();
        console.log('[sysml-visualizer] document changed — sending updateModel to webview');
        panel.webview.postMessage({ type: 'updateModel', text: currentSysmlText });
      }
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
        // Switched to a (possibly different) sysml file — update tracking and reload
        currentSysmlUri  = editor.document.uri;
        currentSysmlText = editor.document.getText();
        console.log(`[sysml-visualizer] loading sysml file: ${path.basename(editor.document.fileName)}`);
        panel.webview.postMessage({
          type: 'loadModel',
          text: currentSysmlText,
          fileName: path.basename(editor.document.fileName),
        });
      } else {
        // Switched to a non-sysml file (e.g. JSON, Markdown) — do NOT clear the
        // visualizer; the user may want to cross-reference the sysml model.
        console.log(`[sysml-visualizer] non-sysml editor active (${path.basename(editor.document.fileName)}) — keeping current model`);
      }
    }, undefined, disposables);

    // Dispose listeners when the panel is closed
    panel.onDidDispose(() => {
      disposables.forEach(d => d.dispose());
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
