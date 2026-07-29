# Extra Features — Requirements for Official Implementation

## Purpose & status

Seven capabilities were **prototyped** in the SysML v2 Visualizer's **Interconnect view**
(the structural-wiring / Internal Block Diagram view; prototype code in
`src/ui/views/StructuralWiringView.tsx`): (1) show / hide unconnected ports, (2) expand / collapse
part internals, (3) automatic non-overlapping layout with viewport auto-fit, (4) one-click expand-all /
collapse-all, (5) pan-by-default navigation with a double-click-to-enter move mode, (6) colour-coding
of connections by the *data kind* they carry, with an on-canvas legend, and (7) double-click a
connection to fly the camera along it, from source to destination. This document
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

## Feature 4 — Expand All / Collapse All

### 4.1 Rationale
Feature 2 expands one part usage at a time. In a scope with many expandable parts, drilling into
each one individually is tedious when the user wants a full white-box overview (or wants to return
everything to black boxes at once). A single control that expands every expandable part — or
collapses every expanded one — lets the user flip the whole scope between black-box and white-box
in one action.

### 4.2 Definitions
- **Expandable set** — the set of all expandable parts (per Feature 2 §2.2) in the current scope,
  computed from the containment tree independently of the current expansion state.
- **Fully expanded** — the state in which every part in the expandable set is expanded.

### 4.3 Functional requirements
- **FR-XA-1** The view SHALL provide a single toolbar control that expands **every** expandable part
  in the current scope in one action, and collapses **every** expanded part in one action.
- **FR-XA-2** The control SHALL be a toggle: when the scope is **fully expanded** it SHALL offer
  *Collapse all*; otherwise it SHALL offer *Expand all*.
- **FR-XA-3** The control SHALL appear only when the current scope has at least one expandable part;
  when nothing is expandable it SHALL be hidden.
- **FR-XA-4** Expand-all SHALL be equivalent to individually expanding each part in the expandable
  set: it MUST honour all Feature 2 guarantees (correct routing to boundary ports, self-recursion
  guard FR-EX-7, one-level-per-nesting semantics — nested expandable parts revealed by expand-all
  render as collapsed boxes with their own controls).
- **FR-XA-5** Expand-all and collapse-all SHALL each trigger exactly one settled layout pass and one
  viewport auto-fit (per Feature 3 FR-AL-6 / FR-EX-11): expand-all zooms out to frame the enlarged
  diagram, collapse-all zooms back in.
- **FR-XA-6** The action SHALL be purely visual — no change to the model or diagnostics — and SHALL
  compose with the per-part controls (a subsequent single-part collapse leaves the rest expanded).
- **FR-XA-7** Expansion state (including a fully-expanded scope) SHALL reset when the active scope
  changes (per FR-EX-8).

### 4.4 Acceptance criteria
- In a scope with several expandable parts, one click expands them all; the control then reads
  *Collapse all* and one further click returns every part to a black box.
- The control is absent in a scope whose parts are all non-expandable.
- After expand-all the diagram is identical to having expanded each part by hand, and the viewport
  is re-fit to frame the whole white-box diagram.
- Expand-all in a scope containing a self-referential type terminates without hanging.

### 4.5 Prototype reference
`StructuralWiringView.tsx` — `allExpandableIds` (collected while walking the containment tree in the
main memo, independent of current expansion); `allExpanded` (`allExpandableIds.every(id =>
expandedParts.has(id))`); the toolbar button rendered only when `allExpandableIds.length > 0`,
titled "Collapse every expanded part" / "Expand every part that has internals", whose `onClick` sets
`expandedParts` to `new Set(allExpandableIds)` or `new Set()`. Reuses the same `expandedParts` state,
layout, and auto-fit path as Feature 2.

---

## Feature 5 — Pan-by-default navigation & double-click move mode

### 5.1 Rationale
Dense, zoomed-in Interconnect diagrams are hard to navigate when every left-drag grabs a node
instead of moving the canvas. The default interaction SHALL therefore **pan the whole view**, and
node rearrangement SHALL be an explicit, scoped mode the user opts into on a specific part — so
panning never fights dragging, and a drag inside one part cannot accidentally move unrelated parts.

### 5.2 Definitions
- **Pan mode** (default) — left-drag anywhere on the canvas (including over a part box) moves the
  viewport; no node is draggable.
- **Move mode** — a state entered by double-clicking a part, in which only the parts inside one
  **focused frame** are draggable so they can be rearranged.
- **Focused frame** — the container whose direct children are made draggable in move mode: an
  expanded part's white-box container (its internal parts become draggable), or the top-level scope
  frame (its top-level parts become draggable) when a collapsed/top-level part is double-clicked.

### 5.3 Functional requirements
- **FR-PM-1** The default interaction SHALL be **pan**: a left-drag that starts anywhere on the
  canvas, including over a part box, SHALL move the viewport and SHALL NOT move any node.
- **FR-PM-2** **Double-clicking a part** SHALL enter move mode focused on that part's frame:
  double-clicking an expanded part focuses its own container (its internals become draggable);
  double-clicking a collapsed or top-level part focuses the container it lives in (its siblings
  become draggable), and a top-level part focuses the scope frame.
- **FR-PM-3** In move mode, **only** the direct parts of the focused frame SHALL be draggable; all
  other parts, ports, and wiring SHALL remain fixed. Dragging a part SHALL re-route its incident
  wires to follow it (per Feature 3 FR-AL-5).
- **FR-PM-4** Move mode SHALL be visually indicated — the focused frame SHALL be highlighted and a
  banner SHALL state which frame is being edited and how to exit.
- **FR-PM-5** **Clicking empty canvas space** SHALL exit move mode and return to pan (deselecting
  the frame). Changing scope or expand/collapse state SHALL also exit move mode.
- **FR-PM-6** Entering/using move mode SHALL be purely visual navigation — dragging repositions
  nodes in the view only; it MUST NOT edit the model or diagnostics. (Drag positions MAY persist as
  view state until the next relayout, per the existing drag-persistence behavior.)
- **FR-PM-7** Double-click delivery MUST be reliable even though the canvas pan handler consumes
  node click/double-click events; the implementation MUST guarantee the double-click reaches the
  part regardless of the pan library's event handling.

### 5.4 Acceptance criteria
- With nothing focused, a left-drag starting over a part pans the canvas; the part does not move.
- Double-clicking a part shows the "Moving parts in …" banner and highlights that frame; its parts
  can then be dragged while everything else stays put; wires follow dragged parts.
- Double-clicking an expanded part makes its **internal** parts draggable; double-clicking a
  top-level part makes the **top-level** parts draggable.
- Clicking empty space removes the banner and restores pan; a left-drag pans again.
- Switching scope or toggling expand/collapse exits move mode.

### 5.5 Prototype reference
`StructuralWiringView.tsx` — pan-by-default via `nodesDraggable={false}` on `<ReactFlow>`;
`focusedFrameId` state with `TOP_FRAME = 'wscope-container'`; `onEnterFrame(nodeId, expanded)` maps
a double-clicked part to its frame (an expanded part → itself; else its container via the `a::b::c`
→ `a::b` id path, or `TOP_FRAME` for a top-level part). Double-click delivery uses a **native
capture-phase** `mousedown` listener installed on the canvas wrapper via
`addEventListener('mousedown', fn, true)` — React Flow's d3-zoom pane handler swallows synthetic
node click/dblclick while `nodesDraggable` is off, and React's *delegated* `onMouseDownCapture`
orders unreliably against it, whereas a native capture listener is guaranteed to fire first; it
detects two mousedowns <350 ms and <8 px apart and hit-tests
`e.target.closest('.react-flow__node-wiringPart')` → `data-id`. The `interactiveNodes` memo sets
`draggable: true` only on nodes whose `parentId === focusedFrameId` (or top-level parts when focus
is `TOP_FRAME`), dashes the focused frame, and sets `cursor: move` on its children; a banner ("✎
Moving parts in <label> · click empty space to exit") shows the focused label. `handlePaneClick`
clears `focusedFrameId` (exit on empty-space click); an effect clears it on scope / `expandedParts`
change. Drag itself reuses the existing `handleNodesChange` / `draggedNodeIds` / `routedEdges`
follow-the-node routing.

---

## Feature 6 — Data-kind colour-coding of connections & legend

### 6.1 Rationale
An Interconnect diagram shows *that* two ports are wired, but not *what flows* across the wire. In
practice the connections in a system carry qualitatively different things — electrical power, physical
signals, logical/information payloads, environmental quantities — and engineers reason about them
differently (safety, EMC, bandwidth, timing). The view SHALL therefore **colour and style each
connection by the kind of data it carries**, and SHALL show a **legend** so the encoding is
self-explanatory, turning the wiring diagram into a data-flow diagram at a glance.

### 6.2 Definitions
- **Data kind** — a classification of the item that a connection conveys, derived from the model. The
  model expresses it by specialising a small set of base `item def`s (in the prototype model, the
  `ExchangedContent` bases **Matter**, **Energy**, **LogicalInformation**); every
  concrete payload item def resolves (transitively, via `:>`) to exactly one base. The official
  implementation SHALL treat the base set as a **model-declared vocabulary**, not a hard-coded list.
- **Carried item of a connection** — the item def carried by the ports the connection joins. Resolved
  as: connection endpoint → its port → the port's definition → the port definition's item member →
  that member's item def → the base data kind the item def specialises.
- **Kind style** — the (colour, line style, human label) triple assigned to a data kind and used
  consistently for both the wire and its legend row.
- **Legend** — an on-canvas panel listing each data kind present in the current diagram with its
  colour/line swatch and label.

### 6.3 Functional requirements
- **FR-DK-1** Each connection SHALL be rendered in the **kind style** of the data kind of its carried
  item: a distinct colour per kind, plus a line style (solid vs dashed) so the encoding survives
  greyscale printing and colour-vision deficiency.
- **FR-DK-2** The data kind SHALL be **resolved from the model**, following the carried-item chain in
  §6.2. Resolution MUST be robust to the ways the parser represents a port's carried item — including
  when the item's type is delivered as a resolved `typedBy` edge **and** when the parser leaves it
  unresolved and records only a type *label* on the carrying feature (see FR-DK-7).
- **FR-DK-3** A connection whose data kind **cannot** be resolved SHALL fall back to a neutral default
  style (no colour claim), and MUST NOT be mis-coloured as any specific kind. Unresolved connections
  MUST NOT break rendering of the resolved ones.
- **FR-DK-4** The kind→style mapping SHALL be **stable and shared** by every consumer (wire rendering,
  legend, and any raster export) so a kind looks identical everywhere in one session.
- **FR-DK-5** The view SHALL display a **legend** whenever the current model declares the data-kind
  vocabulary. The legend SHALL list the kinds in a fixed, deterministic order, each with its
  colour/line swatch and label, and SHALL be hidden for models that do not classify their items
  (no false legend on a model without data kinds).
- **FR-DK-6** The legend SHALL **fit within the viewport and never overlap model elements**. It SHALL
  reserve its own space beside the diagram (a dedicated column, not an overlay drawn on top of the
  canvas) so that no part box, port, or wire can ever sit underneath it — at any pan or zoom. The
  diagram SHALL lay out and auto-fit within the remaining area. The legend SHALL cap its own height and
  scroll internally rather than overflow the canvas, and SHALL remain fully visible regardless of
  diagram size or zoom. When the legend is hidden (FR-DK-10) the diagram SHALL reclaim the full width.
- **FR-DK-10** The view SHALL provide a single toolbar toggle that shows / hides the data-kind
  colour-coding **and** its legend together. When hidden, every connection SHALL revert to the neutral
  default style (as if the model declared no data kinds) and the legend SHALL not be shown; toggling is
  purely presentational and MUST NOT trigger a re-layout or viewport change (wires recolour in place).
  The toggle SHALL appear only when the model declares the data-kind vocabulary, and its state SHALL
  also govern whether the PNG export includes the legend (FR-DK-9).
- **FR-DK-7** Where the parser reshapes a port's carried item so its type is **not** reachable through
  the resolved `typedBy` chain (e.g. the payload is emitted as a `ReferenceUsage`, or the item's type
  appears only as an unresolved `FeatureTyping` label), the resolver SHALL apply a name-based fallback:
  read the type label and resolve it to the matching item def by name, then classify that def. This
  fallback MUST NOT change the result for connections that already resolve via the primary chain.
- **FR-DK-8** Colour-coding and the legend SHALL be **purely presentational** — no change to the model
  or diagnostics — and SHALL compose with all other features (hide-unconnected-ports, expand/collapse,
  layout, move mode): wires inside expanded white boxes SHALL be coloured by the same rule.
- **FR-DK-9** Raster export of the diagram (the "Export to PNG" action) SHALL include the legend in the
  exported image, rendered in the same kind styles, so an exported diagram is interpretable standalone.

### 6.4 Acceptance criteria
- In a model that classifies its items, every connection is drawn in its kind's colour/line style, and
  a legend lists exactly the kinds present, in a stable order, each with a matching swatch.
- A connection whose carried item is a payload typed via a `ReferenceUsage` / label-only typing (e.g.
  an Ethernet-frame port) is coloured the **same** as one typed via a resolved `typedBy` edge to the
  same base kind — not left neutral (FR-DK-7).
- A connection whose kind genuinely cannot be resolved renders in the neutral default; all resolvable
  connections around it are still correctly coloured.
- Opening a model that does **not** classify items shows **no** legend and no coloured wires (neutral
  diagram), with no regression to layout or routing.
- The legend stays on-screen and clear of the zoom / attribution controls at any zoom level and
  diagram size, and **no model element ever overlaps it** — panning the diagram cannot slide a box or
  wire underneath the legend; exporting to PNG produces an image that contains the legend in the same styles.
- Toggling the data-kind control off reverts every wire to the neutral style and removes the legend
  (the diagram reclaims the space) without moving any box; toggling on restores the colours and legend.

### 6.5 Prototype reference
`StructuralWiringView.tsx` — `DataKind` type; `INFO_BASE_KIND` (base item-def name → kind) as the
model-declared vocabulary; `KIND_STYLE` (kind → `{ color, dashed, label }`, the shared mapping) and
`DATA_KIND_ORDER` (deterministic legend order). Resolution: `specTargetsOf` (specialization edges) +
`typedByTarget` (typedBy edges) feed `kindOfItemDef(defId)` (walks `:>` to a base in
`INFO_BASE_KIND`); `dataKindOfPort(portId)` resolves port → port def → its `ItemUsage`/`ReferenceUsage`
payload → item def → kind. The FR-DK-7 fallback uses `featureTypeLabelOf` (owner → `FeatureTyping`
child label) + `itemDefIdByName` (item-def name → id): when the payload has no `typedBy` edge, the
type *label* is resolved to the item def by name (this is what colours the `EthernetFrameIn/Out`
ports, whose `EthernetFrame` payload the parser emits as a `ReferenceUsage` with a label-only typing).
Wire styling in `rfConnEdges` picks `KIND_STYLE[dataKind]` for stroke colour and dashing. The legend is
a real flex **column beside** the React Flow canvas (the pane is a flex row; React Flow sits in a
`flex:1` column and the legend is a sibling with `maxHeight`/`overflowY:auto`), so it reserves space and
can never overlap model elements (FR-DK-6). It is gated by the `hasDataKinds` memo (`INFO_BASE_KIND`
base present in the graph) **and** the `showDataKinds` state. The toolbar `🎨 Data kinds` button toggles
`showDataKinds`; because the ELK layout signature excludes edge colour, toggling recolours edges in
place with no relayout. The "Export to PNG" handler (`handleExportPng`) redraws the legend onto the
export canvas via the 2D API (when `showDataKinds`) so it is baked into the PNG.

---

## Feature 7 — Trace a connection (fly the camera source → destination)

### 7.1 Rationale
In a large or zoomed-out Interconnect diagram a single wire can run clear across the canvas, so its two
ends are rarely visible at once and following it by eye is hard. Selecting a connection highlights it
but doesn't help you *find* where it goes. The view SHALL therefore let the user **trace a connection**:
a gesture that flies the viewport from the wire's source to its destination, following the wire, so the
user can see both endpoints and everything the wire passes on the way — useful for reviews and
walkthroughs of cross-domain flows.

### 7.2 Definitions
- **Trace** — an animated viewport movement that starts framed on a connection's **source** endpoint
  and ends framed on its **destination** endpoint, travelling **along the connection's routed path**.
- **Routed path** — the connection's actual on-screen polyline (the layout's obstacle-avoiding
  waypoints), so the camera follows the wire's bends rather than cutting a straight diagonal.
- **Trace gesture** — the explicit user action that starts a trace (distinct from selecting the edge).

### 7.3 Functional requirements
- **FR-TR-1** The view SHALL start a trace on an explicit **trace gesture** on a connection, which MUST
  be distinct from single-click selection: single-click SHALL continue to only select / spotlight the
  edge; the trace gesture (prototype: **double-click the edge**) SHALL start the flight.
- **FR-TR-2** A trace SHALL **zoom in** onto the source, then move the viewport **along the routed
  path** to the destination, **ending framed on the destination** at a readable (zoomed-in) level. The
  camera SHALL follow the wire's waypoints, not a straight source→target line, whenever the layout
  provides them (falling back to a direct path only when it does not).
- **FR-TR-3** The motion SHALL be **smooth and time-bounded**: eased (no abrupt starts/stops) and
  capped to a reasonable total duration regardless of path length, so long wires neither crawl nor
  blur past. The trace SHALL NOT zoom *out* below the user's current zoom (it is a zoom-*in* gesture).
- **FR-TR-4** A trace SHALL be **interruptible**: any real user camera input (pan, zoom, wheel,
  pointer-down on the canvas) SHALL immediately abort it and hand control back — the animation MUST
  NEVER fight the user's own navigation.
- **FR-TR-5** The trace SHALL respect the user's **reduced-motion** preference: when
  `prefers-reduced-motion` is set, it SHALL skip the sweep and simply settle framed on the destination.
- **FR-TR-6** When both endpoints are **already comfortably visible** (a short on-screen hop), the view
  MAY skip the full flight and simply settle on the destination — a trace SHALL never produce a jarring
  sweep when there is nothing to reveal.
- **FR-TR-7** A trace SHALL be **purely a viewport movement** — no change to the model, diagnostics,
  selection semantics, layout, or node positions. It SHALL self-abort if the diagram changes under it
  (scope switch, expand / collapse, unmount), since the positions it was flying toward no longer exist.
- **FR-TR-8** The trace gesture MUST compose with the other double-click semantics without conflict:
  double-clicking a **part** enters move mode (Feature 5); double-clicking a **connection** traces it.
  Double-click SHALL NOT also zoom the canvas (the default double-click-to-zoom is disabled so the
  gesture is unambiguous).

### 7.4 Acceptance criteria
- Single-clicking a wire still only selects/spotlights it; double-clicking a wire flies the view from
  its source to its destination, ending zoomed-in on the destination, following the wire's bends.
- Tracing a long cross-canvas wire pans smoothly and finishes within the duration cap; tracing a short,
  already-visible wire just settles on the destination without a big sweep.
- Panning, zooming, or clicking during a trace stops it immediately; the user's input takes effect with
  no camera fighting.
- With `prefers-reduced-motion`, a trace jumps to the destination framing without the travel animation.
- Starting a trace and then switching scope / expanding a part aborts the trace cleanly (no error, no
  camera left mid-flight over stale positions).
- Double-clicking a part still enters move mode; double-clicking empty canvas no longer zooms.

### 7.5 Prototype reference
`StructuralWiringView.tsx` — `traceEdge(edge)` builds the flight path in absolute flow coords from the
edge's ELK `data.waypoints` (falling back to the two endpoint nodes' centres via `getInternalNode`),
then drives a `requestAnimationFrame` loop that calls `setCenter(x, y, { zoom, duration: 0 })` each
frame: an `TRACE_APPROACH` fraction eases the zoom-in onto the source, then `pointAlong()` walks the
polyline by arc length with `smootherstep` easing to the destination (`TRACE_ZOOM`, duration clamped to
`TRACE_MIN_MS`..`TRACE_MAX_MS`). `handleEdgeClick` detects the double-click (two clicks on the same edge
id < 350 ms) and calls `traceEdge`; `cancelTrace` (via `traceRaf`/`traceStop` refs) is wired to
`wheel`/`pointerdown` listeners on the pane and to a `useEffect` cleanup on scope / `expandedParts`
change. `prefers-reduced-motion` and a short-on-screen-hop check short-circuit to a single `setCenter`.
`zoomOnDoubleClick={false}` on `<ReactFlow>` frees the double-click for the trace / move-mode gestures.

---

## Cross-cutting notes for the dev team
- **Purely presentational.** No feature edits the model; all are view state derived from the parsed
  containment graph. They MUST compose (e.g. hide unconnected ports *inside* an expanded white box,
  with the reduced port set feeding the automatic layout).
- **Stable identity.** Correct behavior depends on stable, resolvable port/element identity from
  the parser (a `part.port` connection endpoint must resolve to the same port the type definition
  declares) — this is the main correctness dependency across these features (it also underpins the
  data-kind resolution of Feature 6, which walks port → carried item → base kind).
- **Layout is the shared substrate.** Features 1 and 2 both change the element/port set that the
  automatic layout (Feature 3) consumes; the no-overlap, no-through-shape, and auto-fit guarantees
  MUST hold after every such change.
- **Performance.** Expansion can multiply on-screen elements; the official implementation should
  lay out only expanded subtrees and reflow incrementally.
