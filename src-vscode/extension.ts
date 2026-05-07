import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext): void {
  const cmd = vscode.commands.registerCommand('sysmlVisualizer.openVisualizer', () => {
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

    // Flag to suppress re-echo of our own applyEdit back to the webview
    let applyingEdit = false;

    const disposables: vscode.Disposable[] = [];

    // ── Webview → extension messages ─────────────────────────────────────────

    panel.webview.onDidReceiveMessage(async (msg: { type: string; text?: string }) => {
      if (msg.type === 'ready') {
        // Webview has mounted — send initial model or "no file" signal
        sendCurrentFile(panel.webview);

      } else if (msg.type === 'modelEdit' && typeof msg.text === 'string') {
        // User edited in the webview — apply changes to the VS Code document
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isSysml(editor.document)) return;
        const doc = editor.document;
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length),
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(doc.uri, fullRange, msg.text);
        applyingEdit = true;
        await vscode.workspace.applyEdit(edit);
        applyingEdit = false;
      }
    }, undefined, disposables);

    // ── VS Code document changes → webview ───────────────────────────────────

    vscode.workspace.onDidChangeTextDocument(e => {
      if (applyingEdit) return;
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document && isSysml(e.document)) {
        panel.webview.postMessage({ type: 'updateModel', text: e.document.getText() });
      }
    }, undefined, disposables);

    // ── Active editor switches → reload ──────────────────────────────────────

    vscode.window.onDidChangeActiveTextEditor(_editor => {
      sendCurrentFile(panel.webview);
    }, undefined, disposables);

    // Dispose listeners when the panel is closed
    panel.onDidDispose(() => {
      disposables.forEach(d => d.dispose());
    });
  });

  context.subscriptions.push(cmd);
}

export function deactivate(): void {}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSysml(doc: vscode.TextDocument): boolean {
  return doc.fileName.endsWith('.sysml');
}

function sendCurrentFile(webview: vscode.Webview): void {
  const editor = vscode.window.activeTextEditor;
  if (editor && isSysml(editor.document)) {
    webview.postMessage({ type: 'loadModel', text: editor.document.getText() });
  } else {
    webview.postMessage({ type: 'noFile' });
  }
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
