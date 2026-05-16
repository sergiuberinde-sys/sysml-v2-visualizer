import type { VisualizerModel } from '../../core/visualizerModel';

export default function JsonView({ result }: { result: VisualizerModel }) {
  return (
    <pre style={{ margin: 0, padding: 16, fontSize: 13, overflow: 'auto', color: '#a6e3a1' }}>
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}
