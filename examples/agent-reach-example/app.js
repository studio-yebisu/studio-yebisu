/* Agent Reach 作例：AIが情報を読むための、手順書と接続点検キット
   Copyright (c) 2026 Studio Yebisu. MIT License.
   concept/manifest.json を固定SHA-256で照合し、13素材のバイト数とSHA-256と内容を確かめてから図と読み出しを描く。
   このページは新しい取得・AIの実行・外部への通信をしない。 */
'use strict';
(() => {
  const PIN = 'c75b9b1a0d790f7698a083dbe0a4307e7584c3175a0ef6413e7474df30ed8c3c';
  const CASE = 'agent-reach-example';
  const COMMIT = '94f06c1969dfc1834001269d79d3ad0972d9dee6';
  const MEMO = {path: 'outputs/research-note.md', bytes: 7453, sha256: '98c07c4974d2e7383491a2747326061134d62e47884c75596f97cf9ca3cf3867'};
  const V = 'vendor/agent-reach/';
  const SKILL = V + 'agent_reach/skill/SKILL.md', DEV = V + 'agent_reach/skill/references/dev.md', SOCIAL = V + 'agent_reach/skill/references/social.md';
  const TWPY = V + 'agent_reach/channels/twitter.py', GHPY = V + 'agent_reach/channels/github.py', README = V + 'README.md';
  const PATHS = ['concept/structure.json', 'inputs/brief.json', 'outputs/collection.json', 'outputs/comparison.json', MEMO.path, 'request.txt',
    README, V + 'LICENSE', SKILL, DEV, SOCIAL, TWPY, GHPY];
  const BLOB = `https://github.com/Panniantong/Agent-Reach/blob/${COMMIT}/`;
  const THEME_KEY = 'studio-yebisu.agent-reach-example.theme';
  const ORDER = ['source', 'runtime', 'unknown'];
  const CAT = {source: '原典', runtime: '実取得', unknown: '未確認'};
  const ROUTE = {github: 'GitHub', twitter: 'X'};
  const STAGE = {parts: '中身', read: '読む', sort: 'まとめる'};

  // 原典の行の位置。本文は照合済みの実ファイルから切り出し、must の文字列があるかも確かめる。
  const EXCERPTS = {
    routing: {github: [[SKILL, 53, 53, 'GitHub/代码 | dev']], twitter: [[SKILL, 51, 51, '推特']]},
    reference: {github: [[DEV, 47, 49, 'gh api repos/owner/repo']], twitter: [[SOCIAL, 99, 100, 'twitter tweet URL_OR_ID']]},
    doctor: {
      github: [[SKILL, 32, 34, 'active_backend: null'], [GHPY, 137, 141, '因此未实时验证']],
      twitter: [[SKILL, 32, 34, 'active_backend: null'], [TWPY, 67, 71, 'self.active_backend = backend if status == "ok" else None']]
    }
  };
  const DESIGN = [README, 199, 201, '不负责底层读取本身'];

  // 図の配置（viewBox単位の x, y, 幅, 高さ）。縦長の画面と横長の画面で組み直す。
  const LAYOUT = {
    tall: {w: 360, h: 540,
      parts: {urlG: [8, 4, 166, 52], urlX: [186, 4, 166, 52], kit: [4, 64, 352, 262], book: [12, 74, 216, 190], gauge: [236, 74, 112, 190],
        tabRoute: [12, 268, 104, 52], tabRef: [120, 268, 108, 52], tabDoctor: [236, 268, 112, 52], task: [8, 336, 100, 48], reader: [124, 332, 112, 56],
        toolG: [12, 400, 160, 32], toolX: [188, 400, 160, 32], platG: [22, 440, 140, 24], platX: [198, 440, 140, 24],
        files: [12, 472, 160, 28], post: [188, 472, 160, 28], sort: [4, 506, 248, 30], memo: [264, 506, 92, 30]},
      read: {kit: [4, 4, 352, 166], book: [12, 12, 216, 94], gauge: [236, 12, 112, 94], tabRoute: [12, 112, 104, 52], tabRef: [120, 112, 108, 52], tabDoctor: [236, 112, 112, 52],
        task: [8, 182, 100, 44], reader: [124, 178, 112, 52], toolG: [12, 242, 160, 44], toolX: [188, 242, 160, 44], urlG: [12, 294, 160, 52], urlX: [188, 294, 160, 52],
        platG: [22, 354, 140, 32], platX: [198, 354, 140, 32], files: [12, 396, 160, 76], post: [188, 396, 160, 76], sort: [4, 484, 248, 48], memo: [264, 484, 92, 48]},
      sort: {kit: [4, 4, 352, 166], book: [12, 12, 216, 94], gauge: [236, 12, 112, 94], tabRoute: [12, 112, 104, 52], tabRef: [120, 112, 108, 52], tabDoctor: [236, 112, 112, 52],
        task: [124, 180, 112, 38], toolG: [12, 226, 160, 34], toolX: [188, 226, 160, 34], urlG: [12, 266, 160, 52], urlX: [188, 266, 160, 52],
        platG: [22, 326, 140, 26], platX: [198, 326, 140, 26], sort: [4, 362, 248, 174], files: [12, 370, 114, 36], post: [130, 370, 114, 36],
        reader: [12, 412, 232, 38], memo: [264, 362, 92, 174]}
    },
    wide: {w: 960, h: 420,
      parts: {task: [8, 8, 96, 52], urlG: [112, 8, 138, 52], urlX: [258, 8, 138, 52], kit: [4, 70, 392, 346], book: [12, 80, 252, 268], gauge: [272, 80, 116, 268],
        tabRoute: [12, 356, 124, 52], tabRef: [140, 356, 124, 52], tabDoctor: [272, 356, 116, 52], reader: [420, 8, 150, 56],
        toolG: [436, 90, 220, 36], toolX: [712, 90, 220, 36], platG: [456, 140, 180, 28], platX: [732, 140, 180, 28],
        files: [436, 182, 220, 36], post: [712, 182, 220, 36], sort: [420, 330, 360, 82], memo: [796, 330, 156, 82]},
      read: {toolG: [436, 80, 220, 48], toolX: [712, 80, 220, 48], urlG: [436, 140, 220, 52], urlX: [712, 140, 220, 52],
        platG: [456, 204, 180, 36], platX: [732, 204, 180, 36], files: [436, 252, 220, 84], post: [712, 252, 220, 84], sort: [420, 352, 360, 60], memo: [796, 352, 156, 60]},
      sort: {toolG: [436, 10, 220, 40], toolX: [712, 10, 220, 40], urlG: [436, 58, 220, 52], urlX: [712, 58, 220, 52], platG: [456, 118, 180, 30], platX: [732, 118, 180, 30],
        sort: [420, 160, 360, 252], files: [432, 170, 168, 40], post: [608, 170, 160, 40], reader: [432, 218, 336, 40], memo: [796, 160, 156, 252]}
    }
  };
  // 線。段階ごとに on（今の道筋）・base（つながりだけ）・ghost（これからの工程）。書いていない段階では消す。
  const LINKS = [
    {a: 'urlG', sa: 'b', b: 'book', sb: 't', fb: 0.35, route: 'github', on: {parts: 'on'}},
    {a: 'urlX', sa: 'b', b: 'book', sb: 't', fb: 0.75, route: 'twitter', on: {parts: 'on'}},
    {a: 'kit', sa: {tall: 'b', wide: 'r'}, fa: {wide: 0.05}, b: 'reader', sb: {tall: 't', wide: 'l'}, on: {parts: 'on', read: 'base'}},
    {a: 'reader', sa: 'b', b: 'toolG', sb: 't', route: 'github', on: {parts: 'ghost', read: 'on'}},
    {a: 'reader', sa: {tall: 'b', wide: 'r'}, b: 'toolX', sb: 't', route: 'twitter', on: {parts: 'ghost', read: 'on'}},
    {a: 'toolG', sa: 'b', b: 'platG', sb: 't', route: 'github', on: {parts: 'ghost', read: 'on', sort: 'base'}},
    {a: 'toolX', sa: 'b', b: 'platX', sb: 't', route: 'twitter', on: {parts: 'ghost', read: 'on', sort: 'base'}},
    {a: 'platG', sa: 'b', b: 'files', sb: 't', route: 'github', on: {parts: 'ghost', read: 'on', sort: 'on'}},
    {a: 'platX', sa: 'b', b: 'post', sb: 't', route: 'twitter', on: {parts: 'ghost', read: 'on', sort: 'on'}},
    {a: 'files', sa: 'b', b: 'sort', sb: 't', fb: 0.3, on: {parts: 'ghost', read: 'ghost'}},
    {a: 'post', sa: 'b', b: 'sort', sb: 't', fb: {tall: 0.8, wide: 0.7}, on: {parts: 'ghost', read: 'ghost'}},
    {a: 'sort', sa: 'r', b: 'memo', sb: 'l', on: {parts: 'ghost', read: 'ghost', sort: 'on'}}
  ];
  // 段階ごとの強調。1＝主役、0.7＝背景、それ以外は薄く。押せる部品は薄くしすぎない。
  const EMPH = {
    parts: {urlG: 1, urlX: 1, task: 1, kit: 1, book: 1, gauge: 1, tabRoute: 1, tabRef: 1, tabDoctor: 1, reader: 1},
    read: {urlG: 1, urlX: 1, reader: 1, toolG: 1, toolX: 1, platG: 1, platX: 1, files: 1, post: 1, gauge: 1, kit: 0.7, book: 0.7, task: 0.7, tabRoute: 0.7, tabRef: 0.7, tabDoctor: 0.7},
    sort: {files: 1, post: 1, reader: 1, sort: 1, memo: 1, urlG: 0.7, urlX: 0.7, platG: 0.7, platX: 0.7, gauge: 0.7, tabRoute: 0.7, tabRef: 0.7, tabDoctor: 0.7}
  };
  const BUTTONS = new Set(['urlG', 'urlX', 'tabRoute', 'tabRef', 'tabDoctor']);

  const $ = id => document.getElementById(id);
  const root = document.documentElement, map = $('map'), svg = map.querySelector('svg.links'), layer = $('link-layer');
  const OBJ = Object.fromEntries(Array.from(map.querySelectorAll('[data-o]'), el => [el.dataset.o, el]));
  const field = name => map.querySelector(`[data-f="${name}"]`);
  const wideMQ = matchMedia('(min-width: 1000px), (min-width: 700px) and (orientation: landscape)');
  const calmMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const state = {stage: 'parts', route: 'github', part: 'routing', layout: wideMQ.matches ? 'wide' : 'tall'};
  let M = null, shown = null, anim = 0, loading = 0;

  function el(tag, props = {}, kids = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') n.textContent = v; else if (k === 'className') n.className = v; else n.setAttribute(k, v);
    }
    for (const kid of [].concat(kids)) if (kid !== null && kid !== undefined) n.append(kid);
    return n;
  }
  const a = (href, text) => el('a', {href, text});
  const say = msg => { $('live').textContent = ''; requestAnimationFrame(() => { $('live').textContent = msg; }); };

  // ---------- 表示の色 ----------

  function setTheme(choice, save) {
    if (!['light', 'dark', 'system'].includes(choice)) choice = 'system';
    if (choice === 'system') root.removeAttribute('data-theme'); else root.dataset.theme = choice;
    document.querySelectorAll('[data-theme-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice)));
    if (save) { try { localStorage.setItem(THEME_KEY, choice); } catch { /* 保存できない環境では今回の表示だけ切り替える */ } }
  }
  let stored = 'system';
  try { stored = localStorage.getItem(THEME_KEY) || 'system'; } catch { /* 読めなければ端末の設定 */ }
  setTheme(stored, false);
  document.querySelectorAll('[data-theme-choice]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themeChoice, true)));

  // 旧ページの #source などの根拠カードへのリンクは、保存結果ビューアへ案内する。
  function legacy() {
    const h = location.hash.slice(1), box = $('legacy');
    const ok = ['source', 'runtime', 'unknown', 'all'].includes(h) || /^card-[a-z0-9-]+$/.test(h);
    box.hidden = !ok;
    if (ok) box.replaceChildren('根拠カードの一覧は保存結果ビューアへ移りました。', ' ', a(`desk.html#${h}`, `desk.html#${h} を開く`));
  }
  legacy();
  window.addEventListener('hashchange', legacy);

  // ---------- 照合 ----------

  const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  const utf8 = buf => new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(buf);
  const need = (ok, what) => { if (!ok) throw new Error(`保存データが図の説明と一致しません（${what}）。`); };
  async function bytes(path) {
    let res;
    try { res = await fetch(path, {cache: 'no-store'}); }
    catch { throw new Error(`${path} を読み込めませんでした。HTTPで配信したページを開いてください。`); }
    if (!res.ok) throw new Error(`${path} を読み込めませんでした（HTTP ${res.status}）。`);
    return res.arrayBuffer();
  }
  const sha = async buf => hex(await crypto.subtle.digest('SHA-256', buf));

  async function load() {
    need(window.crypto && crypto.subtle, 'SHA-256はHTTPSかlocalhostで使えます');
    const raw = await bytes('concept/manifest.json');
    need(await sha(raw) === PIN, 'concept/manifest.json の固定SHA-256');
    let man;
    try { man = JSON.parse(utf8(raw)); } catch { throw new Error('concept/manifest.json を読めません。'); }
    need(man.format === 'studio-yebisu-assets/v1' && man.case_id === CASE && man.source_commit === COMMIT, '素材一覧の形式');
    const files = Array.isArray(man.files) ? man.files : [];
    need(files.length === PATHS.length && PATHS.every(p => files.filter(f => f.path === p).length === 1), '素材一覧の13件');
    const text = {};
    await Promise.all(files.map(async f => {
      const buf = await bytes(f.path);
      if (buf.byteLength !== f.bytes || await sha(buf) !== f.sha256) throw new Error(`${f.path} のバイト数またはSHA-256が素材一覧と一致しません。`);
      try { text[f.path] = utf8(buf); } catch { throw new Error(`${f.path} がUTF-8として読めません。`); }
    }));
    return model(text, files);
  }

  function model(text, files) {
    const json = p => { try { return JSON.parse(text[p]); } catch { throw new Error(`${p} をJSONとして読めません。`); } };
    const lines = p => text[p].split(/\r?\n/);
    const st = json('concept/structure.json'), brief = json('inputs/brief.json'), col = json('outputs/collection.json'), cmp = json('outputs/comparison.json');
    const memo = files.find(f => f.path === MEMO.path);
    need(memo.bytes === MEMO.bytes && memo.sha256 === MEMO.sha256, 'research-note.md の期待値');
    need(st.format === 'agent-reach-structure/v1' && st.case_id === CASE && st.source_commit === COMMIT, 'structure.json');
    const parts = st.parts || [], routes = st.routes || [];
    need(parts.length === 3 && ['routing', 'reference', 'doctor'].every((id, i) => parts[i].id === id), '3つの部品ID');
    need(['経路表', '分野別手順', '接続点検'].every((l, i) => parts[i].label === l), '3つの部品名');
    for (const p of parts) need(PATHS.includes(p.source_path) && (lines(p.source_path)[p.line_start - 1] || '').includes(p.quote), `${p.label}の引用`);
    need(routes.length === 2 && routes[0].id === 'github' && routes[1].id === 'twitter', '2つの経路ID');
    need(routes[0].reference === 'references/dev.md' && routes[1].reference === 'references/social.md', '経路の分野別手順');
    need(routes.every(r => r.status === 'warn' && r.active_backend === null && PATHS.includes(r.source_path)) && routes[0].files === 6 && routes[1].posts === 1, '経路の点検と件数');
    need(brief.repository === 'Panniantong/Agent-Reach' && brief.commit === COMMIT && /^https:\/\/x\.com\/[^/]+\/status\/\d+$/.test(brief.post_url), 'brief.json の固定版と投稿URL');
    const d = col.doctor || {};
    need(['github', 'twitter'].every(k => d[k] && d[k].status === 'warn' && d[k].active_backend === null), 'doctorはwarn・null');
    const ex = Array.isArray(col.executions) ? col.executions : [];
    need(ex.length > 0 && ex.every(e => e.exit_code === 0 && Array.isArray(e.command)), '終了コード');
    const gh = ex.filter(e => e.command[0] === 'gh'), tw = ex.filter(e => e.command[0] === 'twitter');
    const got = gh.map(e => /\/contents\/(.+)\?ref=([0-9a-f]{40})$/.exec(e.command[2] || '')).filter(Boolean);
    need(gh.length === 8 && tw.length === 1 && got.length === 6 && got.every(m => m[2] === COMMIT), 'gh api 8回・twitter 1回');
    const repo = col.repository || {};
    need(repo.name === brief.repository && repo.commit === COMMIT && repo.files_verified === 6 && repo.license === 'MIT' && repo.copyright === '2025 Agent Eyes', '原典6ファイルとライセンス');
    const post = col.post || {};
    need(post.url === brief.post_url && brief.post_url.endsWith('/' + post.id) && post.returned_target_posts === 1 && post.body_present === true && post.body_republished === false, '投稿1件');
    need(String(col.collected_at).startsWith('2026-10-15'), '記録日');
    const ver = s => (/\d+\.\d+\.\d+/.exec(String(s || '')) || [''])[0];
    const vers = col.versions || {};
    need(ver(vers.gh_version) === '2.96.0' && vers.twitter_cli === '0.8.5', 'CLIの版');
    const items = Array.isArray(cmp.items) ? cmp.items : [];
    const count = {source: 0, runtime: 0, unknown: 0};
    items.forEach(i => { if (i.category in count) count[i.category]++; });
    need(items.length === 8 && cmp.source_commit === COMMIT && count.source === 3 && count.runtime === 3 && count.unknown === 2 && ORDER.every(c => st.evidence_counts[c] === count[c]), '根拠8枚（3・3・2）');
    const table = lines(SKILL).slice(49, 56).map(l => l.split('|').map(s => s.trim())).filter(c => c.length >= 4);
    const row = c => table.find(x => x[2] === c);
    need(table.length === 7 && row('dev') && row('social'), 'SKILL.mdの経路表');
    need(text['request.txt'].includes(COMMIT), 'request.txt の固定版');
    const memoTitle = (lines(MEMO.path)[0] || '').replace(/^# /, '');
    need(memoTitle.startsWith('Agent Reach'), 'メモの見出し');
    const excerpt = ([path, from, to, must]) => {
      const body = lines(path).slice(from - 1, to).join('\n');
      need(body.includes(must), `${path} L${from} の原典`);
      const name = path.slice(V.length);
      return {path, name, from, to, body, remote: `${BLOB}${name}#L${from}${to > from ? '-L' + to : ''}`};
    };
    const ex2 = {};
    for (const [part, byRoute] of Object.entries(EXCERPTS)) ex2[part] = {github: byRoute.github.map(excerpt), twitter: byRoute.twitter.map(excerpt)};
    return {
      st, brief, col, cmp, files, request: text['request.txt'],
      parts: Object.fromEntries(parts.map(p => [p.id, p])),
      routes: {github: routes[0], twitter: routes[1]},
      rows: {github: row('dev'), twitter: row('social')}, others: table.map(x => x[2]).filter(c => c !== 'dev' && c !== 'social'),
      refs: {github: excerpt([DEV, 49, 49, 'gh api']).body.trim(), twitter: excerpt([SOCIAL, 100, 100, 'twitter tweet']).body.trim()},
      ex: ex2, design: excerpt(DESIGN), gh, tw, got: got.map(m => m[1]), post, count, items,
      ghVer: ver(vers.gh_version), twVer: vers.twitter_cli, date: String(col.collected_at).slice(0, 10), memoTitle
    };
  }

  // ---------- 図 ----------

  const pct = (v, total) => `${(v / total * 100).toFixed(3)}%`;
  const pick = v => (v && typeof v === 'object' ? v[state.layout] : v);
  const rectsFor = stage => ({...LAYOUT[state.layout].parts, ...LAYOUT[state.layout][stage]});
  function side(r, s, f = 0.5) {
    const [x, y, w, h] = r;
    if (s === 't') return {x: x + w * f, y, dx: 0, dy: -1};
    if (s === 'b') return {x: x + w * f, y: y + h, dx: 0, dy: 1};
    if (s === 'l') return {x, y: y + h * f, dx: -1, dy: 0};
    return {x: x + w, y: y + h * f, dx: 1, dy: 0};
  }
  function curve(p, q) {
    const k = Math.max(10, Math.hypot(q.x - p.x, q.y - p.y) * 0.42);
    return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}C${(p.x + p.dx * k).toFixed(1)} ${(p.y + p.dy * k).toFixed(1)} ${(q.x + q.dx * k).toFixed(1)} ${(q.y + q.dy * k).toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }
  const paths = LINKS.map(() => layer.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path')));
  function linkClass(l) {
    let c = l.on[state.stage] || 'hide';
    if (c === 'on' && l.route && l.route !== state.route && state.stage !== 'sort') c = 'base';
    return c;
  }
  function drawLinks(rects) {
    LINKS.forEach((l, i) => {
      paths[i].setAttribute('d', curve(side(rects[l.a], pick(l.sa), pick(l.fa) ?? 0.5), side(rects[l.b], pick(l.sb), pick(l.fb) ?? 0.5)));
    });
  }
  function moveLinks(from, to, animate) {
    cancelAnimationFrame(anim);
    if (!animate || calmMQ.matches || !from) { drawLinks(to); return; }
    const t0 = performance.now(), out = p => 1 - Math.pow(1 - p, 3);
    const step = now => {
      const p = out(Math.min(1, (now - t0) / 550)), mid = {};
      for (const id in to) mid[id] = to[id].map((v, k) => from[id][k] + (v - from[id][k]) * p);
      drawLinks(mid);
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function layout(animate) {
    const L = LAYOUT[state.layout], to = rectsFor(state.stage);
    map.dataset.layout = state.layout;
    map.dataset.stage = state.stage;
    svg.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);
    for (const [id, [x, y, w, h]] of Object.entries(to)) {
      const s = OBJ[id].style;
      s.left = pct(x, L.w); s.top = pct(y, L.h); s.width = pct(w, L.w); s.height = pct(h, L.h);
    }
    moveLinks(shown, to, animate);
    shown = to;
  }
  function relayout() {
    state.layout = wideMQ.matches ? 'wide' : 'tall';
    shown = null;
    map.classList.add('instant');
    layout(false);
    void map.offsetWidth;
    map.classList.remove('instant');
  }
  (wideMQ.addEventListener ? wideMQ.addEventListener.bind(wideMQ, 'change') : wideMQ.addListener.bind(wideMQ))(relayout);

  // ---------- 静的な中身（照合済みデータから） ----------

  function fill() {
    const set = (name, value) => { field(name).textContent = value; };
    set('repo', M.brief.repository);
    set('post', 'status/' + M.post.id);
    field('rows').replaceChildren(
      ...['github', 'twitter'].map(r => el('li', {className: 'row', 'data-route': r, title: M.rows[r][1]}, [el('span', {className: 'in', text: r === 'github' ? 'GitHub' : 'Xなど'}), el('span', {className: 'to', text: '→ ' + M.rows[r][2]})])),
      el('li', {className: 'row ghost', text: `${M.others.join('・')}（今回は未使用）`}));
    field('refs').replaceChildren(...['github', 'twitter'].map(r => el('li', {className: 'ref', 'data-route': r}, [el('b', {text: M.routes[r].reference.split('/').pop()}), el('code', {text: M.refs[r]})])));
    set('doctor', `GitHub・X：${M.col.doctor.github.status}`);
    set('backend', `active_backend: ${String(M.col.doctor.github.active_backend)}`);
    set('ghVer', 'gh ' + M.ghVer); set('twVer', 'v' + M.twVer);
    set('warnG', 'doctor ' + M.col.doctor.github.status); set('warnX', 'doctor ' + M.col.doctor.twitter.status);
    set('srcG', M.routes.github.source); set('srcX', M.routes.twitter.source);
    field('sheets').replaceChildren(...M.got.map(() => el('i')));
    set('filesLabel', `原典${M.got.length}ファイル`);
    set('names', M.got.map(p => p.split('/').pop()).join('・'));
    set('postLabel', `投稿の記録${M.post.returned_target_posts}件`);
    set('postSub', 'ID一致・本文は非掲載');
    field('bins').replaceChildren(...ORDER.map(c => el('div', {className: `bin bin-${c}`}, [
      el('span', {className: 'bh'}, [el('b', {text: CAT[c]}), el('span', {className: 'n', text: String(M.count[c])})]),
      el('span', {className: 'cards', 'aria-hidden': 'true'}, M.items.filter(i => i.category === c).map(() => el('i')))])));
    set('memoName', MEMO.path.split('/').pop());
    set('memoTitle', M.memoTitle.split('：')[0]);
    field('memoTabs').replaceChildren(...ORDER.map(c => el('span', {className: `mtab mtab-${c}`, text: `${CAT[c]}${M.count[c]}`})));

    const memoLink = $('memo-dl');
    memoLink.href = MEMO.path;
    memoLink.removeAttribute('aria-disabled');

    $('how-note').textContent = `${M.st.workflow.general} ${M.st.workflow.memo}`;
    $('sorted-intro').textContent = M.cmp.summary;
    $('sorted').replaceChildren(...ORDER.map(c => el('section', {className: `group group-${c}`, 'aria-label': `${CAT[c]} ${M.count[c]}件`}, [
      el('h3', {text: `${CAT[c]} ${M.count[c]}件`}),
      el('ul', {}, M.items.filter(i => i.category === c).map(i => el('li', {}, a(`desk.html#card-${i.id}`, i.label))))])));
    $('request').textContent = M.request;
    $('copy').disabled = false;
    details();
  }
  function dl(pairs) {
    return el('dl', {className: 'facts'}, pairs.flatMap(([k, v]) => [el('dt', {text: k}), el('dd', {}, v)]));
  }
  function details() {
    const b = M.brief, c = M.col;
    $('d-brief').replaceChildren(dl([
      ['目的', b.purpose], ['リポジトリ', a(`https://github.com/${b.repository}/tree/${b.commit}`, `${b.repository} @ ${b.commit.slice(0, 7)}`)],
      ['紹介投稿（第三者）', a(b.post_url, b.post_url)], ['範囲', el('ul', {}, b.scope.map(s => el('li', {text: s})))],
      ['未確認として扱うこと', el('ul', {}, b.unknowns.map(s => el('li', {text: s})))]
    ]), el('p', {}, a('inputs/brief.json', 'inputs/brief.json を開く')));
    $('d-collection').replaceChildren(
      el('p', {text: `記録：${c.collected_at}（制作担当が実行）。時刻は記録用で、速度の測定ではありません。`}),
      el('ol', {className: 'runs'}, c.executions.map(e => el('li', {}, [el('code', {text: e.command.join(' ')}), ` 終了コード ${e.exit_code}`]))),
      dl([['Agent Reach（実行した原典）', c.versions.executed_agent_reach_source], ['gh', c.versions.gh_version], ['twitter-cli', c.versions.twitter_cli], ['Python', c.versions.python]]),
      el('p', {text: c.credential_handling}), el('p', {text: c.warning}),
      el('p', {}, a('outputs/collection.json', 'outputs/collection.json を開く')));
    $('d-compare').replaceChildren(el('p', {text: M.cmp.scope_note}),
      el('p', {}, [a('outputs/comparison.json', 'outputs/comparison.json'), ' · ', a(MEMO.path, 'research-note.md（日本語の根拠メモ）'), ' · ', a('desk.html#all', '保存結果ビューア')]));
    $('d-scope').replaceChildren(el('ul', {}, [...M.st.not_exercised, ...c.unverified].map(s => el('li', {text: s}))));
    $('d-auth').replaceChildren(el('p', {text: M.st.credential_scope}), el('p', {text: M.st.attribution}), el('p', {text: M.st.workflow.actual}));
    $('d-assets').replaceChildren(el('p', {text: `素材一覧 concept/manifest.json（SHA-256 ${PIN}）を照合し、次の${M.files.length}件のバイト数とSHA-256を確かめました。`}),
      el('ul', {className: 'assets'}, M.files.map(f => el('li', {}, [a(f.path, f.path), ` ${f.bytes.toLocaleString('en-US')} bytes · `, el('code', {text: f.sha256.slice(0, 16) + '…'})]))));
  }

  // ---------- 選択と読み出し ----------

  const STAGE_NOTE = {
    parts: () => '何を、どの道具で読むか。経路表と分野別手順をAIが読み、点検はdoctor（CLI）が別に行います。',
    read: () => `既存のCLIが直接読みます。Agent Reachは中継しません。今回の取得：制作担当（${M.date}の保存記録）。`,
    sort: () => `整理は、取得のあと。保存結果の整理：AI。原典${M.count.source}・実取得${M.count.runtime}・未確認${M.count.unknown}に分けてメモへ。`
  };
  const ROLE = {parts: ['AI', '手順書を読む'], read: ['制作担当', '今回の取得'], sort: ['AI', '保存結果を整理']};

  function excerptBlock(x) {
    return el('details', {className: 'src'}, [
      el('summary', {text: `原典の該当行：${x.name} L${x.from}${x.to > x.from ? '–' + x.to : ''}`}),
      el('pre', {}, el('code', {text: x.body})),
      el('p', {}, [a(x.remote, '固定版をGitHubで開く'), ' · ', a(x.path, '同梱ファイル')])
    ]);
  }
  function routeReadout() {
    const r = state.route, rt = M.routes[r], doc = M.col.doctor[r];
    $('ro-route-h').textContent = `経路：${ROUTE[r]}`;
    const cmds = (r === 'github' ? M.gh : M.tw).map(e => e.command.join(' '));
    const result = r === 'github'
      ? `原典${M.got.length}ファイル（${M.got.map(p => p.split('/').pop()).join('・')}）。${M.gh.length}回の呼び出しはすべて終了コード0`
      : `対象の公開投稿${M.post.returned_target_posts}件の記録（ID ${M.post.id}・本文あり）。本文・返信・数値・画像は掲載しません`;
    $('ro-route').replaceChildren(...[
      ['経路表の行', `${M.rows[r][1]} → ${M.rows[r][2]}`],
      ['分野別手順', `${rt.reference}：${M.refs[r]}`],
      ['使った道具', r === 'github' ? `gh api（gh ${M.ghVer}）` : `twitter-cli ${M.twVer}`],
      ['今回の取得', `制作担当が実行（${M.date}の保存記録）`],
      ['戻った材料', result],
      ['接続点検', `${doc.status}／active_backend: ${String(doc.active_backend)}（候補：${doc.backends.join('・')}）。後の取得が成功しても書き換えていません`]
    ].flatMap(([k, v]) => [el('dt', {text: k}), el('dd', {text: v})]));
    $('ro-route-more').replaceChildren(...[
      el('details', {className: 'src'}, [el('summary', {text: `実行したコマンド（${cmds.length}件）`}), el('pre', {}, el('code', {text: cmds.join('\n')}))]),
      r === 'twitter' ? el('p', {className: 'note', text: M.st.credential_scope}) : null,
      el('p', {className: 'note'}, [a(M.ex.reference[r][0].path, rt.reference + '（同梱）'), ' · ', a(M.ex.reference[r][0].remote, '固定版の該当行')])].filter(Boolean));
  }
  function partReadout() {
    const p = M.parts[state.part];
    $('ro-part-h').textContent = `部品：${p.label}`;
    const kids = [
      el('p', {className: 'meaning', text: p.meaning}),
      el('p', {className: 'note', text: `今回：${p.applied}`}),
      ...M.ex[state.part][state.route].map(excerptBlock)
    ];
    if (state.part === 'doctor') kids.push(el('p', {className: 'note', text: M.st.attribution}));
    if (state.part === 'routing') kids.push(excerptBlock(M.design));
    $('ro-part').replaceChildren(...kids);
  }
  function update(animate, announce) {
    layout(animate);
    for (const [id, node] of Object.entries(OBJ)) {
      const e = EMPH[state.stage][id];
      node.classList.toggle('dim', !e && !BUTTONS.has(id));
      node.classList.toggle('faint', e === 0.7 || (!e && BUTTONS.has(id)));
    }
    // まとめる段階では、選んだ経路に関係なく原典と投稿の記録の両方が整理へ入る。
    const both = new Set(['files', 'post', 'platG', 'platX']);
    map.querySelectorAll('[data-route]').forEach(n => {
      n.classList.toggle('on', n.dataset.route === state.route || (state.stage === 'sort' && both.has(n.dataset.o)));
      if (n.matches('.chip')) n.setAttribute('aria-pressed', String(n.dataset.route === state.route));
    });
    map.querySelectorAll('[data-part]').forEach(n => {
      n.classList.toggle('sel', n.dataset.part === state.part);
      if (n.matches('button')) n.setAttribute('aria-pressed', String(n.dataset.part === state.part));
    });
    document.querySelectorAll('[data-stage]').forEach(b => { if (b.matches('button')) b.setAttribute('aria-pressed', String(b.dataset.stage === state.stage)); });
    LINKS.forEach((l, i) => {
      const c = linkClass(l);
      paths[i].setAttribute('class', `ln ${c}`);
      paths[i].setAttribute('marker-end', c === 'on' ? 'url(#ah-on)' : c === 'base' ? 'url(#ah)' : '');
    });
    const [role, sub] = ROLE[state.stage];
    field('role').textContent = role; field('roleSub').textContent = sub;
    $('stage-note').textContent = STAGE_NOTE[state.stage]();
    routeReadout(); partReadout();
    if (announce) say(announce);
  }
  function choose(key, value) {
    if (!M || state[key] === value) return;
    state[key] = value;
    const msg = key === 'stage' ? `段階「${STAGE[value]}」：${STAGE_NOTE[value]()}`
      : key === 'route' ? `経路：${ROUTE[value]}（${M.routes[value].reference}・${M.routes[value].tool}）`
        : `部品：${M.parts[value].label}。${M.parts[value].meaning}`;
    update(key === 'stage', msg);
  }
  document.querySelectorAll('button[data-stage]').forEach(b => b.addEventListener('click', () => choose('stage', b.dataset.stage)));
  map.querySelectorAll('button.chip').forEach(b => b.addEventListener('click', () => choose('route', b.dataset.route)));
  map.querySelectorAll('button.tab').forEach(b => b.addEventListener('click', () => choose('part', b.dataset.part)));

  $('copy').addEventListener('click', async () => {
    if (!M) return;
    try {
      await navigator.clipboard.writeText(M.request);
      $('copy-status').textContent = '依頼文をコピーしました。';
    } catch {
      const range = document.createRange();
      range.selectNodeContents($('request'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      $('copy-status').textContent = 'コピーできませんでした。下の依頼文を選択したので、端末の操作でコピーしてください。';
    }
  });

  // ---------- 読み込み・失敗・再試行 ----------

  function controls(on) {
    document.querySelectorAll('button[data-stage], #map button.chip, #map button.tab').forEach(b => { b.disabled = !on; });
  }
  function clear() {
    M = null;
    controls(false);
    $('copy').disabled = true;
    const memoLink = $('memo-dl');
    memoLink.removeAttribute('href');
    memoLink.setAttribute('aria-disabled', 'true');
    map.querySelectorAll('[data-f]').forEach(n => n.replaceChildren());
    ['ro-route', 'ro-route-more', 'ro-part', 'ro-route-h', 'ro-part-h', 'sorted', 'sorted-intro', 'how-note', 'request', 'copy-status',
      'd-brief', 'd-collection', 'd-compare', 'd-scope', 'd-auth', 'd-assets', 'stage-note'].forEach(id => $(id).replaceChildren());
    layer.querySelectorAll('path').forEach(p => p.setAttribute('d', ''));
    $('readout').hidden = true;
  }
  async function start() {
    const run = ++loading;
    clear();
    map.dataset.state = 'loading';
    $('fail').hidden = true; $('load').hidden = false;
    try {
      const m = await load();
      if (run !== loading) return;
      M = m;
      fill();
      map.dataset.state = 'ready';
      $('load').hidden = true;
      $('readout').hidden = false;
      controls(true);
      shown = null;
      update(false);
    } catch (err) {
      if (run !== loading) return;
      clear();
      map.dataset.state = 'error';
      $('load').hidden = true;
      $('fail-msg').textContent = err && err.message ? err.message : String(err);
      $('fail').hidden = false;
    }
  }
  $('retry').addEventListener('click', start);
  relayout();
  start();
})();
