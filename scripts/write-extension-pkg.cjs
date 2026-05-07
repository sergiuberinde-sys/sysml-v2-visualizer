// Writes out-extension/package.json to override the root "type":"module" so that
// VS Code can load the compiled CommonJS extension entry point correctly.
require('fs').writeFileSync(
  'out-extension/package.json',
  JSON.stringify({ type: 'commonjs' }),
);
