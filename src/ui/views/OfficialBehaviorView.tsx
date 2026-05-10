/**
 * Behavior tab renderer for Official SysML v2 mode.
 *
 * Reads directly from parser-service response.behavior — no prototype-model
 * assumptions, no VisualizerModel intermediary.
 *
 * Renders:
 *   behavior.actions (ActionUsage nodes)  → ReactFlow nodes
 *   behavior.flows   (succession edges)   → ReactFlow edges
 */

import { useMemo, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { BehaviorData } from '../../core/sysmlv2Official';
import type { SelectionState } from '../../app/selection';

// ── Layout constants (matches BehaviorView palette) ───────────────────────────

const NODE_W  = 164;
const NODE_H  = 60;
const H_GAP   = 88;
const V_GAP   = 28;
const START_X = 48;
const START_Y = 48;

const ACT_BG     = '#09213a';
const ACT_BORDER = '#38bdf8';
const ACT_STEREO = '#7dd3fc';
const ACT_NAME   = '#bae6fd';

// ── Topological sort (Kahn's algorithm) ──────────────────────────────────────

function assignLevels(
  names: string[],
  flows: Array<{ source: string; target: string }>,
): Map<string, number> {
  const outEdges = new Map<string, string[]>(names.map(n => [n, []]));
  const inDeg    = new Map<string, number>(names.map(n => [n, 0]));

  for (const f of flows) {
    if (outEdges.has(f.source) && outEdges.has(f.target)) {
      outEdges.get(f.source)!.push(f.target);
      inDeg.set(f.target, (inDeg.get(f.target) ?? 0) + 1);
    }
  }

  const level = new Map<string, number>(names.map(n => [n, 0]));
  const queue = names.filter(n => inDeg.get(n) === 0);
  let head = 0;

  while (head < queue.length) {
    const curr      = queue[head++];
    const currLevel = level.get(curr)!;
    for (const next of outEdges.get(curr)!) {
      level.set(next, Math.max(level.get(next)!, currLevel + 1));
      inDeg.set(next, inDeg.get(next)! - 1);
      if (inDeg.get(next)! === 0) queue.push(next);
    }
  }

  return level;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  behavior: BehaviorData | undefined;
  behaviorName: string;
  selection: SelectionState;
  onSelect: (s: SelectionState) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OfficialBehaviorView({ behavior, behaviorName, onSelect }: Props) {
  console.log('[OfficialBehaviorView] mode=official behaviorName:', behaviorName, 'behavior:', behavior);

  const { rfNodes, rfEdges } = useMemo(() => {
    if (!behavior || !behaviorName) return { rfNodes: [], rfEdges: [] };

    // Find the ActionDefinition with this name.
    const def = behavior.actions.find(
      a => a.type === 'ActionDefinition' && a.name === behaviorName,
    );
    if (!def) {
      console.log('[OfficialBehaviorView] no ActionDefinition found for:', behaviorName);
      return { rfNodes: [], rfEdges: [] };
    }

    // Collect action instances owned by this definition.
    const actionUsages = behavior.actions.filter(
      a => (a.type === 'ActionUsage' || a.type === 'PerformActionUsage') && a.ownerId === def.id,
    );
    console.log('[OfficialBehaviorView] actionUsages for', behaviorName, ':', actionUsages.map(a => a.name));

    // Collect resolved succession flows (drop unresolved ones — they have no source/target).
    const resolvedFlows = behavior.flows.filter(
      (f): f is { id: string; source: string; target: string; type: 'succession' } => 'source' in f,
    );
    console.log('[OfficialBehaviorView] flows:', resolvedFlows.map(f => `${f.source}→${f.target}`));

    if (actionUsages.length === 0) return { rfNodes: [], rfEdges: [] };

    // Topological layout.
    const names   = actionUsages.map(a => a.name);
    const level   = assignLevels(names, resolvedFlows.map(f => ({ source: f.source, target: f.target })));
    const levelIdx = new Map<number, number>();
    const positions = new Map<string, { x: number; y: number }>();

    for (const a of actionUsages) {
      const lvl = level.get(a.name) ?? 0;
      const idx = levelIdx.get(lvl) ?? 0;
      levelIdx.set(lvl, idx + 1);
      positions.set(a.name, {
        x: START_X + lvl * (NODE_W + H_GAP),
        y: START_Y + idx * (NODE_H + V_GAP),
      });
    }

    // Build ReactFlow nodes.
    const rfNodes: Node[] = actionUsages.map(a => {
      const nodeId = `oact-${behaviorName}-${a.name}`;
      return {
        id:       nodeId,
        position: positions.get(a.name)!,
        data: {
          label: (
            <div style={{ textAlign: 'center', lineHeight: 1.35 }}>
              <div style={{ fontSize: 9, color: ACT_STEREO, letterSpacing: '0.4px' }}>«action»</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: ACT_NAME }}>{a.name}</div>
            </div>
          ),
          _sel: {
            id:   nodeId,
            type: 'actionInst',
            name: a.name,
            extra: { behavior: behaviorName },
          } satisfies SelectionState,
        },
        style: {
          background:     ACT_BG,
          border:         `1px solid ${ACT_BORDER}`,
          borderRadius:   7,
          padding:        '6px 10px',
          width:          NODE_W,
          height:         NODE_H,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        },
      };
    });

    // Build ReactFlow edges (only for flows whose both ends exist as positioned nodes).
    const rfEdges: Edge[] = resolvedFlows
      .filter(f => positions.has(f.source) && positions.has(f.target))
      .map(f => ({
        id:       `oflow-${behaviorName}-${f.source}-${f.target}`,
        source:   `oact-${behaviorName}-${f.source}`,
        target:   `oact-${behaviorName}-${f.target}`,
        type:     'smoothstep',
        style:    { stroke: ACT_BORDER, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: ACT_BORDER, width: 14, height: 14 },
      }));

    return { rfNodes, rfEdges };
  }, [behavior, behaviorName]);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const s = node.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  // ── Empty states ─────────────────────────────────────────────────────────────

  if (!behavior) {
    return (
      <div className="behavior-placeholder">
        Waiting for parser-service response…
      </div>
    );
  }

  if (!behaviorName) {
    return (
      <div className="behavior-placeholder">
        Select a behavior from the dropdown above.
      </div>
    );
  }

  if (rfNodes.length === 0) {
    return (
      <div className="behavior-placeholder">
        No action instances found in <em>{behaviorName}</em>.
      </div>
    );
  }

  // ── Graph ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background color="#1a2a3a" gap={24} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
