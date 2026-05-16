#!/usr/bin/env python3
"""
Official SysML v2 / KerML validation wrapper.

Purpose
-------
Run the project SysML files through an official SysML v2/KerML implementation
instead of re-implementing language rules locally.

This script is intentionally limited to official language validity:
  - parsing
  - KerML/SysML metamodel well-formedness
  - official semantic validation constraints exposed by the chosen tool

It deliberately does NOT check AcpdCdd project-governance rules such as ASIL
coverage, trace comment hygiene, mandatory typed-port conventions, or safety-gap
coverage. Keep those in the project-specific checkers.

Usage examples
--------------
1) With a command template:

   python tools/validate_official_sysml.py \
     --cmd 'java -jar /path/to/org.omg.sysml.interactive.jar {file}'

2) With a stdin-based interactive jar:

   python tools/validate_official_sysml.py \
     --jar /path/to/org.omg.sysml.interactive.jar \
     --stdin

3) From CI using an environment variable:

   export SYSML_VALIDATE_CMD='java -jar /opt/sysml/org.omg.sysml.interactive.jar {file}'
   python tools/validate_official_sysml.py

Exit codes
----------
0 = official validation completed and no diagnostics classified as errors
1 = official validation completed and at least one file failed
2 = no official validator command/jar was configured or executable
"""

from __future__ import annotations

import argparse
import datetime as _dt
import os
import shlex
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_REPORT = PROJECT_ROOT / "reports" / "official_sysml_validation_report.md"

# Generated/source-support folders that should not be traversed for model files.
SKIP_DIR_NAMES = {
    ".git",
    "__pycache__",
    "reports",
    "readme",
    "docs",
    "contracts",
    "requirements",
    "tools",
    "rules",
}

ERROR_MARKERS = (
    "error",
    "exception",
    "parse failed",
    "validation failed",
    "diagnostic severity=error",
    "severity: error",
    "[error]",
)

WARNING_MARKERS = (
    "warning",
    "warn",
    "diagnostic severity=warning",
    "severity: warning",
    "[warning]",
)


@dataclass(frozen=True)
class ValidationResult:
    file: Path
    returncode: int
    stdout: str
    stderr: str

    @property
    def combined_output(self) -> str:
        return (self.stdout + "\n" + self.stderr).strip()

    @property
    def has_error(self) -> bool:
        text = self.combined_output.lower()
        return self.returncode != 0 or any(marker in text for marker in ERROR_MARKERS)

    @property
    def has_warning(self) -> bool:
        text = self.combined_output.lower()
        return any(marker in text for marker in WARNING_MARKERS)


def discover_sysml_files(root: Path) -> List[Path]:
    files: List[Path] = []
    for path in root.rglob("*.sysml"):
        rel_parts = path.relative_to(root).parts
        if any(part in SKIP_DIR_NAMES for part in rel_parts[:-1]):
            continue
        files.append(path)
    return sorted(files, key=lambda p: str(p.relative_to(root)))


def build_command(args: argparse.Namespace, file: Path) -> Optional[Sequence[str]]:
    cmd_template = args.cmd or os.environ.get("SYSML_VALIDATE_CMD")
    if cmd_template:
        # Use shlex so quoted arguments in the command template are preserved.
        # {file} and {project_root} are the only supported placeholders.
        rendered = cmd_template.format(
            file=str(file),
            project_root=str(PROJECT_ROOT),
        )
        return shlex.split(rendered)

    jar = args.jar or os.environ.get("SYSML_INTERACTIVE_JAR") or os.environ.get("SYSML_VALIDATOR_JAR")
    if jar:
        return ["java", "-jar", str(jar)] + ([] if args.stdin else [str(file)])

    return None


def run_validation(command: Sequence[str], file: Path, *, use_stdin: bool, timeout_s: int) -> ValidationResult:
    source = file.read_text(encoding="utf-8") if use_stdin else None
    completed = subprocess.run(
        list(command),
        input=source,
        text=True,
        capture_output=True,
        timeout=timeout_s,
        cwd=PROJECT_ROOT,
    )
    return ValidationResult(
        file=file,
        returncode=completed.returncode,
        stdout=completed.stdout,
        stderr=completed.stderr,
    )


def write_report(results: Iterable[ValidationResult], report_path: Path, command_description: str) -> None:
    results = list(results)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    errors = [r for r in results if r.has_error]
    warnings = [r for r in results if (not r.has_error and r.has_warning)]

    lines: List[str] = []
    lines.append("# Official SysML v2 / KerML Validation Report")
    lines.append("")
    lines.append(f"Generated: {_dt.datetime.now().isoformat(timespec='seconds')}")
    lines.append(f"Project root: `{PROJECT_ROOT}`")
    lines.append(f"Validator command: `{command_description}`")
    lines.append("")
    lines.append("## Scope")
    lines.append("")
    lines.append("This report is produced by `tools/validate_official_sysml.py`.")
    lines.append("It is limited to official SysML v2/KerML parsing and semantic validation as implemented by the configured official toolchain.")
    lines.append("It does not include AcpdCdd-specific governance, traceability, runtime-contract, ASIL, or safety-analysis rules.")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"Files checked: {len(results)}")
    lines.append(f"Files with errors: {len(errors)}")
    lines.append(f"Files with warnings only: {len(warnings)}")
    lines.append("")

    for result in results:
        rel = result.file.relative_to(PROJECT_ROOT)
        status = "FAIL" if result.has_error else ("WARN" if result.has_warning else "PASS")
        lines.append(f"## {status}: `{rel}`")
        lines.append("")
        lines.append(f"Return code: `{result.returncode}`")
        output = result.combined_output
        if output:
            lines.append("")
            lines.append("```text")
            # Keep reports readable while preserving the first useful diagnostics.
            max_chars = 12000
            lines.append(output[:max_chars] + ("\n... output truncated ..." if len(output) > max_chars else ""))
            lines.append("```")
        else:
            lines.append("")
            lines.append("No diagnostics emitted by validator.")
        lines.append("")

    report_path.write_text("\n".join(lines), encoding="utf-8")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run official SysML v2/KerML validation through a configured official toolchain."
    )
    parser.add_argument(
        "--cmd",
        help="Validator command template. Supports {file} and {project_root}. Overrides environment variables.",
    )
    parser.add_argument(
        "--jar",
        help="Path to official SysML v2 interactive/validator jar. Can also be set with SYSML_INTERACTIVE_JAR.",
    )
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="Feed each .sysml file to the validator via stdin instead of passing the file path as an argument.",
    )
    parser.add_argument(
        "--file",
        action="append",
        dest="files",
        help="Specific .sysml file to validate. May be repeated. Default: all project .sysml files.",
    )
    parser.add_argument(
        "--report",
        default=str(DEFAULT_REPORT),
        help=f"Markdown report path. Default: {DEFAULT_REPORT}",
    )
    parser.add_argument(
        "--timeout-s",
        type=int,
        default=60,
        help="Timeout per file in seconds. Default: 60.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)

    if args.files:
        files = [Path(f).resolve() if Path(f).is_absolute() else (PROJECT_ROOT / f).resolve() for f in args.files]
    else:
        files = discover_sysml_files(PROJECT_ROOT)

    if not files:
        print("No .sysml files found to validate.")
        return 0

    first_command = build_command(args, files[0])
    if not first_command:
        print(
            "No official SysML validator configured. Set SYSML_VALIDATE_CMD, "
            "SYSML_INTERACTIVE_JAR, or pass --cmd/--jar.",
            file=sys.stderr,
        )
        print(
            "Example: python tools/validate_official_sysml.py "
            "--cmd 'java -jar /path/to/org.omg.sysml.interactive.jar {file}'",
            file=sys.stderr,
        )
        return 2

    results: List[ValidationResult] = []
    for file in files:
        command = build_command(args, file)
        assert command is not None
        rel = file.relative_to(PROJECT_ROOT)
        print(f"Validating {rel} ...")
        try:
            result = run_validation(command, file, use_stdin=args.stdin, timeout_s=args.timeout_s)
        except FileNotFoundError as exc:
            print(f"Validator executable not found: {exc}", file=sys.stderr)
            return 2
        except subprocess.TimeoutExpired:
            result = ValidationResult(
                file=file,
                returncode=124,
                stdout="",
                stderr=f"Validation timed out after {args.timeout_s} seconds.",
            )
        results.append(result)

    report_path = Path(args.report)
    if not report_path.is_absolute():
        report_path = PROJECT_ROOT / report_path
    command_description = " ".join(shlex.quote(part) for part in first_command)
    write_report(results, report_path, command_description)

    errors = [r for r in results if r.has_error]
    warnings = [r for r in results if (not r.has_error and r.has_warning)]

    print("\n=== Official SysML/KerML validation summary ===")
    print(f"Files checked: {len(results)}")
    print(f"Files with errors: {len(errors)}")
    print(f"Files with warnings only: {len(warnings)}")
    print(f"Report: {report_path}")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
