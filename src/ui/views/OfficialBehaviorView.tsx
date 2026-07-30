/**
 * Behavior tab renderer for Official SysML v2 mode.
 *
 * Reads directly from parser-service response.behavior — no prototype-model
 * assumptions, no VisualizerModel intermediary.
 *
 * Renders:
 *   behavior.actions       (ActionUsage nodes)        → ReactFlow nodes
 *   behavior.flows         (succession / transition)  → ReactFlow edges
 *   behavior.flows         (itemFlow)                 → port-to-port edges
 *   behavior.conditionals  (IfActionUsage / WhileLoop) → condition nodes + branch edges
 */

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, MarkerType,
  useReactFlow, applyNodeChanges, Handle, Position,
  type Node, type Edge, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { BehaviorData, ActionPort } from '../../core/sysmlv2Official';
import type { SelectionState } from '../../app/selection';
import { applyBehaviorLayout } from '../layout/graphLayout';
import { FitPanel } from '../layout/FitPanel';
import { fitNodeWidth, estimateWrapLines, type TextRow } from '../layout/nodeSize';
import { AsilBadge } from '../layout/AsilBadge';

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W       = 164;
const NODE_H       = 68;
const BEHAV_H_PAD  = 20;   // 2 × 10 px (padding: '6px 10px')
const BEHAV_V_PAD  = 12;   // 2 × 6 px
const LINE_H_NAME  = 18;   // 12.5px font × 1.35 line-height
const LINE_H_SMALL = 14;   // 9–10 px stereotype / type label
const BADGE_H      = 20;   // branch badge row height

// ── Port/pin layout constants ─────────────────────────────────────────────────

const PORT_PIN_SIZE  = 7;    // visible pin square size (px)
const PORT_PIN_GAP   = 4;    // gap between pin and label text
const PORT_ROW_H     = 18;   // height of each port row in the port section
const PORT_LABEL_FS  = 8;    // port label font size (px)
const PORT_DIVIDER_H = 9;    // 1px border-top + 4px padding-top + 4px slack

// Y-offset from node container top of the center of port row `idx`.
// hasType = action has an actionType ': Foo' label below the name.
const PORT_SECTION_TOP_BASE = 6 + 14 + 20 + 4 + 1 + 4; // pad + stereo + name + margin + border + padding
function portHandleTop(hasType: boolean, idx: number): number {
  return PORT_SECTION_TOP_BASE + (hasType ? 14 : 0) + idx * PORT_ROW_H + PORT_ROW_H / 2;
}

// ── Color palette ─────────────────────────────────────────────────────────────

const ACT_BG       = '#09213a';
const ACT_BORDER   = '#38bdf8';
const ACT_STEREO   = '#7dd3fc';
const ACT_NAME     = '#bae6fd';
const BRANCH_COLOR = '#fbbf24';   // amber — branching action badge

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

const CTRL_STEREO = '#5eead4';   // teal — fork/join stereotype text
const CTRL_NAME   = '#ccfbf1';   // pale teal — fork/join name text

const PIN_COLOR        = '#38bdf8';  // same as ACT_BORDER — item port pins
const PORT_TEXT_COLOR  = '#7dc8e8';
const PORT_TYPE_COLOR  = '#4a9fc0';
const ITEM_FLOW_COLOR  = '#22d3ee';  // cyan — item flow edges

const CTRL_FLOW_TYPES    = new Set(['DecisionNode', 'MergeNode', 'ForkNode', 'JoinNode']);
const FORK_JOIN_TYPES    = new Set(['ForkNode', 'JoinNode']);
const DECIDE_MERGE_TYPES = new Set(['DecisionNode', 'MergeNode']);

// ── Part container palette ────────────────────────────────────────────────────

const LANE_COLORS = [
  '#22c55e',  // green
  '#f59e0b',  // amber
  '#a78bfa',  // purple
  '#fb923c',  // orange
  '#38bdf8',  // sky
  '#f472b6',  // pink
  '#34d399',  // emerald
  '#facc15',  // yellow
];

const PART_PAD     = 28;   // padding inside the part container around its child nodes
const PART_LABEL_H = 28;   // height of the part name label row at the top

interface PartContainerNodeData { label: string; color: string }

// SysML part box: solid colored border, name label, transparent interior.
function PartContainerNode({ data }: { data: PartContainerNodeData }) {
  return (
    <div style={{
      width:         '100%',
      height:        '100%',
      borderRadius:  4,
      border:        `1.5px solid ${data.color}`,
      background:    `${data.color}08`,
      boxSizing:     'border-box',
      pointerEvents: 'none',
      overflow:      'hidden',
    }}>
      <div style={{
        padding:       '3px 8px',
        fontSize:      9,
        fontWeight:    600,
        color:         data.color,
        fontFamily:    'monospace',
        letterSpacing: '0.3px',
        whiteSpace:    'nowrap',
        overflow:      'hidden',
        textOverflow:  'ellipsis',
        borderBottom:  `1px solid ${data.color}30`,
      }}>
        {data.label}
      </div>
    </div>
  );
}


// ── Activity parameter node (boundary pin) ───────────────────────────────────
// Stacked in fixed left/right columns flanking the action graph, so they
// don't get tangled into ELK's main layered layout.

const PARAM_IN_COLOR  = '#34d399';   // emerald — input boundary
const PARAM_OUT_COLOR = '#f87171';   // red     — output boundary

const PARAM_W      = 140;
const PARAM_H      = 38;
const PARAM_GAP_X  = 130;  // gap between the action graph bbox and the param column — wide enough for clean item-flow routing
const PARAM_GAP_Y  = 14;   // vertical gap between stacked params

interface BoundaryParamNodeData { name: string; direction: 'in' | 'out'; _sel: SelectionState }

function BoundaryParamNode({ data }: { data: BoundaryParamNodeData }) {
  const isIn  = data.direction === 'in';
  const color = isIn ? PARAM_IN_COLOR : PARAM_OUT_COLOR;
  return (
    <div style={{
      width:         '100%',
      height:        '100%',
      borderRadius:  3,
      border:        `1.5px solid ${color}`,
      background:    `${color}10`,
      boxSizing:     'border-box',
      display:       'flex',
      alignItems:    'center',
      padding:       '0 8px',
      gap:           6,
    }}>
      <Handle
        type={isIn ? 'source' : 'target'}
        position={isIn ? Position.Right : Position.Left}
        id="param-port"
        style={{ width: 7, height: 7, background: color, border: `1px solid ${color}`, borderRadius: 1 }}
      />
      <div style={{ fontSize: 8, color, letterSpacing: '0.3px', flexShrink: 0 }}>
        «{isIn ? 'in' : 'out'}»
      </div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: '#e2e8f0',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {data.name}
      </div>
    </div>
  );
}

// ── Fork / Join — official SysML v2 graphical notation (solid bar) ───────────
// UML/SysML v2 §12 shows fork and join as filled horizontal bars; semantic
// distinction is by edge fan-out (fork: 1→N) vs. fan-in (join: N→1).

const FORK_JOIN_BAR_COLOR = '#5eead4';   // bright teal — fork/join bar fill
const FORK_JOIN_NODE_H    = 32;
const FORK_JOIN_BAR_H     = 7;
const FORK_JOIN_MIN_W     = 110;

// ── Decision / Merge — official SysML v2 graphical notation (diamond) ─────────
// UML/SysML v2 §12 shows decision and merge as diamonds; decision has guarded
// outgoing transitions, merge converges control flow.

const DIAMOND_NODE_W = 80;
const DIAMOND_NODE_H = 70;

type ControlNodeKind = 'fork' | 'join' | 'decision' | 'merge';

interface ControlNodeData {
  name: string;
  kind: ControlNodeKind;
  allocatedTo?: string;
  _sel: SelectionState;
}

function ForkJoinBarNode({ data }: { data: ControlNodeData }) {
  return (
    <div style={{
      position: 'relative',
      width:    '100%',
      height:   '100%',
      display:  'flex',
      flexDirection: 'column',
      alignItems:    'center',
      justifyContent: 'center',
      gap: 4,
    }}>
      <Handle type="target" position={Position.Top}    id="ctrl-in"
        style={{ width: 1, height: 1, top: 0, background: 'transparent', border: 'none', minWidth: 0, minHeight: 0 }} />
      <Handle type="source" position={Position.Bottom} id="ctrl-out"
        style={{ width: 1, height: 1, bottom: 0, background: 'transparent', border: 'none', minWidth: 0, minHeight: 0 }} />
      {/* The solid bar */}
      <div style={{
        width:        '100%',
        height:       FORK_JOIN_BAR_H,
        background:   FORK_JOIN_BAR_COLOR,
        borderRadius: 1.5,
        boxShadow:    `0 0 0 1px ${FORK_JOIN_BAR_COLOR}`,
      }} />
      {/* Stereotype + name label below the bar */}
      <div style={{
        fontSize:      9,
        fontFamily:    'monospace',
        letterSpacing: '0.3px',
        whiteSpace:    'nowrap',
        textAlign:     'center',
        lineHeight:    1.1,
      }}>
        <span style={{ color: CTRL_STEREO }}>«{data.kind}»</span>
        {' '}
        <span style={{ color: CTRL_NAME, fontWeight: 600 }}>{data.name}</span>
      </div>
    </div>
  );
}

function DecideMergeDiamondNode({ data }: { data: ControlNodeData }) {
  const isDecision = data.kind === 'decision';
  const border = isDecision ? COND_BORDER : '#94a3b8';
  const bg     = isDecision ? COND_BG     : '#1e293b';
  const stereo = isDecision ? COND_STEREO : '#cbd5e1';
  const nameClr = isDecision ? COND_NAME  : '#e2e8f0';
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Handle type="target" position={Position.Top}    id="ctrl-in"
        style={{ width: 1, height: 1, background: 'transparent', border: 'none', minWidth: 0, minHeight: 0 }} />
      <Handle type="source" position={Position.Bottom} id="ctrl-out"
        style={{ width: 1, height: 1, background: 'transparent', border: 'none', minWidth: 0, minHeight: 0 }} />
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
           style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <polygon points="50,3 97,50 50,97 3,50" fill={bg} stroke={border} strokeWidth="2" />
      </svg>
      <div style={{
        position:       'absolute',
        inset:          0,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        textAlign:      'center',
        padding:        '0 14px',
        pointerEvents:  'none',
        lineHeight:     1.1,
      }}>
        <div style={{ fontSize: 8, color: stereo, letterSpacing: '0.3px', fontFamily: 'monospace' }}>
          «{data.kind}»
        </div>
        <div style={{
          fontSize: 9, fontWeight: 600, color: nameClr,
          fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 1,
        }}>
          {data.name}
        </div>
      </div>
    </div>
  );
}

// ── Custom port-action node ───────────────────────────────────────────────────

interface PortActionNodeData {
  name:       string;
  stereotype: string;
  stereoClr:  string;
  nameClr:    string;
  actionType?: string;
  asil?:      string;
  ports:      ActionPort[];
  isBranch:   boolean;
  targets:    string[];
  _sel:       SelectionState;
}

function PortActionNode({ data }: { data: PortActionNodeData }) {
  const inPorts  = data.ports.filter(p => p.direction === 'in');
  const outPorts = data.ports.filter(p => p.direction === 'out');
  const hasPorts = inPorts.length > 0 || outPorts.length > 0;
  const hasType  = !!data.actionType;

  const header = (
    <>
      <div style={{ fontSize: 9, color: data.stereoClr, letterSpacing: '0.4px', textAlign: 'center' }}>
        {data.stereotype}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: data.nameClr, textAlign: 'center', lineHeight: 1.35 }}>
        {data.name}
      </div>
      {hasType && (
        <div style={{ fontSize: 10, color: PORT_TYPE_COLOR, marginTop: 1, textAlign: 'center' }}>
          : {data.actionType}
        </div>
      )}
      {data.asil && (
        <div style={{ marginTop: 3, textAlign: 'center' }}><AsilBadge level={data.asil} /></div>
      )}
      {data.isBranch && (
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, background: BRANCH_COLOR, transform: 'rotate(45deg)' }} />
          <span style={{ fontSize: 8.5, color: BRANCH_COLOR, letterSpacing: '0.3px' }}>
            {data.targets.length} branches
          </span>
        </div>
      )}
    </>
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box' }}>
      {/* Invisible succession handles at top/bottom */}
      <Handle type="target" position={Position.Top}    id="ctrl-in"
        style={{ width: 1, height: 1, background: 'transparent', border: 'none', minWidth: 0, minHeight: 0 }} />
      <Handle type="source" position={Position.Bottom} id="ctrl-out"
        style={{ width: 1, height: 1, background: 'transparent', border: 'none', minWidth: 0, minHeight: 0 }} />

      {/* Visible port-pin handles */}
      {inPorts.map((p, i) => (
        <Handle key={`h-in-${p.name}`} type="target" position={Position.Left} id={`in-${p.name}`}
          style={{
            top:          portHandleTop(hasType, i),
            width:        PORT_PIN_SIZE,
            height:       PORT_PIN_SIZE,
            background:   PIN_COLOR,
            border:       `1px solid ${PIN_COLOR}`,
            borderRadius: 1,
          }} />
      ))}
      {outPorts.map((p, i) => (
        <Handle key={`h-out-${p.name}`} type="source" position={Position.Right} id={`out-${p.name}`}
          style={{
            top:          portHandleTop(hasType, i),
            width:        PORT_PIN_SIZE,
            height:       PORT_PIN_SIZE,
            background:   PIN_COLOR,
            border:       `1px solid ${PIN_COLOR}`,
            borderRadius: 1,
          }} />
      ))}

      {hasPorts ? (
        <div style={{ padding: '6px 10px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 4 }}>{header}</div>
          <div style={{
            borderTop: '1px solid #1e3a5f',
            paddingTop: 4,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 4,
          }}>
            {/* In-ports column */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {inPorts.map(p => (
                <div key={p.name} style={{
                  height: PORT_ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: PORT_PIN_SIZE + PORT_PIN_GAP,
                  fontSize: PORT_LABEL_FS,
                  color: PORT_TEXT_COLOR,
                  whiteSpace: 'nowrap',
                }}>
                  {p.name}
                  {p.itemType && <span style={{ color: PORT_TYPE_COLOR }}>:{p.itemType}</span>}
                </div>
              ))}
            </div>
            {/* Out-ports column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              {outPorts.map(p => (
                <div key={p.name} style={{
                  height: PORT_ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: PORT_PIN_SIZE + PORT_PIN_GAP,
                  fontSize: PORT_LABEL_FS,
                  color: PORT_TEXT_COLOR,
                  whiteSpace: 'nowrap',
                }}>
                  {p.name}
                  {p.itemType && <span style={{ color: PORT_TYPE_COLOR }}>:{p.itemType}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '6px 10px',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          lineHeight: 1.35,
        }}>
          {header}
        </div>
      )}
    </div>
  );
}

// Stable nodeTypes reference (must be outside the component to avoid remounting).
const ALL_NODE_TYPES = {
  portAction:         PortActionNode,
  partContainer:      PartContainerNode,
  boundaryParam:      BoundaryParamNode,
  forkJoinBar:        ForkJoinBarNode,
  decideMergeDiamond: DecideMergeDiamondNode,
} as const;

// ── Per-node dimension helper ─────────────────────────────────────────────────

function behaviorNodeDims(
  name:       string,
  actionType: string | undefined | null,
  isBranch:   boolean,
  stereoText: string,
  inPorts:    ActionPort[] = [],
  outPorts:   ActionPort[] = [],
  hasAsil:    boolean = false,
): { w: number; h: number } {
  const rows: TextRow[] = [
    { text: stereoText, font: '9px sans-serif' },
    { text: name,       font: '600 12.5px sans-serif' },
    ...(actionType ? [{ text: ': ' + actionType, font: '10px sans-serif' } as TextRow] : []),
  ];
  const w0        = fitNodeWidth(rows, BEHAV_H_PAD, NODE_W);
  const nameLines = estimateWrapLines(name, '600 12.5px sans-serif', w0 - BEHAV_H_PAD);
  let h = BEHAV_V_PAD + LINE_H_SMALL + nameLines * LINE_H_NAME;
  if (actionType) h += LINE_H_SMALL;
  if (isBranch)   h += BADGE_H;
  if (hasAsil)    h += 16; // ASIL badge row

  const maxPorts = Math.max(inPorts.length, outPorts.length);
  let w = w0;
  if (maxPorts > 0) {
    h += PORT_DIVIDER_H + maxPorts * PORT_ROW_H;
    // Estimate width to accommodate port labels at 8px font (~4.5px/char)
    const label = (p: ActionPort) => p.name.length + (p.itemType ? p.itemType.length + 1 : 0);
    const longestIn  = inPorts.reduce((m, p) => Math.max(m, label(p)), 0);
    const longestOut = outPorts.reduce((m, p) => Math.max(m, label(p)), 0);
    const portsW = (longestIn + longestOut) * 4.5 + (PORT_PIN_SIZE + PORT_PIN_GAP + 6) * 2 + 16;
    w = Math.max(w, Math.ceil(portsW), 180);
  }

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
  onShapeContextMenu?: (e: React.MouseEvent, sel: SelectionState) => void;
  focusSubtree?:    boolean;
}

// ── Part container builder ────────────────────────────────────────────────────

/**
 * Converts flat positioned action nodes into a React Flow compound structure:
 * - One `partContainer` parent node per allocated part (sized to fit its children).
 * - Allocated action nodes become children (parentId set, positions made relative).
 * - Unallocated nodes (conditionals, control flow) stay at root level unchanged.
 *
 * Parent nodes must precede their children in the returned array.
 */
function buildCompoundLayout(
  positionedNodes: Node[],
  laneColors: Map<string, string>,
): Node[] {
  if (laneColors.size === 0) return positionedNodes;

  type Box = { x1: number; y1: number; x2: number; y2: number };
  const boxes = new Map<string, Box>();

  for (const n of positionedNodes) {
    const allocatedTo = (n.data as Record<string, unknown>)?.allocatedTo as string | undefined;
    if (!allocatedTo) continue;
    const w = Number((n.style as Record<string, unknown>)?.width  ?? NODE_W);
    const h = Number((n.style as Record<string, unknown>)?.height ?? NODE_H);
    const b = boxes.get(allocatedTo) ?? { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
    b.x1 = Math.min(b.x1, n.position.x);
    b.y1 = Math.min(b.y1, n.position.y);
    b.x2 = Math.max(b.x2, n.position.x + w);
    b.y2 = Math.max(b.y2, n.position.y + h);
    boxes.set(allocatedTo, b);
  }

  // Container nodes and their absolute positions (needed to relativize children).
  const containerNodes: Node[] = [];
  const containerAbsPos = new Map<string, { x: number; y: number }>();

  for (const [partName, box] of boxes) {
    const color = laneColors.get(partName) ?? LANE_COLORS[0];
    const cx = box.x1 - PART_PAD;
    const cy = box.y1 - PART_LABEL_H - PART_PAD;
    const cw = box.x2 - box.x1 + 2 * PART_PAD;
    const ch = box.y2 - box.y1 + PART_LABEL_H + 2 * PART_PAD;

    containerAbsPos.set(partName, { x: cx, y: cy });
    containerNodes.push({
      id:         `partbox-${partName}`,
      type:       'partContainer',
      position:   { x: cx, y: cy },
      data:       { label: partName, color } satisfies PartContainerNodeData,
      style:      { width: cw, height: ch, zIndex: -1 },
      selectable: false,
      draggable:  false,
    });
  }

  // Action nodes: allocated ones become compound children with relative positions.
  const actionNodes: Node[] = positionedNodes.map(n => {
    const allocatedTo = (n.data as Record<string, unknown>)?.allocatedTo as string | undefined;
    if (!allocatedTo) return n;
    const cp = containerAbsPos.get(allocatedTo);
    if (!cp) return n;
    return {
      ...n,
      parentId:  `partbox-${allocatedTo}`,
      position:  { x: n.position.x - cp.x, y: n.position.y - cp.y },
      draggable: false,
      extent:    'parent' as const,
    };
  });

  // Parents must come before children in React Flow's node list.
  return [...containerNodes, ...actionNodes];
}

// ── Allocation helpers ────────────────────────────────────────────────────────

/**
 * For the given behavior name, find all allocations that apply and return a
 * map of actionName → partName.
 *
 * `allocate performUsage.actionName to partName` allocates `actionName` to
 * `partName` when viewing the behavior typed by the `performUsage` perform
 * action usage.  We resolve the perform usage name by looking for a
 * PerformActionUsage whose actionType matches the behavior's def name.
 */
function buildActionAllocMap(
  behavior:     BehaviorData,
  behaviorName: string,
): Map<string, string> {
  const allocations = behavior.allocations;
  if (!allocations?.length) return new Map();

  const colonIdx = behaviorName.indexOf('::');
  const defPart  = colonIdx >= 0 ? behaviorName.slice(colonIdx + 2) : behaviorName;

  // Find every perform action usage whose type matches this behavior's def name.
  const performNames = new Set(
    behavior.actions
      .filter(a =>
        (a.type === 'PerformActionUsage' || a.type === 'ActionUsage') &&
        a.actionType === defPart,
      )
      .map(a => a.name),
  );

  const map = new Map<string, string>();
  for (const alloc of allocations) {
    if (alloc.sourcePath.length < 2) continue;
    if (!performNames.has(alloc.sourcePath[0])) continue;
    // Last segment = action name; first = perform usage name.
    const actionName = alloc.sourcePath[alloc.sourcePath.length - 1];
    map.set(actionName, alloc.targetName);
  }
  return map;
}

// ── Conditional edge descriptor ───────────────────────────────────────────────

interface CondEdge {
  condId:     string;
  targetName: string;
  label:      string;
  color:      string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OfficialBehaviorView({ behavior, behaviorName, behaviorNames, onBehaviorChange, onSelect, onShapeContextMenu, selection, focusSubtree }: Props) {
  // ReactFlow instance ref for programmatic fitView (Focus Subtree)
  const rfInstanceRef = useRef<ReturnType<typeof useReactFlow> | null>(null);

  // ── Allocation / swimlane data ────────────────────────────────────────────────
  // Map: action name → assigned part name (from allocate statements).
  const actionAllocMap = useMemo(
    () => (behavior ? buildActionAllocMap(behavior, behaviorName) : new Map<string, string>()),
    [behavior, behaviorName],
  );

  // Stable ordered list of part names → color.
  const laneColors = useMemo<Map<string, string>>(() => {
    const seen = new Map<string, string>();
    let i = 0;
    for (const partName of actionAllocMap.values()) {
      if (!seen.has(partName)) {
        seen.set(partName, LANE_COLORS[i % LANE_COLORS.length]);
        i++;
      }
    }
    return seen;
  }, [actionAllocMap]);

  // ── Position state managed by ELK (async) ────────────────────────────────────
  const [displayNodes,   setDisplayNodes]   = useState<Node[]>([]);
  const [autoFitVersion, setAutoFitVersion] = useState(0);
  const [resetVersion,   setResetVersion]   = useState(0);
  // Edge spotlight: clicking an edge highlights it (bright + glow) and dims the rest.
  // Click pane or the same edge again to clear.
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  // positionsRef: stable drag + ELK positions; survives rfNodes style re-renders.
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // layoutRunRef: key of the most recently completed ELK run; used to skip
  // style-sync when ELK hasn't finished yet for a new behavior/reset.
  const layoutRunRef = useRef('');

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

    type ControlFlowItem = Extract<(typeof behavior)['flows'][number], { source: string; type: 'succession' | 'transition' }>;
    type ItemFlowItem    = Extract<(typeof behavior)['flows'][number], { type: 'itemFlow' }>;

    // ── PartDefinition container (no ActionDefinition wrapper) ────────────────
    const PART_DEF_PREFIX = 'part def::';
    if (behaviorName.startsWith(PART_DEF_PREFIX)) {
      const partDefName = behaviorName.slice(PART_DEF_PREFIX.length);

      // Typed usages: action init : Init;
      const typedUsages = behavior.actions.filter(
        a => (a.type === 'ActionUsage' || a.type === 'PerformActionUsage') &&
             a.owningDefName === partDefName && !a.ownerId,
      );
      // Inline bodies: action init { ... } parsed as ActionDefinition by the pilot parser.
      // Exclude any ActionDef that is referenced by a typed usage above (those are proper defs).
      const referencedTypeNames = new Set(typedUsages.map(a => a.actionType).filter(Boolean) as string[]);
      const inlineDefs = behavior.actions.filter(
        a => a.type === 'ActionDefinition' && a.owningDefName === partDefName &&
             !referencedTypeNames.has(a.name),
      );
      const actionUsages = [...typedUsages, ...inlineDefs];
      if (actionUsages.length === 0) return { rfNodes: [], rfEdges: [] };

      const actionNameSet = new Set(actionUsages.map(a => a.name));
      const outgoing = new Map<string, string[]>();
      const resolvedFlows = behavior.flows.filter(
        (f): f is ControlFlowItem =>
          (f.type === 'succession' || f.type === 'transition') &&
          'source' in f && actionNameSet.has(f.source) && actionNameSet.has(f.target),
      );
      for (const f of resolvedFlows) {
        if (!outgoing.has(f.source)) outgoing.set(f.source, []);
        outgoing.get(f.source)!.push(f.target);
      }

      const partNodes: Node[] = actionUsages.map(a => {
        const nodeId  = `oact-${behaviorName}-${a.name}`;
        const targets = outgoing.get(a.name) ?? [];
        const dims    = behaviorNodeDims(a.name, a.actionType, targets.length > 1, '«action»', [], [], !!a.asil);
        return {
          id:       nodeId,
          position: { x: 0, y: 0 },
          data: {
            label: (
              <div style={{ textAlign: 'center', lineHeight: 1.35 }}>
                <div style={{ fontSize: 9, color: ACT_STEREO, letterSpacing: '0.4px' }}>«action»</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: ACT_NAME }}>{a.name}</div>
                {a.actionType && (
                  <div style={{ fontSize: 10, color: '#4a9fc0', marginTop: 1 }}>: {a.actionType}</div>
                )}
                {a.asil && <div style={{ marginTop: 3 }}><AsilBadge level={a.asil} /></div>}
              </div>
            ),
            _sel: {
              id: nodeId, type: 'actionInst', name: a.name,
              extra: { behavior: behaviorName, ...(a.actionType ? { actionType: a.actionType } : {}) },
            } satisfies SelectionState,
          },
          style: {
            background: ACT_BG, border: `1px solid ${ACT_BORDER}`, borderRadius: 7,
            padding: '6px 10px', width: dims.w, height: dims.h,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        };
      });

      const partEdges: Edge[] = resolvedFlows.map((f, i) => ({
        id:        `oflow-${behaviorName}-${i}-${f.source}-${f.target}`,
        source:    `oact-${behaviorName}-${f.source}`,
        target:    `oact-${behaviorName}-${f.target}`,
        type:      'smoothstep',
        style:     { stroke: ACT_BORDER, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: ACT_BORDER, width: 14, height: 14 },
      }));

      return { rfNodes: partNodes, rfEdges: partEdges };
    }

    // ── ActionDefinition-based behavior ───────────────────────────────────────

    // behaviorName may be 'Controller::Startup' (qualified) or 'Startup' (unqualified).
    const colonIdx  = behaviorName.indexOf('::');
    const ownerPart = colonIdx >= 0 ? behaviorName.slice(0, colonIdx) : null;
    const defPart   = colonIdx >= 0 ? behaviorName.slice(colonIdx + 2) : behaviorName;

    const def = behavior.actions.find(a =>
      (a.type === 'ActionDefinition' || a.type === 'ActionUsage' || a.type === 'PerformActionUsage') &&
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

    // Collect resolved succession / transition flows that belong to this definition.
    // Use path-prefix matching on flow IDs (which are built as "flow:<def-path>.<n>...")
    // rather than source-name matching, because sibling action defs can share identical
    // action names (e.g. CheckBothGroup0AndGroup1Filled in Group0 vs Group1 defs) and
    // name-based filtering would let both defs' flows bleed in.
    const defPrefix = `flow:${def.id}.`;
    const resolvedFlows = behavior.flows.filter(
      (f): f is ControlFlowItem =>
        (f.type === 'succession' || f.type === 'transition') &&
        'source' in f && f.id.startsWith(defPrefix),
    );
    const itemFlows = behavior.flows.filter(
      (f): f is ItemFlowItem => f.type === 'itemFlow' && f.id.startsWith(defPrefix),
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

    // ── Node dimension helpers ─────────────────────────────────────────────────

    const nodeDims = new Map<string, { w: number; h: number }>();
    for (const a of actionUsages) {
      const targets = outgoing.get(a.name) ?? [];
      if (FORK_JOIN_TYPES.has(a.type)) {
        const kind     = a.type === 'ForkNode' ? 'fork' : 'join';
        const labelLen = `«${kind}» ${a.name}`.length;
        nodeDims.set(a.name, { w: Math.max(FORK_JOIN_MIN_W, labelLen * 5.5 + 16), h: FORK_JOIN_NODE_H });
      } else if (DECIDE_MERGE_TYPES.has(a.type)) {
        nodeDims.set(a.name, { w: DIAMOND_NODE_W, h: DIAMOND_NODE_H });
      } else {
        const isBranch = targets.length > 1;
        const inPorts  = (a.ports ?? []).filter(p => p.direction === 'in');
        const outPorts = (a.ports ?? []).filter(p => p.direction === 'out');
        nodeDims.set(a.name, behaviorNodeDims(a.name, a.actionType, isBranch, '«action»', inPorts, outPorts, !!a.asil));
      }
    }
    for (const c of ownedConditionals) {
      const isLoop   = c.type === 'whileLoop';
      const condText = c.conditionText ?? (isLoop ? 'loop' : 'if');
      nodeDims.set(c.id, behaviorNodeDims(condText, undefined, false, isLoop ? '«loop»' : '«condition»'));
    }

    // Nodes start at origin — ELK positions them asynchronously.
    const DUMMY_POS = { x: 0, y: 0 };

    const actNodes: Node[] = actionUsages.map(a => {
      const nodeId    = `oact-${behaviorName}-${a.name}`;
      const targets   = outgoing.get(a.name) ?? [];
      const dims      = nodeDims.get(a.name) ?? { w: NODE_W, h: NODE_H };
      const allocPart = actionAllocMap.get(a.name);
      const sel: SelectionState = {
        id:   nodeId,
        type: 'actionInst',
        name: a.name,
        extra: {
          behavior: behaviorName,
          ...(a.actionType ? { actionType: a.actionType } : {}),
          ...(targets.length > 0 ? { outgoingTargets: targets.join(',') } : {}),
          ...(allocPart ? { allocatedTo: allocPart } : {}),
        },
      };

      // ── Fork/Join: solid bar (official SysML v2 §12 notation) ────────────
      if (FORK_JOIN_TYPES.has(a.type)) {
        const kind: ControlNodeKind = a.type === 'ForkNode' ? 'fork' : 'join';
        return {
          id:       nodeId,
          position: DUMMY_POS,
          type:     'forkJoinBar',
          data: { name: a.name, kind, allocatedTo: allocPart, _sel: sel } satisfies ControlNodeData,
          style: { width: dims.w, height: dims.h, background: 'transparent', border: 'none' },
        };
      }

      // ── Decision/Merge: diamond (official SysML v2 §12 notation) ─────────
      if (DECIDE_MERGE_TYPES.has(a.type)) {
        const kind: ControlNodeKind = a.type === 'DecisionNode' ? 'decision' : 'merge';
        return {
          id:       nodeId,
          position: DUMMY_POS,
          type:     'decideMergeDiamond',
          data: { name: a.name, kind, allocatedTo: allocPart, _sel: sel } satisfies ControlNodeData,
          style: { width: dims.w, height: dims.h, background: 'transparent', border: 'none' },
        };
      }

      // ── Regular action / perform-action usage ────────────────────────────
      const isBranch = targets.length > 1;
      const inPorts  = (a.ports ?? []).filter(p => p.direction === 'in');
      const outPorts = (a.ports ?? []).filter(p => p.direction === 'out');

      return {
        id:       nodeId,
        position: DUMMY_POS,
        type:     'portAction',
        data: {
          name:       a.name,
          stereotype: '«action»',
          stereoClr:  ACT_STEREO,
          nameClr:    ACT_NAME,
          actionType: a.actionType,
          asil:       a.asil,
          ports:      [...inPorts, ...outPorts],
          isBranch,
          targets,
          allocatedTo: allocPart,
          _sel:        sel,
        },
        style: {
          background:   ACT_BG,
          border:       `1px solid ${isBranch ? BRANCH_COLOR : ACT_BORDER}`,
          borderRadius: 7,
          width:        dims.w,
          height:       dims.h,
        },
      };
    });

    const actNodeIds = new Set(actNodes.map(n => n.id));

    // ── Boundary parameter nodes (activity parameter nodes per SysML v2 §10) ──
    // Only emit nodes for params that actually appear in an item flow, so the
    // diagram stays clean.  These nodes are positioned later in a fixed left
    // (in) / right (out) column — they are NOT laid out by ELK.
    const defPortMap = new Map((def.ports ?? []).map(p => [p.name, p]));
    const referencedBoundaryParams = new Set<string>();
    for (const f of itemFlows) {
      if (f.sourcePort === null) referencedBoundaryParams.add(f.source);
      if (f.targetPort === null) referencedBoundaryParams.add(f.target);
    }
    const boundaryParamNodes: Node[] = [...referencedBoundaryParams]
      .filter(name => defPortMap.has(name))
      .map(name => {
        const port   = defPortMap.get(name)!;
        const nodeId = `oparam-${behaviorName}-${name}`;
        return {
          id:       nodeId,
          position: DUMMY_POS,
          type:     'boundaryParam',
          data: {
            name:      port.name,
            direction: port.direction,
            _sel: {
              id: nodeId, type: 'actionInst', name: port.name,
              extra: { behavior: behaviorName, paramDirection: port.direction },
            } satisfies SelectionState,
          },
          style: { width: PARAM_W, height: PARAM_H },
          draggable: false,
        };
      });
    const boundaryNodeIds = new Set(boundaryParamNodes.map(n => n.id));

    // ── Succession / transition edges ──────────────────────────────────────────

    const flowEdges: Edge[] = resolvedFlows.map((f, i) => {
      const srcId     = `oact-${behaviorName}-${f.source}`;
      const tgtId     = `oact-${behaviorName}-${f.target}`;
      const srcBranch = (outgoing.get(f.source)?.length ?? 0) > 1;
      const isGuarded = f.type === 'transition' && 'guard' in f && f.guard !== undefined;
      const guardText = isGuarded ? (f as { guard: string }).guard : undefined;
      const isNegated = guardText?.startsWith('not ') ?? false;
      const guardColor = isNegated ? ELSE_COLOR : THEN_COLOR;
      const edgeColor = isGuarded ? guardColor : (srcBranch ? BRANCH_COLOR : ACT_BORDER);
      return {
        // Index-qualified: two successions can share the same source/target names (and a
        // model may legitimately declare parallel edges), so a name-only id collides —
        // React then drops one of the duplicates and the edge silently vanishes.
        id:           `oflow-${behaviorName}-${i}-${f.source}-${f.target}`,
        source:       srcId,
        target:       tgtId,
        sourceHandle: 'ctrl-out',
        targetHandle: 'ctrl-in',
        type:         'smoothstep',
        ...(guardText !== undefined ? {
          label:        `[${guardText}]`,
          labelStyle:   { fill: guardColor, fontSize: 10, fontWeight: 600, fontFamily: 'monospace' },
          labelBgStyle: { fill: isNegated ? '#1f0a0a' : '#0b1e0b', fillOpacity: 0.9, rx: 3, ry: 3 },
        } : {}),
        style:     { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: '6 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
      };
    });

    // ── Item flow edges ────────────────────────────────────────────────────────
    // Endpoints with a null port refer to a boundary parameter node; non-null
    // ports refer to an action port handle.

    const actionByName = new Map(actionUsages.map(a => [a.name, a]));
    const allVisibleIds = new Set([...actNodeIds, ...boundaryNodeIds]);
    const itemFlowEdges: Edge[] = itemFlows.flatMap((f, i) => {
      const srcId = f.sourcePort !== null
        ? `oact-${behaviorName}-${f.source}`
        : `oparam-${behaviorName}-${f.source}`;
      const tgtId = f.targetPort !== null
        ? `oact-${behaviorName}-${f.target}`
        : `oparam-${behaviorName}-${f.target}`;
      if (!allVisibleIds.has(srcId) || !allVisibleIds.has(tgtId)) return [];

      const srcAction  = f.sourcePort !== null ? actionByName.get(f.source) : undefined;
      const srcPortDef = srcAction?.ports?.find(p => p.name === f.sourcePort);
      const itemType   = srcPortDef?.itemType ?? f.sourcePort ?? f.targetPort ?? undefined;
      const srcHandle  = f.sourcePort !== null ? `out-${f.sourcePort}` : 'param-port';
      const tgtHandle  = f.targetPort !== null ? `in-${f.targetPort}`  : 'param-port';

      return [{
        id:           `oiflow-${behaviorName}-${i}-${f.source}.${f.sourcePort ?? 'bnd'}-${f.target}.${f.targetPort ?? 'bnd'}`,
        source:       srcId,
        target:       tgtId,
        sourceHandle: srcHandle,
        targetHandle: tgtHandle,
        type:         'smoothstep',
        ...(itemType !== undefined ? {
          label:        itemType,
          labelStyle:   { fill: ITEM_FLOW_COLOR, fontSize: 8, fontWeight: 500, fontFamily: 'monospace' },
          labelBgStyle: { fill: '#041e26', fillOpacity: 0.9, rx: 3, ry: 3 },
        } : {}),
        style:        { stroke: ITEM_FLOW_COLOR, strokeWidth: 1.5 },
        markerEnd:    { type: MarkerType.ArrowClosed, color: ITEM_FLOW_COLOR, width: 12, height: 12 },
      } satisfies Edge];
    });

    // ── Conditional nodes ──────────────────────────────────────────────────────

    const condNodes: Node[] = ownedConditionals.map(c => {
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
        position: DUMMY_POS,
        data: {
          label: (
            <div style={{ textAlign: 'center', lineHeight: 1.35 }}>
              <div style={{ fontSize: 9, color: stereo, letterSpacing: '0.4px' }}>
                {isLoop ? '«loop»' : '«condition»'}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: nameClr }}>{condText}</div>
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
          background: bg, border: `1px solid ${border}`, borderRadius: 7,
          padding: '6px 10px', width: dims.w, height: dims.h,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        },
      };
    });

    // ── Conditional branch edges ───────────────────────────────────────────────

    const condBranchEdges: Edge[] = condEdges
      .filter(e => actNodeIds.has(`oact-${behaviorName}-${e.targetName}`))
      .map((e, i) => ({
        id:           `ocond-edge-${behaviorName}-${i}-${e.condId}-${e.targetName}`,
        source:       `ocond-${behaviorName}-${e.condId}`,
        target:       `oact-${behaviorName}-${e.targetName}`,
        targetHandle: 'ctrl-in',
        type:         'smoothstep',
        label:        e.label,
        labelStyle:   { fill: e.color, fontSize: 10, fontWeight: 600, fontFamily: 'monospace' },
        labelBgStyle: { fill: '#0a0f0a', fillOpacity: 0.9, rx: 3, ry: 3 },
        style:        { stroke: e.color, strokeWidth: 1.5 },
        markerEnd:    { type: MarkerType.ArrowClosed, color: e.color, width: 14, height: 14 },
      }));

    return {
      rfNodes: [...actNodes, ...condNodes, ...boundaryParamNodes],
      rfEdges: [...flowEdges, ...itemFlowEdges, ...condBranchEdges],
    };
  }, [behavior, behaviorName]);

  // ── ELK layout — runs when behavior or reset changes (NOT on selection) ───────
  useEffect(() => {
    const key = `${behaviorName}::${resetVersion}`;
    layoutRunRef.current = '';  // mark layout as pending
    if (!rfNodes.length) {
      positionsRef.current = new Map();
      setDisplayNodes([]);
      return;
    }
    let cancelled = false;

    // Boundary params are NOT laid out by ELK — they go into fixed left/right
    // columns flanking the action graph.  ELK only sees actions + conditionals.
    const elkInputNodes = rfNodes.filter(n => n.type !== 'boundaryParam');
    const paramNodes    = rfNodes.filter(n => n.type === 'boundaryParam');
    const elkInputIds   = new Set(elkInputNodes.map(n => n.id));

    const elkNodes = elkInputNodes.map(n => ({
      id:     n.id,
      width:  Number((n.style as Record<string, unknown>)?.['width']  ?? NODE_W),
      height: Number((n.style as Record<string, unknown>)?.['height'] ?? NODE_H),
    }));
    // Skip edges that touch a boundary param — those would distort the layered layout.
    const elkEdges = rfEdges
      .filter(e => elkInputIds.has(e.source) && elkInputIds.has(e.target))
      .map(e => ({ id: e.id, source: e.source, target: e.target }));

    // Build lane map for per-column swimlane layout (nodeId → lane index).
    const laneOrder = [...laneColors.keys()];
    const elkLaneMap = new Map<string, number>();
    if (laneOrder.length > 0) {
      for (const rfNode of elkInputNodes) {
        const allocPart = (rfNode.data as Record<string, unknown>)?.allocatedTo as string | undefined;
        if (allocPart !== undefined) {
          const idx = laneOrder.indexOf(allocPart);
          if (idx >= 0) elkLaneMap.set(rfNode.id, idx);
        }
      }
    }

    applyBehaviorLayout(elkNodes, elkEdges, elkLaneMap.size > 0 ? elkLaneMap : undefined).then(positions => {
      if (cancelled) return;

      // ── Compute bounding box of ELK-placed nodes (action graph extent) ────
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of elkInputNodes) {
        const pos = positions.get(n.id);
        if (!pos) continue;
        const w = Number((n.style as Record<string, unknown>)?.['width']  ?? NODE_W);
        const h = Number((n.style as Record<string, unknown>)?.['height'] ?? NODE_H);
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + w);
        maxY = Math.max(maxY, pos.y + h);
      }
      if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

      // Part containers extend slightly beyond the action positions.
      const hasContainers = laneColors.size > 0;
      const padL = hasContainers ? PART_PAD : 0;
      const padR = hasContainers ? PART_PAD : 0;
      const leftCol  = minX - padL - PARAM_GAP_X - PARAM_W;
      const rightCol = maxX + padR + PARAM_GAP_X;

      // For each boundary param, compute the AVERAGE Y of its connected action
      // node(s). Using the average (not the min) centers the param near the
      // middle of its fan-in/fan-out, which keeps item-flow edges short.
      const paramPrefix = `oparam-${behaviorName}-`;
      const connectedYSum = new Map<string, { sum: number; count: number }>();
      const bump = (paramId: string, otherY: number) => {
        const cur = connectedYSum.get(paramId) ?? { sum: 0, count: 0 };
        connectedYSum.set(paramId, { sum: cur.sum + otherY, count: cur.count + 1 });
      };
      for (const e of rfEdges) {
        const srcIsParam = e.source.startsWith(paramPrefix);
        const tgtIsParam = e.target.startsWith(paramPrefix);
        if (srcIsParam && !tgtIsParam) {
          const p = positions.get(e.target);
          if (p) bump(e.source, p.y);
        } else if (tgtIsParam && !srcIsParam) {
          const p = positions.get(e.source);
          if (p) bump(e.target, p.y);
        }
      }
      const connectedY = new Map<string, number>();
      for (const [id, { sum, count }] of connectedYSum) connectedY.set(id, sum / count);
      const graphMidY = (minY + maxY) / 2;
      const sortByConnectedY = (a: Node, b: Node) =>
        (connectedY.get(a.id) ?? graphMidY) - (connectedY.get(b.id) ?? graphMidY);

      const paramDir = (n: Node) => (n.data as unknown as BoundaryParamNodeData).direction;
      const inParams  = paramNodes.filter(n => paramDir(n) === 'in').sort(sortByConnectedY);
      const outParams = paramNodes.filter(n => paramDir(n) === 'out').sort(sortByConnectedY);

      // Place each param close to its connected action's Y, enforcing a minimum
      // PARAM_H + PARAM_GAP_Y vertical spacing so they never overlap.  Stacks
      // collapse upward against minY so they don't drift above the graph.
      const placeParams = (params: Node[], x: number) => {
        let prevBottom = minY;  // floor: never above the graph
        for (const p of params) {
          const preferred = connectedY.get(p.id) ?? graphMidY;
          const y = Math.max(preferred, prevBottom);
          positions.set(p.id, { x, y });
          prevBottom = y + PARAM_H + PARAM_GAP_Y;
        }
      };
      placeParams(inParams,  leftCol);
      placeParams(outParams, rightCol);

      positionsRef.current = positions;
      layoutRunRef.current = key;
      const positionedNodes = rfNodes.map(n => ({ ...n, position: positions.get(n.id) ?? n.position }));
      setDisplayNodes(buildCompoundLayout(positionedNodes, laneColors));
      setAutoFitVersion(v => v + 1);
    }).catch(console.error);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [behaviorName, resetVersion]);

  // ── Style sync — merge selection highlights without losing ELK/drag positions ─
  useEffect(() => {
    const key = `${behaviorName}::${resetVersion}`;
    if (layoutRunRef.current !== key) return;  // ELK hasn't finished for this key yet
    const positionedNodes = rfNodes.map(n => ({
      ...n,
      position: positionsRef.current.get(n.id) ?? n.position,
    }));
    setDisplayNodes(buildCompoundLayout(positionedNodes, laneColors));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfNodes]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setDisplayNodes(prev => applyNodeChanges(changes, prev));
  }, []);

  // Only persist positions for root-level nodes (no parentId).
  // Compound children use relative positions that must not overwrite the absolute
  // ELK positions in positionsRef (which buildCompoundLayout depends on).
  const handleNodeDragStop = useCallback((_e: React.MouseEvent, node: Node) => {
    if (!node.parentId) positionsRef.current.set(node.id, node.position);
  }, []);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const s = node.data?._sel as SelectionState;
    if (s) onSelect(s);
  }, [onSelect]);

  // ── Edge spotlight handlers ─────────────────────────────────────────────────
  const handleEdgeClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.stopPropagation();
    setSelectedEdgeId(prev => (prev === edge.id ? null : edge.id));
  }, []);
  const handlePaneClick = useCallback(() => setSelectedEdgeId(null), []);

  // displayEdges: apply spotlight styling — selected edge gets a thick stroke
  // with a coloured glow and a high z-index; everyone else fades to low opacity.
  const displayEdges = useMemo<Edge[]>(() => {
    if (!selectedEdgeId) return rfEdges;
    return rfEdges.map(e => {
      if (e.id === selectedEdgeId) {
        const stroke = (e.style as { stroke?: string } | undefined)?.stroke ?? '#fde047';
        return {
          ...e,
          style: {
            ...e.style,
            strokeWidth: 3.5,
            opacity:     1,
            filter:      `drop-shadow(0 0 4px ${stroke}) drop-shadow(0 0 10px ${stroke})`,
          },
          labelStyle: { ...(e.labelStyle ?? {}), fontWeight: 700, fontSize: 11 },
          zIndex:     1000,
        };
      }
      return { ...e, style: { ...e.style, opacity: 0.18 } };
    });
  }, [rfEdges, selectedEdgeId]);

  // styledNodes: when an edge is selected, ring its source + target nodes in
  // amber so the eye can trace the lit-up edge to its endpoints quickly.
  const styledNodes = useMemo<Node[]>(() => {
    const base = displayNodes.length > 0 ? displayNodes : rfNodes;
    if (!selectedEdgeId) return base;
    const edge = rfEdges.find(e => e.id === selectedEdgeId);
    if (!edge) return base;
    return base.map(n => (n.id === edge.source || n.id === edge.target)
      ? { ...n, style: { ...n.style, boxShadow: '0 0 0 2px #fde047, 0 0 14px #fde047aa' } }
      : n);
  }, [displayNodes, rfNodes, rfEdges, selectedEdgeId]);

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
        {behaviorNames.map(name => {
          const PART_DEF_PREFIX = 'part def::';
          const display = name.startsWith(PART_DEF_PREFIX)
            ? `${name.slice(PART_DEF_PREFIX.length)} (part def)`
            : name;
          return <option key={name} value={name}>{display}</option>;
        })}
      </select>
      <span style={{ color: '#334155', fontSize: 11 }}>
        {rfNodes.length > 0
          ? `${rfNodes.length} node${rfNodes.length !== 1 ? 's' : ''} · ${rfEdges.length} edge${rfEdges.length !== 1 ? 's' : ''}`
          : ''}
      </span>
      <span style={{ marginLeft: 'auto' }}>
        <span style={{ color: '#1e3a5f', fontSize: 10 }}>
          Actions · action instances + succession flows
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
          nodes={styledNodes}
          edges={displayEdges}
          nodeTypes={ALL_NODE_TYPES}
          onNodeClick={handleNodeClick}
          onNodesChange={handleNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onEdgeClick={handleEdgeClick}
          onNodeContextMenu={(e, n) => { const s = n.data?._sel as SelectionState; if (s) onShapeContextMenu?.(e, s); }}
          onEdgeContextMenu={(e, ed) => { const s = ed.data?._sel as SelectionState; if (s) onShapeContextMenu?.(e, s); }}
          onPaneClick={handlePaneClick}
          onInit={inst => { rfInstanceRef.current = inst as ReturnType<typeof useReactFlow>; }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background color="#1a2a3a" gap={24} />
          <Controls showFitView={false} />
          <FitPanel padding={0.2} autoFitVersion={autoFitVersion} onReset={() => setResetVersion(v => v + 1)} />
        </ReactFlow>
      </div>
    </div>
  );
}
