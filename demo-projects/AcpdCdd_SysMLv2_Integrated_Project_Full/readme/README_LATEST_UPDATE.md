# Latest Update — Inline TRLC Requirement Traces

Requirement trace comments were moved from generated unit-level blocks to the most specific existing SysML elements where possible.

Example style:

```sysml
// trlc-satisfies: <requirement-id>
action SomeConcreteModelElement;
```

The old top-of-file generated trace blocks were removed. Some requirements remain at component/type/runtime level where no more specific existing element exists without inventing model content.

`tools/check_trace_block_hygiene.py` now rejects old generated trace blocks and checks that traces are attached to concrete SysML elements.
