# Sequence View — Interaction Scenarios

The **Sequence** tab renders a UML-style sequence diagram: vertical lifelines
for each participant, horizontal arrows for messages, execution activation bars,
and `alt` combined fragments for conditional branches.

---

## 1. SysML v2 elements used

| Element | Keyword | What it models |
|---|---|---|
| `ActionDefinition` | `action def` | Interaction container (supports `if/else` → `alt` fragments) |
| `PartDefinition` | `part def` | Alternative container for simple sequences (no conditional branches) |
| `PartUsage` | `part` | Lifeline — one per participant |
| `EventOccurrenceUsage` | `event occurrence` | Named event on a participant type |
| `FlowUsage` (message form) | `message` | A message arrow from one event to another |
| `IfActionUsage` | `if … else …` | `alt` combined fragment (ActionDefinition only) |

---

## 2. Minimal working example

### Step 1 — Declare participant types with their events

```sysml
part def Client_Participant {
    event occurrence sendLoginRequest;
    event occurrence receiveAuthToken;
    event occurrence receiveAuthError;
    event occurrence sendDataRequest;
    event occurrence receiveData;
}

part def AuthService_Participant {
    event occurrence receiveLoginRequest;
    event occurrence sendAuthToken;
    event occurrence sendAuthError;
}

part def DataService_Participant {
    event occurrence receiveDataRequest;
    event occurrence returnData;
}
```

Each `event occurrence` declaration creates an `EventOccurrenceUsage` that
serves as a named point on the lifeline where a message can be sent or
received.

### Step 2 — Declare the interaction as an `action def`

```sysml
package SequenceDiagramTest {

    attribute credentialsValid : ScalarValues::Boolean;

    // ... (participant types above) ...

    action def UserSession_Sequence {

        part client      : Client_Participant;
        part authService : AuthService_Participant;
        part dataService : DataService_Participant;

        // Messages use the 'message' keyword (a FlowUsage).
        // 'from' names a participant and one of its declared events.
        // 'to'   names another participant and one of its events.
        message login
            from client.sendLoginRequest
            to authService.receiveLoginRequest;

        // Conditional branch — renders as an 'alt' fragment.
        if credentialsValid {
            message issueToken
                from authService.sendAuthToken
                to client.receiveAuthToken;
        } else {
            message authFailed
                from authService.sendAuthError
                to client.receiveAuthError;
        }

        message fetchData
            from client.sendDataRequest
            to dataService.receiveDataRequest;

        message dataResponse
            from dataService.returnData
            to client.receiveData;
    }
}
```

### What the plugin shows

![Sequence view — UserSession scenario](img/sequence-overview.png)

- Each `part` becomes a lifeline header box at the top.
- Each `message` becomes a horizontal arrow labelled with the message name.
- Messages are drawn in source-order (top to bottom).
- An `if … else …` block renders as an `alt` combined fragment with two
  labeled sections; the guard label comes from the `if` condition attribute.
- Execution bars (vertical filled rectangles) are computed automatically and
  show when each participant is active (i.e. is the source or target of at
  least one message in the current range).

---

## 3. Message syntax in detail

```
message <name>
    from <participantPart>.<eventOccurrence>
    to   <participantPart>.<eventOccurrence>;
```

- `<participantPart>` is the name of a `part` declared in the same
  `action def`.
- `<eventOccurrence>` is the name of an `event occurrence` declared inside
  the participant's `part def`.
- If the event name is omitted (bare `from client to authService`), the
  message endpoint is unresolved and the arrow may not render.

---

## 4. Conditional branches (`alt` fragment)

```sysml
if <booleanAttribute> {
    message ...
} else {
    message ...
}
```

- `<booleanAttribute>` must be a `Boolean`-typed attribute visible in the
  enclosing scope (typically declared at package level with
  `attribute name : ScalarValues::Boolean`).
- The `else` branch is optional; an `if` without `else` renders a single
  labeled section with the guard condition.
- The negated condition (`not <attribute>`) is inferred automatically for the
  `else` branch label.
- Multiple `if … else …` blocks are supported and each renders as its own
  `alt` fragment.

---

## 5. `action def` vs. `part def` as container

| Container | Supports `if/else` → `alt` | Typical use |
|---|---|---|
| `action def` | Yes | Recommended for sequences with conditional branches |
| `part def` | No | Simple sequences with only unconditional messages |

Use `action def` for all new sequence models.  `part def` is accepted for
backwards compatibility with simpler models that have no branching.

---

## 6. Multiple sequences in one file

A file can contain many `action def` (or `part def`) containers.  The Sequence
view shows a tab button for each one above the diagram area; click a tab to
switch to that sequence.  Only containers that have at least one `message`
child are listed.

---

## 7. Cross-file models

Participant types (`part def` with `event occurrence` members) are often
defined in a separate file from the interaction (`action def`).  Open the
project folder as a VS Code workspace so Phase 2 can resolve cross-file
references.  Lifeline labels use the `part` usage name; participant types that
cannot be resolved appear with their declared name only.

---

## 8. Self-messages — not yet rendered

A self-message (where the sender and receiver are the same lifeline) is written
by referencing the same `part` in both `from` and `to` positions, using
different event occurrences on the same participant.

```sysml
part def Server_Participant {
    event occurrence receiveRequest;
    event occurrence beginProcessing;   // internal trigger
    event occurrence sendResponse;
}

action def ServerHandling {
    part server : Server_Participant;
    part client : Client_Participant;

    message inbound
        from client.sendRequest
        to   server.receiveRequest;

    // Self-message — server triggers its own internal step.
    message internalTrigger
        from server.receiveRequest
        to   server.beginProcessing;

    message reply
        from server.sendResponse
        to   client.receiveResponse;
}
```

> **Not yet rendered.**  Self-messages require special layout: the arrow
> leaves and re-enters the same lifeline as a U-shaped arc.  A future
> implementation would detect same-lifeline messages and route them as
> self-loops on the right side of the lifeline.

---

## 9. Loop combined fragments — not yet rendered

UML sequence diagrams use `loop` combined fragments to indicate a repeated
exchange.  SysML v2 expresses repetition via `LoopActionUsage` (§7.17.12)
inside the interaction container.

```sysml
action def RetriedRequest {
    attribute retryLimit : Integer;

    part client : Client_Participant;
    part server : Server_Participant;

    // Loop — not yet rendered as an alt/loop fragment box.
    action retry loop {
        message request  from client.sendRequest  to server.receiveRequest;
        message response from server.sendResponse to client.receiveResponse;
    } until retryLimit <= 0;
}
```

> **Not yet rendered.**  A future implementation would wrap the repeated
> messages in a labeled `loop [guard]` fragment box.

**Spec reference:** §7.17.12 Loop Action Usages (SysML v2.0).

---

## 10. opt / par / break combined fragments — not yet rendered

UML combined fragments beyond `alt` (such as `opt`, `par`, `break`, `ref`,
`critical`) have no direct SysML v2 textual keyword equivalents, but can be
approximated:

- **`opt`** — an `if` block without an `else` branch.  Currently renders as
  an `alt` with a single guard section.
- **`par`** — parallel message exchanges would require a `fork`/`join` action
  structure in SysML v2.  Not yet rendered as a `par` box.
- **`ref`** — referencing another interaction definition.  SysML v2 uses
  `perform action` typed by another `action def`; not yet shown as a `ref`
  box in the Sequence view.

```sysml
action def OptionalDataFetch {
    attribute dataRequested : ScalarValues::Boolean;

    part client : Client_Participant;
    part server : Server_Participant;

    // opt — if without else; renders as a single-branch alt today.
    if dataRequested {
        message fetch from client.sendDataRequest to server.receiveDataRequest;
        message data  from server.sendData        to client.receiveData;
    }
}
```

> **Planned:** Distinguish single-branch `if` as `opt` and render it with an
> `opt` label rather than `alt`.

**Spec references:** §7.17.11 If Action Usages, §7.17.12 Loop Action Usages
(SysML v2.0).

---

## 11. Create and destroy lifelines — not yet rendered

UML sequence diagrams support lifelines that are created or destroyed during
the interaction (shown as dashed-line creation arrows and X-marks at
destruction points).  In SysML v2, these are modelled via `SendActionUsage`
and `AcceptActionUsage` targeting creation or termination events.

> **Not yet rendered.**  The Sequence view currently shows all lifelines at
> the same height across the full diagram duration regardless of when
> participants logically enter or leave the interaction.

**Spec references:** §7.17.7 Send Action Usages, §7.17.8 Accept Action Usages,
§7.17.10 Terminate Action Usages (SysML v2.0).

---

## 12. Rendering support summary

| Feature | Rendered | Spec clause |
|---|---|---|
| Lifeline header boxes | ✓ | §7.11 |
| Message arrows in source order | ✓ | §7.16 |
| Execution activation bars | ✓ | — |
| `alt` combined fragment (`if … else …`) | ✓ | §7.17.11 |
| Single-branch `if` (without `else`) | Renders as one-section `alt` | §7.17.11 |
| Negated `else` guard inferred automatically | ✓ | §7.17.11 |
| Multiple `if … else …` blocks | ✓ | §7.17.11 |
| Self-messages (same-lifeline arrows) | Not yet rendered | — |
| `loop` combined fragment | Not yet rendered | §7.17.12 |
| `opt` label (single-branch `if`) | Not yet rendered | §7.17.11 |
| `par` combined fragment | Not yet rendered | §7.17 |
| `ref` combined fragment | Not yet rendered | §7.17.6 |
| Create / destroy lifelines | Not yet rendered | §7.17.7, §7.17.10 |

---

## 13. Common modelling mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Event name not declared in the `part def` | Arrow not drawn; endpoint is missing | Add `event occurrence <name>;` to the participant's `part def` |
| `action def` has no `message` children | Interaction not listed in the Sequence tab | Add at least one `message` statement inside the `action def` |
| Guard attribute not in scope | Condition label missing or wrong | Declare `attribute name : ScalarValues::Boolean;` at package level |
| Using `flow` instead of `message` | May render in Interconnect but not Sequence | Use the `message ... from ... to ...` form for sequence messages |
| Conditional branch inside a `part def` (not `action def`) | `alt` fragment not rendered | Switch the container to `action def` |
| Self-message from/to same lifeline | Arrow not drawn | Feature not yet rendered; document as a comment instead |

---

## 14. Specification references

Both documents are freely available from the OMG website and the
[SysML-v2-Release GitHub repository](https://github.com/Systems-Modeling/SysML-v2-Release/tree/master/doc).

**SysML v2.0** — OMG formal/2026-03-02 · https://www.omg.org/spec/SysML/2.0/

| Topic | Clause |
|---|---|
| Occurrences (`occurrence def`) | §7.9 |
| Event Occurrence Usages (`event occurrence`) | §7.9.5 |
| Parts as participants (`part def`, `part`) | §7.11 |
| Flows and Messages — `message` keyword and syntax | §7.16 |
| Flow Definitions and Usages (including `message` form) | §7.16.2 |
| Actions as interaction containers (`action def`) | §7.17 |
| Send Action Usages (`send X via port`) | §7.17.7 |
| Accept Action Usages (`accept when <trigger>`) | §7.17.8 |
| Terminate Action Usages | §7.17.10 |
| If Action Usages (`if … else …` → `alt` fragment) | §7.17.11 |
| Loop Action Usages (`loop` / `while` / `for`) | §7.17.12 |
| Conditional Successions (`if guard then`) | §7.17.5 |

**KerML v1.0** — OMG formal/2026-03-01 · https://www.omg.org/spec/KerML/1.0/

| Topic | Clause |
|---|---|
| Interactions (message exchange semantics) | §8.3.4.9 |
| Behaviors and Steps (action execution model) | §7.4.7 |

---

## 15. Checklist before opening in the plugin

- [ ] Each participant is declared as a `part` usage inside the `action def`.
- [ ] Each participant type has `event occurrence` members for every
      message endpoint referenced.
- [ ] All `message` statements use `from part.event to part.event` form.
- [ ] Boolean guard attributes are declared in scope (package level) before
      use in `if` conditions.
- [ ] The container is an `action def` if conditional branches are needed.
- [ ] The **Sequence** tab is selected in the visualizer panel.
