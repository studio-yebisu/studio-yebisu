#!/usr/bin/env python3
"""Studio Yebisu VoiceStudio example: original CLI -> original loopback ASR route.

This wrapper does not transcribe anything itself. It verifies the pinned
VoiceStudio source files and the three frozen synthetic WAVs, reads the running
backend's readiness endpoints, then executes VoiceStudio's own
``python -m backend.speech_client`` once for ``capabilities`` and exactly once
per job for ``transcribe``. That CLI builds the multipart request and POSTs it
to the original ``/v1/audio/transcriptions`` route, which runs the active
Faster-Whisper adapter.

Standard library only. No install, download, server start, desktop automation,
settings change, licence acceptance, retry or fallback. Every output file is
created exclusively; a rerun needs a new empty ``--out``.

    python run_example.py --source <VoiceStudio checkout> --python <interpreter> \
        --url http://127.0.0.1:3900 --out <new empty folder>
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import ipaddress
import json
import math
import os
import re
import subprocess
import sys
import time
import wave
from pathlib import Path, PurePosixPath
from urllib import error, request
from urllib.parse import urlsplit

CASE_ROOT = Path(__file__).resolve().parent
PINS_PATH = CASE_ROOT / "vendor" / "pins.json"
INPUTS_DIR = CASE_ROOT / "inputs"
AUDIO_DIR = INPUTS_DIR / "audio"
VENDOR_DIR = CASE_ROOT / "vendor"
DEFAULT_JOBS = INPUTS_DIR / "jobs.json"
DEFAULT_URL = "http://127.0.0.1:3900"

AUTHOR = "Claude Opus 5.5 (claude-opus-5-5)"
EXPECTED_REPOSITORY = "debpalash/VoiceStudio"
EXPECTED_COMMIT = "6f0ed2ebeaf620bcea8a293cd210bba920b73622"
EXPECTED_VERSION = "0.5.7"
EXPECTED_SELECTED_FILES = 20
ENGINE_ID = "faster-whisper"
MODEL_REPO = "Systran/faster-whisper-base"
MODEL_REVISION = "ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66"
MODEL_FILE_COUNT = 4
SPEECH_SCHEMA = "voicestudio.speech-capabilities"
SPEECH_PROTOCOL = "voicestudio.speech.v1"
CAPABILITIES_PATH = "/.well-known/voicestudio-speech"
TRANSCRIPTION_PATH = "/v1/audio/transcriptions"
TRANSCRIPTION_FORM_FIELDS = ("file", "model", "language", "response_format")

REQUEST = {
    "cli_module": "backend.speech_client",
    "command": "transcribe",
    "model": ENGINE_ID,
    "language": "en",
    "format": "verbose_json",
}
# (id, audio, bytes, sha256, seconds) as recorded in runtime/input-sources.json.
EXPECTED_JOBS = (
    ("default", "inputs/audio/default.wav", 222764,
     "b750fdbc8e1a609954a5d7f0d5bd072ec3fa9116c1f91cf7fa8b19053b2fba52", 4.64),
    ("expressive", "inputs/audio/expressive.wav", 201644,
     "a60cfaf5e609bbbc823efa5bc2f646f1d1a8901a7a4661aeebb669bac53e25fe", 4.2),
    ("second", "inputs/audio/second.wav", 247724,
     "80fd37b2eefd398d2e9c88ac812bc74b7028715fb26b5fd568eef3b24b363cdd", 5.16),
)
WAV_FORMAT = {"sample_rate_hz": 24000, "channels": 1, "sample_width_bytes": 2}

HTTP_TIMEOUT_S = 30.0
CAPABILITIES_TIMEOUT_S = 60.0
# The original CLI bounds its POST at 300 s and the route bounds a whole-file
# transcribe at 300 s by default. This outer bound only surfaces a hang; the
# wrapper never re-submits after it.
TRANSCRIBE_TIMEOUT_S = 900.0
VERSION_PROBE_TIMEOUT_S = 60.0
DURATION_TOLERANCE_S = 0.5
ERROR_EXCERPT_CHARS = 400

PACKAGE_NAMES = (
    "faster-whisper", "ctranslate2", "onnxruntime", "av",
    "huggingface-hub", "tokenizers", "fastapi", "numpy",
)
EVIDENCE_KEYS = (
    "implementation_variant", "declared_device_families", "evidence_state",
    "actual_execution_provider", "actual_execution_device",
    "precision_or_quantization", "cpu_fallback_reason", "cpu_fallback_stage",
)
RUNTIME_VERSION_KEYS = ("python", "ctranslate2", "faster-whisper", "torch", "onnxruntime")
# FasterWhisperBackend's normalised segments carry only text/start/end/words, so
# the route's _openai_segments fills these OpenAI fields with neutral defaults.
NEUTRAL_SEGMENT_FIELDS = ("seek", "tokens", "temperature", "avg_logprob",
                          "compression_ratio", "no_speech_prob")
PROXY_ENV_KEYS = ("http_proxy", "https_proxy", "all_proxy", "ftp_proxy")
CHILD_ENV_REMOVED = ("PYTHONPATH", "PYTHONSAFEPATH")

_VERSION_PROBE = (
    "import importlib.metadata as m, json, platform, sys\n"
    "out = {}\n"
    "for name in sys.argv[1:]:\n"
    "    try:\n"
    "        out[name] = m.version(name)\n"
    "    except m.PackageNotFoundError:\n"
    "        out[name] = None\n"
    "print(json.dumps({'python': platform.python_version(), 'distributions': out}))\n"
)


class ArgError(Exception):
    """Invalid invocation; raised before the output folder exists."""


class RunError(Exception):
    def __init__(self, phase: str, kind: str, message: str, **detail):
        super().__init__(message)
        self.phase = phase
        self.kind = kind
        self.message = message
        self.detail = detail


# ── small helpers ──────────────────────────────────────────────────────────


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_sha1(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def is_within(child: Path, parent: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def overlaps(a: Path, b: Path) -> bool:
    return is_within(a, b) or is_within(b, a)


def is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _reject_constant(name: str):
    raise ValueError(f"non-finite JSON constant {name}")


def _unique_pairs(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError(f"duplicate JSON key {key!r}")
        out[key] = value
    return out


def strict_json(data: bytes):
    """UTF-8 JSON without NaN/Infinity or duplicate keys."""
    return json.loads(data.decode("utf-8"), parse_constant=_reject_constant,
                      object_pairs_hook=_unique_pairs)


def json_bytes(obj) -> bytes:
    return (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def write_new(path: Path, data: bytes) -> None:
    """Exclusive create: an existing file is never overwritten."""
    with open(path, "xb") as fh:
        fh.write(data)


_DRIVE_PATH = re.compile(r"(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s'\",;)}\]]*")
_UNC_PATH = re.compile(r"\\\\[^\s'\",;)}\]]+")
_POSIX_PATH = re.compile(
    r"(?<![\w:/.])/(?:home|Users|tmp|var|private|root|opt|mnt|srv|usr|etc|Volumes)/[^\s'\",;)}\]]*"
)
_BEARER = re.compile(r"(?i)bearer\s+[^\s'\",]+")


def redact(text: str, secrets: list[str]) -> str:
    for secret in secrets:
        if secret:
            text = text.replace(secret, "<redacted>")
    text = _BEARER.sub("Bearer <redacted>", text)
    text = _DRIVE_PATH.sub("<path>", text)
    text = _UNC_PATH.sub("<path>", text)
    return _POSIX_PATH.sub("<path>", text)


# ── argument validation ────────────────────────────────────────────────────


def loopback_base_url(raw: str) -> str:
    if "?" in raw or "#" in raw:
        raise ArgError("--url must not contain a query or fragment")
    parts = urlsplit(raw)
    if parts.scheme != "http":
        raise ArgError("--url must use http:// on a loopback address")
    if "@" in parts.netloc or parts.username is not None or parts.password is not None:
        raise ArgError("--url must not contain userinfo")
    if parts.path not in ("", "/"):
        raise ArgError("--url must be the service root, without a path")
    try:
        address = ipaddress.ip_address(parts.hostname or "")
    except ValueError as exc:
        raise ArgError("--url host must be a literal loopback IP such as 127.0.0.1") from exc
    if not address.is_loopback:
        raise ArgError("--url host is not a loopback address")
    try:
        port = parts.port
    except ValueError as exc:
        raise ArgError("--url port is invalid") from exc
    if port is None:
        raise ArgError("--url must name its port explicitly")
    host = f"[{address.compressed}]" if address.version == 6 else address.compressed
    return f"http://{host}:{port}"


def resolve_paths(args: argparse.Namespace) -> dict:
    source = Path(args.source).expanduser().resolve()
    if not source.is_dir():
        raise ArgError("--source is not a directory")
    python = Path(args.python).expanduser().resolve()
    if not python.is_file():
        raise ArgError("--python is not a file")
    jobs = Path(args.jobs).expanduser().resolve()
    if not jobs.is_file():
        raise ArgError("--jobs is not a file")
    out = Path(args.out).expanduser().resolve()
    if not out.parent.is_dir():
        raise ArgError("--out parent folder does not exist")
    for protected, label in ((source, "--source"), (INPUTS_DIR, "case inputs"),
                             (VENDOR_DIR, "case vendor files")):
        if overlaps(out, protected):
            raise ArgError(f"--out must be independent of {label}")
    if out == CASE_ROOT:
        raise ArgError("--out must not be the case root itself")
    if out.exists():
        if not out.is_dir() or any(out.iterdir()):
            raise ArgError("--out exists and is not an empty folder; choose a new one")
    return {"source": source, "python": python, "jobs": jobs, "out": out}


# ── frozen-input verification (before any request) ─────────────────────────


def load_pins() -> tuple[dict, bytes]:
    raw = PINS_PATH.read_bytes()
    pins = strict_json(raw)
    upstream = pins["upstream"]
    model = pins["asr_model"]
    if (upstream.get("repository") != EXPECTED_REPOSITORY
            or upstream.get("commit") != EXPECTED_COMMIT
            or upstream.get("version") != EXPECTED_VERSION):
        raise RunError("verify_source", "pin_mismatch", "vendor/pins.json does not name the expected VoiceStudio commit")
    if len(upstream.get("selected_files", [])) != EXPECTED_SELECTED_FILES:
        raise RunError("verify_source", "pin_mismatch", "vendor/pins.json does not list 20 selected files")
    if model.get("repository") != MODEL_REPO or model.get("revision") != MODEL_REVISION:
        raise RunError("verify_source", "pin_mismatch", "vendor/pins.json does not name the expected ASR model revision")
    if len(model.get("files", [])) != MODEL_FILE_COUNT:
        raise RunError("verify_source", "pin_mismatch", "vendor/pins.json does not list 4 model files")
    return pins, raw


def verify_source(source: Path, pins: dict) -> list[dict]:
    records = []
    for entry in pins["upstream"]["selected_files"]:
        rel = PurePosixPath(entry["path"])
        if rel.is_absolute() or ".." in rel.parts:
            raise RunError("verify_source", "pin_mismatch", f"unsafe pinned path {entry['path']}")
        candidate = source.joinpath(*rel.parts)
        if candidate.is_symlink() or not candidate.is_file():
            raise RunError("verify_source", "source_mismatch", f"{entry['path']} is missing or not a regular file")
        if not is_within(candidate.resolve(), source):
            raise RunError("verify_source", "source_mismatch", f"{entry['path']} resolves outside --source")
        data = candidate.read_bytes()
        record = {
            "path": entry["path"],
            "bytes": len(data),
            "sha256": sha256_hex(data),
            "git_blob": git_blob_sha1(data),
        }
        record["match"] = (record["bytes"] == entry["bytes"]
                           and record["sha256"] == entry["sha256"]
                           and record["git_blob"] == entry["git_blob"])
        if not record["match"]:
            raise RunError("verify_source", "source_mismatch",
                           f"{entry['path']} differs from the pinned official file")
        records.append(record)
    return records


def load_jobs(jobs_path: Path) -> tuple[list[dict], bytes]:
    raw = jobs_path.read_bytes()
    doc = strict_json(raw)
    if doc.get("schema") != "studio-yebisu.voicestudio-example.jobs.v1":
        raise RunError("verify_inputs", "jobs_mismatch", "jobs file has an unexpected schema")
    if doc.get("request") != REQUEST:
        raise RunError("verify_inputs", "jobs_mismatch", "jobs request flags differ from the fixed request")
    jobs = doc.get("jobs")
    if not isinstance(jobs, list) or len(jobs) != len(EXPECTED_JOBS):
        raise RunError("verify_inputs", "jobs_mismatch", "jobs file must list exactly three jobs")
    for job, (job_id, audio, size, digest, seconds) in zip(jobs, EXPECTED_JOBS):
        expected = {"id": job_id, "audio": audio, "bytes": size, "sha256": digest,
                    "seconds": seconds, **WAV_FORMAT}
        actual = {key: job.get(key) for key in expected}
        if actual != expected:
            raise RunError("verify_inputs", "jobs_mismatch", f"job {job_id!r} differs from the frozen input record")
        if not isinstance(job.get("reference_text"), str) or not job["reference_text"].strip():
            raise RunError("verify_inputs", "jobs_mismatch", f"job {job_id!r} has no reference text")
    return jobs, raw


def verify_wav(job: dict) -> dict:
    rel = PurePosixPath(job["audio"])
    path = CASE_ROOT.joinpath(*rel.parts)
    if path.is_symlink() or not path.is_file() or not is_within(path.resolve(), AUDIO_DIR):
        raise RunError("verify_inputs", "wav_mismatch", f"{job['audio']} is missing or outside inputs/audio")
    data = path.read_bytes()
    if len(data) != job["bytes"] or sha256_hex(data) != job["sha256"]:
        raise RunError("verify_inputs", "wav_mismatch", f"{job['audio']} bytes or SHA-256 changed")
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE" or int.from_bytes(data[4:8], "little") != len(data) - 8:
        raise RunError("verify_inputs", "wav_mismatch", f"{job['audio']} has an unexpected RIFF header")
    with wave.open(io.BytesIO(data), "rb") as wav:
        channels, width, rate = wav.getnchannels(), wav.getsampwidth(), wav.getframerate()
        frames, compression = wav.getnframes(), wav.getcomptype()
    seconds = frames / rate if rate else 0.0
    if ((channels, width, rate) != (WAV_FORMAT["channels"], WAV_FORMAT["sample_width_bytes"],
                                    WAV_FORMAT["sample_rate_hz"])
            or compression != "NONE" or abs(seconds - job["seconds"]) > 1e-6):
        raise RunError("verify_inputs", "wav_mismatch", f"{job['audio']} is not the recorded 24 kHz mono PCM16 clip")
    return {
        "audio": job["audio"],
        "bytes": len(data),
        "sha256": sha256_hex(data),
        "sample_rate_hz": rate,
        "channels": channels,
        "sample_width_bytes": width,
        "frames": frames,
        "seconds": round(seconds, 6),
        "path": path,
    }


# ── loopback HTTP reads (readiness only, never generation) ─────────────────


class _NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ARG002
        return None  # a redirect surfaces as an HTTPError instead of being followed


_OPENER = request.build_opener(request.ProxyHandler({}), _NoRedirect())


class Http:
    def __init__(self, base_url: str, secrets: list[str]):
        self.base_url = base_url
        self.secrets = secrets
        self.log: list[dict] = []

    def get_json(self, path: str, phase: str):
        req = request.Request(self.base_url + path, headers={"Accept": "application/json"}, method="GET")
        try:
            with _OPENER.open(req, timeout=HTTP_TIMEOUT_S) as resp:
                status, body = resp.status, resp.read()
        except error.HTTPError as exc:
            try:
                excerpt = exc.read(2000).decode("utf-8", "replace")
            except Exception:  # noqa: BLE001 - the status code is the useful part
                excerpt = ""
            self.log.append({"method": "GET", "path": path, "status": exc.code})
            raise RunError(phase, "http_status", f"GET {path} returned HTTP {exc.code}",
                           http_status=exc.code,
                           message_excerpt=redact(excerpt.strip(), self.secrets)[:ERROR_EXCERPT_CHARS]) from exc
        except (error.URLError, OSError) as exc:
            self.log.append({"method": "GET", "path": path, "status": None, "error": type(exc).__name__})
            raise RunError(phase, "unreachable", f"GET {path} failed ({type(exc).__name__})") from exc
        self.log.append({"method": "GET", "path": path, "status": status, "bytes": len(body)})
        try:
            return strict_json(body)
        except ValueError as exc:
            raise RunError(phase, "invalid_json", f"GET {path} did not return strict JSON") from exc


def check_health(doc) -> dict:
    if not isinstance(doc, dict) or doc.get("status") != "ok" or doc.get("version") != EXPECTED_VERSION:
        raise RunError("readiness", "not_ready", "/health is not ok for VoiceStudio 0.5.7")
    return {"status": doc["status"], "version": doc["version"], "device": doc.get("device")}


def check_openapi(doc) -> dict:
    try:
        info_version = doc["info"]["version"]
        operation = doc["paths"][TRANSCRIPTION_PATH]["post"]
        schema = operation["requestBody"]["content"]["multipart/form-data"]["schema"]
        ref = schema.get("$ref", "")
        if ref:
            prefix = "#/components/schemas/"
            if not ref.startswith(prefix):
                raise KeyError(ref)
            schema = doc["components"]["schemas"][ref[len(prefix):]]
        properties = sorted(schema["properties"])
        required = sorted(schema.get("required", []))
    except (KeyError, TypeError, AttributeError) as exc:
        raise RunError("readiness", "schema_mismatch", "OpenAPI lacks the POST /v1/audio/transcriptions form schema") from exc
    missing = [name for name in TRANSCRIPTION_FORM_FIELDS if name not in properties]
    if info_version != EXPECTED_VERSION or missing or "file" not in required:
        raise RunError("readiness", "schema_mismatch", "OpenAPI version or transcription form fields differ",
                       missing_fields=missing)
    return {
        "info_version": info_version,
        "post_transcriptions_present": True,
        "multipart_form_properties": properties,
        "multipart_form_required": required,
        "capabilities_path_present": CAPABILITIES_PATH in doc.get("paths", {}),
    }


def asr_engine_subset(doc, phase: str) -> dict:
    """Only the active ASR selection and the faster-whisper row; no TTS/LLM inventory."""
    try:
        asr = doc["asr"]
        row = next(b for b in asr["backends"] if b.get("id") == ENGINE_ID)
    except (KeyError, TypeError, StopIteration) as exc:
        raise RunError(phase, "engine_mismatch", "/engines has no faster-whisper ASR row") from exc
    evidence = row.get("execution_evidence") or {}
    runtime = evidence.get("runtime_versions") or {}
    return {
        "active": asr.get("active"),
        "active_model": asr.get("active_model"),
        "env_override": asr.get("env_override"),
        "backend": {
            "id": row.get("id"),
            "display_name": row.get("display_name"),
            "available": row.get("available"),
            "isolation_mode": row.get("isolation_mode"),
            "gpu_compat": row.get("gpu_compat"),
            "effective_device": row.get("effective_device"),
            "routing_status": row.get("routing_status"),
            "last_error_present": bool(row.get("last_error")),
            "execution_evidence": {key: evidence.get(key) for key in EVIDENCE_KEYS},
            "server_reported_runtime_versions": {k: runtime[k] for k in RUNTIME_VERSION_KEYS if k in runtime},
        },
    }


def check_engine_selection(subset: dict, phase: str) -> None:
    if (subset["active"] != ENGINE_ID or subset["active_model"] != MODEL_REPO
            or subset["backend"]["available"] is not True):
        raise RunError(phase, "engine_mismatch",
                       "active ASR engine/model is not an available faster-whisper + Systran/faster-whisper-base",
                       observed_active=subset["active"], observed_model=subset["active_model"])


def check_model(doc, expected_bytes: int) -> dict:
    try:
        entry = next(m for m in doc["models"] if m.get("repo_id") == MODEL_REPO)
    except (KeyError, TypeError, StopIteration) as exc:
        raise RunError("readiness", "model_missing", "/models does not list Systran/faster-whisper-base") from exc
    info = entry.get("license_info") or {}
    acceptance = entry.get("license_acceptance") or {}
    record = {
        "repo_id": entry.get("repo_id"),
        "role": entry.get("role"),
        "engines_include_faster_whisper": ENGINE_ID in (entry.get("engines") or []),
        "installed": entry.get("installed"),
        "incomplete": entry.get("incomplete"),
        "nb_files": entry.get("nb_files"),
        "size_on_disk_bytes": entry.get("size_on_disk_bytes"),
        "pinned_files_total_bytes": expected_bytes,
        "license": info.get("license"),
        "license_category": info.get("license_category"),
        "registry_version": info.get("registry_version"),
        "evidence_revision": info.get("evidence_revision"),
        "runtime_revision": info.get("runtime_revision"),
        "review_status": info.get("review_status"),
        "registry_readiness": info.get("readiness"),
        "acceptance_required": acceptance.get("required"),
        "acceptance_state": acceptance.get("state"),
    }
    if not (record["engines_include_faster_whisper"] and record["installed"] is True
            and record["incomplete"] is False and record["nb_files"] == MODEL_FILE_COUNT
            and record["size_on_disk_bytes"] == expected_bytes):
        raise RunError("readiness", "model_not_ready", "selected model is not installed/complete as pinned",
                       observed=record)
    if record["evidence_revision"] != MODEL_REVISION or record["runtime_revision"] != MODEL_REVISION:
        raise RunError("readiness", "model_revision_mismatch", "licence metadata revision differs from the pin",
                       observed=record)
    if record["acceptance_required"] is not False or record["acceptance_state"] != "not_required":
        # Never accept on the user's behalf; stop and leave the gate intact.
        raise RunError("readiness", "licence_gate", "model licence acceptance is required; this wrapper never accepts",
                       observed=record)
    return record


# ── original CLI execution ─────────────────────────────────────────────────


def child_env() -> tuple[dict, dict]:
    env = dict(os.environ)
    removed = []
    for key in list(env):
        if key.lower() in PROXY_ENV_KEYS or key.upper() in CHILD_ENV_REMOVED:
            removed.append(key.upper())
            del env[key]
    for key in list(env):
        if key.lower() == "no_proxy":
            del env[key]
    env["NO_PROXY"] = "127.0.0.1,localhost,::1"
    env["PYTHONDONTWRITEBYTECODE"] = "1"  # leave the source checkout free of __pycache__
    env["PYTHONIOENCODING"] = "utf-8"
    policy = {
        "removed_if_present": sorted({*(k.upper() for k in PROXY_ENV_KEYS), *CHILD_ENV_REMOVED}),
        "removed_present": sorted(set(removed)),
        "set": {"NO_PROXY": env["NO_PROXY"], "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8"},
        "omnivoice_api_key_present": bool(env.get("OMNIVOICE_API_KEY", "").strip()),
        "note": "Values of other variables are neither changed nor recorded. A pre-existing "
                "OMNIVOICE_API_KEY is left for the original CLI and never logged.",
    }
    return env, policy


def run_cli(paths: dict, env: dict, url: str, cli_args: list[str], timeout: float) -> dict:
    argv = [str(paths["python"]), "-m", "backend.speech_client", "--engine-url", url, *cli_args]
    started = time.perf_counter()
    try:
        proc = subprocess.run(argv, cwd=str(paths["source"]), env=env, stdin=subprocess.DEVNULL,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              timeout=timeout, check=False)
    except subprocess.TimeoutExpired as exc:
        return {"timed_out": True, "returncode": None, "stdout": exc.stdout or b"",
                "stderr": exc.stderr or b"", "elapsed_s": time.perf_counter() - started}
    except OSError as exc:
        return {"timed_out": False, "returncode": None, "stdout": b"", "stderr": b"",
                "elapsed_s": time.perf_counter() - started, "os_error": type(exc).__name__}
    return {"timed_out": False, "returncode": proc.returncode, "stdout": proc.stdout,
            "stderr": proc.stderr, "elapsed_s": time.perf_counter() - started}


def cli_failure(phase: str, outcome: dict, secrets: list[str], **extra) -> RunError:
    text = outcome["stderr"].decode("utf-8", "replace")
    lines = [line for line in text.splitlines() if line.strip()]
    last = lines[-1].strip() if lines else ""
    match = re.search(r"HTTP (\d{3})", last)
    status = int(match.group(1)) if match else None
    if outcome["timed_out"]:
        kind = "timeout"
    elif outcome.get("os_error"):
        kind = "cli_not_started"
    elif status in (401, 403):
        kind = "auth_or_licence_refused"
    elif status == 409:
        kind = "model_missing"
    elif status == 400 and "model_not_active" in last:
        kind = "engine_not_active"
    elif status == 504:
        kind = "server_timeout"
    elif status is not None:
        kind = "http_error"
    else:
        kind = "cli_error"
    return RunError(phase, kind, f"original CLI {kind}",
                    returncode=outcome["returncode"], http_status=status,
                    elapsed_s=round(outcome["elapsed_s"], 3),
                    stdout_bytes=len(outcome["stdout"]), stderr_bytes=len(outcome["stderr"]),
                    message_excerpt=redact(last, secrets)[:ERROR_EXCERPT_CHARS], **extra)


def check_capabilities(doc) -> dict:
    try:
        endpoints = doc["endpoints"]
        batch = endpoints["batch_transcription"]
        ok = (doc["schema"] == SPEECH_SCHEMA and doc["protocol"] == SPEECH_PROTOCOL
              and doc["service_version"] == EXPECTED_VERSION
              and endpoints["capabilities"]["path"] == CAPABILITIES_PATH
              and batch["path"] == TRANSCRIPTION_PATH and batch["method"] == "POST"
              and batch["protocol"] == "openai.audio.transcriptions"
              and doc["features"]["native_dictation_control"] is False)
    except (KeyError, TypeError) as exc:
        raise RunError("capabilities", "schema_mismatch", "capability document is incomplete") from exc
    if not ok:
        raise RunError("capabilities", "schema_mismatch", "capability document differs from voicestudio.speech.v1 / 0.5.7")
    return {
        "schema": doc["schema"],
        "protocol": doc["protocol"],
        "protocol_version": doc.get("protocol_version"),
        "service_version": doc["service_version"],
        "batch_transcription": {"path": batch["path"], "method": batch["method"], "protocol": batch["protocol"]},
        "advertised_not_exercised": sorted(k for k in endpoints if k not in ("capabilities", "batch_transcription")),
        "native_dictation_control": doc["features"]["native_dictation_control"],
        "authentication_loopback": (doc.get("authentication") or {}).get("loopback"),
    }


def validate_verbose(doc, wav_seconds: float) -> dict:
    def bad(message: str):
        return RunError("validate", "invalid_response", message)

    if not isinstance(doc, dict):
        raise bad("verbose_json is not an object")
    for key in ("task", "language", "duration", "text", "segments"):
        if key not in doc:
            raise bad(f"verbose_json lacks {key!r}")
    if doc["task"] != "transcribe":
        raise bad("task is not 'transcribe'")
    if doc["language"] != "en":
        raise bad("language tag is not 'en'")
    text = doc["text"]
    if not isinstance(text, str) or not text.strip():
        raise bad("text is empty")
    duration = doc["duration"]
    if not is_number(duration) or duration <= 0 or abs(duration - wav_seconds) > DURATION_TOLERANCE_S:
        raise bad("duration is not a finite value near the WAV length")
    segments = doc["segments"]
    if not isinstance(segments, list) or not segments:
        raise bad("segments are empty")
    previous_start, previous_end = 0.0, 0.0
    non_overlapping, neutral = True, True
    kept = []
    for index, seg in enumerate(segments):
        if not isinstance(seg, dict) or seg.get("id") != index or not isinstance(seg.get("text"), str):
            raise bad(f"segment {index} is malformed")
        start, end = seg.get("start"), seg.get("end")
        if not (is_number(start) and is_number(end)) or start < 0 or end < start or start < previous_start:
            raise bad(f"segment {index} timestamps are not finite, non-negative and ordered")
        if index and start < previous_end:
            non_overlapping = False
        previous_start, previous_end = start, end
        for field in NEUTRAL_SEGMENT_FIELDS:
            value = seg.get(field)
            if not (value == [] if field == "tokens" else (is_number(value) and value == 0)):
                neutral = False
        kept.append({"id": index, "start": start, "end": end, "text": seg["text"]})
    joined = " ".join(seg["text"].strip() for seg in kept).strip()
    return {
        "task": doc["task"],
        "language": doc["language"],
        "duration": duration,
        "text": text,
        "segment_count": len(kept),
        "segments": kept,
        "top_level_keys": sorted(doc),
        "words_field_present": "words" in doc,
        "text_equals_joined_segment_texts": joined == text,
        "segments_non_overlapping": non_overlapping,
        "max_segment_end_s": max(seg["end"] for seg in kept),
        "max_segment_end_within_duration": max(seg["end"] for seg in kept) <= duration,
        "neutral_fields_all_default": neutral,
    }


def probe_package_versions(python: Path, out: Path) -> dict:
    try:
        proc = subprocess.run([str(python), "-I", "-c", _VERSION_PROBE, *PACKAGE_NAMES],
                              cwd=str(out), stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                              stderr=subprocess.DEVNULL, timeout=VERSION_PROBE_TIMEOUT_S, check=False)
        if proc.returncode != 0:
            return {"available": False}
        data = strict_json(proc.stdout)
        return {"available": True, "python": data.get("python"), "distributions": data.get("distributions")}
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return {"available": False}


# ── progress / failure records ─────────────────────────────────────────────


class Progress:
    def __init__(self, out: Path, started_at: str):
        self.path = out / "progress.json"
        self.tmp = out / ".progress.json.tmp"
        self.state = {"schema": "studio-yebisu.voicestudio-example.progress.v1",
                      "state": "running", "phase": "start", "started_at": started_at}

    def update(self, **fields) -> None:
        self.state.update(fields)
        self.state["updated_at"] = utc_now()
        self.tmp.write_bytes(json_bytes(self.state))
        os.replace(self.tmp, self.path)


def role_split() -> dict:
    return {
        "author": f"{AUTHOR} wrote run_example.py, inputs/jobs.json and implementation.md. "
                  "The author did not execute them and claims no execution or QA.",
        "operator": "Prepared the isolated environment and pinned model files, started the unmodified "
                    "VoiceStudio backend on loopback, and executes this program.",
        "voicestudio_original": "backend.speech_client CLI (multipart POST), FastAPI route "
                                "/v1/audio/transcriptions, licence/model checks, FasterWhisperBackend.",
        "asr_model": f"{MODEL_REPO}@{MODEL_REVISION} run by faster-whisper/CTranslate2 inside the backend.",
        "wrapper": "This program: verification, one-shot orchestration, archiving of exact CLI stdout, "
                   "TXT projection of the returned text field, and this record.",
        "later_site": "A separate phase builds a browser diagram that only reads these saved files and "
                      "replays the existing WAVs. It runs no ASR, TTS or model.",
    }


# ── main ───────────────────────────────────────────────────────────────────


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--source", required=True, help="fixed full VoiceStudio checkout (read only)")
    parser.add_argument("--python", required=True, help="interpreter that runs the original CLI")
    parser.add_argument("--url", default=DEFAULT_URL, help="loopback VoiceStudio backend root")
    parser.add_argument("--out", required=True, help="new or empty output folder")
    parser.add_argument("--jobs", default=str(DEFAULT_JOBS), help="jobs file (default inputs/jobs.json)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        url = loopback_base_url(args.url)
        paths = resolve_paths(args)
    except ArgError as exc:
        print(f"run_example: {exc}", file=sys.stderr)
        return 2

    out = paths["out"]
    out.mkdir(exist_ok=True)
    started_at = utc_now()
    progress = Progress(out, started_at)
    progress.update(phase="verify_source")

    env, env_policy = child_env()
    secrets = [env.get("OMNIVOICE_API_KEY", "").strip()]
    http = Http(url, secrets)
    cli = {"capabilities": {"attempted": 0, "succeeded": 0},
           "transcribe": {"attempted": 0, "succeeded": 0}}
    completed: list[dict] = []
    phase = "verify_source"

    try:
        script_bytes = Path(__file__).resolve().read_bytes()
        pins, pins_raw = load_pins()
        source_files = verify_source(paths["source"], pins)

        phase = "verify_inputs"
        progress.update(phase=phase)
        jobs, jobs_raw = load_jobs(paths["jobs"])
        inputs_before = {job["id"]: verify_wav(job) for job in jobs}

        phase = "readiness"
        progress.update(phase=phase)
        health = check_health(http.get_json("/health", phase))
        openapi = check_openapi(http.get_json("/openapi.json", phase))
        engines_before = asr_engine_subset(http.get_json("/engines", phase), phase)
        check_engine_selection(engines_before, phase)
        model_expected_bytes = sum(f["bytes"] for f in pins["asr_model"]["files"])
        model_state = check_model(http.get_json("/models", phase), model_expected_bytes)
        packages = probe_package_versions(paths["python"], out)

        phase = "capabilities"
        progress.update(phase=phase, cli_invocations=cli)
        cli["capabilities"]["attempted"] += 1
        outcome = run_cli(paths, env, url, ["capabilities"], CAPABILITIES_TIMEOUT_S)
        if outcome["timed_out"] or outcome["returncode"] != 0 or not outcome["stdout"]:
            raise cli_failure(phase, outcome, secrets)
        try:
            capabilities_doc = strict_json(outcome["stdout"])
        except ValueError as exc:
            raise RunError(phase, "invalid_json", "capabilities stdout is not strict JSON",
                           stdout_bytes=len(outcome["stdout"])) from exc
        capabilities = check_capabilities(capabilities_doc)
        write_new(out / "capabilities.json", outcome["stdout"])
        cli["capabilities"]["succeeded"] += 1
        capabilities.update({
            "file": "capabilities.json",
            "sha256": sha256_hex(outcome["stdout"]),
            "bytes": len(outcome["stdout"]),
            "stdout_preserved_exactly": True,
            "elapsed_s": round(outcome["elapsed_s"], 3),
        })

        for job in jobs:
            job_id = job["id"]
            wav = inputs_before[job_id]
            phase = f"transcribe:{job_id}"
            progress.update(phase=phase, cli_invocations=cli,
                            completed_jobs=[c["id"] for c in completed])
            cli["transcribe"]["attempted"] += 1
            started = utc_now()
            outcome = run_cli(paths, env, url,
                              ["transcribe", str(wav["path"]), "--model", REQUEST["model"],
                               "--language", REQUEST["language"], "--format", REQUEST["format"]],
                              TRANSCRIBE_TIMEOUT_S)
            if outcome["timed_out"] or outcome["returncode"] != 0 or not outcome["stdout"]:
                raise cli_failure(phase, outcome, secrets, job=job_id)
            raw = outcome["stdout"]
            # Operator preservation correction: keep the original successful CLI
            # stdout even if a later shape/timing validation rejects it. No retry.
            write_new(out / f"{job_id}.json", raw)
            try:
                doc = strict_json(raw)
            except ValueError as exc:
                raise RunError(phase, "invalid_json", "transcribe stdout is not strict JSON", job=job_id,
                               stdout_bytes=len(raw), stdout_sha256=sha256_hex(raw)) from exc
            try:
                response = validate_verbose(doc, wav["seconds"])
            except RunError as exc:
                exc.phase = phase
                exc.detail.update(job=job_id, stdout_bytes=len(raw), stdout_sha256=sha256_hex(raw))
                raise
            txt = (doc["text"] + "\n").encode("utf-8")
            write_new(out / f"{job_id}.txt", txt)
            cli["transcribe"]["succeeded"] += 1
            after = verify_wav(job)
            completed.append({
                "id": job_id,
                "started_at": started,
                "elapsed_s": round(outcome["elapsed_s"], 3),
                "input": {key: wav[key] for key in wav if key != "path"},
                "input_unchanged_after_request": after["sha256"] == wav["sha256"],
                "raw_output": {
                    "file": f"{job_id}.json",
                    "bytes": len(raw),
                    "sha256": sha256_hex(raw),
                    "ends_with_lf": raw.endswith(b"\n"),
                    "provenance": "exact stdout bytes of the original CLI, which writes the HTTP "
                                  "response body and appends LF when the body lacks one",
                },
                "txt_projection": {
                    "file": f"{job_id}.txt",
                    "bytes": len(txt),
                    "sha256": sha256_hex(txt),
                    "derivation": "wrapper packaging: the returned 'text' field of the saved JSON plus one LF; "
                                  "not another API output, model pass or correction",
                },
                "response": response,
                "reference": {
                    "text": job["reference_text"],
                    "sent_to_voicestudio": False,
                    "literal_equal_to_returned_text": response["text"] == job["reference_text"],
                },
            })

        phase = "post_state"
        progress.update(phase=phase, cli_invocations=cli, completed_jobs=[c["id"] for c in completed])
        engines_after = asr_engine_subset(http.get_json("/engines", phase), phase)
        check_engine_selection(engines_after, phase)

        phase = "final_checks"
        progress.update(phase=phase)
        source_after = verify_source(paths["source"], pins)
        inputs_after = {job["id"]: verify_wav(job)["sha256"] == job["sha256"] for job in jobs}

        jobs_rel = (paths["jobs"].relative_to(CASE_ROOT).as_posix()
                    if is_within(paths["jobs"], CASE_ROOT) else "<--jobs outside case root>")
        results = {
            "schema": "studio-yebisu.voicestudio-example.results.v1",
            "status": "completed",
            "started_at": started_at,
            "finished_at": utc_now(),
            "roles": role_split(),
            "wrapper": {
                "script": "run_example.py",
                "script_sha256": sha256_hex(script_bytes),
                "jobs_file": jobs_rel,
                "jobs_sha256": sha256_hex(jobs_raw),
                "pins_file": "vendor/pins.json",
                "pins_sha256": sha256_hex(pins_raw),
                "wrapper_python": ".".join(map(str, sys.version_info[:3])),
                "child_environment_policy": env_policy,
                "rerun_policy": "Not idempotent. Every file is created exclusively; a rerun needs a new "
                                "empty --out chosen by the operator.",
            },
            "source_pin": {
                "repository": pins["upstream"]["repository"],
                "commit": pins["upstream"]["commit"],
                "version": pins["upstream"]["version"],
                "license": pins["upstream"]["license"],
                "archive_sha256": pins["upstream"]["archive_sha256"],
                "official_gitblobs_verified_by_operator_before_run": pins["upstream"]["all_official_raw_Gitblobs_verified"],
                "selected_files_checked_by_this_run": len(source_files),
                "selected_files_unchanged_after_run": all(r["match"] for r in source_after),
                "selected_files": source_files,
                "scope": "This run re-checks only the 20 selected files (bytes, SHA-256, Git blob) in --source. "
                         "Whole-tree/archive verification is operator evidence, not repeated here.",
            },
            "model_pin": pins["asr_model"],
            "readiness": {
                "meaning": "Setup/readiness observations from GET requests. Not proof of model execution.",
                "health": health,
                "openapi": openapi,
                "engines_before": engines_before,
                "model": model_state,
            },
            "capabilities": capabilities,
            "request": {
                "argv_capabilities": ["<--python>", "-m", "backend.speech_client", "--engine-url", url,
                                      "capabilities"],
                "argv_transcribe": ["<--python>", "-m", "backend.speech_client", "--engine-url", url,
                                    "transcribe", "<case>/inputs/audio/<id>.wav", "--model", REQUEST["model"],
                                    "--language", REQUEST["language"], "--format", REQUEST["format"]],
                "cwd": "<--source>",
                "multipart_fields_per_pinned_cli_source": ["model", "response_format", "language", "file"],
                "file_part": "filename=<id>.wav, Content-Type audio/wav, unchanged WAV bytes",
                "not_sent": ["prompt", "initial_prompt", "temperature", "timestamp_granularities[]", "stream"],
                "reference_text_sent": False,
                "word_timestamps_requested": False,
                "explicit_engine_guard": "model=faster-whisper is a VoiceStudio ASR engine id, so the pinned "
                                         "route answers 400 model_not_active instead of substituting another engine.",
                "retries": 0,
                "fallbacks": "none",
                "observed_by_wrapper": "argv and exit status/stdout only; multipart bytes are built inside the "
                                       "original CLI and are described from its pinned source.",
            },
            "cli_invocations": cli,
            "wrapper_http_requests": http.log,
            "jobs": completed,
            "inputs_unchanged_after_run": inputs_after,
            "executed": {
                "meaning": "Execution evidence: successful original CLI -> HTTP calls with the explicit engine "
                           "guard, plus the original /engines post-state below as observed.",
                "transcriptions_succeeded": cli["transcribe"]["succeeded"],
                "engines_after": engines_after,
                "not_inferred": "Model load count, cache lifetime and numeric precision are not inferred from "
                                "'available'. The route may build a new adapter per request; one load is not "
                                "promised. Only the fields shown are observed values.",
            },
            "segment_field_note": "verbose_json segment fields seek, tokens, temperature, avg_logprob, "
                                  "compression_ratio and no_speech_prob are filled with neutral defaults by "
                                  "the route because FasterWhisperBackend's normalised segments do not carry "
                                  "them. They do not measure decoder temperature or confidence.",
            "package_versions": {
                "supplied_interpreter": packages,
                "note": "Distribution metadata read from --python with -I (no package import). "
                        "Server-reported runtime versions are in the /engines subsets.",
            },
            "elapsed_note": "Single run wall-clock of each CLI process: interpreter start, multipart upload, "
                            "server queueing, any model load and decoding. Not a benchmark.",
            "not_verified": [
                "transcription accuracy, word error rate, semantic or timing correctness",
                "word-level alignment (no word granularity requested)",
                "quality ranking against other engines or models",
                "646-language coverage",
                "microphone recording, desktop app, dictation shortcut, text insertion",
                "MCP, WebSocket streaming (advertised only)",
                "translation, TTS, voice cloning/design, dubbing, diarisation",
                "general performance",
                "human audition or human aesthetic approval",
                "internal activations or attention",
            ],
        }
        write_new(out / "results.json", json_bytes(results))
        progress.update(state="completed", phase="done", cli_invocations=cli,
                        completed_jobs=[c["id"] for c in completed], finished_at=results["finished_at"])
        print(f"run_example: completed {cli['transcribe']['succeeded']}/3 transcriptions; results.json written")
        return 0

    except (RunError, Exception, KeyboardInterrupt) as exc:  # noqa: BLE001 - always leave a failure record
        if isinstance(exc, RunError):
            failure_phase, kind, message, detail = exc.phase, exc.kind, exc.message, exc.detail
        elif isinstance(exc, KeyboardInterrupt):
            failure_phase, kind, message, detail = phase, "interrupted", "interrupted by operator", {}
        else:
            failure_phase, kind = phase, "unexpected"
            message, detail = redact(f"{type(exc).__name__}: {exc}", secrets)[:ERROR_EXCERPT_CHARS], {}
        failure = {
            "schema": "studio-yebisu.voicestudio-example.failure.v1",
            "status": "failed",
            "started_at": started_at,
            "failed_at": utc_now(),
            "phase": failure_phase,
            "kind": kind,
            "message": message,
            "detail": detail,
            "cli_invocations": cli,
            "wrapper_http_requests": http.log,
            "completed_jobs": [
                {"id": c["id"], "raw_output": c["raw_output"], "txt_projection": c["txt_projection"]}
                for c in completed
            ],
            "policy": "No retry, no model switch, no fallback. A failed request is not counted as success. "
                      "Any rerun must use a new empty --out at the operator's judgment.",
        }
        try:
            write_new(out / "failure.json", json_bytes(failure))
        finally:
            progress.update(state="failed", phase=failure_phase, kind=kind, cli_invocations=cli,
                            completed_jobs=[c["id"] for c in completed])
        print(f"run_example: failed in {failure_phase} ({kind}); see failure.json", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
