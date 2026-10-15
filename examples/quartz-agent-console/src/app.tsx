import {useEffect, useState} from 'react';
import samplesFile from '../samples.json';
import {formatDurations} from '../vendor/quartz/lib/format';
import {Badge} from '../vendor/quartz/ui/badge';
import {Button, buttonVariants} from '../vendor/quartz/ui/button';
import {DataList, DataListItem, DataListLabel, DataListValue} from '../vendor/quartz/ui/data-list';
import {JsonView} from '../vendor/quartz/ui/json-view';
import {PageHeader, PageHeaderActions, PageHeaderContent, PageHeaderDescription, PageHeaderRow, PageHeaderTitle} from '../vendor/quartz/ui/page-header';
import {SegmentedControl, SegmentedControlItem} from '../vendor/quartz/ui/segmented-control';
import {Status} from '../vendor/quartz/ui/status';
import {Timeline, type TimelineSpan} from '../vendor/quartz/ui/timeline';

type Outcome = 'ok' | 'fail' | 'waiting';
type Step = {
  id: string;
  label: string;
  type: 'model' | 'tool' | 'input';
  tool: string | null;
  start_ms: number;
  end_ms: number | null;
  status: Outcome;
  note: string;
  input: unknown;
  output: unknown;
};
type Run = {run_id: string; agent: string; request: string; outcome: Outcome; headline: string; focus_step: string; now_ms: number; plan: string[]; steps: Step[]};
type Sample = {id: string; label: string; input: string; output: string; fixture: Run};
type Theme = 'light' | 'dark';

// The page reads the same fixtures that samples.json publishes beside it.
const samples = (samplesFile as {samples: Sample[]}).samples;

const sampleNames: Record<string, string> = {completed: '完了', 'tool-failed': 'ツール失敗', 'waiting-input': '入力待ち'};
const outcomeWords: Record<Outcome, string> = {ok: '完了', fail: 'ツールが失敗', waiting: '入力待ち'};
const stepWords: Record<Outcome, string> = {ok: '完了', fail: '失敗', waiting: '入力待ち'};
const typeWords: Record<Step['type'], string> = {model: 'モデル', tool: 'ツール', input: '入力'};

function sampleFromHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  return samples.some(sample => sample.id === id) ? id : samples[0].id;
}

function themeFromQuery(): Theme {
  return new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';
}

// Timeline takes milliseconds and picks one unit itself.
function toSpans(run: Run): TimelineSpan[] {
  return run.steps.map(step => ({
    id: step.id,
    label: step.label,
    start: step.start_ms,
    end: step.end_ms ?? undefined,
    status: step.status,
    waitingLabel: step.status === 'waiting' ? stepWords.waiting : undefined,
    kind: step.type === 'model' ? 'model' : undefined,
    meta: step.tool ?? undefined,
  }));
}

function saveFixture(sample: Sample) {
  const blob = new Blob([JSON.stringify(sample.fixture, null, 2) + '\n'], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sample.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function App() {
  const [sampleId, setSampleId] = useState(sampleFromHash);
  const [openSteps, setOpenSteps] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState<Theme>(themeFromQuery);

  useEffect(() => { document.body.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const follow = () => setSampleId(sampleFromHash());
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);

  const sample = samples.find(s => s.id === sampleId) ?? samples[0];
  const run = sample.fixture;
  const step = run.steps.find(s => s.id === (openSteps[sample.id] ?? run.focus_step)) ?? run.steps[run.steps.length - 1];
  const notRun = run.plan.slice(run.steps.length);
  const waited = step.end_ms === null;
  const [startedAt, took] = formatDurations([step.start_ms, (step.end_ms ?? run.now_ms) - step.start_ms]).values;

  const choose = (id: string) => {
    setSampleId(id);
    window.history.replaceState(null, '', `#${encodeURIComponent(id)}`);
  };

  return <div className="flex min-h-dvh flex-col bg-page">
    <header className="sticky top-0 z-10 flex h-(--topbar) shrink-0 items-center gap-2 bg-page px-(--gutter-sm) rule-row-frame sm:px-(--gutter)">
      <p className="min-w-0 flex-1 truncate type-label text-text-1">Studio Yebisu</p>
      <a href="../../case.html?id=quartz-agent-console" className={buttonVariants({variant: 'ghost', size: 'sm'})}>作例の記事</a>
      <SegmentedControl size="sm" aria-label="画面の色" value={theme} onValueChange={value => setTheme(value === 'dark' ? 'dark' : 'light')}>
        <SegmentedControlItem value="light">ライト</SegmentedControlItem>
        <SegmentedControlItem value="dark">ダーク</SegmentedControlItem>
      </SegmentedControl>
    </header>

    <main className="mx-auto flex w-full max-w-(--container) flex-1 flex-col gap-6 px-(--gutter-sm) py-6 sm:px-(--gutter)">
      <PageHeader size="sm">
        <PageHeaderRow>
          <PageHeaderContent>
            <PageHeaderTitle>エージェント実行ログ <Badge variant="outline">静的サンプル</Badge></PageHeaderTitle>
            <PageHeaderDescription>
              どの段で止まったか、その段が何を受け取り何を返したかを、3件のサンプル実行で見分ける画面です。表示はすべて事前に書いたサンプルで、AIや外部サービスには接続していません。秒数もサンプル値です。
            </PageHeaderDescription>
          </PageHeaderContent>
          <PageHeaderActions>
            <SegmentedControl aria-label="表示するサンプル実行" value={sample.id} onValueChange={choose}>
              {samples.map(s => <SegmentedControlItem key={s.id} value={s.id}>{sampleNames[s.id] ?? s.label}</SegmentedControlItem>)}
            </SegmentedControl>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>

      <section aria-labelledby="outcome-title" className="flex flex-col gap-2">
        <h2 id="outcome-title" className="sr-only">実行の結果</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Status status={run.outcome} live>{outcomeWords[run.outcome]}</Status>
          <p className="type-body-lg text-text-1">{run.headline}</p>
        </div>
        {notRun.length > 0 && <p className="type-body text-text-2">実行されなかった段は{notRun.map(label => `「${label}」`).join('')}です。</p>}
      </section>

      {/* One column on a phone (trace, chosen step, run facts); from lg the chosen step sits beside the trace. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[auto_1fr]">
        <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <Timeline
            key={sample.id}
            label={`実行 ${run.run_id}`}
            kind="run"
            bars="quiet"
            spans={toSpans(run)}
            now={run.now_ms}
            activeId={step.id}
            onSpanClick={span => setOpenSteps(prev => ({...prev, [sample.id]: span.id}))}
          />
          <p className="type-body-sm text-text-2">段を選ぶと、その段の入力と出力が表示されます。キーボードでは上下の矢印とHome、Endで段を移り、Enterで開きます。</p>
        </div>

        <section aria-labelledby="step-title" className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 id="step-title" className="type-heading-sm text-text-1">{step.label}</h2>
              <Status status={step.status}>{stepWords[step.status]}</Status>
            </div>
            <p className="type-body text-text-2">{step.note}</p>
          </div>
          <DataList variant="framed" size="sm">
            <DataListItem>
              <DataListLabel>種類</DataListLabel>
              <DataListValue>{step.type === 'model' ? <Badge kind="model" label={typeWords.model}/> : <Badge variant="outline">{typeWords[step.type]}</Badge>}</DataListValue>
            </DataListItem>
            {step.tool && <DataListItem>
              <DataListLabel>ツール</DataListLabel>
              <DataListValue mono>{step.tool}</DataListValue>
            </DataListItem>}
            <DataListItem>
              <DataListLabel>開始</DataListLabel>
              <DataListValue numeric>{startedAt}</DataListValue>
            </DataListItem>
            <DataListItem>
              <DataListLabel>{waited ? '待った時間' : '所要'}</DataListLabel>
              <DataListValue numeric>{took}（サンプル値）</DataListValue>
            </DataListItem>
          </DataList>
          <div className="flex flex-col gap-2">
            <h3 className="type-label text-text-1">入力</h3>
            <JsonView key={`${step.id}-input`} data={step.input} label={`${step.label}の入力`} toolbar={false} maxHeight={240}/>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="type-label text-text-1">出力</h3>
            <JsonView key={`${step.id}-output`} data={step.output} label={`${step.label}の出力`} toolbar={false} maxHeight={240}/>
          </div>
        </section>

        <section aria-labelledby="run-title" className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="run-title" className="type-heading-xs text-text-1">この実行について</h2>
            <Button variant="secondary" size="sm" onClick={() => saveFixture(sample)}>このサンプルをJSONで保存</Button>
          </div>
          <DataList variant="framed">
            <DataListItem>
              <DataListLabel>依頼</DataListLabel>
              <DataListValue>{run.request}</DataListValue>
            </DataListItem>
            <DataListItem>
              <DataListLabel>エージェント</DataListLabel>
              <DataListValue mono>{run.agent}</DataListValue>
            </DataListItem>
            <DataListItem>
              <DataListLabel>実行ID</DataListLabel>
              <DataListValue mono>{run.run_id}</DataListValue>
            </DataListItem>
            <DataListItem>
              <DataListLabel>実行した段</DataListLabel>
              <DataListValue numeric>予定{run.plan.length}段のうち{run.steps.length}段</DataListValue>
            </DataListItem>
            <DataListItem>
              <DataListLabel>データ</DataListLabel>
              <DataListValue>この作例のために書いた静的なサンプルです。samples.json と同じ内容を読んでいます。</DataListValue>
            </DataListItem>
          </DataList>
        </section>
      </div>
    </main>

    <footer className="mx-auto w-full max-w-(--container) px-(--gutter-sm) pb-8 sm:px-(--gutter)">
      <p className="type-body-sm text-text-2">
        部品とトークンは Quartz（arla6ka/skills の固定版、MIT License、Copyright 2026 Arlan Marat）をそのまま使っています。アイコンは Font Awesome Free です。画面の文言とサンプルは Studio Yebisu が書きました。 <a href="THIRD_PARTY_NOTICES.txt" className="underline">利用条件とクレジット</a>
      </p>
    </footer>
  </div>;
}
