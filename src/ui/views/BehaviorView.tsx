import { useMemo, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { VisualizerModel, VizNode } from '../../core/visualizerModel';
import type { SelectionState } from '../../app/selection';

// ── Types ─────────────────────────────────────────────────────────────────────

type BehaviorDef = Extract<VizNode, { kind: 'behaviorDef' }>;
type ActionInst  = Extract<VizNode, { kind: 'actionInst' }>;
type FlowEdge    = Extract<VizNode, { kind: 'flow' }>;

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W  = 164;
const NODE_H  = 68;
const H_GAP   = 88;
const V_GAP   = 28;
const START_X = 48;
const START_Y = 48;

// ── Colours ───────────────────────────────────────────────────────────────────

const ACT_BG     = '#09213a';
const ACT_BORDER = '#38bdf8';
const ACT_STEREO = '#7dd3fc';
const ACT_NAME   = '#bae6fd';
const ACT_TYPE   = '#4a9fc0';
const SEL_BORDER = '#89b4fa';
const SEL_GLOW   = '0 0 10px 2px #89b4fa33';

// ── Node label ────────────────────────────────────────────────────────────────

function actionLabel(name: string, typeName: string) {
  return (
    <div style={{ textAlign: 'center', lineHeight: 1.35 }}>
      <div style={{ fontSize: 9, color: ACT_STEREO, letterSpacing: '0.4px' }}>«action»</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: ACT_NAME }}>{name}</div>
      <div style={{ fontSize: 10, color: ACT_TYPE, marginTop: 1 }}>: {typeName}</div>
    </div>
  );
}

// ── Topological level assignment (Kahn's + max-level tracking) ────────────────

function assignLevels(actions: ActionInst[], flows: FlowEdge[]): Map<string, number> {
  const outEdges = new Map<string, string[]>(actions.map(a => [a.name, []]));
  const inDeg    = new Map<string, number>(actions.map(a => [a.name, 0]));

  for (const f of flows) {
    if (outEdges.has(f.from) && outEdges.has(f.to)) {
      outEdges.get(f.from)!.push(f.to);
      inDeg.set(f.to, (inDeg.get(f.to) ?? 0) + 1);
    }
  }

  const level = new Map<string, number>(actions.map(a => [a.name, 0]));
  const queue = actions.filter(a => inDeg.get(a.name) === 0).map(a => a.name);
  let head = 0;

  while (head < queue.length) {
    const curr = queue[head++];
    const currLevel = level.get(curr)!;
    for (const next of outEdges.get(curr)!) {
      level.set(next, Math.max(level.get(next)!, currLevel + 1));
      inDeg.set(next, inDeg.get(next)! - 1);
      if (inDeg.get(next)! === 0) queue.push(next);
    }
  }

  return level;
}

// ── Build nodes + edges for a behavior ───────────────────────────────────────

function buildGraph(behavior: BehaviorDef): { nodes: Node[]; edges: Edge[] } {
  const actions = behavior.body.filter((n): n is ActionInst => n.kind === 'actionInst');
  const flows   = behavior.body.filter((n): n is FlowEdge   => n.kind === 'flow');

  if (actions.length === 0) return { nodes: [], edges: [] };

  const level    = assignLevels(actions, flows);
  const levelIdx = new Map<number, number>();
  const positions = new Map<string, { x: number; y: number }>();

  for (const a of actions) {
    const lvl = level.get(a.name) ?? 0;
    const idx = levelIdx.get(lvl) ?? 0;
    levelIdx.set(lvl, idx + 1);
    positions.set(a.name, {
      x: START_X + lvl * (NODE_W + H_GAP),
      y: START_Y + idx * (NODE_H + V_GAP),
    });
  }

  const nodes: Node[] = actions.map(a => {
    const nodeId = `bact-${behavior.name}-${a.name}`;
    const sel: SelectionState = {
      id: nodeId,
      type: 'actionInst',
      name: a.name,
      extra: { actionType: a.actionType, behavior: behavior.name },
    };
    return {
      id: nodeId,
      position: positions.get(a.name)!,
      data: { label: actionLabel(a.name, a.actionType), _sel: sel },
      style: {
        background: ACT_BG,
        border: `1px solid ${ACT_BORDER}`,
        borderRadius: 7,
        padding: '6px 10px',
        width: NODE_W,
        height: NODE_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    };
  });

  const edges: Edge[] = flows
    .filter(f => positions.has(f.from) && positions.has(f.to))
    .map(f => {
      const edgeId = `bflow-${behavior.name}-${f.from}-${f.to}`;
      const sel: SelectionState = {
        id: edgeId,
        type: 'behaviorFlow',
        name: `${f.from} → ${f.to}`,
        extra: { from: f.from, to: f.to, behavior: behavior.name },
      };
      return {
        id: edgeId,
        source: `bact-${behavior.name}-${f.from}`,
        target: `bact-${behavior.name}-${f.to}`,
        type: 'smoothstep',
        style: { stroke: ACT_BORDER, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: ACT_BORDER, width: 14, height: 14 },
        data: { _sel: sel },
      };
    });

  return { nodes, edges };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  result: VisualizerModel;
  behaviorName: string;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BehaviorView({ result, behaviorName, selection, onSelect }: Props) {
  const behavior = useMemo(
    () => result.nodes.find(
      (n): n is BehaviorDef => n.kind === 'behaviorDef' && n.name === behaviorName,
    ),
    [result, behaviorName],
  );

  // Pass 1: layout
  const { baseNodes, baseEdges } = useMemo(() => {
    if (!behavior) return { baseNodes: [], baseEdges: [] };
    const { nodes, edges } = buildGraph(behavior);
    return { baseNodes: nodes, baseEdges: edges };
  }, [behavior]);

  // Pass 2: selection highlight
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

  if (!behaviorName) {
    return (
      <div className="behavior-placeholder">
        Select a behavior from the Model Explorer to view its action flow.
      </div>
    );
  }

  if (!behavior) {
    return (
      <div className="behavior-placeholder">
        Behavior <code>{behaviorName}</code> not found.
      </div>
    );
  }

  if (baseNodes.length === 0) {
    return (
      <div className="behavior-placeholder">
        <em>{behaviorName}</em> has no action instances yet.
        Add <code>action name : Type;</code> lines inside the behavior block.
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
        <Background color="#1a2a3a" gap={24} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
