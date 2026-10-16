#!/usr/bin/env python3
"""Crawl4AI 作例：手元で配る架空の手順書3ページだけを取得し、見出しと要点を保存する。

    python workflow.py --work <新しい空のフォルダ> [--channel chrome]

1. この作例の fixture/ を 127.0.0.1 の空きポートで配る（標準ライブラリの ThreadingHTTPServer）。
2. Crawl4AI の AsyncWebCrawler.arun を、許可した3ページと、診断用の存在しない1ページにだけ呼ぶ。
   リンクはたどらない。LLM・クラウド・APIキーは使わない。
3. 各 arun の結果を result.model_dump(mode="json") のまま <work>/raw/ に保存する（非公開の証跡）。
4. 結果を元のHTMLと照合し、すべて通ったときだけ <work>/publish/ に
   outputs/runs.json・outputs/result.md・samples.json を書く。どれか外れたら終了コード1で止まる。

Crawl4AI は unclecode/crawl4ai 固定コミット 6192d5e5b59cb21f9ca418fd6b798de47c0741d3（0.9.5）を想定。
This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import functools
import hashlib
import json
import os
import re
import sys
import threading
import traceback
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = HERE / "fixture"

CRAWL4AI_VERSION = "0.9.5"
CRAWL4AI_COMMIT = "6192d5e5b59cb21f9ca418fd6b798de47c0741d3"
CRAWL4AI_INSTALL = f"https://github.com/unclecode/crawl4ai/archive/{CRAWL4AI_COMMIT}.zip"

# 取り出す形。fixture の HTML に合わせて書いたもので、ほかのサイトにはそのまま使えない。
SCHEMA = {
    "name": "Guide sections",
    "baseSelector": "article.doc-section",
    "fields": [
        {"name": "heading", "selector": "h2", "type": "text"},
        {"name": "keypoint", "selector": "p.keypoint", "type": "text"},
    ],
}
CSS_SELECTOR = "main#guide"
EXCLUDED_TAGS = ["nav", "footer"]
WAIT_FOR = 'css:#guide[data-ready="true"]'
PAGE_TIMEOUT_MS = 20000
MARKDOWN_OPTIONS = {"ignore_links": True, "body_width": 0}

NOISE_SENTINELS = ["NAV_ONLY_SENTINEL", "FOOTER_ONLY_SENTINEL", "UNSELECTED_SENTINEL"]

# 期待値は fixture のソースそのもの。check_sources() がソースに書かれていることを先に確かめる。
DOCUMENTS = [
    {
        "id": "start",
        "label": "準備",
        "path": "/docs/start.html",
        "file": "docs/start.html",
        "title": "準備を始める｜木工ワークショップ運営メモ（架空）",
        "sections": [
            {"heading": "参加者名簿を作る", "keypoint": "名簿は開催の前日までに作り、氏名と卓番号の2列だけにします。", "origin": "html"},
            {"heading": "工具の数をそろえる", "keypoint": "のこぎりと小刀は卓ごとに同じ数を用意し、箱のふたに本数を書きます。", "origin": "html"},
        ],
    },
    {
        "id": "review",
        "label": "当日の確認",
        "path": "/docs/review.html",
        "file": "docs/review.html",
        "title": "当日の確認｜木工ワークショップ運営メモ（架空）",
        "sections": [
            {"heading": "刃物を確かめる", "keypoint": "刃こぼれのある工具は赤い箱に分け、その日は使いません。", "origin": "html"},
            {"heading": "質問を集める", "keypoint": "質問は付箋1枚に1つ書いてもらい、卓番号を左上に添えます。", "origin": "html"},
        ],
    },
    {
        "id": "export",
        "label": "書き出し",
        "path": "/docs/export.html",
        "file": "docs/export.html",
        "script": "docs/dynamic-export.js",
        "title": "記録の書き出し｜木工ワークショップ運営メモ（架空）",
        "sections": [
            {"heading": "記録をまとめる", "keypoint": "終了後30分以内に、付箋の写真と名簿をひとつのフォルダに入れます。", "origin": "html"},
            {"heading": "書き出す前に確かめる", "keypoint": "フォルダ名を日付と会場名にし、参加者の顔や連絡先が写った写真を除きます。", "origin": "script"},
        ],
    },
]
DIAGNOSTIC = {"id": "missing", "label": "取得エラー", "path": "/docs/missing.html", "expected_status": 404}

# サーバーへの到達を許すパス。これ以外が記録されたら確認は失敗する。
ALLOWED_PATHS = {
    "/robots.txt",
    "/style.css",
    "/docs/start.html",
    "/docs/review.html",
    "/docs/export.html",
    "/docs/dynamic-export.js",
    "/docs/missing.html",
    "/favicon.ico",  # ブラウザーが自動で求めることがある。fixture には置いていない。
}

SCOPE_NOTE = (
    "手元の 127.0.0.1 で配った作例用の架空の手順書3ページと、診断用の存在しない1ページだけを取得しました。"
    "公開Webの取得、リンクの巡回、取得の深さは試していません。LLM・クラウド・APIキーは使っていません。"
)
URL_NOTE = (
    "URL のポート番号は、実行のたびに OS が割り当てる一時ポートです。保存済みの実行結果に残っている値で、"
    "今そのアドレスにサーバーはありません。"
)


# ---------- 入力ファイル ----------


def fixture_text(rel: str) -> str:
    return (FIXTURE / rel).read_text(encoding="utf-8")


def fixture_file(rel: str) -> dict:
    data = (FIXTURE / rel).read_bytes()
    return {"path": f"fixture/{rel}", "sha256": hashlib.sha256(data).hexdigest(), "text": data.decode("utf-8")}


def check_sources() -> list[str]:
    """期待値が fixture のソースに書かれていること、JSで足す節が HTML に無いことを確かめる。"""
    problems = []
    for doc in DOCUMENTS:
        html = fixture_text(doc["file"])
        script = fixture_text(doc["script"]) if doc.get("script") else ""
        marker = "false" if script else "true"
        if f"<title>{doc['title']}</title>" not in html:
            problems.append(f"{doc['file']}: title not found")
        if f'<main id="guide" data-ready="{marker}">' not in html:
            problems.append(f'{doc["file"]}: <main id="guide" data-ready="{marker}"> not found')
        for sentinel in ("NAV_ONLY_SENTINEL", "FOOTER_ONLY_SENTINEL"):
            if sentinel not in html:
                problems.append(f"{doc['file']}: {sentinel} missing from source")
        if "UNSELECTED_SENTINEL" in html:
            problems.append(f"{doc['file']}: UNSELECTED_SENTINEL must not be in a selected page")
        for section in doc["sections"]:
            heading, keypoint = section["heading"], section["keypoint"]
            if section["origin"] == "html":
                if f"<h2>{heading}</h2>" not in html or f'<p class="keypoint">{keypoint}</p>' not in html:
                    problems.append(f"{doc['file']}: static section not found: {heading}")
            else:
                if heading in html or keypoint in html:
                    problems.append(f"{doc['file']}: script section text must not be in the HTML: {heading}")
                if f'"{heading}"' not in script or f'"{keypoint}"' not in script:
                    problems.append(f"{doc['script']}: script section text not found: {heading}")
    if "UNSELECTED_SENTINEL" not in fixture_text("not-selected.html"):
        problems.append("not-selected.html: UNSELECTED_SENTINEL missing")
    if "Allow: /docs/" not in fixture_text("robots.txt"):
        problems.append("robots.txt: Allow: /docs/ missing")
    return problems


# ---------- fixture を配るサーバー ----------


class FixtureHandler(SimpleHTTPRequestHandler):
    """fixture/ だけを配る。到達したリクエストは method・path・status だけを記録する。"""

    extensions_map = {
        "": "application/octet-stream",
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
    }

    def __init__(self, *args, access_log: list, lock: threading.Lock, **kwargs):
        self._access_log = access_log
        self._lock = lock
        super().__init__(*args, **kwargs)

    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND, "Not Found")
        return None

    def log_request(self, code="-", size="-"):
        status = int(code) if isinstance(code, int) else None
        with self._lock:
            self._access_log.append(
                {"method": getattr(self, "command", None), "path": getattr(self, "path", None), "status": status}
            )

    def log_message(self, format, *args):
        pass  # 標準エラーへは出さない。記録は log_request の一覧だけ。


def start_fixture_server(access_log: list, lock: threading.Lock):
    handler = functools.partial(FixtureHandler, directory=str(FIXTURE), access_log=access_log, lock=lock)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, name="fixture-server", daemon=True)
    thread.start()
    return server, thread


def stop_fixture_server(server, thread) -> None:
    server.shutdown()
    server.server_close()
    thread.join(timeout=10)


# ---------- Crawl4AI ----------


def doc_config_summary() -> dict:
    return {
        "cache_mode": "CacheMode.BYPASS",
        "check_robots_txt": True,
        "css_selector": CSS_SELECTOR,
        "excluded_tags": list(EXCLUDED_TAGS),
        "word_count_threshold": 0,
        "wait_for": WAIT_FOR,
        "page_timeout": PAGE_TIMEOUT_MS,
        "extraction_strategy": {"class": "JsonCssExtractionStrategy", "schema": copy.deepcopy(SCHEMA)},
        "markdown_generator": {"class": "DefaultMarkdownGenerator", "options": dict(MARKDOWN_OPTIONS)},
        "verbose": False,
    }


def diagnostic_config_summary() -> dict:
    return {
        "cache_mode": "CacheMode.BYPASS",
        "check_robots_txt": True,
        "excluded_tags": list(EXCLUDED_TAGS),
        "word_count_threshold": 0,
        "page_timeout": PAGE_TIMEOUT_MS,
        "markdown_generator": {"class": "DefaultMarkdownGenerator", "options": dict(MARKDOWN_OPTIONS)},
        "verbose": False,
        "note": "HTTPステータスをそのまま記録するため、wait_for・css_selector・extraction_strategy は付けない。",
    }


def browser_config_summary(channel: str) -> dict:
    return {
        "headless": True,
        "channel": channel,
        "chrome_channel": channel,
        "ignore_https_errors": False,
        "verbose": False,
        "use_persistent_context": False,
    }


def library_dump(config) -> object:
    """Crawl4AI 自身の dump()（既定値と違う引数だけを書く）を JSON にできる形で返す。"""
    try:
        return json.loads(json.dumps(config.dump(), ensure_ascii=False, default=str))
    except Exception as exc:  # dump できなくても取得自体は続ける。理由は記録する。
        return {"dump_error": type(exc).__name__}


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, default=str) + "\n", encoding="utf-8")


async def crawl(base_url: str, channel: str, cache_dir: Path, raw_dir: Path) -> dict:
    # CRAWL4_AI_BASE_DIRECTORY は main() で設定済み。ここで初めて Crawl4AI を読み込む。
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig, JsonCssExtractionStrategy
    from crawl4ai.__version__ import __version__ as crawl4ai_version
    from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

    browser_config = BrowserConfig(
        headless=True,
        channel=channel,
        chrome_channel=channel,
        ignore_https_errors=False,
        verbose=False,
        use_persistent_context=False,
    )

    def document_config():
        return CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            check_robots_txt=True,
            css_selector=CSS_SELECTOR,
            excluded_tags=list(EXCLUDED_TAGS),
            word_count_threshold=0,
            wait_for=WAIT_FOR,
            page_timeout=PAGE_TIMEOUT_MS,
            extraction_strategy=JsonCssExtractionStrategy(copy.deepcopy(SCHEMA)),
            markdown_generator=DefaultMarkdownGenerator(options=dict(MARKDOWN_OPTIONS)),
            verbose=False,
        )

    def diagnostic_config():
        return CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            check_robots_txt=True,
            excluded_tags=list(EXCLUDED_TAGS),
            word_count_threshold=0,
            page_timeout=PAGE_TIMEOUT_MS,
            markdown_generator=DefaultMarkdownGenerator(options=dict(MARKDOWN_OPTIONS)),
            verbose=False,
        )

    plan = [(doc["id"], "document", doc["path"], document_config, doc_config_summary) for doc in DOCUMENTS]
    plan.append((DIAGNOSTIC["id"], "diagnostic", DIAGNOSTIC["path"], diagnostic_config, diagnostic_config_summary))

    browser_dump = library_dump(browser_config)
    runs = []
    async with AsyncWebCrawler(config=browser_config, base_directory=str(cache_dir)) as crawler:
        for run_id, kind, path, make_config, summarize in plan:
            url = base_url + path
            config = make_config()
            request = {
                "id": run_id,
                "kind": kind,
                "url": url,
                "config": summarize(),
                "config_dump": library_dump(config),
                "browser_config_dump": browser_dump,
            }
            write_json(raw_dir / f"{run_id}.request.json", request)
            result = await crawler.arun(url=url, config=config)
            dumped = result.model_dump(mode="json")
            write_json(raw_dir / f"{run_id}.result.json", dumped)
            runs.append({"request": request, "result": dumped})

    return {
        "version": crawl4ai_version,
        "browser": {
            "channel": channel,
            "config": browser_config_summary(channel),
            "config_dump": browser_dump,
        },
        "runs": runs,
    }


# ---------- 照合 ----------


def response_of(dumped: dict) -> dict:
    markdown = dumped.get("markdown")
    return {
        "url": dumped.get("url"),
        "status_code": dumped.get("status_code"),
        "success": dumped.get("success"),
        "error_message": dumped.get("error_message"),
        "markdown": markdown.get("raw_markdown") if isinstance(markdown, dict) else None,
        "extracted_content": dumped.get("extracted_content"),
    }


def is_accepted(response: dict) -> bool:
    # ライブラリの success は「ページを受け取って処理できた」旗で、HTTP 200 とは別。両方を満たしたときだけ受理する。
    return response["success"] is True and response["status_code"] == 200


def parse_sections(extracted_content):
    if not isinstance(extracted_content, str):
        return None, "extracted_content is not a string"
    try:
        return json.loads(extracted_content), None
    except json.JSONDecodeError as exc:
        return None, f"JSONDecodeError: {exc.msg}"


def make_check(check_id: str, label: str, passed: bool, detail: str) -> dict:
    return {"id": check_id, "label": label, "passed": bool(passed), "detail": detail}


def private_prefixes(work: Path) -> list[tuple[str, str]]:
    pairs = [
        (str(work), "<WORK>"),
        (str(HERE), "<EXAMPLE>"),
        (sys.prefix, "<PYTHON>"),
        (sys.base_prefix, "<PYTHON>"),
        (str(Path.home()), "<HOME>"),
    ]
    out = []
    for raw, token in pairs:
        for variant in {raw, raw.replace("\\", "/")}:
            if variant and len(variant) > 3:
                out.append((variant, token))
    return sorted(out, key=lambda pair: len(pair[0]), reverse=True)


def normalize_paths(text, prefixes):
    """公開用の文字列から手元の絶対パスを <WORK> などの印に置き換える（README に記載）。"""
    if not isinstance(text, str):
        return text
    for raw, token in prefixes:
        text = re.sub(re.escape(raw), lambda _match, token=token: token, text, flags=re.IGNORECASE)
    return text


def find_private_strings(value, prefixes) -> list[str]:
    found = []
    if isinstance(value, str):
        low = value.lower()
        found.extend(raw for raw, _ in prefixes if raw.lower() in low)
    elif isinstance(value, dict):
        for item in value.values():
            found.extend(find_private_strings(item, prefixes))
    elif isinstance(value, list):
        for item in value:
            found.extend(find_private_strings(item, prefixes))
    return found


def evaluate(crawl_out: dict, access_log: list, source_problems: list, prefixes) -> tuple[list, dict, list]:
    by_id = {run["request"]["id"]: run for run in crawl_out["runs"]}
    documents = []
    checks = []

    version = crawl_out["version"]
    checks.append(make_check(
        "library_version", "Crawl4AI の版", version == CRAWL4AI_VERSION,
        f"インストール済みの crawl4ai.__version__ は {version}（想定 {CRAWL4AI_VERSION}）。",
    ))
    checks.append(make_check(
        "source_inputs", "元のHTMLとJavaScript", not source_problems,
        "期待する6節の見出し・要点がソースにあり、書き出しページの最後の節は export.html になく dynamic-export.js だけにあることを、取得前に確かめました。"
        if not source_problems else " / ".join(source_problems),
    ))

    for doc in DOCUMENTS:
        run = by_id[doc["id"]]
        response = response_of(run["result"])
        response["error_message"] = normalize_paths(response["error_message"], prefixes)
        sections, parse_error = parse_sections(response["extracted_content"])
        entry = {
            "id": doc["id"],
            "label": doc["label"],
            "title": doc["title"],
            "path": doc["path"],
            "input_html": fixture_file(doc["file"]),
            "request": {
                "url": run["request"]["url"],
                "config": run["request"]["config"],
                "config_dump": run["request"]["config_dump"],
            },
            "response": response,
            "sections": sections,
            "section_origins": [section["origin"] for section in doc["sections"]],
            "accepted": is_accepted(response),
        }
        if doc.get("script"):
            entry["input_script"] = fixture_file(doc["script"])
        if parse_error:
            entry["parse_error"] = parse_error
        documents.append(entry)

    accepted = [d for d in documents if d["accepted"]]
    checks.append(make_check(
        "documents_accepted", "3ページを HTTP 200 で受理", len(accepted) == len(DOCUMENTS),
        "、".join(
            f"{d['path']}：HTTP {d['response']['status_code']}・success={d['response']['success']}"
            for d in documents
        ),
    ))

    mismatches = []
    total = 0
    for doc, entry in zip(DOCUMENTS, documents):
        expected = [{"heading": s["heading"], "keypoint": s["keypoint"]} for s in doc["sections"]]
        got = entry["sections"]
        if isinstance(got, list):
            total += len(got)
        if got != expected:
            mismatches.append(doc["path"])
    checks.append(make_check(
        "sections_match_source", "取り出した節が元の見出し・要点と一致", not mismatches and total == 6,
        f"extracted_content から読んだ節は合計 {total}。"
        + ("3ページとも、元のHTML・JavaScriptに書かれた見出しと要点に、順番も含めて一致しました。" if not mismatches
           else f"一致しないページ：{', '.join(mismatches)}"),
    ))

    missing_in_md = []
    for doc, entry in zip(DOCUMENTS, documents):
        md = entry["response"]["markdown"] or ""
        for section in doc["sections"]:
            for text in (section["heading"], section["keypoint"]):
                if text not in md:
                    missing_in_md.append(f"{doc['path']}：{text}")
    checks.append(make_check(
        "markdown_has_sections", "Markdown に6節の見出しと要点がある", not missing_in_md,
        "raw_markdown に6節すべての見出しと要点の文がそのまま含まれています。" if not missing_in_md
        else "見つからない文：" + " / ".join(missing_in_md),
    ))

    noise = []
    for entry in documents:
        for field in ("markdown", "extracted_content"):
            text = entry["response"][field] or ""
            noise.extend(f"{entry['path']} の {field} に {s}" for s in NOISE_SENTINELS if s in text)
    checks.append(make_check(
        "no_noise_sentinels", "ナビ・フッター・選ばないページの目印が出力にない", not noise,
        "NAV_ONLY_SENTINEL・FOOTER_ONLY_SENTINEL・UNSELECTED_SENTINEL は、3ページの Markdown と extracted_content のどこにもありません。"
        if not noise else " / ".join(noise),
    ))

    export_doc = next(doc for doc in DOCUMENTS if doc.get("script"))
    export_entry = next(entry for entry in documents if entry["id"] == export_doc["id"])
    script_sections = [s for s in export_doc["sections"] if s["origin"] == "script"]
    got_export = export_entry["sections"] if isinstance(export_entry["sections"], list) else []
    script_found = all(
        {"heading": s["heading"], "keypoint": s["keypoint"]} in got_export for s in script_sections
    )
    checks.append(make_check(
        "script_section_extracted", "JavaScriptが追加した節を取り出せた", bool(script_sections) and script_found,
        f"export.html のソースにない「{script_sections[0]['heading']}」が、wait_for で待った後の取得結果に"
        + ("含まれています。" if script_found else "含まれていません。"),
    ))

    diag_run = by_id[DIAGNOSTIC["id"]]
    diag_response = response_of(diag_run["result"])
    diag_response["error_message"] = normalize_paths(diag_response["error_message"], prefixes)
    diagnostic = {
        "id": DIAGNOSTIC["id"],
        "label": DIAGNOSTIC["label"],
        "path": DIAGNOSTIC["path"],
        "expected_status": DIAGNOSTIC["expected_status"],
        "request": {
            "url": diag_run["request"]["url"],
            "config": diag_run["request"]["config"],
            "config_dump": diag_run["request"]["config_dump"],
        },
        "response": diag_response,
        "accepted": is_accepted(diag_response),
        "counted_as_document": False,
    }
    checks.append(make_check(
        "diagnostic_404_rejected", "存在しないページは 404 として別扱い",
        diag_response["status_code"] == DIAGNOSTIC["expected_status"] and not diagnostic["accepted"],
        f"{DIAGNOSTIC['path']}：HTTP {diag_response['status_code']}・ライブラリの success={diag_response['success']}・受理しない。成功件数に数えていません。",
    ))

    paths = [str(item.get("path") or "").split("?", 1)[0] for item in access_log]
    unexpected = sorted({p for p in paths if p not in ALLOWED_PATHS})
    not_selected = paths.count("/not-selected.html")
    robots = paths.count("/robots.txt")
    unrequested = [doc["path"] for doc in DOCUMENTS if doc["path"] not in paths]
    checks.append(make_check(
        "access_log_scope", "サーバーに届いたのは許したパスだけ",
        not unexpected and not_selected == 0 and robots >= 1 and not unrequested and DIAGNOSTIC["path"] in paths,
        f"記録 {len(access_log)} 件。robots.txt {robots} 回、選ばないページ {not_selected} 回"
        + (f"、想定外のパス：{', '.join(unexpected)}" if unexpected else "、想定外のパスなし")
        + (f"、届かなかったページ：{', '.join(unrequested)}" if unrequested else "")
        + "。外部ホスト（example.invalid）への通信はこのサーバーの記録には現れないため、ここでは確かめていません。",
    ))

    return documents, diagnostic, checks


# ---------- 公開用の出力 ----------


def build_runs(crawl_out, documents, diagnostic, access_log, checks) -> dict:
    return {
        "format": "studio-yebisu/crawl4ai-example-runs@1",
        "library": {
            "name": "Crawl4AI",
            "version": crawl_out["version"],
            "commit": CRAWL4AI_COMMIT,
            "commit_note": "インストール元に指定した固定コミットです。インストール済みのパッケージから読み取った値ではありません。",
            "install_source": CRAWL4AI_INSTALL,
            "license": "Apache-2.0",
            "attribution": "This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.",
        },
        "scope_note": SCOPE_NOTE,
        "url_note": URL_NOTE,
        "browser": crawl_out["browser"],
        "schema": copy.deepcopy(SCHEMA),
        "selectors": {
            "css_selector": CSS_SELECTOR,
            "excluded_tags": list(EXCLUDED_TAGS),
            "wait_for": WAIT_FOR,
            "baseSelector": SCHEMA["baseSelector"],
        },
        "requests": [
            {"id": run["request"]["id"], "kind": run["request"]["kind"], "url": run["request"]["url"]}
            for run in crawl_out["runs"]
        ],
        "documents": documents,
        "diagnostic": diagnostic,
        "access_log": [
            {"method": item.get("method"), "path": item.get("path"), "status": item.get("status")}
            for item in access_log
        ],
        "checks": checks,
    }


def build_samples(documents, diagnostic) -> dict:
    def sample(entry, label, source=None):
        return {
            "id": entry["id"],
            "label": label,
            "input": {
                "url": entry["request"]["url"],
                "path": entry["path"],
                "source_file": source,
                "config": entry["request"]["config"],
            },
            "output": {
                **entry["response"],
                "accepted": entry["accepted"],
                "sections": entry.get("sections"),
            },
        }

    samples = [sample(d, f"{d['label']}（{d['path']}）", d["input_html"]["path"]) for d in documents]
    samples.append(sample(diagnostic, f"取得エラー（{diagnostic['path']}・成功に数えない）"))
    return {"format": "input-output", "samples": samples}


def build_result_md(runs: dict) -> str:
    docs = runs["documents"]
    diag = runs["diagnostic"]
    accepted = sum(1 for d in docs if d["accepted"])
    total_sections = sum(len(d["sections"] or []) for d in docs)
    lines = [
        "# Crawl4AI 作例：架空の手順書3ページの取得結果",
        "",
        "workflow.py が実行結果（outputs/runs.json と同じデータ）から書き出したメモです。",
        "要点は元のHTMLの段落を CSS セレクターでそのまま取り出したもので、AIが作った要約ではありません。",
        "",
        f"- ライブラリ：Crawl4AI {runs['library']['version']}（インストール元 unclecode/crawl4ai {CRAWL4AI_COMMIT[:7]}・Apache-2.0）",
        f"- ブラウザー：channel={runs['browser']['channel']}・headless",
        f"- 範囲：{runs['scope_note']}",
        f"- URL：{runs['url_note']}",
        "",
        "## 流れ",
        "",
        "1. 操作：この作例の fixture/ を 127.0.0.1 の一時ポートで配る。",
        f"2. 依頼：AsyncWebCrawler.arun を {len(docs)} ページと診断用の1ページに呼ぶ（css_selector={CSS_SELECTOR}・"
        f"wait_for={WAIT_FOR}・JsonCssExtractionStrategy の baseSelector={SCHEMA['baseSelector']}）。",
        f"3. 結果：HTTP 200 で受理 {accepted}/{len(docs)} ページ、取り出した節 {total_sections}、"
        f"診断は HTTP {diag['response']['status_code']}（成功に数えない）。",
        "4. 保存：各結果の model_dump は raw/（非公開）、公開用は outputs/runs.json・samples.json・このメモ。",
        "",
        "## ページごとの結果",
    ]
    for d in docs:
        r = d["response"]
        lines += [
            "",
            f"### {d['title']}",
            "",
            f"- 元のファイル：`{d['input_html']['path']}`" + (f"・`{d['input_script']['path']}`" if d.get("input_script") else ""),
            f"- URL：`{r['url']}`",
            f"- HTTP {r['status_code']}・success={r['success']}・受理：{'はい' if d['accepted'] else 'いいえ'}",
            "- 取り出した節（extracted_content の中身）：",
        ]
        for i, section in enumerate(d["sections"] or []):
            origin = d["section_origins"][i] if i < len(d["section_origins"]) else ""
            where = "JavaScriptが追加" if origin == "script" else "元のHTML"
            lines.append(f"  {i + 1}. {section.get('heading', '')}：{section.get('keypoint', '')}（{where}）")
    r = diag["response"]
    lines += [
        "",
        "## 取得エラー（別扱い）",
        "",
        f"- URL：`{r['url']}`",
        f"- HTTP {r['status_code']}・ライブラリの success={r['success']}・受理：{'はい' if diag['accepted'] else 'いいえ'}",
        f"- error_message：{r['error_message'] or '（空）'}",
        "- success はライブラリがページを受け取って処理できたかを示す旗で、HTTP の成否とは別です。"
        "この作例では success と HTTP 200 の両方を満たしたときだけ受理しています。",
        "",
        "## 確認",
        "",
    ]
    for c in runs["checks"]:
        lines.append(f"- [{'x' if c['passed'] else ' '}] {c['label']}：{c['detail']}")
    lines += [
        "",
        "This project uses Crawl4AI (https://github.com/unclecode/crawl4ai) for web data extraction.",
        "",
    ]
    return "\n".join(lines)


# ---------- 実行 ----------


def prepare_work_dir(raw: str) -> Path:
    work = Path(raw).expanduser().resolve()
    if work == HERE or HERE in work.parents or work in HERE.parents:
        raise ValueError("--work はこの作例のフォルダの外にある、専用のフォルダにしてください。")
    if work.exists() and (not work.is_dir() or any(work.iterdir())):
        raise ValueError("--work には、まだ無いか空のフォルダを指定してください。")
    work.mkdir(parents=True, exist_ok=True)
    return work


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Crawl4AI で架空の手順書3ページだけを取得し、結果を保存する。", epilog='This product includes software developed by UncleCode (https://x.com/unclecode) as part of the Crawl4AI project (https://github.com/unclecode/crawl4ai).')
    parser.add_argument("--work", required=True, help="新しい空のフォルダ（この作例のフォルダの外）")
    parser.add_argument("--channel", default="chrome", help="BrowserConfig の channel / chrome_channel（既定 chrome）")
    args = parser.parse_args(argv)
    try:
        work = prepare_work_dir(args.work)
    except ValueError as exc:
        parser.error(str(exc))

    cache_dir = work / "cache"
    raw_dir = work / "raw"
    private_dir = work / "private"
    publish_dir = work / "publish"
    for folder in (cache_dir, raw_dir, private_dir):
        folder.mkdir(parents=True, exist_ok=True)

    problems = check_sources()
    if problems:
        write_json(private_dir / "source-problems.json", problems)
        print(f"FAILED: fixture source check ({len(problems)} problem(s)); see private/source-problems.json")
        return 1

    # Crawl4AI を読み込む前に、キャッシュ・robots.txt の記録・ログをこの実行専用のフォルダへ向ける。
    os.environ["CRAWL4_AI_BASE_DIRECTORY"] = str(cache_dir)
    os.environ["CRAWL4AI_NO_CLOUD_NOTICE"] = "1"

    access_log: list = []
    lock = threading.Lock()
    server, thread = start_fixture_server(access_log, lock)
    base_url = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        crawl_out = asyncio.run(crawl(base_url, args.channel, cache_dir, raw_dir))
    except Exception as exc:
        write_json(private_dir / "failure.json", {
            "stage": "crawl",
            "error_type": type(exc).__name__,
            "traceback": traceback.format_exc(),
        })
        print(f"FAILED: {type(exc).__name__} during crawl; see private/failure.json and raw/")
        return 1
    finally:
        stop_fixture_server(server, thread)
        with lock:
            access_log = list(access_log)
        write_json(raw_dir / "access-log.json", access_log)

    prefixes = private_prefixes(work)
    try:
        documents, diagnostic, checks = evaluate(crawl_out, access_log, problems, prefixes)
        runs = build_runs(crawl_out, documents, diagnostic, access_log, checks)
        samples = build_samples(documents, diagnostic)
        leaks = sorted(set(find_private_strings(runs, prefixes) + find_private_strings(samples, prefixes)))
        checks.append(make_check(
            "public_paths", "公開用の出力に手元のパスがない", not leaks,
            "公開用の JSON に、作業フォルダ・作例フォルダ・Python・ホームの絶対パスは含まれていません。"
            if not leaks else f"見つかったパスの種類：{len(leaks)}",
        ))
        result_md = build_result_md(runs)
    except Exception as exc:
        write_json(private_dir / "failure.json", {
            "stage": "evaluate",
            "error_type": type(exc).__name__,
            "traceback": traceback.format_exc(),
        })
        print(f"FAILED: {type(exc).__name__} while checking results; see private/failure.json and raw/")
        return 1

    write_json(private_dir / "checks.json", checks)
    failed = [c["id"] for c in checks if not c["passed"]]
    if failed:
        print(f"FAILED: {len(failed)} check(s): {', '.join(failed)}; nothing published. See private/checks.json and raw/")
        return 1

    write_json(publish_dir / "outputs" / "runs.json", runs)
    write_json(publish_dir / "samples.json", samples)
    (publish_dir / "outputs" / "result.md").write_text(result_md, encoding="utf-8")

    print(json.dumps({
        "crawl4ai": crawl_out["version"],
        "channel": args.channel,
        "documents_accepted": f"{sum(d['accepted'] for d in documents)}/{len(documents)}",
        "sections": sum(len(d["sections"] or []) for d in documents),
        "diagnostic": {
            "status_code": diagnostic["response"]["status_code"],
            "success": diagnostic["response"]["success"],
            "accepted": diagnostic["accepted"],
        },
        "checks": f"{len(checks) - len(failed)}/{len(checks)}",
        "published": "publish/outputs/runs.json, publish/outputs/result.md, publish/samples.json",
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
