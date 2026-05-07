import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext): void {
  const cmd = vscode.commands.registerCommand('sysmlVisualizer.openVisualizer', () => {
    const panel = vscode.window.createWebviewPanel(
      'sysmlVisualizer',
      'SysML v2 Visualizer',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        // Restrict webview to only load resources from the dist folder
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
        retainContextWhenHidden: true,
      },
    );
    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
  });
  context.subscriptions.push(cmd);
}

export function deactivate(): void {}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const distUri = vscode.Uri.joinPath(extensionUri, 'dist');
  const indexPath = path.join(distUri.fsPath, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  // Convert Vite's relative "./" asset paths to vscode-resource:// webview URIs.
  // Vite outputs: src="./assets/..." and href="./assets/..." (and ./favicon.svg etc.)
  const distWebviewUri = webview.asWebviewUri(distUri).toString();
  html = html.replace(/(src|href)="\.\//g, `$1="${distWebviewUri}/`);

  // Remove "crossorigin" attribute — module scripts loaded from vscode-resource://
  // do not go through CORS, so the attribute causes fetch failures.
  html = html.replace(/ crossorigin/g, '');

  // Inject Content Security Policy.
  // 'unsafe-eval' is required by Monaco Editor.
  // blob: in script-src and worker-src is required for Monaco web workers.
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
