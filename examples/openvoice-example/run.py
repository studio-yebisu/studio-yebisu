#!/usr/bin/env python3
"""紙の博物館（架空）の案内音声を、固定版 OpenVoice V2 の声色変換で3件変換する。

Copyright (c) 2026 Studio Yebisu. MIT License.

入力は input/ の4本の WAV（Irodori-TTS v4.1 Smallで作り、22050Hzへ変換した合成音声）:
  welcome.wav・closing.wav（元の案内声）
  reference-ichiro.wav・reference-sayaka.wav（参照の声: 落ち着いた声・明るい声）

固定版 myshell-ai/OpenVoice 74a1d147 の openvoice.api.ToneColorConverter をそのまま使い、
4本それぞれに extract_se をかけて声色の埋め込みを作り、
V01 welcome→落ち着いた声・V02 closing→落ち着いた声・V03 welcome→明るい声 を convert で変換する。
tau=0.3、CPU・4スレッド、seed=20261017（各変換の直前に同じ値で設定し直す）。
これは OpenVoice のテキスト読み上げでも MeloTTS でもない。声色変換だけを試す。

使い方（重みは公開フォルダの外。出力先は新しい空のフォルダ）:
  python run.py --model-dir PRIVATE_MODEL_ROOT --out NEW_EMPTY_DIR

PRIVATE_MODEL_ROOT は公式 myshell-ai/OpenVoiceV2 の固定リビジョン
f36e7edfe1684461a8343844af60babc2efbb727 から取得した converter/config.json と
converter/checkpoint.pth を置いたフォルダ。--out には voice-runs.json・3本の WAV・
embeddings.json を書く。公開フォルダの outputs/ へは直接書かない（制作側が確認してから移す）。

照合（vendor-lock.json・入力2ファイル・23の原典ファイル・model-lock.json・重み）が
すべて通ってから原典を import する。原典のコードは書き換えず、差し替えもしない。
失敗したら --out に failure.json だけを残して 0 以外で終わる（voice-runs.json は書かない）。
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata as metadata
import json
import math
import os
import platform
import random
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
VENDOR = HERE / "vendor" / "openvoice"
FORMAT = "studio-yebisu-openvoice-runs-v1"
EMBEDDINGS_FORMAT = "studio-yebisu-openvoice-embeddings-v1"

SOURCE_REPOSITORY = "myshell-ai/OpenVoice"
SOURCE_COMMIT = "74a1d147b17a8c3092dd5430504bd83ef6c7eb23"
SOURCE_VERSION = "0.0.0 (setup.py), converter V2"
MODEL_REPOSITORY = "myshell-ai/OpenVoiceV2"
MODEL_REVISION = "f36e7edfe1684461a8343844af60babc2efbb727"

# 実行前に固定した SHA-256。
PINNED_SHA256 = {
    "vendor-lock.json": "53a17e009e9b0ba6545515523790bafb6946f4691bd93e7f53b4001a95e29e76",
    "input/voice-requests.json": "faf4d83cd845d9e0253e8c6fb94bbd0c1d10d1db81b8023c9b09445454cfc9e6",
    "input/expected.json": "3878f6bb62e3ed6d718c361a307b1ddcfeb58aa1f1ddcf6d2095b5b25d271308",
}
VENDOR_FILE_COUNT = 23
# 公式 OpenVoiceV2 固定リビジョンの LFS の値（model-lock.json と同じでなければ止める）。
MODEL_FILES = {
    "converter/config.json": ("9dfff60350b8c63f2c664efd92a61b2516efb22671466960f0e5dfebd881fa47", 838),
    "converter/checkpoint.pth": ("9652c27e92b6b2a91632590ac9962ef7ae2b712e5c5b7f4c34ec55ee2b37ab9e", 131320490),
}
MODEL_README = ("README.md", "9f7d4211260d6105d0106705ae250c947bf3fb28e8e40a196de36a0e70d49394", 5371)

DEVICE = "cpu"
THREADS = 4
SEED = 20261017
TAU = 0.3
SAMPLE_RATE = 22050
MESSAGE = "SYEBISU!"
BIN_SECONDS = 0.1
SOURCE_IDS = ("welcome", "closing")
REFERENCE_IDS = ("ichiro", "sayaka")
CASES = (
    ("V01", "welcome", "ichiro", "outputs/welcome-ichiro.wav"),
    ("V02", "closing", "ichiro", "outputs/closing-ichiro.wav"),
    ("V03", "welcome", "sayaka", "outputs/welcome-sayaka.wav"),
)
# 原典の requirements.txt / setup.py が固定する版（この作例で使う部分）。
REQUIRED_VERSIONS = {"numpy": "1.22.0", "librosa": "0.9.1"}
TORCH_VERSION = "2.5.1"
# openvoice.api を import すると原典の text パッケージが読み込む依存。
TEXT_IMPORT_PACKAGES = ("eng_to_ipa", "inflect", "Unidecode", "pypinyin", "cn2an", "jieba")
TIMING_SCOPE = "measured once on this CPU; excludes input synthesis and model download; not a speed promise"


class RunError(RuntimeError):
    """入力・環境・結果が前提と違うときに止める。"""


class Recorder:
    """確認の一覧。失敗したらその場で止める。"""

    def __init__(self) -> None:
        self.checks: list[dict] = []
        self.stage = "preflight"

    def check(self, name: str, passed: bool, message: str) -> None:
        self.checks.append({"name": name, "passed": bool(passed)})
        if not passed:
            raise RunError(f"{name}: {message}")


# --- 小さな道具 ------------------------------------------------------------------------------


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_within(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
    except ValueError:
        return False
    return True


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def package_version(name: str) -> str | None:
    try:
        return metadata.version(name)
    except metadata.PackageNotFoundError:
        return None


def path_variants(path: Path) -> set[str]:
    raw = str(path)
    return {raw, raw.replace("\\", "/"), json.dumps(raw)[1:-1]}


def identity_strings() -> set[str]:
    values = {os.environ.get(key, "") for key in ("USERNAME", "USER")} | {platform.node()}
    return {v for v in values if len(v) >= 3}


def private_strings(paths: list[Path]) -> list[str]:
    values = set(identity_strings())
    for path in paths:
        values |= path_variants(path)
    return sorted((v for v in values if v), key=len, reverse=True)


def scrub(text: str, paths: dict[str, Path]) -> str:
    """failure.json に書く文から、手元のパスと名前を伏せる（長いパスから先に）。"""
    for label, path in sorted(paths.items(), key=lambda item: -len(str(item[1]))):
        for needle in sorted(path_variants(path), key=len, reverse=True):
            text = text.replace(needle, f"<{label}>")
    for needle in identity_strings():
        text = text.replace(needle, "<private>")
    return text


def assert_public(text: str, paths: list[Path]) -> None:
    lowered = text.lower()
    for needle in private_strings(paths):
        if needle.lower() in lowered:
            raise RunError("公開する JSON に手元のパスか名前が入りそうになりました。書き出しを止めます。")


def write_new(path: Path, text: str) -> None:
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


# --- 引数と置き場所 --------------------------------------------------------------------------


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="固定版 OpenVoice V2 の声色変換を3件実行し、新しいフォルダへ記録する。")
    parser.add_argument("--model-dir", type=Path, required=True,
                        help="converter/config.json と converter/checkpoint.pth を置いた非公開のフォルダ")
    parser.add_argument("--wavmark-cache", type=Path, required=True, help="External verified offline WavMark HF cache")
    parser.add_argument("--out", type=Path, required=True,
                        help="新しいフォルダ（無いか、空）。親フォルダは作ってよい。公開フォルダの中は不可")
    parser.add_argument("--input-dir", type=Path, default=HERE / "input",
                        help="4本の入力 WAV のフォルダ（既定: input/）。synthesize.pyで作った別フォルダも可")
    return parser.parse_args(argv)


def check_out(out: Path) -> Path:
    out = out.expanduser().absolute()
    if out.is_symlink():
        raise RunError("--out がシンボリックリンクです。新しい普通のフォルダを指定してください。")
    out = out.resolve()
    if is_within(out, HERE) or is_within(HERE, out):
        raise RunError("--out は公開する作例フォルダの外にしてください（outputs/ へは制作側が確認してから移します）。")
    if out.exists():
        if not out.is_dir():
            raise RunError("--out がフォルダではありません。")
        if any(out.iterdir()):
            raise RunError("--out に既にファイルがあります。上書きしません。新しいフォルダを指定してください。")
    return out


def check_model_dir(model_dir: Path, out: Path) -> Path:
    model_dir = model_dir.expanduser().resolve()
    if not model_dir.is_dir():
        raise RunError("--model-dir のフォルダがありません。")
    if is_within(model_dir, HERE):
        raise RunError("--model-dir は公開する作例フォルダの外にしてください（重みは配布しません）。")
    if is_within(model_dir, out) or is_within(out, model_dir):
        raise RunError("--model-dir と --out は別の場所にしてください。")
    return model_dir


def check_input_dir(input_dir: Path, out: Path) -> Path:
    input_dir = input_dir.expanduser().resolve()
    if not input_dir.is_dir():
        raise RunError("入力 WAV のフォルダがありません。")
    if is_within(input_dir, out) or is_within(out, input_dir):
        raise RunError("入力のフォルダと --out は別の場所にしてください。")
    return input_dir


# --- 照合（原典を import する前にすべて行う） ------------------------------------------------


def verify_pinned(rec: Recorder) -> dict[str, str]:
    hashes = {}
    for rel, pinned in PINNED_SHA256.items():
        path = HERE / rel
        if not path.is_file():
            raise RunError(f"{rel} がありません。")
        actual = sha256_file(path)
        rec.check(f"pinned_sha256:{rel}", actual == pinned, "実行前に固定した SHA-256 と一致しません。")
        hashes[rel] = actual
    return hashes


def verify_vendor(rec: Recorder) -> dict:
    lock = read_json(HERE / "vendor-lock.json")
    ok = (lock.get("repository") == SOURCE_REPOSITORY and lock.get("commit") == SOURCE_COMMIT
          and lock.get("version") == SOURCE_VERSION and isinstance(lock.get("files"), dict))
    rec.check("vendor_lock_pins_source", ok, "vendor-lock.json の固定版が違います。")
    files: dict = lock["files"]
    rec.check("vendor_lock_lists_23_files", len(files) == VENDOR_FILE_COUNT, "原典ファイルの数が23ではありません。")

    present = sorted(p.relative_to(VENDOR).as_posix() for p in VENDOR.rglob("*") if p.is_file() or p.is_symlink())
    extra = sorted(set(present) - set(files))
    rec.check("vendor_has_no_unlisted_files", not extra,
              f"vendor/openvoice にロックに無いファイルがあります（{', '.join(extra[:5])}）。"
              " __pycache__ などを取り除いてから実行してください。")
    for rel, entry in files.items():
        path = VENDOR / rel
        good = (path.is_file() and not path.is_symlink() and path.stat().st_size == entry.get("bytes")
                and sha256_file(path) == entry.get("sha256"))
        if not good:
            rec.check("vendor_files_match_lock", False, f"原典ファイル {rel} がロックと一致しません。")
    rec.check("vendor_files_match_lock", True, "")
    return files


def verify_requests(rec: Recorder) -> tuple[dict, dict]:
    requests = read_json(HERE / "input/voice-requests.json")
    expected = read_json(HERE / "input/expected.json")
    voices = {v.get("id"): v for v in requests.get("voices", [])}
    conversion = requests.get("conversion", {})
    ok = (
        requests.get("synthetic_only") is True
        and requests.get("sample_rate") == SAMPLE_RATE and requests.get("channels") == 1
        and requests.get("sample_format") == "PCM_16"
        and list(voices) == [*SOURCE_IDS, *REFERENCE_IDS]
        and all(voices[i].get("role") == "source" for i in SOURCE_IDS)
        and all(voices[i].get("role") == "reference" for i in REFERENCE_IDS)
        and conversion == {
            "device": DEVICE, "threads": THREADS, "seed": SEED, "tau": TAU, "enable_watermark": True,
            "message": MESSAGE, "source_commit": SOURCE_COMMIT, "model_revision": MODEL_REVISION,
        }
        and [(c.get("id"), c.get("source_id"), c.get("reference_id"), c.get("output"))
             for c in requests.get("cases", [])] == [tuple(c) for c in CASES]
    )
    rec.check("voice_requests_match_frozen_plan", ok, "input/voice-requests.json の内容が想定と違います。")
    ok = (
        expected.get("ids") == [c[0] for c in CASES] and expected.get("source_count") == 2
        and expected.get("reference_count") == 2 and expected.get("conversion_count") == 3
        and expected.get("all_synthetic") is True and expected.get("device") == DEVICE
        and expected.get("sample_rate") == SAMPLE_RATE and expected.get("channels") == 1
        and expected.get("source_voice") == voices["welcome"].get("voice_name") == voices["closing"].get("voice_name")
    )
    rec.check("expected_matches_frozen_plan", ok, "input/expected.json の内容が想定と違います。")
    return requests, expected


def verify_model(rec: Recorder, model_dir: Path) -> dict:
    lock_path = HERE / "model-lock.json"
    lock = read_json(lock_path)
    files = lock.get("files", {})
    ok = lock.get("repository") == MODEL_REPOSITORY and lock.get("revision") == MODEL_REVISION
    for rel, (sha, size) in MODEL_FILES.items():
        entry = files.get(rel, {})
        ok = ok and entry.get("sha256") == sha and entry.get("bytes") == size and MODEL_REVISION in entry.get("url", "")
    ckpt_entry = files.get("converter/checkpoint.pth", {})
    ok = ok and ckpt_entry.get("official_lfs_sha256") == MODEL_FILES["converter/checkpoint.pth"][0]
    rec.check("model_lock_pins_official_revision", ok, "model-lock.json の固定リビジョンかハッシュが違います。")

    found = {}
    for rel, (sha, size) in MODEL_FILES.items():
        path = model_dir / rel
        good = path.is_file() and path.stat().st_size == size and sha256_file(path) == sha
        rec.check(f"model_file_matches_lock:{rel}", good, f"{rel} が無いか、model-lock.json と一致しません。")
        found[rel] = path
    readme = model_dir / MODEL_README[0]
    readme_verified = readme.is_file() and readme.stat().st_size == MODEL_README[2] and sha256_file(readme) == MODEL_README[1]

    config = read_json(found["converter/config.json"])
    ok = config.get("_version_") == "v2" and config.get("data", {}).get("sampling_rate") == SAMPLE_RATE
    rec.check("model_config_v2_22050", ok, "converter/config.json が V2・22050Hz ではありません。")
    return {
        "lock_sha256": sha256_file(lock_path),
        "config": found["converter/config.json"],
        "checkpoint": found["converter/checkpoint.pth"],
        "readme_verified": readme_verified,
        "config_data": config,
    }


def wav_header(rec: Recorder, sf, path: Path, label: str) -> None:
    info = sf.info(str(path))
    ok = (info.format == "WAV" and info.subtype == "PCM_16" and info.channels == 1
          and info.samplerate == SAMPLE_RATE and info.frames > 0)
    rec.check(f"wav_format:{label}", ok, f"{label} が 22050Hz・モノラル・PCM16 の WAV ではありません。")


def verify_environment(rec: Recorder) -> None:
    rec.check("python_3_10", sys.version_info[:2] == (3, 10), "Python 3.10 で実行してください。")
    for name, version in REQUIRED_VERSIONS.items():
        rec.check(f"{name}_{version.replace('.', '_')}", package_version(name) == version,
                  f"{name}=={version}（原典の固定版）を入れてください。")
    torch_version = package_version("torch") or ""
    rec.check("torch_2_5_1", torch_version.split("+")[0] == TORCH_VERSION, f"torch {TORCH_VERSION}（CPU 版）を入れてください。")
    missing = [n for n in TEXT_IMPORT_PACKAGES if package_version(n) is None]
    rec.check("text_import_dependencies_present", not missing,
              f"openvoice.api の import が読む依存がありません: {', '.join(missing)}")


# --- 原典の import（照合の後でだけ） ---------------------------------------------------------


def import_original(rec: Recorder, vendor_files: dict):
    if any(n == "openvoice" or n.startswith("openvoice.") for n in sys.modules):
        raise RunError("openvoice が既に読み込まれています。")
    sys.dont_write_bytecode = True  # 照合済みの vendor/ に __pycache__ を作らない
    sys.path.insert(0, str(VENDOR))
    import numpy as np
    import soundfile as sf
    import torch
    from openvoice import api  # 原典の ToneColorConverter・OpenVoiceBaseClass

    loaded = {n: m for n, m in sys.modules.items() if n == "openvoice" or n.startswith("openvoice.")}
    ok = bool(loaded)
    for module in loaded.values():
        origin = Path(getattr(module, "__file__", "") or "").resolve()
        if not is_within(origin, VENDOR):
            ok = False
            break
        rel = origin.relative_to(VENDOR.resolve()).as_posix()
        entry = vendor_files.get(rel)
        if entry is None or sha256_file(origin) != entry["sha256"]:
            ok = False
            break
    rec.check("original_modules_loaded_from_verified_vendor", ok, "openvoice が照合済みの vendor/ 以外から読み込まれました。")
    rec.check("torch_cpu_build", torch.__version__.split("+")[0] == TORCH_VERSION, "torch の版が違います。")
    return api, torch, np, sf


def verify_watermark_cache(rec, value):
    cache = value.expanduser().resolve()
    if is_within(cache, HERE) or is_within(HERE, cache):
        raise RunError("Watermark cache must be outside this example.")
    lock = read_json(HERE / "watermark-lock.json")
    rec.check("watermark_lock_pinned", sha256_file(HERE / "watermark-lock.json") == "ff9770637114cef87c4570bb051f155b5a3bd2075677109099cbd550d103b9cc", "Watermark lock mismatch")
    root = cache / "models--M4869--WavMark"
    path = root / "snapshots" / lock["revision"] / lock["filename"]
    ref = root / "refs" / "main"
    rec.check("watermark_official_weights", path.is_file() and path.stat().st_size == lock["bytes"] and sha256_file(path) == lock["sha256"], "Watermark weights missing/mismatched")
    rec.check("watermark_offline_exact_revision", ref.is_file() and ref.read_text("utf-8").strip() == lock["revision"], "Watermark cache revision mismatch")
    dist = metadata.distribution("wavmark")
    rec.check("watermark_package_0003", dist.version == "0.0.3", "WavMark version mismatch")
    for n, f in lock["source_files"].items():
        if n == "LICENSE":
            source = HERE / "vendor/wavmark/LICENSE"
        else:
            source = Path(dist.locate_file(n))
        rec.check("watermark_original_source:" + n, source.is_file() and sha256_file(source) == f["sha256"], "WavMark source mismatch")
    os.environ["HF_HUB_CACHE"] = str(cache)
    os.environ["HF_HUB_OFFLINE"] = "1"
    return {"repository": lock["repository"], "revision": lock["revision"], "sha256": lock["sha256"], "bytes": lock["bytes"], "package": "wavmark==0.0.3", "message": "SYEBISU!", "offline_cache_verified": True}


def build_converter(api, config_path: Path) -> tuple[object, dict]:
    """Call the unmodified default constructor, including its actual WavMark dependency."""
    converter = api.ToneColorConverter(str(config_path), device=DEVICE)
    return converter, {"requested_call": "ToneColorConverter(config_path, device='cpu')", "observed": "constructed", "path": "original constructor, original default watermark ON; no __new__, attribute substitution or vendor modification"}


def reseed(torch, np) -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)


# --- 音声の測定 ------------------------------------------------------------------------------


def analyze_wav(sf, np, path: Path) -> dict:
    info = sf.info(str(path))
    data, sample_rate = sf.read(str(path), dtype="int16", always_2d=True)
    floats, _ = sf.read(str(path), dtype="float32", always_2d=True)
    frames, channels = data.shape
    mono = data[:, 0]
    wide = mono.astype(np.int64)
    unit = mono.astype(np.float64) / 32768.0
    rms = float(np.sqrt(np.mean(unit * unit))) if frames else 0.0
    step = int(round(sample_rate * BIN_SECONDS))
    bins = []
    for start in range(0, frames, step):
        part = unit[start:start + step]
        bins.append(round(float(np.sqrt(np.mean(part * part))), 5))
    return {
        "file_bytes": path.stat().st_size,
        "file_sha256": sha256_file(path),
        "pcm_sha256": hashlib.sha256(data.astype("<i2", copy=False).tobytes()).hexdigest(),
        "format": info.format,
        "subtype": info.subtype,
        "sample_rate": int(sample_rate),
        "channels": int(channels),
        "frames": int(frames),
        "header_frames": int(info.frames),
        "duration_seconds": round(frames / sample_rate, 6),
        "min_pcm": int(wide.min()),
        "max_pcm": int(wide.max()),
        "max_abs_pcm": int(np.abs(wide).max()),
        "rms": round(rms, 6),
        "rms_dbfs": round(20 * math.log10(rms), 2) if rms > 0 else None,
        "clipped_samples": int(np.count_nonzero((wide >= 32767) | (wide <= -32768))),
        "all_finite": bool(np.isfinite(floats).all()),
        "waveform": {
            "kind": "measured RMS per fixed bin, linear full scale = 1.0",
            "bin_seconds": BIN_SECONDS,
            "bin_samples": step,
            "rms": bins,
        },
    }


def embedding_facts(torch, np, se) -> tuple[dict, list[float]]:
    vector = se.detach().cpu().reshape(-1).double().numpy()
    facts = {
        "shape": [int(s) for s in se.shape],
        "dims": int(vector.size),
        "all_finite": bool(np.isfinite(vector).all()),
        "l2_norm": round(float(np.linalg.norm(vector)), 6),
        "float32_sha256": hashlib.sha256(se.detach().cpu().float().contiguous().numpy().tobytes()).hexdigest(),
    }
    return facts, [float(v) for v in vector]


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else float("nan")


# --- 実行 ------------------------------------------------------------------------------------


def run(rec: Recorder, args, out: Path, model_dir: Path, input_dir: Path, pre: dict) -> dict:
    requests = pre["requests"]
    voices = {v["id"]: v for v in requests["voices"]}
    expected = pre["expected"]
    model = pre["model"]

    rec.stage = "import"
    api, torch, np, sf = import_original(rec, pre["vendor_files"])
    torch.set_num_threads(THREADS)
    rec.check("torch_threads_4", torch.get_num_threads() == THREADS, "torch のスレッド数が 4 になりません。")
    reseed(torch, np)

    rec.stage = "load"
    started_total = time.perf_counter()
    started = time.perf_counter()
    converter, construction = build_converter(api, model["config"])
    converter.load_ckpt(str(model["checkpoint"]))  # 原典の load_ckpt（strict=False）
    load_seconds = time.perf_counter() - started
    rec.check("watermark_original_default_loaded", converter.watermark_model is not None and "wavmark" in sys.modules,
              "Original default watermark model was not loaded.")

    # load_ckpt は strict=False なので、全パラメータが重みと同じ値になったかを別に確かめる。
    saved = torch.load(str(model["checkpoint"]), map_location=torch.device(DEVICE))["model"]
    current = converter.model.state_dict()
    missing = sorted(set(current) - set(saved))
    unexpected = sorted(set(saved) - set(current))
    unequal = [k for k in current if k in saved and not torch.equal(current[k], saved[k].to(current[k].dtype))]
    rec.check("checkpoint_no_missing_keys", not missing, f"重みに無いパラメータが {len(missing)} 個あります。")
    rec.check("checkpoint_tensors_loaded_exactly", not unequal, f"重みと違う値のパラメータが {len(unequal)} 個あります。")
    del saved

    params = list(converter.model.parameters())
    rec.check("converter_version_v2", converter.version == "v2", "変換器が V2 ではありません。")
    rec.check("converter_sampling_rate_22050", converter.hps.data.sampling_rate == SAMPLE_RATE, "変換器が 22050Hz ではありません。")
    rec.check("converter_eval_mode", converter.model.training is False, "モデルが eval になっていません。")
    rec.check("converter_parameters_on_cpu", converter.device == DEVICE and all(p.device.type == "cpu" for p in params),
              "パラメータが CPU にありません。")
    rec.check("converter_has_reference_encoder", hasattr(converter.model, "ref_enc"), "ref_enc がありません。")
    model_facts = {
        "repository": MODEL_REPOSITORY,
        "revision": MODEL_REVISION,
        "license": "MIT (official model card and original README)",
        "files": {rel: {"sha256": sha, "bytes": size} for rel, (sha, size) in MODEL_FILES.items()},
        "readme_sha256_verified": model["readme_verified"],
        "model_lock_sha256": model["lock_sha256"],
        "location": "private --model-dir; checkpoint is not distributed with this example",
        "version": converter.version,
        "sampling_rate": converter.hps.data.sampling_rate,
        "filter_length": converter.hps.data.filter_length,
        "hop_length": converter.hps.data.hop_length,
        "win_length": converter.hps.data.win_length,
        "parameters": int(sum(p.numel() for p in params)),
        "state_dict_tensors": len(current),
        "missing_keys": len(missing),
        "unexpected_keys": len(unexpected),
        "load_ckpt": "original OpenVoiceBaseClass.load_ckpt (torch.load map_location=cpu, load_state_dict strict=False)",
    }

    rec.stage = "extract_se"
    assets, embeddings, vectors = [], {}, {}
    for vid in (*SOURCE_IDS, *REFERENCE_IDS):
        voice = voices[vid]
        leaf = Path(voice["file"]).name
        path = input_dir / leaf
        reseed(torch, np)
        started = time.perf_counter()
        se = converter.extract_se([str(path)])  # 原典の extract_se（このファイル1本の ref_enc 出力）
        seconds = time.perf_counter() - started
        facts, vector = embedding_facts(torch, np, se)
        rec.check(f"embedding_256_finite:{vid}", facts["dims"] == 256 and facts["all_finite"], f"{vid} の埋め込みが256次元の有限値ではありません。")
        embeddings[vid] = se
        vectors[vid] = vector
        audio = analyze_wav(sf, np, path)
        assets.append({
            "id": vid,
            "role": voice["role"],
            "voice_name": voice["voice_name"],
            "culture": voice["culture"],
            "tts": voice["tts"],
            "synthetic": True,
            "text": voice["text"],
            "path": voice["file"],
            "audio": audio,
            "embedding": {**facts, "api": "ToneColorConverter.extract_se([path])", "elapsed_seconds": round(seconds, 3)},
        })
    rec.check("reference_embeddings_differ", vectors["ichiro"] != vectors["sayaka"], "2つの参照の埋め込みが同じです。")
    rec.check("source_and_reference_embeddings_differ",
              all(vectors[s] != vectors[r] for s in SOURCE_IDS for r in REFERENCE_IDS), "元と参照の埋め込みが同じです。")
    by_asset = {a["id"]: a for a in assets}

    rec.stage = "convert"
    results = []
    for case_id, source_id, reference_id, public_out in CASES:
        case = next(c for c in requests["cases"] if c["id"] == case_id)
        source, reference = voices[source_id], voices[reference_id]
        target = out / Path(public_out).name
        if target.exists():
            raise RunError(f"{target.name} が既にあります。上書きしません。")
        reseed(torch, np)  # 3件とも同じ乱数の始まりにする（enc_q の乱数）
        started = time.perf_counter()
        converter.convert(
            audio_src_path=str(input_dir / Path(source["file"]).name),
            src_se=embeddings[source_id],
            tgt_se=embeddings[reference_id],
            output_path=str(target),
            tau=TAU,
            message=MESSAGE,
        )
        seconds = time.perf_counter() - started
        audio = analyze_wav(sf, np, target)
        decoded_audio, _ = sf.read(str(target), dtype="float32")
        decoded_message = converter.detect_watermark(decoded_audio, n_repeat=2)
        audio["watermark_detection"] = {"decoded_message": decoded_message, "expected_message": MESSAGE, "matches": decoded_message == MESSAGE, "scope": "Original detect_watermark on this native WAV only; compression/edits not tested"}
        src_audio = by_asset[source_id]["audio"]
        delta = round(audio["duration_seconds"] - src_audio["duration_seconds"], 6)
        rec.check(f"output_format:{case_id}",
                  audio["format"] == "WAV" and audio["subtype"] == "PCM_16" and audio["channels"] == expected["channels"]
                  and audio["sample_rate"] == expected["sample_rate"] and audio["frames"] == audio["header_frames"] > 0,
                  "出力が 22050Hz・モノラル・PCM16 ではありません。")
        rec.check(f"output_duration_in_range:{case_id}",
                  expected["min_duration_seconds"] <= audio["duration_seconds"] <= expected["max_duration_seconds"],
                  "出力の長さが想定の範囲外です。")
        rec.check(f"output_duration_delta_within_0.10s:{case_id}",
                  abs(delta) <= expected["max_duration_delta_seconds"], "出力と元の長さの差が 0.10 秒を超えます。")
        rec.check(f"output_finite:{case_id}", audio["all_finite"], "出力に有限でない値があります。")
        rec.check(f"output_max_abs_pcm_within_limit:{case_id}", audio["max_abs_pcm"] <= expected["max_abs_pcm"],
                  "出力に -32768 のサンプルがあります。")
        rec.check(f"output_not_silent:{case_id}", audio["max_abs_pcm"] > 0, "出力が無音です。")
        rec.check(f"output_differs_from_source:{case_id}", audio["pcm_sha256"] != src_audio["pcm_sha256"],
                  "出力が元の音声と同じです。")
        results.append({
            "id": case_id,
            "label": case["label"],
            "operation": "tone_color_conversion",
            "input": {
                "source_id": source_id,
                "reference_id": reference_id,
                "source_text": source["text"],
                "source_voice": source["voice_name"],
                "reference_voice": reference["voice_name"],
                "source_path": source["file"],
                "reference_path": reference["file"],
                "tau": TAU,
                "seed": SEED,
                "seed_scope": "random, numpy and torch reseeded with this value right before convert",
                "message": MESSAGE,
                "device": DEVICE,
                "threads": THREADS,
            },
            "output": {
                "path": public_out,
                **audio,
                "duration_delta_seconds": delta,
                "elapsed_seconds": round(seconds, 3),
                "api": {
                    "call": "ToneColorConverter.convert(audio_src_path, src_se, tgt_se, output_path, tau=0.3, message)",
                    "src_se": f"extract_se([{source['file']}])",
                    "tgt_se": f"extract_se([{reference['file']}])",
                    "model_version": converter.version,
                    "sampling_rate": converter.hps.data.sampling_rate,
                    "writer": "soundfile.write(output_path, audio, 22050) inside convert (WAV default PCM_16)",
                    "watermark": "original default add_watermark, wavmark0.0.3, message SYEBISU!",
                    "post_processing": "none",
                    "label": "AI-converted synthetic voice",
                },
            },
        })
    by_case = {r["id"]: r for r in results}
    rec.check("v01_v03_bytes_differ", by_case["V01"]["output"]["file_sha256"] != by_case["V03"]["output"]["file_sha256"],
              "V01 と V03 の出力が同じバイト列です。")
    rec.check("v01_v02_bytes_differ", by_case["V01"]["output"]["file_sha256"] != by_case["V02"]["output"]["file_sha256"],
              "V01 と V02 の出力が同じバイト列です。")

    counts = {
        "conversions": len(results),
        "sources": sum(1 for a in assets if a["role"] == "source"),
        "references": sum(1 for a in assets if a["role"] == "reference"),
        "output_files": len({r["output"]["path"] for r in results}),
        "input_files": len(assets),
    }
    rec.check("counts_3_conversions_2_sources_2_references",
              (counts["conversions"], counts["sources"], counts["references"])
              == (expected["conversion_count"], expected["source_count"], expected["reference_count"]),
              "変換・元・参照の数が想定と違います。")
    rec.check("all_inputs_synthetic", all(a["synthetic"] for a in assets) and requests["synthetic_only"] is True,
              "合成音声だけの入力ではありません。")
    total_seconds = time.perf_counter() - started_total

    rec.stage = "write"
    names = [a["id"] for a in assets]
    cosines = {f"{a}|{b}": round(cosine(vectors[a], vectors[b]), 6)
               for i, a in enumerate(names) for b in names[i + 1:]}
    embeddings_doc = {
        "format": EMBEDDINGS_FORMAT,
        "note": "Technical diagnostics of extract_se outputs. Cosine values compare embeddings only;"
                " they are not a voice identity, similarity or quality score.",
        "embeddings": [{"id": vid, "path": by_asset[vid]["path"], "shape": by_asset[vid]["embedding"]["shape"],
                        "values": [round(v, 7) for v in vectors[vid]]} for vid in names],
        "technical_embedding_cosine": cosines,
    }

    record = {
        "format": FORMAT,
        "status": "completed",
        "case": "openvoice-example",
        "task": "架空の「紙の博物館」の同じ案内音声を、2種類の合成参照声で聞き比べ、気に入ったWAVを保存する",
        "upstream": {
            "repository": SOURCE_REPOSITORY,
            "commit": SOURCE_COMMIT,
            "version": SOURCE_VERSION,
            "license": "MIT",
            "vendor_lock_sha256": pre["hashes"]["vendor-lock.json"],
            "vendor_files_verified": VENDOR_FILE_COUNT,
            "api": "openvoice.api.ToneColorConverter (extract_se, convert, load_ckpt)",
        },
        "model": model_facts,
        "input_sha256": {**pre["hashes"], "model-lock.json": model["lock_sha256"]},
        "runtime": {
            "device": DEVICE,
            "threads": THREADS,
            "threads_observed": torch.get_num_threads(),
            "seed": SEED,
            "tau": TAU,
            "enable_watermark": True,
            "watermark": "original default WavMark ON; message SYEBISU!",
            "watermark_model": pre["watermark"],
            "construction": construction,
            "vad": "not used (each reference is one prepared single-speaker synthetic clip; se_extractor not imported)",
            "source_embeddings": "extract_se on each actual source WAV (not the pretrained base_speakers/ses files)",
            "inputs_folder": "input/" if input_dir == (HERE / "input").resolve() else "separate folder with the same leaf names",
            "python": platform.python_version(),
            "python_implementation": platform.python_implementation(),
            "os": platform.system(),
            "machine": platform.machine(),
            "packages": {
                "torch": torch.__version__,
                "numpy": package_version("numpy"),
                "librosa": package_version("librosa"),
                "soundfile": package_version("soundfile"),
                "scipy": package_version("scipy"),
                **{name: package_version(name) for name in TEXT_IMPORT_PACKAGES},
            },
        },
        "assets": assets,
        "results": results,
        "timing": {
            "load_seconds": round(load_seconds, 3),
            "total_seconds": round(total_seconds, 3),
            "scope": TIMING_SCOPE,
        },
        "summary": {
            **counts,
            "output_seconds": round(sum(r["output"]["duration_seconds"] for r in results), 6),
        },
        "embeddings_file": "outputs/embeddings.json",
        "verification": {
            "kind": "numerical and file checks only",
            "listening": "not performed by run.py",
            "human_approval": False,
            "notes": [
                "Checks confirm files, formats, durations, hashes and embedding sanity; they do not show that the output sounds like the reference.",
                "Voice closeness and naturalness are for listeners to judge; no identity or quality score is computed.",
                "All inputs were synthesized by fixed Irodori-TTS v4.1 Small; no real-person recording or upstream demo clip. Closing references our own synthetic welcome clip.",
            ],
        },
        "limitations": [
            "Only ToneColorConverter.extract_se and convert were exercised; not OpenVoice text-to-speech, MeloTTS, cross-lingual synthesis or the six-language pipeline.",
            "se_extractor (VAD/Whisper segmentation), Gradio, hosted services and GPU OpenVoice conversion were not used; Irodori input synthesis used CUDA. Default native WAV watermark was inserted and its actual decoded value recorded; robustness after AAC or edits was not tested.",
            "One run on one CPU; timings are not a benchmark.",
            "The browser page plays saved files; it does not run OpenVoice.",
        ],
    }
    checks = list(rec.checks)
    record["checks"] = checks
    record["check_count"] = len(checks)
    record["checks_passed"] = sum(1 for c in checks if c["passed"])
    if record["checks_passed"] != record["check_count"]:
        raise RunError("合格していない確認があります。")

    private = [HERE, model_dir, out, input_dir, Path.home()]
    record_text = json.dumps(record, ensure_ascii=False, indent=2) + "\n"
    embeddings_text = json.dumps(embeddings_doc, ensure_ascii=False, indent=2) + "\n"
    assert_public(record_text, private)
    assert_public(embeddings_text, private)
    write_new(out / "embeddings.json", embeddings_text)
    write_new(out / "voice-runs.json", record_text)  # 最後に書く。これがあることが成功の印
    return record


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    rec = Recorder()
    try:
        out = check_out(args.out)
        model_dir = check_model_dir(args.model_dir, out)
        input_dir = check_input_dir(args.input_dir, out)
        hashes = verify_pinned(rec)
        vendor_files = verify_vendor(rec)
        requests, expected = verify_requests(rec)
        model = verify_model(rec, model_dir)
        verify_environment(rec)
        watermark = verify_watermark_cache(rec, args.wavmark_cache)
        try:
            import soundfile as sf  # 入力の形式を見るだけ（原典はまだ読み込まない）
        except ImportError as error:
            raise RunError("soundfile がありません（原典の api.py が使います）。") from error
        for voice in requests["voices"]:
            path = input_dir / Path(voice["file"]).name
            if not path.is_file() or path.is_symlink():
                raise RunError(f"入力 {voice['file']} がありません。")
            wav_header(rec, sf, path, voice["file"])
    except RunError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    out.mkdir(parents=True, exist_ok=True)
    pre = {"hashes": hashes, "vendor_files": vendor_files, "requests": requests, "expected": expected, "model": model, "watermark": watermark}
    try:
        record = run(rec, args, out, model_dir, input_dir, pre)
    except BaseException as error:  # 失敗も記録として残す（voice-runs.json は書かない）
        traceback.print_exc(file=sys.stderr)
        failure = {
            "format": FORMAT,
            "status": "failed",
            "stage": rec.stage,
            "error_type": type(error).__name__,
            "message": scrub(str(error), {"site": HERE, "model-dir": model_dir, "out": out, "input-dir": input_dir,
                                          "home": Path.home()}),
            "checks": rec.checks,
            "note": "Files already written in this folder are kept as a failed attempt. Nothing was overwritten.",
        }
        try:
            write_new(out / "failure.json", json.dumps(failure, ensure_ascii=False, indent=2) + "\n")
        except FileExistsError:
            pass
        print(f"failed at {rec.stage}; see failure.json in {out.name}/", file=sys.stderr)
        return 1

    summary = record["summary"]
    print(f"completed: {summary['conversions']} conversions, {summary['sources']} sources,"
          f" {summary['references']} references, {record['check_count']} checks passed,"
          f" total {record['timing']['total_seconds']}s -> {out.name}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
