import type { Project } from '../../app/state';
import { formatDate } from '../../app/state';

interface Props {
  projects: Project[];
  activeProjectId: string | null;
  onLoad: (project: Project) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function ProjectModal({
  projects, activeProjectId, onLoad, onDelete, onClose,
}: Props) {
  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card project-modal-card" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-title">Load Project</div>

        {sorted.length === 0 ? (
          <div className="project-list-empty">No saved projects yet.</div>
        ) : (
          <div className="project-list">
            {sorted.map(p => (
              <div
                key={p.id}
                className={`project-row${p.id === activeProjectId ? ' project-row-active' : ''}`}
              >
                <div className="project-row-info">
                  <div className="project-row-name">{p.name}</div>
                  <div className="project-row-date">Saved {formatDate(p.updatedAt)}</div>
                </div>
                <div className="project-row-btns">
                  <button
                    className="proj-btn proj-btn-load"
                    onClick={() => onLoad(p)}
                    type="button"
                  >
                    Load
                  </button>
                  <button
                    className="proj-btn proj-btn-del"
                    onClick={() => { if (window.confirm(`Delete "${p.name}"?`)) onDelete(p.id); }}
                    title="Delete project"
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              </div>
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
