# SysML v2 Visualizer — View Documentation

This folder documents every view the visualizer exposes and how to write SysML v2
so each view renders something meaningful. Each per-view doc is *modelling-oriented*
(what constructs to write) and closes with an authoring checklist.

## Views at a glance

The panel shows one diagram at a time, chosen from the tab strip. Current tabs, in
order, with the component that renders them and their key capabilities:

| Tab | Renders | What it shows | Key features | Doc |
|---|---|---|---|---|
| **General** | `StructureView` | Element type hierarchy — definitions vs usages, specialization/subsetting, three-column layout | Type-hierarchy layout; `@ASIL`/`@Realization` badges | [view-general.md](view-general.md) |
| **Interconnect** | `StructuralWiringView` | Structural wiring (IBD) — parts, ports, `connect`/`bind`/item flows, interfaces | Hide unconnected ports · expand/collapse white-box · expand-all · obstacle-avoiding auto-layout + auto-fit · pan-by-default & double-click move mode · data-kind colour-coding + legend · trace-a-connection fly-through · PNG export | [view-flow.md](view-flow.md) |
| **Sequence** | `SysMLSequenceView` | UML sequence diagram — lifelines, messages, combined fragments | `first`/`then` ordering · `opt`/`alt`/`loop` fragments · found-message markers · **message ASIL badges** · **timing contract panel + FTTI deadline badges** | [view-sequence.md](view-sequence.md) · authoring: [SEQUENCE_VIEW_AUTHORING.md](SEQUENCE_VIEW_AUTHORING.md) |
| **Actions** | `OfficialBehaviorView` | Behaviour/action flows — control flow, forks/joins, decisions | **Allocation swimlanes** · guard conditions · fork/join · decision/merge · signal-named data flows | [view-actions.md](view-actions.md) |
| **State** | `StateView` | State machines — states, transitions, regions | Guarded/triggered transitions · nested & concurrent regions · entry/do/exit | [view-state.md](view-state.md) |
| **Reqts** | `RequirementsView` | Flat list of TRLC requirements | id · title · ASIL badge · description | [view-requirements.md](view-requirements.md) |
| **Trace** | `TraceabilityView` | Requirement traceability + **derivation hierarchy** | Requirement→element trace matrix from `@Satisfies` · **collapsible `derived_from_trlc` tree** (SYS/HW/SW · ASIL · trace counts) · click-through to source | [view-traceability.md](view-traceability.md) |

Two utility tabs are also available in some contexts: **JSON** (raw parse result) and
**Graph** (the raw containment graph).

## Related documents

- **[visual-reference.md](visual-reference.md)** — screenshots and a rendering guide
  (node colours, port squares, side-by-side code + diagram) for the General and
  Interconnect views.
- **[SEQUENCE_VIEW_AUTHORING.md](SEQUENCE_VIEW_AUTHORING.md)** — how model authors write
  the model so message ASIL and timing render correctly.
- **[`../Extra_features_requirements.md`](../Extra_features_requirements.md)** — the formal
  feature specification (FR-*) behind the interactive capabilities:
  Features 1–7 (Interconnect), 8–9 (Sequence ASIL/timing), 10–11 (Trace / hierarchy).

## Feature ↔ view map

| Capability | View | Spec |
|---|---|---|
| Show/hide unconnected ports; expand/collapse white-box; expand-all | Interconnect | Features 1, 2, 4 |
| Obstacle-avoiding auto-layout + auto-fit | Interconnect | Feature 3 |
| Pan-by-default + double-click move mode | Interconnect | Feature 5 |
| Data-kind colour-coding + legend | Interconnect | Feature 6 |
| Trace a connection (camera fly-through) | Interconnect | Feature 7 |
| Message ASIL badges | Sequence | Feature 8 |
| Timing contracts / FTTI deadline badges | Sequence | Feature 9 |
| `@Satisfies` requirement → element traces | Trace | Feature 10 |
| Requirement derivation hierarchy (`derived_from_trlc`) | Trace | Feature 11 |
