"""Studio Yebisu の Codebase Memory MCP 作例：架空の注文リポジトリを公式 CLI で索引し、探す・たどる・変えて索引し直す。

流れ:
  1. fixture/ の5モジュールと sample_order.json を --work/repo にコピーし、コピーで app.py を実行して領収JSON（2席×1,200円）を読む。
  2. 公式 v0.12.0 の実行ファイルで cli index_repository → list_projects → get_graph_schema → index_status。
  3. find:   search_graph（^submit_order$）→ get_code_snippet。返ったパス・行を実ソースと照合する。
  4. trace:  query_graph（CALLS の行）→ trace_path（outbound・深さ4）。
  5. update: コピーの storage.py だけを fixture/storage_revised.py に差し替え、再索引前の行を保存してから
             手で index_repository をやり直し、save_receipt → audit_receipt を確かめる。変更後の app.py も実行する。

- ツールの応答は実行ファイルが返した JSON をそのまま保存します。検索結果や呼び出し関係をここで作ったり補ったりはしません。
- 応答の失敗・照合の不一致があれば、outputs/ と samples.json を書かずに終了コード1で止まります。
- インストール・フック・全体設定・デーモンの停止・ほかの CBM プロセスの終了はしません。
  タイムアウトしたときに止めるのは、このスクリプトが起動した子プロセスだけです。
- 標準出力・標準エラーの全文は --work/private/ に残します。公開する JSON では、実行用コピーのパスを fixture/、
  キャッシュを <private-cache> に置き換え、ほかのマシン上のパスが残っていれば書き出さずに止まります。

実行: python workflow.py --binary 実行ファイル --work 新しい空のディレクトリ --cache 専用のキャッシュ
"""

import argparse
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE_DIR = HERE / "fixture"
BASE_FILES = ("app.py", "service.py", "validation.py", "pricing.py", "storage.py", "sample_order.json")
REVISION_SOURCE = "storage_revised.py"
REVISION_TARGET = "storage.py"
OUTPUT_DIR = HERE / "outputs"
RUNS_PATH = OUTPUT_DIR / "runs.json"
RESULT_PATH = OUTPUT_DIR / "result.md"
SAMPLES_PATH = HERE / "samples.json"

TOOL = "codebase-memory-mcp"
RELEASE = "v0.12.0"
VERSION_PATTERN = re.compile(r"(?<![\d.])0\.12\.0(?![\d.])")
COMMIT = "ec6427c38176efcd37b28682e82f2491afda94be"
TRANSPORT = "official native CLI; MCP protocol not exercised"
PROJECT_NAME = "yebisu-workshop-proof"
CALLS_QUERY = "MATCH (f:Function)-[:CALLS]->(g) RETURN f.name AS caller, g.name AS callee LIMIT 100"
QUERY_LIMIT = 100
TRACE_DEPTH = 4
ENTRY = "submit_order"
CALLEES = ("validate_order", "calculate_total", "save_receipt")
NEW_EDGE = ("save_receipt", "audit_receipt")
ORDER_ID = "WS-0001"
SEAT_COUNT = 2
SEAT_PRICE_JPY = 1200
TOTAL_JPY = 2400
RECEIPT_FILE = f"receipt-{ORDER_ID}.json"
AUDIT_FILE = f"audit-{ORDER_ID}.json"
CHILD_ENV = {"CBM_WORKERS": "2", "CBM_MEM_BUDGET_MB": "512"}

WINDOWS = os.name == "nt"
PATH_FLAGS = re.IGNORECASE if WINDOWS else 0
SEGMENT = r"[^\\/\s\"'<>|*?:,;()\[\]{}]+"
BOUNDARY = r"(?=$|[\\/\s\"'<>|*?:,;()\[\]{}])"
NAME_KEYS = ("name", "symbol", "function_name")
QN_KEYS = ("qualified_name", "qualifiedName", "qn")
PATH_KEYS = ("file_path", "filePath", "path", "file", "relative_path", "rel_path")
LINE_KEYS = ("start_line", "startLine", "line", "lineno", "line_start", "start")
IDENTIFIER = re.compile(r"^[\w.:/-]+$")

SCOPE_NOTE = (
    "公式 v0.12.0 のネイティブ CLI（codebase-memory-mcp cli）で、バックエンドのツールを1回ずつ実行した結果です。"
    "MCP プロトコル経由の動作、CBM Lens、ブラウザAI、意味検索は使っていません。"
    "呼び出し関係は索引に記録された静的な関係で、実行時に記録したトレースではありません。"
    "fixture/ は架空の小さなリポジトリで、変更（storage_revised.py への差し替え）は実行用コピーにだけ加えました。"
    "パスの fixture/ は実行用コピーを指します。"
)


class RunFailure(Exception):
    """ツールの応答や照合が想定と違う。成功に見える出力は書かない。"""


@dataclass
class ChildResult:
    returncode: "int | None"
    stdout: bytes
    stderr: bytes
    timed_out: bool


# ---------- 子プロセス ----------


def run_child(cmd, *, env, cwd, timeout, stdin_data=None):
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE if stdin_data is not None else subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            cwd=str(cwd),
        )
    except OSError as error:
        raise RunFailure(f"{Path(cmd[0]).name} を起動できませんでした：{error}") from error
    try:
        out, err = proc.communicate(input=stdin_data, timeout=timeout)
        return ChildResult(proc.returncode, out or b"", err or b"", False)
    except subprocess.TimeoutExpired:
        # このスクリプトが起動した子プロセスだけを止める。ほかの CBM プロセスやデーモンには触れない。
        proc.terminate()
        try:
            out, err = proc.communicate(timeout=30)
        except subprocess.TimeoutExpired:
            out, err = b"", b""
        return ChildResult(None, out or b"", err or b"", True)


def decode(data, what):
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as error:
        raise RunFailure(f"{what} を UTF-8 として読めませんでした。") from error


def tail(data, limit=600):
    text = data.decode("utf-8", errors="replace").strip()
    return text[-limit:] if text else "（標準エラーは空）"


class Cli:
    """公式実行ファイルの cli モードを1ツールずつ呼び、全文を --work/private/ に残す。"""

    def __init__(self, binary, env, private, args_via, timeout, index_timeout):
        self.binary = binary
        self.env = env
        self.private = private
        self.args_via = args_via
        self.timeout = timeout
        self.index_timeout = index_timeout
        self.count = 0

    def _stem(self, name):
        self.count += 1
        return f"{self.count:02d}-{name}"

    def _save(self, stem, result):
        logs = self.private / "logs"
        (logs / f"{stem}.stdout.txt").write_bytes(result.stdout)
        (logs / f"{stem}.stderr.txt").write_bytes(result.stderr)
        (logs / f"{stem}.exit.txt").write_text(
            "timeout\n" if result.timed_out else f"{result.returncode}\n", encoding="utf-8"
        )

    def version(self):
        stem = self._stem("version")
        result = run_child([str(self.binary), "--version"], env=self.env, cwd=self.private, timeout=60)
        self._save(stem, result)
        if result.timed_out:
            raise RunFailure("--version が60秒で終わりませんでした。")
        if result.returncode != 0:
            raise RunFailure(f"--version が終了コード {result.returncode} で失敗しました：{tail(result.stderr)}")
        text = decode(result.stdout, "--version の標準出力").strip() or decode(result.stderr, "--version の標準エラー").strip()
        first = next((line.strip() for line in text.splitlines() if line.strip()), "")
        if not VERSION_PATTERN.search(text):
            raise RunFailure(f"--version の出力に 0.12.0 が見つかりません：{first[:200]}")
        return first

    def call(self, tool, args=None, *, phase, index=False):
        stem = self._stem(tool)
        cmd = [str(self.binary), "cli", "--quiet", "--json", tool]
        args = dict(args or {})
        if tool != "index_repository":
            args["format"] = "json"
        stdin_data = None
        if tool == "list_projects":
            cmd += ["--format", "json"]
        if args and tool != "list_projects":
            payload = json.dumps(args, ensure_ascii=False)
            args_path = self.private / "args" / f"{stem}.json"
            args_path.write_text(payload, encoding="utf-8")
            if self.args_via == "file":
                cmd += ["--args-file", str(args_path)]
            else:
                stdin_data = payload.encode("utf-8")
        timeout = self.index_timeout if index else self.timeout
        result = run_child(cmd, env=self.env, cwd=self.private, timeout=timeout, stdin_data=stdin_data)
        self._save(stem, result)
        if result.timed_out:
            raise RunFailure(f"{tool} が {timeout} 秒で終わりませんでした（{phase}）。")
        if result.returncode != 0:
            raise RunFailure(f"{tool} が終了コード {result.returncode} で失敗しました（{phase}）：{tail(result.stderr)}")
        text = decode(result.stdout, f"{tool} の標準出力")
        if not text.strip():
            raise RunFailure(f"{tool} の標準出力が空でした（{phase}）。")
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as error:
            raise RunFailure(f"{tool} の標準出力を JSON として読めませんでした（{phase}）：{error}") from error
        response = unwrap(tool, parsed)
        check_error(tool, response)
        return {"tool": tool, "phase": phase, "args": dict(args or {}), "response": response}


# ---------- 応答の読み取り（形が分からないので、再帰的に控えめに調べる） ----------


def unwrap(tool, parsed):
    value = parsed
    if isinstance(value, dict) and "jsonrpc" in value:
        if value.get("error"):
            raise RunFailure(f"{tool} が JSON-RPC のエラーを返しました：{str(value['error'])[:300]}")
        value = value.get("result", value)
    if (
        isinstance(value, dict)
        and isinstance(value.get("content"), list)
        and set(value) <= {"content", "isError", "structuredContent", "_meta"}
    ):
        if value.get("isError") is True:
            raise RunFailure(f"{tool} がエラー応答を返しました：{json.dumps(value['content'], ensure_ascii=False)[:300]}")
        if value.get("structuredContent") is not None:
            return value["structuredContent"]
        texts = [item.get("text") for item in value["content"] if isinstance(item, dict) and item.get("type") == "text"]
        if len(texts) == 1 and isinstance(texts[0], str):
            try:
                return json.loads(texts[0])
            except json.JSONDecodeError as error:
                raise RunFailure(f"{tool} の MCP content を JSON として読めませんでした。") from error
        raise RunFailure(f"{tool} の MCP content の形が想定と違います。")
    return value


def check_error(tool, response):
    if not isinstance(response, dict):
        return
    if response.get("isError") is True:
        raise RunFailure(f"{tool} がエラー応答を返しました。")
    if response.get("error"):
        raise RunFailure(f"{tool} がエラーを返しました：{str(response['error'])[:300]}")
    status = response.get("status")
    if tool == "index_repository" and isinstance(status, str) and status.lower() in {"degraded", "failed", "error", "cancelled"}:
        raise RunFailure(f"index_repository の status が {status} でした。")


def iter_dicts(value):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from iter_dicts(item)
    elif isinstance(value, list):
        for item in value:
            yield from iter_dicts(item)


def iter_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from iter_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from iter_strings(item)


def first_str(record, keys):
    for key in keys:
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def first_int(record, keys):
    for key in keys:
        value = record.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
    return None


def find_key(value, key):
    for record in iter_dicts(value):
        if key in record:
            return record[key]
    return None


def same_name(value, short):
    return isinstance(value, str) and (value == short or value.endswith(("." + short, "::" + short)))


def has_edge(pairs, caller, callee):
    return any(same_name(a, caller) and same_name(b, callee) for a, b in pairs)


def extract_pairs(response):
    """query_graph の応答から caller・callee の組を取り出す。列＋行の形と、行ごとの辞書の形に対応する。"""
    pairs = []
    for record in iter_dicts(response):
        columns = record.get("columns")
        if isinstance(columns, list):
            names = [c if isinstance(c, str) else c.get("name") if isinstance(c, dict) else None for c in columns]
            if "caller" in names and "callee" in names:
                ci, ce = names.index("caller"), names.index("callee")
                for key in ("rows", "data", "results", "values"):
                    rows = record.get(key)
                    if not isinstance(rows, list):
                        continue
                    for row in rows:
                        if isinstance(row, list) and len(row) > max(ci, ce) and isinstance(row[ci], str) and isinstance(row[ce], str):
                            pairs.append((row[ci], row[ce]))
        if isinstance(record.get("caller"), str) and isinstance(record.get("callee"), str):
            pairs.append((record["caller"], record["callee"]))
    unique = []
    for pair in pairs:
        if pair not in unique:
            unique.append(pair)
    return unique


def explicit_edges(response):
    edges = []
    for record in iter_dicts(response):
        for a, b in (("from", "to"), ("source", "target"), ("caller", "callee")):
            if isinstance(record.get(a), str) and isinstance(record.get(b), str):
                edge = {"from": record[a], "to": record[b]}
                if edge not in edges:
                    edges.append(edge)
    return edges


def reached(response, names):
    identifiers = [s for s in iter_strings(response) if IDENTIFIER.match(s)]
    return [name for name in names if any(same_name(s, name) for s in identifiers)]


def longest_text(response, marker):
    texts = [s for s in iter_strings(response) if marker in s]
    return max(texts, key=len) if texts else None


def repo_relative(value, repo):
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip().replace("\\", "/")
    if text.startswith("//?/"):
        text = text[4:]
    base = repo.as_posix().rstrip("/")
    if (text.lower() if WINDOWS else text).startswith((base.lower() if WINDOWS else base) + "/"):
        return text[len(base) + 1:]
    if re.match(r"^(?:[A-Za-z]:/|/)", text):
        return None
    return text[2:] if text.startswith("./") else text


def locate(response, short, repo, tool_label):
    """search_graph の応答から、名前が short の定義を1件だけ取り出す。"""
    found = {}
    records = list(iter_dicts(response))
    # v0.12.0 emits grouped tables; reconstruct fields by its explicit qn_rule.
    if isinstance(response, dict) and isinstance(response.get("cols"), list):
        columns = response["cols"]
        for group in response.get("groups", []):
            for row in group.get("rows", []):
                if not isinstance(row, list) or len(row) != len(columns):
                    continue
                record = dict(zip(columns, row))
                name = record.get("name")
                prefix = group.get("qn_prefix", "")
                if isinstance(name, str) and isinstance(prefix, str):
                    record["qualified_name"] = prefix + "." + name if prefix else name
                record["file_path"] = group.get("file")
                lines = record.get("lines")
                if isinstance(lines, str) and lines.split("-")[0].isdigit():
                    record["start_line"] = int(lines.split("-")[0])
                records.append(record)
    for record in records:
        qn = first_str(record, QN_KEYS)
        name = first_str(record, NAME_KEYS)
        if not qn or not (same_name(qn, short) or name == short):
            continue
        entry = found.setdefault(qn, {"qualified_name": qn, "path": None, "line": None})
        entry["path"] = entry["path"] or first_str(record, PATH_KEYS)
        if entry["line"] is None:
            entry["line"] = first_int(record, LINE_KEYS)
    if len(found) != 1:
        raise RunFailure(f"{tool_label} の応答に {short} の定義が {len(found)} 件ありました（1件を想定）。")
    entry = next(iter(found.values()))
    rel = repo_relative(entry["path"], repo)
    if entry["line"] is None or rel is None or not (repo / rel).is_file():
        raise RunFailure(f"{tool_label} の応答から {short} のファイルと行を読み取れませんでした。")
    return {"qualified_name": entry["qualified_name"], "rel": rel, "line": entry["line"]}


# ---------- ソースの照合 ----------


def def_line(text, name):
    for number, line in enumerate(text.splitlines(), 1):
        if re.match(rf"\s*def {re.escape(name)}\(", line):
            return number
    return None


def call_lines(text, callee):
    pattern = re.compile(rf"(?<![\w.]){re.escape(callee)}\(")
    hits = []
    for number, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith(("def ", "from ", "import ", "#")):
            continue
        if pattern.search(line):
            hits.append({"line": number, "text": stripped})
    return hits


def added_lines(before, after):
    a, b = before.splitlines(), after.splitlines()
    added = []
    for tag, _i1, _i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag in ("insert", "replace"):
            added.extend({"line": j + 1, "text": b[j]} for j in range(j1, j2))
    return added


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tree_digest(root):
    return {p.relative_to(root).as_posix(): sha256(p) for p in sorted(root.rglob("*")) if p.is_file()}


# ---------- 架空の注文を実際に実行する（索引とは別の確認） ----------


def run_fixture(repo, out_dir, private, label):
    out_dir.mkdir(parents=True)
    before = tree_digest(repo)
    cmd = [sys.executable, "-X", "utf8", "-B", "-E", "-s", "app.py", "--order", "sample_order.json", "--out", str(out_dir)]
    result = run_child(cmd, env=dict(os.environ), cwd=repo, timeout=60)
    (private / "logs" / f"fixture-{label}.stdout.txt").write_bytes(result.stdout)
    (private / "logs" / f"fixture-{label}.stderr.txt").write_bytes(result.stderr)
    if result.timed_out or result.returncode != 0:
        raise RunFailure(f"架空の注文の実行（{label}）に失敗しました：{tail(result.stderr)}")
    if tree_digest(repo) != before:
        raise RunFailure(f"架空の注文の実行（{label}）で、実行用コピーの中のファイルが増えたか変わりました。")
    try:
        stdout = json.loads(decode(result.stdout, "app.py の標準出力"))
        files = {p.name: json.loads(p.read_text(encoding="utf-8")) for p in sorted(out_dir.iterdir())}
    except (json.JSONDecodeError, OSError) as error:
        raise RunFailure(f"架空の注文の実行（{label}）の出力を JSON として読めませんでした：{error}") from error
    return {
        "command": ["python", "-X", "utf8", "-B", "-E", "-s", "app.py", "--order", "sample_order.json", "--out", f"<{label}-output-dir>"],
        "exit_code": result.returncode,
        "stdout": stdout,
        "files": files,
    }


def check_receipt(run, order, expected_files, label):
    if sorted(run["files"]) != sorted(expected_files):
        raise RunFailure(f"{label} の出力ファイルが {sorted(run['files'])} でした（想定 {sorted(expected_files)}）。")
    expected = dict(order, total_jpy=TOTAL_JPY)
    if run["files"][RECEIPT_FILE] != expected or run["stdout"] != expected:
        raise RunFailure(f"{label} の領収JSONが想定（合計 {TOTAL_JPY} 円）と一致しません。")


# ---------- 公開用の置き換えと確認 ----------


def path_forms(path):
    raw = str(path)
    posix = path.as_posix()
    forms = {raw, posix}
    if WINDOWS:
        forms |= {"\\\\?\\" + raw, "//?/" + posix, raw.replace("\\", "\\\\")}
    return sorted(forms, key=len, reverse=True)


class Normalizer:
    """実行用コピーのパスを fixture、専用キャッシュを <private-cache> に置き換える。それ以外は変えない。"""

    def __init__(self, repo, cache):
        self.rules = [(self._pattern(repo), "fixture"), (self._pattern(cache), "<private-cache>")]

    @staticmethod
    def _pattern(path):
        alternation = "|".join(re.escape(form) for form in path_forms(path))
        return re.compile(rf"(?:{alternation}){BOUNDARY}(?P<tail>(?:[\\/]+{SEGMENT})*)[\\/]*", PATH_FLAGS)

    def text(self, value):
        for pattern, label in self.rules:
            value = pattern.sub(lambda m, label=label: label + re.sub(r"[\\/]+", "/", m.group("tail")), value)
        return value

    def __call__(self, value):
        if isinstance(value, str):
            return self.text(value)
        if isinstance(value, list):
            return [self(item) for item in value]
        if isinstance(value, dict):
            return {self.text(key): self(item) for key, item in value.items()}
        return value


def assert_public(texts, work, binary, cache):
    checks = [
        ("作業ディレクトリ", work),
        ("実行ファイルの場所", binary.parent),
        ("ホームディレクトリ", Path.home()),
        ("キャッシュ", cache),
    ]
    patterns = [(label, re.compile("|".join(re.escape(f) for f in path_forms(p)), PATH_FLAGS)) for label, p in checks]
    patterns.append(("ドライブ付きの絶対パス", re.compile(r"(?<![A-Za-z])[A-Za-z]:[\\/]")))
    patterns.append(("拡張パス", re.compile(r"\\\\\?\\|//\?/")))
    for name, text in texts.items():
        for label, pattern in patterns:
            if pattern.search(text):
                raise RunFailure(f"公開する {name} に{label}が残っています。書き出さずに止めます（全文は --work/private/logs）。")


# ---------- 結果メモ ----------


def render_result(runs):
    steps = {step["id"]: step for step in runs["steps"]}
    find, trace, update = steps["find"]["facts"], steps["trace"]["facts"], steps["update"]["facts"]
    base = runs["fixture_execution"]["base"]["files"][RECEIPT_FILE]
    revised = runs["fixture_execution"]["revised"]["files"]
    tool = runs["tool"]

    def yes_no(flag):
        return "あり" if flag else "なし"

    lines = [
        "# Codebase Memory MCP 作例：結果メモ",
        "",
        "workflow.py が [outputs/runs.json](runs.json) と同じ実行結果から書き出したメモです。"
        "架空の注文リポジトリ（[fixture/](../fixture/)）を、公式 CLI で索引・検索しました。",
        "",
        f"- ツール：{tool['name']}（`--version` の出力：`{tool['version']}`、{RELEASE}、ソース固定コミット `{COMMIT}`）",
        f"- 呼び方：{tool['transport']}。MCP プロトコル経由の動作は確かめていません。",
        f"- プロジェクト名（list_projects が返した値）：`{runs['project']}`",
        "- パスの `fixture/` は実行用コピーを指します。元の fixture/ は変えていません。",
        "",
        "## 1. 探す：submit_order の定義",
        "",
        f"search_graph（`name_pattern` `^{ENTRY}$`、`label` Function）が返した定義は1件です。",
        "",
        f"- qualified_name：`{find['qualified_name']}`",
        f"- 場所：[{find['file']}](../{find['file']}) の {find['line']} 行目（実ソースの `def {ENTRY}` は {find['source_def_line']} 行目）",
        f"- get_code_snippet の本文：空行を除く {find['snippet_lines']} 行のうち {find['snippet_lines_in_source']} 行が、実ソースの行と同じ文字列でした。",
        "",
        "## 2. たどる：submit_order からの呼び出し",
        "",
        f"query_graph（`{CALLS_QUERY}`）は CALLS の組を {trace['rows_returned']} 件返しました。"
        + ("上限の100件に達しているため、ほかの行が省かれている可能性があります。" if trace["may_be_truncated"] else ""),
        "そのうち submit_order から出る組と、実ソースの呼び出し式：",
        "",
    ]
    for edge in trace["required_edges"]:
        lines.append(
            f"- {edge['caller']} → {edge['callee']}：[{edge['source']['file']}](../{edge['source']['file']}) "
            f"{edge['source']['line']} 行目 `{edge['source']['text']}`"
        )
    lines += [
        "",
        f"trace_path（outbound、深さ {TRACE_DEPTH}）の応答に出た関数名：{'、'.join(trace['trace_reached'])}",
        "",
        "これは索引に記録された静的な呼び出し関係です。実行時に記録したトレースではありません。",
        "",
        "## 3. 変える：storage.py を差し替えて手で索引し直す",
        "",
        f"実行用コピーの storage.py だけを [{update['revision_file']}](../{update['revision_file']}) に差し替えました"
        f"（追加 {len(update['added_lines'])} 行）。save_receipt の {update['call_expression']['line']} 行目 "
        f"`{update['call_expression']['text']}` が新しい呼び出しです。",
        "",
        "| 時点 | CALLS の組 | save_receipt → audit_receipt |",
        "| --- | ---: | --- |",
        f"| 初回の索引 | {runs['calls_before']['row_count']} | {yes_no(update['edge_in_before'])} |",
        f"| ファイル変更後・再索引の前 | {runs['calls_stale']['row_count']} | {yes_no(update['edge_in_stale'])} |",
        f"| 手で index_repository をやり直した後 | {runs['calls_after']['row_count']} | {yes_no(update['edge_in_after'])} |",
        "",
        f"再索引後の search_graph は audit_receipt を {update['audit_receipt']['file']} の {update['audit_receipt']['line']} 行目"
        f"（差し替え後の実ソースの def 行：{update['audit_receipt']['source_def_line']}）として返しました。",
        "CLI で作った索引は監視されないため、ファイルを変えただけでは索引は古いままです。変更後は index_repository を手でやり直します。",
        "",
        "## 架空の注文を実際に実行した結果（索引とは別の確認）",
        "",
        f"- 変更前：`{RECEIPT_FILE}` の total_jpy は {base['total_jpy']}（{base['seat_count']}席 × {base['seat_price_jpy']}円）",
        f"- 変更後：`{RECEIPT_FILE}` の total_jpy は {revised[RECEIPT_FILE]['total_jpy']}、"
        f"`{AUDIT_FILE}` の recomputed_total_jpy は {revised[AUDIT_FILE]['recomputed_total_jpy']}、consistent は "
        f"{str(revised[AUDIT_FILE]['consistent']).lower()}",
        "",
        "領収と監査のJSONは、workflow.py が指定した作業ディレクトリの中にだけ書かれました。決済・予約・通知はしていません。",
        "",
        "## 範囲と限界",
        "",
        "- MCP クライアントからの接続、CBM Lens、ブラウザAI、意味検索、大きなリポジトリは試していません。",
        "- 速さ・トークン量・回答品質は測っていません。原典の数値は作者の測定です。",
        "- 静的な索引には、動的な呼び出し（getattr、辞書に入れた関数など）が出ないことがあります。辺がないことは、呼ばれないことの証明ではありません。",
        "- 実行ファイル・モデル・索引キャッシュは配布していません。",
        "",
        "## ファイル",
        "",
        "- [runs.json](runs.json)：要求・応答・照合の全記録",
        "- [samples.json](../samples.json)：3つの操作の入力と出力",
        "- [workflow.py](../workflow.py)：この結果を作った実行用ソース",
        "- [fixture/service.py](../fixture/service.py)・[fixture/storage.py](../fixture/storage.py)・"
        "[fixture/storage_revised.py](../fixture/storage_revised.py)：照合したソース",
        "",
    ]
    return "\n".join(lines)


# ---------- 本体 ----------


def is_within(child, parent):
    return child == parent or parent in child.parents


def prepare(args):
    binary = Path(args.binary).expanduser().resolve()
    work = Path(args.work).expanduser().resolve()
    cache = Path(args.cache).expanduser().resolve()
    if not binary.is_file():
        raise RunFailure("--binary に実行ファイルが見つかりません。")
    if is_within(binary, HERE):
        raise RunFailure("実行ファイルは作例フォルダの外に置いてください（配布しないため）。")
    if is_within(work, HERE) or is_within(HERE, work):
        raise RunFailure("--work は作例フォルダの外の、新しい空のディレクトリにしてください。")
    if is_within(cache, HERE) or is_within(HERE, cache):
        raise RunFailure("--cache は作例フォルダの外の、専用のディレクトリにしてください。")
    if is_within(cache, work / "repo") or is_within(work, cache):
        raise RunFailure("--cache を実行用コピーの中に、--work をキャッシュの中に置かないでください。")
    if cache.exists() and not cache.is_dir():
        raise RunFailure("--cache がディレクトリではありません。")
    if work.exists():
        if not work.is_dir() or any(work.iterdir()):
            raise RunFailure("--work は新しい空のディレクトリにしてください。")
    elif not work.parent.is_dir():
        raise RunFailure("--work の親ディレクトリがありません。")
    missing = [name for name in (*BASE_FILES, REVISION_SOURCE) if not (FIXTURE_DIR / name).is_file()]
    if missing:
        raise RunFailure(f"fixture/ に {', '.join(missing)} がありません。")
    return binary, work, cache


def call_group(records):
    return (
        [{"tool": r["tool"], "phase": r["phase"], "args": r["args"]} for r in records],
        [{"tool": r["tool"], "phase": r["phase"], "response": r["response"]} for r in records],
    )


def calls_table(pairs, phase):
    return {
        "phase": phase,
        "query": CALLS_QUERY,
        "rows": [{"caller": a, "callee": b} for a, b in pairs],
        "row_count": len(pairs),
        "limit": QUERY_LIMIT,
    }


def run(args):
    binary, work, cache = prepare(args)
    fixture_before = {name: sha256(FIXTURE_DIR / name) for name in (*BASE_FILES, REVISION_SOURCE)}

    work.mkdir(exist_ok=True)
    repo, private, fixture_runs = work / "repo", work / "private", work / "fixture-runs"
    for folder in (repo, private / "logs", private / "args"):
        folder.mkdir(parents=True)
    for name in BASE_FILES:
        shutil.copyfile(FIXTURE_DIR / name, repo / name)
    if {name: sha256(repo / name) for name in BASE_FILES} != {name: fixture_before[name] for name in BASE_FILES}:
        raise RunFailure("実行用コピーが fixture/ と一致しません。")

    order = json.loads((repo / "sample_order.json").read_text(encoding="utf-8"))
    if (order.get("order_id"), order.get("seat_count"), order.get("seat_price_jpy")) != (ORDER_ID, SEAT_COUNT, SEAT_PRICE_JPY):
        raise RunFailure("sample_order.json が想定（WS-0001・2席・1,200円）と違います。")
    base_sources = {f"fixture/{name}": (repo / name).read_text(encoding="utf-8") for name in BASE_FILES}

    env = dict(os.environ)
    env.update(CHILD_ENV, CBM_CACHE_DIR=str(cache), CBM_ALLOWED_ROOT=str(repo))
    cli = Cli(binary, env, private, args.args_via, args.timeout, args.index_timeout)
    version = cli.version()

    # 架空の注文を、変更前のコピーで実際に実行する
    base_run = run_fixture(repo, fixture_runs / "base", private, "base")
    check_receipt(base_run, order, [RECEIPT_FILE], "変更前の実行")

    # 索引を作る
    index_args = {"repo_path": str(repo), "name": PROJECT_NAME, "mode": "full"}
    indexed = cli.call("index_repository", index_args, phase="初回の索引", index=True)
    listing = cli.call("list_projects", phase="初回の索引")
    project = discover_project(listing["response"], repo)
    schema = cli.call("get_graph_schema", {"project": project}, phase="初回の索引")
    status = cli.call("index_status", {"project": project}, phase="初回の索引")

    # 1. 探す
    service_text = (repo / "service.py").read_text(encoding="utf-8")
    search = cli.call(
        "search_graph", {"project": project, "name_pattern": f"^{ENTRY}$", "label": "Function"}, phase="探す"
    )
    entry = locate(search["response"], ENTRY, repo, "search_graph")
    source_def = def_line(service_text, ENTRY)
    if entry["rel"] != "service.py":
        raise RunFailure(f"search_graph が {ENTRY} の場所を {entry['rel']} と返しました（想定 service.py）。")
    if entry["line"] != source_def:
        raise RunFailure(f"search_graph の行 {entry['line']} が、実ソースの def 行 {source_def} と一致しません。")
    snippet = cli.call(
        "get_code_snippet", {"project": project, "qualified_name": entry["qualified_name"]}, phase="探す"
    )
    snippet_text = longest_text(snippet["response"], f"def {ENTRY}")
    if not snippet_text:
        raise RunFailure("get_code_snippet の応答に submit_order の本文が見つかりません。")
    call_exprs = {}
    for callee in CALLEES:
        if not call_lines(snippet_text, callee):
            raise RunFailure(f"get_code_snippet の本文に {callee}( の呼び出しがありません。")
        hits = call_lines(service_text, callee)
        if not hits:
            raise RunFailure(f"実ソース service.py に {callee}( の呼び出しがありません。")
        call_exprs[callee] = hits[0]
    source_line_set = {line.rstrip() for line in service_text.splitlines()}
    snippet_lines = [line.rstrip() for line in snippet_text.splitlines() if line.strip()]
    find_facts = {
        "function": ENTRY,
        "qualified_name": entry["qualified_name"],
        "file": f"fixture/{entry['rel']}",
        "line": entry["line"],
        "source_def_line": source_def,
        "line_matches_source": True,
        "snippet_text": snippet_text,
        "snippet_lines": len(snippet_lines),
        "snippet_lines_in_source": sum(1 for line in snippet_lines if line in source_line_set),
        "call_expressions": [dict(call_exprs[c], callee=c, file="fixture/service.py") for c in CALLEES],
    }

    # 2. たどる
    query_before = cli.call("query_graph", {"project": project, "query": CALLS_QUERY}, phase="たどる")
    pairs_before = extract_pairs(query_before["response"])
    if not pairs_before:
        raise RunFailure("query_graph の応答から caller・callee の行を読み取れませんでした。")
    missing = [c for c in CALLEES if not has_edge(pairs_before, ENTRY, c)]
    if missing:
        raise RunFailure(f"query_graph の行に {ENTRY} → {', '.join(missing)} がありません。")
    trace_args = {"project": project, "function_name": ENTRY, "direction": "outbound", "depth": TRACE_DEPTH}
    trace = cli.call("trace_path", trace_args, phase="たどる")
    trace_reached = reached(trace["response"], CALLEES)
    if len(trace_reached) != len(CALLEES):
        lacking = [c for c in CALLEES if c not in trace_reached]
        raise RunFailure(f"trace_path の応答に {', '.join(lacking)} が出ませんでした。")
    trace_facts = {
        "entry": ENTRY,
        "callees_in_rows": [b for a, b in pairs_before if same_name(a, ENTRY)],
        "required_edges": [
            {"caller": ENTRY, "callee": c, "source": dict(call_exprs[c], file="fixture/service.py")} for c in CALLEES
        ],
        "rows_returned": len(pairs_before),
        "limit": QUERY_LIMIT,
        "may_be_truncated": len(pairs_before) >= QUERY_LIMIT,
        "main_calls_submit_order": has_edge(pairs_before, "main", ENTRY),
        "trace_reached": trace_reached,
        "trace_edges": explicit_edges(trace["response"]),
    }

    # 3. 変える：コピーの storage.py だけを差し替える
    storage_base = (repo / REVISION_TARGET).read_text(encoding="utf-8")
    shutil.copyfile(FIXTURE_DIR / REVISION_SOURCE, repo / REVISION_TARGET)
    if sha256(repo / REVISION_TARGET) != fixture_before[REVISION_SOURCE]:
        raise RunFailure("差し替えた storage.py が storage_revised.py と一致しません。")
    storage_changed = (repo / REVISION_TARGET).read_text(encoding="utf-8")
    audit_def = def_line(storage_changed, NEW_EDGE[1])
    new_calls = call_lines(storage_changed, NEW_EDGE[1])
    if audit_def is None or not new_calls:
        raise RunFailure("差し替えた storage.py に audit_receipt の定義か呼び出しがありません。")

    status_stale = cli.call("index_status", {"project": project}, phase="再索引の前")
    query_stale = cli.call("query_graph", {"project": project, "query": CALLS_QUERY}, phase="再索引の前")
    pairs_stale = extract_pairs(query_stale["response"])
    if not pairs_stale:
        raise RunFailure("再索引前の query_graph の応答から行を読み取れませんでした。")
    if has_edge(pairs_stale, *NEW_EDGE):
        raise RunFailure("再索引の前なのに save_receipt → audit_receipt が出ました。自動の再索引が起きた可能性があります。")

    reindexed = cli.call("index_repository", index_args, phase="手で再索引", index=True)
    schema_after = cli.call("get_graph_schema", {"project": project}, phase="再索引の後")
    status_after = cli.call("index_status", {"project": project}, phase="再索引の後")
    query_after = cli.call("query_graph", {"project": project, "query": CALLS_QUERY}, phase="再索引の後")
    pairs_after = extract_pairs(query_after["response"])
    if not has_edge(pairs_after, *NEW_EDGE):
        raise RunFailure("再索引後の query_graph の行に save_receipt → audit_receipt がありません。")
    still_missing = [c for c in CALLEES if not has_edge(pairs_after, ENTRY, c)]
    if still_missing:
        raise RunFailure(f"再索引後の query_graph の行に {ENTRY} → {', '.join(still_missing)} がありません。")
    trace_after = cli.call("trace_path", trace_args, phase="再索引の後")
    reached_after = reached(trace_after["response"], (*CALLEES, NEW_EDGE[1]))
    if NEW_EDGE[1] not in reached_after:
        raise RunFailure("再索引後の trace_path の応答に audit_receipt が出ませんでした。")
    search_save = cli.call(
        "search_graph", {"project": project, "name_pattern": f"^{NEW_EDGE[0]}$", "label": "Function"}, phase="再索引の後"
    )
    save_loc = locate(search_save["response"], NEW_EDGE[0], repo, "search_graph")
    if save_loc["rel"] != REVISION_TARGET:
        raise RunFailure(f"search_graph が save_receipt の場所を {save_loc['rel']} と返しました。")
    snippet_save = cli.call(
        "get_code_snippet", {"project": project, "qualified_name": save_loc["qualified_name"]}, phase="再索引の後"
    )
    save_text = longest_text(snippet_save["response"], f"def {NEW_EDGE[0]}")
    if not save_text or not call_lines(save_text, NEW_EDGE[1]):
        raise RunFailure("再索引後の get_code_snippet の本文に audit_receipt( の呼び出しがありません。")
    search_audit = cli.call(
        "search_graph", {"project": project, "name_pattern": f"^{NEW_EDGE[1]}$", "label": "Function"}, phase="再索引の後"
    )
    audit_loc = locate(search_audit["response"], NEW_EDGE[1], repo, "search_graph")
    if audit_loc["rel"] != REVISION_TARGET or audit_loc["line"] != audit_def:
        raise RunFailure(
            f"search_graph の audit_receipt の場所 {audit_loc['rel']}:{audit_loc['line']} が、実ソースの def 行 {audit_def} と一致しません。"
        )

    # 架空の注文を、変更後のコピーで実際に実行する
    revised_run = run_fixture(repo, fixture_runs / "revised", private, "revised")
    check_receipt(revised_run, order, [RECEIPT_FILE, AUDIT_FILE], "変更後の実行")
    audit = revised_run["files"][AUDIT_FILE]
    expected_audit = {
        "order_id": ORDER_ID,
        "receipt_file": RECEIPT_FILE,
        "recomputed_total_jpy": TOTAL_JPY,
        "saved_total_jpy": TOTAL_JPY,
        "consistent": True,
    }
    if audit != expected_audit:
        raise RunFailure("変更後の実行で書かれた監査JSONが想定と一致しません。")

    if {name: sha256(FIXTURE_DIR / name) for name in fixture_before} != fixture_before:
        raise RunFailure("元の fixture/ のファイルが実行中に変わりました。")

    update_facts = {
        "revision_file": f"fixture/{REVISION_SOURCE}",
        "replaced_in_copy": f"fixture/{REVISION_TARGET}",
        "added_lines": added_lines(storage_base, storage_changed),
        "new_edge": {"caller": NEW_EDGE[0], "callee": NEW_EDGE[1]},
        "edge_in_before": has_edge(pairs_before, *NEW_EDGE),
        "edge_in_stale": has_edge(pairs_stale, *NEW_EDGE),
        "edge_in_after": has_edge(pairs_after, *NEW_EDGE),
        "manual_reindex": True,
        "call_expression": dict(new_calls[0], file=f"fixture/{REVISION_TARGET}"),
        "save_receipt": {"qualified_name": save_loc["qualified_name"], "file": f"fixture/{save_loc['rel']}", "line": save_loc["line"]},
        "save_receipt_snippet_text": save_text,
        "audit_receipt": {
            "qualified_name": audit_loc["qualified_name"],
            "file": f"fixture/{audit_loc['rel']}",
            "line": audit_loc["line"],
            "source_def_line": audit_def,
        },
        "trace_reached_after": reached_after,
        "watch_before_reindex": find_key(status_stale["response"], "watch"),
        "watch_after_reindex": find_key(status_after["response"], "watch"),
    }

    index_request, index_response = call_group([indexed, listing, schema, status])
    find_request, find_response = call_group([search, snippet])
    trace_request, trace_response = call_group([query_before, trace])
    update_request, update_response = call_group(
        [status_stale, query_stale, reindexed, schema_after, status_after, query_after, trace_after, search_save, snippet_save, search_audit]
    )
    runs = {
        "tool": {"name": TOOL, "version": version, "release": RELEASE, "commit": COMMIT, "transport": TRANSPORT},
        "scope_note": SCOPE_NOTE,
        "project": project,
        "cli": {
            "command": f"{TOOL} cli --quiet --json <tool> (format=json in tool arguments where supported)",
            "args_via": "--args-file" if args.args_via == "file" else "stdin",
            "env": dict(CHILD_ENV, CBM_CACHE_DIR="<private-cache>", CBM_ALLOWED_ROOT="fixture"),
        },
        "fixture": {
            "files": [f"fixture/{name}" for name in BASE_FILES],
            "revision": {"source": f"fixture/{REVISION_SOURCE}", "replaces": f"fixture/{REVISION_TARGET}", "applied_to": "実行用コピーだけ"},
        },
        "index": {
            "label": "索引を作る",
            "request": index_request,
            "response": index_response,
            "facts": {"requested_name": PROJECT_NAME, "project": project, "mode": "full", "watch": find_key(status["response"], "watch")},
        },
        "steps": [
            {"id": "find", "label": "探す：submit_order の定義と本文", "request": find_request, "response": find_response, "facts": find_facts},
            {"id": "trace", "label": "たどる：submit_order からの呼び出し", "request": trace_request, "response": trace_response, "facts": trace_facts},
            {"id": "update", "label": "変える：storage.py を差し替えて手で再索引", "request": update_request, "response": update_response, "facts": update_facts},
        ],
        "fixture_execution": {"base": base_run, "revised": revised_run},
        "calls_before": calls_table(pairs_before, "初回の索引"),
        "calls_stale": calls_table(pairs_stale, "ファイル変更後・再索引の前"),
        "calls_after": calls_table(pairs_after, "手で再索引した後"),
        "source_snapshots": {
            "base": base_sources,
            "changed": {f"fixture/{REVISION_TARGET}": storage_changed},
        },
    }

    normalize = Normalizer(repo, cache)
    runs = normalize(runs)
    samples = {
        "format": "input-output",
        "samples": [
            {"id": step["id"], "label": step["label"], "input": step["request"], "output": step["response"]}
            for step in runs["steps"]
        ],
    }
    result_md = render_result(runs)
    texts = {
        "outputs/runs.json": json.dumps(runs, ensure_ascii=False, indent=2) + "\n",
        "samples.json": json.dumps(samples, ensure_ascii=False, indent=2) + "\n",
        "outputs/result.md": result_md,
    }
    assert_public(texts, work, binary, cache)

    OUTPUT_DIR.mkdir(exist_ok=True)
    targets = {"outputs/runs.json": RUNS_PATH, "samples.json": SAMPLES_PATH, "outputs/result.md": RESULT_PATH}
    for name, path in targets.items():
        temp = path.with_name(path.name + ".tmp")
        temp.write_text(texts[name], encoding="utf-8", newline="\n")
    for name, path in targets.items():
        os.replace(path.with_name(path.name + ".tmp"), path)

    return {
        "tool_version": version,
        "project": project,
        "submit_order": f"{find_facts['file']}:{find_facts['line']}",
        "calls_from_submit_order": trace_facts["callees_in_rows"],
        "new_edge_before_reindex": update_facts["edge_in_stale"],
        "new_edge_after_reindex": update_facts["edge_in_after"],
        "receipt_total_jpy": {"base": base_run["files"][RECEIPT_FILE]["total_jpy"], "revised": revised_run["files"][RECEIPT_FILE]["total_jpy"]},
        "audit_consistent": audit["consistent"],
        "written": list(targets),
    }


def discover_project(listing, repo):
    """list_projects の応答から、この作例のプロジェクト名を探す。依頼した名前と違えば止まる。"""
    projects = listing.get("projects") if isinstance(listing, dict) else listing if isinstance(listing, list) else None
    if isinstance(projects, list) and len(projects) != 1:
        raise RunFailure(f"list_projects が {len(projects)} 件を返しました。この作例専用の新しいキャッシュで実行してください。")
    names = []
    for record in iter_dicts(listing):
        name = record.get("name")
        if not isinstance(name, str):
            continue
        roots = [v for k, v in record.items() if k in ("root_path", "repo_path", "path", "root", "rootPath") and isinstance(v, str)]
        matches_root = any(repo_relative(v.rstrip("/\\") + "/x", repo) == "x" for v in roots)
        if name == PROJECT_NAME or matches_root:
            if roots and not matches_root:
                raise RunFailure("list_projects の同名プロジェクトが、別の場所を指しています。新しいキャッシュで実行してください。")
            if name not in names:
                names.append(name)
    if names != [PROJECT_NAME]:
        raise RunFailure(
            "list_projects の応答に、依頼した名前 yebisu-workshop-proof のプロジェクトが1件だけ見つかりません"
            "（パス由来の名前は公開できないため止めます）。"
        )
    return names[0]


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="架空の注文リポジトリを Codebase Memory MCP v0.12.0 の公式 CLI で索引し、探す・たどる・変えて索引し直す。"
    )
    parser.add_argument("--binary", required=True, help="公式リリースの codebase-memory-mcp 実行ファイル（作例フォルダの外）")
    parser.add_argument("--work", required=True, help="新しい空の作業ディレクトリ（作例フォルダの外）。実行用コピーと全ログを置く")
    parser.add_argument("--cache", required=True, help="この作例専用のキャッシュ（CBM_CACHE_DIR）")
    parser.add_argument("--args-via", choices=("stdin", "file"), default="stdin", help="ツールの引数JSONの渡し方（既定: stdin）")
    parser.add_argument("--timeout", type=int, default=180, help="検索系ツール1回の上限秒数（既定: 180）")
    parser.add_argument("--index-timeout", type=int, default=900, help="index_repository 1回の上限秒数（既定: 900）")
    return parser.parse_args(argv)


def main(argv=None):
    if sys.version_info < (3, 10):
        print("Python 3.10 以上で実行してください。", file=sys.stderr)
        return 2
    args = parse_args(argv)
    try:
        summary = run(args)
    except RunFailure as error:
        print(f"失敗：{error}", file=sys.stderr)
        print("outputs/runs.json・outputs/result.md・samples.json は書いていません。", file=sys.stderr)
        return 1
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
