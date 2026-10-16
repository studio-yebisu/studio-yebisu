"""Score the fictional 凪の図書室 FAQ pairs with real Ragas string metrics.

Reads input/faq-pairs.json and calls the installed Ragas collections metrics
ExactMatch, NonLLMStringSimilarity(LEVENSHTEIN) and StringPresence through
``await metric.ascore(reference=..., response=...)`` for every before/after
response (10 cases x 2 responses x 3 metrics = 60 calls). The scores are
written unrounded to outputs/evaluation.json. Existing output is never
overwritten.

No LLM, embeddings, API key, account or network service is used. Ragas usage
tracking is disabled before Ragas is imported, and outbound socket
connections are denied and recorded while Ragas is imported and scored; any
attempt fails the run without writing output.

Copyright (c) 2026 Studio Yebisu. MIT License.
"""
from __future__ import annotations

import os

# Must precede every Ragas import: ragas._analytics.do_not_track() caches the
# first value it reads.
os.environ["RAGAS_DO_NOT_TRACK"] = "true"

import argparse
import asyncio
import copy
import errno
import hashlib
import json
import math
import platform
import socket
import sys
from importlib import metadata
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_INPUT = HERE / "input" / "faq-pairs.json"
DEFAULT_OUTPUT = HERE / "outputs" / "evaluation.json"

INPUT_FORMAT = "studio-yebisu-faq-fixture-v1"
OUTPUT_FORMAT = "studio-yebisu-ragas-result-v1"
SOURCE = {
    "repository": "vibrantlabsai/ragas",
    "commit": "298b68274234c060deacab3cf5fb52aa3a20e885",
}
PRETEND_VERSION = "0.0.0+studio.298b68274234"
METRIC_API = "ragas.metrics.collections"
CASE_COUNT = 10
DOCUMENT_COUNT = 10
SIDES = ("before", "after")
LABELS = ("grounded", "contradiction", "unsupported_addition")
BINARY_METRICS = ("exact_match", "string_presence")

METRICS = [
    {
        "id": "exact_match",
        "label": "完全一致",
        "ragas_class": "ExactMatch",
        "call": "await ExactMatch().ascore(reference=reference, response=response)",
        "source_file": "src/ragas/metrics/collections/_string.py",
        "range": [0.0, 1.0],
        "description": "回答が参照文と1文字も違わなければ1.0、それ以外は0.0。意味が同じ言い換えも0.0になります。",
    },
    {
        "id": "string_similarity",
        "label": "文字列の近さ",
        "ragas_class": "NonLLMStringSimilarity",
        "distance": "LEVENSHTEIN",
        "call": "await NonLLMStringSimilarity(distance_measure=DistanceMeasure.LEVENSHTEIN).ascore(reference=reference, response=response)",
        "source_file": "src/ragas/metrics/collections/_string.py",
        "range": [0.0, 1.0],
        "description": "1から rapidfuzz の Levenshtein 正規化距離を引いた値。文字の挿入・削除・置換が少ないほど1.0に近く、意味の近さは測りません。",
    },
    {
        "id": "string_presence",
        "label": "基準文の包含",
        "ragas_class": "StringPresence",
        "call": "await StringPresence().ascore(reference=reference, response=response)",
        "source_file": "src/ragas/metrics/collections/_string.py",
        "range": [0.0, 1.0],
        "description": "参照文の全体が回答の中にそのまま含まれていれば1.0、なければ0.0。参照文のあとに追記があっても1.0で、追記の正しさは見ません。",
    },
]

LIMITS = [
    "3指標はどれも、参照文と回答の文字列だけを比べます。内容が根拠に忠実か、事実として正しいか、意味が同じかは判定しません。",
    "参照文は架空の資料本文そのものです。文字列はUnicodeのまま渡し、正規化・空白除去・表記ゆれの吸収をしていません。",
    "before/after は意図して誤り・言い換え・根拠のない追記を入れた固定の入力名で、実際のRAGシステム・モデル・検索器を変更して実行した結果ではありません。",
    "注釈（grounded・contradiction・unsupported_addition）と照合メモは制作担当が入力に書いたものです。Ragasの出力、LLM judge、人による承認ではありません。",
    "完全一致の件数や平均は正答率ではありません。採用や合否の基準値は置いていません。10問の架空データで、代表的なベンチマークではありません。",
    "通信の拒否と記録は、Pythonの socket.socket.connect / connect_ex、socket.create_connection、実行中イベントループの create_connection / sock_connect を通る接続が対象です。DNS問い合わせや、C拡張が独自に開く接続は記録の対象外です。",
]


class EvaluationError(Exception):
    """Input, environment or scoring problem that stops the run."""


class NetworkGuard:
    """Deny and record outbound connections while Ragas is imported and scored.

    Installed inside the running coroutine so the event loop's own self-pipe
    (built with socket.socketpair, a loopback connect on Windows) already
    exists. Only the function name and destination host/port are recorded.
    """

    def __init__(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop
        self.attempts: list[dict] = []
        self._saved: list[tuple[object, str, object, bool]] = []

    def _record(self, function: str, address: object) -> None:
        entry: dict = {"function": function}
        if isinstance(address, tuple) and len(address) >= 2:
            entry["host"] = str(address[0])
            entry["port"] = address[1] if isinstance(address[1], int) else str(address[1])
        else:
            entry["address_type"] = type(address).__name__
        self.attempts.append(entry)

    def _patch(self, owner: object, name: str, replacement: object) -> None:
        own = name in vars(owner) if hasattr(owner, "__dict__") else False
        self._saved.append((owner, name, getattr(owner, name), own))
        setattr(owner, name, replacement)

    def install(self) -> None:
        guard = self

        def connect(sock, address):
            guard._record("socket.connect", address)
            raise ConnectionRefusedError("network denied by evaluate.py")

        def connect_ex(sock, address):
            guard._record("socket.connect_ex", address)
            return errno.ECONNREFUSED

        def create_connection(address, *args, **kwargs):
            guard._record("socket.create_connection", address)
            raise ConnectionRefusedError("network denied by evaluate.py")

        async def loop_create_connection(protocol_factory, host=None, port=None, *args, **kwargs):
            guard._record("loop.create_connection", (host, port))
            raise ConnectionRefusedError("network denied by evaluate.py")

        async def loop_sock_connect(sock, address):
            guard._record("loop.sock_connect", address)
            raise ConnectionRefusedError("network denied by evaluate.py")

        self._patch(socket.socket, "connect", connect)
        self._patch(socket.socket, "connect_ex", connect_ex)
        self._patch(socket, "create_connection", create_connection)
        self._patch(self.loop, "create_connection", loop_create_connection)
        self._patch(self.loop, "sock_connect", loop_sock_connect)

    def uninstall(self) -> None:
        while self._saved:
            owner, name, original, own = self._saved.pop()
            if own:
                setattr(owner, name, original)
            else:
                delattr(owner, name)


def display_path(path: Path) -> str:
    """Path relative to this folder, or the file name only (no local paths)."""
    try:
        return path.resolve().relative_to(HERE).as_posix()
    except ValueError:
        return path.name


def reject_constant(name: str):
    raise EvaluationError(f"input contains non-finite number {name}")


def reject_duplicates(pairs: list) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise EvaluationError(f"input has duplicate key {key!r}")
        result[key] = value
    return result


def load_fixture(raw: bytes) -> dict:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as error:
        raise EvaluationError(f"input is not UTF-8: {error}") from error
    try:
        data = json.loads(text, object_pairs_hook=reject_duplicates, parse_constant=reject_constant)
    except json.JSONDecodeError as error:
        raise EvaluationError(f"input is not valid JSON: {error}") from error
    if not isinstance(data, dict):
        raise EvaluationError("input must be a JSON object")
    return data


def text_field(owner: dict, key: str, where: str) -> str:
    value = owner.get(key)
    if not isinstance(value, str) or not value.strip():
        raise EvaluationError(f"{where}.{key} must be a non-empty string")
    return value


def validate(data: dict) -> None:
    if data.get("format") != INPUT_FORMAT:
        raise EvaluationError(f"input format must be {INPUT_FORMAT!r}")
    if data.get("fictional") is not True:
        raise EvaluationError("input must declare fictional: true")
    for key in ("id", "title", "notice", "design", "annotation_source"):
        text_field(data, key, "input")

    meanings = data.get("label_meanings")
    if not isinstance(meanings, dict) or set(meanings) != set(LABELS):
        raise EvaluationError(f"label_meanings must define exactly {', '.join(LABELS)}")
    for label in LABELS:
        text_field(meanings, label, "label_meanings")

    documents = data.get("documents")
    if not isinstance(documents, list) or len(documents) != DOCUMENT_COUNT:
        raise EvaluationError(f"documents must list exactly {DOCUMENT_COUNT} items")
    texts: dict[str, str] = {}
    for index, document in enumerate(documents):
        where = f"documents[{index}]"
        if not isinstance(document, dict):
            raise EvaluationError(f"{where} must be an object")
        doc_id = text_field(document, "id", where)
        text_field(document, "title", where)
        if doc_id in texts:
            raise EvaluationError(f"duplicate document id {doc_id}")
        texts[doc_id] = text_field(document, "text", where)

    cases = data.get("cases")
    if not isinstance(cases, list) or len(cases) != CASE_COUNT:
        raise EvaluationError(f"cases must list exactly {CASE_COUNT} items")
    seen: set[str] = set()
    for index, case in enumerate(cases):
        where = f"cases[{index}]"
        if not isinstance(case, dict):
            raise EvaluationError(f"{where} must be an object")
        case_id = text_field(case, "id", where)
        if case_id in seen:
            raise EvaluationError(f"duplicate case id {case_id}")
        seen.add(case_id)
        where = f"case {case_id}"
        text_field(case, "question", where)
        reference = text_field(case, "reference", where)
        cited = case.get("reference_document_ids")
        if not isinstance(cited, list) or len(cited) != 1 or not isinstance(cited[0], str):
            raise EvaluationError(f"{where}.reference_document_ids must hold exactly one id")
        if cited[0] not in texts:
            raise EvaluationError(f"{where} cites unknown document {cited[0]}")
        if reference != texts[cited[0]]:
            raise EvaluationError(f"{where}.reference must equal the text of {cited[0]} exactly")
        for side in SIDES:
            answer = case.get(side)
            if not isinstance(answer, dict):
                raise EvaluationError(f"{where}.{side} must be an object")
            if "scores" in answer:
                raise EvaluationError(f"{where}.{side} already has scores; input must be unscored")
            text_field(answer, "response", f"{where}.{side}")
            annotation = answer.get("annotation")
            if not isinstance(annotation, dict):
                raise EvaluationError(f"{where}.{side}.annotation must be an object")
            if annotation.get("label") not in LABELS:
                raise EvaluationError(f"{where}.{side}.annotation.label must be one of {', '.join(LABELS)}")
            text_field(annotation, "note", f"{where}.{side}.annotation")


def checked_value(result: object, metric_id: str, where: str) -> float:
    value = getattr(result, "value", None)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise EvaluationError(f"{metric_id} for {where} returned a non-numeric value: {value!r}")
    value = float(value)
    if not math.isfinite(value) or not 0.0 <= value <= 1.0:
        raise EvaluationError(f"{metric_id} for {where} returned {value!r}, outside 0..1")
    if metric_id in BINARY_METRICS and value not in (0.0, 1.0):
        raise EvaluationError(f"{metric_id} for {where} returned {value!r}, expected 0.0 or 1.0")
    return value


async def score_cases(cases: list, metrics: list) -> tuple[list, int]:
    calls = 0
    rows = []
    for case in cases:
        row = copy.deepcopy(case)
        for side in SIDES:
            scores = {}
            for metric_id, metric in metrics:
                result = await metric.ascore(reference=case["reference"], response=case[side]["response"])
                scores[metric_id] = checked_value(result, metric_id, f"{case['id']} {side}")
                calls += 1
            row[side]["scores"] = scores
        rows.append(row)
    return rows, calls


def summarize(rows: list) -> dict:
    summary: dict = {"case_count": len(rows)}
    for side in SIDES:
        values = {metric["id"]: [row[side]["scores"][metric["id"]] for row in rows] for metric in METRICS}
        summary[side] = {
            "mean": {metric_id: math.fsum(scores) / len(scores) for metric_id, scores in values.items()},
            "exact_match_count": sum(1 for value in values["exact_match"] if value == 1.0),
            "string_presence_count": sum(1 for value in values["string_presence"] if value == 1.0),
        }
    return summary


def count_annotations(data: dict) -> dict:
    counts: dict = {
        "source": "input",
        "note": "制作担当が入力に書いた照合メモのラベル数です。Ragasの分類や判定ではありません。",
    }
    for side in SIDES:
        counts[side] = {label: 0 for label in LABELS}
        for case in data["cases"]:
            counts[side][case[side]["annotation"]["label"]] += 1
    return counts


def distribution_version(name: str) -> str:
    try:
        return metadata.version(name)
    except metadata.PackageNotFoundError as error:
        raise EvaluationError(f"{name} is not installed in this environment") from error


async def run(args: argparse.Namespace) -> int:
    output: Path = args.out
    if output.exists():
        raise EvaluationError(f"output already exists, not overwriting: {display_path(output)}")
    try:
        raw = args.input.read_bytes()
    except OSError as error:
        raise EvaluationError(f"cannot read input {display_path(args.input)}: {error.strerror}") from error
    data = load_fixture(raw)
    validate(data)

    guard = NetworkGuard(asyncio.get_running_loop())
    guard.install()
    try:
        try:
            from ragas._analytics import do_not_track
            from ragas.metrics.collections import (
                DistanceMeasure,
                ExactMatch,
                NonLLMStringSimilarity,
                StringPresence,
            )
        except ImportError as error:
            raise EvaluationError(f"cannot import Ragas metrics: {error}") from error
        tracking_disabled = do_not_track() is True
        if not tracking_disabled:
            raise EvaluationError("Ragas usage tracking is not disabled")
        metrics = [
            ("exact_match", ExactMatch()),
            ("string_similarity", NonLLMStringSimilarity(distance_measure=DistanceMeasure.LEVENSHTEIN)),
            ("string_presence", StringPresence()),
        ]
        rows, calls = await score_cases(data["cases"], metrics)
    finally:
        guard.uninstall()

    if guard.attempts:
        listed = ", ".join(
            f"{a['function']} {a.get('host', a.get('address_type'))}:{a.get('port', '')}" for a in guard.attempts
        )
        raise EvaluationError(f"network connection attempted during evaluation: {listed}")
    expected = CASE_COUNT * len(SIDES) * len(METRICS)
    if calls != expected:
        raise EvaluationError(f"expected {expected} metric calls, completed {calls}")

    ragas_version = distribution_version("ragas")
    if ragas_version == PRETEND_VERSION:
        version_note = (
            f"{PRETEND_VERSION} is the local build label set with SETUPTOOLS_SCM_PRETEND_VERSION_FOR_RAGAS "
            "because the source ZIP has no Git metadata. It is not an official Ragas release; "
            "source.commit is the authority."
        )
    else:
        version_note = (
            "Distribution version reported by the installed package, recorded as-is. "
            "The fixed source is identified by source.commit."
        )

    result = {
        "format": OUTPUT_FORMAT,
        "fictional": True,
        "id": data["id"],
        "title": data["title"],
        "notice": data["notice"],
        "design": data["design"],
        "input_file": display_path(args.input),
        "input_sha256": hashlib.sha256(raw).hexdigest(),
        "source": dict(SOURCE),
        "runtime": {
            "python": platform.python_version(),
            "ragas_distribution_version": ragas_version,
            "rapidfuzz_version": distribution_version("rapidfuzz"),
            "metric_api": METRIC_API,
            "metric_calls": calls,
            "network_attempts": guard.attempts,
            "tracking_disabled": tracking_disabled,
            "packaging_version_note": version_note,
        },
        "metrics": METRICS,
        "annotation_source": data["annotation_source"],
        "label_meanings": data["label_meanings"],
        "summary": summarize(rows),
        "annotation_counts": count_annotations(data),
        "limits": LIMITS,
        "documents": data["documents"],
        "rows": rows,
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with output.open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(result, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
    except FileExistsError as error:
        raise EvaluationError(f"output already exists, not overwriting: {display_path(output)}") from error

    print(f"Ragas metric calls: {calls}")
    print(f"Wrote {display_path(output)}")
    return 0


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Score the fictional FAQ pairs with Ragas ExactMatch, NonLLMStringSimilarity and StringPresence."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="fixture JSON (default: input/faq-pairs.json)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT, help="new result JSON (default: outputs/evaluation.json)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        return asyncio.run(run(args))
    except EvaluationError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
