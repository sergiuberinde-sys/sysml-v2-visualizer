# Model-assisted SW FMEA support

This project intentionally does **not** keep an AcpdCdd-specific FMEA catalogue as source input.

That would be circular: the generated FMEA would already be pre-authored in the source catalogue.

Instead, the source input is generic:

- `contracts/` — generic failure guidewords only
- `tools/generate_sw_fmea.py` — generates an engineer-review prompt table

Generated outputs are user-action artifacts and are not stored in the source-only zip:

- `reports/fmea_support_model.json`
- `reports/fmea_support_matrix.md`
- `reports/acpdcdd_sw_fmea.md`
- `reports/acpdcdd_sw_fmea.csv`

## Correct logic

```text
SysML v2 architecture + TRLC requirements
+ generic guidewords
→ generated FMEA review prompts
→ engineer confirms real failure modes/effects/ratings/actions
```

## Incorrect logic avoided

```text
module-specific FMEA catalogue
→ generated FMEA
```

The old approach was removed because it made the FMEA content appear to be generated even though the important failure modes had already been manually authored.

## What the generator can honestly provide

- candidate architectural behavior elements for FMEA consideration
- candidate failure prompts based on generic guidewords
- affected SysML locations
- linked TRLC requirements
- ASIL context
- interaction participants
- engineer-owned fields left blank

## What it does not infer

- final failure mode validity
- local/system effect correctness
- severity
- occurrence
- detection rating
- diagnostic coverage
- residual risk
- recommended actions

Those remain engineering responsibilities.
