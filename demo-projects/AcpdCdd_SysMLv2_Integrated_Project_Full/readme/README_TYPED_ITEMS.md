# Typed Item Enforcement

This project now enforces explicit item typing for architecture-relevant data.

## Rule

Avoid untyped item usages such as:

```sysml
item group0Data;
out item InputData;
in item SensorDataEntry;
```

Use typed item usages instead:

```sysml
item group0Data : AdcGroupDataType;
out item InputData : InputDataType;
in item SensorDataEntry : AdcSensorDataEntryType;
```

## Why this matters

Typed item usages make data semantics enforceable by checkers and future CI:

- action inputs/outputs carry explicit payload semantics
- port items expose typed payloads
- component-internal buffers have reusable item definitions
- runtime/dataflow validation can reason about compatible payload types

## Checker

Run:

```bash
python tools/check_typed_items.py
```

or as part of all checks:

```bash
python tools/run_all_checks.py
```

The report is generated at:

```text
reports/typed_items.md
```
