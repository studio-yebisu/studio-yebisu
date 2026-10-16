import React, {
  Component,
  ErrorInfo,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig, type Transition } from 'motion/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion';

// ---- Data ---------------------------------------------------------------

type GuideRecord = {
  id: string;
  title: string;
  category: string;
  summary: string;
  body: string[];
  tags: string[];
};

type GuideSet = {
  title: string;
  scope_note: string;
  records: GuideRecord[];
};

type Remote<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; value: T };

const ARTICLES_URL = './input/articles.json';
const REQUEST_URL = './request.txt';
const ID_PATTERN = /^[a-z0-9-]+$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} が空か、文字列ではありません。`);
  }
  return value;
}

function requireTextList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} が空か、配列ではありません。`);
  }
  return value.map((item, index) => requireText(item, `${label}[${index}]`));
}

function parseGuideSet(json: unknown): GuideSet {
  if (!isObject(json)) throw new Error('データの最上位がオブジェクトではありません。');
  const title = requireText(json.title, 'title');
  const scopeNote = requireText(json.scope_note, 'scope_note');
  if (!Array.isArray(json.records) || json.records.length === 0) {
    throw new Error('records が空か、配列ではありません。');
  }
  const seen = new Set<string>();
  const records = json.records.map((raw: unknown, index): GuideRecord => {
    const at = `records[${index}]`;
    if (!isObject(raw)) throw new Error(`${at} がオブジェクトではありません。`);
    const id = requireText(raw.id, `${at}.id`);
    if (!ID_PATTERN.test(id)) throw new Error(`${at}.id「${id}」に使えない文字があります。`);
    if (seen.has(id)) throw new Error(`id「${id}」が重複しています。`);
    seen.add(id);
    return {
      id,
      title: requireText(raw.title, `${at}.title`),
      category: requireText(raw.category, `${at}.category`),
      summary: requireText(raw.summary, `${at}.summary`),
      body: requireTextList(raw.body, `${at}.body`),
      tags: requireTextList(raw.tags, `${at}.tags`),
    };
  });
  return { title, scope_note: scopeNote, records };
}

function describeLoadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (window.location.protocol === 'file:') {
    return `${message} file:// では読み込めません。作例のフォルダーで python -m http.server 8861 --bind 127.0.0.1 を実行し、http://127.0.0.1:8861/ から開いてください。`;
  }
  return message;
}

// ---- Search -------------------------------------------------------------

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

function toTerms(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

function searchText(record: GuideRecord): string {
  return normalize(
    [record.title, record.category, record.summary, ...record.body, ...record.tags].join('\n')
  );
}

// ---- Motion preference --------------------------------------------------

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

function readOsReduced(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCE_QUERY).matches;
}

function useOsReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readOsReduced);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(REDUCE_QUERY);
    const update = () => setReduced(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    // Older Safari only has the legacy listener API.
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);
  return reduced;
}

// The upstream component reads duration from MotionConfig; 0 removes the
// height and opacity tween while keeping the same panel and text.
const FULL_TRANSITION: Transition = { duration: 0.18, ease: 'easeOut' };
const REDUCED_TRANSITION: Transition = { duration: 0 };

function motionLabel(osReduced: boolean, manualReduced: boolean): string {
  if (osReduced && manualReduced) return '動きを抑えています（OS・このページ）';
  if (osReduced) return '動きを抑えています（OS設定）';
  if (manualReduced) return '動きを抑えています（このページ）';
  return '通常の動き';
}

// ---- Fetch hooks --------------------------------------------------------

function useRemote<T>(url: string, attempt: number, parse: (res: Response) => Promise<T>): Remote<T> {
  const [state, setState] = useState<Remote<T>>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetch(url, { cache: 'no-cache', signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} で読み込めませんでした（${url}）。`);
        return parse(res);
      })
      .then((value) => {
        if (!controller.signal.aborted) setState({ status: 'ready', value });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: describeLoadError(error) });
      });
    return () => controller.abort();
    // parse is a module-level function for each caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, attempt]);
  return state;
}

async function parseArticles(res: Response): Promise<GuideSet> {
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error('articles.json をJSONとして読めませんでした。');
  }
  return parseGuideSet(json);
}

async function parseRequest(res: Response): Promise<string> {
  const text = await res.text();
  if (text.trim() === '') throw new Error('request.txt が空です。');
  return text;
}

// ---- Result heading -----------------------------------------------------

// AccordionItem injects value/expanded into its direct children. This wrapper
// receives them and forwards value to the real AccordionTrigger inside an h3.
type ResultHeadingProps = {
  record: GuideRecord;
  value?: React.Key;
  expanded?: boolean;
};

function triggerId(id: string) {
  return `guide-trigger-${id}`;
}

function panelId(id: string) {
  return `guide-panel-${id}`;
}

function ResultHeading({ record, value, expanded }: ResultHeadingProps) {
  return (
    <>
      <h3 className="result-heading">
        <AccordionTrigger
          value={value}
          id={triggerId(record.id)}
          aria-controls={expanded ? panelId(record.id) : undefined}
          className="result-trigger"
        >
          <span className="result-category">{record.category}</span>
          <span className="result-title">{record.title}</span>
          <span className="result-arrow" aria-hidden="true" />
        </AccordionTrigger>
      </h3>
      <p className="result-summary">{record.summary}</p>
    </>
  );
}

function moveBetweenTriggers(event: React.KeyboardEvent<HTMLOListElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || !target.classList.contains('result-trigger')) return;
  const triggers = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('button.result-trigger')
  );
  const index = triggers.indexOf(target);
  if (index < 0) return;
  let next: number;
  switch (event.key) {
    case 'ArrowDown':
      next = (index + 1) % triggers.length;
      break;
    case 'ArrowUp':
      next = (index - 1 + triggers.length) % triggers.length;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = triggers.length - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  triggers[next].focus();
}

// ---- State export -------------------------------------------------------

type ExportInput = {
  data: GuideSet;
  query: string;
  results: GuideRecord[];
  expandedId: string | null;
  osReduced: boolean;
  manualReduced: boolean;
};

function downloadState(input: ExportInput): string {
  const savedAt = new Date();
  const effectiveReduced = input.osReduced || input.manualReduced;
  const payload = {
    format: 'studio-yebisu/motion-primitives-example/search-state',
    saved_at: savedAt.toISOString(),
    source: ARTICLES_URL,
    dataset_title: input.data.title,
    query: input.query,
    terms: toTerms(input.query),
    total_count: input.data.records.length,
    matching_count: input.results.length,
    matching_ids: input.results.map((record) => record.id),
    expanded_id: input.expandedId,
    motion: {
      effective_reduced: effectiveReduced,
      os_reduced: input.osReduced,
      manual_reduced: input.manualReduced,
      transition: effectiveReduced ? REDUCED_TRANSITION : FULL_TRANSITION,
    },
    records: input.results.map((record) => ({
      ...record,
      expanded: record.id === input.expandedId,
    })),
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = savedAt.toISOString().replace(/[:.]/g, '-');
  const filename = `shiori-search-${stamp}.json`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

// ---- Request copy -------------------------------------------------------

function RequestCopy() {
  const [attempt, setAttempt] = useState(0);
  const request = useRemote(REQUEST_URL, attempt, parseRequest);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState('');

  const selectForManualCopy = () => {
    const area = areaRef.current;
    if (area) {
      area.focus();
      area.select();
    }
    setNote('自動ではコピーできませんでした。選択した文を、長押しまたは Ctrl+C（⌘+C）でコピーしてください。');
  };

  const copy = () => {
    if (request.status !== 'ready') return;
    setNote('');
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      selectForManualCopy();
      return;
    }
    navigator.clipboard.writeText(request.value).then(
      () => setNote('クリップボードにコピーしました。'),
      () => selectForManualCopy()
    );
  };

  return (
    <details className="fold">
      <summary>依頼文を見る・コピーする</summary>
      <div className="fold-body">
        <p>同じ作りを自分の画面で試すときの依頼文です。検索の対象と文は自分のものに置き換えてください。</p>
        {request.status === 'loading' && <p className="muted">依頼文を読み込んでいます…</p>}
        {request.status === 'error' && (
          <div className="notice notice-error" role="alert">
            <p>依頼文を読み込めませんでした。{request.message}</p>
            <button type="button" className="btn btn-secondary" onClick={() => setAttempt((n) => n + 1)}>
              もう一度読み込む
            </button>
          </div>
        )}
        {request.status === 'ready' && (
          <>
            <label className="field-label" htmlFor="request-text">依頼文</label>
            <textarea id="request-text" ref={areaRef} className="request-text" readOnly rows={12} value={request.value} />
            <div className="row">
              <button type="button" className="btn btn-secondary" onClick={copy}>依頼文をコピー</button>
              <a className="btn btn-link" href={REQUEST_URL}>request.txt を開く</a>
            </div>
            <p className="muted" role="status">{note}</p>
          </>
        )}
      </div>
    </details>
  );
}

// ---- App ----------------------------------------------------------------

const UPSTREAM_COMMIT = '120f64f6ca60348e251f929e9c81f11ccbe45eda';
const UPSTREAM_BLOB = `https://github.com/ibelick/motion-primitives/blob/${UPSTREAM_COMMIT}`;

function App() {
  const [attempt, setAttempt] = useState(0);
  const articles = useRemote(ARTICLES_URL, attempt, parseArticles);
  const data = articles.status === 'ready' ? articles.value : null;

  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [manualReduced, setManualReduced] = useState(false);
  const [exportNote, setExportNote] = useState('');
  const osReduced = useOsReducedMotion();
  const effectiveReduced = osReduced || manualReduced;
  const inputRef = useRef<HTMLInputElement>(null);

  const indexed = useMemo(
    () => (data ? data.records.map((record) => ({ record, text: searchText(record) })) : []),
    [data]
  );

  const results = useMemo(() => {
    const terms = toTerms(query);
    return indexed
      .filter(({ text }) => terms.every((term) => text.includes(term)))
      .map(({ record }) => record);
  }, [indexed, query]);

  // A record that is no longer listed never stays expanded.
  const expandedId = expanded !== null && results.some((record) => record.id === expanded) ? expanded : null;

  const runSearch = (next: string) => {
    setQuery(next.trim());
    setExpanded(null);
    setExportNote('');
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;
    runSearch(draft);
  };

  const reset = () => {
    setDraft('');
    runSearch('');
    inputRef.current?.focus();
  };

  const trySample = () => {
    setDraft('書き出し');
    runSearch('書き出し');
  };

  const saveState = () => {
    if (!data) return;
    const filename = downloadState({ data, query, results, expandedId, osReduced, manualReduced });
    setExportNote(`${filename} をブラウザーの保存に渡しました。保存先はブラウザーの表示で確かめてください。`);
  };

  const total = data ? data.records.length : 0;
  const countText = !data
    ? ''
    : query === ''
      ? `全${total}件を表示しています`
      : results.length === 0
        ? `「${query}」に一致する手順書はありません（全${total}件中0件）`
        : `「${query}」に一致：${results.length}件（全${total}件中）`;
  const draftPending = data !== null && draft.trim() !== query;

  return (
    <div className="app" data-ready={data ? 'true' : 'false'} data-motion={effectiveReduced ? 'reduced' : 'full'}>
      <header className="masthead page">
        <p className="eyebrow">Motion Primitives / Studio Yebisu</p>
        <h1 className="title">
          <span>探して、</span>
          <span>ひとつ開く。</span>
        </h1>
        <p className="lede">
          6件の架空の手順書で、検索と開閉を試せます。
        </p>
        <ul className="badges" aria-label="この作例の前提">
          <li>架空の手順書</li>
          <li>ブラウザー内で動作</li>
        </ul>
      </header>

      <main className="page">
        <section className="panel search-panel" aria-labelledby="search-heading">
          <h2 id="search-heading" className="visually-hidden">手順書を検索</h2>
          <form className="search-form" role="search" onSubmit={onSubmit}>
            <label className="field-label" htmlFor="guide-query">手順書を検索</label>
            <div className="search-row">
              <input
                id="guide-query"
                ref={inputRef}
                className="search-input"
                type="search"
                name="q"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="例：書き出し"
                autoComplete="off"
                enterKeyHint="search"
                aria-describedby="search-help"
              />
              <button type="submit" className="btn btn-primary" disabled={!data}>検索</button>
            </div>
            <p id="search-help" className="hint">
              検索ボタンで更新。空白で区切るとAND検索。
            </p>
            <div className="row">
              <button type="button" className="btn btn-chip" onClick={trySample} disabled={!data}>
                「書き出し」で検索
              </button>
              {(query !== '' || draft !== '') && (
                <button type="button" className="btn btn-secondary" onClick={reset} disabled={!data}>
                  リセット
                </button>
              )}
            </div>
            {draftPending && <p className="hint hint-pending">入力中の語はまだ検索していません。</p>}
          </form>

          <div className="motion-control">
            <label className="toggle">
              <input
                type="checkbox"
                checked={manualReduced}
                onChange={(event) => setManualReduced(event.target.checked)}
              />
              <span>動きを抑える</span>
            </label>
            <p
              className="mode-status"
              data-reduced={effectiveReduced ? 'true' : 'false'}
              data-os-reduced={osReduced ? 'true' : 'false'}
              data-manual-reduced={manualReduced ? 'true' : 'false'}
            >
              {motionLabel(osReduced, manualReduced)}
              {effectiveReduced && '。同じ本文を読めます。'}
              {osReduced && !manualReduced && ' OS設定を優先します。'}
            </p>
          </div>
        </section>

        {articles.status === 'loading' && (
          <section className="panel" aria-busy="true">
            <p className="muted">手順書を読み込んでいます…</p>
          </section>
        )}

        {articles.status === 'error' && (
          <section className="panel notice notice-error" role="alert">
            <h2 className="notice-title">手順書を読み込めませんでした</h2>
            <p>{articles.message}</p>
            <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
              もう一度読み込む
            </button>
          </section>
        )}

        {data && (
          <section
            className="results"
            aria-labelledby="results-heading"
            data-query={query}
            data-expanded-id={expandedId ?? ''}
          >
            <div className="results-head">
              <h2 id="results-heading" className="section-title">検索結果</h2>
              <p className="results-count" role="status" aria-live="polite">{countText}</p>
            </div>

            {results.length === 0 ? (
              <div className="panel empty">
                <p>語を減らすか、別の言葉で探してみてください。</p>
                <button type="button" className="btn btn-primary" onClick={reset}>
                  検索をリセットして全件を表示
                </button>
              </div>
            ) : (
              <MotionConfig reducedMotion={effectiveReduced ? 'always' : 'never'}>
                <Accordion
                  className="result-accordion"
                  expandedValue={expandedId}
                  onValueChange={(value) => setExpanded(value === null ? null : String(value))}
                  transition={effectiveReduced ? REDUCED_TRANSITION : FULL_TRANSITION}
                >
                  <ol className="result-list" onKeyDown={moveBetweenTriggers}>
                    {results.map((record) => (
                      <li key={record.id} className="result-row" data-record-id={record.id}>
                        <AccordionItem value={record.id} className="result-item">
                          <ResultHeading record={record} />
                          <AccordionContent
                            id={panelId(record.id)}
                            role="region"
                            aria-labelledby={triggerId(record.id)}
                            className="result-panel"
                          >
                            <div className="result-panel-inner">
                              {record.body.map((paragraph, index) => (
                                <p key={index}>{paragraph}</p>
                              ))}
                              <ul className="tags" aria-label="タグ">
                                {record.tags.map((tag) => (
                                  <li key={tag}>{tag}</li>
                                ))}
                              </ul>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </li>
                    ))}
                  </ol>
                </Accordion>
              </MotionConfig>
            )}

            <p className="hint">見出しを押すと開き、別の見出しで切り替わり、同じ見出しでもう一度押すと閉じます。見出しの間は ↑↓・Home・End でも移動できます。</p>

            <div className="export">
              <button type="button" className="btn btn-secondary" onClick={saveState}>
                この表示をJSONで保存
              </button>
              <p className="muted" role="status">{exportNote}</p>
            </div>

            <p className="scope-note">{data.scope_note}</p>
          </section>
        )}

        <section className="about" aria-labelledby="about-heading">
          <h2 id="about-heading" className="section-title">この作例のしくみ</h2>
          <ol className="steps">
            <li>手順書は同じフォルダーの input/articles.json を読み込みます。検索はこのページの JavaScript だけで行い、AIやサーバーには送りません。</li>
            <li>結果の開閉は、Motion Primitives の Accordion（原典のソースを写したもの）を expandedValue と onValueChange で操作し、一度に1件だけ開きます。</li>
            <li>OSの動きを減らす設定か「動きを抑える」がオンなら、開閉の時間を0秒にします。表示する文は変わりません。</li>
          </ol>

          <h3 className="sub-title">ファイル</h3>
          <ul className="file-links">
            <li><a href={ARTICLES_URL}>入力データ（input/articles.json）</a></li>
            <li><a href="./src/app.tsx">画面と検索のソース（src/app.tsx）</a></li>
            <li><a href="./src/accordion.tsx">開閉部品のソース（src/accordion.tsx・原典を写して改変）</a></li>
            <li><a href="./vendor/motion-primitives/LICENCE.md">Motion Primitives のライセンス（LICENCE.md）</a></li>
            <li><a href="../../case.html?id=motion-primitives-example">制作記録を読む</a></li>
          </ul>

          <details className="fold pin">
            <summary>原典 ibelick/motion-primitives @ 120f64f（MIT・ベータ）</summary>
            <div className="fold-body">
              <dl className="pin-list">
                <dt>リポジトリ</dt>
                <dd><a href={`https://github.com/ibelick/motion-primitives/tree/${UPSTREAM_COMMIT}`}>ibelick/motion-primitives</a></dd>
                <dt>固定コミット</dt>
                <dd><code>{UPSTREAM_COMMIT}</code></dd>
                <dt>使った部品</dt>
                <dd>
                  <a href={`${UPSTREAM_BLOB}/components/core/accordion.tsx`}>components/core/accordion.tsx</a>
                  {' と '}
                  <a href={`${UPSTREAM_BLOB}/lib/utils.ts`}>lib/utils.ts</a>
                </dd>
                <dt>読んだ資料</dt>
                <dd>
                  <a href={`${UPSTREAM_BLOB}/app/docs/accordion/page.mdx`}>Accordion の説明（page.mdx）</a>
                  {'、'}
                  <a href={`${UPSTREAM_BLOB}/README.md`}>README</a>
                  {'、'}
                  <a href={`${UPSTREAM_BLOB}/LICENCE.md`}>LICENCE.md</a>
                </dd>
                <dt>固定した版</dt>
                <dd>react 18.3.1・react-dom 18.3.1・motion 11.12.0・framer-motion 11.12.0・clsx 2.1.1・tailwind-merge 2.6.0</dd>
              </dl>
              <p className="muted">原典はベータとされています。npm パッケージのインストールではなく、部品のソースを写して読み込み先を直す使い方です。</p>
            </div>
          </details>

          <RequestCopy />
        </section>
      </main>

      <footer className="footer page">
        <p>作例のコード・文章・架空の手順書：MIT License, Copyright (c) 2026 Studio Yebisu</p>
        <p>Motion Primitives：MIT License, Copyright (c) 2024 ibelick。React・Motion などの依存パッケージは、それぞれのライセンスに従います。</p>
      </footer>
    </div>
  );
}

// ---- Error boundary and mount ------------------------------------------

type BoundaryState = { error: Error | null };

class RenderBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app" data-ready="false">
          <main className="page">
            <section className="panel notice notice-error" role="alert">
              <h1 className="notice-title">表示中にエラーが起きました</h1>
              <p>{this.state.error.message}</p>
              <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                ページを読み込み直す
              </button>
            </section>
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <RenderBoundary>
        <App />
      </RenderBoundary>
    </React.StrictMode>
  );
}
