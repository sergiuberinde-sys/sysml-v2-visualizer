import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const cmd = vscode.commands.registerCommand('sysmlVisualizer.openVisualizer', () => {
    const panel = vscode.window.createWebviewPanel(
      'sysmlVisualizer',
      'SysML v2 Visualizer',
      vscode.ViewColumn.One,
      {},
    );
    panel.webview.html = getWebviewContent();
  });
  context.subscriptions.push(cmd);
}

export function deactivate(): void {}

function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SysML v2 Visualizer</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #1e1e1e; color: #d4d4d4; }
    h1   { color: #569cd6; }
  </style>
</head>
<body>
  <h1>SysML v2 Visualizer Webview</h1>
  <p>Extension shell active. React app will be embedded here in a future milestone.</p>
</body>
</html>`;
}
