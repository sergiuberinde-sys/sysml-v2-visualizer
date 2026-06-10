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

## 8. Common modelling mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Event name not declared in the `part def` | Arrow not drawn; endpoint is missing | Add `event occurrence <name>;` to the participant's `part def` |
| `action def` has no `message` children | Interaction not listed in the Sequence tab | Add at least one `message` statement inside the `action def` |
| Guard attribute not in scope | Condition label missing or wrong | Declare `attribute name : ScalarValues::Boolean;` at package level |
| Using `flow` instead of `message` | May render in Interconnect but not Sequence | Use the `message ... from ... to ...` form for sequence messages |
| Conditional branch inside a `part def` (not `action def`) | `alt` fragment not rendered | Switch the container to `action def` |

---

## 9. Checklist before opening in the plugin

- [ ] Each participant is declared as a `part` usage inside the `action def`.
- [ ] Each participant type has `event occurrence` members for every
      message endpoint referenced.
- [ ] All `message` statements use `from part.event to part.event` form.
- [ ] Boolean guard attributes are declared in scope (package level) before
      use in `if` conditions.
- [ ] The container is an `action def` if conditional branches are needed.
- [ ] The **Sequence** tab is selected in the visualizer panel.
