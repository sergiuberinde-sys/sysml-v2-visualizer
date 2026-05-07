// VS Code webview API bridge.
// acquireVsCodeApi() is injected by VS Code into the webview page.
// It must be called exactly once per webview session — we do it here at
// module load time so the result is cached for the entire page lifetime.

declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (message: unknown) => void;
    };
  }
}

interface VsCodeApi {
  postMessage(message: unknown): void;
}

// Acquired once.  undefined when running as a plain web app.
const _api: VsCodeApi | undefined =
  typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function'
    ? window.acquireVsCodeApi()
    : undefined;

export function getVsCodeApi(): VsCodeApi | undefined {
  return _api;
}

// Stable for the page lifetime — derived from the single acquisition above.
export function getAppMode(): 'standalone' | 'vscode' {
  return _api !== undefined ? 'vscode' : 'standalone';
}
