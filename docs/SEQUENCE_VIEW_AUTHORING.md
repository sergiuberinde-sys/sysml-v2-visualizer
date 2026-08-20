# Sequence view — authoring guide (for model authors)

The **Sequence** view derives two optional, opt-in visualizations from your SysML v2
model. Both are **additive** — they never change message, lifeline or fragment
rendering — and each appears **only** when the model is authored in the specific
shape below. This is the **how-to for model authors**; the visualizer-side
requirements live in `Extra_features_requirements.md` (Features 8–9).

1. [Message ASIL badges](#1-message-asil-badges)
2. [Timing constraints (FTTI / duration deadlines)](#2-timing-constraints-ftti--duration-deadlines)

---

# 1. Message ASIL badges

The view shows a small **ASIL badge** next to each message. The visualizer **never**
reads ASIL from the message itself — it derives it from the **structural interface
the message maps to**, declared with an explicit `dependency`. Line up three things
and the badge appears: the **message**, the **dependency**, and the **`@ASIL`** on the
target interface.

## The pattern

One `dependency` per message, pointing at the `interface` that carries the ASIL.

```sysml
// 1) In the sequence action definition — the message + one dependency:
action def HvmConfinedEpc3Sequence {
    // ... ref part lifelines ...
    message trapReport of TrapReport
        from untrusted.trapRaised to trapHandler.trapReceived;

    dependency trapReportStructuralInterface            // <message>StructuralInterface
        from trapReport                                 // client = the message's exact name
        to Architecture::HvmSoftwarePartitionSw::hvmUntrustedTrapReport;  // qualified interface
}

// 2) In the structure — the interface carries the authoritative ASIL:
part def HvmSoftwarePartitionSw {
    interface hvmUntrustedTrapReport : Tc4zTrapReportInterface
        connect untrustedApplicationArea.trap to sharedHvmTrapHandler.trap {
        @ASIL { level = ASILLevel::ASIL_D; }            // <-- the ASIL the badge shows
    }
}
```

→ Badge shows **`ASIL D`** on the `trapReport` message.

## The five rules that make it work

1. **Name the dependency `<message>StructuralInterface`.** That suffix is the
   convention for this pattern. (Reserve `SenderInterface` / `ReceiverInterface` —
   the tool treats those as a two-port variant, which we are not using.)
2. **`from <messageName>`** must be the message's **exact declared name**, and the
   **dependency must be declared inside the same action definition** as the message.
   Message names are only locally unique, so the tool scopes by the owning sequence —
   a dependency in a different scope will not match.
3. **`to <supplier>` must be `::`-qualified** and resolve to a real `interface`
   (or `port`). Use `Def::name` **or** `Package::Def::name`. A bare name
   (`to hvmUntrustedTrapReport`) or a dotted path (`role.port`) is **not** recognized.
4. **`@ASIL` goes on the target interface, never on the message:**
   `@ASIL { level = ASILLevel::ASIL_D; }`. Valid levels: `QM`, `ASIL_A`, `ASIL_B`,
   `ASIL_C`, `ASIL_D`.
5. The message must be a real `message` inside a sequence that renders in the
   **Sequence** view.

## What each badge means (self-diagnosis)

| Badge            | Meaning                                                              |
| ---------------- | ------------------------------------------------------------------- |
| `ASIL D` (color) | **Resolved** — the target interface carries that ASIL.              |
| `ASIL ?`         | **Unresolved** — the dependency is missing or `to` did not resolve. |
| *(no badge)*     | **Unassigned** — the interface resolved but carries no `@ASIL`.     |

Hover any badge to see the full derivation: the message, its payload, and the
interface endpoint with its ASIL.

## "No badge appeared" checklist

- Is the `dependency` in the **same action definition** as the message? *(R2)*
- Does `from` **exactly match** the message name? *(R2)*
- Is `to` **`::`-qualified** (not bare, not dotted), and does that interface exist? *(R3)*
- Is `@ASIL { level = ASILLevel::… }` on the **interface**, not on the message? *(R4)*

## How the tool derives the result (reference)

For each message it finds the `dependency` whose **client** is that message (scoped
to the owning sequence), resolves the **supplier** to the concrete `InterfaceUsage`
(or `PortUsage`), and reads `@ASIL` off it:

- has `@ASIL` → **resolved** (that level);
- resolved but no `@ASIL` → **unassigned** (no badge);
- can't resolve the dependency/target → **unresolved** (`ASIL ?`).

The tool never guesses — it never infers ASIL from lifelines, payload types, or names.

---

# 2. Timing constraints (FTTI / duration deadlines)

A sequence can carry an official SysML v2 **timing-evaluation** layer: named
event-occurrence milestones, elapsed durations measured from a common origin, a
duration budget, and an asserted contract. When present, the view shows a collapsible
**⏱ Timing contract** panel and marks the deadline-bounded message with a
**`⏱ ≤ <budget>`** badge.

The measured times are **symbolic** (`TimeOf(x) − TimeOf(y)`) — only the budget is a
number. This is a verification/analysis layer: it adds no runtime signal, port or
message.

## The pattern

Declare the milestones, the elapsed measures, the budget, and the contract **inside
the sequence action definition** (from `FarHwEpc2Sequence`):

```sysml
private import ISQBase::DurationValue;
private import SI::s;
private import Time::TimeOf;

action def FarHwEpc2Sequence {
    // ── milestones: event occurrences (top-level and/or inside ref part lifelines)
    event occurrence faultOccurred;                       // the t = 0 origin
    event occurrence communicationSilent;
    ref part smu   : Tc4zSmuHw          { event occurrence alarmAccepted; }
    ref part reset : Tc4zResetControlHw { event occurrence resoutReceived; }

    // ... messages (e.g. `message resoutSignal ... to reset.resoutReceived;`) ...

    // ── elapsed measures: TimeOf(target) − TimeOf(origin)
    attribute alarmAcceptedElapsed  : DurationValue = TimeOf(smu.alarmAccepted)    - TimeOf(faultOccurred);
    attribute resoutReceivedElapsed : DurationValue = TimeOf(reset.resoutReceived) - TimeOf(faultOccurred);

    // ── the budget: a literal duration with a bracketed unit
    attribute drivingFttiLimit      : DurationValue = 0.010 [s];   // 10 ms FTTI

    // ── the contract: inequalities joined by `and`; one bounds a measure by the budget
    assert constraint timingContract {
        alarmAcceptedElapsed >= 0 [s] and
        alarmAcceptedElapsed < resoutReceivedElapsed and
        resoutReceivedElapsed <= drivingFttiLimit
    }
}
```

→ The panel lists the measures and shows an **FTTI ≤ 10 ms** chip; because the contract
bounds `resoutReceivedElapsed` by the budget and that measure's target is
`reset.resoutReceived`, the `resoutSignal` message (which arrives there) gets a
**`⏱ ≤ 10 ms`** badge.

## The rules that make it work

1. **Elapsed measure** — `attribute <name> : DurationValue = TimeOf(<target>) - TimeOf(<origin>);`
   Both operands are event occurrences: `participant.event` (a milestone on a lifeline)
   or a bare top-level `event`. The exact `TimeOf(…) - TimeOf(…)` form is required.
2. **Budget** — `attribute <name> : DurationValue = <number> [<unit>];`
   Units understood: `s`, `ms`, `us`/`µs`, `ns`, `min` (normalised for display, e.g.
   `0.010 [s]` → `10 ms`).
3. **Contract** — `assert constraint <name> { <clauses joined by `and`> }`. A clause of
   the form `<measure> <= <budget>` (also `<`, or an inline `<= <number> [<unit>]`)
   makes that measure **deadline-bounded**.
4. **Scope** — all timing elements must be declared **inside the same sequence action
   definition** (the tool attaches timing to its owning sequence by qualified name,
   exactly like the ASIL dependencies).
5. **Deadline badge placement** — the badge appears on the diagram only when the
   deadline measure's **target milestone is the receive endpoint (`to`) of a rendered
   message** (e.g. `TimeOf(reset.resoutReceived)` ↔ `message … to reset.resoutReceived`).
   A measure whose target isn't a message endpoint still appears in the panel, just
   without an on-diagram badge.

## What renders

- **⏱ Timing contract** panel (collapsed by default) with: the elapsed measures and their
  `TimeOf` expressions, the deadline-bounded measure highlighted with `≤ <budget>`, an
  **FTTI ≤ <budget>** chip, and the asserted contract.
- A **`⏱ ≤ <budget>`** badge under the message that arrives at the deadline milestone.

## "No timing shown" checklist

- Are the timing elements declared **inside** the sequence action definition? *(T4)*
- Does each elapsed measure use `TimeOf(<a>) - TimeOf(<b>)` **exactly**? *(T1)*
- Is the budget a **literal with a bracketed unit** (`0.010 [s]`), not an expression? *(T2)*
- Missing the on-diagram badge? Check the deadline measure's target is the **`to`
  endpoint of a real message** in the same sequence. *(T5)*

## How the tool derives the result (reference)

Per owning definition it reads the elapsed measures (target/origin), the budgets
(normalised to ms), and the asserted contract; it then scans the contract for
`measure ≤ budget` clauses and attaches each budget to that measure's target milestone
as a deadline. On the diagram, a message whose `to` endpoint equals a deadline's target
milestone is annotated. Values are never inferred — only the budget is quantitative.
