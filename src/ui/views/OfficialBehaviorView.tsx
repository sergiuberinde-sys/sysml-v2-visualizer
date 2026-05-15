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

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  useReactFlow, applyNodeChanges,
  type Node, type Edge, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { BehaviorData } from '../../core/sysmlv2Official';
import type { SelectionState } from '../../app/selection';
import { FitPanel } from '../layout/FitPanel';
import { fitNodeWidth, estimateWrapLines, type TextRow } from '../layout/nodeSize';

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W       = 164;
const NODE_H       = 68;
const H_GAP        = 96;
const V_GAP        = 32;
const START_X      = 48;
const START_Y      = 48;
const BEHAV_H_PAD  = 20;   // 2 × 10 px (padding: '6px 10px')
const BEHAV_V_PAD  = 12;   // 2 × 6 px
const LINE_H_NAME  = 18;   // 12.5px font × 1.35 line-height
const LINE_H_SMALL = 14;   // 9–10 px stereotype / type label
const BADGE_H      = 20;   // branch badge row height

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

// ── Per-node dimension helper ─────────────────────────────────────────────────

function behaviorNodeDims(
  name:       string,
  actionType: string | undefined | null,
  isBranch:   boolean,
  stereoText: string,
): { w: number; h: number } {
  const rows: TextRow[] = [
    { text: stereoText, font: '9px sans-serif' },
    { text: name,       font: '600 12.5px sans-serif' },
    ...(actionType ? [{ text: ': ' + actionType, font: '10px sans-serif' } as TextRow] : []),
  ];
  const w         = fitNodeWidth(rows, BEHAV_H_PAD, NODE_W);
  const nameLines = estimateWrapLines(name, '600 12.5px sans-serif', w - BEHAV_H_PAD);
  let h = BEHAV_V_PAD + LINE_H_SMALL + nameLines * LINE_H_NAME;
  if (actionType) h += LINE_H_SMALL;
  if (isBranch)   h += BADGE_H;
  return { w, h: Math.max(NODE_H, h) };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  behavior:         BehaviorData | undefined;
  behaviorName:     string;
  behaviorNames?:   string[];
  onBehaviorChange?: (name: string) => void;
  selection:        SelectionState;
  onSelect:         (s: SelectionState) => void;
  focusSubtree?:    boolean;
}

// ── Conditional edge descriptor ───────────────────────────────────────────────

interface CondEdge {
  condId:     string;
  targetName: string;
  label:      string;
  color:      string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OfficialBehaviorView({ behavior, behaviorName, behaviorNames, onBehaviorChange, onSelect, selection, focusSubtree }: Props) {
  // ReactFlow instance ref for programmatic fitView (Focus Subtree)
  const rfInstanceRef = useRef<ReturnType<typeof useReactFlow> | null>(null);

  const [layoutDir, setLayoutDir] = useState<'lr' | 'tb'>('lr');
  const [fitMode, setFitMode] = useState(false);

  // ── Drag-position persistence ────────────────────────────────────────────────
  const [displayNodes, setDisplayNodes] = useState<Node[]>([]);
  // Track the "layout key" so we can detect when positions should be reset
  // (behavior switched or layout direction changed).
  const layoutKeyRef = useRef('');

  // When Focus Subtree is ON and a new action is selected via cursor sync, zoom to it
  useEffect(() => {
    if (!focusSubtree || !rfInstanceRef.current || !selection) return;
    if (selection.type !== 'actionInst') return;
    const nodeBehavior = selection.extra?.behavior ?? behaviorName;
    const nodeId = `oact-${nodeBehavior}-${selection.name}`;
    rfInstanceRef.current.fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 0.4, maxZoom: 1.5 });
  }, [selection, focusSubtree, behaviorName]);

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

    const level = assignLevels(allNames, allFlowEdges);

    // ── Action nodes ───────────────────────────────────────────────────────────

    const CTRL_STEREO_MAP: Record<string, string> = {
      DecisionNode: '«decide»',
      MergeNode:    '«merge»',
      ForkNode:     '«fork»',
      JoinNode:     '«join»',
    };

    // Per-node content-aware dimensions (width + height).
    const nodeDims = new Map<string, { w: number; h: number }>();
    for (const a of actionUsages) {
      const isCtrl    = CTRL_FLOW_TYPES.has(a.type);
      const targets   = outgoing.get(a.name) ?? [];
      const isBranch  = !isCtrl && targets.length > 1;
      const stereoTxt = isCtrl ? (CTRL_STEREO_MAP[a.type] ?? '«control»') : '«action»';
      nodeDims.set(a.name, behaviorNodeDims(a.name, isCtrl ? undefined : a.actionType, isBranch, stereoTxt));
    }
    for (const c of ownedConditionals) {
      const isLoop   = c.type === 'whileLoop';
      const condText = c.conditionText ?? (isLoop ? 'loop' : 'if');
      nodeDims.set(c.id, behaviorNodeDims(condText, undefined, false, isLoop ? '«loop»' : '«condition»'));
    }

    // Group nodes by topological level; then compute cumulative positions so
    // variable-size nodes don't overlap.
    const levelGroups = new Map<number, string[]>();
    for (const name of allNames) {
      const lvl = level.get(name) ?? 0;
      if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
      levelGroups.get(lvl)!.push(name);
    }
    const maxLevel = allNames.length > 0
      ? Math.max(...allNames.map(n => level.get(n) ?? 0))
      : 0;
    const positions = new Map<string, { x: number; y: number }>();

    if (layoutDir === 'lr') {
      // Columns L→R; items stack T→B within each column.
      const colX: number[] = [];
      let cumX = START_X;
      for (let l = 0; l <= maxLevel; l++) {
        colX.push(cumX);
        const nodes = levelGroups.get(l) ?? [];
        const maxW  = nodes.reduce((m, n) => Math.max(m, nodeDims.get(n)?.w ?? NODE_W), NODE_W);
        cumX += maxW + H_GAP;
      }
      for (const [lvl, names] of levelGroups) {
        let cumY = START_Y;
        for (const name of names) {
          positions.set(name, { x: colX[lvl] ?? START_X, y: cumY });
          cumY += (nodeDims.get(name)?.h ?? NODE_H) + V_GAP;
        }
      }
    } else {
      // Rows T→B; items spread L→R within each row.
      const rowY: number[] = [];
      let cumY = START_Y;
      for (let l = 0; l <= maxLevel; l++) {
        rowY.push(cumY);
        const nodes = levelGroups.get(l) ?? [];
        const maxH  = nodes.reduce((m, n) => Math.max(m, nodeDims.get(n)?.h ?? NODE_H), NODE_H);
        cumY += maxH + V_GAP;
      }
      for (const [lvl, names] of levelGroups) {
        let cumX = START_X;
        for (const name of names) {
          positions.set(name, { x: cumX, y: rowY[lvl] ?? START_Y });
          cumX += (nodeDims.get(name)?.w ?? NODE_W) + H_GAP;
        }
      }
    }

    const actNodes: Node[] = actionUsages.map(a => {
      const nodeId   = `oact-${behaviorName}-${a.name}`;
      const targets  = outgoing.get(a.name) ?? [];
      const isBranch = targets.length > 1;
      const isCtrl   = CTRL_FLOW_TYPES.has(a.type);
      const dims     = nodeDims.get(a.name) ?? { w: NODE_W, h: NODE_H };

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
              {!isCtrl && a.actionType && (
                <div style={{ fontSize: 10, color: '#4a9fc0', marginTop: 1 }}>: {a.actionType}</div>
              )}
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
              ...(a.actionType ? { actionType: a.actionType } : {}),
              ...(targets.length > 0 ? { outgoingTargets: targets.join(',') } : {}),
            },
          } satisfies SelectionState,
        },
        style: {
          background:     bg,
          border:         `1px solid ${border}`,
          borderRadius:   isCtrl ? 3 : 7,
          padding:        '6px 10px',
          width:          dims.w,
          height:         dims.h,
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
        const dims     = nodeDims.get(c.id) ?? { w: NODE_W, h: NODE_H };

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
            width:          dims.w,
            height:         dims.h,
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
  }, [behavior, behaviorName, layoutDir]);

  // Merge useMemo positions into displayNodes; reset positions when behavior or
  // layout direction changes.
  useEffect(() => {
    const key = `${behaviorName}::${layoutDir}`;
    const isReset = layoutKeyRef.current !== key;
    if (isReset) {
      layoutKeyRef.current = key;
      setDisplayNodes(rfNodes);
    } else {
      setDisplayNodes(prev => {
        const prevPosMap = new Map(prev.map(n => [n.id, n.position]));
        return rfNodes.map(n => {
          const saved = prevPosMap.get(n.id);
          return saved ? { ...n, position: saved } : n;
        });
      });
    }
  // rfNodes reference changes on every useMemo run (selection change etc.)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfNodes, behaviorName, layoutDir]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setDisplayNodes(prev => applyNodeChanges(changes, prev));
  }, []);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const s = node.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  // ── Selector toolbar ──────────────────────────────────────────────────────────

  const selectorBar = behaviorNames && behaviorNames.length > 0 ? (
    <div style={{
      padding:       '7px 14px',
      background:    '#0f172a',
      borderBottom:  '1px solid #1e293b',
      display:       'flex',
      alignItems:    'center',
      gap:           10,
      fontFamily:    'monospace',
      fontSize:      12,
      flexShrink:    0,
    }}>
      <span style={{ color: '#64748b' }}>Behavior:</span>
      <select
        value={behaviorName}
        onChange={e => onBehaviorChange?.(e.target.value)}
        style={{
          background:   '#1e293b',
          color:        '#e2e8f0',
          border:       '1px solid #334155',
          borderRadius: 3,
          fontSize:     12,
          padding:      '2px 6px',
          fontFamily:   'monospace',
          cursor:       'pointer',
          maxWidth:     320,
        }}
      >
        {behaviorNames.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <span style={{ color: '#334155', fontSize: 11 }}>
        {rfNodes.length > 0
          ? `${rfNodes.length} node${rfNodes.length !== 1 ? 's' : ''} · ${rfEdges.length} edge${rfEdges.length !== 1 ? 's' : ''}`
          : ''}
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {(['lr', 'tb'] as const).map(d => (
          <button
            key={d}
            onClick={() => setLayoutDir(d)}
            style={{
              background: layoutDir === d ? '#151f36' : 'transparent',
              border: `1px solid ${layoutDir === d ? '#38bdf8' : '#2a2a3a'}`,
              color: layoutDir === d ? '#7dd3fc' : '#6b7280',
              borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11,
            }}
          >
            {d === 'lr' ? '→ LR' : '↓ TB'}
          </button>
        ))}
        <span style={{ color: '#1e3a5f', fontSize: 10, marginLeft: 4 }}>
          Behavior · action instances + succession flows
        </span>
      </span>
    </div>
  ) : null;

  // ── Empty states ──────────────────────────────────────────────────────────────

  if (!behavior) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {selectorBar}
        <div className="behavior-placeholder" style={{ flex: 1 }}>Waiting for parser-service response…</div>
      </div>
    );
  }
  if (!behaviorName) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {selectorBar}
        <div className="behavior-placeholder" style={{ flex: 1 }}>Select a behavior from the dropdown above.</div>
      </div>
    );
  }
  if (rfNodes.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {selectorBar}
        <div className="behavior-placeholder" style={{ flex: 1 }}>
          No action instances found in <em>{behaviorName}</em>.
        </div>
      </div>
    );
  }

  // ── Graph ──────────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {selectorBar}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={displayNodes.length > 0 ? displayNodes : rfNodes}
          edges={rfEdges}
          onNodeClick={handleNodeClick}
          onNodesChange={handleNodesChange}
          onInit={inst => { rfInstanceRef.current = inst as ReturnType<typeof useReactFlow>; }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={!fitMode}
          panOnDrag={!fitMode}
          zoomOnScroll={!fitMode}
          zoomOnPinch={!fitMode}
          zoomOnDoubleClick={!fitMode}
        >
          <Background color="#1a2a3a" gap={24} />
          <Controls showFitView={false} />
          <FitPanel padding={0.2} active={fitMode} onToggle={() => setFitMode(v => !v)} />
        </ReactFlow>
      </div>
    </div>
  );
}
