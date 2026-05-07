import type { ParseResult } from '../../core/modelTypes';


export default function JsonView({ result }: { result: ParseResult }) {
  return (
    <pre style={{ margin: 0, padding: 16, fontSize: 13, overflow: 'auto', color: '#a6e3a1' }}>
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}
