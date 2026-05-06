import type { ParseResult, SysMLNode, SelectionState } from '../types';

type RD = Extract<SysMLNode, { kind: 'requirementDef' }>;
type TL = Extract<SysMLNode, { kind: 'traceLink' }>;

interface Props {
  result: ParseResult;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
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

export default function RequirementsView({ result, selection, onSelect }: Props) {
  const reqs  = result.nodes.filter((n): n is RD => n.kind === 'requirementDef');
  const links = result.nodes.filter((n): n is TL => n.kind === 'traceLink');

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
