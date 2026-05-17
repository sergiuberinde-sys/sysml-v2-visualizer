/**
 * ELK-based layout and edge routing for the Structure View.
 *
 * applyElkLayout          — fixed positions, orthogonal edge routing only.
 * applyHierarchicalLayout — two modes depending on opts.algorithm:
 *   'layered' (default) — two-pass: ELK layered (DOWN) positions nodes into
 *     two layers (all defs at top, all usages below), then ELK fixed routes
 *     all edges as obstacle-avoiding orthogonal polylines.
 *   'stress' — single-pass ELK stress (force-directed) using all edges as
 *     springs.  Produces free-form node placement with minimal crossings;
 *     no Pass 2 so edges use React Flow's native bezier rendering.
 */

import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';

// ── Public types ──────────────────────────────────────────────────────────────

export type LayoutMode = 'lr' | 'tb' | 'compact' | 'manual';

export const LAYOUT_LABELS: Record<LayoutMode, string> = {
  lr:      'Left → Right',
  tb:      'Top → Bottom',
  compact: 'Compact LR',
  manual:  'Manual',
};

/** Map from React Flow edge id → ELK bend points (world-coordinate waypoints). */
export type ElkRouteMap = Map<string, { x: number; y: number }[]>;

// ── ELK instance (shared, stateless between layout calls) ─────────────────────

const elk = new ELK();

// ── ELK options: fixed positions, orthogonal routing ─────────────────────────

// 'fixed' algorithm keeps every node at the position we supply and only
// computes obstacle-avoiding ORTHOGONAL routes for the edges.
// edgeNode=40 keeps routes 40 px clear of every node face.
const FIXED_ROUTING_OPTIONS: Record<string, string> = {
  'elk.algorithm':        'fixed',
  'elk.edgeRouting':      'ORTHOGONAL',
  'elk.spacing.edgeNode': '28',   // clearance from node face
  'elk.spacing.edgeEdge': '20',   // gap between parallel edge segments
};

// ── Port assignment ───────────────────────────────────────────────────────────

type NodeInfo = { id: string; x: number; y: number; width: number; height: number };
type EdgeInfo = { id: string; source: string; target: string };

/** Returns the face of `src` that an edge toward `tgt` would exit from. */
function faceOf(src: NodeInfo, tgt: NodeInfo): 'left' | 'right' | 'top' | 'bottom' {
  const dx = (tgt.x + tgt.width / 2)  - (src.x + src.width / 2);
  const dy = (tgt.y + tgt.height / 2) - (src.y + src.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

/**
 * Assign explicit ELK FIXED_POS ports to nodes that have ≥2 edges on the same face.
 *
 * Without explicit ports ELK routes all edges to the face centre, producing a
 * single-line appearance.  With ports distributed evenly along the face, ELK
 * routes each edge from its unique attachment point, giving naturally diverging
 * full paths throughout the entire route (not just at the endpoint).
 */
function assignPorts(
  nodesList: NodeInfo[],
  edgesList: EdgeInfo[],
): { children: ElkNode[]; edges: ElkExtendedEdge[] } {
  const nodeMap = new Map(nodesList.map(n => [n.id, n]));

  type FaceEdge = { eid: string; role: 'src' | 'tgt' };
  const faceEdges = new Map<string, FaceEdge[]>();

  for (const e of edgesList) {
    const src = nodeMap.get(e.source);
    const tgt = nodeMap.get(e.target);
    if (!src || !tgt) continue;
    const srcFace = faceOf(src, tgt);
    const tgtFace = faceOf(tgt, src);
    for (const [key, role] of [
      [`${e.source}:${srcFace}`, 'src' as const],
      [`${e.target}:${tgtFace}`, 'tgt' as const],
    ] as const) {
      if (!faceEdges.has(key)) faceEdges.set(key, []);
      faceEdges.get(key)!.push({ eid: e.id, role });
    }
  }

  // portMap: nodeId → [{id, x, y}]    edgePortMap: "eid:role" → portId
  const portMap     = new Map<string, { id: string; x: number; y: number }[]>();
  const edgePortMap = new Map<string, string>();

  for (const [faceKey, fedges] of faceEdges) {
    if (fedges.length < 2) continue;
    const colonIdx = faceKey.lastIndexOf(':');
    const nodeId   = faceKey.slice(0, colonIdx);
    const face     = faceKey.slice(colonIdx + 1) as 'left' | 'right' | 'top' | 'bottom';
    const nd       = nodeMap.get(nodeId);
    if (!nd) continue;

    const isLR = face === 'left' || face === 'right';

    // Sort by the OTHER endpoint's position along the face axis → fewer crossings.
    const sorted = [...fedges].sort((a, b) => {
      const eA = edgesList.find(e => e.id === a.eid)!;
      const eB = edgesList.find(e => e.id === b.eid)!;
      const oA = nodeMap.get(a.role === 'src' ? eA.target : eA.source);
      const oB = nodeMap.get(b.role === 'src' ? eB.target : eB.source);
      if (!oA || !oB) return 0;
      const pA = isLR ? (oA.y + oA.height / 2) : (oA.x + oA.width / 2);
      const pB = isLR ? (oB.y + oB.height / 2) : (oB.x + oB.width / 2);
      return pA - pB;
    });

    const faceLen = isLR ? nd.height : nd.width;
    const step    = faceLen / (sorted.length + 1);
    if (!portMap.has(nodeId)) portMap.set(nodeId, []);

    sorted.forEach((fe, i) => {
      const portId = `port-${nodeId}-${face}-${i}`;
      const offset = step * (i + 1);
      let px: number, py: number;
      switch (face) {
        case 'left':   px = 0;         py = offset; break;
        case 'right':  px = nd.width;  py = offset; break;
        case 'top':    px = offset;    py = 0;       break;
        default:       px = offset;    py = nd.height; break;
      }
      portMap.get(nodeId)!.push({ id: portId, x: px, y: py });
      edgePortMap.set(`${fe.eid}:${fe.role}`, portId);
    });
  }

  const children: ElkNode[] = nodesList.map(n => {
    const ports = portMap.get(n.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node: ElkNode = { id: n.id, x: n.x, y: n.y, width: n.width, height: n.height } as any;
    if (ports?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node as any).ports = ports.map(p => ({ id: p.id, x: p.x, y: p.y, width: 0, height: 0 }));
      node.layoutOptions  = { 'elk.portConstraints': 'FIXED_POS' };
    }
    return node;
  });

  const edges: ElkExtendedEdge[] = edgesList.map(e => ({
    id:      e.id,
    sources: [edgePortMap.get(`${e.id}:src`) ?? e.source],
    targets: [edgePortMap.get(`${e.id}:tgt`) ?? e.target],
  }));

  return { children, edges };
}

// ── Endpoint spreading ────────────────────────────────────────────────────────

/**
 * Spread overlapping edge endpoints on the same node face.
 *
 * ELK FIXED routes each edge independently and places multiple endpoints at
 * the same pixel on a face (e.g. an incoming featureTyping and an outgoing
 * composition edge both landing at the y-centre of a portDef's right face).
 * This step redistributes them evenly across the face whenever they are
 * within MIN_SPREAD px of each other.
 */
function spreadFaceEndpoints(
  routes: ElkRouteMap,
  nodes:  Array<{ id: string; x?: number; y?: number; width?: number; height?: number }>,
): void {
  const SNAP       = 6;  // px tolerance for "on a face"
  const MIN_SPREAD = 14; // skip redistribution only when every adjacent pair is already >= this apart

  type FaceEntry = { edgeId: string; ptIdx: number };
  const faceMap = new Map<string, FaceEntry[]>();

  for (const [edgeId, pts] of routes) {
    if (pts.length < 2) continue;
    for (const ptIdx of [0, pts.length - 1]) {
      const pt = pts[ptIdx];
      for (const n of nodes) {
        const nx = n.x ?? 0;
        const ny = n.y ?? 0;
        const nw = n.width  ?? 172;
        const nh = n.height ?? 48;
        let face: string | null = null;
        if      (Math.abs(pt.x - nx)        < SNAP) face = `${n.id}:left`;
        else if (Math.abs(pt.x - (nx + nw)) < SNAP) face = `${n.id}:right`;
        else if (Math.abs(pt.y - ny)        < SNAP) face = `${n.id}:top`;
        else if (Math.abs(pt.y - (ny + nh)) < SNAP) face = `${n.id}:bottom`;
        if (face) {
          let arr = faceMap.get(face);
          if (!arr) { arr = []; faceMap.set(face, arr); }
          arr.push({ edgeId, ptIdx });
          break;
        }
      }
    }
  }

  for (const [faceKey, entries] of faceMap) {
    if (entries.length < 2) continue;
    const colonIdx = faceKey.lastIndexOf(':');
    const nodeId   = faceKey.slice(0, colonIdx);
    const side     = faceKey.slice(colonIdx + 1) as 'left' | 'right' | 'top' | 'bottom';
    const nd       = nodes.find(n => n.id === nodeId);
    if (!nd) continue;

    const nx = nd.x ?? 0;
    const ny = nd.y ?? 0;
    const nw = nd.width  ?? 172;
    const nh = nd.height ?? 48;

    const isLR = side === 'left' || side === 'right';
    const coords = entries.map(e => {
      const pt = routes.get(e.edgeId)![e.ptIdx];
      return isLR ? pt.y : pt.x;
    });
    // Skip only when every adjacent pair is already spread enough.
    // Checking overall range misses cases where some pairs are still stacked
    // (e.g. 3 edges at y=100 and 1 at y=130 → range=30 but 3 are still overlapping).
    const sorted = [...coords].sort((a, b) => a - b);
    const minGap = sorted.length > 1
      ? Math.min(...sorted.slice(1).map((c, i) => c - sorted[i]))
      : Infinity;
    if (minGap >= MIN_SPREAD) continue;

    // Redistribute evenly across the face
    const faceLen    = isLR ? nh : nw;
    const faceOrigin = isLR ? ny : nx;
    const step       = faceLen / (entries.length + 1);

    entries.sort((a, b) => {
      const pA = routes.get(a.edgeId)![a.ptIdx];
      const pB = routes.get(b.edgeId)![b.ptIdx];
      return isLR ? pA.y - pB.y : pA.x - pB.x;
    });

    entries.forEach((entry, i) => {
      const pts    = routes.get(entry.edgeId)!;
      const pt     = pts[entry.ptIdx];
      const oldVal = isLR ? pt.y : pt.x;
      const newVal = faceOrigin + step * (i + 1);

      if (isLR) pt.y = newVal;
      else      pt.x = newVal;

      // Fix the adjacent waypoint to keep the first/last segment orthogonal.
      // If the segment attachment→adjacent was horizontal (same y as old pt),
      // shift adjacent y to match so the line stays axis-aligned.
      const adjIdx = entry.ptIdx === 0 ? 1 : pts.length - 2;
      const adj    = pts[adjIdx];
      if (isLR  && Math.abs(adj.y - oldVal) < SNAP) adj.y = newVal;
      if (!isLR && Math.abs(adj.x - oldVal) < SNAP) adj.x = newVal;
    });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Route edges around nodes using ELK's `fixed` algorithm.
 *
 * Node positions are taken from the input unchanged — only edge routes are
 * computed.  Falls back to the original nodes (smoothstep edges) on error.
 */
export async function applyElkLayout(
  nodes: Node[],
  edges: Edge[],
  mode: LayoutMode,
): Promise<{ nodes: Node[]; edgeRoutes: ElkRouteMap }> {
  const empty: ElkRouteMap = new Map();
  if (mode === 'manual') return { nodes, edgeRoutes: empty };

  const topNodes = nodes.filter(n => !n.parentId);
  const topIds   = new Set(topNodes.map(n => n.id));
  const style    = (n: Node) => n.style as Record<string, unknown> | undefined;

  const nodesList: NodeInfo[] = topNodes.map(n => ({
    id:     n.id,
    width:  Number(style(n)?.['width']  ?? 172),
    height: Number(style(n)?.['height'] ?? 48),
    x:      n.position.x,
    y:      n.position.y,
  }));

  const edgesList: EdgeInfo[] = edges
    .filter(e => topIds.has(e.source) && topIds.has(e.target))
    .map(e => ({ id: e.id, source: e.source, target: e.target }));

  // assignPorts distributes edges with shared face into explicit FIXED_POS
  // ports so ELK routes full diverging paths — not just the endpoint pixel.
  const { children: elkChildren, edges: elkEdges } = assignPorts(nodesList, edgesList);

  const graph: ElkNode = {
    id:            'root',
    layoutOptions: FIXED_ROUTING_OPTIONS,
    children:      elkChildren,
    edges:         elkEdges,
  };

  try {
    const laid = await elk.layout(graph);

    const edgeRoutes: ElkRouteMap = new Map();
    for (const e of (laid.edges ?? [])) {
      const section = e.sections?.[0];
      if (!section) continue;
      edgeRoutes.set(e.id, [
        { x: section.startPoint.x, y: section.startPoint.y },
        ...(section.bendPoints ?? []).map(p => ({ x: p.x, y: p.y })),
        { x: section.endPoint.x,   y: section.endPoint.y   },
      ]);
    }

    spreadFaceEndpoints(edgeRoutes, nodesList);
    return { nodes, edgeRoutes };
  } catch (err) {
    console.error('[sysml-viz] ELK routing error:', err);
    return { nodes, edgeRoutes: empty };
  }
}

// ── Hierarchical layout options ───────────────────────────────────────────────

// Pass 1: ELK layered (DOWN) to compute node positions.
// Spacing and padding values give readable gaps between the two layers.
const LAYERED_OPTIONS: Record<string, string> = {
  'elk.algorithm':                             'layered',
  'elk.direction':                             'DOWN',
  'elk.edgeRouting':                           'ORTHOGONAL',
  'elk.layered.spacing.nodeNodeBetweenLayers': '90',
  'elk.spacing.nodeNode':                      '40',
  'elk.padding':                               '[top=50,left=50,bottom=50,right=50]',
};

// Focused-element layout: ELK layered RIGHT with crossing minimisation.
// Horizontal flow mirrors the screenshot style (types/defs on LEFT, instances
// on RIGHT).  All featureTyping edges are reversed so every type definition
// ends up to the LEFT of what uses it.  Connection edges feed LAYER_SWEEP so
// nodes are ordered within each layer to minimise edge crossings.
const FOCUSED_LAYERED_OPTIONS: Record<string, string> = {
  'elk.algorithm':                                      'layered',
  'elk.direction':                                      'RIGHT',
  'elk.edgeRouting':                                    'ORTHOGONAL',
  'elk.layered.crossingMinimization.strategy':          'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy':                 'BRANDES_KOEPF',
  'elk.layered.spacing.nodeNodeBetweenLayers':          '280',
  'elk.spacing.nodeNode':                               '80',
  'elk.padding':                                        '[top=60,left=60,bottom=60,right=60]',
};

export interface HierarchicalLayoutOpts {
  /**
   * 'layered' (default) — strict top-defs / bottom-usages grid, orthogonal routing.
   * 'stress'            — force-directed free-form placement, smooth bezier edges.
   */
  algorithm?: 'layered' | 'stress';
  /** Gap between ELK layers (layered mode only, default 90). */
  layerGap?: number;
  /** Minimum gap between nodes (default 40 layered, 80 stress). */
  nodeGap?: number;
  /**
   * When false, skip Pass 2 (orthogonal routing) so edges use React Flow's
   * native bezier rendering.  Automatically false when algorithm === 'stress'.
   */
  routeEdges?: boolean;
}

/**
 * Two-pass hierarchical layout for the Structure View.
 *
 * Pass 1 — ELK `layered` (DOWN) using only composition edges plus
 *   reversed featureTyping edges.  This places all definition nodes in the
 *   top layer and all usage/instance nodes in the layer below, regardless of
 *   how many definitions are in the model.
 *
 * Pass 2 — ELK `fixed` with the positions from Pass 1 routes all original
 *   edges (composition, featureTyping, connections) as obstacle-avoiding
 *   orthogonal polylines.  Skipped when `opts.routeEdges === false`.
 */
export async function applyHierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  opts: HierarchicalLayoutOpts = {},
): Promise<{ nodes: Node[]; edgeRoutes: ElkRouteMap }> {
  const { algorithm = 'layered', layerGap = 90, nodeGap = algorithm === 'stress' ? 80 : 40, routeEdges = algorithm !== 'stress' } = opts;
  const empty: ElkRouteMap = new Map();

  // ── Focused layout path (two-pass, horizontal) ───────────────────────────
  // Pass 1: ELK layered RIGHT with LAYER_SWEEP crossing minimisation.
  //   • ALL featureTyping edges reversed → every type/portDef ends up LEFT of
  //     the element that uses it (mirrors the screenshot's left→right flow).
  //   • Composition edges flow rightward (owner LEFT, instance RIGHT).
  //   • Connection edges included so LAYER_SWEEP can also order instances.
  // Pass 2: ELK fixed ORTHOGONAL routing → clean obstacle-avoiding edge paths.
  if (algorithm === 'stress') {
    const topNodes = nodes.filter(n => !n.parentId);
    const topIds   = new Set(topNodes.map(n => n.id));
    const nodeSize = (n: Node) => {
      const s = n.style as Record<string, unknown> | undefined;
      return { width: Number(s?.['width'] ?? 172), height: Number(s?.['height'] ?? 48) };
    };

    // Connection edges (straight/smoothstep) are intentionally excluded here.
    // They use React Flow native rendering (SKIP_WAYPOINTS in StructureView) and
    // their data-flow cycles (e.g. acpdCdd ↔ acpdCddMonitoring) would force ELK's
    // cycle-breaker, causing large or degenerate layered layouts for models like
    // AcpdCdd_DataflowInterconnection.  Excluding them keeps the graph acyclic.
    const focusedEdges: ElkExtendedEdge[] = [
      // Composition: owner → instance (rightward = owner LEFT, instance RIGHT)
      ...edges
        .filter(e => topIds.has(e.source) && topIds.has(e.target) &&
          (e.type === 'compositionEdge' || e.type === 'nonCompositeMembershipEdge'))
        .map(e => ({ id: `lo-${e.id}`, sources: [e.source], targets: [e.target] })),
      // FeatureTyping edges reversed → type/portDef LEFT, usage/partDef RIGHT.
      // Exception: output-port typing edges (portDirection === 'out') stay natural
      // so ELK places those portDefs to the RIGHT of the partDef — matching where
      // the output port boundary square actually lives on the node.
      ...edges
        .filter(e => topIds.has(e.source) && topIds.has(e.target) &&
          e.type === 'featureTypingEdge' &&
          (e.data as Record<string, unknown>)?.portDirection !== 'out')
        .map(e => ({ id: `lo-rev-${e.id}`, sources: [e.target], targets: [e.source] })),
      // Output-port featureTyping: natural direction → portDef ends up RIGHT.
      ...edges
        .filter(e => topIds.has(e.source) && topIds.has(e.target) &&
          e.type === 'featureTypingEdge' &&
          (e.data as Record<string, unknown>)?.portDirection === 'out')
        .map(e => ({ id: `lo-out-${e.id}`, sources: [e.source], targets: [e.target] })),
    ];

    const focusedPositions = new Map<string, { x: number; y: number }>();
    const focusedRoutes:    ElkRouteMap = new Map();

    try {
      const pass1 = await elk.layout({
        id: 'root',
        layoutOptions: { ...FOCUSED_LAYERED_OPTIONS, 'elk.spacing.nodeNode': String(nodeGap) },
        children: topNodes.map(n => ({ id: n.id, ...nodeSize(n) })),
        edges: focusedEdges,
      });

      // Node positions
      for (const n of pass1.children ?? []) {
        if (n.x !== undefined && n.y !== undefined) focusedPositions.set(n.id, { x: n.x, y: n.y });
      }

      // Edge routes — ELK layered naturally spreads attachment points so multiple
      // edges on the same node face are never stacked at the same pixel.
      // Map layout-edge IDs back to original React Flow edge IDs.
      // Reversed layout edges (lo-rev-*) have their waypoints reversed so the path
      // runs in the correct source→target direction for rendering.
      for (const e of pass1.edges ?? []) {
        const section = e.sections?.[0];
        if (!section) continue;
        const pts = [
          { x: section.startPoint.x, y: section.startPoint.y },
          ...(section.bendPoints ?? []).map(p => ({ x: p.x, y: p.y })),
          { x: section.endPoint.x,   y: section.endPoint.y   },
        ];
        if      (e.id.startsWith('lo-rev-')) focusedRoutes.set(e.id.slice(7), [...pts].reverse());
        else if (e.id.startsWith('lo-out-')) focusedRoutes.set(e.id.slice(7), pts);
        else if (e.id.startsWith('lo-'))     focusedRoutes.set(e.id.slice(3), pts);
      }
    } catch (err) {
      console.error('[sysml-viz] ELK focused layout error:', err);
      return { nodes, edgeRoutes: empty };
    }

    const positioned = nodes.map(n => {
      const pos = focusedPositions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });

    return { nodes: positioned, edgeRoutes: focusedRoutes };
  }

  const topNodes = nodes.filter(n => !n.parentId);
  const topIds   = new Set(topNodes.map(n => n.id));

  const nodeSize = (n: Node) => {
    const s = n.style as Record<string, unknown> | undefined;
    return { width: Number(s?.['width'] ?? 172), height: Number(s?.['height'] ?? 48) };
  };

  // ── Pass 1: ELK layered — compute positions ────────────────────────────────
  //
  // Use composition edges (def → instance) and featureTyping edges REVERSED
  // (instance → typeDef becomes typeDef → instance for layout purposes) so
  // that every definition node (owner or type) ends up in the top layer and
  // every usage/instance node ends up in the bottom layer.

  const layoutEdges: ElkExtendedEdge[] = [
    // Composition / non-composite membership: def → instance (DOWN)
    ...edges
      .filter(e =>
        topIds.has(e.source) && topIds.has(e.target) &&
        (e.type === 'compositionEdge' || e.type === 'nonCompositeMembershipEdge'),
      )
      .map(e => ({ id: `lo-${e.id}`, sources: [e.source], targets: [e.target] })),

    // FeatureTyping from usages/instances only: reversed → typeDef → instance.
    // This places type-defs in the same top layer as owner-defs without pulling
    // def→def port-typing edges (e.g. partDef → portDef) into the hierarchy,
    // which would otherwise push portDefs above partDefs.
    ...edges
      .filter(e =>
        topIds.has(e.source) && topIds.has(e.target) &&
        e.type === 'featureTypingEdge' &&
        (e.source.startsWith('inst-') || e.source.startsWith('usage-')),
      )
      .map(e => ({ id: `lo-rev-${e.id}`, sources: [e.target], targets: [e.source] })),
  ];

  let positionMap = new Map<string, { x: number; y: number }>();

  try {
    const pass1 = await elk.layout({
      id: 'root',
      layoutOptions: {
        ...LAYERED_OPTIONS,
        'elk.layered.spacing.nodeNodeBetweenLayers': String(layerGap),
        'elk.spacing.nodeNode':                      String(nodeGap),
      },
      children: topNodes.map(n => ({ id: n.id, ...nodeSize(n) })),
      edges: layoutEdges,
    });

    for (const n of pass1.children ?? []) {
      if (n.x !== undefined && n.y !== undefined) {
        positionMap.set(n.id, { x: n.x, y: n.y });
      }
    }
  } catch (err) {
    console.error('[sysml-viz] ELK hierarchical layout (pass 1) error:', err);
    return { nodes, edgeRoutes: empty };
  }

  const positioned = nodes.map(n => {
    const pos = positionMap.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });

  // In free-form mode skip orthogonal routing so edges use native smooth curves.
  if (!routeEdges) return { nodes: positioned, edgeRoutes: empty };

  // ── Pass 2: ELK fixed — route all original edges ───────────────────────────

  const routeNodesList: NodeInfo[] = topNodes.map(n => {
    const pos = positionMap.get(n.id) ?? n.position;
    return { id: n.id, ...nodeSize(n), x: pos.x, y: pos.y };
  });

  const routeEdgesList: EdgeInfo[] = edges
    .filter(e => topIds.has(e.source) && topIds.has(e.target) && e.source !== e.target)
    .map(e => ({ id: e.id, source: e.source, target: e.target }));

  const { children: routeChildren, edges: elkRouteEdges } = assignPorts(routeNodesList, routeEdgesList);

  const edgeRoutes: ElkRouteMap = new Map();

  try {
    const pass2 = await elk.layout({
      id:            'root',
      layoutOptions: FIXED_ROUTING_OPTIONS,
      children:      routeChildren,
      edges:         elkRouteEdges,
    });

    for (const e of pass2.edges ?? []) {
      const section = e.sections?.[0];
      if (!section) continue;
      edgeRoutes.set(e.id, [
        { x: section.startPoint.x, y: section.startPoint.y },
        ...(section.bendPoints ?? []).map(p => ({ x: p.x, y: p.y })),
        { x: section.endPoint.x,   y: section.endPoint.y   },
      ]);
    }
  } catch (err) {
    console.error('[sysml-viz] ELK hierarchical layout (pass 2) error:', err);
    // Fall through — return positioned nodes with no waypoints.
  }

  spreadFaceEndpoints(edgeRoutes, routeNodesList);
  return { nodes: positioned, edgeRoutes };
}
