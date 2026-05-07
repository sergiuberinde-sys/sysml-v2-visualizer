import { useMemo, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ParseResult, SysMLNode } from '../../core/modelTypes';
import type { SelectionState } from '../../app/selection';

// ── Types ─────────────────────────────────────────────────────────────────────

type StateDef    = Extract<SysMLNode, { kind: 'stateDef' }>;
type StateEntry  = Extract<SysMLNode, { kind: 'stateEntry' }>;
type Transition  = Extract<SysMLNode, { kind: 'transition' }>;

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W    = 148;
const NODE_H    = 54;
const H_GAP     = 64;
const V_GAP     = 24;
const START_X   = 80;
const START_Y   = 40;
const INIT_R    = 8;

// ── Colours ───────────────────────────────────────────────────────────────────

const ST_BG      = '#0d2e2e';
const ST_BORDER  = '#2dd4bf';
const ST_STEREO  = '#5eead4';
const ST_NAME    = '#99f6e4';
const SEL_BORDER = '#89b4fa';
const SEL_GLOW   = '0 0 10px 2px #89b4fa33';

// ── Node label ────────────────────────────────────────────────────────────────

function stateLabel(name: string) {
  return (
    <div style={{ textAlign: 'center', lineHeight: 1.35 }}>
      <div style={{ fontSize: 9, color: ST_STEREO, letterSpacing: '0.4px' }}>«state»</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: ST_NAME }}>{name}</div>
    </div>
  );
}

// ── BFS level assignment (handles cycles by ignoring already-visited nodes) ───

function assignLevels(states: string[], transitions: Transition[]): Map<string, number> {
  const out = new Map<string, string[]>(states.map(s => [s, []]));

  for (const t of transitions) {
    if (t.from !== '' && out.has(t.from) && out.has(t.to)) {
      out.get(t.from)!.push(t.to);
    }
  }

  const initialTrans = transitions.find(t => t.from === '');
  const start        = initialTrans?.to ?? states[0];

  const level   = new Map<string, number>();
  const visited = new Set<string>();
  const queue   = start ? [start] : [];
  if (start) { level.set(start, 0); visited.add(start); }

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const currLevel = level.get(curr)!;
    for (const next of out.get(curr) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        level.set(next, currLevel + 1);
        queue.push(next);
      }
    }
  }

  // Unreachable states go at the end
  let maxLevel = 0;
  for (const l of level.values()) if (l > maxLevel) maxLevel = l;
  for (const s of states) {
    if (!level.has(s)) level.set(s, maxLevel + 1);
  }

  return level;
}

// ── Build graph ───────────────────────────────────────────────────────────────

function buildGraph(sm: StateDef): { nodes: Node[]; edges: Edge[] } {
  const states      = sm.body.filter((n): n is StateEntry => n.kind === 'stateEntry');
  const transitions = sm.body.filter((n): n is Transition => n.kind === 'transition');

  if (states.length === 0) return { nodes: [], edges: [] };

  const stateNames = states.map(s => s.name);
  const level      = assignLevels(stateNames, transitions);
  const levelIdx   = new Map<number, number>();
  const positions  = new Map<string, { x: number; y: number }>();

  for (const s of states) {
    const lvl = level.get(s.name) ?? 0;
    const idx = levelIdx.get(lvl) ?? 0;
    levelIdx.set(lvl, idx + 1);
    positions.set(s.name, {
      x: START_X + lvl * (NODE_W + H_GAP),
      y: START_Y + idx * (NODE_H + V_GAP),
    });
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // State nodes
  for (const s of states) {
    const nodeId = `sstate-${sm.name}-${s.name}`;
    const sel: SelectionState = {
      id: nodeId, type: 'stateEntry', name: s.name,
      extra: { stateMachine: sm.name },
    };
    nodes.push({
      id: nodeId,
      position: positions.get(s.name)!,
      data: { label: stateLabel(s.name), _sel: sel },
      style: {
        background: ST_BG, border: `1px solid ${ST_BORDER}`,
        borderRadius: 7, padding: '6px 10px',
        width: NODE_W, height: NODE_H,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      },
    });
  }

  // Initial pseudo-state indicator
  const initTrans = transitions.find(t => t.from === '');
  if (initTrans && positions.has(initTrans.to)) {
    const initTargetPos = positions.get(initTrans.to)!;
    nodes.push({
      id: `sinit-${sm.name}`,
      position: {
        x: initTargetPos.x - 44,
        y: initTargetPos.y + NODE_H / 2 - INIT_R,
      },
      data: { label: '' },
      style: {
        width: INIT_R * 2, height: INIT_R * 2,
        borderRadius: '50%',
        background: ST_BORDER,
        border: 'none',
        minWidth: 0, padding: 0,
      },
      selectable: false,
      draggable: false,
    });
    edges.push({
      id: `sinit-edge-${sm.name}`,
      source: `sinit-${sm.name}`,
      target: `sstate-${sm.name}-${initTrans.to}`,
      type: 'smoothstep',
      style: { stroke: ST_BORDER, strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: ST_BORDER, width: 12, height: 12 },
    });
  }

  // Transition edges (skip the initial one — handled above)
  const stateSet = new Set(stateNames);
  transitions
    .filter(t => t.from !== '' && stateSet.has(t.from) && stateSet.has(t.to))
    .forEach((t, i) => {
      const edgeId = `strans-${sm.name}-${t.from}-${t.to}-${i}`;
      const sel: SelectionState = {
        id: edgeId, type: 'stateTransition',
        name: t.event ? `${t.from} → ${t.to} [${t.event}]` : `${t.from} → ${t.to}`,
        extra: { from: t.from, to: t.to, event: t.event, stateMachine: sm.name },
      };
      edges.push({
        id: edgeId,
        source: `sstate-${sm.name}-${t.from}`,
        target: `sstate-${sm.name}-${t.to}`,
        type: 'smoothstep',
        label: t.event || undefined,
        style: { stroke: ST_BORDER, strokeWidth: 1.5 },
        labelStyle: { fontSize: 9.5, fill: ST_STEREO, fontFamily: 'monospace' },
        labelBgStyle: { fill: '#0a1f1f', fillOpacity: 0.92 },
        markerEnd: { type: MarkerType.ArrowClosed, color: ST_BORDER, width: 14, height: 14 },
        data: { _sel: sel },
      });
    });

  return { nodes, edges };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  result: ParseResult;
  stateMachineName: string;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StateView({ result, stateMachineName, selection, onSelect }: Props) {
  const sm = useMemo(
    () => result.nodes.find(
      (n): n is StateDef => n.kind === 'stateDef' && n.name === stateMachineName,
    ),
    [result, stateMachineName],
  );

  const { baseNodes, baseEdges } = useMemo(() => {
    if (!sm) return { baseNodes: [], baseEdges: [] };
    const { nodes, edges } = buildGraph(sm);
    return { baseNodes: nodes, baseEdges: edges };
  }, [sm]);

  const { rfNodes, rfEdges } = useMemo(() => {
    if (!selection) return { rfNodes: baseNodes, rfEdges: baseEdges };

    const rfNodes = baseNodes.map(n => {
      if (n.id !== selection.id) return n;
      return {
        ...n,
        style: { ...(n.style as object), border: `1.5px solid ${SEL_BORDER}`, boxShadow: SEL_GLOW },
      };
    });

    const rfEdges = baseEdges.map(e => {
      if (e.id !== selection.id) return e;
      return {
        ...e,
        style: { stroke: SEL_BORDER, strokeWidth: 2.5 },
        labelStyle: { ...(e.labelStyle as object), fill: SEL_BORDER },
        markerEnd: { type: MarkerType.ArrowClosed, color: SEL_BORDER, width: 14, height: 14 },
      };
    });

    return { rfNodes, rfEdges };
  }, [baseNodes, baseEdges, selection]);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const s = node.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  const handleEdgeClick = useCallback((_e: React.MouseEvent, edge: Edge) => {
    const s = edge.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  if (!stateMachineName) {
    return (
      <div className="behavior-placeholder">
        Select a state machine from the Model Explorer to view its states and transitions.
      </div>
    );
  }

  if (!sm) {
    return (
      <div className="behavior-placeholder">
        State machine <code>{stateMachineName}</code> not found.
      </div>
    );
  }

  if (baseNodes.length === 0) {
    return (
      <div className="behavior-placeholder">
        <em>{stateMachineName}</em> has no states yet.
        Add <code>state Name;</code> lines inside the block.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background color="#0a1e1e" gap={24} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
