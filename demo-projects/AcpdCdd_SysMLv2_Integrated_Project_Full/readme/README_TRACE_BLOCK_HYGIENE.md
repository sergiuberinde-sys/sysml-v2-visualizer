# TRLC Trace Block Hygiene

This project intentionally uses inline TRLC trace comments attached to concrete SysML elements.

Example:

```sysml
// trlc-satisfies: 28824395
action AcpdCdd_CheckTimestamps;
```

Generated top-of-file trace blocks are forbidden because they duplicate trace information and can drift from the actual architecture.

Forbidden markers include:

```text
BEGIN AUTO-GENERATED TRLC TRACE BLOCK
END AUTO-GENERATED TRLC TRACE BLOCK
BEGIN TRLC UNIT ALLOCATION TRACE
END TRLC UNIT ALLOCATION TRACE
```

The checker `tools/check_trace_block_hygiene.py` validates that:

- no stale generated trace-block markers remain;
- each `// trlc-satisfies:` comment is directly attached to a SysML element;
- active allocation IDs from `contracts/trlc_unit_allocations.json` are present in the expected SysML files.

Safety goal traceability is derived indirectly:

```text
Safety Goal -> TRLC requirement IDs -> SysML trlc-satisfies comments -> derived component/unit support
```

Therefore SysML files do not need direct `safety-goal` comments.
