import { useEffect, useRef } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';

interface FitPanelProps {
  /** Increment to trigger an automatic fitView (e.g. after async layout). */
  autoFitVersion?: number;
  padding?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  /** When provided, shows a Reset button that calls this then fits. */
  onReset?: () => void;
}

const BTN: React.CSSProperties = {
  background:   '#111827',
  border:       '1px solid #2a2a3a',
  color:        '#9ca3af',
  borderRadius: 4,
  padding:      '3px 9px',
  cursor:       'pointer',
  fontSize:     11,
};

export function FitPanel({
  autoFitVersion,
  padding = 0.18,
  position = 'top-right',
  onReset,
}: FitPanelProps) {
  const { fitView } = useReactFlow();
  const prev = useRef<number>(-1);

  // Auto-fit when the parent signals a layout change (e.g. after async ELK).
  useEffect(() => {
    if (autoFitVersion === undefined || autoFitVersion === prev.current) return;
    prev.current = autoFitVersion;
    const id = setTimeout(() => fitView({ padding, minZoom: 0 }), 40);
    return () => clearTimeout(id);
  }, [autoFitVersion, padding, fitView]);

  const handleReset = () => {
    onReset?.();
    // Defer fit so the position-reset re-render can complete first.
    setTimeout(() => fitView({ padding, minZoom: 0 }), 80);
  };

  return (
    <Panel position={position}>
      <div style={{ display: 'flex', gap: 4 }}>
        {onReset && (
          <button title="Reset layout to initial positions" onClick={handleReset} style={BTN}>
            ↺ Reset
          </button>
        )}
        <button
          title="Fit all elements in view"
          onClick={() => fitView({ padding, minZoom: 0 })}
          style={BTN}
        >
          ⊡ Fit
        </button>
      </div>
    </Panel>
  );
}
