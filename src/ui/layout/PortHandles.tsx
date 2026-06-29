/**
 * PortHandles — shared port boundary renderer used by StructureView and
 * StructuralWiringView. Renders per-port Handle squares on the node boundary
 * and absolutely-positioned port labels at matching vertical positions.
 */

import { Fragment } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PortDisplay {
  id:        string;
  label:     string;
  direction: string;
  portType?: string;
  /** Explicit glyph to render inside the handle square; overrides portArrowGlyph. */
  glyph?: string;
  /** Override CSS for the handle square (merged over the default sq style). */
  squareStyle?: CSSProperties;
  /** Custom SVG/React content to render inside the handle square; takes precedence over glyph. */
  svgContent?: ReactNode;
  /** Override CSS merged over the computed label style (e.g. to reposition for a specific port). */
  labelStyle?: CSSProperties;
  /** Force left (target) handle visible; overrides direction-based and showBothHandles prop. */
  showLeft?:  boolean;
  /** Force right (source) handle visible; overrides direction-based and showBothHandles prop. */
  showRight?: boolean;
  /** Declared direction used to orient the in/out arrow inside the square.
   *  Falls back to `direction` when absent. Empty ⇒ no arrow drawn. */
  arrowDir?:  string;
}

// ── Shared boundary-port visual constants ─────────────────────────────────────
//
// One color for every port square+label in both General and Interconnection views.
// Import PORT_MARKER_COLOR and makeBoundaryPortDisplay from this file rather than
// duplicating the style logic in each view.

export const PORT_MARKER_COLOR = '#64748b';

/**
 * Arrow glyph drawn inside a port square. `pointsRight` controls the horizontal
 * orientation so the arrow can be aimed *into* or *out of* the owning shape
 * depending on which boundary edge the square sits on (see PortHandles).
 */
function portMarkerSvg(direction: string, pointsRight: boolean): ReactNode {
  const c = PORT_MARKER_COLOR;
  if (direction === 'inout') {
    // Bidirectional — symmetric, orientation-independent.
    return (
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none"
        style={{ display: 'block', pointerEvents: 'none' }}>
        <path d="M0.5,4 L9.5,4 M7,2 L9.5,4 L7,6 M3,2 L0.5,4 L3,6"
          stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (direction === 'in' || direction === 'out') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"
        style={{ display: 'block', pointerEvents: 'none',
          ...(pointsRight ? {} : { transform: 'scaleX(-1)' }) }}>
        <path d="M0.5,4 L6.5,4 M4.5,2 L6.5,4 L4.5,6"
          stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null; // unknown → square with no marker
}

/**
 * Resolve port direction from an explicit value, falling back to name
 * heuristics when the direction is absent (e.g. untyped ports in official mode).
 * Shared by both General and Interconnection views.
 */
export function resolvePortDirection(name: string, direction: string): string {
  if (direction) return direction;
  if (name.endsWith('In') || /In\d+$/.test(name)) return 'in';
  if (name.endsWith('Out') || /Out\d+$/.test(name)) return 'out';
  if (name.startsWith('from_')) return 'in';
  if (name.startsWith('to_'))   return 'out';
  return '';
}

/**
 * Build a PortDisplay that renders as a transparent boundary square with an
 * SVG arrow and a uniformly-colored label — used by both General and
 * Interconnection views so their port visuals stay in sync.
 *
 * When `direction` is empty the label is used as a name-heuristic fallback
 * (via resolvePortDirection) so untyped ports still get an arrow.
 */
/**
 * @param arrowDir - Explicit direction for the SVG arrow drawn inside the port
 *   square. Pass `port.direction ?? ''` (the raw declared value) so arrows only
 *   appear when the SysML source explicitly declares `in`/`out`/`inout`.
 *   Omitting it falls back to the heuristic-resolved `direction` (legacy behaviour).
 *   Per SysML v2 §C, the port symbol arrow reflects the *declared* direction only.
 */
export function makeBoundaryPortDisplay(
  id:        string,
  label:     string,
  direction: string,
  portType:  string,
  arrowDir?: string,
): PortDisplay {
  direction = resolvePortDirection(label, direction);
  return {
    id, label, direction, portType,
    squareStyle: {
      background: 'transparent',
      border:     `1.5px solid ${PORT_MARKER_COLOR}`,
      borderRadius: 0,
      zIndex:     20,
    },
    labelStyle: {
      color: PORT_MARKER_COLOR,
    },
    // The arrow is oriented per-side at render time (PortHandles), so we only
    // record the declared direction here rather than baking in a fixed glyph.
    arrowDir: arrowDir ?? direction,
  };
}

// ── Direction utilities ────────────────────────────────────────────────────────

const DIR_HANDLE_COLORS: Record<string, string> = {
  in:    '#64748b',
  out:   '#64748b',
  inout: '#64748b',
};

export function portHandleColor(d: string): string {
  return DIR_HANDLE_COLORS[d] ?? '#94a3b8';
}

export function portArrowGlyph(d: string, isLR: boolean): string {
  if (d === 'inout') return isLR ? '↔' : '↕';
  if (d === 'in')    return isLR ? '→' : '↓';
  if (d === 'out')   return isLR ? '→' : '↓';
  return '●';
}

// ── PortHandles component ─────────────────────────────────────────────────────

interface PortHandlesProps {
  ports:             PortDisplay[];
  isLR:              boolean;
  sourcePos:         Position;
  targetPos:         Position;
  nodeH:             number;        // total node height (px) — used to distribute handles
  portAreaTop?:      number;        // px offset where port area starts (default 48)
  onPortClick?:      (port: PortDisplay, e: React.MouseEvent) => void;
  /** When true, both source and target handles are always visible so
   *  edges can attach to either side regardless of port direction. */
  showBothHandles?:  boolean;
}

export function PortHandles(props: PortHandlesProps) {
  const { ports, isLR, sourcePos, targetPos, nodeH, onPortClick } = props;
  const portAreaTop    = props.portAreaTop ?? 48;
  const showBothHandles = props.showBothHandles ?? false;

  return (
    <>
      {ports.map((p, i) => {
        // Distribute handles within the port area (below the header).
        // Use pixel top so handle and label always align regardless of actual node height.
        const topPx = portAreaTop + ((i + 1) / (ports.length + 1)) * (nodeH - portAreaTop);

        const d     = p.direction;
        const color = portHandleColor(d);
        const arrow = p.glyph !== undefined ? p.glyph : portArrowGlyph(d, isLR);

        // Side-aware arrow: aim it INTO the shape for `in`, OUT for `out`.
        // On the left edge, "into" is rightward; on the right edge it is leftward.
        const arrowD     = p.arrowDir ?? d;
        const leftArrow  = portMarkerSvg(arrowD, arrowD === 'in');
        const rightArrow = portMarkerSvg(arrowD, arrowD === 'out');

        // Visibility: left handle = target (in/inout/''); right handle = source (out/inout).
        // Per-port showLeft/showRight take priority over showBothHandles and direction defaults,
        // allowing the caller to show exactly the sides where real edges connect.
        const showL = p.showLeft  !== undefined ? p.showLeft
                    : showBothHandles || d !== 'out';
        const showR = p.showRight !== undefined ? p.showRight
                    : showBothHandles || (d !== 'in' && d !== '');

        // Strip left/right from squareStyle — those conflict with React Flow's class-based
        // handle positioning (`.react-flow__handle-left` uses `left:0; transform:translate(-50%,-50%)`
        // and vice versa for right). We set position explicitly per-side below.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { left: _sl, right: _sr, ...squareVisual } = p.squareStyle ?? {};

        // SysML v2 §8.2.3.6: port = small dashed-border rectangle straddling the boundary.
        // 18×10 px so it is wider than tall (landscape orientation, matching spec diagrams).
        // Centered on the boundary edge: left: -9 puts the midpoint exactly on the border.
        const sqBase: CSSProperties = {
          width: 18, height: 10,
          background: 'transparent',
          border: `1.5px dashed ${PORT_MARKER_COLOR}`,
          borderRadius: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 6.5, color: PORT_MARKER_COLOR, lineHeight: 1, cursor: 'default',
          ...squareVisual,
        };
        // left: -9 / right: -9 centers the 18 px-wide handle on the node boundary.
        const sqL:   CSSProperties = { ...sqBase,  top: topPx, left:   -9, transform: 'translateY(-50%)' };
        const sqR:   CSSProperties = { ...sqBase,  top: topPx, right:  -9, transform: 'translateY(-50%)' };
        const hideL: CSSProperties = { top: topPx, left:   -9, width: 18, height: 10, opacity: 0, pointerEvents: 'none', transform: 'translateY(-50%)' };
        const hideR: CSSProperties = { top: topPx, right:  -9, width: 18, height: 10, opacity: 0, pointerEvents: 'none', transform: 'translateY(-50%)' };

        // Labels are positioned OUTSIDE the node boundary so they never overlap
        // items/actions content. The node must have overflow: visible.
        // Place the label on whichever side the port square actually appears.
        // If the square is forced exclusively to the right (showR && !showL), the
        // label must go right even when `direction` has no explicit 'out' value
        // (e.g. synthetic ports with unknown direction from cross-file models).
        const labelGoesRight = d === 'out' || (showR && !showL);
        const labelStyle: CSSProperties = {
          position:  'absolute',
          fontSize:   9,
          color,
          pointerEvents: onPortClick ? 'auto' : 'none',
          cursor:     onPortClick ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
          zIndex:     10,
          ...(labelGoesRight
            ? { right: -12, top: topPx, transform: 'translate(100%, -50%)' }
            : { left:  -12, top: topPx, transform: 'translate(-100%, -50%)' }
          ),
          ...p.labelStyle,
        };

        return (
          <Fragment key={p.id}>
            {/* Target handle (left/top) */}
            <Handle
              type="target"
              position={targetPos}
              id={`port-${p.id}`}
              style={showL ? sqL : hideL}
            >
              {showL && (p.svgContent !== undefined
                ? p.svgContent
                : (leftArrow ?? (arrow && <span style={{ pointerEvents: 'none', userSelect: 'none' }}>{arrow}</span>))
              )}
            </Handle>

            {/* Hidden source handle co-located at the left port position.
                Used by FeatureTyping edges (sourceHandle `port-X-ft`) so that
                React Flow finds a proper type="source" handle for routing.
                React Flow only accepts type="source" handles as edge sources. */}
            <Handle
              type="source"
              position={Position.Left}
              id={`port-${p.id}-ft`}
              style={hideL}
            />

            {/* Mirror of the above on the right side.
                Used by output-port FeatureTyping edges in focused mode when the
                portDef is placed to the RIGHT of the partDef, so the edge exits
                from the correct side instead of routing all the way around. */}
            <Handle
              type="source"
              position={Position.Right}
              id={`port-${p.id}-ft-right`}
              style={hideR}
            />

            {/* Hidden target handle on the right edge.
                Used by backward edges in the wiring view (source at higher rank)
                so the edge enters from the right without routing all the way around. */}
            <Handle
              type="target"
              position={Position.Right}
              id={`port-${p.id}-tgt-right`}
              style={hideR}
            />


            {/* Source handle (right/bottom) */}
            <Handle
              type="source"
              position={sourcePos}
              id={`port-${p.id}-out`}
              style={showR ? sqR : hideR}
            >
              {showR && (p.svgContent !== undefined
                ? p.svgContent
                : (rightArrow ?? (arrow && <span style={{ pointerEvents: 'none', userSelect: 'none' }}>{arrow}</span>))
              )}
            </Handle>

            {/* Absolutely-positioned label aligned with handle */}
            <div
              style={labelStyle}
              onClick={onPortClick ? (e) => onPortClick(p, e) : undefined}
            >
              {p.label}
              {p.portType && (
                <span style={{ opacity: 0.45, fontSize: 9 }}>: {p.portType}</span>
              )}
            </div>
          </Fragment>
        );
      })}
    </>
  );
}
