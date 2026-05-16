import csv
import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SUPPORT_JSON = PROJECT_ROOT / "reports" / "fmea_support_model.json"
REPORT_MD = PROJECT_ROOT / "reports" / "acpdcdd_sw_fmea.md"
REPORT_CSV = PROJECT_ROOT / "reports" / "acpdcdd_sw_fmea.csv"
EXTRACTOR = PROJECT_ROOT / "tools" / "extract_fmea_support.py"


def ensure_support_model() -> int:
    result = subprocess.run([sys.executable, str(EXTRACTOR)], cwd=PROJECT_ROOT)
    return result.returncode


def write_reports(model: dict) -> None:
    rows = model.get("fmea_support_prompt_rows", [])
    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)

    headers = [
        "Prompt ID", "Component", "Architecture element", "Element kind", "Guideword",
        "Candidate failure prompt", "Candidate effect prompt", "Review focus", "ASIL",
        "Derived requirements", "Interaction context", "Element locations", "Engineer-owned fields"
    ]
    with REPORT_CSV.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for r in rows:
            writer.writerow({
                "Prompt ID": r.get("prompt_id", ""),
                "Component": r.get("component", ""),
                "Architecture element": r.get("architecture_element", ""),
                "Element kind": r.get("element_kind", ""),
                "Guideword": r.get("guideword", ""),
                "Candidate failure prompt": r.get("candidate_failure_prompt", ""),
                "Candidate effect prompt": r.get("candidate_effect_prompt", ""),
                "Review focus": r.get("review_focus", ""),
                "ASIL": r.get("highest_asil", "QM"),
                "Derived requirements": ", ".join(r.get("derived_traces", [])) or "-",
                "Interaction context": "; ".join(
                    (["participants=" + ",".join(r.get("connected_participants", []))] if r.get("connected_participants") else [])
                    + (["incoming=" + " / ".join(r.get("incoming_messages", []))] if r.get("incoming_messages") else [])
                    + (["outgoing=" + " / ".join(r.get("outgoing_messages", []))] if r.get("outgoing_messages") else [])
                ) or "-",
                "Element locations": "; ".join(r.get("sysml_locations", [])) or "-",
                "Engineer-owned fields": json.dumps(r.get("engineer_owned_fields", []), ensure_ascii=False),
            })

    lines = []
    lines.append("# AcpdCdd Model-Assisted SW FMEA Prompt Table")
    lines.append("")
    lines.append("This is not a completed FMEA. It is a generated prompt table that combines SysML v2 architectural behavior elements, TRLC traces, ASIL context, interactions, and a generic failure guideword catalogue.")
    lines.append("")
    lines.append("The source catalogue is intentionally generic and non-module-specific. AcpdCdd-specific failure modes are outputs for engineer review, not pre-authored inputs. Rows are scoped to concrete actions, interaction messages, and event occurrences; type declarations and data definitions are context only.")
    lines.append("")
    lines.append("Engineer-owned fields such as confirmed failure mode, local effect, system effect, severity, occurrence, detection rating, diagnostic coverage, residual risk, final judgement, and recommended actions are intentionally not inferred by the generator.")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Source catalogue: `{model.get('source_catalogue', 'unknown')}`")
    lines.append(f"- Generated prompt rows: {len(rows)}")
    lines.append(f"- CSV export: `{REPORT_CSV.relative_to(PROJECT_ROOT)}`")
    lines.append("")
    lines.append("## Generated FMEA review prompts")
    lines.append("")
    lines.append("| Prompt ID | Component | Architecture element | Kind | Guideword | Failure prompt | Effect prompt | Review focus | Interaction context | ASIL | Reqs |")
    lines.append("|---|---|---|---|---|---|---|---|---|---:|---|")
    for r in rows:
        context_bits = []
        if r.get("connected_participants"):
            context_bits.append("participants: " + ", ".join(r.get("connected_participants", [])))
        if r.get("incoming_messages"):
            context_bits.append("incoming: " + "; ".join(r.get("incoming_messages", [])))
        if r.get("outgoing_messages"):
            context_bits.append("outgoing: " + "; ".join(r.get("outgoing_messages", [])))
        interaction_context = "<br>".join(context_bits).replace("|", "/") or "-"
        lines.append("| {pid} | {comp} | `{elem}` | {kind} | {gw} | {fail} | {eff} | {focus} | {ctx} | {asil} | {reqs} |".format(
            pid=r.get("prompt_id", "-"),
            comp=r.get("component", "-"),
            elem=r.get("architecture_element", "-"),
            kind=r.get("element_kind", "-"),
            gw=str(r.get("guideword", "-")).replace("|", "/"),
            fail=str(r.get("candidate_failure_prompt", "-")).replace("|", "/"),
            eff=str(r.get("candidate_effect_prompt", "-")).replace("|", "/"),
            focus=str(r.get("review_focus", "-")).replace("|", "/"),
            ctx=interaction_context,
            asil=r.get("highest_asil", "QM"),
            reqs=", ".join(r.get("derived_traces", [])) or "-",
        ))
    lines.append("")
    lines.append("## Process note")
    lines.append("")
    lines.append("This table is meant to start the FMEA discussion, not close it. The next modelling improvement is explicit produced/consumed data and protection/propagation semantics, which would allow stronger impact and coverage analysis.")
    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    if ensure_support_model() != 0:
        print("Model-assisted SW FMEA prompt generation: FAIL - support extraction failed")
        return 1
    if not SUPPORT_JSON.exists():
        print(f"Model-assisted SW FMEA prompt generation: FAIL - missing {SUPPORT_JSON.relative_to(PROJECT_ROOT)}")
        return 1
    model = json.loads(SUPPORT_JSON.read_text(encoding="utf-8"))
    write_reports(model)
    print("Model-assisted SW FMEA prompt generation: PASS")
    print(f"Report written to {REPORT_MD.relative_to(PROJECT_ROOT)}")
    print(f"CSV written to {REPORT_CSV.relative_to(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
