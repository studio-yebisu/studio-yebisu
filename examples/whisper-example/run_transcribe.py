#!/usr/bin/env python3
"""しおり工房 字幕デスク（作例）の転記ブリッジ。

input/review-ja.wav（16kHz・モノラル・PCM16 の合成音声）を、固定コミットの
openai-whisper で1回だけ転記する。モデルは base、CPU、torch.set_num_threads(4)。
書き出しは whisper.utils.get_writer("all") の実装そのもので、返った result を
手で変えない。確認用の記録として outputs/session.json を足す。

読み上げ原稿（input/script.json の reference_text）は Whisper に渡さない。
script.json から読むのは音声の出どころ（id・種類・声の名前）だけ。

使い方（重みは公開フォルダの外に置く）:
  python run_transcribe.py --model-dir OUTSIDE_EXAMPLE_CACHE --prepare-model
  python run_transcribe.py --model-dir OUTSIDE_EXAMPLE_CACHE

--prepare-model は重みを取得して原典のローダーで SHA-256 を照合するだけで、転記しない。
転記では重みが既にあることを確かめてから読み込むので、load_seconds に取得時間は入らない。
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import importlib.metadata as metadata
import json
import math
import os
import platform
import shutil
import subprocess
import sys
import time
import traceback
import wave
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
SOURCE_COMMIT = "86098128c0b4f24f0e2aa2994de830614b474227"
CASE_ID = "review-ja"
MODEL_NAME = "base"
DEVICE = "cpu"
THREADS = 4
SAMPLE_RATE = 16000
TAIL_TOLERANCE_SECONDS = 0.15
AUDIO_PUBLIC_PATH = "input/review-ja.wav"
SCRIPT_PUBLIC_PATH = "input/script.json"
# get_writer("all") が書く拡張子（固定版 whisper/utils.py の順）
WRITER_EXTENSIONS = ("txt", "vtt", "srt", "tsv", "json", "jsonl")
TRANSCRIBE_OPTIONS = {
    "language": "ja",
    "task": "transcribe",
    "fp16": False,
    "temperature": 0,
    "condition_on_previous_text": False,
    "verbose": False,
}
TIMING_SCOPE = "single local run; excludes input synthesis and download; not benchmark"


class BridgeError(RuntimeError):
    """入力・環境・結果が前提と違うときに止める。"""


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="固定版 openai-whisper（base・CPU）で input/review-ja.wav を1回転記する。"
    )
    parser.add_argument(
        "--audio",
        type=Path,
        default=HERE / "input" / "review-ja.wav",
        help="16kHz・モノラル・PCM16 の WAV（既定: input/review-ja.wav）",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=HERE / "outputs",
        help="書き出し先。存在する場合は空のフォルダだけ受け付ける（既定: outputs）",
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        required=True,
        help="重みを置く非公開のフォルダ。このフォルダ（公開する作例）の外を指定する",
    )
    parser.add_argument("--model", choices=[MODEL_NAME], default=MODEL_NAME)
    parser.add_argument("--threads", type=int, choices=[THREADS], default=THREADS)
    parser.add_argument(
        "--prepare-model",
        action="store_true",
        help="重みの取得と SHA-256 照合だけをして終える（転記しない）",
    )
    return parser.parse_args(argv)


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


def resolve_model_dir(model_dir: Path, out: Path | None) -> Path:
    model_dir = model_dir.expanduser().resolve()
    if is_within(model_dir, HERE):
        raise BridgeError("--model-dir は公開する作例フォルダの外にしてください。")
    if out is not None and (is_within(model_dir, out) or is_within(out, model_dir)):
        raise BridgeError("--model-dir と --out は別の場所にしてください。")
    return model_dir


def check_audio_path(audio: Path) -> Path:
    audio = audio.resolve()
    if not audio.is_file():
        raise BridgeError(f"音声がありません: {audio}")
    if not is_within(audio, HERE) or audio.relative_to(HERE).as_posix() != AUDIO_PUBLIC_PATH:
        raise BridgeError(f"公開ページが読む音声 {AUDIO_PUBLIC_PATH} だけを転記します。")
    return audio


def check_out_free(out: Path) -> Path:
    out = out.resolve()
    if out.exists():
        if not out.is_dir():
            raise BridgeError(f"--out がフォルダではありません: {out}")
        if any(out.iterdir()):
            raise BridgeError(
                f"--out に既にファイルがあります。上書きしません。新しいフォルダを指定してください: {out}"
            )
    if not out.parent.is_dir():
        raise BridgeError(f"--out の親フォルダがありません: {out.parent}")
    return out


def read_wav_info(path: Path) -> dict:
    with wave.open(str(path), "rb") as handle:
        channels = handle.getnchannels()
        sample_width = handle.getsampwidth()
        sample_rate = handle.getframerate()
        frames = handle.getnframes()
        compression = handle.getcomptype()
    if compression != "NONE" or sample_width != 2:
        raise BridgeError("音声は非圧縮 PCM16 の WAV にしてください。")
    if sample_rate != SAMPLE_RATE or channels != 1:
        raise BridgeError(
            f"音声は {SAMPLE_RATE}Hz・モノラルにしてください（実際: {sample_rate}Hz・{channels}ch）。"
        )
    if frames <= 0:
        raise BridgeError("音声にサンプルがありません。")
    return {
        "duration_seconds": frames / sample_rate,
        "sample_rate": sample_rate,
        "channels": channels,
        "sample_width_bits": sample_width * 8,
        "frames": frames,
    }


def read_script_provenance(path: Path) -> dict:
    """出どころだけを写す。reference_text はここで読み出さない。"""
    with path.open("r", encoding="utf-8") as handle:
        script = json.load(handle)
    if script.get("id") != CASE_ID or script.get("language") != "ja":
        raise BridgeError("input/script.json の id か language が想定と違います。")
    if script.get("kind") != "synthetic":
        raise BridgeError("input/script.json の kind は synthetic のはずです。")
    voice_name = script.get("voice_name")
    if not isinstance(voice_name, str) or not voice_name:
        raise BridgeError("input/script.json に voice_name がありません。")
    return {
        "kind": "synthetic",
        "voice_name": voice_name,
        "fictional": script.get("fictional") is True,
        "sapi_rate": script.get("sapi_rate"),
        "script_sha256": sha256_file(path),
    }


def ffmpeg_version() -> str:
    # whisper.load_audio は ffmpeg コマンドで音声を読む。
    if shutil.which("ffmpeg") is None:
        raise BridgeError("ffmpeg が PATH にありません（whisper.load_audio が使います）。")
    completed = subprocess.run(
        ["ffmpeg", "-hide_banner", "-version"], capture_output=True, text=True, check=True
    )
    first = (completed.stdout.splitlines() or [""])[0].split()
    return first[2] if len(first) > 2 and first[1] == "version" else "unknown"


def package_version(name: str) -> str | None:
    try:
        return metadata.version(name)
    except metadata.PackageNotFoundError:
        return None


def installed_source() -> dict:
    """pip が残した direct_url.json から、入れたソースが固定コミットかを見る。パスは残さない。"""
    try:
        raw = metadata.distribution("openai-whisper").read_text("direct_url.json")
    except metadata.PackageNotFoundError:
        return {"kind": "not-a-distribution", "commit_matches": None}
    if not raw:
        return {"kind": "index-or-unknown", "commit_matches": None}
    info = json.loads(raw)
    url = str(info.get("url", ""))
    if "vcs_info" in info:
        commit = info["vcs_info"].get("commit_id")
        return {"kind": "vcs", "commit_id": commit, "commit_matches": commit == SOURCE_COMMIT}
    if url.startswith("file:"):
        return {"kind": "local", "commit_matches": None}
    if "archive_info" in info:
        return {"kind": "archive", "commit_matches": SOURCE_COMMIT in url}
    return {"kind": "unknown", "commit_matches": None}


def checkpoint_location(whisper_module, model_dir: Path) -> tuple[Path, str]:
    url = whisper_module._MODELS[MODEL_NAME]
    expected_sha256 = url.split("/")[-2]  # 原典の _download と同じ取り方
    return model_dir / Path(urlparse(url).path).name, expected_sha256


def load_runtime(threads: int):
    # 推論先は明示的な device="cpu" と読み込んだパラメータの実deviceで検証する。
    import torch
    import whisper
    from whisper.utils import get_writer

    torch.set_num_threads(threads)
    if torch.get_num_threads() != threads:
        raise BridgeError(f"torch のスレッド数が {threads} になりません。")
    return torch, whisper, get_writer


def prepare_model(args: argparse.Namespace) -> int:
    model_dir = resolve_model_dir(args.model_dir, None)
    _, whisper, _ = load_runtime(args.threads)
    model_dir.mkdir(parents=True, exist_ok=True)
    whisper.load_model(MODEL_NAME, device=DEVICE, download_root=str(model_dir))
    checkpoint, expected = checkpoint_location(whisper, model_dir)
    actual = sha256_file(checkpoint)
    if actual != expected:
        raise BridgeError("重みの SHA-256 が原典の値と一致しません。")
    print(f"checkpoint ready: {checkpoint.name} sha256={actual}")
    return 0


def validate_result(result: dict, duration: float) -> list[dict]:
    if result.get("language") != "ja":
        raise BridgeError(f"result の language が ja ではありません: {result.get('language')!r}")
    if not isinstance(result.get("text"), str):
        raise BridgeError("result に text がありません。")
    segments = result.get("segments")
    if not isinstance(segments, list) or not segments:
        raise BridgeError("区間が一つも返りませんでした。")
    public = []
    previous_start = 0.0
    for index, segment in enumerate(segments):
        seg_id, start, end, text = (segment.get(k) for k in ("id", "start", "end", "text"))
        if seg_id != index:
            raise BridgeError(f"区間 id が連番ではありません: {index} 番目が {seg_id!r}")
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (start, end)):
            raise BridgeError(f"区間 {index} の時刻が数値ではありません。")
        if start < 0 or end < start:
            raise BridgeError(f"区間 {index} の時刻の順が逆です: {start} → {end}")
        if start < previous_start:
            raise BridgeError(f"区間 {index} の開始が前の区間より前です。")
        if end > duration + TAIL_TOLERANCE_SECONDS:
            raise BridgeError(
                f"区間 {index} の終わり {end} が音声の長さ {duration:.3f} 秒を超えています。"
            )
        if not isinstance(text, str):
            raise BridgeError(f"区間 {index} の text が文字列ではありません。")
        previous_start = start
        public.append({"id": seg_id, "start": start, "end": end, "text": text})
    if not any(item["text"].strip() for item in public):
        raise BridgeError("どの区間にも文字がありません。")
    return public


def assert_public(text: str, private_paths: list[Path]) -> None:
    """公開する記録に、手元の絶対パスが入っていないことを確かめる。"""
    for path in private_paths:
        raw = str(path)
        for needle in {raw, raw.replace("\\", "/"), json.dumps(raw)[1:-1]}:
            if needle and needle in text:
                raise BridgeError("session.json に手元のパスが入りそうになりました。書き出しを止めます。")


def transcribe(args: argparse.Namespace) -> int:
    out = check_out_free(args.out)
    model_dir = resolve_model_dir(args.model_dir, out)
    audio = check_audio_path(args.audio)
    audio_info = read_wav_info(audio)
    audio_sha256 = sha256_file(audio)
    provenance = read_script_provenance(HERE / SCRIPT_PUBLIC_PATH)
    ffmpeg = ffmpeg_version()

    torch, whisper, get_writer = load_runtime(args.threads)
    source = installed_source()
    if source["commit_matches"] is False:
        raise BridgeError("入っている openai-whisper が固定コミットのソースではありません。")

    checkpoint, expected_sha256 = checkpoint_location(whisper, model_dir)
    if not checkpoint.is_file():
        raise BridgeError("重みがありません。先に --prepare-model を実行してください。")

    started = time.perf_counter()
    model = whisper.load_model(MODEL_NAME, device=DEVICE, download_root=str(model_dir))
    load_seconds = time.perf_counter() - started
    model_device = str(next(model.parameters()).device)
    if model_device != DEVICE:
        raise BridgeError(f"モデルが {model_device} にあります。")
    checkpoint_sha256 = sha256_file(checkpoint)
    if checkpoint_sha256 != expected_sha256:
        raise BridgeError("重みの SHA-256 が原典の値と一致しません。")

    started = time.perf_counter()
    result = model.transcribe(str(audio), **TRANSCRIBE_OPTIONS)
    transcribe_seconds = time.perf_counter() - started

    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    staging = out.parent / f".{out.name}.partial-{stamp}"
    staging.mkdir()
    try:
        # 原典の書き出しをそのまま使う。options={} は CLI の単語単位オプションを使わない指定。
        writer = get_writer("all", str(staging))
        writer(result, str(audio), {})
        segments = validate_result(result, audio_info["duration_seconds"])
        artifacts = {
            f"{CASE_ID}.{ext}": sha256_file(staging / f"{CASE_ID}.{ext}") for ext in WRITER_EXTENSIONS
        }

        session = {
            "schema_version": 1,
            "id": CASE_ID,
            "status": "completed",
            "recorded_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "audio": {
                "path": AUDIO_PUBLIC_PATH,
                "sha256": audio_sha256,
                "duration_seconds": round(audio_info["duration_seconds"], 6),
                "sample_rate": audio_info["sample_rate"],
                "channels": audio_info["channels"],
                "sample_width_bits": audio_info["sample_width_bits"],
                "frames": audio_info["frames"],
                "kind": "synthetic",
                "voice_name": provenance["voice_name"],
                "fictional": provenance["fictional"],
                "script_path": SCRIPT_PUBLIC_PATH,
                "script_sha256": provenance["script_sha256"],
            },
            "engine": {
                "library": "openai-whisper",
                "version": whisper.__version__,
                "source_commit": SOURCE_COMMIT,
                "installed_source": source,
                "model": MODEL_NAME,
                "device": DEVICE,
                "task": TRANSCRIBE_OPTIONS["task"],
                "language": TRANSCRIBE_OPTIONS["language"],
                "fp16": TRANSCRIBE_OPTIONS["fp16"],
                "temperature": TRANSCRIBE_OPTIONS["temperature"],
                "condition_on_previous_text": TRANSCRIBE_OPTIONS["condition_on_previous_text"],
                "reference_text_supplied": False,
                "initial_prompt": None,
                "word_timestamps": False,
                "threads": THREADS,
                "torch_threads_observed": torch.get_num_threads(),
                "cuda_hidden_for_process": False,
                "device_verification": "load_model(device=cpu) and actual parameter device observed cpu",
                "checkpoint_file": checkpoint.name,
                "checkpoint_sha256": checkpoint_sha256,
                "checkpoint_sha256_expected": expected_sha256,
                "writer": "whisper.utils.get_writer('all'), options={}",
            },
            "timings": {
                "load_seconds": round(load_seconds, 3),
                "transcribe_seconds": round(transcribe_seconds, 3),
                "scope": TIMING_SCOPE,
            },
            "result": {
                "language": result["language"],
                "text": result["text"],
                "segments": segments,
            },
            "artifacts_sha256": artifacts,
            "environment": {
                "python": platform.python_version(),
                "python_implementation": platform.python_implementation(),
                "os": platform.system(),
                "os_release": platform.release(),
                "machine": platform.machine(),
                "torch": torch.__version__,
                "numpy": package_version("numpy"),
                "numba": package_version("numba"),
                "tiktoken": package_version("tiktoken"),
                "more-itertools": package_version("more-itertools"),
                "tqdm": package_version("tqdm"),
                "ffmpeg": ffmpeg,
            },
            "notes": [
                "Input is original fictional Japanese text spoken by a local Windows synthetic voice; not a person recording or meeting.",
                "One run on one file; not an accuracy or speed benchmark.",
                "Browser page edits these saved results; it does not run Whisper.",
            ],
        }
        text = json.dumps(session, ensure_ascii=False, indent=2) + "\n"
        assert_public(text, [HERE, model_dir, Path.home()])
        (staging / "session.json").write_text(text, encoding="utf-8")

        if out.exists():
            out.rmdir()  # 空であることは check_out_free で確かめている
        staging.rename(out)
    except BaseException:
        # 途中の書き出しは out に混ぜず、調べられるように残す。
        (staging / "error.txt").write_text(traceback.format_exc(), encoding="utf-8")
        print(f"failed; partial files kept in {staging.name}", file=sys.stderr)
        raise

    print(
        f"completed: {len(segments)} segments, load {load_seconds:.3f}s, "
        f"transcribe {transcribe_seconds:.3f}s -> {out.name}/"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        return prepare_model(args) if args.prepare_model else transcribe(args)
    except BridgeError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
