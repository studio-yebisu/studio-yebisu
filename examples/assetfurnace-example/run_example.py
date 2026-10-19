#!/usr/bin/env python3
"""Pack one CC0 crate with Blender, then run AssetFurnace's original texture compressor on it.

    python run_example.py --upstream PATH --blender PATH --out runs/NAME

Run from this folder with Python 3.11 and Pillow 11.3.0. In order:

1. Checks the upstream files this example uses (fixed commit) and the five input files.
2. Runs `prepare_input.py` in Blender exactly once: glTF + .bin + textures -> one GLB.
3. Runs the unchanged `scripts/compress_glb_textures.py` CLI exactly once per job, every
   time from that same packed GLB.
4. Reads every GLB back with its own parser (never the original `compress()`), and asserts
   that everything except the image bytes is identical to the packed input.

`--out` must be a new or empty folder inside this example, so every recorded path is
relative. Full stdout/stderr and the absolute invocations go to `--out/private/`; the public
`results.json` holds relative artifact paths, sizes, hashes and measured facts only. A
failure is recorded as a failure: nothing is retried, filled in or marked as passed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import os
import platform
import re
import struct
import subprocess
import sys
import time
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CLI_SCRIPT = "scripts/compress_glb_textures.py"
PREPARE_SCRIPT = "prepare_input.py"
PACKED_NAME = "input/packed_input.glb"
PREPARATION_NAME = "preparation.json"
RESULTS_NAME = "results.json"

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
# Slots the shader reads as numbers. A normal map is one of them, not a separate category.
DATA_SLOTS = frozenset({"metallicRoughnessTexture", "normalTexture", "occlusionTexture"})
FORMAT_MIME = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
GEOMETRY_KEYS = ("scene", "scenes", "nodes", "meshes", "accessors", "skins", "animations")
MATERIAL_KEYS = ("materials", "textures", "samplers")
THREAD_VARS = ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
               "NUMEXPR_NUM_THREADS", "VECLIB_MAXIMUM_THREADS", "BLIS_NUM_THREADS")
EXPECTED_CALLS = {"environment_probe": 1, "blender_prepare": 1, "original_compress_cli": 3}
PROBE = "import sys, PIL; print(sys.version.split()[0]); print(PIL.__version__)"
BLENDER_TIMEOUT = 900
CLI_TIMEOUT = 600
# Source glTF vs Blender's GLB: positions round-trip through float32 and an axis swap.
TOLERANCE = 1e-5

BOUNDARIES = [
    "AssetFurnaceの画像→3D生成・pipeline.py・Finish（リトポロジー、Pixel Match、ベイク）・リギング・ComfyUIは実行していない。モデルの重みは取得も読み込みもしていない。",
    "入力はPoly HavenのCC0既存3Dモデル（James Ray Cock作）で、AI生成メッシュではない。BlenderでのGLB化は入力準備であり、AssetFurnaceの処理ではない。",
    "圧縮はAssetFurnace原本のscripts/compress_glb_textures.pyを無改変のまま、同じGLBから設定違いで3回実行したもの。",
    "画像以外の全bufferViewとメッシュ・アクセサ・ノード・シーン・マテリアル構造のバイト一致は、見た目の同等性・ゲームでの適性・表示性能を示さない。見た目は別途目視で確認する。",
    "PNG指定でも縮小すれば画素は変わる。視覚的に無劣化とは言わない。原本は再エンコード結果が小さいときだけ画像を置き換えるので、要求形式と実際の形式は違いうる。",
    "このresults.jsonは実行ラッパーが測った値の射影で、モデル出力でも原本のネイティブJSON APIでもない。原本CLIの出力はテキストとGLBのみで、その標準出力は非公開ログに別保存している。",
    "経過時間はインタプリタ起動を含むこのマシンでの壁時計時間で、性能指標ではない。",
]


class Failure(Exception):
    def __init__(self, stage: str, message: str):
        super().__init__(message)
        self.stage = stage


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def canonical_sha(value) -> str:
    text = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return sha256(text.encode("utf-8"))


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def write_json(path: Path, value, exclusive: bool) -> None:
    with open(path, "x" if exclusive else "w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


# ---------------------------------------------------------------- GLB reading (independent)

def read_glb(data: bytes) -> tuple[dict, bytes, list[dict]]:
    """Split a GLB 2.0 container, rejecting anything the spec does not allow."""
    if len(data) < 12 or data[:4] != b"glTF":
        raise ValueError("not a GLB (no glTF magic)")
    version, declared = struct.unpack_from("<II", data, 4)
    if version != 2:
        raise ValueError(f"GLB container version {version}, expected 2")
    if declared != len(data):
        raise ValueError(f"GLB header length {declared} != file length {len(data)}")
    chunks, offset = [], 12
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError("truncated chunk header")
        length, kind = struct.unpack_from("<II", data, offset)
        end = offset + 8 + length
        if end > len(data):
            raise ValueError("chunk runs past the end of the file")
        if length % 4:
            raise ValueError("chunk length is not 4-byte aligned")
        chunks.append((kind, data[offset + 8:end]))
        offset = end
    if not chunks or chunks[0][0] != JSON_CHUNK:
        raise ValueError("first chunk is not JSON")
    document = json.loads(chunks[0][1].decode("utf-8"))
    binary = chunks[1][1] if len(chunks) > 1 and chunks[1][0] == BIN_CHUNK else b""
    layout = [{"type": {JSON_CHUNK: "JSON", BIN_CHUNK: "BIN"}.get(kind, f"0x{kind:08X}"),
               "bytes": len(chunk)} for kind, chunk in chunks]
    return document, binary, layout


def view_payload(document: dict, binary: bytes, index: int) -> bytes:
    view = document["bufferViews"][index]
    if view.get("buffer", 0) != 0:
        raise ValueError(f"bufferView {index} is outside the GLB binary chunk")
    if "uri" in (document.get("buffers") or [{}])[0]:
        raise ValueError("buffer 0 points at an external file")
    start = view.get("byteOffset", 0)
    end = start + view["byteLength"]
    if end > len(binary):
        raise ValueError(f"bufferView {index} runs past the binary chunk")
    return binary[start:end]


def image_views(document: dict) -> set[int]:
    return {image["bufferView"] for image in document.get("images", []) if "bufferView" in image}


def image_bindings(document: dict) -> dict[int, set[str]]:
    """Image index -> material slots it feeds, read from the material texture bindings."""
    textures = document.get("textures", [])
    found: dict[int, set[str]] = {}

    def note(slot: str, ref) -> None:
        if not isinstance(ref, dict) or "index" not in ref:
            return
        texture = textures[ref["index"]]
        webp = texture.get("extensions", {}).get("EXT_texture_webp", {}).get("source")
        for source in {texture.get("source"), webp} - {None}:
            found.setdefault(source, set()).add(slot)

    for material in document.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        note("baseColorTexture", pbr.get("baseColorTexture"))
        note("metallicRoughnessTexture", pbr.get("metallicRoughnessTexture"))
        for slot in ("normalTexture", "occlusionTexture", "emissiveTexture"):
            note(slot, material.get(slot))
    return found


def role_of(slots: set[str]) -> str:
    if not slots:
        return "unbound"
    data = slots & DATA_SLOTS
    if not data:
        return "colour"
    return "data" if data == slots else "mixed"


def requested_cap(slots: set[str], job: dict) -> int:
    """The cap the CLI applies to this image, per its documented colour/data/normal split."""
    if "normalTexture" in slots:
        return job["normal_size"]
    return job["map_size"] if slots & DATA_SLOTS else job["max_size"]


def magic_format(blob: bytes) -> str | None:
    if blob[:3] == b"\xff\xd8\xff":
        return "JPEG"
    if blob[:8] == b"\x89PNG\r\n\x1a\n":
        return "PNG"
    if blob[:4] == b"RIFF" and blob[8:12] == b"WEBP":
        return "WEBP"
    return None


def merge_bounds(bounds: dict | None, accessor: dict) -> dict | None:
    if "min" not in accessor or "max" not in accessor:
        return bounds
    if bounds is None:
        return {"min": list(accessor["min"]), "max": list(accessor["max"])}
    return {"min": [min(a, b) for a, b in zip(bounds["min"], accessor["min"])],
            "max": [max(a, b) for a, b in zip(bounds["max"], accessor["max"])]}


def effective_trs(node: dict) -> dict:
    if "matrix" in node:
        return {"matrix": node["matrix"]}
    return {"translation": node.get("translation", [0.0, 0.0, 0.0]),
            "rotation": node.get("rotation", [0.0, 0.0, 0.0, 1.0]),
            "scale": node.get("scale", [1.0, 1.0, 1.0])}


def geometry_stats(document: dict) -> dict:
    accessors = document.get("accessors", [])
    meshes, triangles, vertices, indices, other_modes = [], 0, 0, 0, 0
    for mesh_index, mesh in enumerate(document.get("meshes", [])):
        mesh_triangles = mesh_vertices = 0
        bounds = None
        for primitive in mesh.get("primitives", []):
            mode = primitive.get("mode", 4)
            position = accessors[primitive["attributes"]["POSITION"]]
            count = accessors[primitive["indices"]]["count"] if "indices" in primitive \
                else position["count"]
            if mode == 4:
                mesh_triangles += count // 3
            elif mode in (5, 6):
                mesh_triangles += max(0, count - 2)
            else:
                other_modes += 1
            if "indices" in primitive:
                indices += count
            mesh_vertices += position["count"]
            bounds = merge_bounds(bounds, position)
        meshes.append({"index": mesh_index, "name": mesh.get("name"),
                       "primitives": len(mesh.get("primitives", [])),
                       "triangles": mesh_triangles, "position_vertices": mesh_vertices,
                       "local_bounds": bounds})
        triangles += mesh_triangles
        vertices += mesh_vertices
    nodes = [{"index": index, "name": node.get("name"), "mesh": node.get("mesh"),
              "children": node.get("children", []), **effective_trs(node)}
             for index, node in enumerate(document.get("nodes", []))]
    return {"triangles": triangles, "position_vertices": vertices, "index_count": indices,
            "non_triangle_primitives": other_modes, "meshes": meshes, "nodes": nodes}


def node_bounds(document: dict) -> dict[str, dict]:
    """Mesh node name -> local POSITION bounds and transform, for source-vs-packed checks."""
    accessors = document.get("accessors", [])
    found = {}
    for node in document.get("nodes", []):
        if "mesh" not in node:
            continue
        bounds = None
        for primitive in document["meshes"][node["mesh"]].get("primitives", []):
            bounds = merge_bounds(bounds, accessors[primitive["attributes"]["POSITION"]])
        found[node.get("name")] = {"bounds": bounds, "trs": effective_trs(node)}
    return found


def max_abs_diff(a, b) -> float:
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(float(a) - float(b))
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        return max((max_abs_diff(x, y) for x, y in zip(a, b)), default=0.0)
    if isinstance(a, dict) and isinstance(b, dict) and a.keys() == b.keys():
        return max((max_abs_diff(a[k], b[k]) for k in a), default=0.0)
    return 0.0 if a is None and b is None else float("inf")


def inspect_image(index: int, image: dict, document: dict, binary: bytes,
                  bindings: dict[int, set[str]], image_module) -> dict:
    slots = bindings.get(index, set())
    entry = {"index": index, "name": image.get("name"), "declared_mime": image.get("mimeType"),
             "slots": sorted(slots), "role": role_of(slots), "normal": "normalTexture" in slots}
    if "bufferView" not in image:
        entry["embedded"] = False
        return entry
    blob = view_payload(document, binary, image["bufferView"])
    entry.update(embedded=True, buffer_view=image["bufferView"], bytes=len(blob),
                 sha256=sha256(blob), magic=magic_format(blob))
    try:
        with image_module.open(io.BytesIO(blob)) as opened:
            opened.load()
            entry["decoded"] = {"format": opened.format, "mode": opened.mode,
                                "width": opened.size[0], "height": opened.size[1]}
    except Exception as exc:  # a broken image is a measured fact, not a crash
        entry["decoded"] = None
        entry["decode_error"] = type(exc).__name__
    decoded = entry["decoded"]
    entry["mime_matches_decoded"] = bool(decoded) and \
        FORMAT_MIME.get(decoded["format"]) == entry["declared_mime"] == FORMAT_MIME.get(entry["magic"])
    return entry


def inspect_glb(data: bytes, image_module) -> tuple[dict, dict, bytes]:
    document, binary, layout = read_glb(data)
    views = document.get("bufferViews", [])
    images_at = image_views(document)
    bindings = image_bindings(document)
    payloads = {i: view_payload(document, binary, i) for i in range(len(views))}
    other = [{"index": i, "bytes": len(payloads[i]), "sha256": sha256(payloads[i])}
             for i in range(len(views)) if i not in images_at]
    images = [inspect_image(i, image, document, binary, bindings, image_module)
              for i, image in enumerate(document.get("images", []))]
    roles = [image["role"] for image in images]
    info = {
        "bytes": len(data),
        "sha256": sha256(data),
        "chunks": layout,
        "generator": document.get("asset", {}).get("generator"),
        "extensions_used": document.get("extensionsUsed", []),
        "extensions_required": document.get("extensionsRequired", []),
        "counts": {
            "scenes": len(document.get("scenes", [])),
            "nodes": len(document.get("nodes", [])),
            "mesh_nodes": sum(1 for node in document.get("nodes", []) if "mesh" in node),
            "meshes": len(document.get("meshes", [])),
            "primitives": sum(len(m.get("primitives", [])) for m in document.get("meshes", [])),
            "materials": len(document.get("materials", [])),
            "textures": len(document.get("textures", [])),
            "images": len(images),
            "accessors": len(document.get("accessors", [])),
            "buffer_views": len(views),
            "buffers": len(document.get("buffers", [])),
        },
        "image_roles": {"colour": roles.count("colour"), "data": roles.count("data"),
                        "normal_within_data": sum(1 for i in images if i["normal"]),
                        "mixed": roles.count("mixed"), "unbound": roles.count("unbound")},
        "geometry": geometry_stats(document),
        "geometry_json_sha256": canonical_sha({k: document.get(k) for k in GEOMETRY_KEYS}),
        "material_json_sha256": canonical_sha({k: document.get(k) for k in MATERIAL_KEYS}),
        "non_image_buffer_views": other,
        "non_image_payload_bytes": sum(view["bytes"] for view in other),
        "image_payload_bytes": sum(image.get("bytes", 0) for image in images),
        "images": images,
    }
    return info, document, binary


def compare_to_packed(packed: dict, packed_bin: bytes, output: dict, output_bin: bytes) -> list:
    """Everything but the image bytes (and the offsets they move) must equal the packed input."""
    results = []
    special = {"images", "bufferViews", "buffers"}
    differing = sorted(k for k in (set(packed) | set(output)) - special
                       if packed.get(k) != output.get(k))
    results.append(("json_outside_images_and_buffers_equal", not differing, differing or None))

    before, after = packed.get("images", []), output.get("images", [])
    strip = lambda image: {k: v for k, v in image.items() if k != "mimeType"}
    image_diffs = ["count"] if len(before) != len(after) else \
        [i for i, (a, b) in enumerate(zip(before, after)) if strip(a) != strip(b)]
    results.append(("image_entries_equal_except_mime", not image_diffs, image_diffs or None))

    views_before, views_after = packed.get("bufferViews", []), output.get("bufferViews", [])
    images_at = image_views(packed)
    layout_diffs, payload_diffs = [], []
    if len(views_before) != len(views_after):
        layout_diffs.append("count")
    else:
        for i, (a, b) in enumerate(zip(views_before, views_after)):
            moved = {"byteOffset"} | ({"byteLength"} if i in images_at else set())
            if {k: v for k, v in a.items() if k not in moved} != \
                    {k: v for k, v in b.items() if k not in moved}:
                layout_diffs.append(i)
            if i not in images_at and \
                    view_payload(packed, packed_bin, i) != view_payload(output, output_bin, i):
                payload_diffs.append(i)
    results.append(("buffer_view_layout_equal", not layout_diffs, layout_diffs or None))
    results.append(("every_non_image_payload_byte_equal", not payload_diffs and not layout_diffs,
                    {"non_image_views": len(views_before) - len(images_at),
                     "differing": payload_diffs} if payload_diffs else
                    {"non_image_views": len(views_before) - len(images_at)}))

    buffers = output.get("buffers", [])
    declared = buffers[0].get("byteLength", -1) if len(buffers) == 1 else -1
    results.append(("single_embedded_buffer_consistent",
                    len(buffers) == 1 and "uri" not in buffers[0]
                    and 0 <= len(output_bin) - declared < 4, None))
    return results


# ---------------------------------------------------------------- process environment

def limit_cpu(count: int) -> dict:
    """Pin this process, and so the children it starts, to `count` of its allowed cores."""
    info = {"requested_cores": count, "applied": False, "method": None}
    try:
        if hasattr(os, "sched_setaffinity"):
            info["method"] = "os.sched_setaffinity"
            allowed = sorted(os.sched_getaffinity(0))
            info["available_cores"] = len(allowed)
            if len(allowed) > count:
                os.sched_setaffinity(0, allowed[:count])
                info["applied"] = True
        elif sys.platform == "win32":
            info["method"] = "SetProcessAffinityMask (own process)"
            info.update(_limit_windows(count))
    except (OSError, AttributeError, ValueError) as exc:
        info["error"] = f"{type(exc).__name__}: {exc}"
    return info


def _limit_windows(count: int) -> dict:
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.GetProcessAffinityMask.argtypes = (
        wintypes.HANDLE, ctypes.POINTER(ctypes.c_size_t), ctypes.POINTER(ctypes.c_size_t))
    kernel32.GetProcessAffinityMask.restype = wintypes.BOOL
    kernel32.SetProcessAffinityMask.argtypes = (wintypes.HANDLE, ctypes.c_size_t)
    kernel32.SetProcessAffinityMask.restype = wintypes.BOOL

    process = kernel32.GetCurrentProcess()
    allowed, system = ctypes.c_size_t(), ctypes.c_size_t()
    if not kernel32.GetProcessAffinityMask(process, ctypes.byref(allowed), ctypes.byref(system)):
        raise ctypes.WinError(ctypes.get_last_error())
    bits = [b for b in range(ctypes.sizeof(ctypes.c_size_t) * 8) if allowed.value >> b & 1]
    result = {"available_cores": len(bits), "applied": False}
    if len(bits) > count:
        if not kernel32.SetProcessAffinityMask(process, sum(1 << b for b in bits[:count])):
            raise ctypes.WinError(ctypes.get_last_error())
        result["applied"] = True
    return result


def validate_jobs(jobs: dict) -> None:
    entries = jobs.get("jobs")
    if not isinstance(entries, list) or len(entries) != EXPECTED_CALLS["original_compress_cli"]:
        raise Failure("preflight", f"jobs.json must list exactly "
                                   f"{EXPECTED_CALLS['original_compress_cli']} jobs")
    ids = [entry.get("id") for entry in entries]
    if len(set(ids)) != len(ids) or not all(
            isinstance(i, str) and re.fullmatch(r"[a-z0-9][a-z0-9_-]*", i) for i in ids):
        raise Failure("preflight", "job ids must be unique lowercase file-safe names")
    for entry in entries:
        for key in ("max_size", "map_size", "normal_size"):
            value = entry.get(key)
            if type(value) is not int or value < 1:
                raise Failure("preflight", f"{entry['id']}.{key} must be a positive integer")
    common = jobs.get("compression_common", {})
    if common.get("format") not in ("png", "jpeg", "webp"):
        raise Failure("preflight", "compression_common.format must be png, jpeg or webp")
    for key in ("quality", "map_quality"):
        if type(common.get(key)) is not int or not 1 <= common[key] <= 100:
            raise Failure("preflight", f"compression_common.{key} must be 1-100")
    if CLI_SCRIPT not in {f.get("path") for f in jobs.get("source", {}).get("verified_files", [])}:
        raise Failure("preflight", f"{CLI_SCRIPT} must be among source.verified_files")


# ---------------------------------------------------------------- the run

class Example:
    def __init__(self, args: argparse.Namespace, out: Path):
        self.args = args
        self.out = out
        self.private = out / "private"
        self.upstream = args.upstream.resolve()
        self.blender = args.blender.resolve()
        self.jobs_path = (args.jobs or ROOT / "inputs" / "jobs.json").resolve()
        self.calls = {kind: 0 for kind in EXPECTED_CALLS}
        self.invocations: list[dict] = []
        self.failed_checks: list[str] = []
        self.env: dict[str, str] = {}
        self.image_module = None
        self.jobs: dict = {}
        self.results: dict = {
            "schema": "studio-yebisu/assetfurnace-example/results@1",
            "case": "assetfurnace-example",
            "catalog_id": "resource-assetfurnace",
            "status": "running",
            "record_kind": "measured wrapper projection",
            "record_note": "Measured by run_example.py from the actual files. Not a model "
                           "output and not a native JSON API of AssetFurnace: its CLI emits "
                           "text and a GLB, and that text is kept separately (private logs).",
            "authorship": {
                "prepare_input.py, run_example.py, inputs/jobs.json": "claude-opus-5-5",
                "execution": "operator",
                "human_review": "not recorded here",
            },
            "started_at": now(),
            "finished_at": None,
            "failure": None,
            "boundaries": BOUNDARIES,
        }
        out.mkdir(parents=True, exist_ok=True)
        self.private.mkdir()
        pairs = [(str(self.upstream), "<upstream>"), (str(self.blender), "<blender>"),
                 (sys.executable, "<python>"), (str(Path(sys.executable).resolve()), "<python>"),
                 (str(ROOT), "<example>"), (str(Path.home()), "<home>")]
        pairs += [(a.replace("\\", "/"), b) for a, b in pairs]
        self.scrub_pairs = sorted(set(pairs), key=lambda pair: -len(pair[0]))

    # -- bookkeeping

    def scrub(self, value):
        """Replace private absolute paths in every string bound for the public record."""
        if isinstance(value, str):
            for private, placeholder in self.scrub_pairs:
                value = value.replace(private, placeholder)
            return value
        if isinstance(value, list):
            return [self.scrub(item) for item in value]
        if isinstance(value, dict):
            return {key: self.scrub(item) for key, item in value.items()}
        return value

    def check(self, scope: list, where: str, name: str, passed: bool, detail=None) -> bool:
        scope.append({"name": name, "passed": bool(passed),
                      **({"detail": detail} if detail is not None else {})})
        if not passed:
            self.failed_checks.append(f"{where}:{name}")
        return bool(passed)

    def call(self, kind: str, label: str, argv: list[str], public_argv: list[str],
             timeout: int) -> tuple[dict, bytes]:
        self.calls[kind] += 1
        record = {"label": label, "kind": kind, "argv": argv, "cwd": str(ROOT),
                  "env_overrides": {name: self.env[name] for name in THREAD_VARS},
                  "timeout_seconds": timeout, "started_at": now()}
        stdout = stderr = b""
        exit_code, timed_out, launch_error = None, False, None
        started = time.perf_counter()
        try:
            completed = subprocess.run(argv, cwd=ROOT, env=self.env, stdin=subprocess.DEVNULL,
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                       timeout=timeout, check=False)
            exit_code, stdout, stderr = completed.returncode, completed.stdout, completed.stderr
        except subprocess.TimeoutExpired as exc:
            timed_out, stdout, stderr = True, exc.stdout or b"", exc.stderr or b""
        except OSError as exc:
            launch_error = f"{type(exc).__name__}: {exc}"
        elapsed = time.perf_counter() - started
        (self.private / f"{label}.stdout.log").write_bytes(stdout)
        (self.private / f"{label}.stderr.log").write_bytes(stderr)
        record.update(elapsed_seconds=elapsed, exit_code=exit_code, timed_out=timed_out,
                      launch_error=launch_error, stdout_log=f"{label}.stdout.log",
                      stderr_log=f"{label}.stderr.log")
        self.invocations.append(record)
        write_json(self.private / "invocations.json", self.invocations, exclusive=False)
        public = {"argv": public_argv, "cwd": "<example>", "exit_code": exit_code,
                  "timed_out": timed_out, "launch_error": launch_error,
                  "elapsed_seconds": round(elapsed, 3),
                  "stdout": {"bytes": len(stdout), "sha256": sha256(stdout), "kept": "private"},
                  "stderr": {"bytes": len(stderr), "sha256": sha256(stderr), "kept": "private"}}
        return public, stdout

    def verify_files(self, stage: str, base: Path, entries: list[dict], blob: bool) -> list:
        measured = []
        for entry in entries:
            path = base / entry["path"]
            if not path.is_file():
                raise Failure(stage, f"missing file: {entry['path']}")
            data = path.read_bytes()
            row = {"path": entry["path"], "bytes": len(data), "sha256": sha256(data)}
            if blob:
                row["git_blob"] = git_blob(data)
            if any(row[key] != entry[key] for key in row if key != "path"):
                raise Failure(stage, f"{entry['path']} does not match its recorded hash")
            measured.append({**row, "verified": True})
        return measured

    # -- stages

    def execute(self) -> None:
        self.preflight()
        packed, packed_bin, packed_info = self.prepare()
        self.results["jobs"] = []
        for job in self.jobs["jobs"]:
            self.compress(job, packed, packed_bin, packed_info)
        self.final_checks(packed_info)

    def preflight(self) -> None:
        stage = "preflight"
        if sys.version_info[:2] != (3, 11):
            raise Failure(stage, f"Python 3.11 required, this is {platform.python_version()}")
        try:
            import PIL
            from PIL import Image
        except ImportError as exc:
            raise Failure(stage, "Pillow is not importable") from exc
        self.image_module = Image
        if not self.jobs_path.is_file():
            raise Failure(stage, "jobs file not found")
        jobs_bytes = self.jobs_path.read_bytes()
        self.jobs = jobs = json.loads(jobs_bytes.decode("utf-8"))
        validate_jobs(jobs)
        expected = jobs["environment"]
        if PIL.__version__ != expected["pillow"]:
            raise Failure(stage, f"Pillow {expected['pillow']} required, found {PIL.__version__}")

        source = jobs["source"]
        self.results["source"] = {
            **{k: source[k] for k in ("product", "repository", "repository_url", "commit",
                                      "version_note", "license", "notice_file")},
            "tool": jobs["tool"]["script"],
            "tool_modified": False,
            "verified_files": self.verify_files(stage, self.upstream, source["verified_files"],
                                                blob=True),
        }
        source_input = jobs["input"]
        self.results["input"] = {
            **{k: source_input[k] for k in ("id", "title", "origin", "url", "artist", "license",
                                            "kind", "acquired_from", "gltf", "expected")},
            "files": self.verify_files(stage, ROOT, source_input["files"], blob=False),
        }
        if not self.blender.is_file():
            raise Failure(stage, "Blender executable not found")

        threads = self.args.threads
        self.env = dict(os.environ)
        for name in THREAD_VARS:
            self.env[name] = os.environ[name] = str(threads)
        affinity = limit_cpu(threads)

        probe, stdout = self.call("environment_probe", "env-probe",
                                  [sys.executable, "-I", "-c", PROBE],
                                  ["<python>", "-I", "-c", PROBE], 60)
        lines = stdout.decode("utf-8", "replace").split()
        if probe["exit_code"] != 0 or len(lines) != 2:
            raise Failure(stage, "could not read the CLI interpreter's Python/Pillow versions")
        child_python, child_pillow = lines
        if not child_python.startswith("3.11.") or child_pillow != expected["pillow"]:
            raise Failure(stage, f"CLI interpreter has Python {child_python} / Pillow "
                                 f"{child_pillow}; expected 3.11 / {expected['pillow']}")
        self.results["environment"] = {
            "jobs_file": {"path": rel(self.jobs_path) if self.jobs_path.is_relative_to(ROOT)
                          else self.jobs_path.name, "sha256": sha256(jobs_bytes)},
            "runner_python": platform.python_version(),
            "runner_pillow": PIL.__version__,
            "cli_python": child_python,
            "cli_pillow": child_pillow,
            "cli_isolated_mode": True,
            "os": f"{platform.system()} {platform.release()}",
            "machine": platform.machine(),
            "threads": threads,
            "thread_env": list(THREAD_VARS),
            "cpu_affinity": affinity,
            "environment_probe": probe,
        }

    def prepare(self) -> tuple[dict, bytes, dict]:
        stage = "prepare"
        (self.out / "input").mkdir()
        packed_path, record_path = self.out / PACKED_NAME, self.out / PREPARATION_NAME
        gltf = self.jobs["input"]["gltf"]
        tail = ["--background", "--factory-startup", "--threads", str(self.args.threads),
                "--python-exit-code", "1", "--python", PREPARE_SCRIPT, "--",
                gltf, rel(packed_path), rel(record_path)]
        call, _ = self.call("blender_prepare", "blender-prepare", [str(self.blender), *tail],
                            ["<blender>", *tail], BLENDER_TIMEOUT)
        section = self.results["preparation"] = {"role": "input preparation, not AssetFurnace",
                                                 "call": call}
        if call["exit_code"] != 0 or not packed_path.is_file() or not record_path.is_file():
            raise Failure(stage, "Blender packing did not finish; see the private logs")

        record_bytes = record_path.read_bytes()
        preparation = json.loads(record_bytes.decode("utf-8"))
        data = packed_path.read_bytes()
        try:
            info, document, binary = inspect_glb(data, self.image_module)
        except (ValueError, KeyError, IndexError) as exc:
            raise Failure(stage, f"packed GLB could not be read: {exc}") from exc

        source = json.loads((ROOT / gltf).read_text("utf-8"))
        source_files = {f["sha256"]: f["path"] for f in self.results["input"]["files"]}
        section.update(
            record={"path": PREPARATION_NAME, "bytes": len(record_bytes),
                    "sha256": sha256(record_bytes)},
            blender=preparation.get("blender"),
            imported={k: preparation.get("imported", {}).get(k)
                      for k in ("mesh_objects", "triangles", "objects_by_type", "materials")},
            packed={"path": PACKED_NAME, "bytes": info["bytes"], "sha256": info["sha256"]},
            packed_images_vs_source_files=[
                {"index": image["index"], "role": image["role"],
                 "same_bytes_as": source_files.get(image.get("sha256"))}
                for image in info["images"]],
            inspection=info,
        )

        checks, where = section.setdefault("checks", []), "prepare"
        expected = self.jobs["input"]["expected"]
        version = ".".join(str(v) for v in preparation.get("blender", {}).get("version", []))
        self.check(checks, where, "blender_version_matches", version ==
                   self.jobs["environment"]["blender"], version or None)
        imported = preparation.get("imported", {})
        self.check(checks, where, "imported_counts_expected",
                   imported.get("mesh_objects") == expected["mesh_objects"]
                   and imported.get("triangles") == expected["triangles"])
        self.check(checks, where, "record_hash_matches_packed_glb",
                   preparation.get("packed", {}).get("sha256") == info["sha256"])
        counts = info["counts"]
        self.check(checks, where, "packed_counts_expected",
                   counts["mesh_nodes"] == counts["meshes"] == expected["mesh_objects"]
                   and counts["materials"] == expected["materials"]
                   and info["geometry"]["triangles"] == expected["triangles"]
                   and info["geometry"]["non_triangle_primitives"] == 0,
                   {"mesh_nodes": counts["mesh_nodes"], "meshes": counts["meshes"],
                    "materials": counts["materials"], "triangles": info["geometry"]["triangles"]})
        self.check(checks, where, "images_embedded_decoded_mime_matches",
                   bool(info["images"]) and all(
                       image.get("embedded") and image.get("mime_matches_decoded")
                       for image in info["images"]))
        source_slots = sorted(set().union(*image_bindings(source).values()))
        packed_slots = sorted(set().union(*image_bindings(document).values()))
        self.check(checks, where, "material_texture_slots_match_source",
                   source_slots == packed_slots, {"source": source_slots, "packed": packed_slots})
        wanted, got = node_bounds(source), node_bounds(document)
        missing = sorted(set(wanted) ^ set(got), key=str)
        bounds_diff = max((max_abs_diff(wanted[n]["bounds"], got[n]["bounds"])
                           for n in set(wanted) & set(got)), default=float("inf"))
        trs_diff = max((max_abs_diff(wanted[n]["trs"], got[n]["trs"])
                        for n in set(wanted) & set(got)), default=float("inf"))
        self.check(checks, where, "mesh_bounds_match_source",
                   not missing and bounds_diff <= TOLERANCE,
                   {"max_abs_diff": bounds_diff if bounds_diff != float("inf") else None,
                    "unmatched_nodes": missing or None, "tolerance": TOLERANCE})
        self.check(checks, where, "node_transforms_match_source",
                   not missing and trs_diff <= TOLERANCE,
                   {"max_abs_diff": trs_diff if trs_diff != float("inf") else None,
                    "tolerance": TOLERANCE})
        images_at = image_views(document)
        self.check(checks, where, "accessors_do_not_use_image_views",
                   not any(a.get("bufferView") in images_at
                           for a in document.get("accessors", [])))
        if any(not c["passed"] for c in checks):
            raise Failure(stage, "packed input failed verification; compression was not run")
        return document, binary, info

    def compress(self, job: dict, packed: dict, packed_bin: bytes, packed_info: dict) -> None:
        stage = f"compress:{job['id']}"
        common = self.jobs["compression_common"]
        target = self.out / "outputs" / f"{job['id']}.glb"
        target.parent.mkdir(exist_ok=True)
        if target.exists():
            raise Failure(stage, "output already exists")
        requested = {"format": common["format"], "quality": common["quality"],
                     "map_quality": common["map_quality"], "max_size": job["max_size"],
                     "map_size": job["map_size"], "normal_size": job["normal_size"]}
        flags = ["--format", requested["format"], "--quality", str(requested["quality"]),
                 "--map-quality", str(requested["map_quality"]),
                 "--max-size", str(requested["max_size"]),
                 "--map-size", str(requested["map_size"]),
                 "--normal-size", str(requested["normal_size"])]
        paths = [rel(self.out / PACKED_NAME), rel(target)]
        call, _ = self.call("original_compress_cli", f"compress-{job['id']}",
                            [sys.executable, "-I", str(self.upstream / CLI_SCRIPT), *paths, *flags],
                            ["<python>", "-I", f"<upstream>/{CLI_SCRIPT}", *paths, *flags],
                            CLI_TIMEOUT)
        entry = {"id": job["id"], "tool": f"original {CLI_SCRIPT} (unchanged)",
                 "input": PACKED_NAME, "requested": requested, "call": call}
        self.results["jobs"].append(entry)
        if call["exit_code"] != 0 or not target.is_file():
            raise Failure(stage, "the original CLI did not finish; see the private logs")

        data = target.read_bytes()
        try:
            info, document, binary = inspect_glb(data, self.image_module)
        except (ValueError, KeyError, IndexError) as exc:
            raise Failure(stage, f"output GLB could not be read: {exc}") from exc
        identical = info["sha256"] == packed_info["sha256"]
        entry["artifact"] = {"path": target.relative_to(self.out).as_posix(),
                             "bytes": info["bytes"], "sha256": info["sha256"]}
        entry["byte_identical_to_packed_input"] = identical
        entry["inspection"] = info

        changes = []
        for before, after in zip(packed_info["images"], info["images"]):
            cap = requested_cap(set(before["slots"]), job)
            decoded = after.get("decoded") or {}
            changes.append({
                "index": before["index"], "name": before["name"], "role": before["role"],
                "normal": before["normal"], "requested_cap": cap,
                "outcome": "kept" if before.get("sha256") == after.get("sha256") else "replaced",
                "before": _brief(before), "after": _brief(after),
                "after_longest_side_within_cap":
                    max(decoded["width"], decoded["height"]) <= cap if decoded else None,
            })
        entry["image_changes"] = changes

        checks = entry["checks"] = []
        for name, passed, detail in compare_to_packed(packed, packed_bin, document, binary):
            self.check(checks, stage, name, passed, detail)
        self.check(checks, stage, "geometry_json_sha256_equal",
                   info["geometry_json_sha256"] == packed_info["geometry_json_sha256"])
        self.check(checks, stage, "material_json_sha256_equal",
                   info["material_json_sha256"] == packed_info["material_json_sha256"])
        self.check(checks, stage, "triangle_and_vertex_counts_equal",
                   (info["geometry"]["triangles"], info["geometry"]["position_vertices"]) ==
                   (packed_info["geometry"]["triangles"],
                    packed_info["geometry"]["position_vertices"]))
        self.check(checks, stage, "images_embedded_decoded_mime_matches",
                   len(info["images"]) == len(packed_info["images"]) and all(
                       image.get("embedded") and image.get("mime_matches_decoded")
                       for image in info["images"]))

        entry["summary"] = {
            "glb_bytes": info["bytes"],
            "packed_input_bytes": packed_info["bytes"],
            "ratio_to_packed_input": round(info["bytes"] / packed_info["bytes"], 4),
            "byte_identical_to_packed_input": identical,
            "images_replaced": sum(1 for c in changes if c["outcome"] == "replaced"),
            "images_kept": sum(1 for c in changes if c["outcome"] == "kept"),
            "image_roles": info["image_roles"],
            "image_payload_bytes": info["image_payload_bytes"],
            "non_image_payload_bytes": info["non_image_payload_bytes"],
            "elapsed_seconds": call["elapsed_seconds"],
        }

    def final_checks(self, packed_info: dict) -> None:
        checks, where = self.results.setdefault("final_checks", []), "final"
        for kind, expected in EXPECTED_CALLS.items():
            self.check(checks, where, f"{kind}_calls", self.calls[kind] == expected,
                       {"expected": expected, "actual": self.calls[kind]})
        unchanged = all(sha256((ROOT / f["path"]).read_bytes()) == f["sha256"]
                        for f in self.jobs["input"]["files"])
        self.check(checks, where, "input_files_unchanged_after_run", unchanged)
        packed_now = sha256((self.out / PACKED_NAME).read_bytes())
        self.check(checks, where, "packed_input_unchanged_after_run",
                   packed_now == packed_info["sha256"])
        script = next(f for f in self.jobs["source"]["verified_files"] if f["path"] == CLI_SCRIPT)
        self.check(checks, where, "original_cli_unchanged_after_run",
                   sha256((self.upstream / CLI_SCRIPT).read_bytes()) == script["sha256"])

    # -- ending

    def fail(self, stage: str, message: str, trace: str) -> None:
        self.results["failure"] = {"stage": stage, "message": message}
        (self.private / "failure.txt").write_text(trace, encoding="utf-8")

    def finish(self) -> int:
        self.results["calls"] = {kind: {"expected": expected, "actual": self.calls[kind]}
                                 for kind, expected in EXPECTED_CALLS.items()}
        completed = self.results["failure"] is None and not self.failed_checks
        self.results["status"] = "completed" if completed else "failed"
        self.results["failed_checks"] = self.failed_checks
        self.results["finished_at"] = now()
        write_json(self.out / RESULTS_NAME, self.scrub(self.results), exclusive=True)
        write_json(self.private / "invocations.json", self.invocations, exclusive=False)
        print(f"{self.results['status']}: {rel(self.out / RESULTS_NAME)}")
        for job in self.results.get("jobs", []):
            summary = job.get("summary")
            if summary:
                print(f"  {job['id']}: {summary['glb_bytes']} bytes, "
                      f"{summary['images_replaced']} replaced / {summary['images_kept']} kept, "
                      f"identical={summary['byte_identical_to_packed_input']}")
        if not completed:
            print(f"  failure: {self.scrub(self.results['failure'])}"
                  f" failed checks: {self.failed_checks}", file=sys.stderr)
        return 0 if completed else 1


def _brief(image: dict) -> dict:
    decoded = image.get("decoded") or {}
    return {"mime": image.get("declared_mime"), "format": decoded.get("format"),
            "width": decoded.get("width"), "height": decoded.get("height"),
            "bytes": image.get("bytes"), "sha256": image.get("sha256")}


def resolve_out(value: Path) -> Path:
    out = value.resolve()
    try:
        inside = out.relative_to(ROOT)
    except ValueError:
        raise SystemExit("--out must be inside this example folder, so recorded paths stay "
                         "relative") from None
    if not inside.parts or inside.parts[0] == "inputs":
        raise SystemExit("--out must be a subfolder of the example, outside inputs/")
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        raise SystemExit("--out must be absent or an empty folder")
    return out


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--upstream", type=Path, required=True,
                        help="Bingeljell/image-to-3dlab checkout at the fixed commit")
    parser.add_argument("--blender", type=Path, required=True, help="Blender 5.2 executable")
    parser.add_argument("--jobs", type=Path, default=None,
                        help="jobs file (default: inputs/jobs.json next to this script)")
    parser.add_argument("--out", type=Path, required=True,
                        help="new or empty folder inside this example")
    parser.add_argument("--threads", type=int, default=4)
    args = parser.parse_args(argv)
    if args.threads < 1:
        parser.error("--threads must be at least 1")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    example = Example(args, resolve_out(args.out))
    try:
        example.execute()
    except Failure as exc:
        example.fail(exc.stage, str(exc), traceback.format_exc())
    except Exception as exc:  # recorded as a failure rather than lost
        example.fail("unexpected", f"{type(exc).__name__}: {exc}", traceback.format_exc())
    return example.finish()


if __name__ == "__main__":
    raise SystemExit(main())
