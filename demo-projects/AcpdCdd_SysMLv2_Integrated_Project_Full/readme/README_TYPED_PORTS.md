# Typed Ports

The project now uses explicit `port def` declarations and typed port usages.

## Pattern

A port definition defines reusable interface semantics:

```sysml
port def AdcGroup0InPort {
    in item SensorDataEntry;
}
```

A component port uses that definition:

```sysml
port adcGroup0In : AdcGroup0InPort;
```

## Why this matters

This makes the model stronger than name-only ports.

The checker verifies:

- ports are typed
- used port definitions exist
- dataflow endpoints refer to declared ports

## Checker

Run:

```bash
python tools/check_typed_ports.py
```

or:

```bash
python tools/run_all_checks.py
```
