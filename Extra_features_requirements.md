# Extra Features — Requirements for Official Implementation

## Purpose & status

Three capabilities were **prototyped** in the SysML v2 Visualizer's **Interconnect view**
(the structural-wiring / Internal Block Diagram view; prototype code in
`src/ui/views/StructuralWiringView.tsx`): (1) show / hide unconnected ports, (2) expand / collapse
part internals, and (3) automatic non-overlapping layout with viewport auto-fit. This document
specifies them so the development team can implement them as **official, supported features** in the
parser/visualization pipeline. The prototype is a reference for behavior only — it is not the target
implementation.

**Shared context.** All three features operate on the Interconnect view, which renders one
`PartDefinition` (the *scope*) as an IBD: its direct `PartUsage` children as boxes, each usage's
ports (resolved through its type definition) as port squares, the scope's own boundary ports on
the frame, and `connect` / `bind` / interconnect relationships as edges between port handles. The
data source is the official parser's containment graph (nodes = elements with stable ids and
`typedBy` edges usage→definition; edges = `connection` / `message` / `interconnect`).

---

## Feature 1 — Show / Hide Unconnected Ports

### 1.1 Rationale
Component definitions frequently declare many boundary ports, but only a few are wired in any given assembly. The
unwired ports add visual noise and enlarge every box. Users need to toggle them off to focus on
the actual wiring, and back on to see the full interface.

### 1.2 Definitions
- **In-scope connection** — a `connection`, `message`, or `interconnect` relationship whose *both*
  endpoints are ports owned by elements rendered in the current scope (the scope's parts or the
  scope's own boundary ports).
- **Connected port** — a port that is an endpoint of at least one in-scope connection. Port
  identity must be matched in both its canonical form and any alias/short forms the model resolves
  it to (a connection endpoint written as `part.port` must count the same port declared on the
  part's type definition).
- **Unconnected port** — any port that is not a connected port.

### 1.3 Functional requirements
- **FR-UP-1** The view SHALL provide a single view-level toggle: *Unconnected ports: shown / hidden*.
- **FR-UP-2** Default state SHALL be **shown** (no ports hidden).
- **FR-UP-3** When set to **hidden**, the view SHALL omit every unconnected port from rendering —
  both the ports on each part box **and** the scope's own boundary ports.
- **FR-UP-4** Hiding SHALL be purely visual: it MUST NOT alter the model, diagnostics, or the set
  of connections. Toggling back to **shown** SHALL restore the exact prior rendering.
- **FR-UP-5** Layout MUST recompute against the reduced port set when hidden — box heights, port
  ordering/anchoring, and boundary-port placement all use only the visible ports (boxes shrink;
  no empty port rows).
- **FR-UP-6** The toggle SHALL be global to the current scope view (it applies to all parts and
  boundary ports at once), not per-part.
- **FR-UP-7** All rendered connections MUST remain intact and correctly anchored when unconnected
  ports are hidden (only *unconnected* ports disappear, so no edge can be orphaned).

### 1.4 Acceptance criteria
- Given a scope with parts that have unconnected ports, toggling to **hidden** removes exactly the
  unconnected ports (part ports and boundary ports) and shrinks the affected boxes; every wire
  remains connected.
- Toggling back to **shown** reproduces the original diagram pixel-for-pixel.
- A part whose ports are all connected is unchanged by the toggle.

### 1.5 Prototype reference
`StructuralWiringView.tsx` — `hideUnconnectedPorts` state; `connectedPortIds` set built from
in-scope connection endpoints (canonical + alias); filtering of `partPorts` and boundary ports;
toolbar button "◉/◎ Unconnected ports".

---

## Feature 2 — Expand / Collapse Part Internals (white-box IBD)

### 2.1 Rationale
By default each part usage in the scope is a **black box** — you see its boundary ports and the
wires between parts, but not what is inside. Engineers need to inspect a part's internal structure
(its type definition's sub-parts and internal wiring) **in the same diagram**, on demand, without
losing the surrounding context — the standard SysML "white-box" IBD drill-in.

### 2.2 Definitions
- **Expandable part** — a part usage whose type definition (resolved via `typedBy` / FeatureTyping)
  owns at least one nested `PartUsage`. A part whose type has only ports/attributes (no sub-parts)
  is **not** expandable.
- **Internals** — the full interconnect diagram of the part's type definition: its nested part
  usages (each as a box with its ports), the internal `connect`/`bind`/interconnect wiring among
  them, and the type definition's boundary ports.

### 2.3 Functional requirements
- **FR-EX-1** Every **expandable** part SHALL display an expand/collapse control; non-expandable
  parts SHALL NOT.
- **FR-EX-2** Expand/collapse state SHALL be **per part usage** and independently toggleable.
- **FR-EX-3** When expanded, a part SHALL render as a **white-box container** embedding the exact
  interconnect diagram that the view would show if the part's type definition were selected as the
  scope — internal parts, internal wiring, and the type's boundary ports.
- **FR-EX-4** The part's boundary ports SHALL remain on the container's outer edge when expanded,
  and any scope-level connection to those ports MUST stay correctly routed across expand/collapse
  (a wire into `scp.BatterySupply_In` connects to the same port whether `scp` is collapsed or
  expanded). Where the type definition delegates a boundary port inward (`bind boundaryPort =
  internal.port`), that delegation SHALL be shown as an internal edge from the boundary port to the
  internal port.
- **FR-EX-5** Expansion is **one level per action**: expanding a part reveals its *direct*
  internals; nested parts that are themselves expandable render as collapsed boxes carrying their
  own expand control, so the user drills down one level at a time. (Re-expanding nested parts MAY
  recurse to arbitrary depth.)
- **FR-EX-6** The outer layout SHALL reflow so an expanded container claims the space of its
  internals; sibling parts and boundary ports MUST re-position to avoid overlap. Collapsing SHALL
  restore the compact black-box layout.
- **FR-EX-7** Self-referential / cyclic type definitions MUST NOT cause infinite expansion — a
  definition MUST NOT embed itself (directly or transitively) within its own expansion.
- **FR-EX-8** Expansion state SHALL reset when the active scope changes (expanded ids belong to the
  previous scope and MUST NOT carry over).
- **FR-EX-9** Expanding/collapsing SHALL be purely visual — no change to the model or diagnostics.
- **FR-EX-10** Selection, hover, and source-navigation SHALL continue to work for nested elements
  the same as for top-level ones (clicking an internal part/port selects that element).
- **FR-EX-11** On **every** expand and collapse, the view SHALL automatically re-fit the viewport to
  frame the whole diagram after the new layout settles: expanding (larger diagram) zooms **out** so
  the newly-revealed internals are visible; collapsing (smaller diagram) zooms **in**. The auto-fit
  MUST fire on each toggle — not only the first — and MUST wait for the (possibly asynchronous)
  layout to complete so it frames the final node positions, not an intermediate state. See
  **Feature 3 (§3.3, FR-AL-6)** for the shared viewport-fit requirement this instantiates.

### 2.4 Acceptance criteria
- A part whose type has sub-parts (e.g. `scp : SignalConditioningAndProcessing`) shows an expand
  control; a part whose type has only a port (e.g. `battout : BatteryComponent`) does not.
- Expanding `scp` reveals its internal parts and their internal wiring inside `scp`'s frame; the
  outer `battout.BattOutPort → scp.BatterySupply_In` connection now routes to `scp`'s boundary port
  on the enlarged container edge; other parts reflow with no overlap.
- Collapsing `scp` returns it to a single box and restores the original layout.
- With nothing expanded, the diagram is identical to the pre-feature black-box view (no regression).
- Expanding a part whose type (transitively) contains itself terminates without hanging.
- Expanding a part zooms the viewport out to fit; collapsing it zooms back in — repeatably, on the
  2nd, 3rd, … toggle exactly as on the 1st.

### 2.5 Prototype reference
`StructuralWiringView.tsx` — `expandedParts` state + `onToggleExpand`; `isExpandable` (type def has
nested `PartUsage`); recursive `computeInterconnect(scopeDef, seen)` reused for both the top scope
and each expanded part; `expandedInternals` map with `prefixDiagram()` id-remapping and
`parentId`/`extent:'parent'` nesting; size overrides feeding the outer layout; per-part `+`/`−`
toggle; reset-on-scope-change effect; `seen` set guarding self-recursion.

---

## Feature 3 — Automatic layout & viewport fit

### 3.1 Rationale
The Interconnect view must stay readable as parts, ports, and wiring change (scope switch, expand /
collapse, show / hide unconnected ports, drag). A manual or naïve layout produces overlapping boxes,
wires that cross through shapes, and coincident lines that are impossible to trace. The view SHALL
lay itself out automatically so the diagram is legible without user intervention, and SHALL keep the
whole diagram framed in the viewport.

### 3.2 Definitions
- **Obstacle** — any rendered box (part box, expanded-part container, or the scope frame) that a
  wire must not pass through.
- **No overlap** — no two part/container boxes occupy overlapping screen area, and no two connection
  line segments are coincident (collinear and overlapping) on either axis.
- **Settled layout** — the final node positions and edge routes after any asynchronous layout pass
  has completed (layout may run off the main thread).

### 3.3 Functional requirements
- **FR-AL-1** The view SHALL position boxes automatically with **no overlap** between any two
  boxes — top-level parts, and the internals of every expanded container, at every nesting depth.
- **FR-AL-2** Connection lines SHALL **never overlap**: no two wire segments may be coincident
  vertically or horizontally. Wires that share a source or target face SHALL be separated into
  distinct parallel channels.
- **FR-AL-3** A connection SHALL **never pass through an obstacle**. Where a straight route would
  cross a box, the wire SHALL route **around** it, keeping clearance from every box face.
- **FR-AL-4** Where two parts are connected, their facing ports SHOULD be ordered to make the
  connecting lines **as parallel (straight) as possible**, minimising crossings — best-effort, not
  a zero-crossing guarantee.
- **FR-AL-5** The automatic layout SHALL re-run and re-settle on every change that alters the
  diagram — scope switch, expand / collapse, hide / show unconnected ports, and node drag — and the
  no-overlap / no-through-shape / no-coincident-lines guarantees (FR-AL-1..3) SHALL hold after each.
- **FR-AL-6** After each settled layout, the view SHALL **auto-fit the viewport** to frame the whole
  diagram (see FR-EX-11 for the expand / collapse instantiation). Auto-fit MUST use the settled
  layout (wait for asynchronous layout to finish), MUST fire on every change (not only the first),
  and MUST NOT fight a user's manual pan / zoom performed after the layout has settled.
- **FR-AL-7** An expanded container's internal wiring SHALL be laid out with the same guarantees as
  the top level (FR-AL-1..4) — internal boxes non-overlapping, internal wires non-coincident and
  routed around internal boxes, and cross-boundary wires meeting the container's boundary ports
  exactly (no wire ending in empty space, none cutting through the container).

### 3.4 Acceptance criteria
- In any scope, no two boxes overlap and no wire segment is coincident with another (H or V).
- A wire whose straight path would cross a third box bends around that box with visible clearance.
- Expanding a part lays out its internals with no internal overlap, no wire through the container
  frame, and every cross-boundary wire connected to a boundary port (none dangling).
- Dragging a box re-flows the routes so they stay non-overlapping and obstacle-avoiding.
- After any of the above, the viewport is re-fit to show the whole diagram.

### 3.5 Prototype reference
`src/ui/layout/graphLayout.ts` — `layoutWiringElk()` runs ELK `layered` (RIGHT, `ORTHOGONAL`) with
crossing-minimisation and `spacing.edgeEdge` / `spacing.edgeNode` (parallel-segment separation +
route-around clearance); expanded containers are laid out **bottom-up as separate single-level
passes** (a compound is pre-sized and its boundary ports pinned `FIXED_POS` in its parent) rather
than one nested hierarchical pass, because elkjs `INCLUDE_CHILDREN` mis-routes cross-boundary edges.
`src/ui/layout/FitPanel.tsx` — `autoFitVersion` drives `fitView` via the `useReactFlow` hook (live
instance) so auto-fit fires reliably on every settled layout; `StructuralWiringView.tsx` passes
`autoFitVersion={layoutEpoch}` (bumped when each async ELK layout resolves).

---

## Cross-cutting notes for the dev team
- **Purely presentational.** No feature edits the model; all are view state derived from the parsed
  containment graph. They MUST compose (e.g. hide unconnected ports *inside* an expanded white box,
  with the reduced port set feeding the automatic layout).
- **Stable identity.** Correct behavior depends on stable, resolvable port/element identity from
  the parser (a `part.port` connection endpoint must resolve to the same port the type definition
  declares) — this is the main correctness dependency for all three features.
- **Layout is the shared substrate.** Features 1 and 2 both change the element/port set that the
  automatic layout (Feature 3) consumes; the no-overlap, no-through-shape, and auto-fit guarantees
  MUST hold after every such change.
- **Performance.** Expansion can multiply on-screen elements; the official implementation should
  lay out only expanded subtrees and reflow incrementally.
