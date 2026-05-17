# Official SysML v2 / KerML Validation

This project separates two kinds of validation:

1. **Official language validation**
   - SysML v2 textual parsing
   - KerML/SysML well-formedness
   - official semantic constraints exposed by the configured official toolchain

2. **Project/domain validation**
   - AcpdCdd architecture governance
   - traceability comment hygiene
   - runtime interaction contracts
   - ASIL/safety coverage
   - safety-gap and mitigation reasoning

The official-only wrapper is:

```bash
python tools/validate_official_sysml.py
```

It intentionally does **not** reimplement the SysML/KerML specification rules. Instead, it calls an official SysML v2 toolchain and normalizes the result into:

```text
reports/official_sysml_validation_report.md
```

## Configure the official validator

Use one of the following options.

### Option A: command template

```bash
python tools/validate_official_sysml.py \
  --cmd 'java -jar /path/to/org.omg.sysml.interactive.jar {file}'
```

The command template supports:

```text
{file}
{project_root}
```

### Option B: stdin-based interactive jar

```bash
python tools/validate_official_sysml.py \
  --jar /path/to/org.omg.sysml.interactive.jar \
  --stdin
```

### Option C: environment variable for CI

```bash
export SYSML_VALIDATE_CMD='java -jar /opt/sysml/org.omg.sysml.interactive.jar {file}'
python tools/validate_official_sysml.py
```

or:

```bash
export SYSML_INTERACTIVE_JAR='/opt/sysml/org.omg.sysml.interactive.jar'
python tools/validate_official_sysml.py --stdin
```

## Important boundary

This wrapper checks only what the configured official SysML/KerML validator can check.

It does not check project rules such as:

- all AcpdCdd runtime interactions must use typed ports
- all ASIL-relevant outputs must have monitoring or mitigation coverage
- all `// trlc-satisfies:` comments must reference real TRLC IDs
- all safety gaps must be explicitly represented

Those remain in the project-specific tools.

## Recommended CI split

Run official language validation separately from project governance validation:

```bash
python tools/validate_official_sysml.py
python tools/run_all_checks.py
```

This keeps the distinction clear:

```text
Official validator = SysML/KerML language correctness
Project checkers   = AcpdCdd engineering governance
```
