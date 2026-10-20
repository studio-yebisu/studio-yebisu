#!/usr/bin/env python3
"""One anonymous job on the original-README-linked Ming-Image-0.1-Design Space.

Standard library only. The script submits exactly one ``/generate`` job to the
public Space ``inclusionAI/ming-image-0-1-design-demo``, follows its SSE result
stream, downloads the returned PNG bytes unchanged and records what it
observed. It never retries a submission, never sends credentials or cookies,
never calls example/cache endpoints and never runs a model locally.

The Space runs its own ``MingImagePipeline`` (after vLLM-Omni PR #8021), not
``infer.py`` from the pinned GitHub reference. Its loaders use the model's
default branch without an explicit revision, so the model API SHA recorded here
is an observation of Hub metadata, not proof of which cached weights the server
actually loaded.

Usage:
    python run_example.py --request inputs/request.json \
        --output PATH --private PATH [--resume-event EVENT_ID]
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import socket
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SITE = Path(__file__).resolve().parent

SPACE_ID = "inclusionAI/ming-image-0-1-design-demo"
SPACE_COMMIT = "367085c6a006004b1658ad3b7edbd498581a33b3"
SPACE_HOST = "https://inclusionai-ming-image-0-1-design-demo.hf.space"
SPACE_NETLOC = "inclusionai-ming-image-0-1-design-demo.hf.space"
HUB_NETLOC = "huggingface.co"

MODEL_ID = "inclusionAI/Ming-Image-0.1-Design"
MODEL_API_SHA_OBSERVED_AT_PLANNING = "c57c49689d12ef7d4e24a170014f1dc43d3ce258"
REFERENCE = {
    "repository": "inclusionAI/Ming-Image",
    "commit": "3515cd7b1e3049fc517eed7d35020251cd06519a",
    "license": "MIT",
}

SPACE_META_URL = f"https://{HUB_NETLOC}/api/spaces/{SPACE_ID}"
MODEL_META_URL = f"https://{HUB_NETLOC}/api/models/{MODEL_ID}?blobs=true"
API_INFO_URL = f"{SPACE_HOST}/gradio_api/info"
SUBMIT_URL = f"{SPACE_HOST}/gradio_api/call/v2/generate"
STREAM_URL = SPACE_HOST + "/gradio_api/call/generate/{event_id}"

API_NAME = "/generate"
PARAMETER_NAMES = ["prompt", "resolution", "steps", "guidance_scale", "seed"]
PARAMETER_COMPONENTS = ["Textbox", "Dropdown", "Slider", "Slider", "Number"]
RETURN_COMPONENTS = ["Image", "Markdown"]
EXPECTED_SETTINGS = {
    "resolution": "1024 x 1024 (recommended)",
    "steps": 12,
    "guidance_scale": 1.0,
    "seed": 20261020,
}
EXPECTED_SIZE = (1024, 1024)
RESERVED_TOKENS = ("<image>", "<imagePatch>", "</image>", "<IMAGE>")

USER_AGENT = "studio-yebisu-ming-example/1 (anonymous; stdlib urllib)"
HTTP_TIMEOUT = 60
STREAM_READ_TIMEOUT = 180
DEFAULT_MAX_WAIT = 900
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PNG_COLOR_TYPES = {0: "grayscale", 2: "RGB", 3: "palette", 4: "grayscale+alpha", 6: "RGBA"}
BLOCKER_WORDS = (
    "quota", "login", "log in", "sign in", "sign-in", "signup", "sign up", "upgrade",
    "pro ", "credit", "token", "unauthorized", "forbidden", "payment", "billing",
)

EXIT_OK = 0
EXIT_PREFLIGHT = 2
EXIT_SUBMIT = 3
EXIT_TERMINAL_ERROR = 4
EXIT_TIMEOUT = 5
EXIT_RESULT = 6


class RunFailure(Exception):
    def __init__(self, stage: str, reason: str, exit_code: int, detail: object = None):
        super().__init__(f"{stage}: {reason}")
        self.stage = stage
        self.reason = reason
        self.exit_code = exit_code
        self.detail = detail


class HttpFailure(Exception):
    def __init__(self, url: str, status: int, headers: dict, body: bytes):
        super().__init__(f"HTTP {status} for {url}")
        self.url = url
        self.status = status
        self.headers = headers
        self.body = body


class RefusedRedirect(Exception):
    pass


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def write_json(path: Path, value: object) -> None:
    write_bytes(path, (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


# --- anonymous HTTPS -------------------------------------------------------


class PinnedRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Follow redirects only to https URLs on an explicit netloc allow-list."""

    def __init__(self, netlocs: frozenset):
        super().__init__()
        self.netlocs = netlocs

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urllib.parse.urlsplit(urllib.parse.urljoin(req.full_url, newurl))
        if target.scheme != "https" or target.netloc not in self.netlocs:
            raise RefusedRedirect(f"refused redirect {code} to {target.scheme}://{target.netloc}")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def anonymous_opener(netlocs: frozenset) -> urllib.request.OpenerDirector:
    # build_opener adds no cookie, auth or netrc handlers; we add none either.
    opener = urllib.request.build_opener(PinnedRedirectHandler(netlocs))
    opener.addheaders = [("User-Agent", USER_AGENT)]
    return opener


def check_url(url: str, netloc: str) -> None:
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or parts.netloc != netloc or parts.username or parts.password:
        raise RunFailure("route", f"URL outside approved host {netloc}", EXIT_RESULT, {"scheme": parts.scheme, "netloc": parts.netloc})


def http_request(opener, url: str, netloc: str, *, data: bytes | None = None,
                 headers: dict | None = None, timeout: float = HTTP_TIMEOUT):
    """Return (status, headers, body, final_url); raise HttpFailure with the body preserved."""
    check_url(url, netloc)
    request = urllib.request.Request(url, data=data, headers=headers or {}, method="POST" if data is not None else "GET")
    try:
        with opener.open(request, timeout=timeout) as response:
            body = response.read()
            final_url = response.geturl()
            status = response.status
            response_headers = dict(response.headers.items())
    except urllib.error.HTTPError as error:
        body = error.read() if error.fp is not None else b""
        raise HttpFailure(url, error.code, dict(error.headers.items()) if error.headers else {}, body) from None
    check_url(final_url, netloc)
    return status, response_headers, body, final_url


# --- inputs ----------------------------------------------------------------


def ensure_empty_dir(path: Path, label: str) -> Path:
    path = path.resolve()
    if path.exists():
        if not path.is_dir():
            raise SystemExit(f"--{label} exists and is not a directory: refusing")
        if any(path.iterdir()):
            raise SystemExit(f"--{label} directory is not empty: refusing to reuse an attempt directory")
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_request(path: Path):
    try:
        raw = path.read_bytes()
        request = json.loads(raw.decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RunFailure("request", f"cannot read request: {error}", EXIT_PREFLIGHT) from None
    if not isinstance(request, dict) or not isinstance(request.get("prompt_file"), str):
        raise RunFailure("request", "request must be an object with prompt_file", EXIT_PREFLIGHT)
    problems = []
    if request.get("id") != "reading-club":
        problems.append("id must be reading-club")
    if request.get("synthetic") is not True:
        problems.append("synthetic must be true")
    if request.get("jobs") != 1:
        problems.append("jobs must be 1")
    settings = request.get("settings") or {}
    for key, expected in EXPECTED_SETTINGS.items():
        value = settings.get(key)
        if value != expected or type(value) is not type(expected):
            problems.append(f"settings.{key} must be {expected!r}")
    if set(settings) != set(EXPECTED_SETTINGS):
        problems.append("settings must contain exactly resolution, steps, guidance_scale, seed")
    route = request.get("route") or {}
    if (route.get("space"), route.get("space_commit"), route.get("host"), route.get("api_name")) != (
        SPACE_ID, SPACE_COMMIT, SPACE_HOST, API_NAME
    ):
        problems.append("route does not match the approved Space, commit, host and endpoint")
    if request.get("reference") != REFERENCE:
        problems.append("reference must be the pinned original repository commit")
    literals = request.get("literal_strings")
    if not isinstance(literals, list) or not literals or not all(isinstance(s, str) and s for s in literals):
        problems.append("literal_strings must be a non-empty list of strings")
    for forbidden in ("result", "results", "execution", "image_sha256"):
        if forbidden in request:
            problems.append(f"request must not prepopulate {forbidden!r}")
    if problems:
        raise RunFailure("request", "; ".join(problems), EXIT_PREFLIGHT)
    return raw, request


def load_prompt(request: dict):
    prompt_path = (SITE / request["prompt_file"]).resolve()
    if SITE not in prompt_path.parents:
        raise RunFailure("request", "prompt_file must stay inside the site directory", EXIT_PREFLIGHT)
    try:
        raw = prompt_path.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf"):
            raise RunFailure("prompt", "prompt file has a UTF-8 BOM", EXIT_PREFLIGHT)
        prompt = raw.decode("utf-8").strip()
    except (OSError, UnicodeDecodeError) as error:
        raise RunFailure("prompt", f"cannot read prompt as UTF-8: {error}", EXIT_PREFLIGHT) from None
    problems = []
    if not prompt:
        problems.append("prompt is empty")
    for token in RESERVED_TOKENS:
        if token in prompt:
            problems.append(f"prompt contains reserved token {token}")
    for literal in request["literal_strings"]:
        count = prompt.count(literal)
        if count != 1:
            problems.append(f"literal {literal!r} appears {count} times in prompt, expected 1")
    if problems:
        raise RunFailure("prompt", "; ".join(problems), EXIT_PREFLIGHT)
    return prompt


# --- metadata --------------------------------------------------------------


def fetch_metadata(hub, space, private: Path, tag: str, record: dict) -> dict:
    observed = {"at": utc_now()}
    for key, opener, url, netloc in (
        ("space", hub, SPACE_META_URL, HUB_NETLOC),
        ("model", hub, MODEL_META_URL, HUB_NETLOC),
        ("api_info", space, API_INFO_URL, SPACE_NETLOC),
    ):
        try:
            status, _, body, _ = http_request(opener, url, netloc)
        except HttpFailure as failure:
            write_bytes(private / "metadata" / f"{tag}-{key}.http-error.bin", failure.body)
            record.setdefault("metadata_errors", []).append({"tag": tag, "key": key, "status": failure.status})
            observed[key] = None
            continue
        except (urllib.error.URLError, socket.timeout, OSError, RefusedRedirect) as error:
            record.setdefault("metadata_errors", []).append({"tag": tag, "key": key, "error": repr(error)})
            observed[key] = None
            continue
        write_bytes(private / "metadata" / f"{tag}-{key}.json", body)
        try:
            observed[key] = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            record.setdefault("metadata_errors", []).append({"tag": tag, "key": key, "error": repr(error)})
            observed[key] = None
    return observed


def summarize_metadata(observed: dict) -> dict:
    space = observed.get("space") or {}
    model = observed.get("model") or {}
    runtime = space.get("runtime") or {}
    siblings = model.get("siblings") or []
    lfs_bytes = sum((s.get("lfs") or {}).get("size", 0) for s in siblings if isinstance(s, dict))
    return {
        "fetched_at": observed.get("at"),
        "space": {
            "id": space.get("id"),
            "sha": space.get("sha"),
            "runtime_sha": runtime.get("sha"),
            "runtime_stage": runtime.get("stage"),
            "hardware_label": (runtime.get("hardware") or {}).get("current"),
            "sdk_version": (space.get("cardData") or {}).get("sdk_version"),
            "host": space.get("host"),
        },
        "model_hub_metadata": {
            "id": model.get("id"),
            "sha": model.get("sha"),
            "private": model.get("private"),
            "gated": model.get("gated"),
            "license": (model.get("cardData") or {}).get("license"),
            "lfs_files_bytes": lfs_bytes or None,
            "note": "Hub metadata only; the Space loader pins no revision, so this is not the server's loaded weight SHA.",
        },
        "api_info_fetched": observed.get("api_info") is not None,
    }


def verify_preflight(observed: dict) -> None:
    space = observed.get("space")
    model = observed.get("model")
    info = observed.get("api_info")
    if space is None or model is None or info is None:
        raise RunFailure("preflight", "could not fetch Space metadata, model metadata and API info", EXIT_PREFLIGHT)
    runtime = space.get("runtime") or {}
    problems = []
    if space.get("id") != SPACE_ID or space.get("private") is not False or space.get("disabled"):
        problems.append("Space identity/visibility changed")
    if space.get("sha") != SPACE_COMMIT:
        problems.append(f"Space repo sha {space.get('sha')} != {SPACE_COMMIT}")
    if runtime.get("sha") != SPACE_COMMIT:
        problems.append(f"Space runtime sha {runtime.get('sha')} != {SPACE_COMMIT}")
    if runtime.get("stage") != "RUNNING":
        problems.append(f"Space runtime stage is {runtime.get('stage')}, not RUNNING")
    if space.get("host") != SPACE_HOST:
        problems.append("Space host changed")
    if model.get("id") != MODEL_ID or model.get("private") is not False or model.get("gated") not in (False, None):
        problems.append("model is no longer the public ungated MODEL_ID")
    endpoint = (info.get("named_endpoints") or {}).get(API_NAME)
    if not isinstance(endpoint, dict):
        problems.append(f"API endpoint {API_NAME} missing")
    else:
        params = endpoint.get("parameters") or []
        if [p.get("parameter_name") for p in params] != PARAMETER_NAMES:
            problems.append("API parameter names changed")
        if [p.get("component") for p in params] != PARAMETER_COMPONENTS:
            problems.append("API parameter components changed")
        elif EXPECTED_SETTINGS["resolution"] not in ((params[1].get("type") or {}).get("enum") or []):
            problems.append("requested resolution is no longer offered")
        if [r.get("component") for r in endpoint.get("returns") or []] != RETURN_COMPONENTS:
            problems.append("API return components changed")
    if problems:
        raise RunFailure("preflight", "; ".join(problems), EXIT_PREFLIGHT)


# --- job -------------------------------------------------------------------


def classify_error_text(text: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in BLOCKER_WORDS):
        return "blocker_quota_or_auth"
    return "server_error"


def submit_once(space, private: Path, prompt: str, record: dict) -> str:
    body = {
        "prompt": prompt,
        "resolution": EXPECTED_SETTINGS["resolution"],
        "steps": EXPECTED_SETTINGS["steps"],
        "guidance_scale": EXPECTED_SETTINGS["guidance_scale"],
        "seed": EXPECTED_SETTINGS["seed"],
    }
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    write_bytes(private / "post-body.json", payload)
    record["submission"] = {"url": SUBMIT_URL, "body_sha256": sha256(payload), "started_at": utc_now()}
    try:
        status, headers, response, _ = http_request(
            space, SUBMIT_URL, SPACE_NETLOC, data=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
    except HttpFailure as failure:
        write_bytes(private / "post-response.bin", failure.body)
        record["submission"].update(status=failure.status, headers=failure.headers)
        text = failure.body.decode("utf-8", "replace")
        kind = "blocker_quota_or_auth" if failure.status in (401, 402, 403, 429) else classify_error_text(text)
        raise RunFailure("submit", f"HTTP {failure.status} ({kind}); not retried", EXIT_SUBMIT) from None
    except (urllib.error.URLError, socket.timeout, OSError, RefusedRedirect) as error:
        record["submission"]["error"] = repr(error)
        raise RunFailure("submit", "network or redirect failure; submission outcome unknown; not retried", EXIT_SUBMIT) from None
    write_bytes(private / "post-response.bin", response)
    record["submission"].update(status=status, headers=headers, finished_at=utc_now())
    try:
        event_id = json.loads(response.decode("utf-8"))["event_id"]
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError):
        raise RunFailure("submit", "response has no event_id; not retried", EXIT_SUBMIT) from None
    if not isinstance(event_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", event_id):
        raise RunFailure("submit", "event_id has an unexpected form; not retried", EXIT_SUBMIT)
    return event_id


def stream_result(space, private: Path, event_id: str, deadline: float, record: dict):
    """Follow the SSE stream until one terminal event. Return (event, data_text)."""
    url = STREAM_URL.format(event_id=event_id)
    check_url(url, SPACE_NETLOC)
    request = urllib.request.Request(url, headers={"Accept": "text/event-stream"}, method="GET")
    counts: dict = {}
    record["stream"] = {"started_at": utc_now(), "event_counts": counts}
    log_path = private / "sse-stream.log"
    try:
        response = space.open(request, timeout=STREAM_READ_TIMEOUT)
    except urllib.error.HTTPError as error:
        body = error.read() if error.fp is not None else b""
        write_bytes(private / "sse-http-error.bin", body)
        record["stream"]["status"] = error.code
        raise RunFailure("stream", f"HTTP {error.code} opening result stream; event id preserved", EXIT_TERMINAL_ERROR) from None
    except (urllib.error.URLError, socket.timeout, OSError, RefusedRedirect) as error:
        record["stream"]["error"] = repr(error)
        raise RunFailure("stream", "could not open result stream; event id preserved for --resume-event", EXIT_TIMEOUT) from None
    check_url(response.geturl(), SPACE_NETLOC)
    record["stream"]["status"] = response.status
    event, data_lines = None, []
    with response, log_path.open("ab") as log:
        while True:
            if time.monotonic() > deadline:
                raise RunFailure("stream", "total wait exceeded; event id preserved for --resume-event", EXIT_TIMEOUT)
            try:
                line = response.readline()
            except (socket.timeout, TimeoutError, OSError) as error:
                record["stream"]["error"] = repr(error)
                raise RunFailure("stream", "stream read timed out; event id preserved for --resume-event", EXIT_TIMEOUT) from None
            if line:
                log.write(line)
                log.flush()
            try:
                text = line.decode("utf-8").rstrip("\r\n") if line else ""
            except UnicodeDecodeError:
                raise RunFailure("stream", "stream line is not UTF-8; raw stream kept privately", EXIT_RESULT) from None
            if line and text:
                if text.startswith("event:"):
                    event = text[6:].strip()
                elif text.startswith("data:"):
                    data_lines.append(text[5:].lstrip(" "))
                continue
            if event is not None or data_lines:
                name = event or "message"
                counts[name] = counts.get(name, 0) + 1
                if name in ("complete", "error"):
                    record["stream"]["terminal_event"] = name
                    record["stream"]["finished_at"] = utc_now()
                    return name, "\n".join(data_lines)
                event, data_lines = None, []
            if not line:
                raise RunFailure("stream", "stream closed without a terminal event; event id preserved", EXIT_TERMINAL_ERROR)


def png_header(data: bytes):
    if len(data) < 33 or data[:8] != PNG_SIGNATURE:
        return None
    length, chunk = struct.unpack(">I4s", data[8:16])
    if chunk != b"IHDR" or length != 13:
        return None
    width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", data[16:29])
    return {
        "width": width,
        "height": height,
        "bit_depth": depth,
        "color_type": color,
        "color_type_name": PNG_COLOR_TYPES.get(color, "unknown"),
        "interlace": interlace,
    }


def handle_complete(space, output: Path, private: Path, data_text: str, record: dict) -> dict:
    data_bytes = data_text.encode("utf-8")
    write_bytes(private / "complete-response.json", data_bytes)
    try:
        payload = json.loads(data_text)
    except json.JSONDecodeError:
        raise RunFailure("result", "complete event data is not JSON", EXIT_RESULT) from None
    if not (isinstance(payload, list) and len(payload) == 2 and isinstance(payload[0], dict) and isinstance(payload[1], str)):
        raise RunFailure("result", "complete event is not [FileData, Markdown]; not guessing", EXIT_RESULT)
    filedata, info = payload
    url, path = filedata.get("url"), filedata.get("path")
    if isinstance(url, str) and url:
        download_url = url
    elif isinstance(path, str) and path:
        download_url = f"{SPACE_HOST}/gradio_api/file={urllib.parse.quote(path, safe='/')}"
    else:
        raise RunFailure("result", "FileData has neither url nor path", EXIT_RESULT)
    check_url(download_url, SPACE_NETLOC)
    started = time.monotonic()
    try:
        status, headers, image, _ = http_request(space, download_url, SPACE_NETLOC, timeout=120)
    except HttpFailure as failure:
        write_bytes(private / "download-http-error.bin", failure.body)
        record["download"] = {"status": failure.status, "headers": failure.headers}
        raise RunFailure("download", f"HTTP {failure.status} downloading returned image", EXIT_RESULT) from None
    except (urllib.error.URLError, socket.timeout, OSError, RefusedRedirect) as error:
        record["download"] = {"error": repr(error)}
        raise RunFailure("download", "network failure downloading returned image", EXIT_RESULT) from None
    elapsed = time.monotonic() - started
    record["download"] = {"status": status, "headers": headers, "bytes": len(image)}
    header = png_header(image)
    if header is None:
        write_bytes(private / "downloaded-image.bin", image)
        raise RunFailure("download", "returned bytes are not a PNG; kept privately, no output image written", EXIT_RESULT)
    write_bytes(output / "reading-club.png", image)
    write_bytes(output / "server-info.txt", info.encode("utf-8"))
    return {
        "file": "reading-club.png",
        "bytes": len(image),
        "sha256": sha256(image),
        "filedata_size": filedata.get("size"),
        "filedata_mime_type": filedata.get("mime_type"),
        "png_header": header,
        "matches_requested_size": (header["width"], header["height"]) == EXPECTED_SIZE,
        "header_note": "IHDR fields only. A color type with alpha shows the container has an alpha channel; pixel alpha, background transparency and typography were not decoded or judged.",
        "download_seconds": round(elapsed, 3),
        "server_info_file": "server-info.txt",
        "server_info": info,
    }


# --- main ------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--request", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--private", required=True, type=Path)
    parser.add_argument("--resume-event", help="resume the result stream of an already-submitted event; never submits")
    parser.add_argument("--max-wait", type=int, default=DEFAULT_MAX_WAIT, help="total seconds to wait for a terminal event")
    args = parser.parse_args()

    if args.resume_event is not None and not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", args.resume_event):
        raise SystemExit("--resume-event has an unexpected form")
    if not 60 <= args.max_wait <= 3600:
        raise SystemExit("--max-wait must be between 60 and 3600 seconds")
    out_path, private_path = args.output.resolve(), args.private.resolve()
    if out_path == private_path or out_path in private_path.parents or private_path in out_path.parents:
        raise SystemExit("--output and --private must be separate, non-nested directories")
    output = ensure_empty_dir(args.output, "output")
    private = ensure_empty_dir(args.private, "private")

    t0 = time.monotonic()
    record: dict = {"started_at": utc_now(), "mode": "resume" if args.resume_event else "submit"}
    summary: dict = {
        "label": "Operator-runner measurement packaging. Not native model output; only server-info.txt and reading-club.png are returned by the Space.",
        "status": "failed",
        "reference_original": REFERENCE,
        "route": {
            "space": SPACE_ID,
            "space_commit_expected": SPACE_COMMIT,
            "host": SPACE_HOST,
            "api_name": API_NAME,
            "access": "anonymous; no Authorization, cookies, HF token or account",
            "implementation": "Space's own MingImagePipeline following vLLM-Omni PR #8021, not the pinned GitHub infer.py",
        },
        "unverified": [
            "server-loaded weight revision (Space loaders pin no revision)",
            "literal Japanese text correctness",
            "pixel alpha / background transparency",
            "human visual approval",
            "behaviour on other inputs",
            "model speed (wall time includes queue and network)",
            "internal tensors, attention or per-stage timing",
        ],
    }
    exit_code = EXIT_OK
    submitted = False
    hub = anonymous_opener(frozenset({HUB_NETLOC}))
    space = anonymous_opener(frozenset({SPACE_NETLOC}))
    space_no_redirect = anonymous_opener(frozenset())

    try:
        request_raw, request = load_request(args.request)
        prompt = load_prompt(request)
        write_bytes(private / "request.json", request_raw)
        write_bytes(private / "submitted-prompt.txt", prompt.encode("utf-8"))
        summary["request"] = {
            "id": request["id"],
            "synthetic": request["synthetic"],
            "literal_strings": request["literal_strings"],
            "settings": request["settings"],
            "prompt": prompt,
            "prompt_bytes": len(prompt.encode("utf-8")),
            "prompt_sha256": sha256(prompt.encode("utf-8")),
        }

        before = fetch_metadata(hub, space, private, "before", record)
        summary["observed_before"] = summarize_metadata(before)
        model_sha = (before.get("model") or {}).get("sha")
        summary["observed_before"]["model_hub_metadata"]["matches_planning_observation"] = (
            model_sha == MODEL_API_SHA_OBSERVED_AT_PLANNING
        )
        verify_preflight(before)

        deadline = time.monotonic() + args.max_wait
        job_started = time.monotonic()
        if args.resume_event:
            event_id = args.resume_event
            record["submission"] = {"performed": False, "resumed_event": True}
        else:
            submitted = True
            event_id = submit_once(space_no_redirect, private, prompt, record)
        record["event_id"] = event_id
        write_json(private / "event.json", {"event_id": event_id, "stream_url": STREAM_URL.format(event_id=event_id)})
        write_json(private / "attempt.json", record)

        event, data_text = stream_result(space, private, event_id, deadline, record)
        summary["job_wall_seconds"] = round(time.monotonic() - job_started, 3)
        if event == "error":
            write_bytes(private / "error-event.txt", data_text.encode("utf-8"))
            raise RunFailure("stream", f"terminal error event ({classify_error_text(data_text)}); not retried", EXIT_TERMINAL_ERROR)
        summary["image"] = handle_complete(space, output, private, data_text, record)
        summary["status"] = "completed"
    except RunFailure as failure:
        exit_code = failure.exit_code
        summary["failure"] = {"stage": failure.stage, "reason": failure.reason}
        record["failure"] = {"stage": failure.stage, "reason": failure.reason, "detail": failure.detail}
    except KeyboardInterrupt:
        exit_code = EXIT_TIMEOUT
        summary["failure"] = {"stage": "interrupt", "reason": "interrupted by operator; event id (if any) preserved privately"}
        record["failure"] = summary["failure"]
    except Exception as error:  # keep a failed record instead of a bare traceback
        exit_code = EXIT_RESULT
        summary["failure"] = {"stage": "unexpected", "reason": type(error).__name__}
        record["failure"] = {"stage": "unexpected", "reason": repr(error)}

    if submitted or args.resume_event:
        after = fetch_metadata(hub, space, private, "after", record)
        summary["observed_after"] = summarize_metadata(after)
        before_sha = summary.get("observed_before", {}).get("space", {}).get("runtime_sha")
        summary["space_runtime_sha_stable"] = before_sha == summary["observed_after"]["space"]["runtime_sha"] == SPACE_COMMIT

    summary["total_wall_seconds"] = round(time.monotonic() - t0, 3)
    summary["timing_note"] = "Local wall-clock only; includes queue, ZeroGPU allocation and network. Not a model speed measurement."
    summary["finished_at"] = utc_now()
    record["finished_at"] = summary["finished_at"]
    record["exit_code"] = exit_code
    write_json(private / "attempt.json", record)
    write_json(output / "run-summary.json", summary)

    if exit_code == EXIT_OK:
        print(f"completed: {summary['image']['bytes']} bytes, sha256 {summary['image']['sha256']}")
    else:
        print(f"failed at {summary['failure']['stage']}: {summary['failure']['reason']}", file=sys.stderr)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
