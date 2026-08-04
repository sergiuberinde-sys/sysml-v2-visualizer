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
// ── Port assignment ───────────────────────────────────────────────────────────

type NodeInfo = { id: string; x: number; y: number; width: number; height: number };
type EdgeInfo = { id: string; source: string; target: string };

/**
 * Route every edge as an orthogonal Z between the faces its endpoints present to each other
 * (exit source face → cross the channel between the boxes → enter target face), fan out edges
 * sharing a face, then bend any segment that still crosses a box around it. A self-contained
 * router used where elkjs's `fixed` router fails; keeps the given node positions.
 */
export function routeEdgesOrthogonal(nodesList: NodeInfo[], edgesList: EdgeInfo[]): ElkRouteMap {
  const routes: ElkRouteMap = new Map();
  const nodeById = new Map(nodesList.map(n => [n.id, n]));
  const faceCenter = (n: NodeInfo, face: 'left' | 'right' | 'top' | 'bottom') =>
    face === 'left'  ? { x: n.x,               y: n.y + n.height / 2 } :
    face === 'right' ? { x: n.x + n.width,     y: n.y + n.height / 2 } :
    face === 'top'   ? { x: n.x + n.width / 2, y: n.y } :
                       { x: n.x + n.width / 2, y: n.y + n.height };
  for (const ed of edgesList) {
    const s = nodeById.get(ed.source), t = nodeById.get(ed.target);
    if (!s || !t) continue;
    const sf = faceOf(s, t), tf = faceOf(t, s);
    const sp = faceCenter(s, sf), tp = faceCenter(t, tf);
    const horiz = sf === 'left' || sf === 'right';
    routes.set(ed.id, horiz
      ? [sp, { x: (sp.x + tp.x) / 2, y: sp.y }, { x: (sp.x + tp.x) / 2, y: tp.y }, tp]
      : [sp, { x: sp.x, y: (sp.y + tp.y) / 2 }, { x: tp.x, y: (sp.y + tp.y) / 2 }, tp]);
  }
  spreadFaceEndpoints(routes, nodesList);
  const epMap = new Map(edgesList.map(e => [e.id, { source: e.source, target: e.target }]));
  detourEdgesAroundNodes(
    routes,
    nodesList.map(n => ({ id: n.id, x: n.x, y: n.y, w: n.width, h: n.height })),
    id => epMap.get(id) ?? {},
    28,
  );
  return routes;
}

/**
 * Obstacle-avoidance: reroute any edge whose path crosses a box that is not one of its own
 * endpoints, detouring it as an orthogonal path over/under the crossed box(es). Operates in
 * absolute coords, in place on `routes`. Shared by the wiring and structure layouts so a wire
 * never cuts through a shape. `endpointsOf(edgeId)` names the edge's source/target node ids so
 * they're excluded as obstacles.
 */
export function detourEdgesAroundNodes(
  routes: ElkRouteMap,
  rects: Array<{ id: string; x: number; y: number; w: number; h: number }>,
  endpointsOf: (edgeId: string) => { source?: string; target?: string },
  clearance = 20,
): void {
  const onRect = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }, m = 6) =>
    p.x >= r.x - m && p.x <= r.x + r.w + m && p.y >= r.y - m && p.y <= r.y + r.h + m;
  const segHits = (a: { x: number; y: number }, b: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => {
    for (let t = 0; t <= 1; t += 0.02) {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (x > r.x + 6 && x < r.x + r.w - 6 && y > r.y + 6 && y < r.y + r.h - 6) return true;
    }
    return false;
  };
  const inside = (pts: { x: number; y: number }[], r: { x: number; y: number; w: number; h: number }) =>
    pts.every(p => p.x >= r.x - 8 && p.x <= r.x + r.w + 8 && p.y >= r.y - 8 && p.y <= r.y + r.h + 8);
  // Boxes the route crosses that aren't its own endpoints or a frame it runs inside.
  const obstaclesFor = (pts: { x: number; y: number }[], source?: string, target?: string) =>
    rects.filter(r =>
      r.id !== source && r.id !== target &&
      !onRect(pts[0], r) && !onRect(pts[pts.length - 1], r) && !inside(pts, r) &&
      pts.some((p, i) => i > 0 && segHits(pts[i - 1], p, r)));

  for (const [eid, pts] of routes) {
    if (pts.length < 2) continue;
    const { source, target } = endpointsOf(eid);
    const s = pts[0], e = pts[pts.length - 1];
    const obst = obstaclesFor(pts, source, target);
    if (!obst.length) continue;
    const bx0 = Math.min(...obst.map(r => r.x)),        by0 = Math.min(...obst.map(r => r.y));
    const bx1 = Math.max(...obst.map(r => r.x + r.w)),  by1 = Math.max(...obst.map(r => r.y + r.h));
    // Try routing around each side of the crossed boxes' bounding box (over/under for a mostly
    // horizontal edge, left/right for a mostly vertical one). Order by nearest side first, and
    // pick the first candidate that no longer crosses ANY box.
    const overY = (y: number) => [s, { x: s.x, y }, { x: e.x, y }, e];
    const overX = (x: number) => [s, { x, y: s.y }, { x, y: e.y }, e];
    const cy = (s.y + e.y) / 2, cx = (s.x + e.x) / 2;
    const candidates = (Math.abs(e.y - s.y) >= Math.abs(e.x - s.x)
      ? [overX(bx0 - clearance), overX(bx1 + clearance), overY(by0 - clearance), overY(by1 + clearance)]
      : [overY(by0 - clearance), overY(by1 + clearance), overX(bx0 - clearance), overX(bx1 + clearance)]
    ).sort((a, b) => {
      // prefer the detour whose turning point is closest to the edge's midpoint
      const da = Math.hypot(a[1].x - cx, a[1].y - cy), db = Math.hypot(b[1].x - cx, b[1].y - cy);
      return da - db;
    });
    const clear = candidates.find(c => obstaclesFor(c, source, target).length === 0);
    routes.set(eid, clear ?? candidates[0]);
  }
}

/** Returns the face of `src` that an edge toward `tgt` would exit from. */
function faceOf(src: NodeInfo, tgt: NodeInfo): 'left' | 'right' | 'top' | 'bottom' {
  const dx = (tgt.x + tgt.width / 2)  - (src.x + src.width / 2);
  const dy = (tgt.y + tgt.height / 2) - (src.y + src.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
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

// ── Wiring-view layout (ELK layered: placement + ports + routing) ──────────────
// elkjs's `fixed` algorithm cannot route edges (it throws "0 edge sections"), so the
// Interconnect view uses ELK `layered` RIGHT, which reliably (a) places the part boxes
// into left→right layers, (b) assigns + orders ports on each face to minimise crossings
// (→ parallel wires), and (c) routes edges ORTHOGONALLY around every box with
// edge/edge + edge/node spacing (→ no overlap, never through a shape).

/** A port to be placed by ELK. `side` hints the preferred face; ELK orders within it. */
export interface WiringElkPort { id: string; side: 'left' | 'right' }
export interface WiringElkNode {
  id: string; width: number; height: number; ports: WiringElkPort[];
  /** Nested internals for an expanded (white-box) part: laid out recursively. When set,
   *  `ports` are the compound's boundary ports and `children`/`childEdges` its internals. */
  children?: WiringElkNode[];
  childEdges?: WiringElkEdge[];
}
export interface WiringElkEdge { id: string; sourcePort: string; targetPort: string }
export type PortSide = 'left' | 'right' | 'top' | 'bottom';
export interface WiringElkResult {
  /** Node positions LOCAL to their container (React Flow parent-relative; top = scope-abs). */
  nodePos: Map<string, { x: number; y: number }>;
  /** ELK-computed node sizes (compound/expanded parts are resized to fit their internals). */
  nodeSize: Map<string, { w: number; h: number }>;
  /** Leaf-part port position LOCAL to its node, plus its face. */
  portPos: Map<string, { x: number; y: number; side: PortSide }>;
  /** Boundary/frame-port positions LOCAL to their container, with the container width. */
  boundaryPos: Map<string, { x: number; y: number; side: PortSide; containerW: number }>;
  /** Edge routes in ABSOLUTE (scope-frame-at-0,0) coordinates. */
  routes:  ElkRouteMap;
  width:   number;
  height:  number;
}

// ELK layered RIGHT (a) places the part boxes into left→right layers with crossing
// minimisation, (b) assigns + ORDERS each node's ports on the WEST/EAST faces to
// minimise crossings (→ parallel wires), and (c) routes edges ORTHOGONALLY around
// every box (edgeNode) with parallel-segment spacing (edgeEdge) — so wires never
// overlap and never pass through a shape.
const WIRING_LAYERED_OPTIONS: Record<string, string> = {
  'elk.algorithm':                             'layered',
  'elk.direction':                             'RIGHT',
  'elk.edgeRouting':                           'ORTHOGONAL',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy':        'BRANDES_KOEPF',
  // NOTE: do NOT add elk.layered.cycleBreaking.strategy=MODEL_ORDER or
  // considerModelOrder.strategy here — this elkjs build throws on them
  // ("Cannot read properties of undefined"), layoutWiringElk falls into its catch, and
  // EVERY edge silently degrades to the handle-following `channel` router (no obstacle
  // avoidance, wires drawn on top of each other). Stable ordering is enforced after
  // layout instead (see the input-order re-stack below).
  'elk.spacing.nodeNode':                      '56',
  'elk.layered.spacing.nodeNodeBetweenLayers': '170',
  'elk.spacing.edgeEdge':                      '16',
  'elk.spacing.edgeNode':                      '24',
  'elk.spacing.portPort':                      '18',
  'elk.padding':                               '[top=48,left=48,bottom=48,right=48]',
};

export async function layoutWiringElk(
  parts: WiringElkNode[],
  boundaryPorts: WiringElkPort[],
  edges: WiringElkEdge[],
): Promise<WiringElkResult> {
  const nodePos     = new Map<string, { x: number; y: number }>();
  const nodeSize    = new Map<string, { w: number; h: number }>();
  const portPos     = new Map<string, { x: number; y: number; side: PortSide }>();
  const boundaryPos = new Map<string, { x: number; y: number; side: PortSide; containerW: number }>();
  const routes: ElkRouteMap = new Map();
  // Edges reversed for deterministic cycle breaking (see layoutOneLevel). Their ELK route
  // runs target→source, so the waypoints are flipped back when emitted.
  const reversedEdges = new Set<string>();
  const empty: WiringElkResult = { nodePos, nodeSize, portPos, boundaryPos, routes, width: 0, height: 0 };
  // Only `parts` is required: a scope may have no top-level edges yet still need layout for its
  // parts' positions and for edges nested inside expanded (compound) parts.
  if (!parts.length) return empty;

  // WEST ports straddle the left edge (ELK returns x ≈ -portWidth); classify by the node's
  // half so a slightly-negative WEST x is still 'left' (not mis-tagged → no rendered square).
  const sideOf = (px: number, w: number): PortSide => px < w / 2 ? 'left' : 'right';

  // One expanded part, once laid out: its size, its frame-port positions (node-local, so its
  // parent can pin them with FIXED_POS), and an `emit` that writes all of its internals into
  // the result maps once the parent has decided where the part sits (routes → absolute).
  interface Sub {
    width: number; height: number;
    framePorts: { id: string; x: number; y: number; side: PortSide }[];
    emit: (absX: number, absY: number) => void;
  }

  // Lay out ONE container level with ELK: its frame ports on WEST/EAST, its children as fixed-
  // size leaves (compound children arrive pre-sized with FIXED_POS ports matching their own
  // internal frame ports, so wires meet exactly), and its internal edges. Single-level ELK
  // only — no INCLUDE_CHILDREN nesting, which elkjs mis-routes (0-section edges).
  interface ChildSpec {
    id: string; width: number; height: number;
    fixedPorts?: { id: string; x: number; y: number }[];   // compound child → pin ports
    sidePorts?: WiringElkPort[];                            // leaf child → side hint
  }
  const layoutOneLevel = async (
    children: ChildSpec[], framePorts: WiringElkPort[], levelEdges: WiringElkEdge[],
  ) => {
    const elkChildren = children.map(c => c.fixedPorts
      ? {
          id: c.id, width: c.width, height: c.height,
          layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
          // Clamp onto the node boundary: ELK returns WEST ports at x≈-portW (straddling the
          // edge); feeding a negative x back as FIXED_POS can make elkjs drop routes to nearby
          // edges (0-section). Pinning ports exactly on [0,width]×[0,height] avoids that.
          ports: c.fixedPorts.map(p => ({
            id: p.id, width: 8, height: 8,
            x: Math.max(0, Math.min(c.width, p.x)),
            y: Math.max(0, Math.min(c.height, p.y)),
          })),
        }
      : {
          id: c.id, width: c.width, height: c.height,
          layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
          ports: (c.sidePorts ?? []).map(p => ({
            id: p.id, width: 8, height: 8,
            layoutOptions: { 'elk.port.side': p.side === 'left' ? 'WEST' : 'EAST' },
          })),
        });
    // ── Deterministic cycle breaking ─────────────────────────────────────────
    // Mutually-connected peers (e.g. EcuPlatform's two domains, linked by the bidirectional
    // SGMII flows) form a cycle. ELK's default GREEDY cycle-breaker chooses which edge to
    // reverse based on the current node SIZES, so expanding one part flipped which peer
    // landed on top. Break cycles ourselves instead, by SOURCE order: every edge that runs
    // backward w.r.t. the children's input order is reversed before ELK sees it. That leaves
    // a DAG whose layering depends only on model order — identical in every expand state.
    // (Doing this via elk.layered.cycleBreaking.strategy=MODEL_ORDER is NOT an option: this
    // elkjs build throws on it, which silently drops every edge to the `channel` router.)
    const childIndex = new Map(children.map((c, i) => [c.id, i]));
    const portOwner  = new Map<string, string>();
    for (const c of children) {
      for (const p of c.fixedPorts ?? []) portOwner.set(p.id, c.id);
      for (const p of c.sidePorts  ?? []) portOwner.set(p.id, c.id);
    }
    // A port id may be registered directly (leaf sidePorts / compound fixedPorts) or be a
    // `${childId}::…` qualified id; fall back to the longest child-id prefix so an expanded
    // (compound) peer is still recognised — otherwise its cycle stays unbroken and the
    // layering flips again once BOTH peers are expanded.
    const ownerOf = (portId: string): string | undefined => {
      const direct = portOwner.get(portId);
      if (direct !== undefined) return direct;
      let best: string | undefined;
      for (const c of children) {
        if (portId === c.id || portId.startsWith(c.id + '::')) {
          if (best === undefined || c.id.length > best.length) best = c.id;
        }
      }
      return best;
    };
    const elkEdges = levelEdges.map(e => {
      const sIdx = childIndex.get(ownerOf(e.sourcePort) ?? '');
      const tIdx = childIndex.get(ownerOf(e.targetPort) ?? '');
      // Frame/boundary ports have no owning child (undefined) — never reversed.
      if (sIdx !== undefined && tIdx !== undefined && sIdx > tIdx) {
        reversedEdges.add(e.id);
        return { id: e.id, sources: [e.targetPort], targets: [e.sourcePort] };
      }
      return { id: e.id, sources: [e.sourcePort], targets: [e.targetPort] };
    });

    // When the container has NO frame ports (the top scope), lay the parts out FLAT at the
    // root. Wrapping them in a compound `scope` node with `hierarchyHandling: INCLUDE_CHILDREN`
    // is only needed to place frame ports on the container edge; without ports it adds a
    // needless hierarchy level that makes elkjs silently drop long edges routing around a big
    // (expanded) child — producing 0-section edges that then fall back to straight lines
    // through the shape. A flat layout routes every edge around every box reliably.
    if (framePorts.length === 0) {
      const flat: ElkNode = {
        id: 'root',
        layoutOptions: { ...WIRING_LAYERED_OPTIONS },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children: elkChildren as any,
        edges: elkEdges,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await elk.layout(flat)) as any;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope: any = {
      id: 'scope',
      layoutOptions: { ...WIRING_LAYERED_OPTIONS, 'elk.portConstraints': 'FIXED_SIDE' },
      ports: framePorts.map(p => ({
        id: p.id, width: 8, height: 8,
        layoutOptions: { 'elk.port.side': p.side === 'left' ? 'WEST' : 'EAST' },
      })),
      children: elkChildren,
      edges: elkEdges,
    };
    const graph: ElkNode = {
      id: 'root',
      layoutOptions: { ...WIRING_LAYERED_OPTIONS, 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' },
      children: [scope],
    };
    const laid = await elk.layout(graph);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (laid.children ?? [])[0] as any;
  };

  // Recursively lay out a compound node (its children first, bottom-up), returning a Sub.
  const layoutSub = async (node: WiringElkNode): Promise<Sub> => {
    const kids = node.children ?? [];
    const subs = new Map<string, Sub>();
    const specs: ChildSpec[] = [];
    for (const c of kids) {
      if (c.children?.length) {
        const s = await layoutSub(c);
        subs.set(c.id, s);
        specs.push({ id: c.id, width: s.width, height: s.height, fixedPorts: s.framePorts.map(p => ({ id: p.id, x: p.x, y: p.y })) });
      } else {
        specs.push({ id: c.id, width: c.width, height: c.height, sidePorts: c.ports });
      }
    }
    const sc = await layoutOneLevel(specs, node.ports, node.childEdges ?? []);
    const cw = sc?.width ?? 0, ch = sc?.height ?? 0;
    const frameOut = new Map<string, { x: number; y: number; side: PortSide }>();
    for (const p of ((sc?.ports ?? []) as ElkNode[])) {
      frameOut.set(p.id, { x: p.x ?? 0, y: p.y ?? 0, side: sideOf(p.x ?? 0, cw) });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const childElk = new Map<string, any>();
    for (const c of ((sc?.children ?? []) as ElkNode[])) childElk.set(c.id, c);

    return {
      width: cw, height: ch,
      framePorts: [...frameOut].map(([id, p]) => ({ id, ...p })),
      emit(absX, absY) {
        // This container's own frame ports (node-local → React Flow parent-relative).
        for (const [id, p] of frameOut) boundaryPos.set(id, { ...p, containerW: cw });
        for (const c of kids) {
          const ce = childElk.get(c.id);
          const cx = ce?.x ?? 0, cy = ce?.y ?? 0;
          nodePos.set(c.id, { x: cx, y: cy });          // parent-relative (React Flow nesting)
          const cs = subs.get(c.id);
          nodeSize.set(c.id, cs ? { w: cs.width, h: cs.height } : { w: c.width, h: c.height });
          if (cs) {
            cs.emit(absX + cx, absY + cy);              // compound child → recurse (routes need abs)
          } else {
            for (const p of ((ce?.ports ?? []) as ElkNode[])) {
              portPos.set(p.id, { x: p.x ?? 0, y: p.y ?? 0, side: sideOf(p.x ?? 0, ce?.width ?? 0) });
            }
          }
        }
        // This container's internal edges — sections are container-local; shift to absolute.
        for (const e of ((sc?.edges ?? []) as ElkExtendedEdge[])) {
          const s = e.sections?.[0]; if (!s) continue;
          const pts = [
            { x: s.startPoint.x + absX, y: s.startPoint.y + absY },
            ...(s.bendPoints ?? []).map(p => ({ x: p.x + absX, y: p.y + absY })),
            { x: s.endPoint.x + absX,   y: s.endPoint.y + absY   },
          ];
          // A cycle-broken edge was handed to ELK reversed, so its route runs target→source.
          // Flip it back so the polyline still starts at the edge's real source port.
          routes.set(e.id, reversedEdges.has(e.id) ? pts.reverse() : pts);
        }
      },
    };
  };

  try {
    // The top scope is itself a container: frame = boundary ports, children = top parts.
    const root: WiringElkNode = { id: 'scope', width: 0, height: 0, ports: boundaryPorts, children: parts, childEdges: edges };
    const sub = await layoutSub(root);
    sub.emit(0, 0);

    // Obstacle-avoidance, at EVERY nesting level. ELK's layered router can route a wire straight
    // THROUGH a box that fills its layer height (e.g. an expanded frame, or a sibling inside one),
    // and can drop long routes entirely (→ straight channel fallback). Detect any edge whose path
    // crosses a box that is neither its endpoint nor a container it runs inside, and re-route it
    // as an orthogonal detour over/under that box. All maths in absolute coords.
    const CLEAR = 22;
    // Absolute position of a node (accumulate parent offsets via the id's `::` chain) and of a
    // port (leaf part port → node edge + local Y; frame/boundary port → container edge + Y).
    const absCache = new Map<string, { x: number; y: number }>();
    const absNodePos = (id: string): { x: number; y: number } => {
      const cached = absCache.get(id); if (cached) return cached;
      const p = nodePos.get(id) ?? { x: 0, y: 0 };
      const i = id.lastIndexOf('::');
      const par = i < 0 ? null : id.slice(0, i);
      const base = par && nodePos.has(par) ? absNodePos(par) : { x: 0, y: 0 };
      const r = { x: base.x + p.x, y: base.y + p.y };
      absCache.set(id, r); return r;
    };
    const absPortPos = (pid: string): { x: number; y: number } | null => {
      const i = pid.lastIndexOf('::');
      const owner = i < 0 ? null : pid.slice(0, i);
      const np = owner ? absNodePos(owner) : { x: 0, y: 0 };
      const lp = portPos.get(pid);
      if (lp) return { x: lp.side === 'right' ? np.x + (nodeSize.get(owner!)?.w ?? 0) : np.x, y: np.y + lp.y };
      const bp = boundaryPos.get(pid);
      if (bp) return { x: bp.side === 'right' ? np.x + bp.containerW : np.x, y: np.y + bp.y };
      return null;
    };
    const allRects = [...nodePos.keys()].map(id => {
      const p = absNodePos(id); const s = nodeSize.get(id) ?? { w: 0, h: 0 };
      return { x: p.x, y: p.y, w: s.w, h: s.h };
    });
    const onRect = (pt: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }, m = 6) =>
      pt.x >= r.x - m && pt.x <= r.x + r.w + m && pt.y >= r.y - m && pt.y <= r.y + r.h + m;
    const segHitsRect = (a: { x: number; y: number }, b: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => {
      for (let t = 0; t <= 1; t += 0.02) {
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        if (x > r.x + 6 && x < r.x + r.w - 6 && y > r.y + 6 && y < r.y + r.h - 6) return true;
      }
      return false;
    };
    // R is a CONTAINER of the route (an ancestor frame it runs inside), not an obstacle, when
    // every route point sits within R (small tolerance).
    const routeInside = (pts: { x: number; y: number }[], r: { x: number; y: number; w: number; h: number }) =>
      pts.every(p => p.x >= r.x - 8 && p.x <= r.x + r.w + 8 && p.y >= r.y - 8 && p.y <= r.y + r.h + 8);
    const obstaclesFor = (pts: { x: number; y: number }[]) => {
      const s = pts[0], e = pts[pts.length - 1];
      return allRects.filter(r =>
        !onRect(s, r) && !onRect(e, r) && !routeInside(pts, r) &&
        pts.some((p, i) => i > 0 && segHitsRect(pts[i - 1], p, r)));
    };

    // Every edge in the tree (top + nested), for the un-routed fallback.
    const allEdges: WiringElkEdge[] = [...edges];
    const collectEdges = (ns: WiringElkNode[]) => {
      for (const n of ns) { for (const ce of (n.childEdges ?? [])) allEdges.push(ce); collectEdges(n.children ?? []); }
    };
    collectEdges(parts);

    // Un-routed edges (elkjs dropped the route → straight channel line) that would cut through a
    // box: give them an explicit straight route so the detour pass below bends them around.
    // Non-crossing un-routed edges keep their handle-based channel routing.
    for (const edge of allEdges) {
      if (routes.has(edge.id)) continue;
      const s = absPortPos(edge.sourcePort), e = absPortPos(edge.targetPort);
      if (!s || !e) continue;
      if (obstaclesFor([s, e]).length) routes.set(edge.id, [s, e]);
    }

    // Detour any route (any level) that crosses a non-endpoint, non-container box. Try each
    // side of the crossed boxes' bounding box — over/under for a mostly-horizontal edge,
    // left/right for a mostly-vertical one (e.g. a deeply-nested wire running down a column) —
    // and take the first that clears every box. Container exclusion keeps a nested detour inside
    // its own frame.
    for (const [eid, pts] of routes) {
      if (pts.length < 2) continue;
      const s = pts[0], e = pts[pts.length - 1];
      const obst = obstaclesFor(pts);
      if (!obst.length) continue;
      const bx0 = Math.min(...obst.map(r => r.x)),       by0 = Math.min(...obst.map(r => r.y));
      const bx1 = Math.max(...obst.map(r => r.x + r.w)), by1 = Math.max(...obst.map(r => r.y + r.h));
      const overY = (y: number) => [s, { x: s.x, y }, { x: e.x, y }, e];
      const overX = (x: number) => [s, { x, y: s.y }, { x, y: e.y }, e];
      const cx = (s.x + e.x) / 2, cy = (s.y + e.y) / 2;
      const candidates = (Math.abs(e.y - s.y) >= Math.abs(e.x - s.x)
        ? [overX(bx0 - CLEAR), overX(bx1 + CLEAR), overY(by0 - CLEAR), overY(by1 + CLEAR)]
        : [overY(by0 - CLEAR), overY(by1 + CLEAR), overX(bx0 - CLEAR), overX(bx1 + CLEAR)]
      ).sort((a, b) => Math.hypot(a[1].x - cx, a[1].y - cy) - Math.hypot(b[1].x - cx, b[1].y - cy));
      const clear = candidates.find(c => obstaclesFor(c).length === 0);
      routes.set(eid, clear ?? candidates[0]);
    }

    // ── De-overlap: separate COINCIDENT wire segments into parallel channels ─────
    // Each frame (top scope + every expanded part) is routed by its OWN ELK pass, so a
    // cross-boundary wire and a wire internal to the expanded part know nothing about each
    // other and happily land on the same line. Spec FR-AL-2 requires no two segments be
    // coincident, so nudge collinear-and-overlapping segments apart here, once all routes
    // (from every pass) are known and expressed in the same absolute coordinates.
    //
    // Only INTERIOR segments move: shifting segment i changes pts[i] and pts[i+1], so the
    // first and last points — which are pinned to port handles — must never be endpoints of
    // a shifted segment. The two neighbouring perpendicular segments simply stretch, so the
    // polyline stays orthogonal and still meets its ports exactly.
    const SEP = 12;           // channel spacing between parallel wires
    const COINCIDENT = 2.5;   // treat axes within this distance as the same line
    const MIN_OVERLAP = 10;   // ignore incidental touches
    type Seg = { eid: string; i: number; axis: number; lo: number; hi: number };

    const collect = (horiz: boolean): Seg[] => {
      const out: Seg[] = [];
      for (const [eid, pts] of routes) {
        for (let i = 1; i + 2 < pts.length; i++) {   // interior segments only
          const a = pts[i], b = pts[i + 1];
          const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
          if (horiz && dy < 0.8 && dx > 3) out.push({ eid, i, axis: (a.y + b.y) / 2, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
          if (!horiz && dx < 0.8 && dy > 3) out.push({ eid, i, axis: (a.x + b.x) / 2, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
        }
      }
      return out;
    };

    const spread = (horiz: boolean): void => {
      const segs = collect(horiz);
      segs.sort((p, q) => p.axis - q.axis || p.lo - q.lo);
      // Group segments that share an axis line (within COINCIDENT).
      let g: Seg[] = [];
      const flush = () => {
        if (g.length < 2) { g = []; return; }
        // Within the group, only segments that actually overlap need separating.
        const used: Seg[] = [];
        for (const s of g) {
          const clash = used.filter(u => u.eid !== s.eid &&
            Math.min(u.hi, s.hi) - Math.max(u.lo, s.lo) > MIN_OVERLAP);
          if (clash.length) {
            // Push to the first free channel (alternating out from the original line).
            const k = clash.length;
            const delta = (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * SEP;
            const pts = routes.get(s.eid);
            if (pts) {
              if (horiz) { pts[s.i] = { ...pts[s.i], y: pts[s.i].y + delta }; pts[s.i + 1] = { ...pts[s.i + 1], y: pts[s.i + 1].y + delta }; }
              else       { pts[s.i] = { ...pts[s.i], x: pts[s.i].x + delta }; pts[s.i + 1] = { ...pts[s.i + 1], x: pts[s.i + 1].x + delta }; }
            }
          }
          used.push(s);
        }
        g = [];
      };
      for (const s of segs) {
        if (g.length && Math.abs(s.axis - g[0].axis) > COINCIDENT) flush();
        g.push(s);
      }
      flush();
    };

    // Two passes: separating one axis can expose coincidences on the other.
    for (let pass = 0; pass < 2; pass++) { spread(true); spread(false); }

    // Preserve the INPUT (source/collapsed) vertical order of top parts when there are no edges
    // between them (e.g. EcuPlatform's two domains): ELK's order is then arbitrary and flips as a
    // part expands. Re-stack them in input order in a single left-aligned column — a part's
    // descendants move with it (parent-relative positions) and its internal edge routes are
    // shifted by the same delta.
    let outW = sub.width, outH = sub.height;
    if (!edges.length && parts.length > 1) {
      const cur = parts.map(p => ({ id: p.id, pos: nodePos.get(p.id), s: nodeSize.get(p.id) }));
      if (cur.every(c => c.pos && c.s)) {
        const x0 = Math.min(...cur.map(c => c.pos!.x));
        let y = Math.min(...cur.map(c => c.pos!.y));
        let maxRight = 0, bottom = y;
        for (const c of cur) {   // `parts` is in input (source) order
          const dx = x0 - c.pos!.x, dy = y - c.pos!.y;
          if (dx || dy) {
            nodePos.set(c.id, { x: x0, y });
            const pfx = `${c.id}::`;
            for (const [eid, pts] of routes) {
              if (eid.startsWith(pfx)) routes.set(eid, pts.map(p => ({ x: p.x + dx, y: p.y + dy })));
            }
          }
          maxRight = Math.max(maxRight, x0 + c.s!.w);
          bottom   = y + c.s!.h;
          y += c.s!.h + 56;   // ELK nodeNode spacing
        }
        // ELK's component packing may have placed these disconnected parts side by side, so
        // sub.{width,height} bound that arrangement — not this vertical stack. Grow the frame to
        // the stack's extent (matching ELK's 48px padding) so no part sits outside the boundary.
        const PAD = 48;
        outW = Math.max(outW, maxRight + PAD);
        outH = Math.max(outH, bottom + PAD);
      }
    }

    return { nodePos, nodeSize, portPos, boundaryPos, routes, width: outW, height: outH };
  } catch (err) {
    console.error('[sysml-viz] ELK wiring layout error:', err);
    return empty;
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
  /**
   * Layer flow for the 'layered' algorithm. 'DOWN' (default) stacks defs on top of usages
   * (a wide horizontal band); 'RIGHT' places defs in a LEFT column and usages in a RIGHT
   * column (a tall vertical two-column diagram).
   */
  direction?: 'DOWN' | 'RIGHT';
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
  const { algorithm = 'layered', direction = 'DOWN', layerGap = 90, nodeGap = algorithm === 'stress' ? 80 : 40, routeEdges = algorithm !== 'stress' } = opts;
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
        'elk.direction':                             direction,
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

  // Route on the layered positions ourselves (elkjs `fixed` router is unusable here):
  // orthogonal Z + fan-out + obstacle detour, so no line cuts through a shape.
  const edgeRoutes = routeEdgesOrthogonal(routeNodesList, routeEdgesList);
  return { nodes: positioned, edgeRoutes };
}

// ── Actions view layout ───────────────────────────────────────────────────────

// Actions-view ELK options.  Tuned for readable action diagrams:
//   • Wide layer gaps so guarded transitions / branch labels don't crowd nodes.
//   • Generous node-node spacing so port-rich actions don't visually merge.
//   • Edge-node / edge-edge spacing prevents item-flow and succession edges
//     from stacking or grazing node faces.
//   • thoroughness=70 + greedy-switch + balanced node placement aggressively
//     minimise crossings, important for fan-out forks and fan-in joins.
//   • unnecessaryBendpoints=true keeps orthogonal routes simple.
const BEHAVIOR_ELK_OPTIONS: Record<string, string> = {
  'elk.algorithm':                                                    'layered',
  'elk.direction':                                                    'DOWN',
  'elk.edgeRouting':                                                  'ORTHOGONAL',
  'elk.layered.crossingMinimization.strategy':                        'LAYER_SWEEP',
  'elk.layered.crossingMinimization.greedySwitch.activationThreshold': '40',
  'elk.layered.nodePlacement.strategy':                               'BRANDES_KOEPF',
  'elk.layered.nodePlacement.bk.fixedAlignment':                      'BALANCED',
  'elk.layered.thoroughness':                                         '70',
  'elk.layered.unnecessaryBendpoints':                                'true',
  'elk.layered.spacing.nodeNodeBetweenLayers':                        '110',
  'elk.layered.spacing.edgeNodeBetweenLayers':                        '30',
  'elk.layered.spacing.edgeEdgeBetweenLayers':                        '20',
  'elk.spacing.nodeNode':                                             '70',
  'elk.spacing.edgeNode':                                             '25',
  'elk.spacing.edgeEdge':                                             '18',
  'elk.padding':                                                      '[top=50,left=50,bottom=50,right=50]',
};

/** Single ELK layered run — returns a nodeId→position map. */
async function runBehaviorElk(
  nodes: Array<{ id: string; width: number; height: number }>,
  edges: Array<{ id: string; source: string; target: string }>,
): Promise<Map<string, { x: number; y: number }>> {
  if (!nodes.length) return new Map();
  const nodeSet = new Set(nodes.map(n => n.id));
  const result = await elk.layout({
    id: 'behavior-root',
    layoutOptions: BEHAVIOR_ELK_OPTIONS,
    children: nodes.map(n => ({ id: n.id, x: 0, y: 0, width: n.width, height: n.height })),
    edges: edges
      .filter(e => nodeSet.has(e.source) && nodeSet.has(e.target))
      .map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  const positions = new Map<string, { x: number; y: number }>();
  for (const child of result.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }
  return positions;
}

/**
 * ELK `layered` layout for the Actions view.
 *
 * When `laneMap` is supplied (nodeId → 0-based lane index), nodes are split
 * by lane and each lane is laid out independently in its own vertical column.
 * The columns are concatenated horizontally with a fixed gap so swimlane
 * bounding boxes never overlap.  Cross-lane succession edges are drawn by
 * React Flow and are not fed into ELK.
 *
 * Without `laneMap`, all nodes are laid out in a single ELK pass (original
 * behaviour).
 */
export async function applyBehaviorLayout(
  nodes: Array<{ id: string; width: number; height: number }>,
  edges: Array<{ id: string; source: string; target: string }>,
  laneMap?: Map<string, number>,
): Promise<Map<string, { x: number; y: number }>> {
  if (!nodes.length) return new Map();
  if (!laneMap || laneMap.size === 0) return runBehaviorElk(nodes, edges);

  // ── Swimlane layout: flow DOWN, lanes as vertical columns ─────────────────────
  // The OLD approach laid out each lane in isolation (intra-lane edges only) and drew the
  // cross-lane succession edges — which are the bulk of the flow — straight across the columns,
  // producing a horizontal tangle. Instead we run ONE ELK pass over the WHOLE graph so the
  // successions set a clean top-to-bottom flow order (Y), then place each node in its lane's
  // column (X). Time flows down; edges cross between columns only where the performer changes.
  const LANE_GAP = 64;   // horizontal gap between swimlane columns
  const ROW_GAP  = 34;   // minimum vertical gap between two nodes in the same lane

  const dim = new Map(nodes.map(n => [n.id, { w: n.width, h: n.height }]));

  // Full-graph flow layout → Y is the flow depth (ELK direction is DOWN). We keep the Y and
  // discard ELK's X (we assign X by lane); ELK's X is only a fallback for unallocated nodes.
  const flow = await runBehaviorElk(nodes, edges);

  // Lane columns, left-to-right by lane index. Column width = widest node in the lane.
  const lanes = [...new Set([...laneMap.values()])].sort((a, b) => a - b);
  const laneW = new Map<number, number>();
  for (const n of nodes) {
    const l = laneMap.get(n.id);
    if (l !== undefined) laneW.set(l, Math.max(laneW.get(l) ?? 0, n.width));
  }
  const laneCenter = new Map<number, number>();
  let cursor = 0;
  for (const l of lanes) {
    const w = laneW.get(l) ?? 140;
    laneCenter.set(l, cursor + w / 2);
    cursor += w + LANE_GAP;
  }

  // X: allocated nodes → centered in their lane column.
  const x = new Map<string, number>();
  for (const n of nodes) {
    const l = laneMap.get(n.id);
    if (l !== undefined) x.set(n.id, laneCenter.get(l)! - n.width / 2);
  }
  // Unallocated (control/junction) nodes → the average X of their connected neighbours, so they
  // sit between the lanes they wire together (short cross-lane edges). Iterate a few times since
  // neighbours may themselves be unallocated; fall back to ELK's X.
  const nbr = new Map<string, string[]>();
  for (const e of edges) {
    (nbr.get(e.source) ?? nbr.set(e.source, []).get(e.source)!).push(e.target);
    (nbr.get(e.target) ?? nbr.set(e.target, []).get(e.target)!).push(e.source);
  }
  const unalloc = nodes.filter(n => laneMap.get(n.id) === undefined);
  for (let pass = 0; pass < 4; pass++) {
    for (const n of unalloc) {
      const centres = (nbr.get(n.id) ?? [])
        .map(m => { const xm = x.get(m); return xm !== undefined ? xm + (dim.get(m)?.w ?? 0) / 2 : undefined; })
        .filter((v): v is number => v !== undefined);
      const centre = centres.length ? centres.reduce((a, b) => a + b, 0) / centres.length
                                     : (flow.get(n.id)?.x ?? 0) + n.width / 2;
      x.set(n.id, centre - n.width / 2);
    }
  }

  // Y: the ELK flow depth, then de-clutter WITHIN each lane column so same-lane nodes that land
  // at the same flow depth (parallel actions of one performer) stack instead of overlapping.
  const y = new Map<string, number>();
  for (const n of nodes) y.set(n.id, flow.get(n.id)?.y ?? 0);
  for (const l of lanes) {
    const laneNodes = nodes.filter(n => laneMap.get(n.id) === l).sort((a, b) => (y.get(a.id)! - y.get(b.id)!));
    let prevBottom = -Infinity;
    for (const n of laneNodes) {
      let ny = y.get(n.id)!;
      if (ny < prevBottom + ROW_GAP) ny = prevBottom + ROW_GAP;
      y.set(n.id, ny);
      prevBottom = ny + (dim.get(n.id)?.h ?? 0);
    }
  }

  const result = new Map<string, { x: number; y: number }>();
  for (const n of nodes) result.set(n.id, { x: x.get(n.id) ?? 0, y: y.get(n.id) ?? 0 });
  return result;
}
