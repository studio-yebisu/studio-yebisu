#!/usr/bin/env python3
"""
Route eight fictional support tickets through an original Dify workflow DSL with the pinned,
unmodified Graphon runtime that Dify 1.17.1 declares, and record the actual engine events.

Copyright (c) 2026 Studio Yebisu. MIT License.
Upstream code in vendor/: langgenius/dify at f77facf (Dify Open Source License: Apache 2.0
with additional conditions; see vendor/dify/LICENSE) and graphon 0.7.0 from the official
wheel (Apache-2.0; see vendor/graphon-wheel/graphon-0.7.0.dist-info/licenses/LICENSE).

Run from a copy of this folder, in a private virtual environment that has only
requirements-runtime.txt installed:

    python run.py --artifact-dir <NEW_EMPTY_PRIVATE_DIR>

<NEW_EMPTY_PRIVATE_DIR> must be outside this folder and empty or absent. Steps, in order; any
failed check stops the run, exits non-zero and writes no public record:

1. Record the Python version and platform, then replace six Python networking/process APIs
   (socket.socket.connect, socket.socket.connect_ex, socket.create_connection,
   socket.getaddrinfo, subprocess.Popen, os.system) with counters that refuse the call.
   This is instrumentation of Python APIs inside this process, not OS-level isolation.
2. Verify vendor-lock.json (SHA-256), the 292 pinned files (SHA-256 and size), that nothing
   unlisted sits in vendor/, every Graphon file against the wheel's own RECORD, the
   graphon==0.7.0 pin in Dify's api/pyproject.toml, and the two frozen inputs.
3. Check the 28 installed dependency versions against requirements-runtime.txt, then put
   vendor/graphon-wheel first on sys.path and import graphon from there (no pip install of
   graphon). The working directory becomes the private folder.
4. graphon.dsl.inspect on workflow.yml; Dify's own WorkflowGraphTopology (loaded from
   vendor/dify/api/core/workflow/graph_topology.py without edits) on the parsed graph.
5. For each of the 8 tickets: graphon.dsl.loads(..., credentials=None, start_inputs=ticket,
   config=GraphEngineConfig(min_workers=1, max_workers=1)) and list(engine.run()).
   Every event is kept as model_dump(mode="json"). The route comes from the engine.
6. Two DSL probes that must raise graphon's DslError: broken YAML, and a second start node.
7. Write outputs/workflow-runs.json once, after every check passed, and the same bytes to
   <NEW_EMPTY_PRIVATE_DIR>/result-copy.json. An existing record is never overwritten.

No Dify server, console, API, difyctl session, model, plugin or credential is used.
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the pinned vendor copy

import argparse
import base64
import copy
import csv
import hashlib
import importlib
import importlib.metadata
import importlib.util
import inspect as pyinspect
import io
import json
import os
import platform
import re
import traceback
from pathlib import Path
from types import SimpleNamespace
from typing import Any

# --- Fixed facts ------------------------------------------------------------------------------

SITE = Path(__file__).resolve().parent
VENDOR = SITE / "vendor"
GRAPHON_ROOT = VENDOR / "graphon-wheel"
GRAPHON_DIST_INFO = GRAPHON_ROOT / "graphon-0.7.0.dist-info"
DIFY_ROOT = VENDOR / "dify"
TOPOLOGY_FILE = DIFY_ROOT / "api" / "core" / "workflow" / "graph_topology.py"
PYPROJECT_FILE = DIFY_ROOT / "api" / "pyproject.toml"
LOCK_PATH = SITE / "vendor-lock.json"
REQUIREMENTS_PATH = SITE / "requirements-runtime.txt"
WORKFLOW_PATH = SITE / "workflow.yml"
TICKETS_PATH = SITE / "input" / "tickets.json"
EXPECTED_PATH = SITE / "input" / "expected.json"
RECORD_PATH = SITE / "outputs" / "workflow-runs.json"
PRIVATE_COPY_NAME = "result-copy.json"
PRIVATE_LOG_NAME = "run-log.txt"

RECORD_FORMAT = "studio-yebisu-dify-run-v1"
REPOSITORY = "langgenius/dify"
COMMIT = "f77facfe6520ed379d723288aed0b4806ad76143"
DIFY_VERSION = "1.17.1"
GRAPHON_NAME = "graphon"
GRAPHON_VERSION = "0.7.0"
GRAPHON_WHEEL_SHA256 = "6f7608aaaa65607c4935735137ed4b7029b1e6ca80202cbe829af3370cf4404e"
LOCK_SHA256 = "e454e2189985857c0ac82258dc23b01f0010deecc1cc7bf737ff214d685696ff"
LOCK_FILE_COUNT = 292
DEPENDENCY_COUNT = 28
FROZEN_INPUT_SHA256 = {
    "input/tickets.json": "b752f26d73d9fc3f48f8a3389fe876b88d273f2780bc316fdd15232a4d0cdc83",
    "input/expected.json": "0ef127da5302698a91ad9ceb1e7dcbd79863c037057fe07e514428213946b5be",
}

CASE_IDS = ["D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08"]
INPUT_KEYS = ("ticket_id", "issue", "urgency", "affected_users", "subject", "body")
NODE_IDS = ("start", "route", "urgent-note", "billing-note", "support-note", "merge", "end")
NODE_TYPES = {
    "start": "start",
    "route": "if-else",
    "urgent-note": "template-transform",
    "billing-note": "template-transform",
    "support-note": "template-transform",
    "merge": "variable-aggregator",
    "end": "end",
}
EDGE_COUNT = 8
MEMO_BY_ROUTE = {"urgent": "urgent-note", "billing": "billing-note", "false": "support-note"}
OWNER_BY_ROUTE = {"urgent": "優先対応", "billing": "請求窓口", "false": "通常窓口"}
# Keys that would mean a model, tool, plugin, credential or remote endpoint in the DSL.
FORBIDDEN_DSL_KEYS = frozenset({
    "model", "provider", "provider_id", "provider_name", "credentials", "api_key",
    "plugin_unique_identifier", "tool_name", "url", "endpoint", "authorization",
})
# Graphon's full requirements include document and model stacks that this subset never loads.
NOT_INSTALLED_MODULES = ("pandas", "transformers", "unstructured", "pypdf", "pypdfium2",
                         "docx", "pypandoc", "webvtt")

NETWORK_GUARD_SCOPE = (
    "run.py replaces socket.socket.connect, socket.socket.connect_ex, socket.create_connection "
    "and socket.getaddrinfo (network), and subprocess.Popen and os.system (process), with "
    "Python functions that count the attempt and refuse it. This is Python API "
    "instrumentation inside one process, not OS-level isolation; C extensions and other APIs "
    "are not covered."
)
PUBLIC_RUN_COMMAND = "python run.py --artifact-dir <NEW_EMPTY_PRIVATE_DIR>"
RUN_HELPERS = ("verify_sources", "check_dependencies", "install_guards", "inspect_workflow",
               "check_topology", "run_case", "run_probes", "build_record")


class RunError(RuntimeError):
    pass


LOG_LINES: list[str] = []


def log(message: str) -> None:
    LOG_LINES.append(message)
    print(f"[run] {message}", flush=True)


class Checks:
    """Every passing assertion is kept as one human-readable item; a failure stops the run."""

    def __init__(self) -> None:
        self.items: list[str] = []

    def check(self, label: str, condition: Any, detail: str = "") -> str:
        if not condition:
            raise RunError(f"check failed: {label}" + (f" ({detail})" if detail else ""))
        self.items.append(label)
        return label


def is_within(child: Path, parent: Path) -> bool:
    return child == parent or child.is_relative_to(parent)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json_bytes(data: bytes) -> Any:
    return json.loads(data.decode("utf-8"))


def relative_source(obj: Any) -> str:
    source = pyinspect.getsourcefile(obj)
    if source is None:
        raise RunError(f"no source file for {obj!r}")
    path = Path(source).resolve()
    if not is_within(path, VENDOR):
        raise RunError(f"{obj!r} was not loaded from vendor/: {path.name}")
    return path.relative_to(SITE).as_posix()


# --- Guards -----------------------------------------------------------------------------------

GUARD_ATTEMPTS: dict[str, list[str]] = {"network": [], "process": []}
_INSTALLED_GUARDS: dict[str, tuple[Any, str, Any]] = {}


class GuardBlocked(PermissionError):
    """Raised by the replaced APIs so the connection or child process never starts."""


def _refuse(kind: str, api: str):
    def refused(*args: Any, **kwargs: Any) -> Any:
        GUARD_ATTEMPTS[kind].append(api)
        raise GuardBlocked(f"{api} is refused during this run")

    refused.__name__ = refused.__qualname__ = "refused_" + re.sub(r"\W", "_", api)
    return refused


def install_guards() -> None:
    import socket
    import subprocess

    targets = (
        (socket.socket, "connect", "network", "socket.socket.connect"),
        (socket.socket, "connect_ex", "network", "socket.socket.connect_ex"),
        (socket, "create_connection", "network", "socket.create_connection"),
        (socket, "getaddrinfo", "network", "socket.getaddrinfo"),
        (subprocess.Popen, "__init__", "process", "subprocess.Popen"),
        (os, "system", "process", "os.system"),
    )
    for owner, attribute, kind, api in targets:
        replacement = _refuse(kind, api)
        setattr(owner, attribute, replacement)
        _INSTALLED_GUARDS[api] = (owner, attribute, replacement)


def guards_intact() -> bool:
    return len(_INSTALLED_GUARDS) == 6 and all(
        getattr(owner, attribute) is replacement
        for owner, attribute, replacement in _INSTALLED_GUARDS.values()
    )


# --- Step 2: sources and frozen inputs --------------------------------------------------------

def _record_hashes() -> dict[str, tuple[str, int]]:
    """graphon-0.7.0.dist-info/RECORD: path -> (urlsafe base64 SHA-256 without padding, size)."""
    text = (GRAPHON_DIST_INFO / "RECORD").read_text(encoding="utf-8")
    entries: dict[str, tuple[str, int]] = {}
    for row in csv.reader(io.StringIO(text)):
        if not row:
            continue
        path, digest, size = row
        if not digest:
            continue  # RECORD lists itself without a hash
        algorithm, _, value = digest.partition("=")
        if algorithm != "sha256":
            raise RunError(f"unexpected RECORD hash algorithm for {path}")
        entries[path] = (value, int(size))
    return entries


def verify_sources(checks: Checks) -> dict[str, Any]:
    lock_bytes = LOCK_PATH.read_bytes()
    checks.check("vendor-lock.json の SHA-256 が固定値と一致",
                 sha256_bytes(lock_bytes) == LOCK_SHA256)
    lock = load_json_bytes(lock_bytes)
    dependency = lock.get("runtime_dependency") or {}
    checks.check(
        "vendor-lock.json の固定版が langgenius/dify f77facf・1.17.1、graphon 0.7.0 と公式 wheel の SHA-256",
        lock.get("repository") == REPOSITORY and lock.get("commit") == COMMIT
        and lock.get("version") == DIFY_VERSION and dependency.get("name") == GRAPHON_NAME
        and dependency.get("version") == GRAPHON_VERSION
        and dependency.get("wheel_sha256") == GRAPHON_WHEEL_SHA256
        and dependency.get("declared_at") == "api/pyproject.toml",
    )

    files = lock.get("files")
    checks.check(f"ロックの対象が{LOCK_FILE_COUNT}ファイル",
                 isinstance(files, list) and len(files) == LOCK_FILE_COUNT)
    listed: set[str] = set()
    for entry in files:
        rel = entry.get("path")
        if (not isinstance(rel, str) or not rel.startswith("vendor/") or "\\" in rel
                or ".." in rel.split("/") or rel in listed):
            raise RunError(f"invalid lock path: {rel!r}")
        listed.add(rel)
        path = (SITE / rel).resolve()
        if not is_within(path, VENDOR) or not path.is_file():
            raise RunError(f"pinned file missing: {rel}")
        data = path.read_bytes()
        if len(data) != entry.get("bytes") or sha256_bytes(data) != entry.get("sha256"):
            raise RunError(f"pinned file differs from the lock: {rel}")
    checks.check(f"原典{LOCK_FILE_COUNT}ファイルの SHA-256 とサイズがロックと一致", True)

    present = {p.relative_to(SITE).as_posix() for p in VENDOR.rglob("*") if p.is_file()}
    unlisted = sorted(present - listed)
    checks.check("vendor/ にロックにないファイルがない（__pycache__ を含む）", not unlisted,
                 ", ".join(unlisted[:5]))

    record = _record_hashes()
    wheel_prefix = "vendor/graphon-wheel/"
    vendored_wheel = {rel[len(wheel_prefix):] for rel in listed if rel.startswith(wheel_prefix)}
    for rel in sorted(vendored_wheel):
        if rel.endswith("/RECORD"):
            continue
        expected = record.get(rel)
        data = (GRAPHON_ROOT / rel).read_bytes()
        digest = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b"=").decode()
        if expected is None or expected != (digest, len(data)):
            raise RunError(f"graphon file does not match the wheel RECORD: {rel}")
    missing_from_vendor = sorted(set(record) - vendored_wheel)
    checks.check("graphon の同梱ファイルが wheel 自身の RECORD と過不足なく一致",
                 not missing_from_vendor, ", ".join(missing_from_vendor[:5]))

    metadata = (GRAPHON_DIST_INFO / "METADATA").read_text(encoding="utf-8")
    checks.check("同梱 METADATA が Name: graphon / Version: 0.7.0",
                 re.search(r"^Name: graphon$", metadata, re.M)
                 and re.search(r"^Version: 0\.7\.0$", metadata, re.M))
    pyproject = PYPROJECT_FILE.read_text(encoding="utf-8")
    checks.check("Dify の api/pyproject.toml が dify-api 1.17.1 で graphon==0.7.0 を宣言",
                 re.search(r'^name = "dify-api"$', pyproject, re.M)
                 and re.search(r'^version = "1\.17\.1"$', pyproject, re.M)
                 and re.search(r'^\s*"graphon==0\.7\.0",$', pyproject, re.M))

    inputs: dict[str, Any] = {}
    for rel, expected_hash in FROZEN_INPUT_SHA256.items():
        data = (SITE / rel).read_bytes()
        checks.check(f"{rel} の SHA-256 が実行前の固定値と一致",
                     sha256_bytes(data) == expected_hash)
        inputs[rel] = load_json_bytes(data)
    return {"inputs": inputs}


def validate_inputs(tickets: Any, expected: Any, checks: Checks) -> None:
    cases = tickets.get("cases") if isinstance(tickets, dict) else None
    checks.check("tickets.json が架空と明記された8件 D01〜D08",
                 tickets.get("fictional") is True and isinstance(cases, list)
                 and [case.get("id") for case in cases] == CASE_IDS)
    for case in cases:
        data = case.get("input")
        ok = (isinstance(data, dict) and set(data) == set(INPUT_KEYS)
              and all(isinstance(data[key], str) for key in INPUT_KEYS if key != "affected_users")
              and type(data["affected_users"]) is int and data["affected_users"] >= 0
              and isinstance(case.get("label"), str))
        if not ok:
            raise RunError(f"ticket {case.get('id')} does not have the six expected fields")
    checks.check("各問い合わせが6項目（影響人数は0以上の整数）", True)
    oracle = expected.get("selected_case_ids") if isinstance(expected, dict) else None
    checks.check("expected.json が8件すべてに urgent・billing・false のいずれかを指定",
                 isinstance(oracle, dict) and list(oracle) == CASE_IDS
                 and all(value in MEMO_BY_ROUTE for value in oracle.values()))


# --- Step 3: dependencies and imports ---------------------------------------------------------

def check_dependencies(checks: Checks) -> list[dict[str, str]]:
    pins: list[tuple[str, str]] = []
    for line in REQUIREMENTS_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name, separator, version = line.partition("==")
        if not separator:
            raise RunError(f"requirements-runtime.txt line is not pinned: {line}")
        pins.append((name, version))
    checks.check(f"requirements-runtime.txt が{DEPENDENCY_COUNT}件をすべて == で固定",
                 len(pins) == DEPENDENCY_COUNT)
    installed: list[dict[str, str]] = []
    for name, version in pins:
        try:
            actual = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError as error:
            raise RunError(f"dependency not installed: {name}") from error
        if actual != version:
            raise RunError(f"dependency version differs: {name} {actual} (pinned {version})")
        installed.append({"name": name, "version": actual})
    checks.check(f"入っている依存{DEPENDENCY_COUNT}件の版が requirements-runtime.txt と一致", True)

    present = [name for name in NOT_INSTALLED_MODULES if importlib.util.find_spec(name)]
    checks.check("この確認で使わない文書処理・モデル系の依存（pandas・transformers など）が入っていない",
                 not present, ", ".join(present))
    return installed


def import_runtime(checks: Checks) -> SimpleNamespace:
    sys.path.insert(0, str(GRAPHON_ROOT))
    importlib.invalidate_caches()

    graphon_dists = [dist for dist in importlib.metadata.distributions()
                     if (dist.metadata.get("Name") or "").lower() == GRAPHON_NAME]
    dist = importlib.metadata.distribution(GRAPHON_NAME)
    dist_root = Path(str(dist.locate_file(""))).resolve()
    checks.check("graphon の配布情報は同梱の dist-info の1つだけで、版は 0.7.0",
                 len(graphon_dists) == 1 and dist.version == GRAPHON_VERSION
                 and is_within(dist_root, GRAPHON_ROOT))

    jinja2 = importlib.import_module("jinja2")
    checks.check("Jinja2 が実際に読み込める（Graphon の既定レンダラーが簡易置換に切り替わらない）",
                 importlib.metadata.version("jinja2") == "3.1.6" and hasattr(jinja2, "Environment"))

    dsl = importlib.import_module("graphon.dsl")
    config_module = importlib.import_module("graphon.graph_engine.config")
    engine_module = importlib.import_module("graphon.graph_engine.graph_engine")
    events = importlib.import_module("graphon.graph_events")
    segments = importlib.import_module("graphon.variables.segments")
    factory_module = importlib.import_module("graphon.dsl.node_factory")
    graphon_file = Path(importlib.import_module("graphon").__file__ or "").resolve()
    checks.check("import graphon が vendor/graphon-wheel から読み込まれた",
                 is_within(graphon_file, GRAPHON_ROOT))

    return SimpleNamespace(
        inspect=dsl.inspect,
        loads=dsl.loads,
        DslError=dsl.DslError,
        DslKind=dsl.DslKind,
        LoadStatus=dsl.LoadStatus,
        SlimDslNodeFactory=factory_module.SlimDslNodeFactory,
        GraphEngineConfig=config_module.GraphEngineConfig,
        GraphEngine=engine_module.GraphEngine,
        events=events,
        Segment=segments.Segment,
        yaml=importlib.import_module("yaml"),
        jinja2_version=importlib.metadata.version("jinja2"),
    )


def load_topology_class() -> Any:
    spec = importlib.util.spec_from_file_location("dify_core_workflow_graph_topology",
                                                  TOPOLOGY_FILE)
    if spec is None or spec.loader is None:
        raise RunError("cannot load graph_topology.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module  # lets inspect.getsourcefile locate the class
    spec.loader.exec_module(module)
    return module.WorkflowGraphTopology


# --- Step 4: DSL inspection and Dify topology -------------------------------------------------

def _keys_in(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        for key, item in value.items():
            found.add(str(key))
            found |= _keys_in(item)
    elif isinstance(value, list):
        for item in value:
            found |= _keys_in(item)
    return found


def inspect_workflow(api: SimpleNamespace, workflow_text: str, checks: Checks) -> Any:
    payload = api.yaml.safe_load(workflow_text)
    app = payload.get("app") or {}
    workflow = payload.get("workflow") or {}
    checks.check("workflow.yml が kind: app・version 0.3.0・mode: workflow の Dify DSL",
                 payload.get("kind") == "app" and payload.get("version") == "0.3.0"
                 and app.get("mode") == "workflow" and app.get("icon_type") == "emoji")
    checks.check("dependencies・環境変数・会話変数がすべて空",
                 payload.get("dependencies") == []
                 and workflow.get("environment_variables") == []
                 and workflow.get("conversation_variables") == [])
    used = sorted(_keys_in(payload) & FORBIDDEN_DSL_KEYS)
    checks.check("DSL にモデル・プロバイダー・認証・プラグイン・URL の指定がない", not used,
                 ", ".join(used))

    plan = api.inspect(workflow_text)
    graph = plan.document.graph_config
    checks.check("graphon.dsl.inspect の判定が loadable で、依存プラグインが0件",
                 plan.load_status == api.LoadStatus.LOADABLE and plan.load_reason is None
                 and list(plan.dependencies) == [] and plan.document.kind == api.DslKind.APP)
    nodes = list(graph["nodes"])
    edges = list(graph["edges"])
    checks.check("inspect が読んだグラフが7ノード・8エッジ",
                 len(nodes) == len(NODE_IDS) and len(edges) == EDGE_COUNT)
    checks.check("7ノードの ID と種類が start・if-else・template-transform×3・variable-aggregator・end",
                 {node["id"]: node["data"]["type"] for node in nodes} == NODE_TYPES)
    runtime_variables = plan.document.runtime_variables
    checks.check("inspect が読んだ実行時の変数が0件",
                 not runtime_variables.environment_variables
                 and not runtime_variables.conversation_variables)
    return plan


def check_topology(topology_class: Any, graph: Any, checks: Checks) -> dict[str, Any]:
    topology = topology_class.from_graph(graph)
    memos = list(MEMO_BY_ROUTE.values())
    has_node = {node_id: topology.has_node(node_id) for node_id in NODE_IDS}
    checks.check("Dify WorkflowGraphTopology.has_node が7ノードすべてで true、未知の ID で false",
                 all(has_node.values()) and topology.has_node("not-in-graph") is False)
    end_upstream = sorted(topology.upstream_node_ids("end"))
    checks.check("upstream_node_ids('end') が end 以外の6ノード",
                 end_upstream == sorted(set(NODE_IDS) - {"end"}))
    route_to_memo = {memo: topology.is_upstream(source_node_id="route", target_node_id=memo)
                     for memo in memos}
    checks.check("route が3つのメモそれぞれの上流", all(route_to_memo.values()))
    memo_to_end = {memo: topology.is_upstream(source_node_id=memo, target_node_id="end")
                   for memo in memos}
    checks.check("3つのメモがそれぞれ end の上流", all(memo_to_end.values()))
    between_memos = {
        f"{source}->{target}": topology.is_upstream(source_node_id=source, target_node_id=target)
        for source in memos for target in memos if source != target
    }
    checks.check("3つのメモは互いの上流ではない（並んだ別の分岐）",
                 not any(between_memos.values()))
    start_upstream = sorted(topology.upstream_node_ids("start"))
    checks.check("start の上流は0ノード", start_upstream == [])
    return {
        "api": "WorkflowGraphTopology.from_graph(plan.document.graph_config)",
        "source": relative_source(topology_class),
        "node_ids": [node["id"] for node in graph["nodes"]],
        "has_node": has_node,
        "has_node_unknown": topology.has_node("not-in-graph"),
        "end_upstream": end_upstream,
        "start_upstream": start_upstream,
        "route_upstream_of_memo": route_to_memo,
        "memo_upstream_of_end": memo_to_end,
        "memo_upstream_of_other_memo": between_memos,
    }


# --- Step 5: the eight runs -------------------------------------------------------------------

def _plain(api: SimpleNamespace, value: Any) -> Any:
    return value.to_object() if isinstance(value, api.Segment) else value


def run_case(api: SimpleNamespace, workflow_text: str, case: dict[str, Any], route: str,
             checks: Checks) -> dict[str, Any]:
    case_id = case["id"]
    original = case["input"]
    frozen = copy.deepcopy(original)
    ev = api.events
    own: list[str] = []

    def check(label: str, condition: Any, detail: str = "") -> None:
        checks.check(f"{case_id}: {label}", condition, detail)
        own.append(label)

    engine = api.loads(
        workflow_text,
        credentials=None,
        start_inputs=copy.deepcopy(original),
        config=api.GraphEngineConfig(min_workers=1, max_workers=1),
    )
    check("graphon.dsl.loads が GraphEngine を返した", type(engine) is api.GraphEngine)
    raw_events = list(engine.run())
    events = [{"type": type(event).__name__, "data": event.model_dump(mode="json")}
              for event in raw_events]

    failure_types = (ev.NodeRunFailedEvent, ev.NodeRunExceptionEvent, ev.GraphRunFailedEvent,
                     ev.GraphRunPartialSucceededEvent, ev.GraphRunAbortedEvent,
                     ev.GraphRunPausedEvent)
    finals = [event for event in raw_events if isinstance(event, ev.GraphRunSucceededEvent)]
    check("イベントが GraphRunStartedEvent で始まり、ただ1つの GraphRunSucceededEvent で終わる",
          raw_events and isinstance(raw_events[0], ev.GraphRunStartedEvent)
          and len(finals) == 1 and raw_events[-1] is finals[0])
    check("失敗・例外・中断・一時停止のイベントが0件",
          not any(isinstance(event, failure_types) for event in raw_events))
    node_types = {event.node_type for event in raw_events if isinstance(event, ev.GraphNodeEventBase)}
    check("動いたノードの種類が start・if-else・template-transform・variable-aggregator・end だけ（LLM なし）",
          node_types <= set(NODE_TYPES.values()))

    succeeded = [event for event in raw_events if isinstance(event, ev.NodeRunSucceededEvent)
                 and event.in_iteration_id is None and event.in_loop_id is None]
    path = [event.node_id for event in succeeded]
    memo = MEMO_BY_ROUTE[route]
    check(f"成功したノードの順が start → route → {memo} → merge → end",
          path == ["start", "route", memo, "merge", "end"], " → ".join(path))
    started = {event.node_id for event in raw_events if isinstance(event, ev.NodeRunStartedEvent)}
    check("開始したメモのノードが1つだけ", started & set(MEMO_BY_ROUTE.values()) == {memo},
          ", ".join(sorted(started)))
    by_node = {event.node_id: event for event in succeeded}

    route_result = by_node["route"].node_run_result
    check(f"route の selected_case_id と分岐ハンドルが {route}（expected.json と一致）",
          route_result.outputs.get("selected_case_id") == route
          and route_result.edge_source_handle == route
          and route_result.outputs.get("result") is (route != "false"))

    outputs = dict(finals[0].outputs)
    check("最終出力が text と selected_case_id の2項目",
          set(outputs) == {"text", "selected_case_id"} and isinstance(outputs["text"], str))
    check("最終出力の selected_case_id が route の値と一致",
          outputs["selected_case_id"] == route)
    text = outputs["text"]

    memo_result = by_node[memo].node_run_result
    check("メモのノードに渡った6項目が入力と完全に一致", dict(memo_result.inputs) == frozen)
    check("メモのノードの output が最終の text と一致", memo_result.outputs.get("output") == text)
    check("merge の output が最終の text と一致",
          _plain(api, by_node["merge"].node_run_result.outputs.get("output")) == text)
    check("end の出力が最終出力と一致", dict(by_node["end"].node_run_result.outputs) == outputs)

    owner = OWNER_BY_ROUTE[route]
    data = frozen
    check(f"メモの1行目が【担当】{owner}", text.startswith(f"【担当】{owner}\n"))
    check("問い合わせ番号・件名・種類・緊急度・影響人数がそのまま入った",
          f"\n問い合わせ：{data['ticket_id']}\n" in text
          and f"\n件名：{data['subject']}\n" in text
          and f"\n種類・緊急度：{data['issue']}・{data['urgency']}／影響{data['affected_users']}人\n"
          in text)
    check("本文が改変されずに「本文：」の次の行から入った",
          f"\n本文：\n{data['body']}\n次の対応：" in text)
    check("メモが7行（本文の改行の分だけ増える）",
          len(text.split("\n")) == 7 + data["body"].count("\n"))

    if case_id == "D07":
        check("件名の {{ 7 * 7 }} が文字のまま残り、49 に計算されていない",
              "{{ 7 * 7 }} は入力データ" in text and "49" not in text
              and text.count("{{") == 1)
        check('本文の <script>alert("demo")</script> がエスケープも実行もされず文字のまま残った',
              '<script>alert("demo")</script>' in text and "&lt;" not in text
              and "&quot;" not in text)
    else:
        check("テンプレートの記号 {{ }} や {% %} が残っていない", "{{" not in text and "{%" not in text)
    if case_id == "D08":
        check("影響0人・空の本文でも失敗せず、本文の行は空、None と表示されない",
              data["body"] == "" and "\n本文：\n\n次の対応：" in text and "None" not in text
              and "影響0人" in text)

    check("実行後も入力のオブジェクトが変わっていない", original == frozen)
    return {
        "id": case_id,
        "label": case["label"],
        "input": original,
        "output": {"text": text, "selected_case_id": outputs["selected_case_id"],
                   "node_path": path},
        "events": events,
        "checks": own,
    }


# --- Step 6: DSL probes -----------------------------------------------------------------------

def _probe(api: SimpleNamespace, call: Any, expected_code: str, label: str,
           checks: Checks) -> dict[str, Any]:
    try:
        call()
    except api.DslError as error:
        checks.check(label, error.code == expected_code and str(error), error.code)
        return {"name": type(error).__name__, "code": error.code, "message": str(error),
                "details": error.details}
    raise RunError(f"probe did not raise DslError: {label}")


def run_probes(api: SimpleNamespace, workflow_text: str, checks: Checks) -> list[dict[str, Any]]:
    broken = "kind: app\nversion: 0.3.0\napp: [mode: workflow\n"
    p01 = _probe(api, lambda: api.inspect(broken), "parse.invalid_yaml",
                 "P01: 閉じていない YAML を inspect が DslError（parse.invalid_yaml）で止めた", checks)

    payload = api.yaml.safe_load(workflow_text)
    duplicate = copy.deepcopy(payload)
    nodes = duplicate["workflow"]["graph"]["nodes"]
    extra = copy.deepcopy(next(node for node in nodes if node["id"] == "start"))
    extra["id"] = "start-duplicate"
    extra["data"]["title"] = "問い合わせを受け取る（2つ目）"
    for key in ("position", "positionAbsolute"):
        extra[key] = {"x": 80, "y": 620}
    nodes.append(extra)
    duplicate_text = api.yaml.safe_dump(duplicate, allow_unicode=True, sort_keys=False)
    plan = api.inspect(duplicate_text)
    checks.check("P02: 開始ノードを2つにした DSL も inspect の段階では loadable",
                 plan.load_status == api.LoadStatus.LOADABLE)
    p02 = _probe(
        api,
        lambda: api.loads(duplicate_text, credentials=None,
                          config=api.GraphEngineConfig(min_workers=1, max_workers=1)),
        "graph.root_ambiguous",
        "P02: 開始ノードが2つの DSL を loads が DslError（graph.root_ambiguous）で止めた",
        checks,
    )
    return [
        {
            "id": "P01",
            "input_description": "YAML の角かっこを閉じていない短い文字列（kind: app / version: 0.3.0 / app: [mode: workflow）。",
            "api": "graphon.dsl.inspect",
            "error": p01,
        },
        {
            "id": "P02",
            "input_description": "workflow.yml を読み込んだ後、開始ノードの複製（ID start-duplicate、エッジなし）を1つ足して YAML に戻したもの。",
            "api": "graphon.dsl.inspect → graphon.dsl.loads",
            "inspect_load_status": str(plan.load_status),
            "error": p02,
        },
    ]


# --- Step 7: record ---------------------------------------------------------------------------

def build_record(*, api: SimpleNamespace, topology_class: Any, facts: dict[str, Any],
                 workflow_sha256: str, dependencies: list[dict[str, str]],
                 cases: list[dict[str, Any]], probes: list[dict[str, Any]],
                 topology: dict[str, Any], checks: Checks) -> dict[str, Any]:
    entrypoints = [
        ("graphon.dsl.inspect", api.inspect),
        ("graphon.dsl.loads", api.loads),
        ("graphon.dsl.DslError", api.DslError),
        ("graphon.dsl.node_factory.SlimDslNodeFactory (built inside loads)",
         api.SlimDslNodeFactory),
        ("graphon.graph_engine.config.GraphEngineConfig", api.GraphEngineConfig),
        ("graphon.graph_engine.graph_engine.GraphEngine.run", api.GraphEngine.run),
        ("graphon.graph_events.NodeRunSucceededEvent.model_dump(mode='json')",
         api.events.NodeRunSucceededEvent),
        ("graphon.graph_events.GraphRunSucceededEvent.outputs", api.events.GraphRunSucceededEvent),
        ("graphon.variables.segments.Segment.to_object", api.Segment),
        ("core.workflow.graph_topology.WorkflowGraphTopology (Dify api/)", topology_class),
    ]
    api_entrypoints = [{"name": name, "source": relative_source(obj)} for name, obj in entrypoints]
    api_entrypoints.append({"name": "run.py helpers: " + ", ".join(RUN_HELPERS),
                            "source": "run.py"})
    return {
        "format": RECORD_FORMAT,
        "source": {"repository": REPOSITORY, "commit": COMMIT, "version": DIFY_VERSION},
        "runtime_dependency": {"name": GRAPHON_NAME, "version": GRAPHON_VERSION,
                               "wheel_sha256": GRAPHON_WHEEL_SHA256,
                               "declared_at": "vendor/dify/api/pyproject.toml",
                               "import_root": "vendor/graphon-wheel"},
        "source_lock_sha256": LOCK_SHA256,
        "input_sha256": {**FROZEN_INPUT_SHA256, "workflow.yml": workflow_sha256},
        "runtime": {
            "python": facts["python"],
            "implementation": facts["implementation"],
            "platform": facts["platform"],
            "command": PUBLIC_RUN_COMMAND,
            "api_entrypoints": api_entrypoints,
            "dependencies": {"file": "requirements-runtime.txt", "count": len(dependencies),
                             "packages": dependencies},
            "not_installed": list(NOT_INSTALLED_MODULES),
            "jinja2": api.jinja2_version,
            "engine_config": {"min_workers": 1, "max_workers": 1},
            "credentials": None,
            "network_guard_scope": NETWORK_GUARD_SCOPE,
            "network_attempts": len(GUARD_ATTEMPTS["network"]),
            "process_attempts": len(GUARD_ATTEMPTS["process"]),
            "server_started": False,
            "llm_called": False,
        },
        "cases": cases,
        "dsl_probes": probes,
        "topology": topology,
        "checks": {"passed": True, "count": len(checks.items), "items": list(checks.items)},
    }


def assert_no_private_paths(text: str, artifact_dir: Path) -> None:
    candidates = {str(SITE), SITE.as_posix(), str(artifact_dir), artifact_dir.as_posix(),
                  str(Path.home()), Path.home().as_posix(), sys.prefix, sys.executable}
    for candidate in candidates:
        if not candidate or len(candidate) < 4:
            continue
        for form in (candidate, json.dumps(candidate, ensure_ascii=False)[1:-1]):
            if form in text:
                raise RunError("the public record would contain a local path")


def write_outputs(text: str, artifact_dir: Path) -> None:
    payload = text.encode("utf-8")
    copy_path = artifact_dir / PRIVATE_COPY_NAME
    copy_path.write_bytes(payload)
    RECORD_PATH.parent.mkdir(exist_ok=True)
    if RECORD_PATH.exists():
        raise RunError("outputs/workflow-runs.json already exists; it is never overwritten")
    temporary = RECORD_PATH.with_name(f".{RECORD_PATH.name}.{os.getpid()}.tmp")
    try:
        with open(temporary, "xb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        if RECORD_PATH.exists():
            raise RunError("outputs/workflow-runs.json appeared during the run")
        os.replace(temporary, RECORD_PATH)
    finally:
        if temporary.exists():
            temporary.unlink()
    if RECORD_PATH.read_bytes() != copy_path.read_bytes():
        RECORD_PATH.unlink()
        raise RunError("the public record differs from the private copy")


# --- Main -------------------------------------------------------------------------------------

def prepare_artifact_dir(raw: str) -> Path:
    artifact_dir = Path(raw).expanduser().resolve()
    if is_within(artifact_dir, SITE) or is_within(SITE, artifact_dir):
        raise RunError("--artifact-dir must be outside this folder")
    if artifact_dir.exists():
        if not artifact_dir.is_dir() or any(artifact_dir.iterdir()):
            raise RunError("--artifact-dir must be a new, empty folder")
    else:
        artifact_dir.mkdir(parents=True)
    return artifact_dir


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--artifact-dir", required=True,
                        help="new empty private folder outside this site")
    args = parser.parse_args(argv)

    # Stdlib-only facts first, before any API is replaced.
    facts = {
        "python": platform.python_version(),
        "implementation": platform.python_implementation(),
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
    }
    install_guards()

    artifact_dir: Path | None = None
    try:
        if not ((3, 12) <= sys.version_info[:2] < (3, 14)):
            raise RunError("graphon 0.7.0 requires Python >=3.12,<3.14")
        if RECORD_PATH.exists():
            raise RunError("outputs/workflow-runs.json already exists; run in a fresh copy")
        artifact_dir = prepare_artifact_dir(args.artifact_dir)
        checks = Checks()

        log("verifying the lock, 292 pinned files and the frozen inputs")
        inputs = verify_sources(checks)["inputs"]
        tickets = inputs["input/tickets.json"]
        oracle = inputs["input/expected.json"]["selected_case_ids"]
        validate_inputs(tickets, inputs["input/expected.json"], checks)

        log("checking the 28 pinned dependencies")
        dependencies = check_dependencies(checks)
        os.chdir(artifact_dir)  # any relative-path side effect lands in the private folder
        api = import_runtime(checks)
        topology_class = load_topology_class()

        workflow_bytes = WORKFLOW_PATH.read_bytes()
        workflow_sha256 = sha256_bytes(workflow_bytes)
        workflow_text = workflow_bytes.decode("utf-8")

        log("inspecting workflow.yml")
        plan = inspect_workflow(api, workflow_text, checks)
        topology = check_topology(topology_class, plan.document.graph_config, checks)

        cases: list[dict[str, Any]] = []
        for case in tickets["cases"]:
            log(f"running {case['id']}")
            cases.append(run_case(api, workflow_text, case, oracle[case["id"]], checks))

        by_id = {case["id"]: case for case in cases}
        checks.check(
            "D06: 請求で至急の問い合わせは、先に判定される優先対応へ進み、請求窓口を通らない",
            by_id["D06"]["output"]["selected_case_id"] == "urgent"
            and "billing-note" not in by_id["D06"]["output"]["node_path"],
        )
        checks.check(
            "D04・D05: 影響99人は通常窓口、100人は優先対応（≥ 100 の境目）",
            by_id["D04"]["output"]["selected_case_id"] == "false"
            and by_id["D05"]["output"]["selected_case_id"] == "urgent",
        )
        checks.check(
            "8件で3つの分岐すべてが少なくとも1回ずつ実際に通った",
            {case["output"]["selected_case_id"] for case in cases} == set(MEMO_BY_ROUTE),
        )

        log("running the two DSL probes")
        probes = run_probes(api, workflow_text, checks)

        checks.check("差し替えた6つの API がそのまま残っている", guards_intact())
        checks.check("通信の試みが0件", not GUARD_ATTEMPTS["network"],
                     ", ".join(GUARD_ATTEMPTS["network"][:5]))
        checks.check("子プロセス起動の試みが0件", not GUARD_ATTEMPTS["process"],
                     ", ".join(GUARD_ATTEMPTS["process"][:5]))
        checks.check("実行後も workflow.yml が同じバイト列",
                     sha256_bytes(WORKFLOW_PATH.read_bytes()) == workflow_sha256)

        record = build_record(api=api, topology_class=topology_class, facts=facts,
                              workflow_sha256=workflow_sha256, dependencies=dependencies,
                              cases=cases, probes=probes, topology=topology, checks=checks)
        text = json.dumps(record, ensure_ascii=False, indent=2) + "\n"
        assert_no_private_paths(text, artifact_dir)
        write_outputs(text, artifact_dir)
        log(f"wrote outputs/workflow-runs.json with {len(checks.items)} passing checks")
        return 0
    except Exception as error:  # report, keep the private log, publish nothing
        LOG_LINES.append(traceback.format_exc())
        print(f"[run] FAILED: {error}", file=sys.stderr, flush=True)
        return 1
    finally:
        if artifact_dir is not None and artifact_dir.is_dir():
            (artifact_dir / PRIVATE_LOG_NAME).write_text("\n".join(LOG_LINES) + "\n",
                                                         encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
