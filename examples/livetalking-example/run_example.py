#!/usr/bin/env python3
"""Studio Yebisu / livetalking-example: offline capture of the original LiveTalking
MuseReal + WhisperASR + BaseAvatar render loop (lipku/LiveTalking@eaa2b91).

Authored by the actor, executed separately by the operator. The upstream source is
imported unchanged (hash-verified first). Nothing in torch, transformers, diffusers or
LiveTalking is monkeypatched, stubbed or replaced:

  * models: original load_all_model(explicit absolute paths, device=cpu) -> float32
    VAE / U-Net / PositionalEncoding, original Audio2Feature(whisper dir), timesteps [0].
    The convenience load_model() is not used because it casts everything to half.
  * avatar: one real original layout under <private>/workdir/data/avatars/mona built
    from the protected full canvas, the manual 320 mask, the manual box and one latent
    from original VAE.get_latents_for_unet (sampled once under seed 20261020, reused).
  * per job: fresh original MuseReal via registry.create("avatar", "musetalk"),
    original put_audio_file, original render -> WhisperASR.run_step -> inference ->
    process_frames -> paste_back_frame -> watermark -> WebRTCOutput push calls.
  * WebRTCOutput is the original object; its _player is DiskCaptureAdapter, an offline
    capture adapter that writes the emitted frames/audio to disk. No RTCPeerConnection,
    server, listener or network stream exists. EdgeTTS is constructed by the original
    BaseAvatar and idles; no message is ever submitted to it.

Usage (placeholders; the operator supplies real paths and an offline environment):
  python run_example.py --upstream <livetalking-source> --weights <models-root> \
      --jobs inputs/jobs.json --prepared inputs/prepared \
      --output <public-attempt-dir> --private <private-attempt-dir>
"""

from __future__ import annotations

import argparse
import getpass
import hashlib
import importlib
import io
import json
import logging
import os
import pickle
import platform
import shutil
import subprocess
import sys
import threading
import time
import traceback
import uuid
import wave
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

SOURCE_REPOSITORY = "lipku/LiveTalking"
SOURCE_COMMIT = "eaa2b91559a5c2ed6127e17728efd52b7c407a0d"

# sha256 of the official raw blobs at SOURCE_COMMIT that this run imports or cites.
UPSTREAM_REQUIRED = {
    "LICENSE": "6b934ce628eac39c44f6401b52efc0884db51c937777f1122f0b56648813f0b6",
    "README.md": "e3ab1f2b277caa648864fa310da9ff70a57285b457b51fc83f928c43cecd561d",
    "registry.py": "2f5450833e245b9a90478a2aea2a51af7301210bfaeacc74f41a41af061517c2",
    "avatars/__init__.py": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "avatars/base_avatar.py": "f1e6538fe3c9f16f402cd69f83e3774ea3dfa74d95050d08fb2884acbea435dc",
    "avatars/musetalk_avatar.py": "f0ffbb3975e1fa92cd1aab6ee035bfbb3381cc6aa52d0bdd89166309493a8bd5",
    "avatars/audio_features/__init__.py": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "avatars/audio_features/base_asr.py": "0885ec975d63d1cacbf7e6e712918095adfc7b7d0d438b847ad69f0e4a62307c",
    "avatars/audio_features/whisper.py": "ec3901b8ac5d9d57cdd6a263cd755ebff92c2bafef5cf2a64eb2a432148506d4",
    "avatars/musetalk/models/vae.py": "36117cb453b3dfaf8e356e0cef576cd5ef2663bf06246e5f95ddf17374e1a978",
    "avatars/musetalk/models/unet.py": "05d5dadfde2e726b61d8387a4876336d4dcacc696636e8dcfec69863ce819256",
    "avatars/musetalk/utils/utils.py": "13b916d6d23d49144fd6b62b335225394831ea91608277a08391caffbbed1806",
    "avatars/musetalk/whisper/audio2feature.py": "dd3cb43c9ac7a8400ef6b3c9c0d450f5bbd4e548d175ea78038466d0336d2419",
    "avatars/musetalk/myutil.py": "57dc3f4e744244a096c875b043f2808aa2045e2a3771c26de90b124d61cd09fe",
    "utils/logger.py": "d9b574b63a323539e514d526f678cb59379ad4b389e1365f9abff72089d7b5b1",
    "utils/image.py": "c4c6a21154cce743728e5af116f2c30b35107bc430731a62fc5dec163b83d239",
    "utils/device.py": "05c5178b4a816f95a0cac80e4d96ea44edc633a85aae15c7b35969500f585494",
    "streamout/__init__.py": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "streamout/base_output.py": "29b040a23d97ca9f94d78e0e74d288e3b2a4209fda4ba0c4c56793b03eb8cc9f",
    "streamout/webrtc.py": "ed725cdd798437e3adac7e727bb01e3bec2f8c9f505319b10e2cc5f1f13a419d",
    "tts/__init__.py": "be18d323c9645e39609e258544bf1f4f53ac01bafe8be507d1dba5766e3f77af",
    "tts/base_tts.py": "ceedfed5f503fff315a38fa27222a6cf7c5e3368f25788975bb3efa7da001b11",
    "tts/edge.py": "9292124e794aaffb151582f1917bc31e04676e907ed8b342b18ec2439f27fd5e",
}
# Present in the full checkout but not in the selected vendor subset; verified when present.
UPSTREAM_OPTIONAL = {
    "avatars/musetalk/utils/__init__.py": "ccd6f1e5ebcc92d26d7322a565c120d93aeda34c6ccba5e9aaa6f1138d7d91fb",
}
UPSTREAM_MODULES = (
    "registry",
    "utils.logger",
    "utils.image",
    "utils.device",
    "avatars.base_avatar",
    "avatars.audio_features.base_asr",
    "avatars.audio_features.whisper",
    "avatars.musetalk.models.vae",
    "avatars.musetalk.models.unet",
    "avatars.musetalk.utils.utils",
    "avatars.musetalk.whisper.audio2feature",
    "avatars.musetalk.myutil",
    "avatars.musetalk_avatar",
    "streamout.base_output",
    "streamout.webrtc",
    "tts.base_tts",
    "tts.edge",
)

# Fixed public ungated weights (runtime/model-pin.json). Small files: git blob sha1; LFS: sha256.
WEIGHT_FILES = (
    ("musetalkV15/README.md", "TMElyralab/MuseTalk", "2bcb936e2fddb4d86db4c62fd45b387d0c061571", "mit", 11127,
     "9eb8d3b4b6b23938e13c4d637be28e596c89a83f", None),
    ("musetalkV15/LICENSE.txt", "TMElyralab/MuseTalk", "2bcb936e2fddb4d86db4c62fd45b387d0c061571", "mit", 13427,
     "132bf6fc803b84b40fee6c2132907dfaa396dc3b", None),
    ("musetalkV15/musetalk.json", "TMElyralab/MuseTalk", "2bcb936e2fddb4d86db4c62fd45b387d0c061571", "mit", 748,
     "b822db87e503a283fbbee73617f89dcd294cb91c", None),
    ("musetalkV15/unet.pth", "TMElyralab/MuseTalk", "2bcb936e2fddb4d86db4c62fd45b387d0c061571", "mit", 3400074924,
     "ad33c410815bf12300e8cac58b10255df3e61d88", "7ebf6c98c181e20838e4c0054e96e944ac60d5d692cc01db42839fe11b787007"),
    ("sd-vae/README.md", "stabilityai/sd-vae-ft-mse", "31f26fdeee1355a5c34592e401dd41e45d25a493", "mit", 6844,
     "61d3c7cf571c574a406544612b857ac1b26f4439", None),
    ("sd-vae/config.json", "stabilityai/sd-vae-ft-mse", "31f26fdeee1355a5c34592e401dd41e45d25a493", "mit", 547,
     "0db26717579be63eb0ddbf15b43faa43700dfe5a", None),
    ("sd-vae/diffusion_pytorch_model.safetensors", "stabilityai/sd-vae-ft-mse", "31f26fdeee1355a5c34592e401dd41e45d25a493",
     "mit", 334643276, "90464d67ac7303d0ee4696334df13da130a948ea",
     "a1d993488569e928462932c8c38a0760b874d166399b14414135bd9c42df5815"),
    ("whisper/README.md", "openai/whisper-tiny", "169d4a4341b33bc18d8881c4b69c2e104e1cc0af", "apache-2.0", 19787,
     "0ebbf1f524ea117e0fd826f593cde4be3897f70f", None),
    ("whisper/config.json", "openai/whisper-tiny", "169d4a4341b33bc18d8881c4b69c2e104e1cc0af", "apache-2.0", 1983,
     "417aa9de49a132dd3eb6a56d3be2718b15f08917", None),
    ("whisper/preprocessor_config.json", "openai/whisper-tiny", "169d4a4341b33bc18d8881c4b69c2e104e1cc0af", "apache-2.0",
     184990, "c2048dfa9fd94a052e62e908d2c4dfb18534b4d2", None),
    ("whisper/model.safetensors", "openai/whisper-tiny", "169d4a4341b33bc18d8881c4b69c2e104e1cc0af", "apache-2.0",
     151061672, "fe42acd740b2c47cb34cf7b92426e3f82c1ce357",
     "7ebd0e69e78190ffe1438491fa05cc1f5c1aa3a4c4db3bc1723adbb551ea2395"),
)

PROTECTED_INPUTS = {
    "portrait.png": "15f01c4ad2bf8ae01a696c5c3da39ecbd2ac68a8f563e0d46a44c122f30e359b",
    "default.wav": "b750fdbc8e1a609954a5d7f0d5bd072ec3fa9116c1f91cf7fa8b19053b2fba52",
    "second.wav": "80fd37b2eefd398d2e9c88ac812bc74b7028715fb26b5fd568eef3b24b363cdd",
}
JOB_IDS = ["default", "second"]
FIXED_RUNTIME = {
    "device": "cpu",
    "dtype": "float32",
    "intra_op_threads": 4,
    "inter_op_threads": 4,
    "seed": 20261020,
    "fps": 25,
    "batch_size": 4,
    "l": 10,
    "r": 10,
}
AVATAR_ID = "mona"
BBOX = [100, 40, 420, 360]
CANVAS_SHAPE = (512, 512, 3)
FACE_SIZE = 256
MASK_SIZE = 320
CHUNK_SAMPLES = 320
SAMPLE_RATE = 16000
TAG_KEY = "yebisu_capture_job"

EXPECTED_PYTHON = "3.11.15"
EXPECTED_PACKAGES = {
    "torch": ("exact", "2.6.0+cpu"),
    "torchvision": ("prefix", "0.21."),
    "diffusers": ("exact", "0.33.1"),
    "transformers": ("prefix", "4.50."),
    "accelerate": ("prefix", "1.6."),
    "numpy": ("exact", "1.26.4"),
    "Pillow": ("prefix", "11.3."),
    "soundfile": ("exact", "0.13.1"),
    "resampy": ("exact", "0.4.3"),
    "av": ("exact", "16.0.1"),
}
OPENCV_PREFIX = "4.10."
IMPORTED_BY_ORIGINAL = {"edge_tts": "edge-tts", "tqdm": "tqdm", "einops": "einops"}
OFFLINE_ENV = {
    "HF_HUB_OFFLINE": "1",
    "TRANSFORMERS_OFFLINE": "1",
    "HF_DATASETS_OFFLINE": "1",
    "HF_HUB_DISABLE_TELEMETRY": "1",
}
THREAD_ENV = {"OMP_NUM_THREADS": "4", "MKL_NUM_THREADS": "4"}

NOT_CLAIMED = [
    "lip-sync accuracy, naturalness or identity fidelity",
    "real-time performance or any benchmark; one CPU float32 run, timings are observations only",
    "human listening, aesthetic or editorial approval",
    "behaviour on any other input",
    "WebRTC streaming or network delivery; frames were captured offline from the original output push calls",
    "that saving an MP4/WAV is evidence of synchrony",
]

# Third-party modules are imported only after the environment check.
np = None
cv2 = None
sf = None
torch = None


class RunnerError(RuntimeError):
    pass


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path, block: int = 8 << 20) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(block), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_blob_sha1(path: Path, block: int = 8 << 20) -> str:
    digest = hashlib.sha1(b"blob %d\0" % path.stat().st_size)
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(block), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_record(path: Path, name: str | None = None) -> dict:
    return {"file": name or path.name, "sha256": sha256_file(path), "bytes": path.stat().st_size}


# --------------------------------------------------------------------------- logging

class Sanitizer:
    """Replaces absolute roots and the account name in anything that becomes public."""

    def __init__(self) -> None:
        self.pairs: list[tuple[str, str]] = []

    def add(self, raw, placeholder: str) -> None:
        if not raw:
            return
        raw = str(raw)
        variants = {raw, raw.replace("\\", "/"), raw.replace("/", "\\")}
        variants |= {v.lower() for v in list(variants)}
        for variant in variants:
            if len(variant) >= 3:
                self.pairs.append((variant, placeholder))
        self.pairs.sort(key=lambda pair: -len(pair[0]))

    def text(self, value: str) -> str:
        for raw, placeholder in self.pairs:
            value = value.replace(raw, placeholder)
        return value

    def obj(self, value):
        if isinstance(value, str):
            return self.text(value)
        if isinstance(value, dict):
            return {self.text(str(k)): self.obj(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [self.obj(v) for v in value]
        return value


class RunLog:
    def __init__(self, private_path: Path, sanitizer: Sanitizer) -> None:
        self.fh = open(private_path, "a", encoding="utf-8", buffering=1)
        self.sanitizer = sanitizer
        self.public: list[str] = []

    def __call__(self, message: str) -> None:
        line = f"{utc_now()} {message}"
        self.fh.write(line + "\n")
        clean = self.sanitizer.text(line)
        self.public.append(clean)
        print(clean, flush=True)

    def write_public(self, path: Path) -> None:
        path.write_text("\n".join(self.public) + "\n", encoding="utf-8")


def run_command(ctx, cmd: list[str], label: str) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    with open(ctx.private / "commands.log", "a", encoding="utf-8") as fh:
        fh.write(f"## {utc_now()} {label}\n$ {subprocess.list2cmdline(cmd)}\nexit={proc.returncode}\n"
                 f"--- stdout\n{proc.stdout}\n--- stderr\n{proc.stderr}\n\n")
    return proc


class UpstreamLogCounter(logging.Handler):
    """Counts records of the original LiveTalking logger (e.g. paste_back_frame warnings)."""

    def __init__(self, recorder) -> None:
        super().__init__(level=logging.DEBUG)
        self.recorder = recorder
        self.counts: dict[str, int] = {}
        self.warnings: list[dict] = []
        self._lock_counts = threading.Lock()

    def emit(self, record: logging.LogRecord) -> None:
        try:
            message = record.getMessage()
        except Exception:
            message = str(record.msg)
        with self._lock_counts:
            self.counts[record.levelname] = self.counts.get(record.levelname, 0) + 1
            if record.levelno >= logging.WARNING:
                self.warnings.append({"level": record.levelname, "phase": self.recorder.phase,
                                      "thread": record.threadName, "message": message[:500]})

    def paste_back_errors(self) -> int:
        with self._lock_counts:
            return sum(1 for w in self.warnings if w["message"].startswith("paste_back_frame error"))


# --------------------------------------------------------------------------- hooks

def describe(value):
    if torch is not None and isinstance(value, torch.Tensor):
        return {"shape": list(value.shape), "dtype": str(value.dtype).replace("torch.", "")}
    if value is None:
        return None
    if isinstance(value, dict):
        return {str(k): describe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        items = [describe(v) for v in value[:8]]
        if len(value) > 8:
            items.append({"more_items": len(value) - 8})
        return items
    if isinstance(value, (bool, int, float)):
        return value
    return type(value).__name__


def iter_tensors(value):
    if isinstance(value, torch.Tensor):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from iter_tensors(v)
    elif isinstance(value, (list, tuple)):
        for v in value:
            yield from iter_tensors(v)


class ForwardCallRecorder:
    """Non-mutating forward pre/post hooks: record call order, thread, shapes and wall time.

    Hooks return None, so module inputs and outputs are untouched. No activations are kept.
    """

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.handles: list = []
        self.phase = "setup"
        self._lock = threading.Lock()
        self._local = threading.local()

    def attach(self, name: str, module) -> None:
        self.handles.append(module.register_forward_pre_hook(self._pre(name), with_kwargs=True))
        self.handles.append(module.register_forward_hook(self._post(name), with_kwargs=True))

    def detach(self) -> None:
        for handle in self.handles:
            handle.remove()
        self.handles.clear()

    def _pre(self, name: str):
        def hook(module, args, kwargs):
            starts = self._local.__dict__.setdefault("starts", {})
            starts.setdefault(name, []).append(
                (time.perf_counter_ns(), describe(list(args)), describe(dict(kwargs)), torch.is_grad_enabled()))
            return None
        return hook

    def _post(self, name: str):
        def hook(module, args, kwargs, output):
            end_ns = time.perf_counter_ns()
            stack = self._local.__dict__.get("starts", {}).get(name) or [(None, None, None, None)]
            start_ns, in_args, in_kwargs, grad_mode = stack.pop()
            tensors = list(iter_tensors(output))
            record = {
                "phase": self.phase,
                "module": name,
                "thread": threading.current_thread().name,
                "start_ns": start_ns,
                "end_ns": end_ns,
                "duration_ms": None if start_ns is None else round((end_ns - start_ns) / 1e6, 3),
                "inputs": {"args": in_args, "kwargs": in_kwargs},
                "output": describe(output),
                "grad_mode_enabled_in_thread": grad_mode,
                "output_requires_grad": any(t.requires_grad for t in tensors),
                "output_all_finite": all(bool(torch.isfinite(t).all()) for t in tensors),
            }
            with self._lock:
                record["seq"] = len(self.calls)
                self.calls.append(record)
            return None
        return hook

    @staticmethod
    def window(call: dict, markers: dict) -> str:
        if not call["phase"].startswith("job:"):
            return "outside_job"
        mark = markers.get(call["phase"].split(":", 1)[1], {})
        start = call["start_ns"] or call["end_ns"]
        if mark.get("target_reached_ns") is None or start < mark["target_reached_ns"]:
            return "started_before_capture_target_reached"
        if mark.get("quit_set_ns") is None or start < mark["quit_set_ns"]:
            return "started_after_target_before_quit_signal"
        return "started_after_quit_signal"

    def summary(self, markers: dict) -> dict:
        with self._lock:
            calls = list(self.calls)
        groups: dict[tuple, dict] = {}
        compact = []
        for call in calls:
            window = self.window(call, markers)
            key = (call["phase"], call["module"])
            group = groups.setdefault(key, {
                "phase": call["phase"], "module": call["module"], "calls": 0, "total_ms": 0.0,
                "min_ms": None, "max_ms": None, "windows": {}, "threads": [],
                "input_signatures": [], "output_signatures": [],
                "any_output_requires_grad": False, "all_outputs_finite": True,
            })
            group["calls"] += 1
            if call["duration_ms"] is not None:
                group["total_ms"] = round(group["total_ms"] + call["duration_ms"], 3)
                group["min_ms"] = call["duration_ms"] if group["min_ms"] is None else min(group["min_ms"], call["duration_ms"])
                group["max_ms"] = call["duration_ms"] if group["max_ms"] is None else max(group["max_ms"], call["duration_ms"])
            group["windows"][window] = group["windows"].get(window, 0) + 1
            if call["thread"] not in group["threads"]:
                group["threads"].append(call["thread"])
            for field, sig in (("input_signatures", call["inputs"]), ("output_signatures", call["output"])):
                if sig not in group[field]:
                    group[field].append(sig)
            group["any_output_requires_grad"] |= call["output_requires_grad"]
            group["all_outputs_finite"] &= call["output_all_finite"]
            compact.append({"seq": call["seq"], "phase": call["phase"], "module": call["module"],
                            "thread": call["thread"], "window": window, "duration_ms": call["duration_ms"],
                            "grad_mode_enabled_in_thread": call["grad_mode_enabled_in_thread"]})
        for group in groups.values():
            group["mean_ms"] = round(group["total_ms"] / group["calls"], 3) if group["calls"] else None
        return {"groups": list(groups.values()), "calls": compact}


# --------------------------------------------------------------------------- capture adapter

class DiskCaptureAdapter:
    """Offline capture adapter assigned to the original WebRTCOutput._player.

    The original process_frames pushes one full BGR frame and then its two int16 audio
    chunks; WebRTCOutput forwards them here. This adapter writes those exact frames as
    PNG and keeps the exact audio arrays. It is not a model, does not modify pixels or
    samples, and does not stream anything over WebRTC. get_buffer_size() returns 0
    because writes are synchronous, so the original render loop is never throttled.
    """

    def __init__(self, frames_dir: Path, target_frames: int, tag_value: str, frame_shape: tuple) -> None:
        self.frames_dir = frames_dir
        self.target_frames = target_frames
        self.tag_value = tag_value
        self.frame_shape = frame_shape
        self.video_pushes = 0
        self.audio_pushes = 0
        self.frames: list[dict] = []
        self.chunks: list[dict] = []
        self.audio: list = []
        self.beyond_frames: list[dict] = []
        self.beyond_chunks: list[dict] = []
        self.order_violations = 0
        self.error: str | None = None
        self.target_reached_ns: int | None = None
        self.target_event = threading.Event()
        self._lock = threading.Lock()

    def _fail(self, exc: BaseException) -> None:
        if self.error is None:
            self.error = f"{type(exc).__name__}: {exc}"

    def push_video(self, frame) -> None:
        try:
            with self._lock:
                index = self.video_pushes
                if self.audio_pushes != 2 * index:
                    self.order_violations += 1
                self.video_pushes += 1
                array = np.ascontiguousarray(frame)
                if array.dtype != np.uint8 or array.shape != self.frame_shape:
                    raise ValueError(f"unexpected frame {array.dtype} {array.shape}")
                record = {"index": index, "raw_sha256": sha256_bytes(array.tobytes()),
                          "pushed_ns": time.perf_counter_ns()}
                if index < self.target_frames:
                    if not cv2.imwrite(str(self.frames_dir / f"{index:06d}.png"), array):
                        raise OSError(f"could not write frame {index}")
                    self.frames.append(record)
                else:
                    self.beyond_frames.append(record)
        except BaseException as exc:
            self._fail(exc)
            raise

    def push_audio(self, frame, eventpoint=None) -> None:
        try:
            with self._lock:
                index = self.audio_pushes
                if self.video_pushes != index // 2 + 1:
                    self.order_violations += 1
                self.audio_pushes += 1
                array = np.array(frame, copy=True)
                if array.dtype != np.int16 or array.shape != (CHUNK_SAMPLES,):
                    raise ValueError(f"unexpected audio chunk {array.dtype} {array.shape}")
                info = eventpoint if isinstance(eventpoint, dict) else {}
                record = {"index": index, "tagged": info.get(TAG_KEY) == self.tag_value,
                          "status": info.get("status"), "all_zero": not bool(array.any()),
                          "pushed_ns": time.perf_counter_ns()}
                if index < 2 * self.target_frames:
                    self.audio.append(array)
                    self.chunks.append(record)
                    if index == 2 * self.target_frames - 1 and self.video_pushes >= self.target_frames:
                        self.target_reached_ns = record["pushed_ns"]
                        self.target_event.set()
                else:
                    self.beyond_chunks.append(record)
        except BaseException as exc:
            self._fail(exc)
            raise

    def get_buffer_size(self) -> int:
        return 0

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "video_pushes_total": self.video_pushes,
                "audio_pushes_total": self.audio_pushes,
                "captured_frames": len(self.frames),
                "captured_audio_chunks": len(self.chunks),
                "frames_pushed_beyond_target": len(self.beyond_frames),
                "audio_chunks_pushed_beyond_target": len(self.beyond_chunks),
                "tagged_chunks_beyond_target": sum(1 for c in self.beyond_chunks if c["tagged"]),
                "order_violations": self.order_violations,
                "adapter_error": self.error,
            }


# --------------------------------------------------------------------------- checks

def require_empty_dir(path: Path, label: str) -> None:
    if path.exists():
        if not path.is_dir() or any(path.iterdir()):
            raise SystemExit(f"run_example: refusing: {label} attempt directory exists and is not empty")
    else:
        path.mkdir(parents=True)


def check_environment(ctx) -> tuple[dict, list[str]]:
    import importlib.metadata as md
    import importlib.util

    problems: list[str] = []
    info = {
        "python": platform.python_version(),
        "implementation": platform.python_implementation(),
        "platform": platform.platform(),
        "packages": {},
        "imported_by_original_source": {},
    }
    if info["python"] != EXPECTED_PYTHON:
        problems.append(f"python {info['python']} != {EXPECTED_PYTHON}")
    for dist, (mode, want) in EXPECTED_PACKAGES.items():
        try:
            have = md.version(dist)
        except md.PackageNotFoundError:
            have = None
        info["packages"][dist] = have
        if have is None or not (have == want if mode == "exact" else have.startswith(want)):
            problems.append(f"{dist} {have!r} does not satisfy {mode} {want!r}")
    try:
        import cv2 as _cv2
        cv_version = _cv2.__version__
    except Exception:
        cv_version = None
    info["packages"]["opencv (cv2.__version__)"] = cv_version
    if not cv_version or not cv_version.startswith(OPENCV_PREFIX):
        problems.append(f"opencv {cv_version!r} does not satisfy prefix {OPENCV_PREFIX!r}")
    for module, dist in IMPORTED_BY_ORIGINAL.items():
        try:
            version = md.version(dist)
        except md.PackageNotFoundError:
            version = None
        found = importlib.util.find_spec(module) is not None
        info["imported_by_original_source"][module] = {"found": found, "version": version}
        if not found:
            problems.append(f"module {module} (imported by the original source) is not installed")
    for tool in ("ffmpeg", "ffprobe"):
        located = shutil.which(tool)
        if not located:
            problems.append(f"{tool} not found on PATH")
            continue
        ctx.tools[tool] = located
        ctx.sanitizer.add(str(Path(located).parent), f"<{tool}-dir>")
        proc = run_command(ctx, [located, "-version"], f"{tool} -version")
        first = proc.stdout.splitlines()[0] if proc.stdout else ""
        info[f"{tool}_version"] = first
        if proc.returncode != 0:
            problems.append(f"{tool} -version failed")
    info["offline_env"] = {k: os.environ.get(k) for k in OFFLINE_ENV}
    info["thread_env"] = {k: os.environ.get(k) for k in THREAD_ENV}
    info["cpu_count"] = os.cpu_count()
    if hasattr(os, "sched_getaffinity"):
        info["process_affinity_cpus"] = len(os.sched_getaffinity(0))
    else:
        info["process_affinity_cpus"] = "not observable by the runner on this platform; set by the operator"
    return info, problems


def verify_upstream(upstream: Path) -> dict:
    problems, files, optional = [], {}, {}
    for rel, expected in UPSTREAM_REQUIRED.items():
        path = upstream / rel
        if not path.is_file():
            problems.append(f"missing {rel}")
            continue
        files[rel] = sha256_file(path)
        if files[rel] != expected:
            problems.append(f"sha256 mismatch {rel}")
    for rel, expected in UPSTREAM_OPTIONAL.items():
        path = upstream / rel
        if path.is_file():
            optional[rel] = sha256_file(path)
            if optional[rel] != expected:
                problems.append(f"sha256 mismatch {rel}")
    if problems:
        raise RunnerError("upstream source check failed: " + "; ".join(problems))
    return {
        "repository": SOURCE_REPOSITORY,
        "commit": SOURCE_COMMIT,
        "license": "Apache-2.0 (LICENSE verified)",
        "layout": "full checkout" if (upstream / "app.py").is_file() else "selected official subset",
        "verified_files_sha256": files,
        "optional_files_present_and_verified": optional,
        "source_modified": False,
        "bytecode_written": False,
    }


def load_jobs(ctx) -> dict:
    spec = json.loads(ctx.jobs_path.read_text(encoding="utf-8"))
    if spec.get("runtime") != FIXED_RUNTIME:
        raise RunnerError("jobs.json runtime differs from the fixed CPU float32 configuration")
    if [job.get("id") for job in spec.get("jobs", [])] != JOB_IDS:
        raise RunnerError("jobs.json must list exactly the jobs default and second")
    avatar = spec.get("avatar", {})
    if avatar.get("avatar_id") != AVATAR_ID or avatar.get("bbox_xyxy") != BBOX:
        raise RunnerError("jobs.json avatar id/box differs from the declared manual preparation")
    if (ctx.jobs_dir / avatar.get("prepared_dir", "")).resolve() != ctx.prepared:
        raise RunnerError("--prepared differs from jobs.json avatar.prepared_dir")
    return spec


def verify_inputs(ctx, spec: dict) -> dict:
    avatar = spec["avatar"]
    portrait = ctx.jobs_dir / avatar["full_image"]
    record = {"portrait": file_record(portrait)}
    if record["portrait"]["sha256"] != PROTECTED_INPUTS["portrait.png"] or avatar["full_image_sha256"] != PROTECTED_INPUTS["portrait.png"]:
        raise RunnerError("protected portrait hash mismatch")
    ctx.portrait_path = portrait
    ctx.portrait_bgr = cv2.imread(str(portrait), cv2.IMREAD_COLOR)
    if ctx.portrait_bgr is None or ctx.portrait_bgr.shape != CANVAS_SHAPE:
        raise RunnerError("protected portrait is not a 512x512 three-channel image")
    record["portrait"].update({"height": 512, "width": 512, "channels": 3,
                               "provenance": avatar.get("full_image_note")})
    record["audio"] = {}
    for job in spec["jobs"]:
        path = ctx.jobs_dir / job["audio"]
        rec = file_record(path)
        expected = PROTECTED_INPUTS.get(job["audio"])
        if rec["sha256"] != expected or job["audio_sha256"] != expected:
            raise RunnerError(f"protected audio hash mismatch for {job['id']}")
        info = sf.info(str(path))
        rec["native"] = {"sample_rate": info.samplerate, "channels": info.channels, "frames": info.frames,
                         "subtype": info.subtype, "duration_s": round(info.frames / info.samplerate, 6)}
        declared = job["declared"]
        if (info.samplerate, info.channels, info.subtype) != (declared["sample_rate"], declared["channels"], declared["subtype"]):
            raise RunnerError(f"audio format of {job['id']} differs from jobs.json")
        rec["declared_duration_s"] = declared["duration_s"]
        record["audio"][job["id"]] = rec
    return record


def expected_mask():
    ramp = np.rint(np.linspace(0.0, 255.0, 12)).astype(np.uint8)
    gray = np.zeros((MASK_SIZE, MASK_SIZE), dtype=np.uint8)
    gray[160:172, :] = ramp[:, None]
    gray[172:, :] = 255
    return np.repeat(gray[:, :, None], 3, axis=2)


def verify_prepared(ctx) -> dict:
    prep_path = ctx.prepared / "preparation.json"
    prep = json.loads(prep_path.read_text(encoding="utf-8"))
    if prep["source"]["sha256"] != PROTECTED_INPUTS["portrait.png"] or prep["bbox_xyxy"] != BBOX:
        raise RunnerError("preparation.json does not describe the protected portrait and manual box")
    face_path = ctx.prepared / prep["crop"]["output"]["file"]
    mask_path = ctx.prepared / prep["mask"]["output"]["file"]
    for path, declared in ((face_path, prep["crop"]["output"]), (mask_path, prep["mask"]["output"])):
        if sha256_file(path) != declared["sha256"]:
            raise RunnerError(f"{path.name} differs from preparation.json")
    face = cv2.imread(str(face_path), cv2.IMREAD_COLOR)
    mask = cv2.imread(str(mask_path), cv2.IMREAD_COLOR)
    x1, y1, x2, y2 = BBOX
    rederived = cv2.resize(ctx.portrait_bgr[y1:y2, x1:x2], (FACE_SIZE, FACE_SIZE), interpolation=cv2.INTER_LANCZOS4)
    if face is None or face.shape != (FACE_SIZE, FACE_SIZE, 3) or not np.array_equal(face, rederived):
        raise RunnerError("face256.png is not the declared manual crop + INTER_LANCZOS4 resize")
    if mask is None or not np.array_equal(mask, expected_mask()):
        raise RunnerError("mask320.png is not the declared manual lower-half mask")
    ctx.face_path, ctx.mask_path = face_path, mask_path
    ctx.face_bgr, ctx.mask_bgr = face, mask
    return {
        "preparation_json": file_record(prep_path),
        "face256": file_record(face_path),
        "mask320": file_record(mask_path),
        "diagnostic_upper_half_masked": prep.get("diagnostics", {}).get("upper_half_masked_face", {}).get("output"),
        "bbox_xyxy": BBOX,
        "mask_rule": prep["mask"]["rule"],
        "face256_matches_rederivation_from_canvas": True,
        "mask320_matches_declared_rule": True,
        "method": "manual box + OpenCV INTER_LANCZOS4 resize + declared mask; no detector, landmarks or face parsing",
    }


def verify_weights(ctx) -> list[dict]:
    records, problems = [], []
    for local, repo, revision, license_id, size, blob, lfs_sha in WEIGHT_FILES:
        path = ctx.weights / local
        rec = {"local": local, "repository": repo, "revision": revision, "license": license_id, "bytes": size}
        if not path.is_file() or path.stat().st_size != size:
            problems.append(f"missing or wrong size {local}")
            records.append(rec)
            continue
        if lfs_sha:
            rec["sha256"] = sha256_file(path)
            rec["check"] = "lfs sha256"
            if rec["sha256"] != lfs_sha:
                problems.append(f"sha256 mismatch {local}")
        else:
            rec["git_blob_sha1"] = git_blob_sha1(path)
            rec["sha256"] = sha256_file(path)
            rec["check"] = "git blob sha1"
            if rec["git_blob_sha1"] != blob:
                problems.append(f"git blob mismatch {local}")
        records.append(rec)
    if problems:
        raise RunnerError("weight check failed: " + "; ".join(problems))
    return records


# --------------------------------------------------------------------------- original pipeline

def setup_torch() -> dict:
    global torch
    import torch as _torch
    torch = _torch
    torch.set_num_threads(FIXED_RUNTIME["intra_op_threads"])
    try:
        torch.set_num_interop_threads(FIXED_RUNTIME["inter_op_threads"])
    except RuntimeError as exc:
        raise RunnerError(f"could not set inter-op threads before work: {exc}") from exc
    cuda = torch.cuda.is_available()
    mps = bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available())
    if cuda or mps:
        raise RunnerError("a GPU backend is visible; the original device selection would leave CPU")
    torch.set_grad_enabled(False)
    return {
        "torch_version": torch.__version__,
        "num_threads": torch.get_num_threads(),
        "num_interop_threads": torch.get_num_interop_threads(),
        "cuda_available": cuda,
        "mps_available": mps,
        "main_thread_grad_enabled": torch.is_grad_enabled(),
    }


def build_avatar_layout(ctx) -> dict:
    avatar_dir = ctx.workdir / "data" / "avatars" / AVATAR_ID
    (avatar_dir / "full_imgs").mkdir(parents=True)
    (avatar_dir / "mask").mkdir()
    shutil.copyfile(ctx.portrait_path, avatar_dir / "full_imgs" / "0.png")
    shutil.copyfile(ctx.mask_path, avatar_dir / "mask" / "0.png")
    with open(avatar_dir / "coords.pkl", "wb") as fh:
        pickle.dump([list(BBOX)], fh)
    with open(avatar_dir / "mask_coords.pkl", "wb") as fh:
        pickle.dump([list(BBOX)], fh)
    if sha256_file(avatar_dir / "full_imgs" / "0.png") != PROTECTED_INPUTS["portrait.png"]:
        raise RunnerError("private full_imgs/0.png is not the protected portrait")
    ctx.avatar_dir = avatar_dir
    return {
        "location": "<private>/workdir/data/avatars/mona (private, trusted own creation)",
        "full_imgs/0.png": file_record(avatar_dir / "full_imgs" / "0.png", "full_imgs/0.png"),
        "mask/0.png": file_record(avatar_dir / "mask" / "0.png", "mask/0.png"),
        "coords.pkl": [list(BBOX)],
        "mask_coords.pkl": [list(BBOX)],
    }


def import_upstream(ctx) -> SimpleNamespace:
    os.chdir(ctx.workdir)  # original logger opens livetalking.log in cwd; load_avatar reads ./data
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(ctx.upstream))
    # Same order as app.py: registry/utils.logger and BaseAvatar first, the avatar module after.
    modules = {name: importlib.import_module(name) for name in UPSTREAM_MODULES}
    for name, module in modules.items():
        location = Path(getattr(module, "__file__", "") or "").resolve()
        try:
            location.relative_to(ctx.upstream)
        except ValueError:
            raise RunnerError(f"module {name} did not resolve inside the verified upstream tree") from None
    mt = modules["avatars.musetalk_avatar"]
    a2f = modules["avatars.musetalk.whisper.audio2feature"]
    if mt.device.type != "cpu" or a2f.device.type != "cpu" or a2f.weight_dtype != torch.float32:
        raise RunnerError("original module-level device/dtype selection is not CPU float32")
    return SimpleNamespace(
        registry=modules["registry"],
        logger=modules["utils.logger"].logger,
        mt=mt,
        mt_utils=modules["avatars.musetalk.utils.utils"],
        a2f=a2f,
    )


def module_info(module) -> dict:
    params = list(module.parameters())
    buffers = list(module.buffers())
    return {
        "class": type(module).__name__,
        "parameters": int(sum(p.numel() for p in params)),
        "parameter_dtypes": sorted({str(p.dtype) for p in params}),
        "buffer_dtypes": sorted({str(b.dtype) for b in buffers}),
        "devices": sorted({str(t.device) for t in params + buffers}),
        "training": module.training,
        "any_requires_grad": any(p.requires_grad for p in params),
    }


def load_models(ctx, up) -> tuple:
    weights = ctx.weights
    vae, unet, pe = up.mt.load_all_model(
        unet_model_path=str(weights / "musetalkV15" / "unet.pth"),
        vae_type=str(weights / "sd-vae"),
        unet_config=str(weights / "musetalkV15" / "musetalk.json"),
        device=torch.device("cpu"),
    )
    timesteps = torch.tensor([0], device=torch.device("cpu"))
    audio_processor = up.mt.Audio2Feature(model_path=str(weights / "whisper"))
    if Path(vae.model_path).resolve() != (weights / "sd-vae").resolve():
        raise RunnerError("original VAE did not resolve the explicit SD VAE directory")
    for module in (unet.model, vae.vae, audio_processor.whisper, pe):
        module.eval()
        module.requires_grad_(False)
    info = {
        "loader": "original load_all_model(unet_model_path=<weights>/musetalkV15/unet.pth, "
                  "unet_config=<weights>/musetalkV15/musetalk.json, vae_type=<weights>/sd-vae, device=cpu); "
                  "original Audio2Feature(model_path=<weights>/whisper); PositionalEncoding from the returned tuple; "
                  "timesteps tensor([0]) on CPU; load_model() (half cast) not used",
        "unet.model": module_info(unet.model),
        "vae.vae": module_info(vae.vae),
        "whisper": module_info(audio_processor.whisper),
        "positional_encoding": module_info(pe),
        "timesteps": {"values": timesteps.tolist(), "dtype": str(timesteps.dtype), "device": str(timesteps.device)},
        "vae_scaling_factor": float(vae.scaling_factor),
        "diffusion_sampler_loop": "none; original MuseTalk path is a single U-Net call at timestep 0",
        "app_level_warm_up": "original musetalk_avatar.warm_up(model) is an app.py startup step and is not invoked",
    }
    for key in ("unet.model", "vae.vae", "whisper", "positional_encoding"):
        if info[key]["devices"] != ["cpu"] or info[key]["training"] or info[key]["any_requires_grad"]:
            raise RunnerError(f"{key} is not CPU/eval/frozen")
        # PositionalEncoding has no parameters, only its float32 'pe' buffer.
        dtypes = set(info[key]["buffer_dtypes" if key == "positional_encoding" else "parameter_dtypes"])
        if dtypes != {"torch.float32"}:
            raise RunnerError(f"{key} is not float32: {sorted(dtypes)}")
    return (vae, unet, pe, timesteps, audio_processor), info


def prepare_latent(ctx, up, vae) -> tuple:
    up.mt_utils.seed_everything(FIXED_RUNTIME["seed"])
    ctx.recorder.phase = "latent_preparation"
    with torch.no_grad():
        latent = vae.get_latents_for_unet(ctx.face_bgr)
    ctx.recorder.phase = "setup"
    if tuple(latent.shape) != (1, 8, 32, 32) or latent.dtype != torch.float32 or not bool(torch.isfinite(latent).all()):
        raise RunnerError(f"unexpected latent {tuple(latent.shape)} {latent.dtype}")
    torch.save([latent], ctx.avatar_dir / "latents.pt")
    values = latent.detach().contiguous()
    return latent, {
        "source": "original VAE.get_latents_for_unet(prepared face256 as BGR ndarray), called once",
        "posterior": "VAE.encode_latents uses latent_dist.sample() for the upper-half-masked image, then the full image",
        "seed": FIXED_RUNTIME["seed"],
        "seed_call": "original seed_everything(20261020) once, immediately before this call",
        "shape": list(values.shape),
        "dtype": str(values.dtype),
        "tensor_sha256": sha256_bytes(values.numpy().tobytes()),
        "latents_pt": file_record(ctx.avatar_dir / "latents.pt", "latents.pt"),
        "stats": {"mean": float(values.mean()), "std": float(values.std()),
                  "min": float(values.min()), "max": float(values.max()), "all_finite": True},
        "reused_for_jobs": list(JOB_IDS),
        "stored": "private only",
    }


def label(chunk: dict) -> str:
    return "input" if chunk["tagged"] else "untagged"


def run_job(ctx, up, model_tuple, latent, job: dict, rec: dict) -> None:
    job_id = job["id"]
    batch, left, right = FIXED_RUNTIME["batch_size"], FIXED_RUNTIME["l"], FIXED_RUNTIME["r"]
    job_dir = ctx.private / job_id
    frames_dir = job_dir / "frames"
    frames_dir.mkdir(parents=True)
    audio_path = ctx.jobs_dir / job["audio"]
    errors_before = len(ctx.thread_errors)
    warnings_before = len(ctx.log_counter.warnings)
    markers = ctx.markers.setdefault(job_id, {})

    # Original avatar loader, fresh per job, so the in-place watermark of one job cannot reach the next.
    avatar = up.mt.load_avatar(AVATAR_ID)
    frame_list, mask_list, coord_list, mask_coord_list, latent_list = avatar
    checks = {
        "frames": len(frame_list), "masks": len(mask_list), "latents": len(latent_list),
        "frame0_equals_protected_portrait": bool(np.array_equal(frame_list[0], ctx.portrait_bgr)),
        "mask0_equals_manual_mask": bool(np.array_equal(mask_list[0], ctx.mask_bgr)),
        "coords": [list(c) for c in coord_list],
        "mask_coords": [list(c) for c in mask_coord_list],
        "latent_equals_shared_latent": bool(torch.equal(latent_list[0], latent)),
    }
    rec["avatar_load"] = checks
    if not (checks["frames"] == checks["masks"] == checks["latents"] == 1 and checks["frame0_equals_protected_portrait"]
            and checks["mask0_equals_manual_mask"] and checks["latent_equals_shared_latent"]
            and checks["coords"] == [BBOX] and checks["mask_coords"] == [BBOX]):
        raise RunnerError(f"original load_avatar returned unexpected data for {job_id}")

    opt = SimpleNamespace(fps=FIXED_RUNTIME["fps"], batch_size=batch, l=left, r=right,
                          sessionid=f"yebisu-{job_id}-{uuid.uuid4().hex[:12]}", customopt=[],
                          tts="edgetts", transport="webrtc", REF_FILE=None)
    rec["opt"] = dict(vars(opt))

    ctx.recorder.phase = f"job:{job_id}"
    real = up.registry.create("avatar", "musetalk", opt=opt, model=model_tuple, avatar=avatar)
    rec["constructed"] = {
        "avatar": type(real).__name__,
        "asr": type(real.asr).__name__,
        "tts": type(real.tts).__name__,
        "output": type(real.output).__name__,
        "output_player_before_adapter": None if real.output._player is None else type(real.output._player).__name__,
        "chunk_samples": real.chunk,
    }
    if (rec["constructed"]["avatar"], rec["constructed"]["output"], real.chunk) != ("MuseReal", "WebRTCOutput", CHUNK_SAMPLES):
        raise RunnerError("original constructor produced unexpected objects")
    rec["warm_up_observed"] = {
        "asr_output_queue_chunks": real.asr.output_queue.qsize(),
        "asr_output_queue_types": [int(f.type) for f in list(real.asr.output_queue.queue)],
        "asr_context_frames": len(real.asr.frames),
        "asr_input_queue": real.asr.queue.qsize(),
        "note": "BaseASR.warm_up drew l+r chunks from an empty queue (type 1 zero chunks) and removed l from output_queue",
    }

    # The original resampler itself measures the stream that put_audio_file will chunk.
    filebytes = audio_path.read_bytes()
    stream = real._BaseAvatar__create_bytes_stream(io.BytesIO(filebytes))
    samples = int(stream.shape[0])
    n_chunks = samples // CHUNK_SAMPLES
    tail = samples - n_chunks * CHUNK_SAMPLES
    expected = [(stream[k * CHUNK_SAMPLES:(k + 1) * CHUNK_SAMPLES] * 32767).astype(np.int16) for k in range(n_chunks)]
    per_batch = 2 * batch
    target = -(-(right + n_chunks) // per_batch) * batch
    rec["audio"] = {
        "file": job["audio"],
        "sha256": sha256_bytes(filebytes),
        "resampled_by_original": {
            "function": "original BaseAvatar.__create_bytes_stream (soundfile read, float32, resampy 24000->16000)",
            "sample_rate": SAMPLE_RATE,
            "samples": samples,
            "duration_s": round(samples / SAMPLE_RATE, 6),
            "peak_abs": float(np.abs(stream).max()) if samples else 0.0,
            "samples_abs_gt_1": int((np.abs(stream) > 1.0).sum()),
        },
        "put_audio_file": {
            "chunk_samples": CHUNK_SAMPLES,
            "complete_chunks": n_chunks,
            "dropped_incomplete_tail_samples": tail,
            "dropped_incomplete_tail_ms": round(tail * 1000 / SAMPLE_RATE, 3),
            "padding_added": 0,
        },
    }
    rec["capture_target"] = {
        "formula": "ceil((r + floor(resampled_samples / 320)) / (2 * batch_size)) * batch_size",
        "r": right, "batch_size": batch, "complete_chunks": n_chunks,
        "target_frames": target,
        "target_audio_chunks": 2 * target,
        "target_samples": 2 * target * CHUNK_SAMPLES,
        "target_duration_s": round(2 * target * CHUNK_SAMPLES / SAMPLE_RATE, 6),
        "pairing": "frame i <-> emitted audio chunks 2i and 2i+1",
    }

    adapter = DiskCaptureAdapter(frames_dir, target, job_id, CANVAS_SHAPE)
    real.output._player = adapter
    real.put_audio_file(filebytes, {TAG_KEY: job_id})
    rec["audio"]["put_audio_file"]["queued_chunks_observed"] = real.asr.queue.qsize()

    quit_event = threading.Event()
    existing = set(threading.enumerate())
    render_thread = threading.Thread(target=real.render, args=(quit_event,), name=f"yebisu-render-{job_id}", daemon=True)
    markers["render_start_ns"] = time.perf_counter_ns()
    render_thread.start()
    ctx.log(f"{job_id}: original render started; capture target {target} frames / {2 * target} chunks")
    started = time.monotonic()
    worker_threads: list[threading.Thread] = []
    try:
        while not adapter.target_event.wait(0.5):
            if adapter.error:
                raise RunnerError(f"capture adapter error: {adapter.error}")
            if len(ctx.thread_errors) > errors_before:
                raise RunnerError(f"original worker thread raised: {ctx.thread_errors[-1]['summary']}")
            if ctx.log_counter.paste_back_errors():
                raise RunnerError("original process_frames logged a paste_back_frame error (frame dropped)")
            if not render_thread.is_alive():
                raise RunnerError("original render returned before the capture target")
            if time.monotonic() - started > ctx.job_timeout:
                raise RunnerError(f"timeout after {ctx.job_timeout}s before the capture target")
        markers["target_reached_ns"] = adapter.target_reached_ns
        quit_event.set()
        markers["quit_set_ns"] = time.perf_counter_ns()
        ctx.log(f"{job_id}: capture target reached; original quit_event set, waiting for in-flight work")
        render_thread.join(ctx.shutdown_timeout)
        if render_thread.is_alive():
            raise RunnerError("original render did not return within the shutdown timeout")
        markers["render_returned_ns"] = time.perf_counter_ns()
        worker_threads = [t for t in threading.enumerate() if t not in existing and t is not render_thread]
        deadline = time.monotonic() + ctx.shutdown_timeout
        for thread in worker_threads:
            thread.join(max(0.0, deadline - time.monotonic()))
    finally:
        if not quit_event.is_set():
            quit_event.set()
            markers["quit_set_ns"] = time.perf_counter_ns()
            render_thread.join(min(60.0, ctx.shutdown_timeout))
        ctx.recorder.phase = "setup"
        rec["threads"] = {
            "render_alive_after_join": render_thread.is_alive(),
            "new_threads_after_render": [{"name": t.name, "daemon": t.daemon, "alive": t.is_alive()} for t in worker_threads],
            "worker_exceptions": [e["summary"] for e in ctx.thread_errors[errors_before:]],
            "upstream_warnings": ctx.log_counter.warnings[warnings_before:],
            "wall_clock_s_render_start_to_return": None if "render_returned_ns" not in markers
            else round((markers["render_returned_ns"] - markers["render_start_ns"]) / 1e9, 3),
            "wall_clock_s_render_start_to_target": None if markers.get("target_reached_ns") is None
            else round((markers["target_reached_ns"] - markers["render_start_ns"]) / 1e9, 3),
        }
        rec["capture_raw"] = adapter.snapshot()
        with open(job_dir / "capture.json", "w", encoding="utf-8") as fh:
            json.dump({"frames": adapter.frames, "chunks": adapter.chunks, "beyond_frames": adapter.beyond_frames,
                       "beyond_chunks": adapter.beyond_chunks, "snapshot": rec["capture_raw"]}, fh, indent=1)

    if rec["threads"]["worker_exceptions"] or adapter.error or adapter.order_violations or ctx.log_counter.paste_back_errors():
        raise RunnerError(f"{job_id}: worker exception, adapter error, order violation or dropped frame")
    if any(t["alive"] for t in rec["threads"]["new_threads_after_render"] if not t["daemon"]):
        raise RunnerError(f"{job_id}: an original worker thread is still alive after shutdown")
    if len(adapter.frames) != target or len(adapter.chunks) != 2 * target:
        raise RunnerError(f"{job_id}: captured count differs from target")

    rec["queues_after_render"] = {
        "res_frame_queue_items_left_unpushed": real.res_frame_queue.qsize(),
        "asr_feat_queue": real.asr.feat_queue.qsize(),
        "asr_output_queue": real.asr.output_queue.qsize(),
        "asr_input_queue": real.asr.queue.qsize(),
    }
    rec["tts_idle"] = {
        "class": type(real.tts).__name__,
        "messages_queued": real.tts.msgqueue.qsize(),
        "input_stream_bytes": len(real.tts.input_stream.getvalue()),
        "note": "original EdgeTTS constructed by BaseAvatar; its thread idled on msgqueue; put_msg_txt/txt_to_audio never called",
    }

    wav_path = job_dir / "captured-16k.wav"
    with wave.open(str(wav_path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(np.concatenate(adapter.audio).astype("<i2", copy=False).tobytes())
    rec["capture"] = analyse_capture(ctx, real, adapter, expected, target, batch, right, wav_path)
    rec["capture"]["private_frames"] = f"<private>/{job_id}/frames/000000.png .. {target - 1:06d}.png"
    if not rec["capture"]["audio"]["all_input_chunks_inside_target"]:
        raise RunnerError(f"{job_id}: not every input chunk landed inside the declared target")

    calls = [c for c in ctx.recorder.calls if c["phase"] == f"job:{job_id}"]
    neural = {}
    for call in calls:
        entry = neural.setdefault(call["module"], {"calls": 0, "windows": {}})
        entry["calls"] += 1
        window = ctx.recorder.window(call, ctx.markers)
        entry["windows"][window] = entry["windows"].get(window, 0) + 1
    rec["neural_calls_observed"] = {
        "by_module": neural,
        "batches_inside_target": target // batch,
        "batches_inside_target_with_input_chunks": rec["capture"]["batches_with_input_chunks"],
        "note": "hook counts are every actual call in this job, including in-flight work after the target; "
                "captured frames and inferred frames are reported separately and not equated",
    }
    ctx.job_artifacts[job_id] = {"frames_dir": frames_dir, "wav": wav_path, "frames": rec["capture"]["frames"]}
    ctx.log(f"{job_id}: captured {target} frames; render returned; worker threads stopped")


def analyse_capture(ctx, real, adapter, expected, target, batch, right, wav_path) -> dict:
    reference = real.frame_list_cycle[0]
    reference_sha = sha256_bytes(np.ascontiguousarray(reference).tobytes())
    x1, y1, x2, y2 = BBOX
    inside = np.zeros(CANVAS_SHAPE[:2], dtype=bool)
    inside[y1:y2, x1:x2] = True

    frames = []
    for frame in adapter.frames:
        i = frame["index"]
        path = adapter.frames_dir / f"{i:06d}.png"
        image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        exact = image is not None and image.shape == CANVAS_SHAPE and \
            sha256_bytes(np.ascontiguousarray(image).tobytes()) == frame["raw_sha256"]
        if not exact:
            raise RunnerError(f"frame {i} PNG does not decode to the pushed pixels")
        changed = np.any(image != reference, axis=2)
        frames.append({
            "index": i,
            "chunks": [2 * i, 2 * i + 1],
            "chunk_provenance": [label(adapter.chunks[2 * i]), label(adapter.chunks[2 * i + 1])],
            "png_sha256": sha256_file(path),
            "identical_to_original_silent_frame_cache": frame["raw_sha256"] == reference_sha,
            "changed_pixels_inside_bbox": int((changed & inside).sum()),
            "changed_pixels_outside_bbox": int((changed & ~inside).sum()),
        })

    watermark = np.any(reference != ctx.portrait_bgr, axis=2)
    ys, xs = np.nonzero(watermark)
    tagged = [c["index"] for c in adapter.chunks if c["tagged"]]
    untagged = [c for c in adapter.chunks if not c["tagged"]]
    first = tagged[0] if tagged else None
    last = tagged[-1] if tagged else None
    contiguous = bool(tagged) and tagged == list(range(first, first + len(tagged)))
    content_exact = len(tagged) <= len(expected) and all(
        np.array_equal(adapter.audio[idx], expected[k]) for k, idx in enumerate(tagged))
    batches_with_input = [b for b in range(target // batch)
                          if any(c["tagged"] for c in adapter.chunks[b * 2 * batch:(b + 1) * 2 * batch])]
    identical = sum(f["identical_to_original_silent_frame_cache"] for f in frames)
    return {
        "captured_frames": len(frames),
        "captured_audio_chunks": len(adapter.chunks),
        "captured_samples": len(adapter.chunks) * CHUNK_SAMPLES,
        "captured_duration_s": round(len(adapter.chunks) * CHUNK_SAMPLES / SAMPLE_RATE, 6),
        "wav_private": file_record(wav_path),
        "audio": {
            "provenance_method": "original put_audio_file datainfo tag carried in AudioFrameData.userdata to push_audio eventpoint; "
                                 "untagged = chunks not from put_audio_file (original warm-up / empty-queue silence)",
            "input_chunks_captured": len(tagged),
            "input_chunks_expected": len(expected),
            "all_input_chunks_inside_target": len(tagged) == len(expected),
            "input_chunks_contiguous_in_order": contiguous,
            "input_chunks_bitexact_to_original_resampled_int16": bool(content_exact),
            "first_input_chunk_index": first,
            "last_input_chunk_index": last,
            "prefix_untagged_chunks_observed": first,
            "prefix_untagged_chunks_expected_from_source_reading": right,
            "tail_untagged_chunks_inside_target": None if last is None else 2 * target - (last + 1),
            "untagged_chunks": len(untagged),
            "untagged_chunks_all_zero": sum(1 for c in untagged if c["all_zero"]),
            "status_markers": [{"chunk": c["index"], "status": c["status"]} for c in adapter.chunks if c["status"]],
            "trim_pad_shift_applied": False,
        },
        "frames_summary": {
            "identical_to_original_silent_frame_cache": identical,
            "differing_from_silent_frame_cache": len(frames) - identical,
            "frames_with_any_input_chunk": sum(1 for f in frames if "input" in f["chunk_provenance"]),
            "max_changed_pixels_outside_bbox": max((f["changed_pixels_outside_bbox"] for f in frames), default=0),
            "silent_branch_rule_from_source": "process_frames uses the cached full image (no paste) when both chunks of a frame are non-type-0",
        },
        "batches_with_input_chunks": len(batches_with_input),
        "batch_indices_with_input_chunks": batches_with_input,
        "original_watermark": {
            "text": "LiveTalking (original cv2.putText in process_frames, retained)",
            "silent_frame_cache_changed_pixels_vs_portrait": int(watermark.sum()),
            "changed_region_xyxy": None if not len(xs) else [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
            "note": "original putText writes in place on the cached full frame for silent frames",
        },
        "frames": frames,
    }


# --------------------------------------------------------------------------- packaging

def top_level_boxes(path: Path) -> list[str]:
    boxes = []
    with open(path, "rb") as fh:
        size_total = path.stat().st_size
        offset = 0
        while offset + 8 <= size_total:
            fh.seek(offset)
            header = fh.read(16)
            size = int.from_bytes(header[:4], "big")
            kind = header[4:8].decode("latin-1")
            if size == 1:
                size = int.from_bytes(header[8:16], "big")
            elif size == 0:
                size = size_total - offset
            if size < 8:
                break
            boxes.append(kind)
            offset += size
    return boxes


def encode_job(ctx, job_id: str, rec: dict) -> None:
    artifacts = ctx.job_artifacts[job_id]
    count = rec["capture"]["captured_frames"]
    public_dir = ctx.output / job_id
    (public_dir / "frames").mkdir(parents=True)
    mp4 = public_dir / f"{job_id}.mp4"
    wav = public_dir / f"{job_id}-captured-16k.wav"
    shutil.copyfile(artifacts["wav"], wav)
    if sha256_file(wav) != sha256_file(artifacts["wav"]):
        raise RunnerError(f"{job_id}: public WAV copy is not exact")

    cmd = [ctx.tools["ffmpeg"], "-hide_banner", "-nostdin", "-n",
           "-framerate", str(FIXED_RUNTIME["fps"]), "-start_number", "0", "-i", str(artifacts["frames_dir"] / "%06d.png"),
           "-i", str(artifacts["wav"]),
           "-map", "0:v:0", "-map", "1:a:0",
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "64k",
           "-movflags", "+faststart", "-map_metadata", "-1", str(mp4)]
    proc = run_command(ctx, cmd, f"{job_id} encode")
    if proc.returncode != 0:
        raise RunnerError(f"{job_id}: ffmpeg encode failed (see private commands.log)")
    decode = run_command(ctx, [ctx.tools["ffmpeg"], "-v", "error", "-nostdin", "-i", str(mp4), "-map", "0", "-f", "null", "-"],
                         f"{job_id} decode check")
    probe = run_command(ctx, [ctx.tools["ffprobe"], "-v", "error", "-count_frames", "-show_streams", "-show_format",
                              "-of", "json", str(mp4)], f"{job_id} ffprobe")
    if probe.returncode != 0:
        raise RunnerError(f"{job_id}: ffprobe failed")
    probed = json.loads(probe.stdout)
    probed.get("format", {})["filename"] = mp4.name
    video = [s for s in probed.get("streams", []) if s.get("codec_type") == "video"]
    audio = [s for s in probed.get("streams", []) if s.get("codec_type") == "audio"]
    boxes = top_level_boxes(mp4)
    checks = {
        "decode_all_streams_exit_code": decode.returncode,
        "decode_errors": decode.stderr.strip() != "",
        "video_streams": len(video),
        "audio_streams": len(audio),
        "video_codec": video[0].get("codec_name") if video else None,
        "pix_fmt": video[0].get("pix_fmt") if video else None,
        "video_size": [video[0].get("width"), video[0].get("height")] if video else None,
        "decoded_video_frames": int(video[0].get("nb_read_frames", -1)) if video else None,
        "captured_frames": count,
        "audio_codec": audio[0].get("codec_name") if audio else None,
        "audio_sample_rate": audio[0].get("sample_rate") if audio else None,
        "audio_channels": audio[0].get("channels") if audio else None,
        "top_level_boxes": boxes,
        "faststart_moov_before_mdat": "moov" in boxes and "mdat" in boxes and boxes.index("moov") < boxes.index("mdat"),
    }
    ok = (checks["decode_all_streams_exit_code"] == 0 and not checks["decode_errors"]
          and checks["video_streams"] == 1 and checks["audio_streams"] == 1
          and checks["video_codec"] == "h264" and checks["pix_fmt"] == "yuv420p"
          and checks["decoded_video_frames"] == count and checks["audio_codec"] == "aac"
          and checks["faststart_moov_before_mdat"])
    checks["all_checks_passed"] = ok

    picks = []
    for index in (0, count // 4, count // 2, (3 * count) // 4, count - 1):
        if index not in picks:
            picks.append(index)
    representatives = []
    for index in picks:
        source = artifacts["frames_dir"] / f"{index:06d}.png"
        target = public_dir / "frames" / f"frame_{index:06d}.png"
        shutil.copyfile(source, target)
        frame = artifacts["frames"][index]
        if sha256_file(target) != frame["png_sha256"]:
            raise RunnerError(f"{job_id}: representative {index} copy is not exact")
        representatives.append({
            "file": f"{job_id}/frames/{target.name}",
            "index": index,
            "sha256": frame["png_sha256"],
            "bytes": target.stat().st_size,
            "chunk_provenance": frame["chunk_provenance"],
            "identical_to_original_silent_frame_cache": frame["identical_to_original_silent_frame_cache"],
            "note": "original silent-branch full frame + watermark; not neurally generated"
            if frame["identical_to_original_silent_frame_cache"] else
            "differs from the silent frame cache inside the box (original paste_back_frame output)",
        })
    rec["outputs"] = {
        "mp4": {**file_record(mp4, f"{job_id}/{mp4.name}"), "fps": FIXED_RUNTIME["fps"],
                "duration_s_format": float(probed["format"]["duration"]) if "duration" in probed.get("format", {}) else None,
                "ffprobe": probed, "checks": checks},
        "wav": {**file_record(wav, f"{job_id}/{wav.name}"), "sample_rate": SAMPLE_RATE, "channels": 1, "subtype": "PCM_16",
                "identical_to_private_capture": True},
        "representatives": representatives,
        "encode_command": ctx.sanitizer.obj(["ffmpeg"] + cmd[1:]),
        "encode_policy": "all captured PNGs in original order at 25 fps; captured 16 kHz WAV as AAC functional audio; "
                         "no -shortest, retiming, interpolation, gain, fade or normalization",
    }
    if not ok:
        raise RunnerError(f"{job_id}: MP4 verification failed: {checks}")
    ctx.log(f"{job_id}: MP4 encoded and decoded; {count} frames; representatives {picks}")


# --------------------------------------------------------------------------- main

def execute(ctx, results: dict) -> None:
    global np, cv2, sf
    env, problems = check_environment(ctx)
    results["environment"] = env
    if problems:
        raise RunnerError("environment check failed: " + "; ".join(problems))
    import numpy as _np
    import cv2 as _cv2
    import soundfile as _sf
    np, cv2, sf = _np, _cv2, _sf
    ctx.log("environment verified")

    results["source"] = verify_upstream(ctx.upstream)
    spec = load_jobs(ctx)
    results["runner"]["jobs_json_sha256"] = sha256_file(ctx.jobs_path)
    results["inputs"] = verify_inputs(ctx, spec)
    results["preparation"] = verify_prepared(ctx)
    ctx.log("source, inputs and manual preparation verified")
    results["models"] = {"files": verify_weights(ctx), "redistributed": False}
    ctx.log("weights verified")

    results["environment"]["torch_runtime"] = setup_torch()
    results["avatar_layout"] = build_avatar_layout(ctx)
    up = import_upstream(ctx)
    ctx.log_counter = UpstreamLogCounter(ctx.recorder)
    up.logger.addHandler(ctx.log_counter)
    ctx.upstream_logger = up.logger

    ctx.recorder.phase = "model_loading"
    model_tuple, results["model_runtime"] = load_models(ctx, up)
    ctx.recorder.phase = "setup"
    vae, unet, _pe, _timesteps, audio_processor = model_tuple
    ctx.recorder.attach("whisper.encoder", audio_processor.whisper.encoder)
    ctx.recorder.attach("unet.model", unet.model)
    ctx.recorder.attach("vae.encoder", vae.vae.encoder)
    ctx.recorder.attach("vae.decoder", vae.vae.decoder)
    ctx.log("original models loaded once (CPU float32, eval, frozen); forward hooks attached")

    latent, results["latent"] = prepare_latent(ctx, up, vae)
    results["avatar_layout"]["latents.pt"] = results["latent"]["latents_pt"]
    ctx.log("one avatar latent sampled and stored privately")

    for job in spec["jobs"]:
        rec = {"id": job["id"], "prior_tts_input_text": job["prior_tts_input_text"]}
        results["jobs"].append(rec)
        run_job(ctx, up, model_tuple, latent, job, rec)

    ctx.recorder.detach()
    ctx.log("forward hooks removed")
    for rec in results["jobs"]:
        encode_job(ctx, rec["id"], rec)


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Offline capture of the original LiveTalking MuseTalk render loop.")
    parser.add_argument("--upstream", required=True, type=Path, help="LiveTalking source at the pinned commit")
    parser.add_argument("--weights", required=True, type=Path, help="root with musetalkV15/, sd-vae/, whisper/")
    parser.add_argument("--jobs", required=True, type=Path, help="inputs/jobs.json")
    parser.add_argument("--prepared", required=True, type=Path, help="inputs/prepared")
    parser.add_argument("--output", required=True, type=Path, help="new/empty public attempt directory")
    parser.add_argument("--private", required=True, type=Path, help="new/empty private attempt directory")
    parser.add_argument("--job-timeout", type=float, default=21600.0, help="seconds per job before failing")
    parser.add_argument("--shutdown-timeout", type=float, default=1800.0, help="seconds for in-flight work to finish")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    os.environ.update(OFFLINE_ENV)
    os.environ.update(THREAD_ENV)
    args = parse_args(argv)
    original_cwd = Path.cwd()
    paths = {name: getattr(args, name).resolve() for name in ("upstream", "weights", "jobs", "prepared", "output", "private")}
    for a in ("output", "private"):
        for b in ("upstream", "weights", "prepared", "output", "private"):
            if a != b and (paths[a] == paths[b] or paths[b] in paths[a].parents or paths[a] in paths[b].parents):
                raise SystemExit(f"run_example: refusing: --{a} overlaps --{b}")
    require_empty_dir(paths["output"], "output")
    require_empty_dir(paths["private"], "private")

    sanitizer = Sanitizer()
    for name, placeholder in (("output", "<output>"), ("private", "<private>"), ("upstream", "<upstream>"),
                              ("weights", "<weights>"), ("prepared", "<prepared>")):
        sanitizer.add(paths[name], placeholder)
    sanitizer.add(paths["jobs"].parent, "<jobs-dir>")
    sanitizer.add(original_cwd, "<cwd>")
    sanitizer.add(sys.prefix, "<python-prefix>")
    sanitizer.add(Path.home(), "<home>")
    try:
        user = getpass.getuser()
    except Exception:
        user = ""
    if len(user) >= 3:
        sanitizer.add(user, "<user>")

    ctx = SimpleNamespace(
        upstream=paths["upstream"], weights=paths["weights"], jobs_path=paths["jobs"], jobs_dir=paths["jobs"].parent,
        prepared=paths["prepared"], output=paths["output"], private=paths["private"],
        workdir=paths["private"] / "workdir", job_timeout=args.job_timeout, shutdown_timeout=args.shutdown_timeout,
        sanitizer=sanitizer, tools={}, recorder=ForwardCallRecorder(), markers={}, job_artifacts={},
        thread_errors=[], log_counter=None, upstream_logger=None,
    )
    ctx.workdir.mkdir()
    ctx.log = RunLog(ctx.private / "run.log", sanitizer)

    previous_hook = threading.excepthook

    def record_thread_exception(hook_args):
        text = "".join(traceback.format_exception(hook_args.exc_type, hook_args.exc_value, hook_args.exc_traceback))
        name = hook_args.thread.name if hook_args.thread else "?"
        ctx.thread_errors.append({"thread": name, "summary": f"{name}: {hook_args.exc_type.__name__}: {hook_args.exc_value}",
                                  "traceback": text})
        with open(ctx.private / "thread-exceptions.log", "a", encoding="utf-8") as fh:
            fh.write(f"## {utc_now()} {name}\n{text}\n")
        previous_hook(hook_args)

    threading.excepthook = record_thread_exception

    results = {
        "schema": "studio-yebisu/livetalking-example/results@1",
        "kind": "measured operator-runner packaging; not a native LiveTalking API response",
        "case_id": "livetalking-example",
        "status": "running",
        "started_at_utc": utc_now(),
        "runner": {
            "script": "run_example.py",
            "sha256": sha256_file(Path(__file__).resolve()),
            "invocation": "python run_example.py --upstream <upstream> --weights <weights> --jobs inputs/jobs.json "
                          "--prepared inputs/prepared --output <output> --private <private>",
            "job_timeout_s": args.job_timeout,
            "shutdown_timeout_s": args.shutdown_timeout,
            "retries": 0,
        },
        "scope": {
            "executed": "original LiveTalking MuseReal + WhisperASR + BaseAvatar offline render subset on CPU float32",
            "not_executed": ["app.py / HTTP server / WebRTC handshake / RTMP / virtualcam", "LLM, new TTS, voice clone, ASR text",
                             "Wav2Lip / UltraLight / ernerf", "face detection, face parsing, MuseTalk genavatar",
                             "app-level musetalk warm_up(model)"],
            "transport_boundary": "original WebRTCOutput object; its _player is DiskCaptureAdapter (offline disk capture); "
                                  "no RTCPeerConnection, network stream or listener",
            "tts": "original EdgeTTS constructed and idle; no message submitted; no outgoing synthesis",
            "source_patching": "none (no monkeypatch, stub or substituted model)",
        },
        "jobs": [],
        "not_claimed": NOT_CLAIMED,
    }
    exit_code = 0
    try:
        execute(ctx, results)
        results["status"] = "completed"
        ctx.log("completed")
    except BaseException as exc:
        exit_code = 2
        results["status"] = "failed"
        results["error"] = {"type": type(exc).__name__, "message": str(exc)}
        with open(ctx.private / "failure-traceback.log", "a", encoding="utf-8") as fh:
            fh.write(traceback.format_exc())
        ctx.log(f"FAILED: {type(exc).__name__}: {exc}")
    finally:
        ctx.recorder.detach()
        if ctx.upstream_logger is not None and ctx.log_counter is not None:
            ctx.upstream_logger.removeHandler(ctx.log_counter)
            results["upstream_logger_counts"] = ctx.log_counter.counts
        threading.excepthook = previous_hook
        os.chdir(original_cwd)
        if torch is not None:
            with open(ctx.private / "hooks.jsonl", "w", encoding="utf-8") as fh:
                for call in ctx.recorder.calls:
                    fh.write(json.dumps(call) + "\n")
            results["neural_hooks"] = {
                "modules": ["whisper.encoder", "unet.model", "vae.encoder", "vae.decoder"],
                "method": "non-mutating register_forward_pre_hook/register_forward_hook (with_kwargs); registered once, removed after the jobs",
                "timing_scope": "wall-clock perf_counter around each module call in a single CPU run, hook overhead included; not a benchmark",
                **ctx.recorder.summary(ctx.markers),
            }
        results["finished_at_utc"] = utc_now()
        public = sanitizer.obj(results)
        (ctx.output / "results.json").write_text(json.dumps(public, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        ctx.log.write_public(ctx.output / "run-log.txt")
    lingering = [t.name for t in threading.enumerate()
                 if t is not threading.main_thread() and t.is_alive() and not t.daemon]
    if lingering:
        ctx.log(f"non-daemon threads still alive, exiting this process only: {lingering}")
        ctx.log.write_public(ctx.output / "run-log.txt")
        os._exit(exit_code or 3)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
