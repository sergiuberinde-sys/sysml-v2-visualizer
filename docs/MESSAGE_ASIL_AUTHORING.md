# Authoring SysML v2 so message ASIL is visualized

The **Sequence** view shows a small **ASIL badge** next to each message. The
visualizer **never** reads ASIL from the message itself — it derives it from the
**structural interface the message maps to**, declared with an explicit
`dependency`. Line up three things and the badge appears: the **message**, the
**dependency**, and the **`@ASIL`** on the target interface.

---

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

---

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

---

## What each badge means (self-diagnosis)

| Badge            | Meaning                                                              |
| ---------------- | ------------------------------------------------------------------- |
| `ASIL D` (color) | **Resolved** — the target interface carries that ASIL.              |
| `ASIL ?`         | **Unresolved** — the dependency is missing or `to` did not resolve. |
| *(no badge)*     | **Unassigned** — the interface resolved but carries no `@ASIL`.     |

Hover any badge to see the full derivation: the message, its payload, and the
interface endpoint with its ASIL.

---

## "No badge appeared" checklist

- Is the `dependency` in the **same action definition** as the message? *(R2)*
- Does `from` **exactly match** the message name? *(R2)*
- Is `to` **`::`-qualified** (not bare, not dotted), and does that interface exist? *(R3)*
- Is `@ASIL { level = ASILLevel::… }` on the **interface**, not on the message? *(R4)*

---

## How the tool derives the result (reference)

For each message it finds the `dependency` whose **client** is that message (scoped
to the owning sequence), resolves the **supplier** to the concrete `InterfaceUsage`
(or `PortUsage`), and reads `@ASIL` off it:

- has `@ASIL` → **resolved** (that level);
- resolved but no `@ASIL` → **unassigned** (no badge);
- can't resolve the dependency/target → **unresolved** (`ASIL ?`).

The tool never guesses — it never infers ASIL from lifelines, payload types, or names.
