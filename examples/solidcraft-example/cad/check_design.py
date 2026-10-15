#!/usr/bin/env python3
"""Regression check for the Studio Yebisu open-top tray, built in SolidCraft.

Adapted from the solidcraft-checking skill (templates/test_design.py, scripts/run.py). One
solidcraft-cli session runs a command script in order, as edits in the app do. Every
document.inspect in the script is then compared with the independent analytic expectations in
expected.json. Uses the Python standard library only. SOLIDCRAFT_CLI names the CLI (default:
solidcraft-cli).

    python check_design.py --design tray.json --expectations expected.json
    python check_design.py --sequence resize --design tray.json --expectations expected.json
    python check_design.py --sequence build --expectations expected.json

Exit status: 0 every check passed, 1 a check failed, 2 the run or the inputs were unusable.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

CLI = os.environ.get("SOLIDCRAFT_CLI", "solidcraft-cli")
DRIVING = ("width", "depth", "height", "hole_diameter")
STAGE_FEATURES = {
    "block": ["TrayBlock"],
    "pocket": ["TrayBlock", "Pocket"],
    "final": ["TrayBlock", "Pocket", "DrainHole"],
}
# Fixed before the first run (plan.md). Do not widen them after a failure; find the cause.
# SolidCraft measures a tessellation. The template's REL is 2e-4, and the modeling reference
# reports 0.001-0.01 % volume agreement with analytic values.
REL_VOLUME = 2e-4
REL_AREA = 2e-4
# The centre of mass and bbox come out up to about 5e-5 of the part size off; the template allows
# 3 times that. The result is clamped to 1e-3..0.03 mm (0.022-0.026 mm for this tray).
GEOM_PER_SIZE, GEOM_MIN, GEOM_MAX = 1.5e-4, 1e-3, 0.03
# expected.json and analytic() are two separate hand derivations of the same formulas.
CONSISTENCY_ABS, CONSISTENCY_REL = 1e-6, 1e-9
FEATURE_TEXT = 160
LENGTH = re.compile(r"\s*([-+]?\d+(?:\.\d+)?)\s*(?:mm)?\s*")


class InputError(RuntimeError):
    pass


class CliError(RuntimeError):
    pass


def analytic(stage: str, p: dict, wall: float, floor: float) -> dict:
    """Volume, area, COM, bbox and logical face count of the ideal hard-edged tray at one stage."""
    w, d, h, r = p["width"], p["depth"], p["height"], p["hole_diameter"] / 2
    iw, idp, ih = w - 2 * wall, d - 2 * wall, h - floor
    volume = w * d * h
    area = 2 * (w * d + w * h + d * h)
    moment = volume * h / 2
    faces = 6
    if stage in ("pocket", "final"):
        pocket = iw * idp * ih
        volume -= pocket
        moment -= pocket * (floor + ih / 2)
        # The opening taken out of the top face equals the pocket floor added; the 4 inner walls remain
        area += 2 * (iw + idp) * ih
        faces = 11
    if stage == "final":
        hole = math.pi * r * r * floor
        volume -= hole
        moment -= hole * floor / 2
        # Two discs leave the bottom and the pocket floor; the bore is added
        area += 2 * math.pi * r * floor - 2 * math.pi * r * r
        faces = 12
    return {
        "volume_mm3": volume,
        "area_mm2": area,
        "center_of_mass": [0.0, 0.0, moment / volume],
        "bbox_min": [-w / 2, -d / 2, 0.0],
        "bbox_max": [w / 2, d / 2, h],
        "faces": faces,
    }


def area_terms(p: dict, wall: float, floor: float) -> dict:
    """The final tray's area face by face, to cross-check the closed form."""
    w, d, h, r = p["width"], p["depth"], p["height"], p["hole_diameter"] / 2
    iw, idp, ih = w - 2 * wall, d - 2 * wall, h - floor
    disc = math.pi * r * r
    return {
        "bottom": w * d - disc,
        "outer_sides": 2 * (w + d) * h,
        "top_rim": w * d - iw * idp,
        "inner_walls": 2 * (iw + idp) * ih,
        "pocket_floor": iw * idp - disc,
        "hole_bore": 2 * math.pi * r * floor,
    }


def close(written: float, computed: float) -> bool:
    return abs(written - computed) <= max(CONSISTENCY_ABS, CONSISTENCY_REL * abs(computed))


def check_expectations(expectations: dict) -> list[str]:
    """The written expectations must agree with the formulas and lie inside the declared ranges."""
    fixed = expectations["fixed_parameters"]
    wall, floor = fixed["wall"], fixed["floor_thickness"]
    ranges = expectations["ranges"]
    problems = []
    for name, state in expectations["states"].items():
        params, written = state["parameters"], state["expected"]
        for key in DRIVING:
            low, high = ranges[key]
            if not low <= params[key] <= high:
                problems.append(f"{name}: {key}={params[key]} outside {low}..{high}")
        computed = analytic(state["stage"], params, wall, floor)
        for key in ("volume_mm3", "area_mm2"):
            if not close(written[key], computed[key]):
                problems.append(f"{name}.{key}: written {written[key]}, formula {computed[key]:.9f}")
        for key in ("center_of_mass", "bbox_min", "bbox_max"):
            if len(written[key]) != 3 or not all(map(close, written[key], computed[key])):
                problems.append(f"{name}.{key}: written {written[key]}, formula {computed[key]}")
        if written.get("faces") != computed["faces"]:
            problems.append(f"{name}.faces: written {written.get('faces')}, formula {computed['faces']}")
        terms = state.get("area_terms_mm2")
        if terms:
            for key, value in area_terms(params, wall, floor).items():
                if not close(terms[key], value):
                    problems.append(f"{name}.area_terms_mm2.{key}: written {terms[key]}, formula {value:.9f}")
            if not close(sum(terms.values()), written["area_mm2"]):
                problems.append(f"{name}: area terms do not sum to area_mm2")
    return problems


def length(expression) -> float:
    match = LENGTH.fullmatch(str(expression))
    if not match:
        raise InputError(f"not a plain mm length: {expression!r}")
    return float(match.group(1))


def parameter_states(commands: list, start: dict) -> dict[int, dict]:
    """The parameter values the script has set at each of its document.inspect steps."""
    current, states = dict(start), {}
    for index, command in enumerate(commands):
        params = command.get("params") or {}
        if command.get("command") in ("parameters.add", "parameters.change"):
            current[params["name"]] = length(params["expression"])
        elif command.get("command") == "document.inspect":
            states[index] = dict(current)
    return states


def check_plan(commands: list, sequence: dict, expectations: dict) -> list[str]:
    """Every document.inspect has a case, every case sits on one, and the script reaches the
    parameter values the case expects."""
    fixed = expectations["fixed_parameters"]
    start_key = sequence["start_parameters"]
    start = {} if start_key is None else {**expectations[start_key], **fixed}
    states = parameter_states(commands, start)
    indices = [case["inspect_index"] for case in sequence["cases"]]
    problems = []
    if sorted(indices) != sorted(states):
        problems.append(f"document.inspect at steps {sorted(states)}, cases at {sorted(indices)}")
    for case in sequence["cases"]:
        index = case["inspect_index"]
        if index not in states:
            continue
        if (commands[index].get("params") or {}).get("measure") is not True:
            problems.append(f"step {index}: document.inspect without measure: true")
        want = {**expectations["states"][case["state"]]["parameters"], **fixed}
        got = {name: states[index].get(name) for name in want}
        if any(got[name] is None or abs(got[name] - want[name]) > 1e-9 for name in want):
            problems.append(f'{case["label"]}: script sets {got}, expectations say {want}')
    return problems


def run_cli(script: Path, design: Path | None) -> list:
    """Results of every command in the script, from one solidcraft-cli session."""
    args = [CLI, "run", str(script)]
    if design is not None:
        args += ["--in", str(design)]
    args.append("--results")
    try:
        done = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    except OSError as error:
        raise CliError(f"cannot start {CLI}: {error}") from error
    if done.returncode:
        raise CliError(done.stderr.strip().removeprefix("error: ") or f"exit status {done.returncode}")
    try:
        results = json.loads(done.stdout)
    except json.JSONDecodeError as error:
        raise CliError(f"--results output is not JSON: {error}") from error
    if isinstance(results, dict) and isinstance(results.get("results"), list):
        results = results["results"]
    if not isinstance(results, list):
        raise CliError("--results output is not a list of command results")
    return results


def cli_version() -> str | None:
    try:
        done = subprocess.run([CLI, "--version"], capture_output=True, text=True, encoding="utf-8",
                              errors="replace", timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        return None
    lines = done.stdout.strip().splitlines()
    return lines[0] if done.returncode == 0 and lines else None


def geometric_tolerance(expected: dict) -> float:
    size = math.dist(expected["bbox_min"], expected["bbox_max"])
    return max(GEOM_MIN, min(GEOM_MAX, GEOM_PER_SIZE * size))


def body_faces(body: dict) -> int | None:
    """The logical face count, not kernel.faces (modeling reference, "Reading measure")."""
    topology = body.get("topology")
    for value in (body.get("faces"), topology.get("faces") if isinstance(topology, dict) else None):
        if isinstance(value, int) and not isinstance(value, bool):
            return value
    return None


def check_timeline(inspection: dict, stage: str, failures: list) -> None:
    timeline = inspection.get("timeline")
    if not isinstance(timeline, list):
        failures.append("inspect has no timeline list")
        return
    names = [feature.get("name") for feature in timeline]
    if names != STAGE_FEATURES[stage]:
        failures.append(f"timeline {names}, expected {STAGE_FEATURES[stage]}")
    if len(set(names)) != len(names):
        failures.append(f"repeated feature names in {names}")
    for feature in timeline:
        for key in ("error", "warning"):
            if feature.get(key):
                failures.append(f'{feature.get("name")} {key}: {str(feature[key])[:FEATURE_TEXT]}')
        for key in ("suppressed", "rolled_back"):
            if feature.get(key):
                failures.append(f'{feature.get("name")} is {key}')


def check_parameters(inspection: dict, want: dict, failures: list, advisory: list) -> None:
    table = inspection.get("params", inspection.get("parameters"))
    if not isinstance(table, list):
        advisory.append("inspect has no parameter table; parameter values not cross-checked")
        return
    seen = {}
    for row in table:
        if not isinstance(row, dict):
            continue
        if row.get("errors") or row.get("error"):
            failures.append(f'parameter {row.get("name")}: {row.get("errors") or row.get("error")}')
        value = row.get("value")
        if row.get("name") in want and isinstance(value, (int, float)) and not isinstance(value, bool):
            seen[row["name"]] = float(value)
    for name, value in want.items():
        if name not in seen:
            advisory.append(f"parameter {name}: no numeric value in inspect")
        elif abs(seen[name] - value) > 1e-6:
            failures.append(f"parameter {name} = {seen[name]}, expected {value}")


def check_sketches(inspection: dict, failures: list) -> str:
    sketches = inspection.get("sketches") or []
    if not sketches:
        return "no sketches (primitive-only design)"
    loose = [s for s in sketches if s.get("dof") or s.get("status") != "solved"]
    for sketch in loose:
        failures.append(f'sketch {sketch.get("name")}: dof {sketch.get("dof")}, {sketch.get("status")}')
    return f"{len(sketches)} sketch(es) present, {len(loose)} not fully constrained"


def rounded(value):
    if isinstance(value, dict):
        return {key: rounded(v) for key, v in value.items()}
    if isinstance(value, list):
        return [rounded(v) for v in value]
    return round(value, 6) if isinstance(value, float) else value


def check_case(inspection, state: dict, body_name: str, fixed: dict) -> dict:
    failures, advisory = [], []
    expected = state["expected"]
    if not isinstance(inspection, dict):
        return {"ok": False, "failures": ["no document.inspect result at this step"], "advisory": []}
    check_timeline(inspection, state["stage"], failures)
    check_parameters(inspection, {**state["parameters"], **fixed}, failures, advisory)
    sketches = check_sketches(inspection, failures)

    bodies = inspection.get("bodies") or []
    names = [b.get("name") for b in bodies]
    if names != [body_name]:
        failures.append(f"bodies {names}, expected exactly [{body_name!r}]")
    body = next((b for b in bodies if b.get("name") == body_name), None)
    measured, deviation = None, {}
    if body is not None and "volume_mm3" not in body:
        failures.append("body not measured (document.inspect needs measure: true)")
    elif body is not None:
        bbox = body.get("bbox") or {}
        measured = {
            "volume_mm3": body["volume_mm3"],
            "area_mm2": body.get("area_mm2"),
            "center_of_mass": body.get("center_of_mass"),
            "bbox_min": bbox.get("min"),
            "bbox_max": bbox.get("max"),
            "faces": body_faces(body),
        }
        for key, rel in (("volume_mm3", REL_VOLUME), ("area_mm2", REL_AREA)):
            if not isinstance(measured[key], (int, float)):
                failures.append(f"{key} missing")
                continue
            error = abs(measured[key] - expected[key]) / abs(expected[key])
            deviation[f"{key}_rel"] = float(f"{error:.3e}")
            if error > rel:
                failures.append(f"{key} {measured[key]:.6f}, expected {expected[key]:.6f} (rel {error:.2e} > {rel:.0e})")
        tolerance = geometric_tolerance(expected)
        for key in ("center_of_mass", "bbox_min", "bbox_max"):
            if not isinstance(measured[key], list) or len(measured[key]) != 3:
                failures.append(f"{key} missing or not [x, y, z]")
                continue
            worst = max(abs(a - b) for a, b in zip(measured[key], expected[key]))
            deviation[f"{key}_abs_mm"] = float(f"{worst:.3e}")
            if worst > tolerance:
                failures.append(f"{key} {rounded(measured[key])}, expected {expected[key]} (off {worst:.4f} > {tolerance:.4f} mm)")
        if measured["faces"] is None:
            advisory.append("no logical face count in inspect")
        elif measured["faces"] != expected["faces"]:
            advisory.append(f'faces {measured["faces"]}, expected {expected["faces"]} (advisory: bore may count as 2)')
    return {
        "ok": not failures,
        "failures": failures,
        "advisory": advisory,
        "sketches": sketches,
        "measured": rounded(measured),
        "deviation": deviation,
    }


def find_key(value, key: str):
    if isinstance(value, dict):
        if key in value:
            return value[key]
        value = list(value.values())
    if isinstance(value, list):
        for item in value:
            found = find_key(item, key)
            if found is not None:
                return found
    return None


def probe_hole(commands: list, design: Path | None) -> dict:
    """Advisory: read DrainHole's stored base point after the script. The hole is under 1 % of the
    volume, so the COM check misses a hole offset of a few millimetres; the definition does not."""
    probe = [*commands, {"command": "timeline.inspect", "params": {"feature": "DrainHole"}}]
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / "probe.json"
        script.write_text(json.dumps({"commands": probe}), encoding="utf-8")
        try:
            results = run_cli(script, design)
        except CliError as error:
            return {"available": False, "error": str(error)[:300]}
    base = find_key(results[-1] if results else None, "base")
    if not isinstance(base, list) or len(base) != 3:
        return {"available": False, "error": "no 3-component base in timeline.inspect DrainHole"}
    try:
        values = [length(v) for v in base]
    except InputError:
        return {"available": True, "base": base, "on_z_axis": None, "note": "base is not plain numbers"}
    return {"available": True, "base": base, "on_z_axis": values[:2] == [0.0, 0.0], "starts_below_floor": values[2] < 0}


def emit(report: dict) -> None:
    print(json.dumps(report, indent=1))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--design", type=Path, help="saved default design (.json or .solidcraft); needed by walk and resize")
    parser.add_argument("--expectations", type=Path, default=Path(__file__).resolve().parent / "expected.json")
    parser.add_argument("--sequence", choices=("walk", "resize", "build"), default="walk")
    parser.add_argument("--script", type=Path, help="command script (default: the sequence's script next to the expectations)")
    parser.add_argument("--no-probe", action="store_true", help="skip the advisory DrainHole definition probe")
    args = parser.parse_args()

    report = {"checker": "check_design.py", "cli": CLI, "sequence": args.sequence, "ok": False}
    try:
        expectations = json.loads(args.expectations.read_text(encoding="utf-8"))
        sequence = expectations["sequences"][args.sequence]
        script = args.script or args.expectations.resolve().parent / sequence["script"]
        commands = json.loads(script.read_text(encoding="utf-8"))["commands"]
        design = None
        if sequence["needs_design"]:
            if args.design is None or not args.design.is_file():
                raise InputError(f"the {args.sequence} sequence needs --design <saved default design>")
            design = args.design
        elif args.design is not None:
            raise InputError("the build sequence starts from an empty session; leave out --design")
        problems = check_expectations(expectations) + check_plan(commands, sequence, expectations)
        if problems:
            raise InputError("; ".join(problems))
    except (OSError, KeyError, TypeError, ValueError, InputError) as error:
        report["input_error"] = f"{type(error).__name__}: {error}"
        emit(report)
        return 2

    report.update({
        "cli_version": cli_version(),
        "script": script.name,
        "design": design.name if design else None,
        "scope": sequence["scope"],
        "tolerances": {"volume_rel": REL_VOLUME, "area_rel": REL_AREA,
                       "geometric_abs_mm": f"max({GEOM_MIN}, min({GEOM_MAX}, {GEOM_PER_SIZE} * bbox diagonal))"},
    })
    try:
        results = run_cli(script, design)
    except CliError as error:
        report["run_error"] = str(error)
        emit(report)
        return 2
    if len(results) < len(commands):
        report["run_error"] = f"{len(results)} results for {len(commands)} commands"
        emit(report)
        return 2

    fixed = expectations["fixed_parameters"]
    cases = []
    for case in sequence["cases"]:
        index = case["inspect_index"]
        outcome = check_case(results[index], expectations["states"][case["state"]], expectations["body"], fixed)
        cases.append({"label": case["label"], "step": index, "state": case["state"], **outcome})
    report["cases"] = cases
    report["summary"] = {"cases": len(cases), "passed": sum(c["ok"] for c in cases)}
    report["probe"] = None if args.no_probe else probe_hole(commands, design)
    report["ok"] = all(c["ok"] for c in cases)
    emit(report)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
