import { useMemo } from 'react';
import type { VisualizerModel, VizNode } from '../../core/visualizerModel';
import type { SelectionState } from '../../app/selection';

const LANE_W         = 170;
const LANE_PAD       = 50;
const BOX_W          = 150;
const BOX_H          = 36;
const TOP_PAD        = 20;
const FIRST_MSG      = 70;
const MSG_STEP       = 56;
const LIFELINE_EXTRA = 30;

type MsgNode = Extract<VizNode, { kind: 'message' }>;

interface Props {
  result: VisualizerModel;
  occurrenceName: string;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
}

export default function SequenceView({ result, occurrenceName, selection, onSelect }: Props) {
  const { participants, messages } = useMemo(() => {
    const occ = result.nodes.find(
      (n): n is Extract<VizNode,{ kind: 'occurrenceDef' }> =>
        n.kind === 'occurrenceDef' && n.name === occurrenceName,
    );

    const msgs: MsgNode[] = occ
      ? occ.body.filter((n): n is MsgNode => n.kind === 'message')
      : result.nodes.filter((n): n is MsgNode => n.kind === 'message');

    const seen = new Set<string>();
    const participants: string[] = [];
    for (const m of msgs) {
      if (!seen.has(m.from)) { seen.add(m.from); participants.push(m.from); }
      if (!seen.has(m.to))   { seen.add(m.to);   participants.push(m.to);   }
    }
    return { participants, messages: msgs };
  }, [result, occurrenceName]);

  if (messages.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 10,
        color: '#6b7280', fontSize: 14,
      }}>
        <span>No messages in this scenario.</span>
        <code style={{ background: '#313244', padding: '4px 10px', borderRadius: 4, fontSize: 12 }}>
          message m1 from A to B;
        </code>
      </div>
    );
  }

  const svgW      = LANE_PAD * 2 + participants.length * LANE_W;
  const lifelineH = FIRST_MSG + messages.length * MSG_STEP + LIFELINE_EXTRA;
  const svgH      = TOP_PAD + BOX_H + lifelineH + 20;

  function cx(name: string) {
    return LANE_PAD + participants.indexOf(name) * LANE_W + LANE_W / 2;
  }

  const isLifelineSelected = (p: string) => selection?.id === `def-${p}`;
  const isMsgSelected = (m: MsgNode, i: number) =>
    selection?.id === `msg-${occurrenceName}-${m.name}-${i}`;

  return (
    <div style={{ padding: 16 }}>
      <svg width={svgW} height={svgH} style={{ fontFamily: 'system-ui, sans-serif', overflow: 'visible' }}>
        <defs>
          <marker id="arr-r" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
          <marker id="arr-l" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto">
            <polygon points="10 0, 0 3.5, 10 7" fill="#94a3b8" />
          </marker>
          <marker id="arr-r-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#89b4fa" />
          </marker>
          <marker id="arr-l-sel" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto">
            <polygon points="10 0, 0 3.5, 10 7" fill="#89b4fa" />
          </marker>
        </defs>

        {/* Participant boxes + lifelines */}
        {participants.map(p => {
          const x        = cx(p);
          const boxTop   = TOP_PAD;
          const lifeTop  = boxTop + BOX_H;
          const lifeBot  = lifeTop + lifelineH;
          const selected = isLifelineSelected(p);

          return (
            <g key={p} style={{ cursor: 'pointer' }}
              onClick={() => onSelect({ id: `def-${p}`, type: 'part', name: p })}>
              <rect
                x={x - BOX_W / 2} y={boxTop}
                width={BOX_W} height={BOX_H}
                rx={5}
                fill={selected ? '#1a2a4a' : '#0f2644'}
                stroke={selected ? '#89b4fa' : '#3b82f6'}
                strokeWidth={selected ? 2 : 1.5}
              />
              {selected && (
                <rect
                  x={x - BOX_W / 2 - 3} y={boxTop - 3}
                  width={BOX_W + 6} height={BOX_H + 6}
                  rx={7} fill="none"
                  stroke="#89b4fa" strokeWidth={1} opacity={0.35}
                />
              )}
              <text
                x={x} y={boxTop + BOX_H / 2 + 5}
                textAnchor="middle"
                fill={selected ? '#89b4fa' : '#bfdbfe'}
                fontSize={13} fontWeight={600}
              >
                {p}
              </text>
              <line
                x1={x} y1={lifeTop} x2={x} y2={lifeBot}
                stroke={selected ? '#4a6fa8' : '#374151'} strokeWidth={1} strokeDasharray="5 4"
              />
              <rect
                x={x - 4} y={lifeTop + 10} width={8} height={lifelineH - 20}
                fill="#1e2a3a" stroke="#374151" strokeWidth={0.5} rx={2}
              />
            </g>
          );
        })}

        {/* Message arrows */}
        {messages.map((m, i) => {
          const y        = TOP_PAD + BOX_H + FIRST_MSG + i * MSG_STEP;
          const x1       = cx(m.from);
          const x2       = cx(m.to);
          const goRight  = x2 > x1;
          const selected = isMsgSelected(m, i);

          const arrowColor  = selected ? '#89b4fa' : '#94a3b8';
          const labelColor  = selected ? '#89b4fa' : '#e2e8f0';
          const markerId    = selected
            ? (goRight ? 'arr-r-sel' : 'arr-l-sel')
            : (goRight ? 'arr-r'     : 'arr-l');
          const tipOffset   = goRight ? -2 : 2;

          return (
            <g key={`${m.name}-${i}`} style={{ cursor: 'pointer' }}
              onClick={() => onSelect({
                id: `msg-${occurrenceName}-${m.name}-${i}`,
                type: 'message',
                name: m.name,
                line: m.line,
                extra: { from: m.from, to: m.to, occurrence: occurrenceName },
              })}>
              {selected && (
                <line
                  x1={x1} y1={y} x2={x2} y2={y}
                  stroke="#89b4fa" strokeWidth={6} opacity={0.15}
                />
              )}
              <text x={Math.min(x1, x2) - 18} y={y + 4} fontSize={10} fill="#6b7280" textAnchor="end">
                {i + 1}
              </text>
              <line
                x1={x1} y1={y}
                x2={x2 + tipOffset} y2={y}
                stroke={arrowColor}
                strokeWidth={selected ? 2 : 1.5}
                markerEnd={`url(#${markerId})`}
              />
              <text
                x={(x1 + x2) / 2} y={y - 8}
                textAnchor="middle" fontSize={12}
                fill={labelColor} fontStyle="italic"
                fontWeight={selected ? 700 : 400}
              >
                {m.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
