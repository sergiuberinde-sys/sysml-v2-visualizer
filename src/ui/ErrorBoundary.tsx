import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          color: '#f38ba8',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <strong style={{ fontSize: 14 }}>
            {this.props.label ?? 'Render error'} — {error.message}
          </strong>
          <pre style={{ fontSize: 12, margin: 0, color: '#a6adc8', whiteSpace: 'pre-wrap' }}>
            {error.stack?.split('\n').slice(1, 4).join('\n')}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              alignSelf: 'flex-start',
              background: '#313244',
              border: '1px solid #585b70',
              color: '#cdd6f4',
              borderRadius: 6,
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
