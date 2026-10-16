#!/usr/bin/env python3
"""
Train a tiny Transformer from scratch with the pinned upstream student track.

Copyright (c) 2026 Studio Yebisu. MIT License.
Upstream code in vendor/train-llm-from-scratch/: Copyright (c) 2025 Fareed Khan, MIT License.

Run from this folder (the artifact directory must be empty and outside this folder):

    python run.py --artifact-dir ../private-artifacts

Steps, in order. Any failed command or check stops the run and nothing is published.

1. Verify the three frozen inputs and the 48 pinned upstream files by SHA-256.
2. Upstream prepare_tiny_data.py --dataset text: split input/stories.txt, train a byte-level
   BPE on the training part, write train.h5 / val.h5 / tokenizer.json (private).
3. Upstream train_transformer.py twice with the same preset, overrides and seed:
   --steps 0 (baseline.pt, no optimizer update) and --steps 800 (trained.pt + checkpoints).
4. Read the checkpoints this run just wrote with the upstream API, compare them, and continue
   the eight frozen prompts with both models through generate_text.load_trained_model and
   model.generate (greedy: top_k 1).
5. Run the upstream generate_text.py CLI on P01 for both models and require the same text.
6. Write outputs/training-run.json once. An existing record is never overwritten.

Full subprocess logs, HDF5 data, the tokenizer and every checkpoint stay in the artifact
directory. The public record holds structured facts, losses, generated text and token ids,
and SHA-256 hashes; no local paths.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import importlib.metadata
import importlib.util
import json
import math
import os
import platform
import re
import subprocess
import sys
import time
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any

sys.dont_write_bytecode = True  # keep __pycache__ out of the published vendor copy

SITE = Path(__file__).resolve().parent
VENDOR = SITE / "vendor" / "train-llm-from-scratch"
RECORD_PATH = SITE / "outputs" / "training-run.json"
RECORD_FORMAT = "studio-yebisu-tiny-lm-run-v1"
CONFIG_FORMAT = "studio-yebisu-tiny-lm-config-v1"
PROMPTS_FORMAT = "studio-yebisu-tiny-lm-prompts-v1"
REPOSITORY = "FareedKhan-dev/train-llm-from-scratch"
COMMIT = "bdd480a518094ca834e05ab32131dc126b522d3d"

# Paths relative to this folder; every command runs with cwd = this folder.
PREPARE = "vendor/train-llm-from-scratch/scripts/prepare_tiny_data.py"
TRAIN = "vendor/train-llm-from-scratch/scripts/train_transformer.py"
GENERATE = "vendor/train-llm-from-scratch/scripts/generate_text.py"
STORIES = "input/stories.txt"
PROMPTS = "input/prompts.json"
RUN_CONFIG = "input/run-config.json"

STORY_LINES = 96
PROMPT_IDS = [f"P{i:02d}" for i in range(1, 9)]
TIMEOUT_SECONDS = {"prepare": 120, "train": 600, "generate": 120}
# Upstream main() ends with estimate_loss(model, train_config, 200); this is its constant.
FINAL_ESTIMATE_BATCHES = 200
# Folders the run never touches and that may change for unrelated reasons.
SNAPSHOT_SKIP = {".git", ".venv", "outputs", "tools"}

INPUT_SHA256 = {
    "input/prompts.json": "fa1a3d7922b294d608b82b2fb2000ae385a371d34a66e49ebdb6e834a88fc66e",
    "input/run-config.json": "097fda8dff2d3d2fd825ab0431f05f6eceafa099364cdc01b0230a47f5debf69",
    "input/stories.txt": "dfef8dc0905dc3d775cf295fd87e358cfae216d4e72e50d1d850f21e9522e80e",
}

# The pinned upstream files at commit bdd480a, as copied into vendor/ without modification.
UPSTREAM_SHA256 = {
    "config/__init__.py": "fe07c90fea01589b1b204f37666cbde0dd30d13d0666522f88868b4f06f6fb2b",
    "config/config.py": "60ee88f7c63ceedc21c8a5cedb9c113c41aa366693ef940174e10ea5abe5048f",
    "config/loader.py": "55d20ed5723fe4681804aeda089bde7713d35f5421cc03524e04d0f06aaa090b",
    "config/paths.py": "386b3a8d3790eeee4e856f97a651a16a884bbf542ab7ce85b4b87964fb64675d",
    "config/post_training_config.py": "0253724000690412f121962c5dcd7a0517f48e28f6fe338e2683ec144388a647",
    "config/presets.py": "739024fe46c2f88a18784823805090aa2dbf3ce4b8a50585d1126bdd512cdc9a",
    "data_loader/__init__.py": "62e731bd8cc7a4ce439ea7697904cc277c23035ef843b38e24f60ddfcf86f2ab",
    "data_loader/data_loader.py": "a698a182d1168a748e3e665b26fea62c5ae533b977172aacdfe299ddfc3ba1d5",
    "data_loader/preference_dataset.py": "979d20b86dae759378919d6d554cdc294f4afe021c7f5256b52909bd07d0696d",
    "data_loader/prompt_dataset.py": "264a6fb944f7def2d325e39fa0c56e5914f1e99aeccaacb4f9c3d4835b1495ce",
    "data_loader/sft_dataset.py": "bff19a8af64ad1aae6c0cfc185e387b76a6d5547b160513f75c7957c5e3a6ddb",
    "docs/foundations/bpe.md": "640026809fe8a7f6bb1e86d4502018fc1398530d0bbf2e0d0be98d9d0a4ab3ca",
    "docs/student/README.md": "f52a4a3e85100fc01842dc982dad4f215eee12423ef19712ff84a3c348ec0426",
    "LICENSE": "3af7509fdf483718aa1b8ab030d8ed639b9e43ae273321d9e7b75ddbf0e07f13",
    "pyproject.toml": "ec0e555a868f3d56d6424a43aae64981473452b11ae45a180d8dc724369abb2f",
    "README.md": "d470466c0d6683232f4e821f4eaa5d750a833eb289ef91a8f353c8009b9334ac",
    "scripts/generate_text.py": "666a5ebc631c801de190459f9cf7a5ac5b873903c08cc2ab10acac34936be25b",
    "scripts/prepare_tiny_data.py": "cf25545c11a22617d6338140e1e56958880c78315672de207377cfc19b82f528",
    "scripts/train_transformer.py": "ffa95c45f3b9538d74ce56a48a501a6a020aa50f53fcbdb5b7dd7599e9860efa",
    "src/__init__.py": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "src/checkpoint.py": "dcb70cae1554f8ee66356c187cba136011bd015f2d096d6241d8de9e02e8c10f",
    "src/device.py": "9e205e89c5d4617ec7f2698936927c58929053561d99b31324df7b3e32087d8d",
    "src/inference/__init__.py": "0e4f19166aecc81d6f5555fd6bae78de837f594723d510cca6d41d0af4f66317",
    "src/inference/quantize.py": "d1c92781d9251fa3beb086fc10223f406100ba42edfa7a7090627814f8b65a6d",
    "src/inference/sampling.py": "11f6b66167225a38c0a45ac967e404b7f31939a67571a51774ec3434b1e59e10",
    "src/inference/speculative.py": "90a28b4592c1a51ba6d56ce75e5dddb685cdf2f247eb4b1b2109dfe63f0b9b63",
    "src/models/__init__.py": "1f9d0db1be0cf0884ea44f786714ddba334fd4a4bc5405057efee6c1efa4079d",
    "src/models/attention.py": "b4fc10105c98444f2b0df9d332b2c72325210669c2e00a65b16df7fbf43ec00e",
    "src/models/factory.py": "5d0a3039be911d8e2df5b3c429713dda92817af016a3e94c8147e29b426d2ab2",
    "src/models/lora.py": "1f0a117694314e8a2bdafc9b871220a8e6a78f49091f3ea08932a236983cb44e",
    "src/models/mlp.py": "b83cebb2a63b67eddf7d5971c0e1607a73639814aa0c0f9142aac81054f7e3c3",
    "src/models/modern/__init__.py": "fbb721357e5cbd4462d50d350c5e09a08ec95cf2ecb9037a22af286b764e3fbe",
    "src/models/modern/attention.py": "eb2a1c72709e7b913f975aeb796e06e4878c9fb12e4191205a45471c562b16e2",
    "src/models/modern/block.py": "66bc7709387e24e4182874c2e945c2812e75427e4e2b91aa4dc6f37c3bc61575",
    "src/models/modern/config.py": "1ada9a1545b9dc2f816e457742490037b9648454d75f15512c06073beb3ba371",
    "src/models/modern/kv_cache.py": "36c62cfbd9b5a07cd6bc2e0122361f4d6438f6063dc717d64182eb7969031e2e",
    "src/models/modern/mlp.py": "dbf58609063535cc2cbd60db558c7d4222a56a9118d3fd22c18335d6f0e8ca10",
    "src/models/modern/model.py": "e5f79f7a8c072309eda4fa9e141cdc66d5a64ec04fa820f8d3ab80b8028ad9f7",
    "src/models/modern/moe.py": "0c80422073b64aa05a0d51fd8c0964395438fbefd198f37178f63cdc69e92406",
    "src/models/modern/norm.py": "1c5fa7bb25daed61fa6f2ef85dec98132272a89d0a05b56d8e77fbe788206491",
    "src/models/modern/rope.py": "881b4ddbb3be71b70aa558dc612edbad11973fb86bde0a3f9e2b533de2f177e4",
    "src/models/transformer.py": "ec63ac30e4443c73f7dae268cc5198868701afb90c612d62a22e69b6e4f71165",
    "src/models/transformer_block.py": "b3469698eb6825f1ec4ea50883680ed7900e882add125222571924040289b23e",
    "src/optim/__init__.py": "7dea022309245b95ac2c0bd72a4276c2fc57d86b3b2fe4b9d917c5b22220e68e",
    "src/optim/muon.py": "8cb8c859f0a4d52a7b9e0f4a9cdedd48baf1e8c1a0a5e2e809f3466670f0e5e1",
    "src/optim/schedules.py": "a0982c5f85ced7fff0968d9c45f3f22dffb9b5ac2a6f969da0e6196fd8203469",
    "src/tokenizer/__init__.py": "18613038f589bb905264aed778c52b4517c041ecb735a5367f054fa9d9c513bf",
    "src/tokenizer/bpe.py": "576ec593003e1430f2d5038b3436e50a7191e7d1abffe2dffd1841672efb4661",
}

PARAMS_RE = re.compile(r"Total number of parameters in the model: ([\d,]+) \((\S+) architecture, vocab (\d+)\)")
FINISHED_RE = re.compile(r"Finished training\. Train loss: (\S+), Dev loss: (\S+)")
LOADED_RE = re.compile(r": ([\d,]+) parameters, (\S+) architecture, window (\d+) tokens, on (\S+)$")
SAMPLE_MARKER = "\n\n--- sample 1 ---\n"


class RunError(RuntimeError):
    """A failed command or check. Nothing is published after one."""


class Checks:
    """Named checks computed from this run. A failing check stops the run."""

    def __init__(self) -> None:
        self.passed: dict[str, bool] = {}

    def require(self, name: str, ok: bool, detail: str = "") -> None:
        if not ok:
            raise RunError(f"check failed: {name}" + (f" ({detail})" if detail else ""))
        self.passed[name] = True


# --------------------------------------------------------------------------- files


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def mismatched(base: Path, expected: dict[str, str]) -> list[str]:
    """Relative paths whose bytes do not hash to the pinned value (missing files included)."""
    return [rel for rel, digest in sorted(expected.items())
            if not (base / rel).is_file() or sha256_file(base / rel) != digest]


def site_snapshot() -> dict[str, int]:
    """Relative path -> size for every file in this folder, outside SNAPSHOT_SKIP."""
    files: dict[str, int] = {}
    for root, dirs, names in os.walk(SITE):
        rel_root = Path(root).relative_to(SITE)
        if rel_root == Path("."):
            dirs[:] = [d for d in dirs if d not in SNAPSHOT_SKIP]
        for name in names:
            files[(rel_root / name).as_posix()] = (Path(root) / name).stat().st_size
    return files


def prepare_artifact_dir(value: str) -> Path:
    path = Path(value).expanduser()
    path = (path if path.is_absolute() else Path.cwd() / path).resolve()
    if path == SITE or SITE in path.parents:
        raise RunError("--artifact-dir must be outside this folder: it holds private files that are not published")
    if path.exists():
        if not path.is_dir():
            raise RunError(f"--artifact-dir is not a directory: {value}")
        if any(path.iterdir()):
            raise RunError(f"--artifact-dir must be empty: {value}")
    else:
        path.mkdir(parents=True)
    (path / "logs").mkdir()
    return path


def write_record_once(path: Path, record: dict[str, Any]) -> None:
    """Write the full JSON to a temporary file, then link it into place without overwriting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(record, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    with tmp.open("x", encoding="utf-8", newline="\n") as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    try:
        os.link(tmp, path)  # atomic, and fails if the record already exists
    except FileExistsError:
        tmp.unlink()
        raise RunError("outputs/training-run.json appeared during the run; it was not overwritten") from None
    except OSError:  # file systems without hard links
        if path.exists():
            tmp.unlink()
            raise RunError("outputs/training-run.json appeared during the run; it was not overwritten") from None
        os.replace(tmp, path)
        return
    tmp.unlink()


# --------------------------------------------------------------------------- inputs


def read_inputs(checks: Checks) -> tuple[dict[str, Any], list[dict[str, Any]], str]:
    cfg = json.loads((SITE / RUN_CONFIG).read_text(encoding="utf-8"))
    prompts_doc = json.loads((SITE / PROMPTS).read_text(encoding="utf-8"))
    stories = (SITE / STORIES).read_text(encoding="utf-8")  # the same call prepare_tiny_data.py makes

    if cfg.get("format") != CONFIG_FORMAT:
        raise RunError(f"{RUN_CONFIG}: unexpected format {cfg.get('format')!r}")
    if cfg.get("dataset") != "text" or cfg.get("tokenizer") != "bpe":
        raise RunError(f"{RUN_CONFIG}: this run supports only --dataset text with --tokenizer bpe")
    for key in ("seed", "vocab_size", "threads", "steps", "batch_size", "context_length", "t_context_length",
                "eval_every", "eval_iters", "checkpoint_every", "keep_last"):
        if not isinstance(cfg.get(key), int) or isinstance(cfg.get(key), bool) or cfg[key] < 0:
            raise RunError(f"{RUN_CONFIG}: {key} must be a non-negative integer")
    if cfg["steps"] <= 0 or cfg["checkpoint_every"] <= 0 or cfg["steps"] % cfg["checkpoint_every"]:
        raise RunError(f"{RUN_CONFIG}: steps must be a positive multiple of checkpoint_every")

    lines = stories.splitlines()
    checks.require("stories_96_nonempty_lines", len(lines) == STORY_LINES and all(line.strip() for line in lines),
                   f"{len(lines)} lines")

    prompts = prompts_doc.get("prompts")
    ok = prompts_doc.get("format") == PROMPTS_FORMAT and isinstance(prompts, list)
    ok = ok and [p.get("id") for p in prompts] == PROMPT_IDS
    for p in prompts if ok else []:
        ok = ok and isinstance(p.get("text"), str) and bool(p["text"]) and isinstance(p.get("label"), str)
        ok = ok and isinstance(p.get("max_new_tokens"), int) and p["max_new_tokens"] > 0
        ok = ok and isinstance(p.get("top_k"), int) and isinstance(p.get("seed"), int)
        ok = ok and isinstance(p.get("temperature"), (int, float)) and p["temperature"] > 0
    checks.require("prompts_frozen_p01_to_p08", ok)
    return cfg, prompts, stories


# --------------------------------------------------------------------------- commands


def child_env(threads: int) -> dict[str, str]:
    env = dict(os.environ)
    env.pop("PYTHONPATH", None)  # the upstream scripts put vendor/ first on sys.path themselves
    env.update({
        "PYTHONUTF8": "1",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONDONTWRITEBYTECODE": "1",
        "OMP_NUM_THREADS": str(threads),  # generate_text.py has no --threads flag
    })
    return env


def public_args(args: list[str], artifact: Path) -> list[str]:
    """The command as published: `python` for this interpreter, <artifact-dir> for private paths."""
    root = str(artifact)
    out = ["python"]
    for arg in args:
        if arg == root or arg.startswith(root + os.sep):
            arg = "<artifact-dir>" + arg[len(root):].replace(os.sep, "/")
        out.append(arg)
    return out


def run_cli(command_id: str, args: list[str], kind: str, artifact: Path, env: dict[str, str],
            commands: list[dict[str, Any]]) -> str:
    """Run one upstream script. Logs stay private; a non-zero exit or timeout stops the run.

    Output is captured as bytes and decoded as strict UTF-8 here. Text mode would also
    translate a lone "\\r" into "\\n", which could change text a model printed.
    """
    timeout = TIMEOUT_SECONDS[kind]
    logs = artifact / "logs"
    started = time.perf_counter()
    try:
        proc = subprocess.run([sys.executable, *args], cwd=SITE, env=env, capture_output=True,
                              timeout=timeout, check=False)
    except subprocess.TimeoutExpired as exc:
        (logs / f"{command_id}.stdout.txt").write_bytes(exc.stdout or b"")
        (logs / f"{command_id}.stderr.txt").write_bytes(exc.stderr or b"")
        raise RunError(f"{command_id} did not finish within {timeout} s") from None
    seconds = time.perf_counter() - started
    (logs / f"{command_id}.stdout.txt").write_bytes(proc.stdout)
    (logs / f"{command_id}.stderr.txt").write_bytes(proc.stderr)
    if proc.returncode != 0:
        raise RunError(f"{command_id} exited with code {proc.returncode}; the full output is in {logs}")
    try:
        stdout = proc.stdout.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise RunError(f"{command_id}: stdout is not UTF-8 ({exc})") from None
    commands.append({
        "id": command_id,
        "args": public_args(args, artifact),
        "exit_code": proc.returncode,
        "seconds": round(seconds, 3),
        "timeout_seconds": timeout,
    })
    return stdout


def train_args(cfg: dict[str, Any], data: Path) -> list[str]:
    """Arguments shared by the baseline and the trained run, all taken from the frozen config."""
    return [
        TRAIN,
        "--preset", cfg["preset"],
        "--arch", cfg["arch"],
        "--device", cfg["device"],
        "--threads", str(cfg["threads"]),
        "--train-path", str(data / "train.h5"),
        "--dev-path", str(data / "val.h5"),
        "--batch-size", str(cfg["batch_size"]),
        "--lr", json.dumps(cfg["lr"]),
        "--eval-every", str(cfg["eval_every"]),
        "--seed", str(cfg["seed"]),
        "--set", f"context_length={cfg['context_length']}",
        "--set", f"t_context_length={cfg['t_context_length']}",
        "--set", f"t_eval_iters={cfg['eval_iters']}",
        "--sample", cfg["sample"],
    ]


def parse_generate_stdout(stdout: str) -> tuple[str, str]:
    """Split generate_text.py output into its "Loaded ..." header and the sample text.

    The script prints the header, then "\\n--- sample 1 ---\\n" + text through print(), which
    adds one newline. On Windows print() writes every "\\n" as "\\r\\n"; that is detected from the
    header line the script printed and undone exactly, so a "\\r" from the model stays.
    """
    end = stdout.find("\n")
    if end <= 0:
        raise RunError("generate_text.py printed no header line")
    if stdout[end - 1] == "\r":
        stdout = stdout.replace("\r\n", "\n")
    header, marker, body = stdout.partition(SAMPLE_MARKER)
    if not marker:
        raise RunError("generate_text.py output has no '--- sample 1 ---' line")
    if not body.endswith("\n"):
        raise RunError("generate_text.py output does not end with the newline print() adds")
    return header.strip(), body[:-1]


# --------------------------------------------------------------------------- upstream API


def load_script(name: str) -> ModuleType:
    """Import an upstream script by path (its main() only runs under __main__)."""
    path = VENDOR / "scripts" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"upstream_{name}", path)
    if spec is None or spec.loader is None:
        raise RunError(f"cannot import {path.name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_upstream(checks: Checks) -> SimpleNamespace:
    if str(VENDOR) not in sys.path:
        sys.path.insert(0, str(VENDOR))
    import h5py
    import numpy as np
    import torch

    import config.presets as presets
    import src.checkpoint as checkpoint
    import src.models.factory as factory
    import src.tokenizer as tokenizer

    prepare = load_script("prepare_tiny_data")
    generate = load_script("generate_text")
    modules = (presets, checkpoint, factory, tokenizer, prepare, generate)
    checks.require("upstream_modules_loaded_from_vendor",
                   all(VENDOR in Path(m.__file__).resolve().parents for m in modules))
    return SimpleNamespace(
        h5py=h5py, np=np, torch=torch, PRESETS=presets.PRESETS,
        model_state_from_checkpoint=checkpoint.model_state_from_checkpoint,
        build_model=factory.build_model,
        EOT=tokenizer.EOT, BPETokenizer=tokenizer.BPETokenizer,
        safe_decode=tokenizer.safe_decode, tokenizer_spec=tokenizer.tokenizer_spec,
        split_text=prepare.split_text, load_trained_model=generate.load_trained_model,
    )


def round_up(value: int, multiple: int = 64) -> int:
    """Same rule as train_transformer.round_up: the embedding gets padding rows up to 64."""
    return ((value + multiple - 1) // multiple) * multiple


def load_fresh_checkpoint(up: SimpleNamespace, path: Path, artifact: Path) -> dict[str, Any]:
    """torch.load(weights_only=False) runs pickle code, so only files this run just wrote
    into the (initially empty) artifact directory are read."""
    resolved = path.resolve()
    if artifact not in resolved.parents or not resolved.is_file():
        raise RunError(f"refusing to load a checkpoint that this run did not write: {path.name}")
    return up.torch.load(resolved, map_location="cpu", weights_only=False)


def state_sha256(torch: Any, state: dict[str, Any]) -> str:
    """SHA-256 over sorted tensor names, dtype, shape and raw bytes (not the pickle file)."""
    digest = hashlib.sha256(b"studio-yebisu/state-sha256/v1\n")
    for name in sorted(state):
        tensor = state[name].detach().to("cpu").contiguous()
        raw = tensor.reshape(-1).view(torch.uint8).numpy().tobytes()
        digest.update(f"{name}\t{tensor.dtype}\t{list(tensor.shape)}\t{len(raw)}\n".encode("utf-8"))
        digest.update(raw)
    return digest.hexdigest()


def finite(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


# --------------------------------------------------------------------------- dataset


def check_dataset(up: SimpleNamespace, cfg: dict[str, Any], prompts: list[dict[str, Any]], stories: str,
                  data: Path, checks: Checks) -> tuple[Any, dict[str, Any]]:
    np = up.np
    train_docs, val_docs = up.split_text(stories, cfg["val_frac"])
    tok = up.BPETokenizer.load(data / "tokenizer.json")
    spec = up.tokenizer_spec(tok)
    n_vocab, eot = tok.n_vocab, tok.eot_token

    sizes: dict[str, int] = {}
    for split, docs in (("train", train_docs), ("val", val_docs)):
        with up.h5py.File(data / f"{split}.h5", "r") as f:
            dset = f["tokens"]
            tokens = dset[...]
            attrs = {key: dset.attrs[key] for key in dset.attrs}
        checks.require(f"{split}_h5_int32_1d", tokens.dtype == np.int32 and tokens.ndim == 1 and tokens.size > 0)
        checks.require(f"{split}_token_ids_in_range", int(tokens.min()) >= 0 and int(tokens.max()) < n_vocab)
        expected: list[int] = []
        for doc in docs:  # encode_documents() in prepare_tiny_data.py: ids of each document, then <|endoftext|>
            expected.extend(tok.encode_ordinary(doc))
            expected.append(eot)
        checks.require(f"{split}_h5_matches_upstream_split_text",
                       np.array_equal(tokens, np.asarray(expected, dtype=np.int32)))
        checks.require(f"{split}_h5_decodes_to_split_with_eot",
                       tok.decode(tokens.tolist()) == "".join(doc + up.EOT for doc in docs))
        checks.require(f"{split}_h5_attrs_match_tokenizer",
                       json.loads(attrs["tokenizer"]) == spec and int(attrs["vocab_size"]) == n_vocab
                       and int(attrs["n_documents"]) == len(docs))
        sizes[split] = int(tokens.size)

    train_lines = [line for doc in train_docs for line in doc.splitlines() if line]
    val_lines = [line for doc in val_docs for line in doc.splitlines() if line]
    checks.require("split_keeps_every_story_line", sorted(train_lines + val_lines) == sorted(stories.splitlines()))

    # build_tokenizer() trains on the training documents only (one document here, far below
    # the 10 MB budget). Training again on the same text must give the same merges.
    retrained = up.BPETokenizer.train(train_docs, cfg["vocab_size"])
    checks.require("bpe_retrained_from_train_split_matches", retrained.to_dict() == spec)
    whole = up.BPETokenizer.train([stories], cfg["vocab_size"])

    checks.require("corpus_roundtrip_exact", tok.decode(tok.encode_ordinary(stories)) == stories)
    prompt_tokens = {}
    for p in prompts:
        ids = tok.encode_ordinary(p["text"])
        checks.require("prompts_roundtrip_exact", tok.decode(ids) == p["text"], p["id"])
        prompt_tokens[p["id"]] = len(ids)

    context = cfg["context_length"]
    train_windows = (sizes["train"] - 1) // context  # n_examples in data_loader.get_batch_iterator
    val_windows = (sizes["val"] - 1) // context
    checks.require("val_has_full_window", val_windows >= 1, f"{sizes['val']} val tokens")

    train_set = set(train_lines)
    dataset = {
        "story_lines": len(stories.splitlines()),
        "train_lines": len(train_lines),
        "val_lines": len(val_lines),
        "val_lines_identical_to_a_train_line": sum(1 for line in val_lines if line in train_set),
        "train_chars": sum(map(len, train_docs)),
        "val_chars": sum(map(len, val_docs)),
        "train_tokens": sizes["train"],
        "val_tokens": sizes["val"],
        "tokens_include_endoftext": True,
        "train_windows": train_windows,
        "val_windows": val_windows,
        "dev_eval_batch_rows": min(cfg["batch_size"], val_windows),
        "vocab_size_requested": cfg["vocab_size"],
        "vocab_size": n_vocab,
        "merges": len(tok.merges),
        "special_tokens": list(tok.special_tokens),
        "endoftext_id": eot,
        "bpe_trained_on": "train split only",
        "bpe_merges_identical_if_trained_on_whole_file": whole.to_dict() == spec,
        "roundtrip": {"corpus": True, "prompts": len(prompts)},
        "prompt_tokens": prompt_tokens,
    }
    return tok, dataset


# --------------------------------------------------------------------------- generation


def generate_api(up: SimpleNamespace, path: Path, prompt: dict[str, Any], context: int,
                 checks: Checks) -> dict[str, Any]:
    """The eight prompts go through the upstream API in the same order as generate_text.py main():
    seed, load the checkpoint, encode, model.generate, safe_decode."""
    torch = up.torch
    torch.manual_seed(prompt["seed"])
    model, tok, window, _ = up.load_trained_model(str(path), "cpu")
    prompt_ids = tok.encode_ordinary(prompt["text"])
    with torch.no_grad():
        out = model.generate(torch.tensor([prompt_ids], dtype=torch.long, device="cpu"),
                             max_new_tokens=prompt["max_new_tokens"], temperature=prompt["temperature"],
                             top_k=prompt["top_k"] or None, top_p=None, min_p=None, context_window=window)
    ids = [int(t) for t in out[0].tolist()]
    text = up.safe_decode(tok, ids)
    checks.require("generation_shapes_and_prefix",
                   window == context and ids[:len(prompt_ids)] == prompt_ids
                   and len(ids) == len(prompt_ids) + prompt["max_new_tokens"] and text.startswith(prompt["text"]),
                   f"{prompt['id']} {path.name}")
    return {
        "text": text,
        "token_ids": ids,
        "prompt_tokens": len(prompt_ids),
        "new_tokens": len(ids) - len(prompt_ids),
        "ids_skipped_in_text": sum(1 for i in ids if not 0 <= i < tok.n_vocab),
        "endoftext_tokens": ids.count(tok.eot_token),
        "replacement_chars": text.count("�"),
    }


# --------------------------------------------------------------------------- main run


def execute(artifact_arg: str, state: dict[str, Any]) -> dict[str, Any]:
    if sys.version_info < (3, 10):
        raise RunError("Python 3.10 or newer is required (upstream requires-python >= 3.10)")
    if RECORD_PATH.exists():
        raise RunError("outputs/training-run.json already exists; it is never overwritten")

    checks = Checks()
    bad = mismatched(SITE, INPUT_SHA256)
    checks.require("inputs_sha256_match", not bad, ", ".join(bad))
    bad = mismatched(VENDOR, UPSTREAM_SHA256)
    checks.require("upstream_files_sha256_match", not bad, ", ".join(bad))
    cfg, prompts, stories = read_inputs(checks)

    artifact = prepare_artifact_dir(artifact_arg)
    state["artifact"] = artifact
    tree_before = site_snapshot()
    data, models, ckpt_dir = artifact / "data", artifact / "models", artifact / "checkpoints"
    baseline_pt, trained_pt = models / "baseline.pt", models / "trained.pt"
    env = child_env(cfg["threads"])
    commands: list[dict[str, Any]] = []
    steps = cfg["steps"]

    print("1/4 prepare_tiny_data.py: split, BPE, HDF5", flush=True)
    run_cli("prepare-data", [
        PREPARE, "--dataset", cfg["dataset"], "--input", STORIES, "--tokenizer", cfg["tokenizer"],
        "--vocab_size", str(cfg["vocab_size"]), "--val_frac", json.dumps(cfg["val_frac"]), "--out_dir", str(data),
    ], "prepare", artifact, env, commands)

    print("2/4 train_transformer.py --steps 0 (baseline, no update)", flush=True)
    base_out = run_cli("train-baseline-0", [
        *train_args(cfg, data), "--steps", "0", "--out-path", str(baseline_pt),
    ], "train", artifact, env, commands)

    print(f"3/4 train_transformer.py --steps {steps}", flush=True)
    trained_out = run_cli(f"train-{steps}", [
        *train_args(cfg, data), "--steps", str(steps), "--out-path", str(trained_pt),
        "--checkpoint-every", str(cfg["checkpoint_every"]), "--checkpoint-dir", str(ckpt_dir),
        "--keep-last", str(cfg["keep_last"]),
    ], "train", artifact, env, commands)

    print("4/4 checks and generation", flush=True)
    up = load_upstream(checks)
    torch = up.torch
    torch.set_num_threads(cfg["threads"])
    tok, dataset = check_dataset(up, cfg, prompts, stories, data, checks)
    spec = up.tokenizer_spec(tok)

    # ---- baseline and trained checkpoints
    base_ck = load_fresh_checkpoint(up, baseline_pt, artifact)
    trained_ck = load_fresh_checkpoint(up, trained_pt, artifact)
    checks.require("baseline_has_zero_updates",
                   base_ck.get("steps") == 0 and base_ck.get("last_completed_step") == -1
                   and base_ck.get("losses") == [] and base_ck.get("is_final") is True)
    losses = [float(x) for x in trained_ck.get("losses", [])]
    checks.require("trained_has_all_updates",
                   trained_ck.get("steps") == steps and trained_ck.get("last_completed_step") == steps - 1
                   and len(losses) == steps and trained_ck.get("is_final") is True, f"{len(losses)} losses")
    checks.require("losses_finite", all(map(math.isfinite, losses)) and all(
        finite(ck.get(key)) for ck in (base_ck, trained_ck) for key in ("train_loss", "dev_loss")))

    cb, ct = base_ck["config"], trained_ck["config"]
    differing = sorted(k for k in set(cb) | set(ct) if cb.get(k) != ct.get(k))
    checks.require("config_same_except_steps_and_out_path",
                   differing == ["t_lr_decay_step", "t_out_path", "t_train_steps"], ", ".join(differing))
    preset = up.PRESETS[cfg["preset"]]
    expected_cfg = {
        "arch": cfg["arch"], "device": cfg["device"], "n_embed": preset["n_embed"], "n_head": preset["n_head"],
        "n_blocks": preset["n_blocks"], "context_length": cfg["context_length"],
        "t_context_length": cfg["t_context_length"], "t_batch_size": cfg["batch_size"], "t_lr": cfg["lr"],
        "t_lr_decayed": cfg["lr"] / 10, "t_eval_steps": cfg["eval_every"], "t_eval_iters": cfg["eval_iters"],
        "sample_prompt": cfg["sample"], "vocab_size": round_up(tok.n_vocab), "tokenizer": spec,
        "train_path": str(data / "train.h5"), "dev_path": str(data / "val.h5"),
        "t_train_steps": steps, "t_lr_decay_step": int(steps * 0.8), "t_out_path": str(trained_pt),
    }
    wrong = [k for k, v in expected_cfg.items() if ct.get(k) != v]
    checks.require("config_matches_frozen_input",
                   not wrong and cb.get("t_train_steps") == 0 and cb.get("t_out_path") == str(baseline_pt),
                   ", ".join(wrong))

    torch.manual_seed(cfg["seed"])
    model_b, tok_b, window_b, cfg_b = up.load_trained_model(str(baseline_pt), "cpu")
    model_t, tok_t, window_t, cfg_t = up.load_trained_model(str(trained_pt), "cpu")
    checks.require("tokenizer_in_checkpoints_matches",
                   up.tokenizer_spec(tok_b) == spec and up.tokenizer_spec(tok_t) == spec)

    sb = up.model_state_from_checkpoint(base_ck)
    st = up.model_state_from_checkpoint(trained_ck)
    checks.require("same_tensor_names_shapes_dtypes",
                   sorted(sb) == sorted(st) == sorted(model_b.state_dict()) and all(
                       sb[k].shape == st[k].shape and sb[k].dtype == st[k].dtype for k in sb))
    before_sha, after_sha = state_sha256(torch, sb), state_sha256(torch, st)

    torch.manual_seed(cfg["seed"])  # train_transformer.py seeds, then builds the model
    fresh_sha = state_sha256(torch, up.build_model(cb).state_dict())
    checks.require("baseline_equals_fresh_seeded_init", fresh_sha == before_sha)
    changed = [k for k in sorted(sb) if not torch.equal(sb[k], st[k])]
    checks.require("weights_changed", len(changed) > 0)
    checks.require("state_sha256_differs", before_sha != after_sha)

    n_params = sum(p.numel() for p in model_b.parameters())
    reported = [PARAMS_RE.search(out) for out in (base_out, trained_out)]
    checks.require("parameter_count_matches_cli",
                   n_params == sum(p.numel() for p in model_t.parameters()) and all(
                       m and int(m.group(1).replace(",", "")) == n_params and m.group(2) == cfg["arch"]
                       and int(m.group(3)) == cb["vocab_size"] for m in reported))
    finished = [FINISHED_RE.search(out) for out in (base_out, trained_out)]
    checks.require("final_losses_match_cli", all(
        m and m.group(1) == f"{ck['train_loss']:.4f}" and m.group(2) == f"{ck['dev_loss']:.4f}"
        for m, ck in zip(finished, (base_ck, trained_ck))))

    # ---- periodic checkpoints
    every, keep, eval_every = cfg["checkpoint_every"], cfg["keep_last"], cfg["eval_every"]
    kept_steps = list(range(every, steps + 1, every))
    if keep > 0:
        kept_steps = kept_steps[-keep:]
    names = [f"checkpoint_step_{s - 1:08d}.pt" for s in kept_steps]
    present = sorted(p.name for p in ckpt_dir.iterdir()) if ckpt_dir.is_dir() else []
    checks.require("periodic_checkpoints_complete", present == names, ", ".join(present))

    checkpoints: list[dict[str, Any]] = [{
        "completed_steps": 0,
        "kind": "baseline",
        "state_sha256": before_sha,
        "learning_rate": float(base_ck["lr_state"]["current_lr"]),
        "minibatch_loss": None,
        "periodic_eval": None,
        "final_estimate": {"batches_per_split": FINAL_ESTIMATE_BATCHES,
                           "train_loss": float(base_ck["train_loss"]), "dev_loss": float(base_ck["dev_loss"])},
    }]
    last_sha = None
    for completed, name in zip(kept_steps, names):
        ck = load_fresh_checkpoint(up, ckpt_dir / name, artifact)
        checks.require("checkpoint_metadata_consistent",
                       ck.get("last_completed_step") == completed - 1 and ck.get("steps") == completed
                       and ck.get("is_final") is False and ck.get("config") == ct
                       and finite(ck.get("train_loss")) and finite(ck.get("dev_loss")), name)
        checks.require("checkpoint_losses_are_prefixes",
                       [float(x) for x in ck.get("losses", [])] == losses[:completed], name)
        eval_step = ((completed - 1) // eval_every) * eval_every  # the latest `step % eval_every == 0`
        last_sha = state_sha256(torch, up.model_state_from_checkpoint(ck))
        checkpoints.append({
            "completed_steps": completed,
            "kind": "periodic",
            "state_sha256": last_sha,
            "learning_rate": float(ck["lr_state"]["current_lr"]),
            "minibatch_loss": losses[completed - 1],
            "periodic_eval": {"zero_based_step": eval_step, "after_updates": eval_step + 1,
                              "batches_per_split": cfg["eval_iters"],
                              "train_loss": float(ck["train_loss"]), "dev_loss": float(ck["dev_loss"])},
            "final_estimate": None,
        })
    if kept_steps and kept_steps[-1] == steps:
        checks.require("last_checkpoint_state_equals_trained", last_sha == after_sha)

    # ---- generation through the upstream API
    samples = []
    for p in prompts:
        samples.append({
            "id": p["id"],
            "label": p["label"],
            "input": {key: p[key] for key in ("text", "max_new_tokens", "temperature", "top_k", "seed")},
            "before": generate_api(up, baseline_pt, p, cfg["context_length"], checks),
            "after": generate_api(up, trained_pt, p, cfg["context_length"], checks),
        })

    # ---- the upstream CLI on P01 must print the same text
    first = prompts[0]
    for side, path in (("before", baseline_pt), ("after", trained_pt)):
        out = run_cli(f"generate-cli-{side}-{first['id']}", [
            GENERATE, "--model_path", str(path), "--input_text", first["text"],
            "--max_new_tokens", str(first["max_new_tokens"]), "--top_k", str(first["top_k"]),
            "--temperature", json.dumps(first["temperature"]), "--seed", str(first["seed"]), "--device", "cpu",
        ], "generate", artifact, env, commands)
        header, cli_text = parse_generate_stdout(out)
        m = LOADED_RE.search(header)
        checks.require("generate_cli_header_matches_model",
                       bool(m) and int(m.group(1).replace(",", "")) == n_params and m.group(2) == cfg["arch"]
                       and int(m.group(3)) == cfg["context_length"] and m.group(4) == "cpu", side)
        checks.require(f"generate_cli_matches_api_{side}_{first['id']}", cli_text == samples[0][side]["text"])

    # ---- nothing outside the artifact directory changed
    checks.require("inputs_unchanged_after_run", not mismatched(SITE, INPUT_SHA256))
    checks.require("upstream_files_unchanged_after_run", not mismatched(VENDOR, UPSTREAM_SHA256))
    checks.require("site_files_unchanged", site_snapshot() == tree_before)
    private = sorted(["data/train.h5", "data/val.h5", "data/tokenizer.json",
                      "models/baseline.pt", "models/trained.pt", *(f"checkpoints/{n}" for n in names)])
    found = sorted(p.relative_to(artifact).as_posix() for p in artifact.rglob("*")
                   if p.is_file() and p.relative_to(artifact).parts[0] != "logs")
    checks.require("artifact_files_exactly_expected", found == private, ", ".join(found))
    artifacts = [{"label": rel, "bytes": (artifact / rel).stat().st_size,
                  "sha256": sha256_file(artifact / rel), "public": False} for rel in private]

    model_cfg = model_b.config
    return {
        "format": RECORD_FORMAT,
        "created_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": {
            "repository": REPOSITORY,
            "commit": COMMIT,
            "license": "MIT",
            "copyright": "Copyright (c) 2025 Fareed Khan",
            "files_verified": len(UPSTREAM_SHA256),
            "modified": False,
        },
        "config": cfg,
        "inputs_sha256": dict(sorted(INPUT_SHA256.items())),
        "checks": checks.passed,
        "environment": environment(up),
        "dataset": dataset,
        "model": {
            "parameters": n_params,
            "arch": cb["arch"],
            "context_length": cb["context_length"],
            "train_window": cb["t_context_length"],
            "n_embed": model_cfg.n_embed,
            "n_head": model_cfg.n_head,
            "n_kv_head": model_cfg.kv_heads,
            "n_blocks": model_cfg.n_blocks,
            "ffn_hidden": model_cfg.hidden_dim,
            "vocab_rows": cb["vocab_size"],
            "padding_rows": cb["vocab_size"] - tok.n_vocab,
            "tie_embeddings": model_cfg.tie_embeddings,
            "qk_norm": model_cfg.qk_norm,
            "pretrained_weights": False,
            "tensors": [[name, list(sb[name].shape)] for name in sorted(sb)],
            "changed_tensors": len(changed),
        },
        "training": {
            "optimizer": "AdamW",
            "optimizer_steps": steps,
            "baseline_steps": 0,
            "batch_size": cb["t_batch_size"],
            "learning_rate": cb["t_lr"],
            "learning_rate_decayed": ct["t_lr_decayed"],
            "lr_decay_at_zero_based_step": ct["t_lr_decay_step"],
            "seed": cfg["seed"],
            "threads": cfg["threads"],
            "losses": losses,
            "before": {"completed_steps": 0, "train_loss": float(base_ck["train_loss"]),
                       "dev_loss": float(base_ck["dev_loss"]), "state_sha256": before_sha},
            "after": {"completed_steps": steps, "train_loss": float(trained_ck["train_loss"]),
                      "dev_loss": float(trained_ck["dev_loss"]), "state_sha256": after_sha},
            "final_estimate_batches_per_split": FINAL_ESTIMATE_BATCHES,
            "periodic_eval_batches_per_split": cfg["eval_iters"],
            "checkpoints": checkpoints,
        },
        "notes": {
            "losses": "Training minibatch cross-entropy that upstream train_transformer.py appends for each optimizer "
                      "update (index 0 = update 1). Not a validation loss.",
            "before_after": "Upstream final estimate_loss(model, config, 200): mean over 200 batches per split. dev is "
                            "the end of the same 96-line file, which shares its template and vocabulary with train; "
                            "it is not a generalization or quality measure.",
            "periodic_eval": "A periodic checkpoint stores the latest periodic estimate (eval_iters batches per split), "
                             "made at periodic_eval.zero_based_step, not at the checkpoint's own step.",
            "generation": "generate_text.load_trained_model + model.generate, top_k 1 (greedy), the prompt's seed set "
                          "before loading. text = safe_decode of every id, prompt included and nothing trimmed: ids "
                          "outside the tokenizer (embedding padding rows) are skipped in text but kept in token_ids, "
                          "the <|endoftext|> id decodes to its literal string, invalid UTF-8 becomes U+FFFD.",
            "state_sha256": "SHA-256 over 'studio-yebisu/state-sha256/v1\\n', then for each tensor name in sorted "
                            "order: 'name\\tdtype\\tshape\\tbyte_count\\n' and the raw CPU bytes.",
            "seconds": "Wall-clock seconds of each command on the machine that ran it; not a benchmark.",
        },
        "commands": commands,
        "artifacts": artifacts,
        "samples": samples,
    }


def environment(up: SimpleNamespace) -> dict[str, Any]:
    def version(name: str) -> str | None:
        try:
            return importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            return None

    return {
        "python": platform.python_version(),
        "python_implementation": platform.python_implementation(),
        "os": platform.system(),
        "os_release": platform.release(),
        "machine": platform.machine(),
        "processor": platform.processor() or None,
        "logical_cpus": os.cpu_count(),
        "byteorder": sys.byteorder,
        "torch_threads": up.torch.get_num_threads(),
        "torch_cuda_build": up.torch.version.cuda,
        "packages": {
            "torch": up.torch.__version__,
            "numpy": up.np.__version__,
            "h5py": up.h5py.__version__,
            "hdf5": up.h5py.version.hdf5_version,
            "tiktoken": version("tiktoken"),
            "regex": version("regex"),
            "tqdm": version("tqdm"),
            "requests": version("requests"),
            "jaxtyping": version("jaxtyping"),
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--artifact-dir", required=True,
                        help="empty private folder outside this site for data, checkpoints and logs")
    args = parser.parse_args(argv)
    state: dict[str, Any] = {}
    try:
        record = execute(args.artifact_dir, state)
        write_record_once(RECORD_PATH, record)
    except RunError as exc:
        if "artifact" in state:
            (state["artifact"] / "logs" / "run-failure.txt").write_text(f"{exc}\n", encoding="utf-8")
        print(f"run.py stopped: {exc}", file=sys.stderr)
        print("outputs/training-run.json was not written.", file=sys.stderr)
        return 1
    t = record["training"]
    print(f"parameters {record['model']['parameters']:,}; dev loss {t['before']['dev_loss']:.4f} -> "
          f"{t['after']['dev_loss']:.4f} ({t['optimizer_steps']} updates); {len(record['checks'])} checks passed")
    print("wrote outputs/training-run.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
