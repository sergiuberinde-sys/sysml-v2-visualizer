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

    panel.webview.onDidReceiveMessage(async (msg: { type: string; text?: string }) => {
      if (msg.type === 'ready') {
        // Webview has mounted — send current model or empty state
        console.log('[sysml-visualizer] webview ready — sending current model state');
        sendCurrentModelToWebview();

      } else if (msg.type === 'modelEdit' && typeof msg.text === 'string') {
        // User made a UI-driven edit in the webview — write it to the tracked document
        if (!currentSysmlUri) {
          console.log('[sysml-visualizer] modelEdit received but no sysml file tracked — ignoring');
          return;
        }
        console.log('[sysml-visualizer] received modelEdit — applying to tracked document');
        const doc = await vscode.workspace.openTextDocument(currentSysmlUri);
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length),
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(currentSysmlUri, fullRange, msg.text);
        applyingEdit = true;
        await vscode.workspace.applyEdit(edit);
        applyingEdit = false;
        currentSysmlText = msg.text;
      }
    }, undefined, disposables);

    // ── VS Code document changes → webview ───────────────────────────────────

    vscode.workspace.onDidChangeTextDocument(e => {
      if (applyingEdit) return;
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
