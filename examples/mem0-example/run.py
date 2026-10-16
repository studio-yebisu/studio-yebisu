#!/usr/bin/env python3
"""
Remember two fictional readers' preferences with the pinned Mem0 OSS Memory API, then search,
update, delete and reopen them in a fresh process.

Copyright (c) 2026 Studio Yebisu. MIT License.
Upstream code in vendor/mem0/: mem0ai/mem0 at 0724291, Apache License 2.0,
Copyright [2023] [Taranjeet Singh]. Embedding model: sentence-transformers/
paraphrase-multilingual-MiniLM-L12-v2 at e8f8c21, Apache-2.0 (weights are not distributed).

Run from this folder after the one-time setup in README.md:

    python run.py --model-dir <MODEL_DIR> --artifact-dir <ARTIFACT_DIR>

<MODEL_DIR> holds the 11 model files listed in input/model-source.json. <ARTIFACT_DIR> must be
empty or absent. Both must be outside this folder. Steps, in order; any failed check stops the
run and nothing is published:

1. Verify the 3 frozen inputs, vendor-lock.json and the 156 pinned upstream files (SHA-256),
   and the 11 model files (exact size plus LFS SHA-256, or Git blob SHA-1 for small files).
2. Refuse socket connections and name lookups with an audit hook (installed before any
   third-party import), set MEM0_TELEMETRY=false, offline Hugging Face flags and a private
   MEM0_DIR, then import Mem0 from vendor/mem0 rather than from pip.
3. Memory.from_config: the HuggingFace embedder (a local SentenceTransformer on CPU), embedded
   on-disk Qdrant and SQLite history. Memory always builds an LLM client; here it is the
   official Ollama provider aimed at a closed local port, and it is never called because every
   add uses infer=False.
4. M01-M06 in this process: add 7 rows, three searches, update, delete, history.
5. Close SQLite and the embedded Qdrant client, then start this file again as a fresh process
   (--reopen-worker) that reopens the same storage and runs M07 (reopen) and M08 (guards).
6. Write outputs/memory-run.json once, after every check passed. An existing record is never
   overwritten.

The Qdrant folder, history.db, MEM0_DIR, the worker logs and the model stay private. The
public record holds API inputs and responses, checks, versions and file hashes; no local paths.
"""

from __future__ import annotations

import argparse
import contextlib
import copy
import datetime as dt
import gc
import hashlib
import importlib.metadata
import importlib.util
import json
import logging
import math
import os
import platform
import random
import re
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any

sys.dont_write_bytecode = True  # keep __pycache__ out of the pinned vendor copy

# --- Network guard ---------------------------------------------------------------------------
# Installed at import time, before torch, sentence-transformers, qdrant-client or Mem0 load.
# Each attempt is recorded and refused; any recorded attempt fails the whole run, even when a
# library catches the refusal and carries on.

NETWORK_EVENTS = frozenset({
    "socket.connect",
    "socket.getaddrinfo",
    "socket.gethostbyname",
    "socket.gethostbyaddr",
    "socket.sendto",
    "socket.sendmsg",
})
NETWORK_ATTEMPTS: list[dict[str, str]] = []


class NetworkBlocked(ConnectionRefusedError):
    """Raised from the audit hook so the attempted connection never happens."""


def _describe_target(event: str, args: tuple) -> str:
    try:
        if event in ("socket.connect", "socket.sendto", "socket.sendmsg"):
            target = args[1] if len(args) > 1 else None
        elif event == "socket.getaddrinfo":
            target = tuple(args[:2])
        else:
            target = args[0] if args else None
        if isinstance(target, tuple):
            return ":".join(str(part) for part in target[:2])[:200]
        return str(target)[:200]
    except Exception:
        return "unknown"


def _network_guard(event: str, args: tuple) -> None:
    if event in NETWORK_EVENTS:
        NETWORK_ATTEMPTS.append({"event": event, "target": _describe_target(event, args)})
        raise NetworkBlocked(f"network access is blocked during this run ({event})")


sys.addaudithook(_network_guard)

# --- Fixed facts ------------------------------------------------------------------------------

SITE = Path(__file__).resolve().parent
VENDOR = SITE / "vendor" / "mem0"
VENDOR_LOCK = SITE / "vendor-lock.json"
RECORD_PATH = SITE / "outputs" / "memory-run.json"
RECORD_FORMAT = "studio-yebisu-mem0-run-v1"
WORKER_FORMAT = "studio-yebisu-mem0-worker-v1"

REPOSITORY = "mem0ai/mem0"
COMMIT = "0724291bd864cf807e88ee8981c8226644e8fb42"
SDK_VERSION = "2.2.1"
VENDOR_FILE_COUNT = 156
VENDOR_LOCK_SHA256 = "5d9c8621c664d589a4be8d9b13cadd25370811ad1e5967409cd1e9feb83a1e94"

# Frozen before execution (runtime/input-lock.json).
INPUT_SHA256 = {
    "input/memories.json": "ef9f585026e5cb4e5c0f32fa02af0117ede2dd2d7b0b5d9a4fb6fe87386c161c",
    "input/model-source.json": "4e51d6fc32c2b93c5c5dfdad32bc870ebeb379548ea87e90cd50bd10f5fcd9af",
    "input/scenarios.json": "ec089d59c70d1442313fe797349acbbbb9999e7ec6ba2c04131df02bf8a2acdb",
}

MODEL_REPOSITORY = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
MODEL_COMMIT = "e8f8c211226b894fcb81acc59f3b34ba3efd5f42"
MODEL_DIMS = 384
MODEL_FILE_COUNT = 11

COLLECTION = "studio_yebisu_mem0"
UNUSED_LLM_MODEL = "unused-in-infer-false"
UNUSED_LLM_URL = "http://127.0.0.1:9"
SEED = 2201
CPU_THREADS = 4
WORKER_TIMEOUT_SECONDS = 120
GET_ALL_TOP_K = 20
OUT_OF_RANGE_THRESHOLD = 1.1  # used by the M08 threshold_out_of_range case

SCENARIO_OPERATIONS = {
    "M01": "add", "M02": "search", "M03": "search", "M04": "search",
    "M05": "update", "M06": "delete", "M07": "reopen", "M08": "guard",
}
SCENARIO_IDS = list(SCENARIO_OPERATIONS)
EXPECTED_USER_COUNTS = {"aya": 4, "ken": 3}
VALIDATION_CASES = ["missing_filters", "top_level_user_id", "threshold_out_of_range"]

# Packages whose versions are recorded; the first group must be importable.
REQUIRED_PACKAGES = ("torch", "sentence-transformers", "transformers", "qdrant-client", "ollama",
                     "numpy", "pydantic", "openai", "httpx", "posthog", "requests")
OTHER_PACKAGES = ("huggingface-hub", "tokenizers", "safetensors", "portalocker")
CREDENTIAL_ENV = ("OPENAI_API_KEY", "MEM0_API_KEY", "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN",
                  "HUGGINGFACE_API_KEY", "ANTHROPIC_API_KEY")

PUBLIC_RUN_COMMAND = "python run.py --model-dir <MODEL_DIR> --artifact-dir <ARTIFACT_DIR>"
PUBLIC_WORKER_COMMAND = "python run.py --reopen-worker <ARTIFACT_DIR> --model-dir <MODEL_DIR>"


class RunError(RuntimeError):
    pass


def require(condition: Any, message: str) -> None:
    if not condition:
        raise RunError(message)


def log(message: str) -> None:
    print(f"[run] {message}", flush=True)


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def is_within(child: Path, parent: Path) -> bool:
    return child == parent or child.is_relative_to(parent)


def load_json(path: Path) -> Any:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def sha256_and_blob_sha1(path: Path, size: int) -> tuple[str, str]:
    """One pass: content SHA-256 and the Git blob SHA-1 ("blob <size>\\0" + content)."""
    sha256 = hashlib.sha256()
    blob = hashlib.sha1(f"blob {size}\0".encode())
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            sha256.update(block)
            blob.update(block)
    return sha256.hexdigest(), blob.hexdigest()


def jsonable(value: Any) -> Any:
    """Convert API results to JSON values without dropping any field."""
    if value is None or isinstance(value, (bool, str, int)):
        return value
    if isinstance(value, float):
        require(math.isfinite(value), "an API result contains a non-finite number")
        return value
    if isinstance(value, dict):
        return {str(key): jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(item) for item in value]
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    if hasattr(value, "model_dump"):
        return jsonable(value.model_dump())
    scalar = getattr(value, "item", None)  # numpy scalars
    if callable(scalar):
        return jsonable(scalar())
    raise RunError(f"cannot record a value of type {type(value).__name__}")


# --- Verification of inputs, upstream files and the model ------------------------------------

def read_inputs() -> SimpleNamespace:
    digests = {}
    for rel, expected in INPUT_SHA256.items():
        path = SITE / rel
        require(path.is_file(), f"missing frozen input {rel}")
        digest = sha256_file(path)
        require(digest == expected, f"{rel} changed: SHA-256 {digest} is not the frozen {expected}")
        digests[rel] = digest

    memories = load_json(SITE / "input/memories.json")
    require(memories.get("format") == "studio-yebisu-mem0-input-v1", "memories.json: unexpected format")
    require(memories.get("fictional") is True, "memories.json must be marked fictional")
    rows = memories.get("memories")
    require(isinstance(rows, list) and len(rows) == 7, "memories.json must hold exactly 7 rows")
    keys = [row.get("key") for row in rows]
    require(len(set(keys)) == 7, "memory keys must be unique")
    counts: dict[str, int] = {}
    for row in rows:
        require(isinstance(row.get("text"), str) and row["text"].strip(), f"{row.get('key')}: empty text")
        require(row.get("user_id") in EXPECTED_USER_COUNTS, f"{row['key']}: unexpected user_id")
        metadata = row.get("metadata")
        require(isinstance(metadata, dict) and metadata.get("source_key") == row["key"],
                f"{row['key']}: metadata.source_key must equal the key")
        require(isinstance(metadata.get("topic"), str), f"{row['key']}: metadata.topic missing")
        counts[row["user_id"]] = counts.get(row["user_id"], 0) + 1
    require(counts == EXPECTED_USER_COUNTS, f"memories.json: per-user counts {counts}")

    scenarios = load_json(SITE / "input/scenarios.json")
    require(scenarios.get("format") == "studio-yebisu-mem0-scenarios-v1", "scenarios.json: unexpected format")
    listed = scenarios.get("scenarios")
    require(isinstance(listed, list) and [s.get("id") for s in listed] == SCENARIO_IDS,
            "scenarios.json must list M01-M08 in order")
    by_id = {s["id"]: s for s in listed}
    for scenario_id, operation in SCENARIO_OPERATIONS.items():
        require(by_id[scenario_id].get("operation") == operation, f"{scenario_id}: operation is not {operation}")
    require(by_id["M01"].get("infer") is False, "M01 must use infer=False")
    for scenario_id in ("M02", "M03", "M04", "M07", "M08"):
        scenario = by_id[scenario_id]
        require(isinstance(scenario.get("query"), str) and isinstance(scenario.get("filters"), dict),
                f"{scenario_id}: query and filters are required")
    require(by_id["M05"].get("key") in keys and isinstance(by_id["M05"].get("text"), str), "M05: key and text")
    require(by_id["M06"].get("key") in keys, "M06: key")
    require(by_id["M08"].get("validation_cases") == VALIDATION_CASES, "M08: unexpected validation cases")

    source = load_json(SITE / "input/model-source.json")
    require(source.get("format") == "studio-yebisu-embedding-source-v1", "model-source.json: unexpected format")
    require(source.get("repository") == MODEL_REPOSITORY and source.get("commit") == MODEL_COMMIT,
            "model-source.json: unexpected model pin")
    require(source.get("dimensions") == MODEL_DIMS, "model-source.json: dimensions must be 384")
    files = source.get("files")
    require(isinstance(files, list) and len(files) == MODEL_FILE_COUNT, "model-source.json must list 11 files")
    paths = [entry.get("path") for entry in files]
    require(len(set(paths)) == MODEL_FILE_COUNT, "model-source.json: duplicate paths")
    for rel in paths:
        require(isinstance(rel, str) and not Path(rel).is_absolute() and ".." not in Path(rel).parts,
                f"model-source.json: unsafe path {rel!r}")

    return SimpleNamespace(digests=digests, rows=rows, scenarios=by_id, model_source=source)


def verify_vendor() -> dict:
    lock_digest = sha256_file(VENDOR_LOCK)
    require(lock_digest == VENDOR_LOCK_SHA256, f"vendor-lock.json changed: {lock_digest}")
    lock = load_json(VENDOR_LOCK)
    require(lock.get("format") == "studio-yebisu-mem0-source-lock-v1", "vendor-lock.json: unexpected format")
    require(lock.get("repository") == REPOSITORY and lock.get("commit") == COMMIT, "vendor-lock.json: unexpected pin")
    files = lock.get("files_sha256")
    require(isinstance(files, dict) and len(files) == VENDOR_FILE_COUNT, "vendor-lock.json must list 156 files")
    for rel, expected in files.items():
        path = VENDOR / rel
        require(path.is_file(), f"vendor/mem0/{rel} is missing")
        require(sha256_file(path) == expected, f"vendor/mem0/{rel} differs from the pinned upstream file")
    present = {path.relative_to(VENDOR).as_posix() for path in VENDOR.rglob("*") if path.is_file()}
    extra = sorted(present - set(files))
    require(not extra, f"unexpected files in vendor/mem0 (first ones: {extra[:5]})")
    pyproject = (VENDOR / "pyproject.toml").read_text(encoding="utf-8")
    version = re.search(r'^version = "([^"]+)"', pyproject, re.MULTILINE)
    require(version and version.group(1) == SDK_VERSION, "vendor/mem0/pyproject.toml is not version 2.2.1")
    return {"files_verified": len(files), "vendor_lock_sha256": lock_digest}


def verify_model(model_dir: Path, source: dict) -> dict:
    lines = []
    total = 0
    for entry in source["files"]:
        rel = entry["path"]
        path = model_dir / rel
        require(path.is_file(), f"model file missing: {rel}")
        size = path.stat().st_size
        require(size == entry["bytes"], f"model file {rel}: {size} bytes, expected {entry['bytes']}")
        sha256, blob_sha1 = sha256_and_blob_sha1(path, size)
        if entry.get("sha256"):
            require(sha256 == entry["sha256"], f"model file {rel}: LFS SHA-256 mismatch")
        else:
            require(blob_sha1 == entry["git_blob_sha1"], f"model file {rel}: Git blob SHA-1 mismatch")
        lines.append(f"{rel}\t{size}\t{sha256}\n")
        total += size
    expected = {entry["path"] for entry in source["files"]}
    present = set()
    for path in model_dir.rglob("*"):
        rel = path.relative_to(model_dir)
        if path.is_file() and rel.parts[0] != ".cache":  # snapshot_download keeps its own metadata there
            present.add(rel.as_posix())
    extra = sorted(present - expected)
    require(not extra, f"unexpected files in the model directory (first ones: {extra[:5]})")
    digest = hashlib.sha256("".join(sorted(lines)).encode("utf-8")).hexdigest()
    return {"files_verified": len(lines), "bytes": total, "files_digest_sha256": digest}


def resolve_private_dir(path: Path, name: str) -> Path:
    resolved = path.expanduser().resolve()
    require(not is_within(resolved, SITE) and not is_within(SITE, resolved),
            f"{name} must be outside the published folder")
    return resolved


# --- Environment and imports ------------------------------------------------------------------

def prepare_environment(artifact_dir: Path) -> None:
    """Set before Mem0 is imported: its setup module reads MEM0_DIR and telemetry at import."""
    for name in CREDENTIAL_ENV:
        os.environ.pop(name, None)
    os.environ.update({
        "MEM0_TELEMETRY": "false",
        "MEM0_DIR": str(artifact_dir / "mem0-home"),
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
        "HF_HUB_DISABLE_TELEMETRY": "1",
        "HF_HOME": str(artifact_dir / "hf-home"),
        "TOKENIZERS_PARALLELISM": "false",
        "OMP_NUM_THREADS": str(CPU_THREADS),
        "MKL_NUM_THREADS": str(CPU_THREADS),
        "PYTHONDONTWRITEBYTECODE": "1",
    })
    (artifact_dir / "mem0-home").mkdir(exist_ok=True)
    (artifact_dir / "hf-home").mkdir(exist_ok=True)


def use_vendor_mem0(artifact_dir: Path, *, create: bool) -> None:
    """Import mem0 from vendor/mem0.

    mem0/__init__.py reads importlib.metadata.version("mem0ai"). Instead of pip-installing the
    package, the run writes the minimal dist-info pip would write (name and the version from the
    pinned pyproject.toml) into the private artifact directory. No upstream file is changed.
    """
    try:
        installed = importlib.metadata.version("mem0ai")
    except importlib.metadata.PackageNotFoundError:
        installed = None
    require(installed is None, f"mem0ai {installed} is installed in this environment; uninstall it so "
                               "only the pinned copy in vendor/mem0 is imported")
    require(importlib.util.find_spec("mem0") is None, "another 'mem0' package is importable; remove it first")
    meta_root = artifact_dir / "python-meta"
    metadata = meta_root / f"mem0ai-{SDK_VERSION}.dist-info" / "METADATA"
    content = f"Metadata-Version: 2.1\nName: mem0ai\nVersion: {SDK_VERSION}\n"
    if create:
        metadata.parent.mkdir(parents=True)
        metadata.write_text(content, encoding="utf-8", newline="\n")
    else:
        require(metadata.read_text(encoding="utf-8") == content, "dist-info written by the first process changed")
    sys.path.insert(0, str(meta_root))
    sys.path.insert(0, str(VENDOR))


def import_stack() -> SimpleNamespace:
    # spaCy would download en_core_web_sm and fastembed would download Qdrant/bm25 on first use.
    # Both are optional in Mem0; without them search is semantic-only and the run stays offline.
    for optional in ("spacy", "fastembed"):
        require(importlib.util.find_spec(optional) is None,
                f"{optional} is installed; this example runs without it (see README)")
    import numpy
    import torch

    torch.set_num_threads(CPU_THREADS)
    random.seed(SEED)
    numpy.random.seed(SEED)
    torch.manual_seed(SEED)

    import mem0
    from mem0 import Memory
    from mem0.memory import telemetry

    require(is_within(Path(mem0.__file__).resolve(), VENDOR), "mem0 was not imported from vendor/mem0")
    require(mem0.__version__ == SDK_VERSION, f"mem0 reports version {mem0.__version__}")
    require(telemetry.MEM0_TELEMETRY is False, "Mem0 telemetry is not disabled")
    require(torch.get_num_threads() == CPU_THREADS, "torch did not accept 4 CPU threads")
    return SimpleNamespace(Memory=Memory, mem0=mem0, torch=torch)


def environment_versions(stack: SimpleNamespace) -> dict:
    versions: dict[str, Any] = {
        "python": platform.python_version(),
        "implementation": platform.python_implementation(),
        "os": f"{platform.system()} {platform.machine()}",
        "sqlite": sqlite3.sqlite_version,
        "mem0": f"{stack.mem0.__version__} (vendor/mem0, not installed from pip)",
    }
    for name in REQUIRED_PACKAGES + OTHER_PACKAGES:
        try:
            value = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            value = None
        require(value or name in OTHER_PACKAGES, f"package {name} is not installed")
        versions[name.replace("-", "_")] = value
    versions["torch_cuda"] = stack.torch.version.cuda
    versions["torch_threads"] = stack.torch.get_num_threads()
    versions["spacy_installed"] = False
    versions["fastembed_installed"] = False
    return versions


def memory_config(model: str, qdrant_path: str, history_path: str) -> dict:
    return {
        "embedder": {
            "provider": "huggingface",
            "config": {
                "model": model,
                "embedding_dims": MODEL_DIMS,
                "model_kwargs": {"device": "cpu", "local_files_only": True, "trust_remote_code": False},
            },
        },
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": COLLECTION,
                "embedding_model_dims": MODEL_DIMS,
                "path": qdrant_path,
                "on_disk": True,
            },
        },
        # Memory.__init__ always creates an LLM client. Official Ollama provider, closed port,
        # never called: every add uses infer=False. No Ollama server is started.
        "llm": {"provider": "ollama", "config": {"model": UNUSED_LLM_MODEL, "ollama_base_url": UNUSED_LLM_URL}},
        "history_db_path": history_path,
    }


def public_memory_config() -> dict:
    return memory_config("<MODEL_DIR>", "<ARTIFACT_DIR>/qdrant", "<ARTIFACT_DIR>/history.db")


def open_memory(stack: SimpleNamespace, artifact_dir: Path, model_dir: Path) -> tuple[Any, dict]:
    config = memory_config(str(model_dir), str(artifact_dir / "qdrant"), str(artifact_dir / "history.db"))
    m = stack.Memory.from_config(config)
    st_model = m.embedding_model.model
    dimension_of = (getattr(st_model, "get_sentence_embedding_dimension", None)
                    or getattr(st_model, "get_embedding_dimension"))
    facts = {
        "llm_class": f"{type(m.llm).__module__}.{type(m.llm).__name__}",
        "llm_model": m.llm.config.model,
        "llm_called": False,
        "embedder_class": f"{type(m.embedding_model).__module__}.{type(m.embedding_model).__name__}",
        "embedding_dims": m.embedding_model.config.embedding_dims,
        "model_dimension": int(dimension_of()),
        "device": str(st_model.device),
        "vector_store_class": f"{type(m.vector_store).__module__}.{type(m.vector_store).__name__}",
        "qdrant_embedded": bool(m.vector_store.is_local),
        "history_store": type(m.db).__name__,
        "reranker": m.reranker,
    }
    require(facts["llm_class"] == "mem0.llms.ollama.OllamaLLM", "unexpected LLM provider class")
    require(facts["llm_model"] == UNUSED_LLM_MODEL and m.llm.config.ollama_base_url == UNUSED_LLM_URL,
            "the unused Ollama client is not configured as expected")
    require(facts["embedder_class"] == "mem0.embeddings.huggingface.HuggingFaceEmbedding", "unexpected embedder")
    require(facts["embedding_dims"] == MODEL_DIMS and facts["model_dimension"] == MODEL_DIMS,
            "embedding dimension is not 384")
    require(facts["device"] == "cpu", f"model is on {facts['device']}, not cpu")
    require(facts["qdrant_embedded"], "Qdrant is not running in embedded (path) mode")
    require(facts["reranker"] is None, "a reranker is configured")
    return m, facts


def close_memory(m: Any) -> dict:
    """Release SQLite (Memory.close) and the embedded Qdrant client and its folder lock."""
    entity_store_initialized = m._entity_store is not None
    client = m.vector_store.client
    m.close()
    client.close()
    return {"sqlite_closed": m.db is None, "qdrant_client_closed": True,
            "entity_store_initialized": entity_store_initialized}


# --- Small helpers over API results -----------------------------------------------------------

def results_of(response: Any, what: str) -> list:
    require(isinstance(response, dict) and isinstance(response.get("results"), list), f"{what}: no results list")
    return response["results"]


def search_call(scenario: dict, **override: Any) -> dict:
    call = {
        "query": scenario["query"],
        "filters": copy.deepcopy(scenario["filters"]),
        "top_k": scenario["top_k"],
        "threshold": scenario["threshold"],
        "explain": scenario["explain"],
    }
    call.update(override)
    return call


def run_search(m: Any, call: dict, what: str) -> tuple[dict, list]:
    response = jsonable(m.search(
        call["query"], filters=copy.deepcopy(call["filters"]), top_k=call["top_k"],
        threshold=call["threshold"], explain=call["explain"],
    ))
    results = results_of(response, what)
    for item in results:
        score = item.get("score")
        require(isinstance(score, (int, float)) and math.isfinite(score), f"{what}: result without a finite score")
        require(isinstance(item.get("id"), str) and isinstance(item.get("memory"), str), f"{what}: malformed result")
    scores = [item["score"] for item in results]
    require(scores == sorted(scores, reverse=True), f"{what}: results are not ordered by score")
    return response, results


def get_all(m: Any, user_id: str) -> dict:
    call = {"filters": {"user_id": user_id}, "top_k": GET_ALL_TOP_K}
    response = jsonable(m.get_all(filters=copy.deepcopy(call["filters"]), top_k=call["top_k"]))
    results_of(response, f"get_all {user_id}")
    return {"call": call, "response": response}


def history_events(history: list) -> list[str]:
    return sorted(str(row.get("event")) for row in history)


def seconds_in(text: str) -> str | None:
    match = re.search(r"(\d+)秒", text or "")
    return match.group(1) if match else None


def filter_label(filters: dict) -> str:
    return "・".join(f"{key}={value}" for key, value in filters.items())


# --- M01-M06 (first process) ------------------------------------------------------------------

def scenario_m01(m: Any, inputs: SimpleNamespace) -> tuple[dict, dict]:
    scenario = inputs.scenarios["M01"]
    calls, responses, ids = [], [], {}
    for row in inputs.rows:
        call = {"key": row["key"], "messages": row["text"], "user_id": row["user_id"],
                "metadata": copy.deepcopy(row["metadata"]), "infer": scenario["infer"]}
        response = jsonable(m.add(row["text"], user_id=row["user_id"], metadata=copy.deepcopy(row["metadata"]),
                                  infer=scenario["infer"]))
        results = results_of(response, f"add {row['key']}")
        require(len(results) == 1, f"add {row['key']}: expected one result, got {len(results)}")
        item = results[0]
        require(item.get("event") == "ADD", f"add {row['key']}: event {item.get('event')!r}")
        require(item.get("memory") == row["text"], f"add {row['key']}: stored text differs from the input")
        require(isinstance(item.get("id"), str) and item["id"] not in ids.values(), f"add {row['key']}: bad id")
        ids[row["key"]] = item["id"]
        calls.append(call)
        responses.append({"key": row["key"], "response": response})

    rows_by_key = {row["key"]: row for row in inputs.rows}
    listings = {user: get_all(m, user) for user in EXPECTED_USER_COUNTS}
    for user, listing in listings.items():
        records = listing["response"]["results"]
        require(len(records) == EXPECTED_USER_COUNTS[user], f"get_all {user}: {len(records)} records")
        expected_ids = {ids[row["key"]] for row in inputs.rows if row["user_id"] == user}
        require({record["id"] for record in records} == expected_ids, f"get_all {user}: id set differs")
        for record in records:
            key = next(k for k, v in ids.items() if v == record["id"])
            row = rows_by_key[key]
            require(record.get("memory") == row["text"], f"get_all {user}: text of {key} differs")
            require(record.get("user_id") == user, f"get_all {user}: {key} has user_id {record.get('user_id')!r}")
            require(record.get("metadata") == row["metadata"], f"get_all {user}: metadata of {key} differs")

    checks = {
        "adds": len(responses),
        "all_events_add": True,
        "texts_exact": True,
        "metadata_exact": True,
        "scope_counts": {user: len(listing["response"]["results"]) for user, listing in listings.items()},
        "llm_used": False,
    }
    counts = checks["scope_counts"]
    sample = {
        "id": "M01", "label": scenario["label"], "operation": scenario["operation"],
        "summary": f"{len(responses)}件を infer=False でそのまま保存。aya に{counts['aya']}件、ken に{counts['ken']}件。",
        "input": {"api": "Memory.add", "calls": calls},
        "output": {"responses": responses, "memory_ids": dict(ids), "get_all": listings, "checks": checks},
    }
    return sample, ids


def vector_check(m: Any, inputs: SimpleNamespace, ids: dict) -> dict:
    """Embed one input with the configured embedder and compare it with the stored point."""
    row = inputs.rows[0]
    vector = m.embedding_model.embed(row["text"], "add")
    require(isinstance(vector, list) and len(vector) == MODEL_DIMS, "embedding is not a 384-element list")
    require(all(isinstance(x, float) and math.isfinite(x) for x in vector), "embedding has non-finite values")
    points = m.vector_store.client.retrieve(collection_name=m.collection_name, ids=[ids[row["key"]]],
                                            with_vectors=True)
    require(len(points) == 1, "stored point for the first memory was not found")
    stored = points[0].vector
    if isinstance(stored, dict):
        stored = stored.get("")
    require(isinstance(stored, list) and len(stored) == MODEL_DIMS, "stored vector is not 384-dimensional")
    norm = math.sqrt(sum(x * x for x in vector))
    stored_norm = math.sqrt(sum(x * x for x in stored))
    require(norm > 0 and stored_norm > 0, "zero-length vector")
    cosine = sum(a * b for a, b in zip(vector, stored)) / (norm * stored_norm)
    require(cosine > 0.9999, f"stored vector differs from a fresh embedding (cosine {cosine})")
    return {
        "key": row["key"],
        "text": row["text"],
        "call": "m.embedding_model.embed(text, 'add')",
        "dimensions": len(vector),
        "all_finite": True,
        "l2_norm": norm,
        "first8": vector[:8],
        "sha256_of_json": hashlib.sha256(json.dumps(vector).encode("utf-8")).hexdigest(),
        "stored_dimensions": len(stored),
        "stored_vs_fresh_cosine": cosine,
    }


def search_sample(m: Any, inputs: SimpleNamespace, scenario_id: str, ids: dict) -> dict:
    scenario = inputs.scenarios[scenario_id]
    call = search_call(scenario)
    response, results = run_search(m, call, scenario_id)
    key_by_id = {v: k for k, v in ids.items()}
    result_keys = [key_by_id.get(item["id"]) for item in results]
    require(all(result_keys), f"{scenario_id}: a result id is not one of the 7 stored ids")
    user = scenario["filters"]["user_id"]
    user_ids = {ids[row["key"]] for row in inputs.rows if row["user_id"] == user}
    other_ids = set(ids.values()) - user_ids
    checks: dict[str, Any] = {
        "results": len(results),
        "all_user": all(item.get("user_id") == user and item["id"] in user_ids for item in results),
        "overlap_with_other_user": len({item["id"] for item in results} & other_ids),
        "scores_are": "Mem0 search scores (ranking values, not probabilities)",
    }
    require(checks["all_user"], f"{scenario_id}: a result belongs to another user")
    require(checks["overlap_with_other_user"] == 0, f"{scenario_id}: results overlap the other user")
    if scenario_id == "M04":
        require(result_keys == ["A02"], f"M04: expected only A02, got {result_keys}")
        checks["only_A02"] = True
        summary = f"{filter_label(scenario['filters'])} の絞り込みで{len(results)}件：{'・'.join(result_keys)}。"
    else:
        require(len(results) == scenario["top_k"], f"{scenario_id}: {len(results)} results, expected top_k")
        top = results[0]
        summary = (f"{user} の記録から{len(results)}件。1位は {result_keys[0]}"
                   f"（Mem0スコア {top['score']:.3f}）。")
        if scenario_id == "M03":
            summary = f"{user} の記録から{len(results)}件。aya のIDとの重なりは{checks['overlap_with_other_user']}件。"
    return {
        "id": scenario_id, "label": scenario["label"], "operation": scenario["operation"],
        "summary": summary,
        "input": {"api": "Memory.search", "call": call},
        "output": {"response": response, "result_keys": result_keys, "checks": checks},
    }


def scenario_m05(m: Any, inputs: SimpleNamespace, ids: dict) -> dict:
    scenario = inputs.scenarios["M05"]
    key = scenario["key"]
    memory_id = ids[key]
    original = next(row["text"] for row in inputs.rows if row["key"] == key)
    before = jsonable(m.get(memory_id))
    require(isinstance(before, dict) and before.get("memory") == original, "M05: get before update differs")
    update_response = jsonable(m.update(memory_id, text=scenario["text"]))
    require(isinstance(update_response, dict) and "message" in update_response, "M05: update returned no message")
    after = jsonable(m.get(memory_id))
    require(isinstance(after, dict), "M05: get after update returned nothing")
    require(after.get("id") == memory_id, "M05: id changed")
    require(after.get("memory") == scenario["text"], "M05: text was not replaced")
    require(after.get("created_at") == before.get("created_at"), "M05: created_at changed")
    require(after.get("updated_at") != before.get("updated_at"), "M05: updated_at did not change")
    require(after.get("metadata") == before.get("metadata"), "M05: metadata changed")
    history = jsonable(m.history(memory_id))
    require(isinstance(history, list) and history_events(history) == ["ADD", "UPDATE"],
            f"M05: history events {history_events(history) if isinstance(history, list) else history}")
    update_row = next(row for row in history if row.get("event") == "UPDATE")
    require(update_row.get("old_memory") == original and update_row.get("new_memory") == scenario["text"],
            "M05: UPDATE history row does not hold the old and new text")
    call = search_call(inputs.scenarios["M04"])
    search_response, results = run_search(m, call, "M05 search")
    require([item["id"] for item in results] == [memory_id], "M05: search did not return the updated memory only")
    require(results[0]["memory"] == scenario["text"], "M05: search returned the old text")
    old_s, new_s = seconds_in(original), seconds_in(scenario["text"])
    change = f"{old_s}秒→{new_s}秒" if old_s and new_s else "本文を置き換え"
    return {
        "id": "M05", "label": scenario["label"], "operation": scenario["operation"],
        "summary": (f"{key} を同じID（{memory_id[:8]}…）のまま更新：{change}。"
                    f"履歴は{len(history)}件（{'・'.join(row['event'] for row in history)}）。"),
        "input": {
            "api": ["Memory.get", "Memory.update", "Memory.get", "Memory.history", "Memory.search"],
            "key": key, "memory_id": memory_id,
            "update_call": {"memory_id": memory_id, "text": scenario["text"]},
            "search_call": call, "search_call_from": "M04",
        },
        "output": {
            "before": before, "update_response": update_response, "after": after,
            "history": history, "search_response": search_response,
            "checks": {"same_id": True, "text_replaced": True, "created_at_kept": True,
                       "history_events": [row["event"] for row in history], "search_returns_updated": True,
                       "explicit_update_by_wrapper": True},
        },
    }


def scenario_m06(m: Any, inputs: SimpleNamespace, ids: dict) -> dict:
    scenario = inputs.scenarios["M06"]
    key = scenario["key"]
    memory_id = ids[key]
    row = next(r for r in inputs.rows if r["key"] == key)
    user = row["user_id"]
    other_users = [u for u in EXPECTED_USER_COUNTS if u != user]
    other_before = {u: get_all(m, u)["response"]["results"] for u in other_users}
    before = jsonable(m.get(memory_id))
    require(isinstance(before, dict) and before.get("memory") == row["text"], "M06: get before delete differs")
    delete_response = jsonable(m.delete(memory_id))
    require(isinstance(delete_response, dict) and "message" in delete_response, "M06: delete returned no message")
    after = jsonable(m.get(memory_id))
    require(after is None, "M06: deleted memory is still returned by get")
    listings = {u: get_all(m, u) for u in EXPECTED_USER_COUNTS}
    remaining = listings[user]["response"]["results"]
    require(memory_id not in {r["id"] for r in remaining}, "M06: deleted memory is still listed")
    require(len(remaining) == EXPECTED_USER_COUNTS[user] - 1, f"M06: {user} has {len(remaining)} active records")
    for u in other_users:
        require(listings[u]["response"]["results"] == other_before[u], f"M06: records of {u} changed")
    history = jsonable(m.history(memory_id))
    require(isinstance(history, list) and "DELETE" in history_events(history), "M06: no DELETE in history")
    delete_row = next(r for r in history if r.get("event") == "DELETE")
    require(delete_row.get("is_deleted") is True, "M06: DELETE row is not marked is_deleted")
    retains_text = any(r.get("old_memory") == row["text"] or r.get("new_memory") == row["text"] for r in history)
    events = [r["event"] for r in history]
    return {
        "id": "M06", "label": scenario["label"], "operation": scenario["operation"],
        "summary": (f"{key} を削除。get は None、{user} の有効な記録は{len(remaining)}件。"
                    f"履歴には {'・'.join(events)} の{len(history)}件が残る。"),
        "input": {"api": ["Memory.get", "Memory.delete", "Memory.get", "Memory.get_all", "Memory.history"],
                  "key": key, "memory_id": memory_id, "delete_call": {"memory_id": memory_id}},
        "output": {
            "before": before, "delete_response": delete_response, "after": after,
            "get_all": listings, "history": history,
            "checks": {"get_returns_none": True, "removed_from_get_all": True,
                       "active_counts": {u: len(l["response"]["results"]) for u, l in listings.items()},
                       "other_user_unchanged": True, "history_events": events,
                       "history_retains_deleted_text": retains_text,
                       "physical_erasure_verified": False},
        },
    }


# --- Storage files (private) ------------------------------------------------------------------

SQLITE_SIDECAR = re.compile(r"-(wal|shm|journal)$")


def storage_summary(artifact_dir: Path) -> dict:
    qdrant_dir = artifact_dir / "qdrant"
    history = artifact_dir / "history.db"
    require(history.is_file(), "history.db was not written")
    require(qdrant_dir.is_dir(), "the Qdrant folder was not written")
    candidates = [history.parent / f"history.db-{suffix}" for suffix in ("wal", "shm", "journal")]
    sidecars = [p.name for p in candidates if p.exists()]
    sidecars += [p.relative_to(artifact_dir).as_posix() for p in qdrant_dir.rglob("*") if SQLITE_SIDECAR.search(p.name)]
    require(not sidecars, f"SQLite sidecar files remain after closing: {sidecars}")
    files = []
    for path in sorted(p for p in qdrant_dir.rglob("*") if p.is_file()):
        files.append({"path": path.relative_to(artifact_dir).as_posix(), "bytes": path.stat().st_size,
                      "sha256": sha256_file(path)})
    require(any(f["path"].endswith("/storage.sqlite") for f in files), "Qdrant storage.sqlite not found")
    files.append({"path": "history.db", "bytes": history.stat().st_size, "sha256": sha256_file(history)})
    return {"files": files, "sqlite_sidecars": []}


def history_db_counts(artifact_dir: Path) -> dict:
    uri = (artifact_dir / "history.db").as_uri() + "?mode=ro"
    with contextlib.closing(sqlite3.connect(uri, uri=True)) as connection:
        events = dict(connection.execute("SELECT event, COUNT(*) FROM history GROUP BY event").fetchall())
        messages = connection.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
    return {"history_rows_by_event": dict(sorted(events.items())), "messages_rows": messages}


# --- Fresh-process worker (M07, M08) ----------------------------------------------------------

def worker_m07(m: Any, inputs: SimpleNamespace, ids: dict) -> dict:
    scenario = inputs.scenarios["M07"]
    updated_key, deleted_key = inputs.scenarios["M05"]["key"], inputs.scenarios["M06"]["key"]
    updated_text = inputs.scenarios["M05"]["text"]
    call = search_call(scenario)
    response, results = run_search(m, call, "M07")
    require([item["id"] for item in results] == [ids[updated_key]], "M07: search did not return only the updated row")
    require(results[0]["memory"] == updated_text, "M07: reopened store returned the old text")
    listings = {user: get_all(m, user) for user in EXPECTED_USER_COUNTS}
    expected_active = {
        user: {ids[row["key"]] for row in inputs.rows if row["user_id"] == user and row["key"] != deleted_key}
        for user in EXPECTED_USER_COUNTS
    }
    for user, listing in listings.items():
        found = {r["id"] for r in listing["response"]["results"]}
        require(found == expected_active[user], f"M07: active records of {user} differ after reopening")
    get_updated = jsonable(m.get(ids[updated_key]))
    require(isinstance(get_updated, dict) and get_updated.get("memory") == updated_text, "M07: updated text lost")
    get_deleted = jsonable(m.get(ids[deleted_key]))
    require(get_deleted is None, "M07: deleted memory came back after reopening")
    history_updated = jsonable(m.history(ids[updated_key]))
    history_deleted = jsonable(m.history(ids[deleted_key]))
    require(history_events(history_updated) == ["ADD", "UPDATE"], "M07: history of the updated memory differs")
    require(history_events(history_deleted) == ["ADD", "DELETE"], "M07: history of the deleted memory differs")
    return {
        "call": call, "memory_ids": {updated_key: ids[updated_key], deleted_key: ids[deleted_key]},
        "search_response": response, "get_all": listings, "get_updated": get_updated,
        "get_deleted": get_deleted, "history_updated": history_updated, "history_deleted": history_deleted,
        "counts": {user: len(l["response"]["results"]) for user, l in listings.items()},
    }


def worker_m08(m: Any, inputs: SimpleNamespace) -> dict:
    scenario = inputs.scenarios["M08"]
    call = search_call(scenario)
    response, results = run_search(m, call, "M08 unknown user")
    require(results == [], f"M08: unknown user returned {len(results)} results")
    query = scenario["query"]
    bad_calls = {
        "missing_filters": (
            {"query": query, "top_k": scenario["top_k"], "threshold": scenario["threshold"],
             "explain": scenario["explain"]},
            lambda: m.search(query, top_k=scenario["top_k"], threshold=scenario["threshold"],
                             explain=scenario["explain"]),
        ),
        "top_level_user_id": (
            {"query": query, "user_id": scenario["filters"]["user_id"], "top_k": scenario["top_k"],
             "threshold": scenario["threshold"], "explain": scenario["explain"]},
            lambda: m.search(query, user_id=scenario["filters"]["user_id"], top_k=scenario["top_k"],
                             threshold=scenario["threshold"], explain=scenario["explain"]),
        ),
        "threshold_out_of_range": (
            search_call(scenario, threshold=OUT_OF_RANGE_THRESHOLD),
            lambda: m.search(query, filters=copy.deepcopy(scenario["filters"]), top_k=scenario["top_k"],
                             threshold=OUT_OF_RANGE_THRESHOLD, explain=scenario["explain"]),
        ),
    }
    validation_calls, errors = [], []
    for case in scenario["validation_cases"]:
        require(case in bad_calls, f"M08: unknown validation case {case}")
        recorded_call, invoke = bad_calls[case]
        raised: Exception | None = None
        try:
            invoke()
        except Exception as exc:  # recorded exactly as raised; anything but ValueError fails below
            raised = exc
        require(raised is not None, f"M08 {case}: the call did not raise")
        require(isinstance(raised, ValueError), f"M08 {case}: raised {type(raised).__name__}, not ValueError")
        validation_calls.append({"case": case, "call": recorded_call})
        errors.append({"case": case, "type": type(raised).__name__, "module": type(raised).__module__,
                       "message": str(raised)})
    return {"call": call, "response": response, "validation_calls": validation_calls, "errors": errors}


def worker_main(artifact_dir: Path, model_dir: Path) -> int:
    worker_dir = artifact_dir / "worker"
    result_path = worker_dir / "result.json"
    result: dict[str, Any] = {"format": WORKER_FORMAT, "ok": False, "error": None}
    m = None
    try:
        require(not result_path.exists(), "worker result already exists")
        artifact_dir = resolve_private_dir(artifact_dir, "--reopen-worker")
        model_dir = resolve_private_dir(model_dir, "--model-dir")
        handoff = load_json(worker_dir / "handoff.json")
        inputs = read_inputs()
        vendor = verify_vendor()
        model = verify_model(model_dir, inputs.model_source)
        prepare_environment(artifact_dir)
        use_vendor_mem0(artifact_dir, create=False)
        stack = import_stack()
        result["environment"] = environment_versions(stack)
        result["input_sha256"] = inputs.digests
        result["vendor"] = vendor
        result["model"] = model
        m, facts = open_memory(stack, artifact_dir, model_dir)
        result["memory_facts"] = facts
        result["m07"] = worker_m07(m, inputs, handoff["ids_by_key"])
        result["m08"] = worker_m08(m, inputs)
        result["closed"] = close_memory(m)
        m = None
        require(not NETWORK_ATTEMPTS, "network was attempted in the worker")
        result["ok"] = True
    except BaseException as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        if m is not None:
            with contextlib.suppress(Exception):
                close_memory(m)
    finally:
        result["pid"] = os.getpid()
        result["network_attempts"] = list(NETWORK_ATTEMPTS)
        worker_dir.mkdir(parents=True, exist_ok=True)
        with open(result_path, "x", encoding="utf-8", newline="\n") as handle:
            json.dump(jsonable(result), handle, ensure_ascii=False, indent=2, allow_nan=False)
    return 0 if result["ok"] and not NETWORK_ATTEMPTS else 1


def run_worker(artifact_dir: Path, model_dir: Path) -> tuple[dict, float]:
    logs = artifact_dir / "logs"
    logs.mkdir(exist_ok=True)
    command = [sys.executable, str(SITE / "run.py"), "--reopen-worker", str(artifact_dir),
               "--model-dir", str(model_dir)]
    env = dict(os.environ)
    env["PYTHONUTF8"] = "1"
    started = time.perf_counter()
    try:
        completed = subprocess.run(command, cwd=SITE, env=env, capture_output=True, text=True,
                                   encoding="utf-8", errors="replace", timeout=WORKER_TIMEOUT_SECONDS, check=False)
    except subprocess.TimeoutExpired as exc:
        (logs / "worker-stdout.txt").write_text(str(exc.stdout or ""), encoding="utf-8")
        (logs / "worker-stderr.txt").write_text(str(exc.stderr or ""), encoding="utf-8")
        raise RunError(f"the reopen worker did not finish within {WORKER_TIMEOUT_SECONDS} s (logs in the artifact dir)")
    elapsed = time.perf_counter() - started
    (logs / "worker-stdout.txt").write_text(completed.stdout, encoding="utf-8")
    (logs / "worker-stderr.txt").write_text(completed.stderr, encoding="utf-8")
    result_path = artifact_dir / "worker" / "result.json"
    result = load_json(result_path) if result_path.is_file() else {}
    require(completed.returncode == 0,
            f"the reopen worker exited with {completed.returncode}: {result.get('error')} (logs in the artifact dir)")
    require(result.get("format") == WORKER_FORMAT and result.get("ok") is True, "the reopen worker reported failure")
    result["exit_code"] = completed.returncode
    return result, elapsed


# --- Main run ---------------------------------------------------------------------------------

def find_private_strings(value: Any, forbidden: list[str], where: str = "record") -> list[str]:
    found = []
    if isinstance(value, dict):
        for key, item in value.items():
            found += find_private_strings(item, forbidden, f"{where}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            found += find_private_strings(item, forbidden, f"{where}[{index}]")
    elif isinstance(value, str):
        lowered = value.lower()
        found += [where for token in forbidden if token in lowered]
    return found


def write_record(record: dict) -> None:
    text = json.dumps(record, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    RECORD_PATH.parent.mkdir(exist_ok=True)
    temporary = RECORD_PATH.with_name(f".memory-run.{os.getpid()}.tmp")
    with open(temporary, "x", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
    if RECORD_PATH.exists():
        temporary.unlink()
        raise RunError("outputs/memory-run.json appeared during the run; it was not overwritten")
    os.replace(temporary, RECORD_PATH)


def parent_main(artifact_arg: Path, model_arg: Path) -> int:
    started_at = utc_now()
    started = time.perf_counter()
    require(not RECORD_PATH.exists(), "outputs/memory-run.json already exists; rerun in a fresh copy (see README)")
    model_dir = resolve_private_dir(model_arg, "--model-dir")
    artifact_dir = resolve_private_dir(artifact_arg, "--artifact-dir")
    require(model_dir.is_dir(), "--model-dir is not a directory")
    require(not is_within(artifact_dir, model_dir) and not is_within(model_dir, artifact_dir),
            "--artifact-dir and --model-dir must not contain each other")
    if artifact_dir.exists():
        require(artifact_dir.is_dir() and not any(artifact_dir.iterdir()), "--artifact-dir must be empty")
    else:
        artifact_dir.mkdir(parents=True)

    log("verifying frozen inputs, 156 upstream files and 11 model files")
    inputs = read_inputs()
    vendor = verify_vendor()
    model = verify_model(model_dir, inputs.model_source)

    prepare_environment(artifact_dir)
    use_vendor_mem0(artifact_dir, create=True)
    log("importing torch, sentence-transformers, qdrant-client and the vendor copy of Mem0")
    stack = import_stack()
    environment = environment_versions(stack)

    log("Memory.from_config (local embedder on CPU, embedded Qdrant, SQLite history)")
    m, facts = open_memory(stack, artifact_dir, model_dir)
    log("M01 add x7 (infer=False)")
    m01, ids = scenario_m01(m, inputs)
    m01["output"]["vector_check"] = vector_check(m, inputs, ids)
    log("M02-M04 search")
    m02 = search_sample(m, inputs, "M02", ids)
    m03 = search_sample(m, inputs, "M03", ids)
    m04 = search_sample(m, inputs, "M04", ids)
    aya_ids = {ids[row["key"]] for row in inputs.rows if row["user_id"] == "aya"}
    require(not ({item["id"] for item in m03["output"]["response"]["results"]} & aya_ids), "M03 overlaps aya")
    log("M05 update, M06 delete")
    m05 = scenario_m05(m, inputs, ids)
    m06 = scenario_m06(m, inputs, ids)
    closed = close_memory(m)
    require(closed["sqlite_closed"], "SQLite connection did not close")
    del m
    gc.collect()
    storage_before = storage_summary(artifact_dir)
    require(not NETWORK_ATTEMPTS, f"network was attempted in the first process: {NETWORK_ATTEMPTS}")

    log("M07/M08 in a fresh process")
    worker_dir = artifact_dir / "worker"
    worker_dir.mkdir()
    with open(worker_dir / "handoff.json", "x", encoding="utf-8", newline="\n") as handle:
        json.dump({"ids_by_key": ids}, handle, ensure_ascii=False, indent=2)
    worker, worker_seconds = run_worker(artifact_dir, model_dir)
    require(worker.get("network_attempts") == [], f"network was attempted in the worker: {worker.get('network_attempts')}")
    require(isinstance(worker.get("pid"), int) and worker["pid"] != os.getpid(), "the worker is not a new process")
    require(worker.get("environment") == environment, "the worker ran with different package versions")
    require(worker.get("input_sha256") == inputs.digests, "the worker saw different inputs")
    require(worker.get("vendor") == vendor, "the worker saw different upstream files")
    require(worker.get("model") == model, "the worker saw different model files")
    require(worker.get("memory_facts") == facts, "the worker built a different Memory configuration")

    db_counts = history_db_counts(artifact_dir)
    require(db_counts["history_rows_by_event"] == {"ADD": 7, "DELETE": 1, "UPDATE": 1},
            f"history.db rows by event: {db_counts['history_rows_by_event']}")
    require(db_counts["messages_rows"] == 0, "history.db holds conversation messages; infer=False should store none")
    storage_after = storage_summary(artifact_dir)

    # Nothing in the published folder may have changed during the run.
    require(read_inputs().digests == inputs.digests, "inputs changed during the run")
    require(verify_vendor() == vendor, "vendor/mem0 changed during the run")
    require(not RECORD_PATH.exists(), "outputs/memory-run.json appeared during the run")
    require(not NETWORK_ATTEMPTS, f"network was attempted: {NETWORK_ATTEMPTS}")

    m07_data, m08_data = worker["m07"], worker["m08"]
    updated_key, deleted_key = inputs.scenarios["M05"]["key"], inputs.scenarios["M06"]["key"]
    updated_seconds = seconds_in(m07_data["get_updated"]["memory"])
    counts = m07_data["counts"]
    m07 = {
        "id": "M07", "label": inputs.scenarios["M07"]["label"], "operation": "reopen",
        "summary": (f"別プロセスで開き直し：aya {counts['aya']}件・ken {counts['ken']}件。"
                    f"{updated_key} は「{updated_seconds}秒」の本文、{deleted_key} は get で None。"),
        "input": {"api": ["Memory.from_config", "Memory.search", "Memory.get_all", "Memory.get", "Memory.history"],
                  "process": "fresh", "command": PUBLIC_WORKER_COMMAND, "search_call": m07_data["call"],
                  "memory_ids": m07_data["memory_ids"]},
        "output": {
            "worker": {"exit_code": worker["exit_code"], "process_is_new": True},
            "search_response": m07_data["search_response"], "get_all": m07_data["get_all"],
            "get_updated": m07_data["get_updated"], "get_deleted": m07_data["get_deleted"],
            "history_updated": m07_data["history_updated"], "history_deleted": m07_data["history_deleted"],
            "checks": {"fresh_process": True, "active_counts": counts, "updated_text_persisted": True,
                       "deleted_not_returned": True, "same_ids_after_reopen": True},
        },
    }
    errors = m08_data["errors"]
    unknown_results = m08_data["response"]["results"]
    m08 = {
        "id": "M08", "label": inputs.scenarios["M08"]["label"], "operation": "guard",
        "summary": (f"未登録の user_id={inputs.scenarios['M08']['filters']['user_id']} の検索は{len(unknown_results)}件。"
                    f"誤った呼び出し{len(errors)}件は {'・'.join(sorted({e['type'] for e in errors}))} で止まった。"),
        "input": {"api": "Memory.search", "unknown_user_call": m08_data["call"],
                  "validation_calls": m08_data["validation_calls"]},
        "output": {"unknown_user_response": m08_data["response"], "validation_errors": errors,
                   "checks": {"unknown_user_results": len(unknown_results), "validation_errors": len(errors),
                              "error_types": [e["type"] for e in errors],
                              "isolation_is_not_authentication": True}},
    }
    samples = [m01, m02, m03, m04, m05, m06, m07, m08]
    require([s["id"] for s in samples] == SCENARIO_IDS, "sample order differs from the scenarios")

    vector = m01["output"]["vector_check"]
    record = {
        "format": RECORD_FORMAT,
        "started_at": started_at,
        "finished_at": utc_now(),
        "authorship": {
            "wrapper_and_text": "run.py, the Japanese page and explanation were authored by Claude Opus 5.5 (claude-opus-5-5); the production editor corrected the input authorship label before execution",
            "original_inputs": "Studio Yebisu production editor authored and froze the seven fictional preferences and eight scenarios before execution",
            "vectors": f"{MODEL_REPOSITORY} computed every embedding on CPU",
            "memory_operations": "the unmodified Mem0 OSS Memory API performed every add, search, update, delete and history call",
        },
        "source": {"repository": REPOSITORY, "commit": COMMIT, "version": SDK_VERSION, "license": "Apache-2.0",
                   "files_verified": vendor["files_verified"], "vendor_lock_sha256": vendor["vendor_lock_sha256"],
                   "imported_from": "vendor/mem0 (sys.path; no pip install of mem0ai)"},
        "input_sha256": inputs.digests,
        "model": {"repository": MODEL_REPOSITORY, "commit": MODEL_COMMIT, "license": "Apache-2.0",
                  "dimensions": MODEL_DIMS, "device": facts["device"], "files_verified": model["files_verified"],
                  "bytes": model["bytes"], "files_digest_sha256": model["files_digest_sha256"],
                  "weights_published": False},
        "config": {
            "infer": False,
            "telemetry": False,
            "network_blocked": True,
            "memory_config": public_memory_config(),
            "mem0_dir": "<ARTIFACT_DIR>/mem0-home",
            "hf_offline": True,
            "cpu_threads": CPU_THREADS,
            "seed": SEED,
            "search": "semantic only: spaCy (entity boost) and fastembed (BM25) are not installed",
            "memory_facts": facts,
            "entity_store_initialized": closed["entity_store_initialized"],
        },
        "command": {"run": PUBLIC_RUN_COMMAND, "worker": PUBLIC_WORKER_COMMAND},
        "environment": environment,
        "checks": {
            "passed": True,
            "source_files_verified": vendor["files_verified"],
            "vendor_unchanged_after_run": True,
            "inputs_verified": len(inputs.digests),
            "model_files_verified": model["files_verified"],
            "adds": m01["output"]["checks"]["adds"],
            "add_events_all_add": True,
            "scope_counts": m01["output"]["checks"]["scope_counts"],
            "metadata_exact": True,
            "vector_dimensions": vector["dimensions"],
            "vector_finite": vector["all_finite"],
            "stored_vector_matches_embedding": True,
            "m02_all_aya": m02["output"]["checks"]["all_user"],
            "m03_all_ken_disjoint_from_aya": m03["output"]["checks"]["all_user"],
            "m04_only_A02": True,
            "m05_same_id_text_replaced": True,
            "m05_history_events": m05["output"]["checks"]["history_events"],
            "m06_get_none_and_unlisted": True,
            "m06_history_events": m06["output"]["checks"]["history_events"],
            "m06_history_retains_deleted_text": m06["output"]["checks"]["history_retains_deleted_text"],
            "m07_fresh_process": True,
            "m07_active_counts": counts,
            "m08_unknown_user_results": len(unknown_results),
            "m08_validation_errors": len(errors),
            "history_db": db_counts,
            "storage_closed_without_sqlite_sidecars": True,
            "network_attempts": 0,
            "llm_calls": 0,
        },
        "network": {"blocked_events": sorted(NETWORK_EVENTS), "parent_attempts": list(NETWORK_ATTEMPTS),
                    "worker_attempts": worker["network_attempts"],
                    "total_attempts": len(NETWORK_ATTEMPTS) + len(worker["network_attempts"])},
        "storage": {"public": False, "note": "hashes and sizes of the private Qdrant and SQLite files",
                    "before_reopen": storage_before, "after_worker": storage_after},
        "worker": {"exit_code": worker["exit_code"], "fresh_process": True, "elapsed_seconds": round(worker_seconds, 3),
                   "same_environment": True, "same_inputs": True, "same_upstream_files": True,
                   "same_model_files": True, "same_memory_configuration": True, "closed": worker["closed"]},
        "timing": {"total_seconds": round(time.perf_counter() - started, 3)},
        "samples": samples,
    }
    record = jsonable(record)
    forbidden = set()
    for path in (model_dir, artifact_dir, SITE, Path.home()):
        forbidden.update({str(path).lower(), path.as_posix().lower()})
    leaks = find_private_strings(record, sorted(forbidden))
    require(not leaks, f"the record would contain a local path at {leaks[:3]}")
    write_record(record)
    log(f"wrote {RECORD_PATH.relative_to(SITE).as_posix()} ({len(samples)} samples, 0 network attempts)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--model-dir", type=Path, required=True,
                        help="private directory holding the 11 files in input/model-source.json")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--artifact-dir", type=Path, help="empty private directory for Qdrant, SQLite and logs")
    mode.add_argument("--reopen-worker", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    if args.reopen_worker is not None:
        return worker_main(args.reopen_worker.resolve(), args.model_dir.resolve())
    try:
        return parent_main(args.artifact_dir, args.model_dir)
    except RunError as exc:
        print(f"[run] FAILED: {exc}", file=sys.stderr, flush=True)
        print("[run] outputs/memory-run.json was not written.", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
