#!/usr/bin/env python3
"""Run one ACE-Step v1 (3.5B) text2music job through the original ACEStepPipeline API.

Studio Yebisu case ace-step-example / catalog resource-ace-step.
This file was authored for an operator to execute. It never downloads, installs,
trains, starts a server or post-processes audio. The single pipeline call writes
its own WAV and *_input_params.json; this runner only verifies inputs, observes
method boundaries and measures the saved files.

Exit codes: 0 success (execution-summary.json written), 1 failure (failure.json
written when --out was usable), 2 --out not absent/empty.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import importlib.metadata as metadata
import inspect
import json
import os
import platform
import re
import sys
import time
import traceback
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve()
DEFAULT_JOBS = SCRIPT_PATH.parent / "inputs" / "jobs.json"

REQUIRED_MODEL_SUBDIRS = ("music_dcae_f8c8", "music_vocoder", "ace_step_transformer", "umt5-base")
DTYPE_BY_DEVICE = {"cpu": "float32", "cuda": "bfloat16"}
OBSERVED_METHODS = ("get_text_embeddings", "text2music_diffusion_process", "latents2audio", "save_wav_file")

# Values the runner refuses to change: one plain text2music job, no LoRA,
# no reference/source audio, no editing, no lyrics.
API_GUARDS = {
    "task": "text2music",
    "format": "wav",
    "batch_size": 1,
    "lyrics": "",
    "audio2audio_enable": False,
    "ref_audio_input": None,
    "src_audio_path": None,
    "lora_name_or_path": "none",
    "edit_target_prompt": None,
    "edit_target_lyrics": None,
}
INIT_GUARDS = {"torch_compile": False, "cpu_offload": False, "quantized": False, "overlapped_decode": False}

RUNTIME_PACKAGES = (
    "torch", "torchaudio", "torchvision", "diffusers", "transformers", "tokenizers",
    "accelerate", "huggingface_hub", "safetensors", "numpy", "soundfile", "librosa",
    "loguru", "tqdm", "py3langid", "spacy", "num2words", "pypinyin", "hangul-romanize",
    "cutlet", "fugashi", "datasets", "pytorch_lightning", "peft", "ace_step",
)
RECORDED_ENV = (
    "CUDA_VISIBLE_DEVICES", "HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "HF_DATASETS_OFFLINE",
    "HF_HUB_DISABLE_TELEMETRY", "OMP_NUM_THREADS", "MKL_NUM_THREADS", "TOKENIZERS_PARALLELISM",
    "ACE_PIPELINE_DTYPE",
)

MESSAGE_LIMIT = 4000
TRACEBACK_LIMIT = 12000
STRING_LIMIT = 2000
SEQUENCE_LIMIT = 32
HASH_CHUNK = 8 * 1024 * 1024


class RunError(RuntimeError):
    pass


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def write_json_new(path: Path, obj) -> None:
    """Write JSON to a path that must not exist yet."""
    with open(path, "x", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False, default=non_json)
        f.write("\n")


def non_json(value):
    return {"__non_json__": type(value).__name__, "repr": repr(value)[:STRING_LIMIT]}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_sha1(data: bytes) -> str:
    h = hashlib.sha1()
    h.update(b"blob %d\0" % len(data))
    h.update(data)
    return h.hexdigest()


def hash_file(path: Path, with_git_blob: bool = False) -> dict:
    size = path.stat().st_size
    s256 = hashlib.sha256()
    s1 = hashlib.sha1()
    if with_git_blob:
        s1.update(b"blob %d\0" % size)
    with open(path, "rb") as f:
        while chunk := f.read(HASH_CHUNK):
            s256.update(chunk)
            if with_git_blob:
                s1.update(chunk)
    record = {"bytes": size, "sha256": s256.hexdigest()}
    if with_git_blob:
        record["git_blob_sha1"] = s1.hexdigest()
    return record


def looks_absolute(value: str) -> bool:
    if "\n" in value or len(value) > 1024:
        return False
    return os.path.isabs(value) or bool(re.match(r"^[A-Za-z]:[\\/]", value))


def public_view(obj, out_dir: Path):
    """Copy of obj with absolute paths made relative to --out, or omitted if outside it."""
    if isinstance(obj, dict):
        return {k: public_view(v, out_dir) for k, v in obj.items()}
    if isinstance(obj, list):
        return [public_view(v, out_dir) for v in obj]
    if isinstance(obj, str) and looks_absolute(obj):
        try:
            return Path(obj).resolve().relative_to(out_dir).as_posix()
        except ValueError:
            return "<absolute path outside --out omitted>"
    return obj


class RunState:
    """Everything recorded so far; also the source of failure diagnostics."""

    def __init__(self, out_dir: Path):
        self.out_dir = out_dir
        self.stage = "start"
        self.started_at = utc_now()
        self.t_ref = time.perf_counter()
        self.timings_s: dict[str, float] = {}
        self.pipeline_call_count = 0
        self.load_checkpoint_call_count = 0
        self.observations: list[dict] = []
        self.torch = None
        self.private: dict = {}

    def timed(self, key: str, start: float) -> None:
        self.timings_s[key] = round(time.perf_counter() - start, 6)

    def describe(self, value, depth: int = 0):
        torch = self.torch
        if torch is not None and torch.is_tensor(value):
            return {"tensor_shape": list(value.shape), "dtype": str(value.dtype), "device": str(value.device)}
        if torch is not None and isinstance(value, torch.Generator):
            return {"generator_device": str(value.device), "initial_seed": int(value.initial_seed())}
        if value is None or isinstance(value, (bool, int, float)):
            return value
        if isinstance(value, str):
            return value if len(value) <= STRING_LIMIT else value[:STRING_LIMIT] + "...<truncated>"
        if depth >= 4:
            return {"type": type(value).__name__}
        if isinstance(value, (list, tuple)):
            items = [self.describe(v, depth + 1) for v in value[:SEQUENCE_LIMIT]]
            if len(value) > SEQUENCE_LIMIT:
                items.append({"omitted_items": len(value) - SEQUENCE_LIMIT})
            return items
        if isinstance(value, dict):
            return {str(k): self.describe(v, depth + 1) for k, v in value.items()}
        return {"type": type(value).__name__}

    def observe(self, name: str, original, args: tuple, kwargs: dict):
        """Call the original bound method once and return its result untouched."""
        record = {
            "method": name,
            "entered_at_s": round(time.perf_counter() - self.t_ref, 6),
            "args": self.describe(list(args)),
            "kwargs": self.describe(kwargs),
        }
        self.observations.append(record)
        start = time.perf_counter()
        try:
            result = original(*args, **kwargs)
        except BaseException as exc:
            record["elapsed_s"] = round(time.perf_counter() - start, 6)
            record["raised"] = type(exc).__name__
            raise
        record["elapsed_s"] = round(time.perf_counter() - start, 6)
        record["result"] = self.describe(result)
        return result

    def boundary_counts(self) -> dict:
        return {m: sum(1 for o in self.observations if o["method"] == m) for m in OBSERVED_METHODS}


def make_observed_class(base, state: RunState):
    class ObservedACEStepPipeline(base):
        """Original ACEStepPipeline; overrides only count/time calls and delegate to super()."""

        def load_checkpoint(self, *args, **kwargs):
            state.load_checkpoint_call_count += 1
            return super().load_checkpoint(*args, **kwargs)

        def __call__(self, *args, **kwargs):
            state.pipeline_call_count += 1
            if state.pipeline_call_count != 1:
                raise RunError("ACEStepPipeline.__call__ may run only once in this example")
            return super().__call__(*args, **kwargs)

        def get_text_embeddings(self, *args, **kwargs):
            return state.observe("get_text_embeddings", super().get_text_embeddings, args, kwargs)

        def text2music_diffusion_process(self, *args, **kwargs):
            return state.observe("text2music_diffusion_process", super().text2music_diffusion_process, args, kwargs)

        def latents2audio(self, *args, **kwargs):
            return state.observe("latents2audio", super().latents2audio, args, kwargs)

        def save_wav_file(self, *args, **kwargs):
            return state.observe("save_wav_file", super().save_wav_file, args, kwargs)

    return ObservedACEStepPipeline


def load_job(jobs_path: Path) -> tuple[dict, dict, bytes]:
    raw = jobs_path.read_bytes()
    jobs = json.loads(raw.decode("utf-8"))
    for key in ("source", "model", "pipeline_init", "jobs"):
        if key not in jobs:
            raise RunError(f"jobs file lacks '{key}'")
    if not isinstance(jobs["jobs"], list) or len(jobs["jobs"]) != 1:
        raise RunError("jobs file must contain exactly one job")
    job = jobs["jobs"][0]
    for key in ("job_id", "output", "api_params"):
        if key not in job:
            raise RunError(f"job lacks '{key}'")
    return jobs, job, raw


def verify_source(upstream: Path, source_cfg: dict) -> dict:
    if not (upstream / "acestep" / "pipeline_ace_step.py").is_file():
        raise RunError("--upstream does not contain acestep/pipeline_ace_step.py")
    files = []
    for rel, expected in source_cfg["verified_git_blobs"].items():
        data = (upstream / rel).read_bytes()
        actual = git_blob_sha1(data)
        if actual != expected:
            raise RunError(f"upstream file {rel} git blob {actual} != pinned {expected}")
        files.append({"path": rel, "bytes": len(data), "git_blob_sha1": actual, "sha256": sha256_bytes(data)})
    setup_text = (upstream / "setup.py").read_text(encoding="utf-8")
    match = re.search(r'version\s*=\s*"([^"]+)"', setup_text)
    version = match.group(1) if match else None
    if version != source_cfg["package_version"]:
        raise RunError(f"setup.py version {version!r} != pinned {source_cfg['package_version']!r}")
    return {"setup_py_version": version, "verified_files": files}


def verify_model(model_dir: Path, pin_path: Path, model_cfg: dict) -> dict:
    missing = [d for d in REQUIRED_MODEL_SUBDIRS if not (model_dir / d).is_dir()]
    if missing:
        raise RunError(f"--model-dir lacks required subdirectories {missing}; no download fallback is allowed")

    pin_raw = pin_path.read_bytes()
    pin = json.loads(pin_raw.decode("utf-8"))
    for key, expected in (("repo_id", model_cfg["repo_id"]), ("revision", model_cfg["revision"])):
        if key in pin and pin[key] != expected:
            raise RunError(f"pin record {key} {pin[key]!r} != {expected!r}")
    entries = pin.get("files")
    if not isinstance(entries, list) or not entries:
        raise RunError("pin record must contain a non-empty 'files' list")

    pinned: dict[str, dict] = {}
    for entry in entries:
        rel = str(entry.get("path", "")).replace("\\", "/")
        if not rel or rel.startswith("/") or re.match(r"^[A-Za-z]:", rel) or ".." in rel.split("/"):
            raise RunError(f"pin record path not relative: {entry.get('path')!r}")
        if rel in pinned:
            raise RunError(f"pin record lists {rel} twice")
        if not isinstance(entry.get("bytes"), int) or not re.fullmatch(r"[0-9a-f]{64}", str(entry.get("sha256", ""))):
            raise RunError(f"pin record entry {rel} needs integer bytes and lowercase sha256")
        pinned[rel] = entry

    expected_files = {e["path"]: e for e in model_cfg["expected_files"]}
    for rel, exp in expected_files.items():
        if rel not in pinned:
            raise RunError(f"pin record does not cover official file {rel}")
        if pinned[rel]["bytes"] != exp["bytes"]:
            raise RunError(f"pin record bytes for {rel} differ from the official tree")
        if "lfs_sha256" in exp and pinned[rel]["sha256"] != exp["lfs_sha256"]:
            raise RunError(f"pin record sha256 for {rel} differs from the official LFS sha256")

    for sub in REQUIRED_MODEL_SUBDIRS:
        for root, _dirs, names in os.walk(model_dir / sub):
            for name in names:
                rel = (Path(root) / name).relative_to(model_dir).as_posix()
                if rel not in pinned:
                    raise RunError(f"unpinned file inside model subdirectory: {rel}")

    start = time.perf_counter()
    report = []
    for rel, entry in sorted(pinned.items()):
        path = model_dir / rel
        if not path.is_file():
            raise RunError(f"pinned model file missing: {rel}")
        exp = expected_files.get(rel, {})
        actual = hash_file(path, with_git_blob="git_blob_sha1" in exp)
        if actual["bytes"] != entry["bytes"] or actual["sha256"] != entry["sha256"]:
            raise RunError(f"model file {rel} does not match the pin record")
        if "git_blob_sha1" in exp and actual["git_blob_sha1"] != exp["git_blob_sha1"]:
            raise RunError(f"model file {rel} git blob differs from the official tree")
        official = "lfs_sha256" if "lfs_sha256" in exp else "git_blob_sha1" if "git_blob_sha1" in exp else "pin_record_only"
        report.append({"path": rel, "bytes": actual["bytes"], "sha256": actual["sha256"], "official_check": official})
    return {
        "pin_record_sha256": sha256_bytes(pin_raw),
        "pin_record_repo_id": pin.get("repo_id"),
        "pin_record_revision": pin.get("revision"),
        "required_subdirectories_present": list(REQUIRED_MODEL_SUBDIRS),
        "files": report,
        "hash_elapsed_s": round(time.perf_counter() - start, 3),
    }


def check_api_params(api: dict, signature: inspect.Signature) -> tuple[dict, dict]:
    names = [n for n in signature.parameters if n != "self"]
    allowed = set(names) - {"save_path"}
    unknown = sorted(set(api) - allowed)
    missing = sorted(allowed - set(api))
    if unknown:
        raise RunError(f"not ACEStepPipeline.__call__ parameters: {unknown}")
    if missing:
        raise RunError(f"job must state every __call__ parameter explicitly; missing {missing}")
    for key, required in API_GUARDS.items():
        value = api[key]
        if required is None:
            ok = value is None
        else:
            ok = type(value) is type(required) and value == required
        if not ok:
            raise RunError(f"api_params.{key} must be {required!r} in this example, got {value!r}")
    if not isinstance(api["audio_duration"], float) or api["audio_duration"] <= 0:
        raise RunError("audio_duration must be a positive float (<= 0 makes the source pick a random length)")
    for key in ("manual_seeds", "retake_seeds"):
        if not (isinstance(api[key], str) and api[key].isdigit()):
            raise RunError(f"{key} must be a digit-only string, the single-seed str branch of set_seeds")
    if not isinstance(api["prompt"], str) or not api["prompt"].strip():
        raise RunError("prompt must be a non-empty string")

    comparison = {}
    for name in names:
        if name == "save_path":
            continue
        default = signature.parameters[name].default
        comparison[name] = {
            "passed": api[name],
            "source_default": None if default is inspect.Parameter.empty else default,
            "equals_source_default": default is not inspect.Parameter.empty
            and type(default) is type(api[name]) and default == api[name],
        }
    return dict(api), comparison


def collect_runtime(torch, sf, np, device: str) -> dict:
    packages = {}
    for name in RUNTIME_PACKAGES:
        try:
            packages[name] = metadata.version(name)
        except metadata.PackageNotFoundError:
            packages[name] = None
    runtime = {
        "python": sys.version.split()[0],
        "python_implementation": platform.python_implementation(),
        "platform": platform.platform(),
        "machine": platform.machine(),
        "packages": packages,
        "torch_version": torch.__version__,
        "torch_cuda_build": torch.version.cuda,
        "cuda_available": torch.cuda.is_available(),
        "mps_available": bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()),
        "torch_num_threads": torch.get_num_threads(),
        "torch_num_interop_threads": torch.get_num_interop_threads(),
        "float32_matmul_precision": torch.get_float32_matmul_precision(),
        "cuda_matmul_allow_tf32": torch.backends.cuda.matmul.allow_tf32,
        "cudnn_benchmark": torch.backends.cudnn.benchmark,
        "cudnn_deterministic": torch.backends.cudnn.deterministic,
        "numpy_version": np.__version__,
        "soundfile_version": sf.__version__,
        "libsndfile_version": getattr(sf, "__libsndfile_version__", None),
        "env": {k: os.environ.get(k) for k in RECORDED_ENV},
    }
    if device == "cuda":
        runtime["cuda_device_name"] = torch.cuda.get_device_name(0)
        runtime["cudnn_version"] = torch.backends.cudnn.version()
    return runtime


def channel_stats(np, block) -> dict:
    if block.shape[0] == 0:
        return {"frames": 0}
    peak = np.max(np.abs(block), axis=0)
    rms = np.sqrt(np.mean(np.square(block), axis=0))
    overall_rms = float(np.sqrt(np.mean(np.square(block))))
    return {
        "frames": int(block.shape[0]),
        "peak_abs": float(np.max(peak)),
        "rms": overall_rms,
        "rms_dbfs": None if overall_rms == 0 else round(20 * float(np.log10(overall_rms)), 3),
        "per_channel_peak_abs": [float(v) for v in peak],
        "per_channel_rms": [float(v) for v in rms],
        "per_channel_mean": [float(v) for v in np.mean(block, axis=0)],
    }


def measure_wav(path: Path, sf, np, requested_duration: float) -> dict:
    info = sf.info(str(path))
    data, rate = sf.read(str(path), dtype="float64", always_2d=True)
    finite = np.isfinite(data)
    safe = np.where(finite, data, 0.0)
    window = int(round(0.5 * rate))
    actual_duration = info.frames / info.samplerate
    return {
        "container": {
            "format": info.format,
            "subtype": info.subtype,
            "samplerate": info.samplerate,
            "channels": info.channels,
            "frames": info.frames,
        },
        "duration": {
            "requested_audio_duration_s": requested_duration,
            "actual_duration_s": round(actual_duration, 6),
            "actual_minus_requested_s": round(actual_duration - requested_duration, 6),
        },
        "signal": {
            "all_finite": bool(finite.all()),
            "nonfinite_samples": int(finite.size - int(finite.sum())),
            "samples_abs_ge_1": int(np.count_nonzero(np.abs(safe) >= 1.0)),
            "whole": channel_stats(np, safe),
            "first_0_5_s": channel_stats(np, safe[:window]),
            "last_0_5_s": channel_stats(np, safe[-window:] if safe.shape[0] >= window else safe),
            "note": "Non-finite samples are counted, then treated as 0 for peak/RMS. Read as float64 via soundfile; the file is never rewritten.",
        },
    }


def list_out_files(out_dir: Path) -> list[dict]:
    files = []
    for path in sorted(p for p in out_dir.rglob("*") if p.is_file()):
        try:
            files.append({"path": path.relative_to(out_dir).as_posix(), **hash_file(path)})
        except OSError as exc:
            files.append({"path": path.relative_to(out_dir).as_posix(), "error": type(exc).__name__})
    return files


def run(args, out_dir: Path, state: RunState) -> None:
    state.stage = "preflight"
    if args.threads < 1:
        raise RunError("--threads must be >= 1")
    jobs_path = Path(args.jobs).resolve()
    upstream = Path(args.upstream).resolve()
    model_dir = Path(args.model_dir).resolve()
    pin_path = Path(args.model_pin_record).resolve()
    jobs, job, jobs_raw = load_job(jobs_path)
    state.private.update({
        "argv": sys.argv,
        "python_executable": sys.executable,
        "upstream": str(upstream),
        "model_dir": str(model_dir),
        "model_pin_record": str(pin_path),
        "jobs": str(jobs_path),
        "out": str(out_dir),
    })
    if jobs["pipeline_init"].get("dtype_by_device") != DTYPE_BY_DEVICE:
        raise RunError(f"pipeline_init.dtype_by_device must be {DTYPE_BY_DEVICE}")
    for key, required in INIT_GUARDS.items():
        if jobs["pipeline_init"].get(key) is not required:
            raise RunError(f"pipeline_init.{key} must be {required}")

    if os.environ.get("ACE_PIPELINE_DTYPE"):
        raise RunError("ACE_PIPELINE_DTYPE is set; it would override the requested dtype inside the source")
    if "torch" in sys.modules or "acestep" in sys.modules:
        raise RunError("torch/acestep imported before environment setup")
    for key in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "HF_DATASETS_OFFLINE", "HF_HUB_DISABLE_TELEMETRY"):
        os.environ[key] = "1"
    os.environ["OMP_NUM_THREADS"] = str(args.threads)
    os.environ["MKL_NUM_THREADS"] = str(args.threads)
    if args.device == "cpu":
        os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

    state.stage = "verify_source"
    source_report = verify_source(upstream, jobs["source"])

    state.stage = "verify_model"
    start = time.perf_counter()
    model_report = verify_model(model_dir, pin_path, jobs["model"])
    state.timed("model_file_verification", start)

    state.stage = "import"
    start = time.perf_counter()
    import torch

    state.torch = torch
    torch.set_num_threads(args.threads)
    try:
        torch.set_num_interop_threads(args.threads)
        interop_note = None
    except RuntimeError as exc:
        interop_note = str(exc)[:MESSAGE_LIMIT]
    sys.path.insert(0, str(upstream))
    import acestep.pipeline_ace_step as pipeline_module
    import numpy as np
    import soundfile as sf
    from loguru import logger

    state.timed("import", start)
    module_file = Path(pipeline_module.__file__).resolve()
    if upstream not in module_file.parents:
        raise RunError(f"acestep imported from outside --upstream: {module_file}")
    if pipeline_module.REPO_ID != jobs["model"]["repo_id"]:
        raise RunError(f"source REPO_ID {pipeline_module.REPO_ID!r} != {jobs['model']['repo_id']!r}")
    log_sink = logger.add(str(out_dir / "private" / "upstream-log.txt"), level="INFO", encoding="utf-8")

    if args.device == "cpu" and torch.cuda.is_available():
        raise RunError("CUDA still visible after CUDA_VISIBLE_DEVICES=-1")
    if args.device == "cuda" and not torch.cuda.is_available():
        raise RunError("--device cuda requested but torch.cuda.is_available() is False")
    runtime = collect_runtime(torch, sf, np, args.device)
    runtime["set_num_interop_threads_error"] = interop_note

    state.stage = "validate_api_params"
    base = pipeline_module.ACEStepPipeline
    signature = inspect.signature(base.__call__)
    api_params, default_comparison = check_api_params(job["api_params"], signature)
    filename = job["output"]["filename"]
    if not re.fullmatch(r"[A-Za-z0-9_-]+\.wav", filename):
        raise RunError("output.filename must be a plain name ending in .wav")
    save_path = out_dir / "audio" / filename
    if str(save_path).count(".wav") != 1:
        raise RunError("the absolute save path must contain '.wav' only once (the source derives *_input_params.json by str.replace)")
    if save_path.exists():
        raise RunError(f"refusing to overwrite {save_path}")

    state.stage = "construct"
    init = jobs["pipeline_init"]
    dtype_name = DTYPE_BY_DEVICE[args.device]
    pipeline_cls = make_observed_class(base, state)
    start = time.perf_counter()
    pipe = pipeline_cls(
        checkpoint_dir=str(model_dir),
        device_id=init["device_id"],
        dtype=dtype_name,
        torch_compile=init["torch_compile"],
        cpu_offload=init["cpu_offload"],
        quantized=init["quantized"],
        overlapped_decode=init["overlapped_decode"],
    )
    state.timed("construct", start)
    expected_dtype = torch.float32 if args.device == "cpu" else torch.bfloat16
    if pipe.device.type != args.device or pipe.dtype != expected_dtype:
        raise RunError(f"pipeline chose {pipe.device}/{pipe.dtype}, expected {args.device}/{expected_dtype}")

    state.stage = "load_checkpoint"
    start = time.perf_counter()
    pipe.load_checkpoint(str(model_dir))
    state.timed("load_checkpoint", start)
    if not pipe.loaded:
        raise RunError("load_checkpoint returned without setting loaded=True")

    state.stage = "pipeline_call"
    if args.device == "cuda":
        torch.cuda.reset_peak_memory_stats()
    start = time.perf_counter()
    # Operator packaging correction: preserve original returned JSON without a
    # private absolute path. The original API resolves this path in the process cwd.
    result = pipe(**api_params, save_path=os.path.relpath(save_path, Path.cwd()))
    state.timed("pipeline_call", start)

    state.stage = "record_return"
    raw_return_path = out_dir / "private" / "raw-return.json"
    write_json_new(raw_return_path, result)
    batch_size = api_params["batch_size"]
    if not (isinstance(result, list) and len(result) == batch_size + 1 and isinstance(result[-1], dict)):
        raise RunError("unexpected __call__ return shape; expected [wav_path, input_params_json]")
    returned_wav = Path(result[0])
    if not returned_wav.is_file() or not os.path.samefile(returned_wav, save_path):
        raise RunError(f"returned path {returned_wav} is not the requested save path")
    params_json_path = Path(str(save_path).replace(".wav", "_input_params.json"))
    if not params_json_path.is_file():
        raise RunError(f"source did not write {params_json_path.name}")
    source_params = json.loads(params_json_path.read_text(encoding="utf-8"))
    params_match = source_params == json.loads(json.dumps(result[-1], default=non_json))
    write_json_new(out_dir / "public" / "return.public.json", public_view(json.loads(raw_return_path.read_text(encoding="utf-8")), out_dir))

    counts = state.boundary_counts()
    expected_counts = {"get_text_embeddings": 1, "text2music_diffusion_process": 1, "latents2audio": 1, "save_wav_file": batch_size}
    if counts != expected_counts or state.pipeline_call_count != 1:
        raise RunError(f"boundary counts {counts} / pipeline calls {state.pipeline_call_count} differ from {expected_counts} / 1")

    state.stage = "measure_outputs"
    wav_before = hash_file(save_path)
    audio = measure_wav(save_path, sf, np, api_params["audio_duration"])
    wav_after = hash_file(save_path)
    if wav_before != wav_after:
        raise RunError("WAV changed while being measured")
    cuda_peak = torch.cuda.max_memory_allocated() if args.device == "cuda" else None

    state.stage = "write_summary"
    logger.remove(log_sink)
    write_json_new(out_dir / "private" / "run-record.json", {
        "paths": state.private,
        "pipeline_module_file": str(module_file),
        "runtime_unprojected": runtime,
    })
    file_records = []
    for role, path in (
        ("audio_written_by_source", save_path),
        ("input_params_written_by_source", params_json_path),
        ("raw_return_private", raw_return_path),
        ("return_public_projection", out_dir / "public" / "return.public.json"),
        ("upstream_log_private", out_dir / "private" / "upstream-log.txt"),
        ("run_record_private", out_dir / "private" / "run-record.json"),
    ):
        file_records.append({"role": role, "path": path.relative_to(out_dir).as_posix(), **hash_file(path)})

    summary = {
        "schema": "studio-yebisu.ace-step-example.execution-summary/1",
        "status": "succeeded",
        "status_meaning": "ACEStepPipeline.__call__ ran once and returned; the files it saved were hashed and measured. No listening or quality review is implied.",
        "case_id": jobs.get("case_id"),
        "catalog_id": jobs.get("catalog_id"),
        "job_id": job["job_id"],
        "started_at_utc": state.started_at,
        "finished_at_utc": utc_now(),
        "paths_relative_to": "--out directory",
        "runner": {"file": SCRIPT_PATH.name, "sha256": hash_file(SCRIPT_PATH)["sha256"], "jobs_sha256": sha256_bytes(jobs_raw)},
        "source": {
            "repository": jobs["source"]["repository"],
            "commit": jobs["source"]["commit"],
            "package": jobs["source"]["package"],
            **source_report,
            "pipeline_call_parameters": [n for n in signature.parameters if n != "self"],
            "acestep_installed_distribution": runtime["packages"].get("ace_step"),
        },
        "model": {"repo_id": jobs["model"]["repo_id"], "revision": jobs["model"]["revision"], **model_report},
        "runtime": runtime,
        "settings": {
            "device_requested": args.device,
            "pipeline_device": str(pipe.device),
            "pipeline_dtype": str(pipe.dtype),
            "threads_requested": args.threads,
            "pipeline_init": {k: init[k] for k in ("device_id", *INIT_GUARDS)} | {"dtype": dtype_name},
        },
        "request": {
            "api_params": api_params,
            "save_path": save_path.relative_to(out_dir).as_posix(),
            "comparison_with_source_defaults": default_comparison,
        },
        "execution": {
            "pipeline_call_count": state.pipeline_call_count,
            "load_checkpoint_call_count": state.load_checkpoint_call_count,
            "load_note": "load_checkpoint was called once before __call__ so loading time is separate; __call__ then skips its lazy load because loaded=True.",
            "runner_timings_s": state.timings_s,
            "source_reported_timecosts_s": result[-1].get("timecosts"),
            "cuda_max_memory_allocated_bytes": cuda_peak,
            "boundary_observations": {
                "what_this_is": "Wall-clock time and argument/return tensor shapes at Python entry/exit of four original methods, recorded by a subclass that delegates to super() and returns the original result.",
                "what_this_is_not": "Not a measurement of attention, per-step diffusion behaviour, guidance effect or musical quality. On CUDA, times are not synchronised and may shift between boundaries.",
                "not_observed": [
                    "get_text_embeddings_null (called by the source because use_erg_tag=True)",
                    "set_seeds, tokenize_lyrics, load_lora",
                ],
                "call_counts": counts,
                "records": state.observations,
            },
        },
        "outputs": {
            "files": file_records,
            "returned_audio_paths": [Path(p).resolve().relative_to(out_dir).as_posix() for p in result[:-1]],
            "source_input_params_json_equals_returned_dict": params_match,
            "wav_sha256_unchanged_during_measurement": True,
        },
        "audio_measurements": audio,
        "listening_review": {
            "status": "not_performed",
            "note": "Numbers above come from soundfile/numpy only. Listening judgements, if added later, must be recorded separately with who listened and when.",
        },
        "not_claimed": [
            "originality or absence of similarity to existing works",
            "absence of vocals or vocal-like sounds",
            "absence of noise or artefacts",
            "a smooth ending or a seamless loop",
            "that the requested genre, instrumentation, mood or tempo was achieved",
        ],
    }
    write_json_new(out_dir / "execution-summary.json", public_view(summary, out_dir))


def scrub_paths(text: str, state: RunState) -> str:
    """Replace local path prefixes inside free text (tracebacks, messages) with labels."""
    prefixes = [(str(state.out_dir), "<out>"), (sys.prefix, "<python_prefix>"), (str(Path.home()), "<home>")]
    for key in ("upstream", "model_dir", "model_pin_record", "jobs"):
        if key in state.private:
            prefixes.append((state.private[key], f"<{key}>"))
    for prefix, label in sorted(prefixes, key=lambda item: len(item[0]), reverse=True):
        if prefix:
            text = text.replace(prefix, label)
    return text


def write_failure(state: RunState, exc: BaseException) -> None:
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    private_tb = state.out_dir / "private" / "failure-traceback.txt"
    if private_tb.parent.is_dir() and not private_tb.exists():
        private_tb.write_text(tb[-TRACEBACK_LIMIT:], encoding="utf-8")
    failure = {
        "schema": "studio-yebisu.ace-step-example.failure/1",
        "status": "failed",
        "stage": state.stage,
        "error_type": type(exc).__name__,
        "error_message": scrub_paths(str(exc)[:MESSAGE_LIMIT], state),
        "traceback_tail": scrub_paths(tb[-TRACEBACK_LIMIT:], state),
        "started_at_utc": state.started_at,
        "failed_at_utc": utc_now(),
        "pipeline_call_count": state.pipeline_call_count,
        "load_checkpoint_call_count": state.load_checkpoint_call_count,
        "runner_timings_s": state.timings_s,
        "boundary_observations": state.observations,
        "files_present_in_out": list_out_files(state.out_dir),
        "note": "Diagnostics only. Any files listed were left as written; nothing here indicates a usable result.",
    }
    target = state.out_dir / "failure.json"
    if target.exists():
        target = state.out_dir / f"failure-{int(time.time())}.json"
    write_json_new(target, public_view(failure, state.out_dir))


def parse_args():
    parser = argparse.ArgumentParser(description="Run one ACE-Step v1 text2music job via the original ACEStepPipeline.")
    parser.add_argument("--upstream", required=True, help="ace-step/ACE-Step checkout at the pinned commit (contains acestep/)")
    parser.add_argument("--model-dir", required=True, help="local ACE-Step/ACE-Step-v1-3.5B snapshot with the four model subdirectories")
    parser.add_argument("--model-pin-record", required=True, help="JSON with files[].path/bytes/sha256 for the local model snapshot")
    parser.add_argument("--jobs", default=str(DEFAULT_JOBS), help="job file (default: inputs/jobs.json next to this script)")
    parser.add_argument("--out", required=True, help="output directory; must be absent or empty")
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--threads", type=int, default=4)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    out_dir = Path(args.out).resolve()
    if out_dir.exists() and (not out_dir.is_dir() or any(out_dir.iterdir())):
        print(f"--out must be absent or an empty directory: {out_dir}", file=sys.stderr)
        return 2
    out_dir.mkdir(parents=True, exist_ok=True)
    for sub in ("audio", "private", "public"):
        (out_dir / sub).mkdir()
    state = RunState(out_dir)
    try:
        run(args, out_dir, state)
    except BaseException as exc:  # includes KeyboardInterrupt: keep diagnostics, then fail
        try:
            write_failure(state, exc)
        except Exception as write_exc:
            print(f"could not write failure.json: {write_exc!r}", file=sys.stderr)
        print(f"FAILED at stage {state.stage}: {type(exc).__name__}: {str(exc)[:MESSAGE_LIMIT]}", file=sys.stderr)
        return 1
    print(f"OK: {out_dir / 'execution-summary.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
