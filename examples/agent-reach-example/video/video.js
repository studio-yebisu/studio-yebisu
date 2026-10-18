/* Agent Reach 作例：AIが情報を読むための、手順書と接続点検キット（32秒・無音の概念図フィルム）
   Copyright (c) 2026 Studio Yebisu. MIT License.
   ../concept/manifest.json を固定SHA-256で照合し、13素材のバイト数とSHA-256を確かめてから描く。
   window.seek(秒) は前の描画・壁時計・乱数に依存せず、その時刻の完成した1枚を描く。 */
'use strict';
(() => {
  const R = window.renderConfig || {};
  const RENDER = window.__MOTION_RENDER__ === true;
  const Q = new URLSearchParams(RENDER ? '' : location.search);
  const dim = (v, d) => (Number.isInteger(v) && v >= 16 && v <= 4096 ? v : d);
  const W = dim(R.width, dim(Number(Q.get('w')), 720));
  const H = dim(R.height, dim(Number(Q.get('h')), 1280));
  const FPS = Number.isInteger(R.fps) && R.fps > 0 ? R.fps : 30;
  const DURATION = 32, POSTER = 31;
  window.motionConfig = {duration: DURATION, fps: FPS, width: W, height: H, posterTime: POSTER, audioEvents: []};
  if (RENDER) document.documentElement.classList.add('render');

  // 縦（720×1280）と横（1280×720）は別々に組んだ配置。比率が違う指定は中央に収める。
  const P = H >= W;
  const BW = P ? 720 : 1280, BH = P ? 1280 : 720;
  const K = Math.min(W / BW, H / BH);

  const PIN = 'c75b9b1a0d790f7698a083dbe0a4307e7584c3175a0ef6413e7474df30ed8c3c';
  const CASE = 'agent-reach-example';
  const COMMIT = '94f06c1969dfc1834001269d79d3ad0972d9dee6';
  const MEMO = {path: 'outputs/research-note.md', bytes: 7453, sha256: '98c07c4974d2e7383491a2747326061134d62e47884c75596f97cf9ca3cf3867'};
  const V = 'vendor/agent-reach/';
  const SKILL = V + 'agent_reach/skill/SKILL.md', DEV = V + 'agent_reach/skill/references/dev.md', SOCIAL = V + 'agent_reach/skill/references/social.md';
  const PATHS = ['concept/structure.json', 'inputs/brief.json', 'outputs/collection.json', 'outputs/comparison.json', MEMO.path, 'request.txt',
    V + 'README.md', V + 'LICENSE', SKILL, DEV, SOCIAL, V + 'agent_reach/channels/twitter.py', V + 'agent_reach/channels/github.py'];

  const SANS = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans CJK JP",system-ui,sans-serif';
  const SERIF = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","BIZ UDPMincho","Noto Serif CJK JP",serif';
  const MONO = '"Cascadia Mono","Consolas","SFMono-Regular",ui-monospace,monospace';
  const C = {
    paper: '#f3eee3', card: '#fffdf8', ink: '#1d2422', muted: '#5e665f', line: '#d3c9b6', link: '#a39880',
    petrol: '#1f5f66', petrolSoft: '#d9e9e8', amber: '#b9770f', amberSoft: '#f5e1b4', amberInk: '#6a4300',
    runtimeSoft: '#e7e2d7', toolSub: '#c3cbc6', error: '#8a1f17'
  };
  const ORDER = ['source', 'runtime', 'unknown'];
  const CAT = {
    source: {name: '原典', fill: C.petrolSoft, ink: C.petrol},
    runtime: {name: '実取得', fill: C.runtimeSoft, ink: C.ink},
    unknown: {name: '未確認', fill: C.amberSoft, ink: C.amberInk, dash: true}
  };
  const SCENES = [
    {id: 'intro', start: 0, end: 4}, {id: 'open', start: 4, end: 10}, {id: 'route', start: 10, end: 14},
    {id: 'return', start: 14, end: 18}, {id: 'sort', start: 18, end: 24}, {id: 'memo', start: 24, end: 29},
    {id: 'settle', start: 29, end: 32}
  ];
  let F = null;

  // ---------- 素材の照合（固定ハッシュの素材一覧 → 13件のバイト数とSHA-256 → 内容） ----------

  const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  const utf8 = buf => new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(buf);
  const need = (ok, what) => { if (!ok) throw new Error(`保存データが映像の説明と一致しません（${what}）。`); };
  async function get(path) {
    let res;
    try { res = await fetch('../' + path, {cache: 'no-store'}); }
    catch { throw new Error(`${path} を読み込めませんでした。HTTPで配信したページを開いてください。`); }
    if (!res.ok) throw new Error(`${path} を読み込めませんでした（HTTP ${res.status}）。`);
    return res.arrayBuffer();
  }
  const sha = async buf => hex(await crypto.subtle.digest('SHA-256', buf));

  async function load() {
    if (!window.crypto || !crypto.subtle) throw new Error('SHA-256を確認できません。HTTPSかlocalhostで開いてください。');
    const raw = await get('concept/manifest.json');
    need(await sha(raw) === PIN, 'concept/manifest.json の固定SHA-256');
    let man;
    try { man = JSON.parse(utf8(raw)); } catch { throw new Error('concept/manifest.json を読めません。'); }
    need(man.format === 'studio-yebisu-assets/v1' && man.case_id === CASE && man.source_commit === COMMIT, '素材一覧の形式');
    const files = Array.isArray(man.files) ? man.files : [];
    need(files.length === PATHS.length && PATHS.every(p => files.filter(f => f.path === p).length === 1), '素材一覧の13件');
    const text = {};
    await Promise.all(files.map(async f => {
      const buf = await get(f.path);
      if (buf.byteLength !== f.bytes || await sha(buf) !== f.sha256) throw new Error(`${f.path} のバイト数またはSHA-256が素材一覧と一致しません。`);
      try { text[f.path] = utf8(buf); } catch { throw new Error(`${f.path} がUTF-8として読めません。`); }
    }));
    const facts = derive(text, files);
    await Promise.all([`700 30px ${SANS}`, `400 20px ${SANS}`, `600 64px ${SERIF}`, `700 20px ${MONO}`].map(f => document.fonts.load(f, '手順書と点検キットAgent Reach')));
    await document.fonts.ready;
    return facts;
  }

  function derive(text, files) {
    const json = p => { try { return JSON.parse(text[p]); } catch { throw new Error(`${p} をJSONとして読めません。`); } };
    const lines = p => text[p].split(/\r?\n/);
    const st = json('concept/structure.json'), brief = json('inputs/brief.json'), col = json('outputs/collection.json'), cmp = json('outputs/comparison.json');
    const memo = files.find(f => f.path === MEMO.path);
    need(memo.bytes === MEMO.bytes && memo.sha256 === MEMO.sha256, 'research-note.md の期待値');
    need(st.format === 'agent-reach-structure/v1' && st.case_id === CASE && st.source_commit === COMMIT, 'structure.json');
    const parts = st.parts || [], routes = st.routes || [];
    need(parts.length === 3 && ['routing', 'reference', 'doctor'].every((id, i) => parts[i].id === id), '3つの部品ID');
    for (const p of parts) need(PATHS.includes(p.source_path) && (lines(p.source_path)[p.line_start - 1] || '').includes(p.quote), `${p.label}の引用`);
    need(routes.length === 2 && routes[0].id === 'github' && routes[1].id === 'twitter', '2つの経路ID');
    need(routes[0].reference === 'references/dev.md' && routes[1].reference === 'references/social.md', '経路の分野別手順');
    need(routes.every(r => r.status === 'warn' && r.active_backend === null) && routes[0].files === 6 && routes[1].posts === 1, '経路の点検と件数');
    need(brief.repository === 'Panniantong/Agent-Reach' && brief.commit === COMMIT && /^https:\/\/x\.com\/[^/]+\/status\/\d+$/.test(brief.post_url), 'brief.json');
    const d = col.doctor || {};
    need(['github', 'twitter'].every(k => d[k] && d[k].status === 'warn' && d[k].active_backend === null), 'doctorはwarn・null');
    const ex = Array.isArray(col.executions) ? col.executions : [];
    need(ex.length > 0 && ex.every(e => e.exit_code === 0), '終了コード');
    const gh = ex.filter(e => e.command && e.command[0] === 'gh'), tw = ex.filter(e => e.command && e.command[0] === 'twitter');
    const got = gh.map(e => /\/contents\/(.+)\?ref=([0-9a-f]{40})$/.exec(e.command[2] || '')).filter(Boolean);
    need(gh.length === 8 && tw.length === 1 && got.length === 6 && got.every(m => m[2] === COMMIT), 'gh api 8回・twitter 1回');
    need(col.repository && col.repository.commit === COMMIT && col.repository.files_verified === 6, '原典6ファイル');
    const post = col.post || {};
    need(post.url === brief.post_url && brief.post_url.endsWith('/' + post.id) && post.returned_target_posts === 1 && post.body_present === true && post.body_republished === false, '投稿1件');
    need(String(col.collected_at).startsWith('2026-10-15') && String(st.recorded_at).startsWith('2026-10-15'), '記録日');
    const ver = s => (/\d+\.\d+\.\d+/.exec(String(s || '')) || [''])[0];
    need(ver(col.versions && col.versions.gh_version) === '2.96.0' && col.versions.twitter_cli === '0.8.5', 'CLIの版');
    const items = Array.isArray(cmp.items) ? cmp.items : [];
    const cat = {source: 0, runtime: 0, unknown: 0};
    items.forEach(i => { if (i.category in cat) cat[i.category]++; });
    need(items.length === 8 && cat.source === 3 && cat.runtime === 3 && cat.unknown === 2 && ORDER.every(c => st.evidence_counts[c] === cat[c]), '根拠8枚（3・3・2）');
    const table = lines(SKILL).slice(49, 56).map(l => l.split('|').map(s => s.trim())).filter(c => c.length >= 4);
    const row = c => table.find(x => x[2] === c);
    need(table.length === 7 && row('dev') && row('social') && row('social')[1].includes('推特'), 'SKILL.mdの経路表');
    const refG = (lines(DEV)[48] || '').trim(), refX = (lines(SOCIAL)[99] || '').trim();
    need(refG === 'gh api repos/owner/repo' && refX === 'twitter tweet URL_OR_ID', '分野別手順のコマンド');
    const h1 = lines(MEMO.path)[0] || '';
    need(h1.startsWith('# Agent Reach'), 'メモの見出し');
    const last = {};
    items.forEach((it, k) => { last[it.category] = k; });
    return {
      definition: st.definition,
      parts: Object.fromEntries(parts.map(p => [p.id, p])),
      src: {github: routes[0].source, twitter: routes[1].source},
      ref: {github: routes[0].reference.split('/').pop(), twitter: routes[1].reference.split('/').pop()},
      rowG: {intent: row('dev')[1], cat: 'dev'}, rowX: {intent: row('social')[1], cat: 'social'},
      others: table.map(x => x[2]).filter(c => c !== 'dev' && c !== 'social'),
      refG, refX,
      status: d.github.status, backend: String(d.github.active_backend),
      files: got.map(m => m[1].split('/').pop()), ghCalls: gh.length, posts: post.returned_target_posts,
      repo: brief.repository, postPath: 'status/' + post.id,
      ghVer: ver(col.versions.gh_version), twVer: col.versions.twitter_cli,
      cats: items.map(i => i.category), cat, done: Object.fromEntries(ORDER.map(c => [c, 20.5 + last[c] * 0.32])),
      memoName: MEMO.path.split('/').pop(), memoTitle: h1.slice(2).split('：')[0], memoBytes: memo.bytes,
      date: String(col.collected_at).slice(0, 10), commit7: COMMIT.slice(0, 7), copyright: col.repository.copyright
    };
  }

  // ---------- 時刻 → 値（各区間は開始前は保持、区間内は補間、以後は到達値） ----------

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const ease = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const lerp = (a, b, p) => a + (b - a) * p;
  const env = (t, a, b, f = 0.4) => prog(t, a, a + f) * (1 - prog(t, b - f, b));
  function track(keys, t) {
    const cur = {...keys[0][2]};
    for (let i = 1; i < keys.length; i++) {
      const [a, b, v] = keys[i];
      if (t <= a) continue;
      const p = ease(prog(t, a, b));
      for (const k in v) cur[k] = lerp(cur[k] === undefined ? v[k] : cur[k], v[k], p);
    }
    return cur;
  }

  // 縦の配置。中心座標・倍率・不透明度。同じ図形が場面をまたいで移動する。
  const TP = {
    task: [[0, 0, {x: 360, y: 330, s: 1, a: 0}], [0.3, 0.9, {a: 1}], [1.2, 3.0, {y: 415}], [4.0, 5.0, {y: 150, s: 0.8}], [18.0, 19.0, {y: 146, s: 0.7}]],
    urlG: [[0, 0, {x: 190, y: 420, s: 0.9, a: 0, hl: 0}], [0.5, 1.1, {a: 1}], [1.2, 3.0, {y: 495}], [4.0, 5.0, {y: 236, s: 0.85}], [4.8, 5.3, {hl: 1}], [7.0, 7.4, {hl: 0}], [10.3, 11.3, {y: 575, s: 0.7}], [11.6, 12.6, {y: 740, s: 0.6}], [18.0, 19.0, {y: 485, s: 0.5}]],
    urlX: [[0, 0, {x: 530, y: 420, s: 0.9, a: 0, hl: 0}], [0.7, 1.3, {a: 1}], [1.4, 3.2, {y: 495}], [4.0, 5.0, {y: 236, s: 0.85}], [7.2, 7.7, {hl: 1}], [9.6, 10.0, {hl: 0}], [10.5, 11.5, {y: 575, s: 0.7}], [11.8, 12.8, {y: 740, s: 0.6}], [18.0, 19.0, {y: 485, s: 0.5}]],
    book: [[0, 0, {x: 250, y: 720, s: 1, a: 0, open: 0, fold: 0, hlG: 0, hlX: 0}], [0.2, 0.8, {a: 1}], [4.0, 5.0, {x: 232, y: 420, s: 0.95, open: 1}], [4.8, 5.3, {hlG: 1}], [5.0, 5.8, {fold: 1}], [7.0, 7.4, {hlG: 0.2}], [7.2, 7.7, {hlX: 1}], [9.6, 10.0, {hlG: 0, hlX: 0}], [10.0, 10.8, {fold: 0}], [10.4, 11.4, {x: 200, y: 360, s: 0.55}], [18.0, 19.0, {x: 210, y: 285, s: 0.45}]],
    gauge: [[0, 0, {x: 530, y: 720, s: 0.9, a: 0, n: 0}], [0.4, 1.0, {a: 1}], [4.0, 5.0, {x: 560, y: 440, s: 0.9}], [4.8, 5.6, {n: 1}], [10.4, 11.4, {x: 520, y: 360, s: 0.55}], [18.0, 19.0, {x: 510, y: 285, s: 0.45}]],
    reader: [[0, 0, {x: 560, y: 680, s: 0.9, a: 0}], [4.6, 5.2, {a: 1}], [10.4, 11.4, {x: 360, y: 470, s: 0.85}], [18.0, 19.0, {x: 360, y: 285, s: 0.5}], [19.2, 20.0, {x: 110, y: 867, s: 0.5}], [24.0, 25.0, {x: 360, y: 285, s: 0.5}]],
    toolG: [[0, 0, {x: 190, y: 1030, s: 0.9, a: 0, b: 0}], [0.6, 1.2, {a: 1}], [4.0, 5.0, {y: 930, s: 0.8, a: 0.45}], [5.4, 5.9, {b: 1}], [10.0, 11.0, {y: 650, s: 1, a: 1}], [18.0, 19.0, {y: 420, s: 0.7}]],
    toolX: [[0, 0, {x: 530, y: 1030, s: 0.9, a: 0, b: 0}], [0.8, 1.4, {a: 1}], [4.0, 5.0, {y: 930, s: 0.8, a: 0.45}], [5.4, 5.9, {b: 1}], [10.0, 11.0, {y: 650, s: 1, a: 1}], [18.0, 19.0, {y: 420, s: 0.7}]],
    pG: [[0, 0, {x: 190, y: 1040, s: 0.8, a: 0}], [4.4, 5.0, {a: 0.35}], [10.0, 11.0, {y: 820, s: 1, a: 1}], [18.0, 19.0, {y: 545, s: 0.7}]],
    pX: [[0, 0, {x: 530, y: 1040, s: 0.8, a: 0}], [4.4, 5.0, {a: 0.35}], [10.0, 11.0, {y: 820, s: 1, a: 1}], [18.0, 19.0, {y: 545, s: 0.7}]],
    files: [[0, 0, {x: 190, y: 975, s: 0.8, a: 1}], [18.0, 19.4, {x: 250, y: 770, s: 0.42}]],
    post: [[0, 0, {x: 530, y: 975, s: 0.85, a: 1}], [18.2, 19.6, {x: 470, y: 770, s: 0.48}]],
    sort: [[0, 0, {x: 360, y: 965, s: 1, a: 0}], [18.6, 19.3, {a: 1}], [24.4, 25.2, {a: 0}]],
    memo: [[0, 0, {x: 360, y: 965, s: 0.4, a: 0}], [24.4, 25.4, {s: 0.6, a: 1}]],
    cta: [[0, 0, {x: 360, y: 1160, s: 1, a: 0}], [29.0, 29.5, {a: 1}]]
  };
  // 横の配置。左から右へ流れ、GitHubは上の段、Xは下の段。
  const TL = {
    task: [[0, 0, {x: 180, y: 440, s: 0.8, a: 0}], [0.3, 0.9, {a: 1}], [1.2, 3.0, {x: 600}], [4.0, 5.0, {x: 150, y: 230, s: 0.75}], [10.4, 11.4, {x: 130, y: 220, s: 0.7}], [18.0, 19.0, {x: 110, y: 200, s: 0.6}]],
    urlG: [[0, 0, {x: 180, y: 530, s: 0.8, a: 0, hl: 0}], [0.5, 1.1, {a: 1}], [1.2, 3.0, {x: 600}], [4.0, 5.0, {x: 150, y: 310, s: 0.75}], [4.8, 5.3, {hl: 1}], [7.0, 7.4, {hl: 0}], [10.3, 11.3, {x: 560, y: 300, s: 0.65}], [11.6, 12.6, {x: 820, y: 300, s: 0.55}], [18.0, 19.0, {x: 590, y: 220, s: 0.45}]],
    urlX: [[0, 0, {x: 180, y: 610, s: 0.8, a: 0, hl: 0}], [0.7, 1.3, {a: 1}], [1.4, 3.2, {x: 600}], [4.0, 5.0, {x: 150, y: 390, s: 0.75}], [7.2, 7.7, {hl: 1}], [9.6, 10.0, {hl: 0}], [10.5, 11.5, {x: 560, y: 540, s: 0.65}], [11.8, 12.8, {x: 820, y: 540, s: 0.55}], [18.0, 19.0, {x: 590, y: 360, s: 0.45}]],
    book: [[0, 0, {x: 950, y: 380, s: 1, a: 0, open: 0, fold: 0, hlG: 0, hlX: 0}], [0.2, 0.8, {a: 1}], [4.0, 5.0, {x: 470, y: 400, s: 0.9, open: 1}], [4.8, 5.3, {hlG: 1}], [5.0, 5.8, {fold: 1}], [7.0, 7.4, {hlG: 0.2}], [7.2, 7.7, {hlX: 1}], [9.6, 10.0, {hlG: 0, hlX: 0}], [10.0, 10.8, {fold: 0}], [10.4, 11.4, {x: 150, y: 400, s: 0.5}], [18.0, 19.0, {x: 130, y: 300, s: 0.42}]],
    gauge: [[0, 0, {x: 1160, y: 400, s: 0.8, a: 0, n: 0}], [0.4, 1.0, {a: 1}], [4.0, 5.0, {x: 1080, y: 300, s: 0.85}], [4.8, 5.6, {n: 1}], [10.4, 11.4, {x: 150, y: 570, s: 0.5}], [18.0, 19.0, {x: 130, y: 440, s: 0.45}]],
    reader: [[0, 0, {x: 1080, y: 530, s: 0.85, a: 0}], [4.6, 5.2, {a: 1}], [10.4, 11.4, {x: 380, y: 420, s: 0.85}], [18.0, 19.0, {x: 270, y: 300, s: 0.5}], [19.2, 20.0, {x: 572, y: 486, s: 0.4}], [24.0, 25.0, {x: 270, y: 300, s: 0.5}]],
    toolG: [[0, 0, {x: 920, y: 640, s: 0.7, a: 0, b: 0}], [0.6, 1.2, {a: 1}], [4.0, 5.0, {x: 720, y: 650, s: 0.6, a: 0.45}], [5.4, 5.9, {b: 1}], [10.0, 11.0, {x: 640, y: 300, s: 0.9, a: 1}], [18.0, 19.0, {x: 420, y: 220, s: 0.6}]],
    toolX: [[0, 0, {x: 1140, y: 640, s: 0.7, a: 0, b: 0}], [0.8, 1.4, {a: 1}], [4.0, 5.0, {x: 900, y: 650, s: 0.6, a: 0.45}], [5.4, 5.9, {b: 1}], [10.0, 11.0, {x: 640, y: 540, s: 0.9, a: 1}], [18.0, 19.0, {x: 420, y: 360, s: 0.6}]],
    pG: [[0, 0, {x: 980, y: 300, s: 0.75, a: 0}], [10.0, 11.0, {a: 1}], [18.0, 19.0, {x: 760, y: 220, s: 0.6}]],
    pX: [[0, 0, {x: 980, y: 540, s: 0.75, a: 0}], [10.0, 11.0, {a: 1}], [18.0, 19.0, {x: 760, y: 360, s: 0.6}]],
    files: [[0, 0, {x: 1150, y: 280, s: 0.5, a: 1}], [18.0, 19.4, {x: 660, y: 420, s: 0.3}]],
    post: [[0, 0, {x: 1150, y: 540, s: 0.55, a: 1}], [18.2, 19.6, {x: 880, y: 420, s: 0.34}]],
    sort: [[0, 0, {x: 760, y: 560, s: 0.75, a: 0}], [18.6, 19.3, {a: 1}], [24.4, 25.2, {a: 0}]],
    memo: [[0, 0, {x: 760, y: 560, s: 0.32, a: 0}], [24.4, 25.4, {s: 0.48, a: 1}]],
    cta: [[0, 0, {x: 1070, y: 560, s: 0.9, a: 0}], [29.0, 29.5, {a: 1}]]
  };
  const paperP = (t, i) => ease(prog(t, 14.3 + i * 0.2, 15.1 + i * 0.2));
  const postP = t => ease(prog(t, 14.8, 15.8));

  // ---------- 描画の部品 ----------

  const canvas = document.getElementById('film');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = (w, s, f) => { ctx.font = `${w} ${s}px ${f}`; };
  function label(str, x, y, {w = 400, s = 20, f = SANS, c = C.ink, al = 'left', bl = 'alphabetic', max = 0, min = 10} = {}) {
    let size = s;
    font(w, size, f);
    if (max) {
      while (size > min && ctx.measureText(str).width > max) font(w, --size, f);
      if (ctx.measureText(str).width > max) {
        let cut = str;
        while (cut.length > 1 && ctx.measureText(cut + '…').width > max) cut = cut.slice(0, -1);
        str = cut + '…';
      }
    }
    ctx.fillStyle = c; ctx.textAlign = al; ctx.textBaseline = bl; ctx.fillText(str, x, y);
  }
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shape(x, y, w, h, r, fill, stroke, lw = 2, dash = null) {
    rr(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.setLineDash(dash || []); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); ctx.setLineDash([]); }
  }
  function fade(a, fn) { if (a <= 0.003) return; ctx.save(); ctx.globalAlpha *= Math.min(1, a); fn(); ctx.restore(); }
  function place(o, fn) {
    if (!o || o.a <= 0.003) return;
    ctx.save(); ctx.globalAlpha *= Math.min(1, o.a); ctx.translate(o.x, o.y); ctx.scale(o.s, o.s); fn(); ctx.restore();
  }

  // 図形の外枠（線をつなぐ位置）。files はラベルを含むため下にずらす。
  const SZ = {task: [180, 66], urlG: [300, 76], urlX: [300, 76], gauge: [200, 220], reader: [108, 108], toolG: [220, 84], toolX: [220, 84],
    pG: [180, 70], pX: [180, 70], files: [250, 236, 30], post: [230, 130], sort: [600, 260], memo: [340, 420]};
  function box(id, o) {
    const [w, h, oy = 0] = id === 'book' ? [lerp(230, 340, o.open), lerp(300, 260, o.open)] : SZ[id];
    return {l: o.x - w * o.s / 2, r: o.x + w * o.s / 2, t: o.y + (oy - h / 2) * o.s, b: o.y + (oy + h / 2) * o.s};
  }
  function foldBox(o) {
    const s = o.s;
    return P ? {l: o.x - 170 * s, r: o.x + 170 * s, t: o.y + 144 * s, b: o.y + (144 + 230 * o.fold) * s}
      : {l: o.x + 184 * s, r: o.x + (184 + 340 * o.fold) * s, t: o.y - 115 * s, b: o.y + 115 * s};
  }
  const DIR = {t: [0, -1], b: [0, 1], l: [-1, 0], r: [1, 0]};
  function end(b, side, f = 0.5) {
    const [dx, dy] = DIR[side];
    return {x: side === 'l' ? b.l : side === 'r' ? b.r : lerp(b.l, b.r, f), y: side === 't' ? b.t : side === 'b' ? b.b : lerp(b.t, b.b, f), dx, dy};
  }
  const ptAt = (o, x, y) => ({x: o.x + x * o.s, y: o.y + y * o.s});
  const bez = (c, u) => { const v = 1 - u; return [v * v * v * c[0] + 3 * v * v * u * c[2] + 3 * v * u * u * c[4] + u * u * u * c[6], v * v * v * c[1] + 3 * v * v * u * c[3] + 3 * v * u * u * c[5] + u * u * u * c[7]]; };
  function strokeCurve(c, frac, color, lw, dash) {
    ctx.beginPath(); ctx.moveTo(c[0], c[1]);
    if (frac >= 1) ctx.bezierCurveTo(c[2], c[3], c[4], c[5], c[6], c[7]);
    else for (let i = 1; i <= 32; i++) { const [x, y] = bez(c, frac * i / 32); ctx.lineTo(x, y); }
    ctx.setLineDash(dash || []); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke(); ctx.setLineDash([]);
  }
  function arrow(c, color) {
    const a = Math.atan2(c[7] - c[5], c[6] - c[4]), x = c[6], y = c[7];
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x - 12 * Math.cos(a - 0.45), y - 12 * Math.sin(a - 0.45));
    ctx.lineTo(x - 12 * Math.cos(a + 0.45), y - 12 * Math.sin(a + 0.45));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function link(p, q, {a = 1, hl = 0, sweep = 0} = {}) {
    if (a <= 0.003) return;
    const k = Math.max(18, Math.hypot(q.x - p.x, q.y - p.y) * 0.42);
    const c = [p.x, p.y, p.x + p.dx * k, p.y + p.dy * k, q.x + q.dx * k, q.y + q.dy * k, q.x, q.y];
    ctx.save(); ctx.globalAlpha *= Math.min(1, a);
    strokeCurve(c, 1, C.link, 3); arrow(c, C.link);
    if (hl > 0.01) fade(hl, () => { strokeCurve(c, 1, C.petrol, 4.5); arrow(c, C.petrol); });
    if (sweep > 0) { strokeCurve(c, sweep, C.petrol, 5); if (sweep >= 1) arrow(c, C.petrol); }
    ctx.restore();
  }

  // ---------- 図形 ----------

  function drawTask() {
    shape(-90, -33, 180, 66, 12, C.card, C.ink, 2.5);
    label('依頼', 0, -4, {w: 700, s: 26, al: 'center'});
    label('手順で読み、メモに', 0, 22, {s: 15, c: C.muted, al: 'center', max: 160});
  }
  function drawChip(kind, hl) {
    shape(-150, -38, 300, 76, 38, C.card, hl > 0.01 ? C.petrol : C.ink, 2.5 + 2 * hl);
    ctx.beginPath(); ctx.arc(-112, 0, 22, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill();
    label('URL', -112, 1, {w: 700, s: 12, f: MONO, c: C.card, al: 'center', bl: 'middle'});
    label(kind === 'github' ? 'GitHub' : 'X', -80, -6, {w: 700, s: 22});
    label(kind === 'github' ? F.repo : F.postPath, -80, 20, {s: 15, f: MONO, c: C.muted, max: 214, min: 11});
  }
  function drawCover() {
    shape(-115, -150, 230, 300, 10, C.petrol, null);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-115, -150, 20, 300);
    label('Agent Reach', 10, -50, {w: 700, s: 30, f: SERIF, c: C.card, al: 'center', max: 190});
    label('SKILL.md', 10, 0, {s: 17, f: MONO, c: C.card, al: 'center'});
    label('＋ references/', 10, 26, {s: 15, f: MONO, c: C.card, al: 'center'});
    shape(-50, 92, 120, 34, 17, null, C.card, 1.5);
    label('手順書', 10, 115, {w: 700, s: 17, c: C.card, al: 'center'});
  }
  function bookRow(y, r, hl) {
    fade(hl, () => shape(-160, y - 24, 320, 48, 8, C.petrolSoft, C.petrol, 2));
    label(r.cat === 'dev' ? 'GitHub' : 'Xなど', -148, y + 7, {s: 19, max: 180, min: 13});
    label('→', 50, y + 7, {w: 700, s: 20, c: C.petrol, al: 'center'});
    label(r.cat, 76, y + 7, {w: 700, s: 21, f: MONO, c: C.petrol});
  }
  function drawPage(o) {
    shape(-170, -130, 340, 260, 8, C.card, C.ink, 2);
    label(F.parts.routing.label, -148, -94, {w: 700, s: 24});
    label('SKILL.md', 148, -94, {s: 15, f: MONO, c: C.muted, al: 'right'});
    ctx.fillStyle = C.line; ctx.fillRect(-150, -80, 300, 1.5);
    bookRow(-45, F.rowG, o.hlG); bookRow(15, F.rowX, o.hlX);
    shape(-158, 50, 316, 50, 8, null, C.link, 1.5, [5, 5]);
    label(F.others.join('・'), 0, 72, {s: 14, f: MONO, c: C.muted, al: 'center', max: 296});
    label('ほかの分類（今回は使わない）', 0, 92, {s: 13, c: C.muted, al: 'center'});
  }
  function refBlock(y, file, cmd, hl) {
    shape(14, y, 312, 76, 8, C.paper, C.line, 1.5);
    fade(hl, () => shape(14, y, 312, 76, 8, C.petrolSoft, C.petrol, 2.5));
    label(file, 30, y + 30, {w: 700, s: 19, f: MONO, c: C.petrol});
    label(cmd, 30, y + 58, {s: 16, f: MONO, max: 282, min: 11});
  }
  function drawFold(o) {
    ctx.save();
    if (P) { ctx.translate(-170, 144); ctx.scale(1, o.fold); } else { ctx.translate(184, -115); ctx.scale(o.fold, 1); }
    shape(0, 0, 340, 230, 8, C.card, C.ink, 2);
    label(F.parts.reference.label, 22, 36, {w: 700, s: 24});
    label('references/', 318, 36, {s: 14, f: MONO, c: C.muted, al: 'right'});
    refBlock(52, F.ref.github, F.refG, o.hlG); refBlock(138, F.ref.twitter, F.refX, o.hlX);
    ctx.restore();
  }
  function drawBook(o) {
    if (o.open < 0.999) fade(1 - o.open, () => { ctx.save(); const k = 1 - o.open * 0.15; ctx.scale(k, k); drawCover(); ctx.restore(); });
    if (o.open > 0.001) fade(o.open, () => { ctx.save(); const k = 0.85 + 0.15 * o.open; ctx.scale(k, k); if (o.fold > 0.001) drawFold(o); drawPage(o); ctx.restore(); });
  }
  function drawGauge(o) {
    shape(-100, -110, 200, 220, 12, C.card, C.amber, 2.5);
    label(F.parts.doctor.label, 0, -78, {w: 700, s: 22, al: 'center'});
    label('doctor（CLI）', 0, -56, {s: 14, f: MONO, c: C.muted, al: 'center'});
    const cy = 30, r = 62;
    const arc = (u0, u1, color) => { ctx.beginPath(); ctx.arc(0, cy, r, Math.PI * (1 + u0), Math.PI * (1 + u1)); ctx.strokeStyle = color; ctx.lineWidth = 12; ctx.lineCap = 'butt'; ctx.stroke(); };
    arc(0, 0.33, C.line); arc(0.34, 0.66, C.amber); arc(0.67, 1, C.line);
    label('ok', r + 6, cy + 20, {s: 12, f: MONO, c: C.muted, al: 'right'});
    const needle = u => { const a = Math.PI * (1 + u); ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10)); ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke(); };
    needle(lerp(0.04, 0.45, o.n)); needle(lerp(0.04, 0.55, o.n));
    ctx.beginPath(); ctx.arc(0, cy, 7, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill();
    fade(o.n, () => {
      label(`GitHub・X：${F.status}`, 0, 66, {w: 700, s: 18, c: C.amberInk, al: 'center', max: 180});
      label(`active_backend: ${F.backend}`, 0, 90, {s: 13, f: MONO, c: C.muted, al: 'center', max: 184});
    });
  }
  const ROLES = [[-1, 10.2, 'AIエージェント'], [10.0, 18.0, '取得は制作担当が実行'], [24.2, 99, 'AI']];
  function drawReader(t) {
    ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.fillStyle = C.card; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 32, 17, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fillStyle = C.petrol; ctx.fill();
    ROLES.forEach(([a, b, str]) => fade(env(t, a, b), () => {
      if (t >= 24 && P) label(str, 66, 10, {w: 700, s: 34});
      else if (t >= 24) label(str, 0, 92, {w: 700, s: 30, al: 'center'});
      else label(str, 0, 86, {w: 700, s: 21, al: 'center'});
    }));
    fade(env(t, 10.4, 18.0), () => label(`${F.date}の保存記録`, 0, 110, {s: 16, c: C.muted, al: 'center'}));
  }
  function drawTool(kind, b) {
    shape(-110, -42, 220, 84, 10, C.ink, null);
    ctx.fillStyle = C.petrol; ctx.fillRect(-110, -42, 12, 84);
    label(kind === 'github' ? 'gh api' : 'twitter-cli', -84, 2, {w: 700, s: 26, f: MONO, c: C.card, max: 180});
    label(kind === 'github' ? 'gh ' + F.ghVer : 'v' + F.twVer, -84, 26, {s: 14, f: MONO, c: C.toolSub});
    fade(b, () => { shape(18, -58, 104, 28, 14, C.amberSoft, C.amber, 1.5); label(`doctor: ${F.status}`, 70, -39, {w: 700, s: 13, f: MONO, c: C.amberInk, al: 'center'}); });
  }
  function drawPlatform(kind) {
    shape(-90, -35, 180, 70, 35, C.paper, C.ink, 3);
    label(kind === 'github' ? 'GitHub' : 'X', 0, -2, {w: 700, s: 26, al: 'center'});
    label(F.src[kind], 0, 22, {s: 14, c: C.muted, al: 'center', max: 150});
  }
  const SLOT = i => [(i % 3 - 1) * 84, i < 3 ? -46 : 46];
  function paper(name) {
    shape(-33, -40, 66, 80, 4, C.card, C.ink, 1.5);
    ctx.beginPath(); ctx.moveTo(15, -40); ctx.lineTo(33, -22); ctx.lineTo(15, -22); ctx.closePath(); ctx.fillStyle = C.line; ctx.fill();
    for (let k = 0; k < 3; k++) ctx.fillRect(-22, -22 + k * 12, k === 2 ? 26 : 34, 4);
    label(name, 0, 30, {s: 10, f: MONO, al: 'center', max: 60, min: 7});
  }
  function drawFiles(t) {
    F.files.forEach((name, i) => {
      if (paperP(t, i) < 1) return;
      const [x, y] = SLOT(i); ctx.save(); ctx.translate(x, y); paper(name); ctx.restore();
    });
    fade(prog(t, 14.6, 15.0), () => {
      label(`原典${F.files.length}ファイル`, 0, 122, {w: 700, s: 22, al: 'center'});
      label(`gh api ${F.ghCalls}回・終了コード0`, 0, 146, {s: 15, c: C.muted, al: 'center'});
    });
  }
  function drawPost() {
    shape(-115, -65, 230, 130, 10, C.card, C.ink, 2);
    label(`投稿の記録 ${F.posts}件`, -95, -28, {w: 700, s: 20, max: 190});
    label('ID一致・本文あり', -95, 2, {s: 16, max: 190});
    label('本文は掲載しません', -95, 26, {s: 14, c: C.muted, max: 190});
    label('twitter tweet … -n 1', -95, 50, {s: 12, f: MONO, c: C.muted, max: 190});
  }
  function drawSort(t) {
    shape(-300, -130, 600, 260, 14, C.card, C.petrol, 2.5);
    label('保存結果の整理：AI', -215, -90, {w: 700, s: 20, max: 260});
    ctx.beginPath(); ctx.moveTo(70, -130); ctx.lineTo(150, -130); ctx.lineTo(126, -100); ctx.lineTo(94, -100); ctx.closePath();
    ctx.fillStyle = C.petrolSoft; ctx.fill(); ctx.strokeStyle = C.petrol; ctx.lineWidth = 2; ctx.stroke();
    ORDER.forEach((c, i) => {
      const d = CAT[c], x = (i - 1) * 195;
      shape(x - 90, -62, 180, 182, 10, d.fill, d.ink, 2, d.dash ? [7, 5] : null);
      label(d.name, x - 74, -34, {w: 700, s: 20, c: d.ink});
      fade(prog(t, F.done[c], F.done[c] + 0.3), () => label(String(F.cat[c]), x + 74, -30, {w: 600, s: 40, f: SERIF, c: d.ink, al: 'right'}));
    });
  }
  function drawCard(c) {
    const d = CAT[c];
    shape(-70, -15, 140, 30, 6, d.fill, d.ink, 2, d.dash ? [5, 4] : null);
    ctx.fillStyle = d.ink; ctx.fillRect(-56, -2, 62, 4); ctx.fillRect(18, -2, 34, 4);
  }
  const BARS = [0.62, 0.95, 0.88, 0.7, 0.5, 0.92, 0.84, 0.66, 0.55, 0.9, 0.78];
  function drawMemo() {
    ORDER.forEach((c, i) => {
      const d = CAT[c], y = -120 + i * 80;
      shape(150, y, 76, 66, 8, d.fill, d.ink, 2, d.dash ? [6, 4] : null);
      label(d.name, 198, y + 26, {w: 700, s: 15, c: d.ink, al: 'center'});
      label(String(F.cat[c]), 198, y + 56, {w: 600, s: 24, f: SERIF, c: d.ink, al: 'center'});
    });
    shape(-170, -210, 340, 420, 6, C.card, C.ink, 2.5);
    label(F.memoName, -146, -176, {s: 17, f: MONO, c: C.petrol});
    label(F.memoTitle, -146, -134, {w: 700, s: 26, f: SERIF, max: 292});
    ctx.fillStyle = C.line; ctx.fillRect(-146, -114, 292, 1.5);
    BARS.forEach((wd, i) => {
      const head = i % 4 === 0;
      ctx.fillStyle = head ? C.muted : C.line;
      ctx.fillRect(-146, -92 + i * 24, 292 * (head ? wd * 0.6 : wd), head ? 8 : 6);
    });
    label(`${F.memoBytes.toLocaleString('en-US')} bytes・日本語`, -146, 192, {s: 13, f: MONO, c: C.muted});
  }
  function drawCTA() {
    shape(-210, -40, 420, 80, 40, C.petrol, null);
    label('実際の根拠メモを開く', 0, 2, {w: 700, s: 28, c: C.card, al: 'center', bl: 'middle'});
  }

  // ---------- 場面の線・見出し ----------

  function links(t, o) {
    const b = id => box(id, o[id]);
    const pg = box('book', o.book), fo = foldBox(o.book);
    const sw = a => prog(t, a, a + 0.6);
    const s1 = env(t, 4.8, 10.3);
    if (P) {
      link(end(b('urlG'), 'b'), end(pg, 't', 0.3), {a: s1 * (0.35 + 0.65 * o.book.hlG), hl: o.book.hlG});
      link(end(b('urlX'), 'b'), end(pg, 't', 0.8), {a: s1 * (0.35 + 0.65 * o.book.hlX), hl: o.book.hlX});
      link(end(fo, 'r'), end(b('reader'), 'l'), {a: env(t, 5.4, 10.3)});
      link(end(pg, 'r'), end(b('reader'), 't'), {a: env(t, 10.8, 18.0)});
      link(end(b('reader'), 'l'), end(b('toolG'), 't'), {a: env(t, 10.6, 18.0)});
      link(end(b('reader'), 'r'), end(b('toolX'), 't'), {a: env(t, 10.6, 18.0)});
    } else {
      link(end(b('urlG'), 'r'), end(pg, 'l', 0.327), {a: s1 * (0.35 + 0.65 * o.book.hlG), hl: o.book.hlG});
      link(end(b('urlX'), 'r'), end(pg, 'l', 0.558), {a: s1 * (0.35 + 0.65 * o.book.hlX), hl: o.book.hlX});
      link(end(fo, 'r'), end(b('reader'), 't'), {a: env(t, 5.4, 10.3)});
      link(end(pg, 'r'), end(b('reader'), 'l'), {a: env(t, 10.8, 18.0)});
      link(end(b('reader'), 'r'), end(b('toolG'), 'l'), {a: env(t, 10.6, 18.0)});
      link(end(b('reader'), 'r'), end(b('toolX'), 't'), {a: env(t, 10.6, 18.0)});
    }
    // 道具 → 接続先 → 材料（取得の道筋は最後まで残す）
    const tp = P ? ['b', 't'] : ['r', 'l'];
    link(end(b('toolG'), tp[0]), end(b('pG'), tp[1]), {a: env(t, 10.8, 99), sweep: sw(26.6)});
    link(end(b('toolX'), tp[0]), end(b('pX'), tp[1]), {a: env(t, 10.8, 99), sweep: sw(26.6)});
    const pm = t < 18.5 ? tp : ['b', 't'];
    const r5 = env(t, 14.4, 17.8) + env(t, 19.4, 99);
    link(end(b('pG'), pm[0]), end(b('files'), pm[1]), {a: r5, sweep: sw(27.2)});
    link(end(b('pX'), pm[0]), end(b('post'), pm[1]), {a: r5, sweep: sw(27.2)});
    // 材料 → 整理（取得のあとの別工程）
    const intake = {...ptAt(o.sort, 110, -130), dx: 0, dy: -1};
    link(end(b('files'), 'b'), intake, {a: env(t, 19.6, 24.6)});
    link(end(b('post'), 'b'), intake, {a: env(t, 19.6, 24.6)});
    // まとめ：依頼と手順書 → 読む人 → 道具 … → メモ
    const r8 = env(t, 25.0, 99);
    link(end(b('task'), 'b'), end(b('reader'), 't'), {a: r8, sweep: sw(25.4)});
    link(end(pg, 'r'), end(b('reader'), 'l'), {a: r8, sweep: sw(25.4)});
    const rs = P ? ['b', 't'] : ['r', 'l'];
    link(end(b('reader'), rs[0]), end(b('toolG'), rs[1]), {a: r8, sweep: sw(26.0)});
    link(end(b('reader'), rs[0]), end(b('toolX'), rs[1]), {a: r8, sweep: sw(26.0)});
    link(end(b('files'), 'b'), end(b('memo'), 't', 0.35), {a: env(t, 25.2, 99), sweep: sw(27.8)});
    link(end(b('post'), 'b'), end(b('memo'), 't', 0.65), {a: env(t, 25.2, 99), sweep: sw(27.8)});
  }
  function tray(t, o) {
    const a = o.book.a * (1 - prog(t, 3.8, 4.3));
    if (a <= 0.003) return;
    const b1 = box('book', o.book), b2 = box('gauge', o.gauge), pad = P ? 22 : 16;
    const l = Math.min(b1.l, b2.l) - pad, tp = Math.min(b1.t, b2.t) - pad - 18, r = Math.max(b1.r, b2.r) + pad, bt = Math.max(b1.b, b2.b) + pad;
    fade(a, () => {
      shape(l, tp, r - l, bt - tp, 18, 'rgba(31,95,102,0.06)', C.petrol, 2, [10, 7]);
      label('Agent Reach ＝ 手順書 ＋ 接続点検', l + 18, tp + 26, {w: 700, s: 17, c: C.petrol, max: r - l - 36});
    });
  }
  function divider(t) {
    fade(prog(t, 0.8, 1.4) * (1 - prog(t, 3.8, 4.3)), () => {
      ctx.setLineDash([8, 8]); ctx.strokeStyle = C.link; ctx.lineWidth = 2; ctx.beginPath();
      if (P) { ctx.moveTo(56, 930); ctx.lineTo(664, 930); } else { ctx.moveTo(800, 588); ctx.lineTo(1240, 588); }
      ctx.stroke(); ctx.setLineDash([]);
      if (P) label('読む道具は別：既存のCLI', 360, 966, {w: 700, s: 22, c: C.muted, al: 'center'});
      else label('読む道具は別：既存のCLI', 1240, 576, {w: 700, s: 20, c: C.muted, al: 'right'});
    });
  }
  function heading(t) {
    fade(1 - prog(t, 3.8, 4.4), () => {
      const [x, y0, y1, y2, s] = P ? [56, 112, 200, 276, 64] : [80, 170, 262, 350, 76];
      label('Agent Reach', x, y0, {w: 700, s: 30, c: C.petrol});
      label('情報を読む、', x, y1, {w: 600, s, f: SERIF});
      label('手順書と点検キット', x, y2, {w: 600, s, f: SERIF, max: P ? 608 : 700});
    });
    fade(prog(t, 4.0, 4.6), () => {
      label('Agent Reach', P ? 40 : 48, P ? 62 : 60, {w: 700, s: 24, c: C.petrol});
      if (P) label(F.definition, 40, 100, {s: 26, max: 640});
      else label(F.definition, 214, 60, {s: 26, max: 1018});
    });
  }
  const CAPS = [
    [4.0, 10.0, () => '何を、どの道具で読むか', () => '経路表で振り分け、分野別手順でコマンドを知る'],
    [10.0, 14.0, () => '既存のCLIで、直接読む', () => '手順書は道筋を示すだけ。読み取りを中継しない'],
    [14.0, 18.0, () => `原典${F.files.length}ファイルと、投稿${F.posts}件の記録`, () => `点検の表示は${F.status}のまま`],
    [18.0, 24.0, () => '整理は、取得のあと', () => '原典の主張と、実際の結果を分ける'],
    [24.0, 29.0, () => '依頼と手順書 → 道具 → 材料 → メモ', () => `${F.memoName}（日本語の根拠メモ）`]
  ];
  function captions(t) {
    CAPS.forEach(([a, b, main, sub]) => fade(env(t, a + 0.2, b), () => {
      if (P) {
        label(main(), 360, 1150, {w: 700, s: 40, al: 'center', max: 640, min: 26});
        label(sub(), 360, 1192, {s: 22, c: C.muted, al: 'center', max: 640});
      } else {
        label(main(), 48, 128, {w: 700, s: 34, max: 760, min: 24});
        label(sub(), 48, 164, {s: 20, c: C.muted, max: 760});
      }
    }));
  }
  function footer() {
    const y = P ? 1252 : 704;
    label('保存済みの記録を図解／無音', P ? 40 : 48, y, {s: P ? 18 : 16, c: C.muted});
    label(`Agent Reach @${F.commit7} ・ MIT © ${F.copyright}`, P ? 680 : 1232, y, {s: P ? 15 : 14, c: C.muted, al: 'right', max: P ? 360 : 600});
  }
  function flights(t, o) {
    F.files.forEach((name, i) => {
      const p = paperP(t, i);
      if (p <= 0 || p >= 1) return;
      const [sx, sy] = SLOT(i);
      place({x: lerp(o.pG.x, o.files.x + sx * o.files.s, p), y: lerp(o.pG.y, o.files.y + sy * o.files.s, p) - Math.sin(Math.PI * p) * 30,
        s: lerp(o.pG.s * 0.6, o.files.s, p), a: 1}, () => paper(name));
    });
    const q = postP(t);
    if (q > 0 && q < 1) place({x: lerp(o.pX.x, o.post.x, q), y: lerp(o.pX.y, o.post.y, q) - Math.sin(Math.PI * q) * 30, s: lerp(o.pX.s * 0.4, o.post.s, q), a: 1}, drawPost);
  }
  function cards(t, o) {
    const seen = {source: 0, runtime: 0, unknown: 0};
    F.cats.forEach((c, k) => {
      const j = seen[c]++;
      const p = ease(prog(t, 19.8 + k * 0.32, 20.5 + k * 0.32));
      const q = ease(prog(t, 24.1 + k * 0.1, 24.8 + k * 0.1));
      if (p <= 0 || q >= 1) return;
      const from = ptAt(o.sort, 110, -110), slot = ptAt(o.sort, (ORDER.indexOf(c) - 1) * 195, j * 38);
      let x = lerp(from.x, slot.x, p), y = lerp(from.y, slot.y, p), s = lerp(o.sort.s * 0.4, o.sort.s, p);
      if (q > 0) {
        const tab = ptAt(o.memo, 198, -87 + ORDER.indexOf(c) * 80);
        x = lerp(x, tab.x, q); y = lerp(y, tab.y, q); s = lerp(s, o.memo.s * 0.45, q);
      }
      place({x, y, s, a: 1}, () => drawCard(c));
    });
  }

  function draw(t) {
    canvas.width = W; canvas.height = H;
    ctx.save();
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.translate((W - BW * K) / 2, (H - BH * K) / 2); ctx.scale(K, K);
    const T = P ? TP : TL, o = {};
    for (const id in T) o[id] = track(T[id], t);
    heading(t); tray(t, o); divider(t); links(t, o);
    place(o.sort, () => drawSort(t));
    place(o.memo, drawMemo);
    place(o.toolG, () => drawTool('github', o.toolG.b)); place(o.toolX, () => drawTool('twitter', o.toolX.b));
    place(o.pG, () => drawPlatform('github')); place(o.pX, () => drawPlatform('twitter'));
    place(o.files, () => drawFiles(t));
    if (postP(t) >= 1) place(o.post, drawPost);
    flights(t, o);
    place(o.book, () => drawBook(o.book));
    place(o.gauge, () => drawGauge(o.gauge));
    place(o.reader, () => drawReader(t));
    place(o.task, drawTask);
    place(o.urlG, () => drawChip('github', o.urlG.hl)); place(o.urlX, () => drawChip('twitter', o.urlX.hl));
    cards(t, o);
    place(o.cta, drawCTA);
    captions(t); footer();
    ctx.restore();
  }
  function drawError(msg) {
    canvas.width = W; canvas.height = H;
    ctx.save();
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.translate((W - BW * K) / 2, (H - BH * K) / 2); ctx.scale(K, K);
    const x = P ? 48 : 96, y = P ? 520 : 260, max = P ? 600 : 1060;
    ctx.fillStyle = C.error; ctx.fillRect(x, y, 6, 170);
    label('保存素材を照合できないため、描画していません', x + 24, y + 40, {w: 700, s: 30, c: C.error, max, min: 18});
    font(400, 20, SANS); ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    let line = '', ly = y + 86;
    for (const ch of msg) {
      if (ctx.measureText(line + ch).width > max) { ctx.fillText(line, x + 24, ly); line = ''; ly += 30; }
      line += ch;
    }
    if (line) ctx.fillText(line, x + 24, ly);
    ctx.restore();
  }

  // ---------- 編集画面（書き出し時は使わない） ----------

  const DESC = [
    () => 'Agent Reachは、AIが情報を読むための手順書と接続点検のキットです。GitHubとXの2つのURLと依頼が手順書へ近づきます。読む道具の既存CLIは手順書とは別にあります。',
    () => `手順書が開き、経路表でGitHubは${F.rowG.cat}、Xは${F.rowX.cat}へ振り分けられ、分野別手順に「${F.refG}」と「${F.refX}」が示されます。横の接続点検（doctor）はGitHub・Xとも${F.status}、active_backendは${F.backend}のままです。`,
    () => `2つのURLが既存のgh apiとtwitter-cliを通って、GitHubとXへ直接向かいます。Agent Reachは読み取りを中継しません。取得は制作担当が実行した${F.date}の保存記録です。`,
    () => `GitHubから原典${F.files.length}ファイル（${F.files.join('、')}）、Xから投稿${F.posts}件の記録が戻ります。投稿の本文は載せません。点検の表示は${F.status}のままです。`,
    () => `取得のあと、AIが保存結果を整理し、根拠${F.cats.length}枚を原典${F.cat.source}・実取得${F.cat.runtime}・未確認${F.cat.unknown}に分けます。`,
    () => `カードが日本語の根拠メモ ${F.memoName} にまとまり、依頼と手順書から道具・材料・整理・メモまでの流れが一本につながります。`,
    () => '全体の流れが静止し、「実際の根拠メモを開く」を示して終わります。保存済みの記録を図解した無音の映像です。'
  ];
  const $ = id => document.getElementById(id);
  const ui = RENDER ? {} : {play: $('play'), reset: $('reset'), end: $('end'), replay: $('replay'), scrub: $('scrub'), clock: $('clock'),
    caption: $('film-caption'), status: $('status'), retry: $('retry'), jumps: Array.from(document.querySelectorAll('[data-jump]'))};
  let ready = false, current = 0, playing = false, raf = 0, base = 0, wall = 0, shownScene = -1;
  const sceneAt = t => SCENES.reduce((k, s, i) => (t >= s.start ? i : k), 0);
  function controls(on) {
    [ui.play, ui.reset, ui.end, ui.replay, ui.scrub, ...(ui.jumps || [])].forEach(el => { if (el) el.disabled = !on; });
  }
  function show(t) {
    if (!ui.clock) return;
    ui.scrub.value = t.toFixed(2);
    ui.clock.textContent = `${t.toFixed(2)} / ${DURATION.toFixed(2)} 秒`;
    const k = sceneAt(t);
    if (k !== shownScene) {
      shownScene = k;
      ui.caption.textContent = `${SCENES[k].start}–${SCENES[k].end}秒：${DESC[k]()}`;
      ui.jumps.forEach(b => b.setAttribute('aria-current', String(Number(b.dataset.jump) === SCENES[k].start)));
    }
  }
  window.seek = seconds => {
    const t = clamp(Number(seconds) || 0, 0, DURATION);
    if (!ready) return window.motionReady.then(() => window.seek(t));
    current = t; draw(t); show(t);
    return undefined;
  };
  function setPlaying(on) {
    if (RENDER || !ready) return;
    if (on && current >= DURATION - 0.01) window.seek(0);
    playing = on; cancelAnimationFrame(raf);
    ui.play.textContent = on ? '一時停止' : '再生';
    ui.play.setAttribute('aria-pressed', String(on));
    if (on) { base = current; wall = performance.now(); raf = requestAnimationFrame(tick); ui.status.textContent = '再生中（無音）'; }
    else ui.status.textContent = `一時停止：${current.toFixed(2)}秒`;
  }
  function tick(now) {
    if (!playing) return;
    const t = base + (now - wall) / 1000;
    if (t >= DURATION) { window.seek(DURATION); setPlaying(false); return; }
    window.seek(t); raf = requestAnimationFrame(tick);
  }
  function start() {
    ready = false; shownScene = -1; controls(false);
    if (ui.retry) ui.retry.hidden = true;
    if (ui.status) ui.status.textContent = '13件の保存素材を照合しています…';
    window.motionReady = load().then(f => {
      F = f; ready = true;
      window.seek(0);
      controls(true);
      if (ui.status) ui.status.textContent = '照合済み：固定ハッシュの素材一覧と13件の保存素材。32秒・無音。新しい取得やAIの実行はしません。';
    });
    window.motionReady.catch(err => {
      const m = err && err.message ? err.message : String(err);
      F = null; drawError(m); controls(false);
      if (ui.caption) ui.caption.textContent = '';
      if (ui.status) ui.status.textContent = 'エラー：' + m;
      if (ui.retry) ui.retry.hidden = false;
    });
  }
  if (!RENDER && ui.play) {
    ui.play.addEventListener('click', () => setPlaying(!playing));
    ui.reset.addEventListener('click', () => { setPlaying(false); window.seek(0); });
    ui.end.addEventListener('click', () => { setPlaying(false); window.seek(DURATION); });
    ui.replay.addEventListener('click', () => { window.seek(0); setPlaying(true); });
    ui.scrub.addEventListener('input', () => { window.seek(Number(ui.scrub.value)); if (playing) { base = current; wall = performance.now(); } });
    ui.jumps.forEach(b => b.addEventListener('click', () => { window.seek(Number(b.dataset.jump)); if (playing) { base = current; wall = performance.now(); } }));
    ui.retry.addEventListener('click', start);
  }
  start();
})();
