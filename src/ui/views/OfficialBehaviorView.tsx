/**
 * Behavior tab renderer for Official SysML v2 mode.
 *
 * Reads directly from parser-service response.behavior — no prototype-model
 * assumptions, no VisualizerModel intermediary.
 *
 * Renders:
 *   behavior.actions       (ActionUsage nodes)        → ReactFlow nodes
 *   behavior.flows         (succession / transition)  → ReactFlow edges
 *   behavior.conditionals  (IfActionUsage / WhileLoop) → condition nodes + branch edges
 */

import { useMemo, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { BehaviorData } from '../../core/sysmlv2Official';
import type { SelectionState } from '../../app/selection';

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W  = 164;
const NODE_H  = 68;
const H_GAP   = 96;
const V_GAP   = 32;
const START_X = 48;
const START_Y = 48;

// ── Color palette ─────────────────────────────────────────────────────────────

const ACT_BG       = '#09213a';
const ACT_BORDER   = '#38bdf8';
const ACT_STEREO   = '#7dd3fc';
const ACT_NAME     = '#bae6fd';
const BRANCH_COLOR = '#fbbf24';   // amber — branching action badge
const GUARD_COLOR  = '#a3e635';   // lime — guarded transition edge label

const COND_BG     = '#1a110a';    // dark amber tint
const COND_BORDER = '#f59e0b';    // amber
const COND_STEREO = '#fcd34d';    // yellow
const COND_NAME   = '#fef3c7';    // cream

const LOOP_BG     = '#0a0a1a';    // dark indigo tint
const LOOP_BORDER = '#818cf8';    // indigo
const LOOP_STEREO = '#c4b5fd';
const LOOP_NAME   = '#e0e7ff';

const THEN_COLOR  = '#4ade80';    // green — [true] / then branch
const ELSE_COLOR  = '#f87171';    // red   — [false] / else branch
const LOOP_EDGE   = '#818cf8';    // indigo — loop body edge

const CTRL_BG     = '#0d1a14';    // dark teal — control flow nodes
const CTRL_BORDER = '#2dd4bf';    // teal
const CTRL_STEREO = '#5eead4';
const CTRL_NAME   = '#ccfbf1';

const CTRL_FLOW_TYPES = new Set(['DecisionNode', 'MergeNode', 'ForkNode', 'JoinNode']);

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

// ── Conditional edge descriptor ───────────────────────────────────────────────

interface CondEdge {
  condId:     string;
  targetName: string;
  label:      string;
  color:      string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OfficialBehaviorView({ behavior, behaviorName, onSelect }: Props) {
  const { rfNodes, rfEdges } = useMemo(() => {
    if (!behavior || !behaviorName) return { rfNodes: [], rfEdges: [] };

    // behaviorName may be 'Controller::Startup' (qualified) or 'Startup' (unqualified).
    const colonIdx  = behaviorName.indexOf('::');
    const ownerPart = colonIdx >= 0 ? behaviorName.slice(0, colonIdx) : null;
    const defPart   = colonIdx >= 0 ? behaviorName.slice(colonIdx + 2) : behaviorName;

    const def = behavior.actions.find(a =>
      a.type === 'ActionDefinition' &&
      a.name === defPart &&
      (ownerPart === null || a.owningDefName === ownerPart),
    );
    if (!def) return { rfNodes: [], rfEdges: [] };

    // Collect action instances and control-flow nodes owned by this definition.
    const actionUsages = behavior.actions.filter(
      a => (a.type === 'ActionUsage' || a.type === 'PerformActionUsage' || CTRL_FLOW_TYPES.has(a.type)) && a.ownerId === def.id,
    );

    // Collect conditionals owned by this definition.
    const ownedConditionals = (behavior.conditionals ?? []).filter(
      c => c.ownerId === def.id,
    );

    // Fast lookup: action id → action (for resolving branch action IDs in conditionals).
    const actionById = new Map(behavior.actions.map(a => [a.id, a]));

    // Collect resolved succession / transition flows.
    type ResolvedFlow = Extract<NonNullable<typeof behavior>['flows'][number], { source: string }>;
    const resolvedFlows = behavior.flows.filter(
      (f): f is ResolvedFlow => 'source' in f,
    );

    // Synthetic edges from each conditional node to its branch actions.
    const condEdges: CondEdge[] = [];
    for (const cond of ownedConditionals) {
      const isLoop  = cond.type === 'whileLoop';
      const thenLbl = isLoop ? '[loop]'  : '[true]';
      const thenClr = isLoop ? LOOP_EDGE : THEN_COLOR;

      for (const id of cond.thenActionIds) {
        const a = actionById.get(id);
        if (a) condEdges.push({ condId: cond.id, targetName: a.name, label: thenLbl, color: thenClr });
      }
      if (!isLoop) {
        for (const id of (cond.elseActionIds ?? [])) {
          const a = actionById.get(id);
          if (a) condEdges.push({ condId: cond.id, targetName: a.name, label: '[false]', color: ELSE_COLOR });
        }
      }
    }

    if (actionUsages.length === 0 && ownedConditionals.length === 0) {
      return { rfNodes: [], rfEdges: [] };
    }

    // Outgoing targets per action — used for branch badge and Inspector.
    const outgoing = new Map<string, string[]>();
    for (const f of resolvedFlows) {
      if (!outgoing.has(f.source)) outgoing.set(f.source, []);
      outgoing.get(f.source)!.push(f.target);
    }

    // ── Topological layout ─────────────────────────────────────────────────────
    // Nodes: action names + conditional IDs.
    // Edges: succession/transition flows + conditional → branch-action edges.

    const allNames: string[] = [
      ...actionUsages.map(a => a.name),
      ...ownedConditionals.map(c => c.id),
    ];

    const allFlowEdges = [
      ...resolvedFlows.map(f => ({ source: f.source, target: f.target })),
      ...condEdges.map(e => ({ source: e.condId, target: e.targetName })),
    ];

    const level    = assignLevels(allNames, allFlowEdges);
    const levelIdx = new Map<number, number>();
    const positions = new Map<string, { x: number; y: number }>();

    for (const name of allNames) {
      const lvl = level.get(name) ?? 0;
      const idx = levelIdx.get(lvl) ?? 0;
      levelIdx.set(lvl, idx + 1);
      positions.set(name, {
        x: START_X + lvl * (NODE_W + H_GAP),
        y: START_Y + idx * (NODE_H + V_GAP),
      });
    }

    // ── Action nodes ───────────────────────────────────────────────────────────

    const CTRL_STEREO_MAP: Record<string, string> = {
      DecisionNode: '«decide»',
      MergeNode:    '«merge»',
      ForkNode:     '«fork»',
      JoinNode:     '«join»',
    };

    const actNodes: Node[] = actionUsages.map(a => {
      const nodeId   = `oact-${behaviorName}-${a.name}`;
      const targets  = outgoing.get(a.name) ?? [];
      const isBranch = targets.length > 1;
      const isCtrl   = CTRL_FLOW_TYPES.has(a.type);

      const bg      = isCtrl ? CTRL_BG     : ACT_BG;
      const border  = isCtrl ? CTRL_BORDER : (isBranch ? BRANCH_COLOR : ACT_BORDER);
      const stereo  = isCtrl ? (CTRL_STEREO_MAP[a.type] ?? '«control»') : '«action»';
      const nameClr = isCtrl ? CTRL_NAME   : ACT_NAME;
      const stereoClr = isCtrl ? CTRL_STEREO : ACT_STEREO;

      return {
        id:       nodeId,
        position: positions.get(a.name)!,
        data: {
          label: (
            <div style={{ textAlign: 'center', lineHeight: 1.35 }}>
              <div style={{ fontSize: 9, color: stereoClr, letterSpacing: '0.4px' }}>{stereo}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: nameClr }}>{a.name}</div>
              {!isCtrl && isBranch && (
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, background: BRANCH_COLOR, transform: 'rotate(45deg)' }} />
                  <span style={{ fontSize: 8.5, color: BRANCH_COLOR, letterSpacing: '0.3px' }}>
                    {targets.length} branches
                  </span>
                </div>
              )}
            </div>
          ),
          _sel: {
            id:   nodeId,
            type: 'actionInst',
            name: a.name,
            extra: {
              behavior: behaviorName,
              ...(targets.length > 0 ? { outgoingTargets: targets.join(',') } : {}),
            },
          } satisfies SelectionState,
        },
        style: {
          background:     bg,
          border:         `1px solid ${border}`,
          borderRadius:   isCtrl ? 3 : 7,
          padding:        '6px 10px',
          width:          NODE_W,
          height:         NODE_H,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        },
      };
    });

    // ── Succession / transition edges ──────────────────────────────────────────

    const flowEdges: Edge[] = resolvedFlows
      .filter(f => positions.has(f.source) && positions.has(f.target))
      .map(f => {
        const srcBranch = (outgoing.get(f.source)?.length ?? 0) > 1;
        const isGuarded = f.type === 'transition' && 'guard' in f && f.guard !== undefined;
        const edgeColor = isGuarded ? GUARD_COLOR : (srcBranch ? BRANCH_COLOR : ACT_BORDER);
        return {
          id:        `oflow-${behaviorName}-${f.source}-${f.target}`,
          source:    `oact-${behaviorName}-${f.source}`,
          target:    `oact-${behaviorName}-${f.target}`,
          type:      'smoothstep',
          ...(isGuarded ? {
            label:        `[${(f as { guard: string }).guard}]`,
            labelStyle:   { fill: GUARD_COLOR, fontSize: 10, fontWeight: 600, fontFamily: 'monospace' },
            labelBgStyle: { fill: '#0b1e0b', fillOpacity: 0.9, rx: 3, ry: 3 },
          } : {}),
          style:     { stroke: edgeColor, strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
        };
      });

    // ── Conditional nodes ──────────────────────────────────────────────────────

    const condNodes: Node[] = ownedConditionals
      .filter(c => positions.has(c.id))
      .map(c => {
        const nodeId   = `ocond-${behaviorName}-${c.id}`;
        const isLoop   = c.type === 'whileLoop';
        const condText = c.conditionText ?? (isLoop ? 'loop' : 'if');
        const bg       = isLoop ? LOOP_BG     : COND_BG;
        const border   = isLoop ? LOOP_BORDER : COND_BORDER;
        const stereo   = isLoop ? LOOP_STEREO : COND_STEREO;
        const nameClr  = isLoop ? LOOP_NAME   : COND_NAME;

        return {
          id:       nodeId,
          position: positions.get(c.id)!,
          data: {
            label: (
              <div style={{ textAlign: 'center', lineHeight: 1.35 }}>
                <div style={{ fontSize: 9, color: stereo, letterSpacing: '0.4px' }}>
                  {isLoop ? '«loop»' : '«condition»'}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: nameClr }}>
                  {condText}
                </div>
              </div>
            ),
            _sel: {
              id:   nodeId,
              type: 'condition',
              name: condText,
              extra: { behavior: behaviorName, conditionKind: c.conditionKind },
            } satisfies SelectionState,
          },
          style: {
            background:     bg,
            border:         `1px solid ${border}`,
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

    // ── Conditional branch edges ───────────────────────────────────────────────

    const condBranchEdges: Edge[] = condEdges
      .filter(e => positions.has(e.condId) && positions.has(e.targetName))
      .map(e => ({
        id:           `ocond-edge-${behaviorName}-${e.condId}-${e.targetName}`,
        source:       `ocond-${behaviorName}-${e.condId}`,
        target:       `oact-${behaviorName}-${e.targetName}`,
        type:         'smoothstep',
        label:        e.label,
        labelStyle:   { fill: e.color, fontSize: 10, fontWeight: 600, fontFamily: 'monospace' },
        labelBgStyle: { fill: '#0a0f0a', fillOpacity: 0.9, rx: 3, ry: 3 },
        style:        { stroke: e.color, strokeWidth: 1.5 },
        markerEnd:    { type: MarkerType.ArrowClosed, color: e.color, width: 14, height: 14 },
      }));

    return {
      rfNodes: [...actNodes, ...condNodes],
      rfEdges: [...flowEdges, ...condBranchEdges],
    };
  }, [behavior, behaviorName]);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const s = node.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  // ── Empty states ──────────────────────────────────────────────────────────────

  if (!behavior) {
    return <div className="behavior-placeholder">Waiting for parser-service response…</div>;
  }
  if (!behaviorName) {
    return <div className="behavior-placeholder">Select a behavior from the dropdown above.</div>;
  }
  if (rfNodes.length === 0) {
    return (
      <div className="behavior-placeholder">
        No action instances found in <em>{behaviorName}</em>.
      </div>
    );
  }

  // ── Graph ──────────────────────────────────────────────────────────────────────

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
