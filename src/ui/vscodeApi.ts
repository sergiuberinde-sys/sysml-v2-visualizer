// VS Code webview API bridge.
// acquireVsCodeApi() is injected by VS Code into the webview page.
// Returns null when running as a standalone web app.

interface VsCodeApi {
  postMessage(message: unknown): void;
}

let _api: VsCodeApi | null = null;

export function getVsCodeApi(): VsCodeApi | null {
  if (_api) return _api;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acquire = (window as any).acquireVsCodeApi;
  if (typeof acquire === 'function') {
    _api = acquire() as VsCodeApi;
  }
  return _api;
}
