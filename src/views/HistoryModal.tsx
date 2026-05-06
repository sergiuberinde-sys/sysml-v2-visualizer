import type { HistorySnapshot } from '../history';

interface Props {
  history: HistorySnapshot[];
  onRestore: (snapshot: HistorySnapshot) => void;
  onClose: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function HistoryModal({ history, onRestore, onClose }: Props) {
  const sorted = [...history].reverse();

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card history-modal-card" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-title">Model History</div>

        {sorted.length === 0 ? (
          <div className="project-list-empty">No snapshots yet.</div>
        ) : (
          <div className="history-list">
            {sorted.map((snap, i) => (
              <button
                key={snap.id}
                className={`history-row${i === 0 ? ' history-row-current' : ''}`}
                onClick={() => onRestore(snap)}
                type="button"
                title="Click to restore this snapshot"
              >
                <span className="history-row-time">{formatTime(snap.timestamp)}</span>
                <span className="history-row-summary">
                  <span title="parts">{snap.parts}p</span>
                  <span title="interfaces">{snap.interfaces}if</span>
                  <span title="occurrences">{snap.occurrences}occ</span>
                  <span title="messages">{snap.messages}msg</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
