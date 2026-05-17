# SysML v2 Runtime Interaction Contracts

Runtime interaction contracts are modeled directly in SysML v2:

`17_RuntimeInteractionContracts.sysml`

The project no longer uses `contracts/runtime_interaction_contracts.json` for runtime interaction checking.

## Runtime checker

Run:

```bash
python tools/check_runtime_interaction_contracts.py
```

The checker reads:

- `12_DynamicInteractionSequences.sysml`
- `17_RuntimeInteractionContracts.sysml`
- `00_Types.sysml`

It verifies:

- every expected runtime message exists
- no undeclared runtime messages exist
- message order is correct
- sender and receiver components match the contract
- payload types are defined in `00_Types.sysml`

## Why this matters

This makes SysML v2 the visible source of truth for interaction contracts.

```text
SysML v2 interaction contract
→ runtime interaction checker
→ CI-style enforcement
```
