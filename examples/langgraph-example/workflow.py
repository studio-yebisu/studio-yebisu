"""Studio Yebisu の LangGraph 作例：架空の機材貸出申請を StateGraph で実際に処理する。

流れ: 入力確認 (validate) → 条件付きエッジ → 見積 (estimate) → 確認待ち (review, interrupt)
      → Command(resume=テスト値) で同じ thread を再開 → 結果の要約 (finalize)
      必須項目が欠けた申請は needs_input ノードで終了し、interrupt しない。

- ノードはすべて決まった規則で動く Python 関数です。LLM・外部 API・ネットワークは使いません。
- 承認／差し戻しは inputs/requests.json の test_resume をスクリプトが渡すテスト値です。人の判断ではありません。
- チェックポイントは InMemorySaver（メモリ上）だけに置きます。プロセスを終えると消え、再起動後の再開はできません。

実行: python workflow.py   （出力: outputs/runs.json, outputs/result.md, samples.json）
"""

import copy
import json
import os
import re
import sys
from datetime import date
from importlib.metadata import version as installed_version
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, StrictBool, StrictStr
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

HERE = Path(__file__).resolve().parent
INPUT_PATH = HERE / "inputs" / "requests.json"
OUTPUT_DIR = HERE / "outputs"
RUNS_PATH = OUTPUT_DIR / "runs.json"
RESULT_PATH = OUTPUT_DIR / "result.md"
SAMPLES_PATH = HERE / "samples.json"

COMMIT = "d4149cc1f5384364d1a21092b4c2f582a6e7af8f"
PINNED = {
    "langgraph": "1.2.15",
    "langgraph-checkpoint": "4.3.0",
    "langgraph-prebuilt": "1.1.0",
    "langgraph-sdk": "0.4.7",
}
JOB_ORDER = ["approved", "missing", "rejected"]
FIELD_LABELS = {
    "applicant": "申請者",
    "event": "催し",
    "start_date": "貸出日",
    "end_date": "返却日",
    "items": "品目",
}
STATUS_LABELS = {
    "approved": "承認（テスト値）",
    "rejected": "差し戻し（テスト値）",
    "needs_input": "追加入力が必要",
}
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class RunFailure(Exception):
    """入力や実行結果が想定と違う。成功用の出力は書かない。"""


class RequestState(TypedDict, total=False):
    job_id: str
    request: dict[str, Any]
    status: str
    missing_fields: list[str]
    input_errors: list[str]
    line_items: list[dict[str, Any]]
    total_yen: int
    budget_flag: bool
    needs_review: bool
    review: dict[str, Any]
    summary: str


class ReviewDecision(BaseModel):
    """interrupt の再開値の型。LangGraph が Command(resume=...) の値をこの型で検証する。"""

    model_config = ConfigDict(extra="forbid")

    approved: StrictBool
    comment: StrictStr


def yen(value: int) -> str:
    return f"{value:,}円"


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (list, dict)):
        return len(value) == 0
    return False


def build_graph(rules: dict[str, Any]):
    catalog = {entry["sku"]: entry for entry in rules["catalog"]}
    required = list(rules["required_fields"])
    threshold = int(rules["budget_review_from_yen"])

    def validate(state: RequestState) -> dict[str, Any]:
        request = state["request"]
        missing = [field for field in required if is_blank(request.get(field))]
        errors: list[str] = []

        parsed: dict[str, date] = {}
        for field in ("start_date", "end_date"):
            raw = request.get(field)
            if field in missing:
                continue
            if not isinstance(raw, str) or not ISO_DATE.match(raw):
                errors.append(f"{field}: YYYY-MM-DD 形式の日付ではありません")
                continue
            try:
                parsed[field] = date.fromisoformat(raw)
            except ValueError:
                errors.append(f"{field}: 存在しない日付です")
        if len(parsed) == 2 and parsed["start_date"] > parsed["end_date"]:
            errors.append("end_date: 貸出日より前の日付です")

        if "items" not in missing:
            items = request.get("items")
            if not isinstance(items, list):
                errors.append("items: 品目の一覧ではありません")
            else:
                for index, item in enumerate(items):
                    sku = item.get("sku") if isinstance(item, dict) else None
                    quantity = item.get("quantity") if isinstance(item, dict) else None
                    if sku not in catalog:
                        errors.append(f"items[{index}].sku: 単価表にない品目です（{sku!r}）")
                    if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity <= 0:
                        errors.append(f"items[{index}].quantity: 1以上の整数ではありません（{quantity!r}）")

        return {
            "status": "needs_input" if missing or errors else "validated",
            "missing_fields": missing,
            "input_errors": errors,
        }

    def route_after_validate(state: RequestState) -> Literal["needs_input", "estimate"]:
        if state.get("missing_fields") or state.get("input_errors"):
            return "needs_input"
        return "estimate"

    def needs_input(state: RequestState) -> dict[str, Any]:
        parts = []
        if state.get("missing_fields"):
            names = "、".join(f"{FIELD_LABELS.get(f, f)}（{f}）" for f in state["missing_fields"])
            parts.append(f"{names}が空です。")
        if state.get("input_errors"):
            parts.append("入力の誤り：" + " / ".join(state["input_errors"]) + "。")
        parts.append("見積と確認待ちには進まず、追加入力を求めて終了しました。")
        return {"status": "needs_input", "summary": "".join(parts)}

    def estimate(state: RequestState) -> dict[str, Any]:
        # 一申請あたりの架空単価 × 数量の合計。日数は掛けない。
        lines = []
        for item in state["request"]["items"]:
            entry = catalog[item["sku"]]
            lines.append(
                {
                    "sku": item["sku"],
                    "name": entry["name"],
                    "quantity": item["quantity"],
                    "unit_yen": entry["unit_yen"],
                    "subtotal_yen": item["quantity"] * entry["unit_yen"],
                }
            )
        total = sum(line["subtotal_yen"] for line in lines)
        return {
            "status": "awaiting_review",
            "line_items": lines,
            "total_yen": total,
            "budget_flag": total >= threshold,
            "needs_review": True,
        }

    def review(state: RequestState) -> dict[str, Any]:
        # 再開時、このノードは先頭からやり直される。interrupt より前に記録・送信などの
        # 副作用を置かず、何度実行しても同じ payload になるようにしている。
        payload = {
            "question": "この見積で貸し出してよいか、approved（true/false）と comment で回答してください。",
            "job_id": state["job_id"],
            "request": state["request"],
            "line_items": state["line_items"],
            "total_yen": state["total_yen"],
            "budget_flag": state["budget_flag"],
            "budget_review_from_yen": threshold,
            "context": "架空の申請。この作例ではスクリプトがテスト値で再開します。",
        }
        decision = interrupt(payload, response_schema=ReviewDecision)
        return {
            "status": "approved" if decision.approved else "rejected",
            "review": {"approved": decision.approved, "comment": decision.comment},
        }

    def finalize(state: RequestState) -> dict[str, Any]:
        verdict = "承認" if state["status"] == "approved" else "差し戻し"
        flag = (
            f"予算確認の基準 {yen(threshold)} 以上"
            if state["budget_flag"]
            else f"予算確認の基準 {yen(threshold)} 未満"
        )
        summary = (
            f"見積合計 {yen(state['total_yen'])}（{flag}）。"
            "確認待ちで一時停止し、同じ thread に渡されたテスト回答"
            f"（approved={str(state['review']['approved']).lower()}）で再開して「{verdict}」で終了しました。"
            f"コメント：{state['review']['comment']}"
        )
        return {"summary": summary}

    builder = StateGraph(RequestState)
    builder.add_node("validate", validate)
    builder.add_node("needs_input", needs_input)
    builder.add_node("estimate", estimate)
    builder.add_node("review", review)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "validate")
    builder.add_conditional_edges(
        "validate",
        route_after_validate,
        {"needs_input": "needs_input", "estimate": "estimate"},
    )
    builder.add_edge("needs_input", END)
    builder.add_edge("estimate", "review")
    builder.add_edge("review", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile(checkpointer=InMemorySaver())


def jsonable(value: Any) -> Any:
    """state の値を JSON に通るか確かめつつ複製する。通らない型は隠さず失敗させる。"""
    return json.loads(json.dumps(value, ensure_ascii=False))


def interrupt_record(item: Any) -> dict[str, Any]:
    return {
        "id": item.id,
        "value": jsonable(item.value),
        "response_schema": jsonable(item.response_schema),
    }


def snapshot_record(snapshot: Any) -> dict[str, Any]:
    return {"values": jsonable(snapshot.values), "next": list(snapshot.next)}


def history_record(snapshot: Any) -> dict[str, Any]:
    metadata = snapshot.metadata or {}
    return {
        "step": metadata.get("step"),
        "source": metadata.get("source"),
        "values": jsonable(snapshot.values),
        "next": list(snapshot.next),
        "interrupt_ids": [item.id for item in snapshot.interrupts],
        "created_at": snapshot.created_at,
    }


def check(condition: bool, message: str) -> None:
    if not condition:
        raise RunFailure(message)


def load_input() -> dict[str, Any]:
    data = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    check(data.get("fictional") is True, "inputs/requests.json が架空入力として印付けされていません")
    check([job["id"] for job in data["jobs"]] == JOB_ORDER, f"jobs の順序が {JOB_ORDER} ではありません")
    check(
        data["rules"].get("all_complete_requests_pause_for_review") is True,
        "この作例のグラフは、完全な申請をすべて確認待ちにする規則を前提にしています",
    )
    return data


def framework_versions() -> dict[str, str]:
    found = {name: installed_version(name) for name in PINNED}
    check(found == PINNED, f"インストール済みの版が固定版と違います: {found}")
    return found


def run_job(graph: Any, job: dict[str, Any]) -> dict[str, Any]:
    thread_id = f"studio-yebisu-langgraph-example-{job['id']}"
    config = {"configurable": {"thread_id": thread_id}}
    expected = job["expected"]
    expected_interrupts = expected.get("interrupt_count", 1 if expected.get("needs_review") else 0)

    first = graph.invoke({"job_id": job["id"], "request": copy.deepcopy(job["request"])}, config=config)
    interrupts = list(first.get("__interrupt__", []))
    check(
        len(interrupts) == expected_interrupts,
        f"{job['id']}: interrupt は {expected_interrupts} 件の想定ですが {len(interrupts)} 件でした",
    )

    pause = None
    after_resume = None
    if interrupts:
        before = graph.get_state(config)
        check(list(before.next) == ["review"], f"{job['id']}: 停止位置が review ではありません: {before.next}")
        check(
            [item.id for item in before.interrupts] == [item.id for item in interrupts],
            f"{job['id']}: get_state の interrupt が invoke の戻り値と一致しません",
        )
        pause = {"interrupts": [interrupt_record(item) for item in interrupts], "state": snapshot_record(before)}

        check(job["test_resume"] is not None, f"{job['id']}: 再開用の test_resume がありません")
        resumed = graph.invoke(Command(resume=copy.deepcopy(job["test_resume"])), config=config)
        check("__interrupt__" not in resumed, f"{job['id']}: 再開後に再び interrupt しました")
        after = graph.get_state(config)
        after_resume = snapshot_record(after)
        check(jsonable(resumed) == after_resume["values"], f"{job['id']}: 再開の戻り値と get_state が一致しません")
    else:
        check(job["test_resume"] is None, f"{job['id']}: interrupt がないのに test_resume があります")

    end = graph.get_state(config)
    end_state = snapshot_record(end)
    final = end_state["values"]
    check(end_state["next"] == [], f"{job['id']}: グラフが終了していません: {end_state['next']}")
    check(not end.interrupts, f"{job['id']}: 未回答の interrupt が残っています")

    # 期待値との照合（実装と実行結果の確認であり、品質や人の承認の主張ではない）
    for key, value in expected.items():
        if key == "interrupt_count":
            continue
        check(final.get(key) == value, f"{job['id']}: {key} は {value!r} の想定ですが {final.get(key)!r} でした")
    check(final["request"] == job["request"], f"{job['id']}: state の申請内容が入力と一致しません")
    if job["test_resume"] is not None:
        check(final.get("review") == job["test_resume"], f"{job['id']}: 再開値が state にそのまま残っていません")
    else:
        for key in ("line_items", "total_yen", "review"):
            check(key not in final, f"{job['id']}: 不完全な申請なのに {key} が state にあります")

    history = [history_record(item) for item in graph.get_state_history(config)]
    history.reverse()  # 古い順
    check(len(history) > 0, f"{job['id']}: get_state_history が空です")
    check(history[-1]["values"] == final, f"{job['id']}: 最新のチェックポイントと最終 state が一致しません")

    return {
        "id": job["id"],
        "label": job["label"],
        "thread_id": thread_id,
        "input": job["request"],
        "test_resume": job["test_resume"],
        "pause": pause,
        "after_resume": after_resume,
        "final": final,
        "end_state": end_state,
        "checkpoints": history,
        "checks": {
            "expected_status": expected["status"],
            "interrupt_count": len(interrupts),
            "expected_values_match": True,
        },
    }


def md_request(request: dict[str, Any]) -> str:
    items = "、".join(f"{item.get('sku')}×{item.get('quantity')}" for item in request.get("items") or [])
    end_date = request.get("end_date") or "（空）"
    return (
        f"{request.get('applicant')}／{request.get('event')}／"
        f"{request.get('start_date') or '（空）'}〜{end_date}／{items or '（品目なし）'}"
    )


def route_from_checkpoints(checkpoints: list[dict[str, Any]]) -> list[str]:
    route: list[str] = []
    for point in checkpoints:
        for node in point["next"]:
            if node != "__start__" and (not route or route[-1] != node):
                route.append(node)
    return route


def build_result_md(runs: dict[str, Any]) -> str:
    rules = runs["rules"]
    packages = runs["framework"]["packages"]
    catalog_text = "、".join(
        "{}（{}）{}".format(entry["name"], entry["sku"], yen(entry["unit_yen"])) for entry in rules["catalog"]
    )
    lines = [
        "# LangGraph 作例：機材貸出申請の実行結果",
        "",
        "`python workflow.py` が LangGraph の StateGraph を実際に呼び出して保存した結果から、このファイルを自動で書き出しています。",
        "",
        f"- 使用した版：langgraph {packages['langgraph']}／checkpoint {packages['langgraph-checkpoint']}"
        f"／prebuilt {packages['langgraph-prebuilt']}／sdk {packages['langgraph-sdk']}"
        f"（langchain-ai/langgraph `{runs['framework']['commit'][:7]}`）",
        f"- 単価：{catalog_text}。{rules['price_basis']}",
        f"- 予算確認の目印：合計 {yen(rules['budget_review_from_yen'])} 以上で budget_flag = true",
        "- 完全な申請は金額にかかわらず review ノードの interrupt で一度止まります。",
        "",
    ]
    for job in runs["jobs"]:
        final = job["final"]
        route = " → ".join(route_from_checkpoints(job["checkpoints"]) + ["END"])
        lines += [f"## {job['label']}（`{job['id']}`）", "", f"- 入力：{md_request(job['input'])}"]
        if job["pause"]:
            payload = job["pause"]["interrupts"][0]["value"]
            lines += [
                f"- 見積：{yen(final['total_yen'])}（budget_flag = {str(final['budget_flag']).lower()}）",
                f"- 経路（チェックポイントの next から）：{route}",
                f"- 停止：interrupt {job['checks']['interrupt_count']} 件。"
                f"停止時の get_state の next は `{', '.join(job['pause']['state']['next'])}`。"
                f"payload の合計 {yen(payload['total_yen'])}",
                f"- 再開：`Command(resume=...)` に test_resume（approved = {str(job['test_resume']['approved']).lower()}）"
                "を渡し、同じ thread_id で続きを実行",
                f"- 最終状態：**{STATUS_LABELS[final['status']]}**。コメント「{final['review']['comment']}」",
            ]
        else:
            lines += [
                f"- 不足項目：{', '.join(final['missing_fields'])}",
                f"- 経路（チェックポイントの next から）：{route}",
                "- 停止：interrupt なし。見積・確認待ちには進んでいません。",
                f"- 最終状態：**{STATUS_LABELS[final['status']]}**",
            ]
        lines += [
            f"- 保存したチェックポイント：{len(job['checkpoints'])} 件（get_state_history の件数。速さや品質の指標ではありません）",
            f"- 要約（finalize／needs_input ノードの出力）：{final['summary']}",
            "",
        ]
    lines += [
        "## この結果の範囲",
        "",
        "- 申請者名・催し・単価・基準額はすべて架空です。",
        "- 承認・差し戻しは inputs/requests.json の test_resume をスクリプトが渡したテスト値です。人が確認・承認したものではありません。",
        "- 機材の予約・通知・決済などの外部処理は行っていません。",
        "- チェックポイントは InMemorySaver のメモリ上だけにあり、プロセス終了で消えます。再起動後の再開や永続化は試していません。",
        "- 各ノードは決まった規則の Python 関数です。LLM の推論・API 呼び出し・ネットワークは使っていません。",
        "- 数値の照合は workflow.py 内の assert 相当の確認で、品質評価ではありません。",
        "",
        "## ファイル",
        "",
        "- 入力：[../inputs/requests.json](../inputs/requests.json)",
        "- 実行結果：[runs.json](runs.json)",
        "- 入出力の対：[../samples.json](../samples.json)",
        "- ソース：[../workflow.py](../workflow.py)",
        "",
    ]
    return "\n".join(lines)


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(text, encoding="utf-8", newline="\n")
    os.replace(temp, path)


def main() -> int:
    try:
        packages = framework_versions()
        data = load_input()
        graph = build_graph(data["rules"])
        jobs = [run_job(graph, job) for job in data["jobs"]]
    except RunFailure as error:
        print(f"失敗: {error}", file=sys.stderr)
        print("成功用の出力は書いていません。", file=sys.stderr)
        return 1

    runs = {
        "fictional": True,
        "framework": {
            "name": "LangGraph",
            "version": packages["langgraph"],
            "commit": COMMIT,
            "packages": packages,
        },
        "scope_note": data["scope_note"]
        + " チェックポイントは InMemorySaver のメモリ上だけで、同じ Python プロセス内で停止と再開を行った。"
        "ノードは決まった規則の Python 関数で、LLM・外部 API は使っていない。",
        "rules": data["rules"],
        "jobs": jobs,
    }
    samples = {
        "format": "input-output",
        "samples": [
            {"id": job["id"], "label": job["label"], "input": job["input"], "output": job["final"]}
            for job in jobs
        ],
    }

    write_text(RUNS_PATH, json.dumps(runs, ensure_ascii=False, indent=2) + "\n")
    write_text(SAMPLES_PATH, json.dumps(samples, ensure_ascii=False, indent=2) + "\n")
    write_text(RESULT_PATH, build_result_md(runs))

    print(
        json.dumps(
            {
                "ok": True,
                "framework": packages,
                "jobs": [
                    {
                        "id": job["id"],
                        "status": job["final"]["status"],
                        "total_yen": job["final"].get("total_yen"),
                        "interrupts": job["checks"]["interrupt_count"],
                        "checkpoints": len(job["checkpoints"]),
                    }
                    for job in jobs
                ],
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
