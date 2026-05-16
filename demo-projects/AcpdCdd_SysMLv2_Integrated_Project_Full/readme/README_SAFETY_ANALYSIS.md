# Safety Analysis Workflow

The project implements architecture-driven safety-analysis support using:

- SysML v2
- TRLC
- Python CI-style verification scripts

## Safety-analysis structure

### TRLC

The TRLC layer contains:

- Failure Modes
- Control Measures
- ASIL information
- safety-analysis metadata

Files:

- `requirements/failure_modes.trlc`
- `requirements/control_measures.trlc`

### SysML v2

The SysML v2 layer contains:

- runtime architecture
- behavioral interactions
- sequence-based behavior
- FTA/root-cause structures
- safety mechanism placement
- requirement traceability

Files:

- `12_DynamicInteractionSequences.sysml`
- `14_ComponentInteractionSequences.sysml`
- `16_FaultTrees.sysml`

## Verification

Safety-analysis consistency is checked using:

- `tools/check_safety_analysis_traceability.py`

The checker validates:

- every FailureMode has architectural context
- every FailureMode has FTA/root-cause coverage
- every basic/root event has a ControlMeasure or open issue
- mitigation references are valid
- traceability chains are complete

## Eclipse execution

Example:

Run → External Tools → External Tools Configurations

Arguments:

tools/run_all_checks.py

or:

tools/check_safety_analysis_traceability.py
