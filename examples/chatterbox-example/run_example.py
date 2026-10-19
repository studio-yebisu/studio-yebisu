"""Run the three fixed English jobs through the original ChatterboxTTS Python API.

Original English Chatterbox only (src/chatterbox/tts.py), built-in conds.pt
conditioning, no reference audio. Each job calls model.generate exactly once.
Pass-through probes record what the real t3.inference, s3gen.inference and
watermarker.apply_watermark calls receive and return; they never change inputs
or outputs and are removed after every job.

Usage:
  python run_example.py --checkpoints <CHECKPOINT_DIR> --out <NEW_OUT_DIR> --device cuda
"""
import os

# Offline and credential-free before anything can import huggingface_hub or transformers.
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"

import argparse
import hashlib
import json
import math
import platform
import random
import re
import sys
import time
import traceback
from datetime import datetime, timezone
from importlib import metadata, util
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
WORK_DIR = SCRIPT_DIR.parent
PINS_PATH = SCRIPT_DIR / "vendor" / "pins.json"
PERTH_SOURCE_DIR = SCRIPT_DIR / "vendor" / "perth" / "src" / "perth"

PINS = {
    "source_repository": "resemble-ai/chatterbox",
    "source_commit": "5de7a54aa4e5e2baadb0182dde554908b48b85c2",
    "source_version": "0.1.7",
    "source_license": "MIT",
    "model_repository": "ResembleAI/chatterbox",
    "model_revision": "5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18",
    "model_license": "mit",
    "perth_repository": "resemble-ai/Perth",
    "perth_commit": "ff1c8ac55a976971245cdd53c18d6131ca00d993",
    "selected_implementation": "src/chatterbox/tts.py:ChatterboxTTS.from_local",
}
CHECKPOINT_FILES = ("ve.safetensors", "t3_cfg.safetensors", "s3gen.safetensors", "tokenizer.json", "conds.pt")
PERTH_COMPARED_FILES = (
    "__init__.py",
    "dummy_watermarker.py",
    "perth_net/perth_net_implicit/checkpoint_manager.py",
    "perth_net/perth_net_implicit/perth_watermarker.py",
)

JOB_IDS = ("default", "expressive", "second")
SEED = 20261019
DEFAULT_SETTINGS = {
    "exaggeration": 0.5,
    "cfg_weight": 0.5,
    "temperature": 0.8,
    "repetition_penalty": 1.2,
    "min_p": 0.05,
    "top_p": 1.0,
    "audio_prompt_path": None,
}
EXPECTED_SETTINGS = {
    "default": DEFAULT_SETTINGS,
    "expressive": {**DEFAULT_SETTINGS, "exaggeration": 0.8, "cfg_weight": 0.3},
    "second": DEFAULT_SETTINGS,
}
WORD_RANGES = {"default": (15, 23), "expressive": (15, 23), "second": (12, 20)}
PLAIN_ENGLISH = re.compile(r"[A-Za-z0-9 ,.'?!-]+")

EXPECTED_SR = 24000
SPEECH_VOCAB_SIZE = 6561  # tts.py keeps ids < 6561 before S3Gen
STOP_SPEECH_TOKEN = 6562
PCM16_ENCODER = (
    "numpy: clip returned float32 to [-1, 1], multiply by 32767, round half to even (np.rint), "
    "cast to int16; soundfile writes the int16 array as WAV subtype PCM_16 without further conversion"
)

SCOPE = [
    "Original English ChatterboxTTS (src/chatterbox/tts.py) at the pinned commit, loaded once with ChatterboxTTS.from_local; not Multilingual, Turbo or Nano.",
    "Conditioning is the checkpoint's built-in conds.pt only. audio_prompt_path=None: no reference or human audio, no voice cloning, no microphone, no speech recognition. VoiceEncoder weights are loaded by from_local, but prepare_conditionals is never called.",
    "Local inference only: HF_HUB_OFFLINE=1, TRANSFORMERS_OFFLINE=1, HF_HUB_DISABLE_IMPLICIT_TOKEN=1; no hosted or live API; the runner reads and records no credentials.",
    "Each returned waveform is the output of the original PerthImplicitWatermarker; pre-watermark audio is summarised by statistics and hashes only and is not saved.",
    "Three jobs, each generated exactly once in fixed order in one loaded model; no best-of selection, retries or regeneration.",
    "Durations are single wall-clock measurements from this run, not a benchmark or speed guarantee.",
    "The same seed is not claimed to reproduce identical audio across GPUs, drivers or software versions.",
    "expressive vs default is a paired configuration comparison (exaggeration and cfg_weight changed together), not an isolated parameter experiment and not evidence of quality or emotion.",
]
NOT_VERIFIED = [
    "human listening",
    "intelligibility or semantic accuracy against the input text",
    "naturalness or quality ranking",
    "speaker likeness or identity",
    "emotion or expressiveness",
    "performance or speed in general",
    "watermark detection (get_watermark is not run)",
]


class RunnerError(Exception):
    pass


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json_atomic(path, doc):
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    os.replace(tmp, path)


class Scrubber:
    """Replace private paths in error messages before they reach output files."""

    def __init__(self):
        self.patterns = []

    def add(self, path, label):
        text = str(path)
        if len(text) < 4:
            return
        for variant in {text, text.replace("\\", "/")}:
            self.patterns.append((re.compile(re.escape(variant), re.IGNORECASE), label))
        self.patterns.sort(key=lambda item: -len(item[0].pattern))

    def __call__(self, text):
        for pattern, label in self.patterns:
            text = pattern.sub(label, text)
        return text


# ---------------------------------------------------------------- validation


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def load_jobs(path):
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        raise RunnerError("jobs file must be UTF-8 without BOM")
    if b"\r" in raw:
        raise RunnerError("jobs file must use LF line endings")
    doc = json.loads(raw.decode("utf-8"))
    if doc.get("language") != "en":
        raise RunnerError('jobs file language must be "en"')
    jobs = doc.get("jobs")
    if not isinstance(jobs, list) or [job.get("id") for job in jobs] != list(JOB_IDS):
        raise RunnerError(f"jobs must be exactly {list(JOB_IDS)} in this order")

    for job in jobs:
        job_id = job["id"]
        text = job.get("text")
        if not isinstance(text, str) or not PLAIN_ENGLISH.fullmatch(text) or text != " ".join(text.split()):
            raise RunnerError(f"{job_id}: text must be single-spaced plain English ASCII")
        words = len(text.split())
        low, high = WORD_RANGES[job_id]
        if not low <= words <= high:
            raise RunnerError(f"{job_id}: text has {words} words, expected {low}-{high}")
        if len(re.findall(r"[.?!](?= |$)", text)) != 2:
            raise RunnerError(f"{job_id}: text must be exactly two sentences")
        seed = job.get("seed")
        if not isinstance(seed, int) or isinstance(seed, bool) or seed != SEED:
            raise RunnerError(f"{job_id}: seed must be {SEED}")
        settings = job.get("settings")
        expected = EXPECTED_SETTINGS[job_id]
        if not isinstance(settings, dict) or set(settings) != set(expected):
            raise RunnerError(f"{job_id}: settings keys must be {sorted(expected)}")
        for key, want in expected.items():
            got = settings[key]
            if want is None:
                if got is not None:
                    raise RunnerError(f"{job_id}: {key} must be null (no reference audio)")
            elif not is_number(got) or float(got) != want:
                raise RunnerError(f"{job_id}: {key} must be {want}, got {got!r}")

    default, expressive, second = jobs
    if expressive["text"] != default["text"]:
        raise RunnerError("expressive must use exactly the same text as default")
    if second["text"] == default["text"]:
        raise RunnerError("second must use a different text from default")
    return doc, jobs


def ensure_new_out(out):
    if out.exists():
        if not out.is_dir():
            raise RunnerError("--out exists and is not a directory")
        if any(out.iterdir()):
            raise RunnerError("--out already contains files; choose a new output directory (nothing is overwritten)")


def check_checkpoints(checkpoints):
    if not checkpoints.is_dir():
        raise RunnerError("--checkpoints is not a directory")
    bad = [name for name in CHECKPOINT_FILES
           if not (checkpoints / name).is_file() or (checkpoints / name).stat().st_size == 0]
    if bad:
        raise RunnerError(f"checkpoint directory is missing or has empty files: {bad}")


def package_dir(name):
    spec = util.find_spec(name)  # locates without importing
    if spec is None or not spec.submodule_search_locations:
        raise RunnerError(f"package {name!r} is not installed in this environment")
    return Path(list(spec.submodule_search_locations)[0])


def installed_vcs_commit(dist_name):
    """Commit id from installer metadata when present; the URL itself is never recorded."""
    try:
        raw = metadata.distribution(dist_name).read_text("direct_url.json")
    except metadata.PackageNotFoundError:
        return None
    if not raw:
        return None
    return (json.loads(raw).get("vcs_info") or {}).get("commit_id")


def verify_sources(scrub):
    if not PINS_PATH.is_file():
        raise RunnerError("vendor/pins.json was not found beside run_example.py")
    pins = json.loads(PINS_PATH.read_text(encoding="utf-8"))
    for key in ("source_commit", "source_version", "model_revision", "perth_commit"):
        if pins.get(key) != PINS[key]:
            raise RunnerError(f"upstream-pins.json {key} does not match the runner pin")

    chatterbox_dir = package_dir("chatterbox")
    scrub.add(chatterbox_dir.parent, "<site-packages-or-source>")
    checked, mismatched = [], []
    for entry in pins["source_files_verified"]:
        rel = entry["path"]
        if not rel.startswith("src/chatterbox/"):
            continue
        installed = chatterbox_dir / rel[len("src/chatterbox/"):]
        checked.append(rel)
        if not installed.is_file() or sha256_file(installed) != entry["sha256"]:
            mismatched.append(rel)
    if not checked or mismatched:
        raise RunnerError(f"installed chatterbox source differs from the pinned commit: {mismatched or 'no files checked'}")
    version = metadata.version("chatterbox-tts")
    if version != PINS["source_version"]:
        raise RunnerError(f"chatterbox-tts version {version} != {PINS['source_version']}")

    perth_dir = package_dir("perth")
    scrub.add(perth_dir.parent, "<site-packages-or-source>")
    perth_files = []
    for rel in PERTH_COMPARED_FILES:
        pinned = PERTH_SOURCE_DIR / rel
        if not pinned.is_file():
            continue
        installed = perth_dir / rel
        pinned_sha = sha256_file(pinned)
        installed_sha = sha256_file(installed) if installed.is_file() else None
        normalized_match = bool(installed.is_file() and installed.read_bytes().replace(b"\r\n", b"\n") == pinned.read_bytes().replace(b"\r\n", b"\n"))
        if installed_sha != pinned_sha and not normalized_match:
            raise RunnerError(f"installed perth/{rel} content differs from the pinned Perth source copy")
        perth_files.append({"path": f"src/perth/{rel}", "sha256": installed_sha,
                            "official_raw_sha256": pinned_sha, "rawbytes_match": installed_sha == pinned_sha,
                            "crlf_only_normalized_content_match": normalized_match})
    perth_commit = installed_vcs_commit("resemble-perth")
    if perth_commit is not None and perth_commit != PINS["perth_commit"]:
        raise RunnerError(f"installed resemble-perth commit {perth_commit} != pinned {PINS['perth_commit']}")

    tts_sha = next(e["sha256"] for e in pins["source_files_verified"] if e["path"] == "src/chatterbox/tts.py")
    return {
        "chatterbox_tts_version": version,
        "chatterbox_python_files_matched_pins": len(checked),
        "chatterbox_tts_py_sha256": tts_sha,
        "chatterbox_installed_vcs_commit": installed_vcs_commit("chatterbox-tts"),
        "perth_files_matched_local_pinned_copy": perth_files,
        "perth_installed_vcs_commit": perth_commit,
        "perth_note": "Listed Perth files are compared with fixed official source; Windows Git CRLF-only differences are recorded separately from rawbyte identity. The operator independently checks the full installed Perth files including its bundled checkpoint against official Git blobs.",
    }


# ---------------------------------------------------------------- measurement


def shape_of(value):
    import torch
    return list(value.shape) if torch.is_tensor(value) else None


def array_sha256(array):
    import numpy as np
    return hashlib.sha256(np.ascontiguousarray(array).tobytes()).hexdigest()


def audio_stats(array):
    import numpy as np
    array = np.asarray(array)
    values = array.astype(np.float64)
    finite = bool(np.isfinite(values).all())
    peak = float(np.max(np.abs(values))) if values.size and finite else None
    rms = float(np.sqrt(np.mean(values ** 2))) if values.size and finite else None
    return {
        "shape": list(array.shape),
        "dtype": str(array.dtype),
        "sha256": array_sha256(array),
        "all_finite": finite,
        "peak_abs": peak,
        "rms": rms,
        "samples_abs_over_1": int(np.count_nonzero(np.abs(values) > 1.0)) if finite else None,
    }


def first_arg(args, kwargs, name):
    if name in kwargs:
        return kwargs[name]
    return args[0] if args else None


PROBED = (("t3", "inference"), ("s3gen", "inference"), ("watermarker", "apply_watermark"))


def install_probes(model, obs, sync):
    """Shadow three bound methods on the instances; each original is called exactly once per job."""
    import torch

    t3_inference = model.t3.inference
    s3gen_inference = model.s3gen.inference
    apply_watermark = model.watermarker.apply_watermark

    def t3_probe(*args, **kwargs):
        rec = obs["t3"]
        rec["calls"] += 1
        text_tokens = kwargs["text_tokens"]
        cond = kwargs["t3_cond"]
        rec["input"] = {
            "text_tokens_shape": list(text_tokens.shape),
            "text_token_ids_row0": text_tokens[0].tolist(),
            "cfg_rows_identical": bool(text_tokens.shape[0] == 2 and torch.equal(text_tokens[0], text_tokens[1])),
            "t3_cond_emotion_adv": float(torch.as_tensor(cond.emotion_adv).reshape(-1)[0]),
            "t3_cond_prompt_emb_cached_before_call": cond.cond_prompt_speech_emb is not None,
            "kwargs": {k: kwargs[k] for k in
                       ("max_new_tokens", "temperature", "cfg_weight", "repetition_penalty", "min_p", "top_p")
                       if k in kwargs},
        }
        sync()
        start = time.perf_counter()
        out = t3_inference(*args, **kwargs)
        sync()
        rec["seconds"] = time.perf_counter() - start
        rec["raw_shape"] = list(out.shape)
        rec["raw_dtype"] = str(out.dtype)
        rec["raw_ids"] = out[0].tolist()
        return out

    def s3gen_probe(*args, **kwargs):
        rec = obs["s3gen"]
        rec["calls"] += 1
        tokens = first_arg(args, kwargs, "speech_tokens")
        ref = kwargs.get("ref_dict")
        rec["input_shape"] = list(tokens.shape)
        rec["input_dtype"] = str(tokens.dtype)
        rec["input_ids"] = tokens.reshape(-1).tolist()
        rec["ref_dict_shapes"] = {k: shape_of(v) for k, v in ref.items()} if isinstance(ref, dict) else None
        sync()
        start = time.perf_counter()
        result = s3gen_inference(*args, **kwargs)
        sync()
        rec["seconds"] = time.perf_counter() - start
        wav = result[0]
        rec["output_shape"] = list(wav.shape)
        rec["output_dtype"] = str(wav.dtype)
        rec["output_sha256"] = array_sha256(wav.squeeze(0).detach().cpu().numpy())
        return result

    def watermark_probe(*args, **kwargs):
        import numpy as np
        rec = obs["watermark"]
        rec["calls"] += 1
        signal = first_arg(args, kwargs, "signal")
        rec["sample_rate"] = kwargs.get("sample_rate", args[1] if len(args) > 1 else None)
        rec["input"] = audio_stats(signal)
        sync()
        start = time.perf_counter()
        out = apply_watermark(*args, **kwargs)
        sync()
        rec["seconds"] = time.perf_counter() - start
        rec["output"] = audio_stats(out)
        if np.shape(out) == np.shape(signal):
            diff = np.asarray(out, dtype=np.float64) - np.asarray(signal, dtype=np.float64)
            rec["difference"] = {
                "max_abs": float(np.max(np.abs(diff))),
                "rms": float(np.sqrt(np.mean(diff ** 2))),
            }
        return out

    for (attr, name), probe in zip(PROBED, (t3_probe, s3gen_probe, watermark_probe)):
        setattr(getattr(model, attr), name, probe)


def remove_probes(model):
    for attr, name in PROBED:
        target = getattr(model, attr)
        if name in vars(target):
            delattr(target, name)


def probes_removed(model):
    return all(name not in vars(getattr(model, attr)) for attr, name in PROBED)


def seed_everything(seed, device):
    import numpy as np
    import torch
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if device == "cuda":
        torch.cuda.manual_seed_all(seed)


def save_pcm16(path, samples, sample_rate):
    import numpy as np
    import soundfile as sf
    if path.exists():
        raise RunnerError(f"refusing to overwrite {path.name}")
    floats = np.asarray(samples, dtype=np.float64)
    if not np.isfinite(floats).all():
        raise RunnerError("returned audio contains non-finite samples; not encoding it")
    pcm = np.rint(np.clip(floats, -1.0, 1.0) * 32767.0).astype(np.int16)
    sf.write(str(path), pcm, sample_rate, subtype="PCM_16", format="WAV")
    return pcm


def decode_wav(path, written):
    import numpy as np
    import soundfile as sf
    info = sf.info(str(path))
    data, sample_rate = sf.read(str(path), dtype="int16", always_2d=True)
    mono = data[:, 0].astype(np.int64)
    peak = int(np.max(np.abs(mono))) if mono.size else 0
    rms = float(np.sqrt(np.mean((mono / 32768.0) ** 2))) if mono.size else 0.0
    return {
        "format": info.format,
        "subtype": info.subtype,
        "sample_rate": int(sample_rate),
        "channels": int(data.shape[1]),
        "frames": int(data.shape[0]),
        "duration_seconds": data.shape[0] / sample_rate if sample_rate else None,
        "peak_abs_int16": peak,
        "peak_dbfs": 20 * math.log10(peak / 32768.0) if peak else None,
        "rms_dbfs": 20 * math.log10(rms) if rms > 0 else None,
        "rms_full_scale": rms,
        "samples_at_int16_limit": int(np.count_nonzero(np.abs(mono) >= 32767)),
        "roundtrip_identical_to_written_int16": bool(data.shape == (written.size, 1) and np.array_equal(data[:, 0], written)),
    }


def filter_observation(raw_ids, s3gen_ids, max_new_tokens):
    stop_index = raw_ids.index(STOP_SPEECH_TOKEN) if STOP_SPEECH_TOKEN in raw_ids else None
    before_stop = raw_ids if stop_index is None else raw_ids[:stop_index]
    return {
        "raw_count": len(raw_ids),
        "raw_first_stop_index": stop_index,
        "raw_ids_ge_6561_count": sum(1 for t in raw_ids if t >= SPEECH_VOCAB_SIZE),
        "raw_reached_max_new_tokens_without_stop": stop_index is None and len(raw_ids) == max_new_tokens,
        "s3gen_input_count": len(s3gen_ids),
        "removed_count": len(raw_ids) - len(s3gen_ids),
        "s3gen_input_equals_raw_before_first_stop_with_ids_ge_6561_removed":
            s3gen_ids == [t for t in before_stop if t < SPEECH_VOCAB_SIZE],
    }


# ---------------------------------------------------------------- run


class Progress:
    def __init__(self, out, device, threads):
        self.path = out / "progress.json"
        self.doc = {
            "schema": "studio-yebisu/chatterbox-example/progress@1",
            "status": "running",
            "stage": "start",
            "started_utc": utc_now(),
            "updated_utc": utc_now(),
            "device": device,
            "threads": threads,
            "jobs": {job_id: {"status": "pending"} for job_id in JOB_IDS},
            "error": None,
            "note": "Written atomically after every stage. results.json exists only after all three jobs were generated and saved; status 'passed' requires every check to pass.",
        }
        self.save()

    def stage(self, name):
        self.doc["stage"] = name
        print(f"[stage] {name}", flush=True)
        self.save()

    def save(self):
        self.doc["updated_utc"] = utc_now()
        write_json_atomic(self.path, self.doc)


def environment(torch, device):
    packages = {}
    for name in ("torch", "torchaudio", "transformers", "diffusers", "tokenizers", "safetensors", "numpy",
                 "librosa", "soundfile", "s3tokenizer", "conformer", "chatterbox-tts", "resemble-perth"):
        try:
            packages[name] = metadata.version(name)
        except metadata.PackageNotFoundError:
            packages[name] = None
    env = {
        "python": platform.python_version(),
        "os": platform.system(),
        "packages": packages,
        "torch_cuda_build": torch.version.cuda,
        "torch_num_threads": torch.get_num_threads(),
        "cudnn_benchmark": torch.backends.cudnn.benchmark,
        "cudnn_deterministic": torch.backends.cudnn.deterministic,
        "deterministic_algorithms": torch.are_deterministic_algorithms_enabled(),
    }
    if device == "cuda":
        env["cuda_device_name"] = torch.cuda.get_device_name(0)
        env["cudnn_version"] = torch.backends.cudnn.version()
    return env


def run(args, checkpoints, out, jobs_doc, jobs, source_check, progress):
    progress.stage("import")
    import numpy as np
    import torch
    torch.set_num_threads(args.threads)

    if args.device == "cuda" and not torch.cuda.is_available():
        raise RunnerError(
            f"--device cuda was requested but torch.cuda.is_available() is False (torch CUDA build: {torch.version.cuda}). "
            "Fix the dedicated environment, or deliberately start a separate CPU attempt with --device cpu and a new --out. "
            "This runner never switches device on its own."
        )

    def sync():
        if args.device == "cuda":
            torch.cuda.synchronize()

    import perth
    if getattr(perth, "PerthImplicitWatermarker", None) is None:
        raise RunnerError("perth.PerthImplicitWatermarker failed to import; the runner refuses DummyWatermarker or a disabled watermark. Fix the Perth installation.")
    from chatterbox.tts import ChatterboxTTS, punc_norm

    progress.stage("hash_checkpoints")
    checkpoint_files = [
        {"name": name, "bytes": (checkpoints / name).stat().st_size, "sha256": sha256_file(checkpoints / name)}
        for name in CHECKPOINT_FILES
    ]

    progress.stage("load")
    sync()
    start = time.perf_counter()
    model = ChatterboxTTS.from_local(checkpoints, args.device)
    sync()
    load_seconds = time.perf_counter() - start

    if type(model) is not ChatterboxTTS:
        raise RunnerError("loaded object is not the original ChatterboxTTS")
    if type(model.watermarker) is not perth.PerthImplicitWatermarker or isinstance(model.watermarker, perth.DummyWatermarker):
        raise RunnerError(f"watermarker is {type(model.watermarker).__name__}, not PerthImplicitWatermarker")
    if model.conds is None:
        raise RunnerError("built-in conditionals were not loaded from conds.pt")
    if model.sr != EXPECTED_SR:
        raise RunnerError(f"model.sr is {model.sr}, expected {EXPECTED_SR}")
    hp = model.t3.hp
    if (hp.text_tokens_dict_size, hp.start_speech_token, hp.stop_speech_token) != (704, SPEECH_VOCAB_SIZE, STOP_SPEECH_TOKEN):
        raise RunnerError("T3 config is not the English-only configuration this runner expects")
    weight_device = next(model.t3.parameters()).device.type
    if weight_device != args.device:
        raise RunnerError(f"T3 weights are on {weight_device}, requested {args.device}")

    conds = model.conds
    model_observed = {
        "class": "chatterbox.tts.ChatterboxTTS",
        "sample_rate": model.sr,
        "device": args.device,
        "t3_text_tokens_dict_size": hp.text_tokens_dict_size,
        "t3_start_text_token": hp.start_text_token,
        "t3_stop_text_token": hp.stop_text_token,
        "t3_start_speech_token": hp.start_speech_token,
        "t3_stop_speech_token": hp.stop_speech_token,
        "watermarker_class": f"{type(model.watermarker).__module__}.{type(model.watermarker).__name__}",
        "builtin_conds_before_first_job": {
            "t3": {
                "speaker_emb_shape": shape_of(conds.t3.speaker_emb),
                "cond_prompt_speech_tokens_shape": shape_of(conds.t3.cond_prompt_speech_tokens),
                "emotion_adv": float(torch.as_tensor(conds.t3.emotion_adv).reshape(-1)[0]),
                "clap_emb_present": conds.t3.clap_emb is not None,
            },
            "gen": {k: shape_of(v) for k, v in conds.gen.items()},
        },
        "load_seconds": load_seconds,
    }
    env = environment(torch, args.device)
    print(f"[load] ChatterboxTTS on {args.device}, sr={model.sr}, {load_seconds:.1f}s", flush=True)

    records = []
    for job in jobs:
        job_id, settings = job["id"], job["settings"]
        progress.doc["jobs"][job_id] = {"status": "running"}
        progress.stage(f"generate:{job_id}")
        print(f"[{job_id}] seed={job['seed']} exaggeration={settings['exaggeration']} cfg_weight={settings['cfg_weight']}", flush=True)

        obs = {"t3": {"calls": 0}, "s3gen": {"calls": 0}, "watermark": {"calls": 0}}
        seed_everything(job["seed"], args.device)
        install_probes(model, obs, sync)
        try:
            sync()
            start = time.perf_counter()
            returned = model.generate(
                job["text"],
                repetition_penalty=settings["repetition_penalty"],
                min_p=settings["min_p"],
                top_p=settings["top_p"],
                audio_prompt_path=None,
                exaggeration=settings["exaggeration"],
                cfg_weight=settings["cfg_weight"],
                temperature=settings["temperature"],
            )
            sync()
            generate_seconds = time.perf_counter() - start
        finally:
            remove_probes(model)

        progress.stage(f"save:{job_id}")
        returned_array = returned.squeeze(0).numpy() if returned.dim() == 2 and returned.shape[0] == 1 else returned.numpy()
        returned_stats = audio_stats(returned_array)
        returned_stats["tensor_shape"] = list(returned.shape)
        returned_stats["tensor_dtype"] = str(returned.dtype)

        wav_rel = f"audio/{job_id}.wav"
        wav_path = out / wav_rel
        pcm = save_pcm16(wav_path, returned_array, model.sr)
        decoded = decode_wav(wav_path, pcm)

        t3, s3, wm = obs["t3"], obs["s3gen"], obs["watermark"]
        t3_kwargs = t3.get("input", {}).get("kwargs", {})
        settings_reached_t3 = all(
            k in t3_kwargs and math.isclose(float(t3_kwargs[k]), float(settings[k]), rel_tol=1e-9)
            for k in ("temperature", "cfg_weight", "repetition_penalty", "min_p", "top_p")
        ) and math.isclose(t3.get("input", {}).get("t3_cond_emotion_adv", math.nan), settings["exaggeration"], rel_tol=1e-6)

        checks = {
            "t3_inference_called_once": t3["calls"] == 1,
            "s3gen_inference_called_once": s3["calls"] == 1,
            "apply_watermark_called_once": wm["calls"] == 1,
            "probes_removed": probes_removed(model),
            "settings_reached_t3": settings_reached_t3,
            "watermark_sample_rate_is_model_sr": wm.get("sample_rate") == model.sr,
            "s3gen_output_is_watermark_input": s3.get("output_sha256") == wm.get("input", {}).get("sha256"),
            "returned_audio_is_watermark_output": wm.get("output", {}).get("sha256") == returned_stats["sha256"],
            "returned_shape_is_1xN": returned.dim() == 2 and returned.shape[0] == 1 and returned.shape[1] > 0,
            "returned_all_finite": returned_stats["all_finite"],
            "wav_is_pcm16": decoded["subtype"] == "PCM_16",
            "wav_is_mono": decoded["channels"] == 1,
            "wav_sample_rate_is_model_sr": decoded["sample_rate"] == model.sr,
            "wav_frames_match_returned_samples": decoded["frames"] == returned_array.size,
            "wav_roundtrip_identical": decoded["roundtrip_identical_to_written_int16"],
            "wav_not_silent": decoded["peak_abs_int16"] > 0,
        }
        wav_bytes = wav_path.stat().st_size
        record = {
            "id": job_id,
            "role": job.get("role"),
            "text": job["text"],
            "normalized_text": punc_norm(job["text"]),
            "normalized_text_source": "runner call to the original chatterbox.tts.punc_norm; generate applies the same function internally",
            "seed": job["seed"],
            "settings": settings,
            "generate_seconds": generate_seconds,
            "stages_observed": {
                "text_tokens": {
                    "ids_row0_with_start_stop": t3.get("input", {}).get("text_token_ids_row0"),
                    "shape": t3.get("input", {}).get("text_tokens_shape"),
                    "cfg_rows_identical": t3.get("input", {}).get("cfg_rows_identical"),
                },
                "t3_inference": {
                    "calls": t3["calls"],
                    "kwargs": t3_kwargs,
                    "t3_cond_emotion_adv": t3.get("input", {}).get("t3_cond_emotion_adv"),
                    "t3_cond_prompt_emb_cached_before_call": t3.get("input", {}).get("t3_cond_prompt_emb_cached_before_call"),
                    "raw_shape": t3.get("raw_shape"),
                    "raw_dtype": t3.get("raw_dtype"),
                    "raw_speech_token_ids": t3.get("raw_ids"),
                    "seconds": t3.get("seconds"),
                },
                "filter": filter_observation(t3.get("raw_ids", []), s3.get("input_ids", []), t3_kwargs.get("max_new_tokens")),
                "s3gen_inference": {
                    "calls": s3["calls"],
                    "input_shape": s3.get("input_shape"),
                    "input_dtype": s3.get("input_dtype"),
                    "input_speech_token_ids": s3.get("input_ids"),
                    "ref_dict_shapes": s3.get("ref_dict_shapes"),
                    "output_shape": s3.get("output_shape"),
                    "output_dtype": s3.get("output_dtype"),
                    "output_sha256": s3.get("output_sha256"),
                    "seconds": s3.get("seconds"),
                },
                "apply_watermark": {
                    "calls": wm["calls"],
                    "sample_rate": wm.get("sample_rate"),
                    "pre_watermark_audio_stats": wm.get("input"),
                    "watermarked_audio_stats": wm.get("output"),
                    "difference": wm.get("difference"),
                    "seconds": wm.get("seconds"),
                },
            },
            "returned_audio": returned_stats,
            "wav": {
                "path": wav_rel,
                "bytes": wav_bytes,
                "sha256": sha256_file(wav_path),
                "encoder": PCM16_ENCODER,
                "returned_samples_clipped_by_encoding": returned_stats["samples_abs_over_1"],
                **decoded,
            },
            "checks": checks,
            "passed": all(checks.values()),
        }
        records.append(record)
        progress.doc["jobs"][job_id] = {"status": "generated", "passed": record["passed"], "record": record}
        progress.save()
        print(f"[{job_id}] {wav_rel} {decoded['duration_seconds']:.2f}s peak={decoded['peak_abs_int16']} "
              f"generate={generate_seconds:.1f}s checks={'ok' if record['passed'] else 'FAILED'}", flush=True)

    progress.stage("results")
    default, expressive = records[0], records[1]
    changed = sorted(k for k in default["settings"] if default["settings"][k] != expressive["settings"][k])
    paired_checks = {
        "same_text": default["text"] == expressive["text"],
        "same_seed": default["seed"] == expressive["seed"],
        "only_exaggeration_and_cfg_weight_differ": changed == ["cfg_weight", "exaggeration"],
    }
    overall_checks = {
        "all_three_wavs_exist": all((out / r["wav"]["path"]).is_file() for r in records),
        "all_job_checks_passed": all(r["passed"] for r in records),
        **{f"paired_{k}": v for k, v in paired_checks.items()},
    }
    status = "passed" if all(overall_checks.values()) else "checks_failed"
    results = {
        "schema": "studio-yebisu/chatterbox-example/results@1",
        "status": status,
        "scope": SCOPE,
        "not_verified": NOT_VERIFIED,
        "pins": PINS,
        "source_verification": source_check,
        "checkpoint_files": checkpoint_files,
        "environment": env,
        "run": {
            "device": args.device,
            "threads": args.threads,
            "started_utc": progress.doc["started_utc"],
            "finished_utc": utc_now(),
            "job_order": list(JOB_IDS),
            "seed_policy": jobs_doc.get("seed_policy"),
            "generate_calls": len(records),
        },
        "model_observed": model_observed,
        "paired_configuration_comparison": {
            "base": "default",
            "variant": "expressive",
            "changed": {k: [default["settings"][k], expressive["settings"][k]] for k in changed},
            "checks": paired_checks,
            "observed": {
                r["id"]: {
                    "s3gen_input_speech_tokens": r["stages_observed"]["filter"]["s3gen_input_count"],
                    "wav_duration_seconds": r["wav"]["duration_seconds"],
                    "wav_rms_dbfs": r["wav"]["rms_dbfs"],
                }
                for r in (default, expressive)
            },
            "limitation": "Two settings changed together in one run each; differences cannot be attributed to either parameter and are not evidence of quality or emotion.",
        },
        "measurement_notes": [
            "Stage data comes from pass-through probes on the real bound methods during the single generate call; no extra model inference.",
            "text token ids are the tensor T3 received (row 0, including start 255 and stop 0); with cfg_weight > 0 T3 receives two identical rows.",
            "raw_speech_token_ids is the unfiltered T3 return; input_speech_token_ids is exactly what S3Gen received after tts.py's filtering.",
            "Stage and generate seconds are wall-clock with CUDA synchronisation around each timed call; single run only.",
            "Upstream generate rebuilds conds.t3 when exaggeration differs and caches the prompt embedding; jobs therefore share model state in fixed order, as the original API does.",
        ],
        "jobs": records,
        "overall_checks": overall_checks,
    }
    write_json_atomic(out / "results.json", results)
    progress.doc["status"] = status
    progress.stage("done")
    print(f"[done] status={status} results=results.json", flush=True)
    return 0 if status == "passed" else 1


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Run the three fixed original English Chatterbox TTS jobs once each.")
    parser.add_argument("--checkpoints", type=Path, required=True,
                        help="directory with ve.safetensors, t3_cfg.safetensors, s3gen.safetensors, tokenizer.json, conds.pt")
    parser.add_argument("--jobs", type=Path, default=SCRIPT_DIR / "inputs" / "jobs.json")
    parser.add_argument("--out", type=Path, required=True, help="new or empty output directory")
    parser.add_argument("--device", choices=("cuda", "cpu"), required=True)
    parser.add_argument("--threads", type=int, default=4)
    args = parser.parse_args(argv)
    if args.threads < 1:
        parser.error("--threads must be >= 1")
    return args


def main(argv=None):
    args = parse_args(argv)
    if sys.version_info[:2] != (3, 11):
        print(f"error: Python 3.11 is required, found {platform.python_version()}", file=sys.stderr)
        return 2
    os.environ["OMP_NUM_THREADS"] = str(args.threads)
    os.environ["MKL_NUM_THREADS"] = str(args.threads)

    checkpoints = args.checkpoints.resolve()
    out = args.out.resolve()
    scrub = Scrubber()
    scrub.add(checkpoints, "<checkpoints>")
    scrub.add(out, "<out>")
    scrub.add(WORK_DIR, "<work>")
    scrub.add(Path.home(), "<home>")

    try:
        ensure_new_out(out)
        jobs_doc, jobs = load_jobs(args.jobs.resolve())
        check_checkpoints(checkpoints)
        source_check = verify_sources(scrub)
    except (RunnerError, OSError, ValueError, KeyError, ImportError) as exc:
        print(f"error: {scrub(str(exc))}", file=sys.stderr)
        return 2

    out.mkdir(parents=True, exist_ok=True)
    (out / "audio").mkdir()
    progress = Progress(out, args.device, args.threads)
    try:
        return run(args, checkpoints, out, jobs_doc, jobs, source_check, progress)
    except BaseException as exc:
        interrupted = isinstance(exc, KeyboardInterrupt)
        progress.doc["status"] = "interrupted" if interrupted else "failed"
        progress.doc["error"] = {"stage": progress.doc["stage"], "type": type(exc).__name__, "message": scrub(str(exc))}
        for state in progress.doc["jobs"].values():
            if state["status"] == "running":
                state["status"] = "failed"
        progress.save()
        traceback.print_exc()  # console only; may contain private paths and is not written to --out
        print(f"[failed] stage={progress.doc['error']['stage']}; completed files were kept in --out", file=sys.stderr)
        if interrupted:
            raise
        return 1


if __name__ == "__main__":
    sys.exit(main())
