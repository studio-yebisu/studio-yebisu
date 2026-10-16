"""架空の検索画面「まちの作業席」を Browser Use の Actor API で操作し、6状態を記録する。

browser-use/browser-use 固定コミット c75e8476e26d18b7617643bc2ae082fae8eae431（配布版 0.13.11）の
Browser・Page・Element を直接使う。手順は input/scenarios.json に事前に書いたもので、
Agent.run・LLM による判断・ChatBrowserUse・Cloud・既存の Chrome プロファイルは使わない。

使い方（PowerShell、作例フォルダで）:
    .\\.venv\\Scripts\\python.exe run_browser.py --base-url http://127.0.0.1:8864
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import os
import platform
import shutil
import struct
import sys
import tempfile
import time
import unicodedata
import uuid
from importlib import metadata
from pathlib import Path
from typing import Annotated, Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

BASE_DIR = Path(__file__).resolve().parent
INPUT_FILES = {
	'input/workspaces.json': BASE_DIR / 'input' / 'workspaces.json',
	'input/scenarios.json': BASE_DIR / 'input' / 'scenarios.json',
}
DEFAULT_OUT = BASE_DIR / 'outputs' / 'browser-run.json'
DEFAULT_BASE_URL = 'http://127.0.0.1:8864'
DEFAULT_CHROME = Path('C:/Program Files/Google/Chrome/Application/chrome.exe')

WORK_PREFIX = 'studio-yebisu-browser-use-'
# 上流の profile.py は、名前に browser-use-user-data-dir- を含む user_data_dir をコピーせずそのまま使う。
PROFILE_PREFIX = 'browser-use-user-data-dir-studio-yebisu-'

SOURCE = {
	'repository': 'browser-use/browser-use',
	'commit': 'c75e8476e26d18b7617643bc2ae082fae8eae431',
	'distribution_version': '0.13.11',
	'license': 'MIT',
	'copyright': 'Copyright (c) 2024 Gregor Zunic',
}
VIEWPORT = {'width': 1280, 'height': 900}
POLL_TIMEOUT = 15.0
POLL_INTERVAL = 0.1

SCENARIO_IDS = ('S01', 'S02', 'S03', 'S04', 'S05', 'S06')
AREAS = ('恵比寿', '渋谷', '代官山', '目黒')
BUDGETS = ('500', '800', '1000')
ALLOWED_TARGETS = {
	'fill': ('#search',),
	'select_option': ('#area', '#budget'),
	'check': ('#saturday', '#power'),
	'click': ('#apply', '#reset'),
}
SELECT_VALUES = {'#area': AREAS, '#budget': BUDGETS}
API_CALL_NAMES = {
	'fill': 'Element.fill',
	'select_option': 'Element.select_option',
	'check': 'Element.check',
	'click': 'Element.click',
}
DEFAULT_CONDITIONS = {'keyword': '', 'area': '', 'budget': '', 'saturday': False, 'power': False}

# fixture.js と同じ表示の決まり。結果カードの文字列をこの形と照合する。
SATURDAY_TEXT = {True: '土曜：利用可', False: '土曜：休み'}
POWER_TEXT = {True: '電源：あり', False: '電源：なし'}


def price_text(yen: int) -> str:
	return f'{yen:,}円'


def count_text(count: int) -> str:
	return f'該当 {count}件'


# 読み取り専用。DOM の値・文字・属性を JSON 文字列で返すだけで、ページを変更しない。
READ_STATE_JS = """() => {
	const byId = (id) => document.getElementById(id);
	const text = (root, selector) => {
		const el = root.querySelector(selector);
		return el ? el.textContent.trim() : null;
	};
	const value = (id) => { const el = byId(id); return el ? el.value : null; };
	const checked = (id) => { const el = byId(id); return el ? el.checked : null; };
	const status = byId('load-status');
	const results = byId('results');
	const count = byId('result-count');
	const empty = byId('empty');
	const cards = results ? Array.from(results.querySelectorAll('article[data-id]')) : [];
	return JSON.stringify({
		title: document.title,
		path: location.pathname,
		viewport: { width: window.innerWidth, height: window.innerHeight },
		load_state: status ? (status.dataset.state ?? null) : null,
		form: {
			keyword: value('search'),
			area: value('area'),
			budget: value('budget'),
			saturday: checked('saturday'),
			power: checked('power'),
		},
		applied: results ? {
			keyword: results.dataset.keyword ?? null,
			area: results.dataset.area ?? null,
			budget: results.dataset.budget ?? null,
			saturday: results.dataset.saturday ?? null,
			power: results.dataset.power ?? null,
		} : null,
		revision: results ? (results.dataset.revision ?? null) : null,
		results_hidden: results ? results.hidden : null,
		count_text: count ? count.textContent.trim() : null,
		empty_visible: empty ? !empty.hidden : null,
		empty_text: empty ? empty.textContent.trim() : null,
		cards: cards.map((card) => ({
			id: card.dataset.id ?? null,
			data_area: card.dataset.area ?? null,
			data_price: card.dataset.price ?? null,
			data_saturday: card.dataset.saturday ?? null,
			data_power: card.dataset.power ?? null,
			hidden: card.hidden,
			id_text: text(card, '[data-field="id"]'),
			name: text(card, '[data-field="name"]'),
			area: text(card, '[data-field="area"]'),
			price: text(card, '[data-field="price"]'),
			saturday: text(card, '[data-field="saturday"]'),
			power: text(card, '[data-field="power"]'),
			description: text(card, '[data-field="description"]'),
		})),
	});
}"""


class RunError(Exception):
	"""実行を止めて、成功の記録を書かない失敗。"""


# ---------- 入力の検証 ----------

WorkspaceId = Annotated[str, Field(pattern=r'^W[0-9]{2}$')]


class Workspace(BaseModel):
	model_config = ConfigDict(extra='forbid', strict=True, frozen=True)

	id: WorkspaceId
	name: str = Field(min_length=1, max_length=40)
	area: Literal['恵比寿', '渋谷', '代官山', '目黒']
	hourly_yen: int = Field(gt=0, le=100000)
	saturday: bool
	power: bool
	description: str = Field(min_length=1, max_length=200)


class WorkspaceFile(BaseModel):
	model_config = ConfigDict(extra='forbid', strict=True)

	format: Literal['studio-yebisu-workspace-fixture-v1']
	title: Literal['まちの作業席']
	fictional: Literal[True]
	notice: str = Field(min_length=1)
	currency: Literal['JPY']
	price_unit: Literal['1時間']
	items: list[Workspace] = Field(min_length=12, max_length=12)

	@model_validator(mode='after')
	def unique_ids(self) -> 'WorkspaceFile':
		ids = [item.id for item in self.items]
		if len(set(ids)) != len(ids):
			raise ValueError('作業席のIDが重複しています')
		return self


class Action(BaseModel):
	model_config = ConfigDict(extra='forbid', strict=True, frozen=True)

	api: Literal['fill', 'select_option', 'check', 'click']
	selector: Literal['#search', '#area', '#budget', '#saturday', '#power', '#apply', '#reset']
	value: str | None = None

	@model_validator(mode='after')
	def known_pair(self) -> 'Action':
		if self.selector not in ALLOWED_TARGETS[self.api]:
			raise ValueError(f'{self.api} は {self.selector} に使えません')
		if self.api == 'fill':
			if self.value is None or not 1 <= len(self.value) <= 40:
				raise ValueError('fill の value は1〜40文字の文字列にしてください')
			if any(unicodedata.category(ch).startswith('C') for ch in self.value):
				raise ValueError('fill の value に制御文字は使えません')
		elif self.api == 'select_option':
			if self.value not in SELECT_VALUES[self.selector]:
				raise ValueError(f'{self.selector} の value は {"・".join(SELECT_VALUES[self.selector])} のどれかです')
		elif self.value is not None:
			raise ValueError(f'{self.api} に value は付けません')
		return self


class Scenario(BaseModel):
	model_config = ConfigDict(extra='forbid', strict=True, frozen=True)

	id: Literal['S01', 'S02', 'S03', 'S04', 'S05', 'S06']
	label: str = Field(min_length=1, max_length=40)
	actions: list[Action] = Field(max_length=10)
	expected_ids: list[WorkspaceId] = Field(max_length=12)

	@model_validator(mode='after')
	def unique_expected(self) -> 'Scenario':
		if len(set(self.expected_ids)) != len(self.expected_ids):
			raise ValueError(f'{self.id} の expected_ids が重複しています')
		return self


class ScenarioFile(BaseModel):
	model_config = ConfigDict(extra='forbid', strict=True)

	format: Literal['studio-yebisu-browser-scenarios-v1']
	scope: str = Field(min_length=1)
	scenarios: list[Scenario] = Field(min_length=6, max_length=6)

	@model_validator(mode='after')
	def ordered_ids(self) -> 'ScenarioFile':
		if tuple(s.id for s in self.scenarios) != SCENARIO_IDS:
			raise ValueError('シナリオは S01〜S06 の順に並べてください')
		return self


def normalize(text: str) -> str:
	return unicodedata.normalize('NFKC', text).lower()


def matches(item: Workspace, conditions: dict[str, Any]) -> bool:
	"""fixture.js と同じ規則。キーワードは名前・エリア・説明文の文字一致で、設備の判定ではない。"""
	haystack = normalize(' '.join((item.name, item.area, item.description)))
	if not all(token in haystack for token in normalize(conditions['keyword']).split()):
		return False
	if conditions['area'] and item.area != conditions['area']:
		return False
	if conditions['budget'] and item.hourly_yen > int(conditions['budget']):
		return False
	if conditions['saturday'] and not item.saturday:
		return False
	if conditions['power'] and not item.power:
		return False
	return True


def advance(form: dict[str, Any], applied: dict[str, Any], action: Action) -> tuple[dict[str, Any], dict[str, Any]]:
	"""1操作のあとにフォームと適用中の条件がどうなるべきかを返す。"""
	form = dict(form)
	applied = dict(applied)
	if action.api == 'fill':
		form['keyword'] = action.value
	elif action.api == 'select_option':
		form['area' if action.selector == '#area' else 'budget'] = action.value
	elif action.api == 'check':
		form['saturday' if action.selector == '#saturday' else 'power'] = True
	elif action.selector == '#apply':
		applied = dict(form)
	else:  # #reset はクリックした時点で全条件を外して表示し直す
		form = dict(DEFAULT_CONDITIONS)
		applied = dict(DEFAULT_CONDITIONS)
	return form, applied


def load_inputs() -> tuple[WorkspaceFile, ScenarioFile, dict[str, str]]:
	raw: dict[str, bytes] = {}
	for key, path in INPUT_FILES.items():
		try:
			raw[key] = path.read_bytes()
		except OSError as exc:
			raise RunError(f'{key} を読めません: {exc}') from exc
	hashes = {key: hashlib.sha256(data).hexdigest() for key, data in raw.items()}
	try:
		workspaces = WorkspaceFile.model_validate_json(raw['input/workspaces.json'])
		scenarios = ScenarioFile.model_validate_json(raw['input/scenarios.json'])
	except ValidationError as exc:
		raise RunError(f'入力の形が想定と違います:\n{exc}') from exc

	known = {item.id for item in workspaces.items}
	form, applied = dict(DEFAULT_CONDITIONS), dict(DEFAULT_CONDITIONS)
	for scenario in scenarios.scenarios:
		unknown = [i for i in scenario.expected_ids if i not in known]
		if unknown:
			raise RunError(f'{scenario.id} の expected_ids に未知のIDがあります: {unknown}')
		for action in scenario.actions:
			form, applied = advance(form, applied, action)
		computed = [item.id for item in workspaces.items if matches(item, applied)]
		if computed != scenario.expected_ids:
			raise RunError(
				f'{scenario.id} の expected_ids {scenario.expected_ids} が、固定の検索規則で求めた {computed} と一致しません。'
				'入力や期待値は変えずに、原因を確かめてください。'
			)
	return workspaces, scenarios, hashes


# ---------- 引数と出力先の検証 ----------


def parse_base_url(raw: str) -> str:
	parsed = urlparse(raw)
	if parsed.scheme != 'http':
		raise RunError('--base-url は http:// で始めてください')
	if parsed.username is not None or parsed.password is not None:
		raise RunError('--base-url に認証情報は含められません')
	host = parsed.hostname
	if host not in ('127.0.0.1', 'localhost'):
		raise RunError('--base-url のホストは 127.0.0.1 か localhost だけです')
	try:
		port = parsed.port
	except ValueError as exc:
		raise RunError('--base-url のポートが正しくありません') from exc
	if port is None or not 1 <= port <= 65535:
		raise RunError('--base-url にはポートを付けてください（例: http://127.0.0.1:8864）')
	if parsed.netloc.lower() != f'{host}:{port}':
		raise RunError('--base-url は http://127.0.0.1:<port> の形だけを受け付けます')
	if parsed.path not in ('', '/') or parsed.params or parsed.query or parsed.fragment:
		raise RunError('--base-url にパス・クエリ・フラグメントは付けません')
	return f'http://{host}:{port}'


def prepare_outputs(out_arg: str | None) -> tuple[Path, Path]:
	out_path = Path(out_arg).resolve() if out_arg else DEFAULT_OUT
	if out_path.suffix != '.json':
		raise RunError('--out は .json のファイル名にしてください')
	if out_path.exists():
		raise RunError(f'{out_path.name} は既にあります。上書きしないので、別の --out を指定してください')
	captures = out_path.parent / 'captures'
	existing = [f'{sid}.png' for sid in SCENARIO_IDS if (captures / f'{sid}.png').exists()]
	if existing:
		raise RunError(f'captures/ に既存の画像があります（{", ".join(existing)}）。空の出力先を指定してください')
	captures.mkdir(parents=True, exist_ok=True)
	return out_path, captures


def prepare_work_dir(work_arg: str | None) -> tuple[Path, bool]:
	if work_arg:
		work_dir = Path(work_arg).resolve()
		if work_dir == BASE_DIR or BASE_DIR in work_dir.parents:
			raise RunError('--work-dir は作例フォルダの外にしてください（ブラウザーのプロファイルを公開物に混ぜないため）')
		work_dir.mkdir(parents=True, exist_ok=True)
		return work_dir, False
	return Path(tempfile.mkdtemp(prefix=WORK_PREFIX)).resolve(), True


def cleanup_created_temp(work_dir: Path) -> None:
	"""この実行が mkdtemp で作った一時フォルダだけを消す。指定された --work-dir は消さない。"""
	temp_root = Path(tempfile.gettempdir()).resolve()
	if work_dir.parent != temp_root or not work_dir.name.startswith(WORK_PREFIX):
		print(f'警告: 一時フォルダの場所が想定と違うため削除しません: {work_dir}', file=sys.stderr)
		return
	for _ in range(5):
		try:
			shutil.rmtree(work_dir)
			return
		except FileNotFoundError:
			return
		except OSError:
			time.sleep(0.5)  # 終了直後の Chrome がファイルを握っている間の再試行
	print(f'警告: 一時フォルダを削除できませんでした: {work_dir}', file=sys.stderr)


def configure_environment(config_dir: Path) -> None:
	"""browser_use を読み込む前に、送信・同期・拡張・ログ設定・設定置き場を固定する。"""
	if 'browser_use' in sys.modules:
		raise RunError('browser_use が先に読み込まれています')
	os.environ['ANONYMIZED_TELEMETRY'] = 'false'
	os.environ['BROWSER_USE_CLOUD_SYNC'] = 'false'
	os.environ['BROWSER_USE_DISABLE_EXTENSIONS'] = 'true'
	os.environ['BROWSER_USE_SETUP_LOGGING'] = 'false'
	os.environ['BROWSER_USE_CONFIG_DIR'] = str(config_dir)
	# python-dotenv 1.2 系の load_dotenv() 無効化の指定。このスクリプト自身も .env を読まない。
	os.environ['PYTHON_DOTENV_DISABLED'] = '1'


def png_size(data: bytes) -> tuple[int, int]:
	if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR':
		raise RunError('スクリーンショットがPNGではありません')
	width, height = struct.unpack('>II', data[16:24])
	return width, height


def write_new_json(path: Path, record: dict[str, Any]) -> None:
	"""一時ファイルに書き切ってから、既存ファイルを上書きしない方法で置く。"""
	data = (json.dumps(record, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
	tmp = path.with_name(f'.{path.name}.{uuid.uuid4().hex}.tmp')
	with open(tmp, 'xb') as fh:
		fh.write(data)
		fh.flush()
		os.fsync(fh.fileno())
	try:
		if os.name == 'nt':
			os.rename(tmp, path)  # Windows の rename は宛先があると失敗する
		else:
			os.link(tmp, path)
			os.unlink(tmp)
	except FileExistsError as exc:
		tmp.unlink(missing_ok=True)
		raise RunError(f'{path.name} が実行中に作られたため書き込みません') from exc


# ---------- ブラウザー操作 ----------


class Calls:
	"""実際に成功した Browser Use API 呼び出しの回数。"""

	def __init__(self) -> None:
		self.counts: dict[str, int] = {}

	def add(self, name: str) -> None:
		self.counts[name] = self.counts.get(name, 0) + 1


async def find(page: Any, selector: str, calls: Calls) -> list[Any]:
	# ナビゲーション直後は getDocument と querySelectorAll の間で
	# document の nodeId が失効することがある。まだ操作前の読み取りだけを再取得する。
	deadline = time.monotonic() + POLL_TIMEOUT
	while True:
		try:
			elements = await page.get_elements_by_css_selector(selector)
			calls.add('Page.get_elements_by_css_selector')
			return elements
		except RuntimeError as exc:
			if 'Could not find node with given id' not in str(exc) or time.monotonic() >= deadline:
				raise
			await asyncio.sleep(POLL_INTERVAL)


async def get_unique(page: Any, selector: str, calls: Calls) -> Any:
	"""get_elements_by_css_selector は待たずに返るので、1件だけ見つかるまで短く問い合わせる。"""
	deadline = time.monotonic() + POLL_TIMEOUT
	while True:
		elements = await find(page, selector, calls)
		if len(elements) == 1:
			return elements[0]
		if len(elements) > 1:
			raise RunError(f'{selector} が {len(elements)} 件あります。1件に決まる要素だけを操作します')
		if time.monotonic() > deadline:
			raise RunError(f'{selector} が {POLL_TIMEOUT:.0f} 秒以内に見つかりません')
		await asyncio.sleep(POLL_INTERVAL)


async def wait_ready(page: Any, calls: Calls) -> None:
	deadline = time.monotonic() + POLL_TIMEOUT
	while True:
		ready = await find(page, '#load-status[data-state="ready"]', calls)
		if len(ready) == 1:
			return
		if await find(page, '#load-status[data-state="error"]', calls):
			raise RunError('検索画面が入力の読み込みに失敗しました（#load-status が error）')
		if time.monotonic() > deadline:
			raise RunError(f'検索画面が {POLL_TIMEOUT:.0f} 秒以内に ready になりません')
		await asyncio.sleep(POLL_INTERVAL)


async def read_state(page: Any, calls: Calls) -> dict[str, Any]:
	raw = await page.evaluate(READ_STATE_JS)
	calls.add('Page.evaluate')
	try:
		state = json.loads(raw)
	except json.JSONDecodeError as exc:
		raise RunError('ページの状態をJSONとして読めません') from exc
	if not isinstance(state, dict):
		raise RunError('ページの状態の形が想定と違います')
	return state


def parse_applied(applied: Any) -> dict[str, Any] | None:
	if not isinstance(applied, dict):
		return None
	flags = {'true': True, 'false': False}
	if applied.get('saturday') not in flags or applied.get('power') not in flags:
		return None
	if not all(isinstance(applied.get(k), str) for k in ('keyword', 'area', 'budget')):
		return None
	return {
		'keyword': applied['keyword'],
		'area': applied['area'],
		'budget': applied['budget'],
		'saturday': flags[applied['saturday']],
		'power': flags[applied['power']],
	}


def card_ids(state: dict[str, Any]) -> list[Any]:
	cards = state.get('cards')
	return [card.get('id') for card in cards] if isinstance(cards, list) else []


def revision_of(state: dict[str, Any]) -> int:
	raw = state.get('revision')
	if not isinstance(raw, str) or not raw.isdigit():
		raise RunError('#results の data-revision が読めません')
	return int(raw)


async def wait_for_state(
	page: Any, calls: Calls, expected_ids: list[str], applied: dict[str, Any], revision: int
) -> dict[str, Any]:
	"""画面が期待の状態に落ち着くまで短く読み直す。期待値は判定にだけ使い、記録には実際の DOM を使う。"""
	deadline = time.monotonic() + POLL_TIMEOUT
	while True:
		state = await read_state(page, calls)
		if (
			state.get('load_state') == 'ready'
			and card_ids(state) == expected_ids
			and parse_applied(state.get('applied')) == applied
			and state.get('revision') == str(revision)
		):
			return state
		if time.monotonic() > deadline:
			raise RunError(
				f'{POLL_TIMEOUT:.0f} 秒以内に期待の状態になりません（表示中のID: {card_ids(state)}、'
				f'適用中の条件: {state.get("applied")}、data-revision: {state.get("revision")}）'
			)
		await asyncio.sleep(POLL_INTERVAL)


def verify_state(
	state: dict[str, Any],
	scenario: Scenario,
	form: dict[str, Any],
	applied: dict[str, Any],
	items: dict[str, Workspace],
) -> list[dict[str, Any]]:
	"""読み取った DOM を固定の入力と1項目ずつ照合し、実際に読めた結果を返す。"""
	sid = scenario.id
	if state.get('path') != '/fixture.html':
		raise RunError(f'{sid}: 想定外のページです')
	if state.get('viewport') != VIEWPORT:
		raise RunError(f'{sid}: 表示領域が {state.get("viewport")} で、1280×900 ではありません')
	if state.get('form') != form:
		raise RunError(f'{sid}: フォームの値 {state.get("form")} が手順から求めた {form} と違います')
	if parse_applied(state.get('applied')) != applied:
		raise RunError(f'{sid}: 適用中の条件 {state.get("applied")} が {applied} と違います')
	if state.get('results_hidden') is not False:
		raise RunError(f'{sid}: 結果の一覧が表示されていません')

	results: list[dict[str, Any]] = []
	for card in state.get('cards') or []:
		item = items.get(card.get('id'))
		if item is None:
			raise RunError(f'{sid}: 入力にないIDのカードがあります: {card.get("id")}')
		flags = {'true': True, 'false': False}
		price = card.get('data_price')
		if not isinstance(price, str) or not price.isdigit():
			raise RunError(f'{sid}/{item.id}: data-price が数字ではありません')
		if card.get('data_saturday') not in flags or card.get('data_power') not in flags:
			raise RunError(f'{sid}/{item.id}: data-saturday / data-power が true/false ではありません')
		observed = {
			'id': card['id'],
			'name': card.get('name'),
			'area': card.get('area'),
			'hourly_yen': int(price),
			'saturday': flags[card['data_saturday']],
			'power': flags[card['data_power']],
			'description': card.get('description'),
			'text': {
				'price': card.get('price'),
				'saturday': card.get('saturday'),
				'power': card.get('power'),
			},
		}
		wanted = {
			'id': item.id,
			'name': item.name,
			'area': item.area,
			'hourly_yen': item.hourly_yen,
			'saturday': item.saturday,
			'power': item.power,
			'description': item.description,
			'text': {
				'price': price_text(item.hourly_yen),
				'saturday': SATURDAY_TEXT[item.saturday],
				'power': POWER_TEXT[item.power],
			},
		}
		if observed != wanted:
			raise RunError(f'{sid}/{item.id}: 表示 {observed} が入力 {wanted} と違います')
		if card.get('hidden') is not False or card.get('id_text') != item.id or card.get('data_area') != item.area:
			raise RunError(f'{sid}/{item.id}: カードのID・エリア属性・表示状態が想定と違います')
		results.append(observed)

	if [r['id'] for r in results] != scenario.expected_ids:
		raise RunError(f'{sid}: 表示のID {[r["id"] for r in results]} が期待 {scenario.expected_ids} と違います')
	if state.get('count_text') != count_text(len(results)):
		raise RunError(f'{sid}: 件数の表示「{state.get("count_text")}」が {len(results)} 件と合いません')
	if state.get('empty_visible') is not (len(results) == 0):
		raise RunError(f'{sid}: 該当なしの表示が件数と合いません')
	return results


async def drive(
	origin: str,
	chrome: Path,
	profile_dir: Path,
	workspaces: WorkspaceFile,
	scenarios: ScenarioFile,
	captures: Path,
) -> dict[str, Any]:
	from browser_use import Browser  # 環境変数を設定したあとで読み込む

	calls = Calls()
	items = {item.id: item for item in workspaces.items}
	browser = Browser(
		headless=True,
		executable_path=str(chrome),
		user_data_dir=str(profile_dir),
		enable_default_extensions=False,
		allowed_domains=[origin],
		permissions=[],
		accept_downloads=False,
		auto_download_pdfs=False,
		window_size={'width': 1280, 'height': 900},
		viewport={'width': 1280, 'height': 900},
		keep_alive=False,
	)
	records: list[dict[str, Any]] = []
	fixture: dict[str, Any] = {}
	browser_product: str | None = None
	try:
		await browser.start()
		calls.add('Browser.start')
		version = await browser.cdp_client.send.Browser.getVersion()
		browser_product = version.get('product')
		page = await browser.new_page(f'{origin}/fixture.html')
		calls.add('Browser.new_page')
		await page.set_viewport_size(VIEWPORT['width'], VIEWPORT['height'])
		calls.add('Page.set_viewport_size')
		await wait_ready(page, calls)
		opened = await page.get_url()
		calls.add('Page.get_url')
		if opened != f'{origin}/fixture.html':
			raise RunError('ブラウザーが fixture.html 以外を開いています')

		form, applied = dict(DEFAULT_CONDITIONS), dict(DEFAULT_CONDITIONS)
		for scenario in scenarios.scenarios:
			before = await read_state(page, calls)
			if before.get('load_state') != 'ready':
				raise RunError(f'{scenario.id}: 操作前に ready ではありません')
			revision = revision_of(before)
			performed: list[dict[str, Any]] = []
			for action in scenario.actions:
				element = await get_unique(page, action.selector, calls)
				if action.api == 'fill':
					await element.fill(action.value)
				elif action.api == 'select_option':
					await element.select_option(action.value)
				elif action.api == 'check':
					await element.check()
				else:
					await element.click()
				calls.add(API_CALL_NAMES[action.api])
				entry = {'api': action.api, 'call': API_CALL_NAMES[action.api], 'selector': action.selector}
				if action.value is not None:
					entry['value'] = action.value
				performed.append(entry)
				form, applied = advance(form, applied, action)
				if action.api == 'click':
					revision += 1  # 「この条件で探す」「条件をリセット」は1回ずつ表示し直す

			state = await wait_for_state(page, calls, scenario.expected_ids, applied, revision)
			results = verify_state(state, scenario, form, applied, items)
			if not fixture:
				fixture = {'url': 'fixture.html', 'title': state.get('title'), 'viewport': state.get('viewport')}

			shot = base64.b64decode(await page.screenshot(format='png'), validate=True)
			calls.add('Page.screenshot')
			width, height = png_size(shot)
			if (width, height) != (VIEWPORT['width'], VIEWPORT['height']):
				raise RunError(f'{scenario.id}: スクリーンショットが {width}×{height} で、1280×900 ではありません')
			with open(captures / f'{scenario.id}.png', 'xb') as fh:
				fh.write(shot)

			records.append(
				{
					'id': scenario.id,
					'label': scenario.label,
					'actions': performed,
					'conditions': state['form'],
					'results': results,
					'result_count': len(results),
					'count_text': state['count_text'],
					'empty_visible': state['empty_visible'],
					'empty_text': state['empty_text'] if state['empty_visible'] else None,
					'expected_ids': list(scenario.expected_ids),
					'screenshot': {
						'src': f'captures/{scenario.id}.png',
						'sha256': hashlib.sha256(shot).hexdigest(),
						'width': width,
						'height': height,
					},
					'status': 'passed',
				}
			)
	finally:
		try:
			await browser.stop()
		except Exception as exc:  # 停止の失敗で元の例外を隠さない
			print(f'警告: Browser.stop() で例外: {type(exc).__name__}: {exc}', file=sys.stderr)

	action_counts = {api: calls.counts.get(call, 0) for api, call in API_CALL_NAMES.items()}
	return {
		'fixture': fixture,
		'browser_product': browser_product,
		'api_calls': dict(sorted(calls.counts.items())),
		'action_success_counts': action_counts,
		'scenarios': records,
	}


def build_record(hashes: dict[str, str], run: dict[str, Any]) -> dict[str, Any]:
	return {
		'format': 'studio-yebisu-browser-run-v1',
		'title': 'まちの作業席',
		'fictional': True,
		'source': SOURCE,
		'inputs_sha256': hashes,
		'scope': {
			'method': 'Browser Use の Actor API（上流の文書では legacy direct control）で、ローカルの架空の検索画面を直接操作',
			'steps': 'input/scenarios.json に事前に書いた6状態の手順を、この順に1回ずつ実行',
			'data': '架空データ。実在の施設・予約・料金ではない',
			'agent_run': False,
			'llm_calls': 0,
			'not_exercised': 'Agent.run・LLM による操作の判断・ChatBrowserUse・Browser Use Cloud・既存の Chrome プロファイル',
			'network_note': 'allowed_domains はブラウザーの移動先を起動時に指定したローカル配信元1件に限る設定で、OS全体の通信を遮断するものではない',
		},
		'runtime': {
			'python': platform.python_version(),
			'browser_use': metadata.version('browser-use'),
			'browser_product': run['browser_product'],
			'headless': True,
			'agent_run': False,
			'llm_constructed': False,
			'llm_calls': 0,
			'action_success_counts': run['action_success_counts'],
			'api_calls': run['api_calls'],
		},
		'fixture': run['fixture'],
		'scenarios': run['scenarios'],
	}


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(description='まちの作業席（架空）を Browser Use の Actor API で操作して記録する')
	parser.add_argument('--base-url', default=DEFAULT_BASE_URL, help='http://127.0.0.1:<port> か http://localhost:<port>')
	parser.add_argument('--out', default=None, help='書き出すJSON（既定: outputs/browser-run.json。既存なら止まる）')
	parser.add_argument('--chrome', default=str(DEFAULT_CHROME), help='インストール済みの Chrome の実行ファイル')
	parser.add_argument('--work-dir', default=None, help='設定とプロファイルを置く作業フォルダ（既定: 一時フォルダを作って最後に消す）')
	args = parser.parse_args(argv)

	try:
		origin = parse_base_url(args.base_url)
		chrome = Path(args.chrome)
		if not chrome.is_file():
			raise RunError(f'Chrome が見つかりません: {chrome}（自動ダウンロードはしません）')
		workspaces, scenarios, hashes = load_inputs()
		out_path, captures = prepare_outputs(args.out)
		work_dir, created_temp = prepare_work_dir(args.work_dir)
	except RunError as exc:
		print(f'エラー: {exc}', file=sys.stderr)
		return 2

	try:
		run_id = uuid.uuid4().hex[:12]
		config_dir = work_dir / f'browser-use-config-{run_id}'
		profile_dir = work_dir / f'{PROFILE_PREFIX}{run_id}'
		config_dir.mkdir()
		profile_dir.mkdir()
		configure_environment(config_dir)
		run = asyncio.run(drive(origin, chrome.resolve(), profile_dir, workspaces, scenarios, captures))
		write_new_json(out_path, build_record(hashes, run))
	except Exception as exc:
		reason = str(exc) if isinstance(exc, RunError) else f'{type(exc).__name__}: {exc}'
		print(f'失敗: {reason}', file=sys.stderr)
		print('成功の記録（JSON）は書いていません。captures/ に残った画像は失敗時の途中経過です。', file=sys.stderr)
		return 1
	finally:
		if created_temp:
			cleanup_created_temp(work_dir)

	print(f'書き出しました: {out_path.name}（6状態・画像 {captures.name}/S01.png〜S06.png）')
	return 0


if __name__ == '__main__':
	sys.exit(main())
