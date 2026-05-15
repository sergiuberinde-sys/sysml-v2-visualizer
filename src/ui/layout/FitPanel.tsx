import { useEffect, useRef } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';

interface FitPanelProps {
  /** Increment to trigger an automatic fitView (e.g. after layout recalculation). */
  autoFitVersion?: number;
  padding?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  /** When true the button appears active and pan/zoom should be disabled by the parent. */
  active?: boolean;
  /** Provide to make the button a toggle; omit to keep it as a one-shot action. */
  onToggle?: () => void;
}

export function FitPanel({
  autoFitVersion,
  padding = 0.18,
  position = 'top-right',
  active,
  onToggle,
}: FitPanelProps) {
  const { fitView } = useReactFlow();
  const prev = useRef<number>(-1);

  // Auto-fit when the parent signals a layout change.
  useEffect(() => {
    if (autoFitVersion === undefined || autoFitVersion === prev.current) return;
    prev.current = autoFitVersion;
    const id = setTimeout(() => fitView({ padding, minZoom: 0 }), 40);
    return () => clearTimeout(id);
  }, [autoFitVersion, padding, fitView]);

  // Fit immediately whenever fit-mode is activated.
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => fitView({ padding, minZoom: 0 }), 40);
    return () => clearTimeout(id);
  }, [active, padding, fitView]);

  return (
    <Panel position={position}>
      <button
        title="Fit view"
        onClick={() => onToggle ? onToggle() : fitView({ padding, minZoom: 0 })}
        style={{
          background:   active ? '#1e3a5f' : '#111827',
          border:       `1px solid ${active ? '#38bdf8' : '#2a2a3a'}`,
          color:        active ? '#7dd3fc' : '#9ca3af',
          borderRadius: 4,
          padding:      '3px 9px',
          cursor:       'pointer',
          fontSize:     11,
        }}
      >
        ⊡ Fit
      </button>
    </Panel>
  );
}
