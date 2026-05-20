import type { VisualizerModel, VizNode } from '../../core/visualizerModel';
import type { SelectionState } from '../../app/selection';
import type { TrlcData } from '../../core/trlc/types';

type RD = Extract<VizNode, { kind: 'requirementDef' }>;
type TL = Extract<VizNode, { kind: 'traceLink' }>;

interface Props {
  result: VisualizerModel;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
  trlcData?: TrlcData;
}

const PRIORITY_COLOR: Record<string, string> = {
  High:   '#f38ba8',
  Medium: '#f9e2af',
  Low:    '#a6e3a1',
};

const LINK_COLOR: Record<string, string> = {
  satisfy: '#4ade80',
  verify:  '#f9e2af',
  trace:   '#38bdf8',
};

const ASIL_COLOR: Record<string, string> = {
  D: '#f87171',
  C: '#fb923c',
  B: '#facc15',
  A: '#a3e635',
  QM: '#64748b',
};

export default function RequirementsView({ result, selection, onSelect, trlcData }: Props) {
  const reqs  = result.nodes.filter((n): n is RD => n.kind === 'requirementDef');
  const links = result.nodes.filter((n): n is TL => n.kind === 'traceLink');
  const isOfficial = result.parserMode === 'sysmlV2OfficialFuture';

  // Official mode with TRLC: show TRLC requirements
  if (isOfficial && trlcData) {
    return (
      <div className="req-view">
        <div style={{
          padding: '10px 16px 6px',
          fontSize: 10, color: '#475569',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          borderBottom: '1px solid #1e2d3d',
          marginBottom: 4,
        }}>
          TRLC Requirements ({trlcData.requirements.length})
        </div>
        {trlcData.requirements.map(req => {
          const selId = `trlc-req-${req.id}`;
          const isSelected = selection?.id === selId;
          return (
            <div
              key={req.id}
              className={`req-card${isSelected ? ' req-card-selected' : ''}`}
              onClick={() => onSelect({
                id: selId, type: 'requirement', name: req.id,
                extra: { reqId: req.id, text: req.text, title: req.title, ...(req.asil ? { asil: req.asil } : {}) },
              })}
            >
              <div className="req-card-header">
                <span className="req-id">{req.id}</span>
                <span className="req-name">{req.title}</span>
                {req.asil && (
                  <span className="req-priority" style={{ color: ASIL_COLOR[req.asil] ?? '#6c7086' }}>
                    ASIL-{req.asil}
                  </span>
                )}
              </div>
              {req.text && <div className="req-text">{req.text}</div>}
            </div>
          );
        })}
      </div>
    );
  }

  // Official mode without TRLC loaded
  if (isOfficial) {
    return (
      <div className="behavior-placeholder">
        <div>No TRLC requirements loaded.</div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
          Use the <code>TRLC</code> button in the toolbar to import a <code>.trlc</code> file.
        </div>
      </div>
    );
  }

  // Legacy mode: show prototype subset requirements
  if (reqs.length === 0) {
    return (
      <div className="behavior-placeholder">
        No requirements defined yet.
        Add <code>requirement def Name {'{ id = "..."; text = "..."; }'}</code> to the model.
      </div>
    );
  }

  return (
    <div className="req-view">
      {reqs.map(req => {
        const reqLinks = links.filter(l => l.target === req.name);
        const selId    = `req-${req.name}`;
        const isSelected = selection?.id === selId;
        return (
          <div
            key={req.name}
            className={`req-card${isSelected ? ' req-card-selected' : ''}`}
            onClick={() => onSelect({
              id: selId, type: 'requirement', name: req.name,
              extra: { reqId: req.reqId, text: req.text, priority: req.priority },
            })}
          >
            <div className="req-card-header">
              {req.reqId && <span className="req-id">{req.reqId}</span>}
              <span className="req-name">{req.name}</span>
              {req.priority && (
                <span className="req-priority" style={{ color: PRIORITY_COLOR[req.priority] ?? '#6c7086' }}>
                  {req.priority}
                </span>
              )}
            </div>
            {req.text && <div className="req-text">{req.text}</div>}
            {reqLinks.length > 0 && (
              <div className="req-links">
                {reqLinks.map((l, i) => (
                  <span
                    key={i}
                    className="req-link-badge"
                    style={{ borderColor: LINK_COLOR[l.linkType] ?? '#585b70', color: LINK_COLOR[l.linkType] ?? '#a6adc8' }}
                  >
                    {l.linkType} ← {l.source}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
