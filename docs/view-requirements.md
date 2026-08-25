# Reqts View — Requirement List

The **Reqts** tab shows a flat, scannable list of the **TRLC requirements** loaded for the
workspace. It is the browse/search companion to the **Trace** view (which arranges the same
requirements by derivation and links them to the model — see
[view-traceability.md](view-traceability.md)).

---

## 1. What the plugin shows

One card per requirement, in file order. Each card shows:

| Element | Meaning |
|---|---|
| **id** | The requirement's TRLC record name |
| **title** | The requirement title |
| `ASIL-x` badge | The requirement's ASIL, colour-coded QM → D (ISO 26262 escalation) |
| description | The requirement text (if present) |

Selecting a card highlights it and publishes the selection (id, title, ASIL, text) to the
inspector, so it can be cross-referenced with the diagram views.

## 2. Loading requirements

Requirements come from native IPF **`.trlc`** files and are **auto-loaded** from the
workspace (`**/*.trlc`) — the same source the Trace view uses. If no `.trlc` requirements
are loaded, the view shows an empty state prompting a TRLC import.

Each record's **name is the id**; `description` accepts triple-quoted `''' … '''`
(multi-line) or legacy `"…"`, and `asil` accepts the enum form `IpfRMBase.ASIL.D` (→ `D`)
or the legacy `asil = "D"`. See [view-traceability.md](view-traceability.md) §1 for the full
`.trlc` format.

## 3. Reqts vs Trace

| Use **Reqts** when… | Use **Trace** when… |
|---|---|
| you want to read / scan / search all requirements | you want to see the derivation hierarchy |
| you need a requirement's id, ASIL, and text | you need which elements `@Satisfies` a requirement |
| — | you want click-through from a requirement to its model element |

## 4. Authoring checklist

- [ ] Requirements are in `**/*.trlc` files inside the open workspace folder.
- [ ] Each record uses the IPF form (`IpfRMBase.<Type> <Name_id> { … }`).
- [ ] `asil` uses `IpfRMBase.ASIL.<level>` (or legacy `"<level>"`) to get a coloured badge.
- [ ] The **Reqts** tab is selected in the visualizer panel.
