# Enforceable Runtime Interaction Contracts

This project now has an explicit enforceability layer for the runtime sequence.

## Main files

- `12_DynamicInteractionSequences.sysml`
  - message-based SysML v2 runtime sequence
- `13_InterfaceContracts.sysml`
  - human-readable SysML v2 interface contract view
- `contracts/runtime_interaction_contracts.json`
  - machine-checkable contract source
- `tools/check_runtime_interaction_contracts.py`
  - validates runtime messages against contracts
- `tools/run_all_checks.py`
  - runs both TRLC traceability and runtime interaction checks

## What is enforced

For every runtime `message` in `AcpdCdd_Runtime_Sequence`, the checker validates:

1. the message is declared in the contract model;
2. the message order matches the contract order;
3. the caller component matches the contract;
4. the callee component matches the contract;
5. the callee/operation owner provides the referenced operation;
6. the contract declares a caller port and callee port for the interaction;
7. the connection contract direction matches the message direction;
8. no extra undeclared runtime messages exist;
9. no expected runtime messages are missing.

## Run all checks

From the project root:

```powershell
python tools\run_all_checks.py
```

or:

```powershell
py tools\run_all_checks.py
```

Generated reports:

```text
reports/traceability_report.html
reports/runtime_interaction_contract_report.html
```

## Demo failure

To show enforcement, rename a message in `12_DynamicInteractionSequences.sysml`, for example:

```sysml
message AcpdCdd_Output
```

to:

```sysml
message AcpdCdd_Output_WRONG
```

Then run:

```powershell
python tools\run_all_checks.py
```

The runtime interaction contract check will fail because the runtime sequence no longer matches the declared contract.
