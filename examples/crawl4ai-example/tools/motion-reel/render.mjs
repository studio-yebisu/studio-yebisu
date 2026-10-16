import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {synthesizeWav} from './audio.mjs';

const HELP = `node render.mjs --project <folder> --out <empty-folder> [options]
Default: representative stills, contact sheet, poster, HTML review, determinism check.
--video              Render frames 0..ceil(duration*fps)-1 and encode video.mp4.
--width N --height N Native layout dimensions (positive even pixels).
--fps N              Integer frame rate (1..120).
--step N             Representative still interval in seconds (default 0.5).
--strip-at N         Also capture 12 consecutive frames around second N.
--audio <file>       Use a supplied audio file; pad/trim to the video duration.
--synth              Synthesize original cues from motionConfig.audioEvents.
--lufs N             Audio loudness target (default -16; range -30..-5).
--chrome <path>      Chrome executable; default installed Chrome channel.
--chromium           Use an already-installed Playwright Chromium.
Output is never overwritten. Downloads, remote assets, and publication are not performed.`;
const argv = process.argv.slice(2);
if (argv.includes('--help')) { console.log(HELP); process.exit(0); }
const values = new Set(['--project', '--out', '--width', '--height', '--fps', '--step', '--strip-at', '--audio', '--lufs', '--chrome']);
const switches = new Set(['--video', '--synth', '--chromium']);
const options = {};
for (let i = 0; i < argv.length; i++) {
  const key = argv[i];
  if (Object.hasOwn(options, key)) throw new Error('Duplicate option: ' + key);
  if (switches.has(key)) options[key] = true;
  else if (values.has(key) && argv[i + 1] && !argv[i + 1].startsWith('--')) options[key] = argv[++i];
  else throw new Error('Unknown option or missing value: ' + key + '\n' + HELP);
}
if (!options['--project'] || !options['--out']) throw new Error(HELP);
if (options['--audio'] && options['--synth']) throw new Error('Choose --audio or --synth');
if ((options['--audio'] || options['--synth']) && !options['--video']) throw new Error('Audio requires --video');
if (options['--chrome'] && options['--chromium']) throw new Error('Choose --chrome or --chromium');
const project = await fs.realpath(path.resolve(options['--project']));
await fs.access(path.join(project, 'index.html'));
const out = path.resolve(options['--out']);
if (out === project) throw new Error('Output must be a separate empty folder');
const existing = await fs.readdir(out).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
if (existing.length) throw new Error('Output folder is not empty: ' + out);
const numeric = (key, fallback) => {
  const result = options[key] === undefined ? fallback : Number(options[key]);
  if (!Number.isFinite(result)) throw new Error('Invalid number: ' + key);
  return result;
};
const overrides = {};
for (const key of ['width', 'height', 'fps']) if (options['--' + key]) overrides[key] = numeric('--' + key);
const step = numeric('--step', 0.5), lufs = numeric('--lufs', -16);
if (step < 0.05 || step > 60 || lufs < -30 || lufs > -5) throw new Error('Invalid --step or --lufs range');
const stripAt = options['--strip-at'] === undefined ? null : numeric('--strip-at');
if (stripAt !== null && stripAt < 0) throw new Error('Strip time must be nonnegative');
const audioSource = options['--audio'] ? await fs.realpath(path.resolve(options['--audio'])) : null;
function command(program, args) {
  const result = spawnSync(program, args, {encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024});
  if (result.error || result.status !== 0) throw new Error(program + ': ' + (result.error?.message || result.stderr || result.stdout));
  return result.stdout;
}
command('ffmpeg', ['-version']); command('ffprobe', ['-version']);
await fs.mkdir(out, {recursive: true});
const errors = [], blocked = [];
const contentTypes = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.wav': 'audio/wav'};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    if (relative.split(/[\\/]/).some(part => part.startsWith('.') || ['node_modules', 'out', 'reviews'].includes(part))) throw new Error('Not served');
    const file = await fs.realpath(path.resolve(project, relative));
    if (!file.startsWith(project + path.sep)) throw new Error('Outside project');
    const bytes = await fs.readFile(file);
    res.writeHead(200, {'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'}); res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
let browser;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pad = n => String(n).padStart(6, '0');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({headless: true, ...(options['--chrome'] ? {executablePath: path.resolve(options['--chrome'])} : options['--chromium'] ? {} : {channel: 'chrome'})});
  async function prepare(viewport) {
    const page = await browser.newPage({viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block'});
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push('HTTP ' + response.status() + ': ' + response.url()); });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) { blocked.push(url.href); return route.abort(); }
      return route.continue();
    });
    await page.addInitScript(config => { window.__MOTION_RENDER__ = true; window.renderConfig = config; }, overrides);
    await page.goto(origin + '/index.html?render=1', {waitUntil: 'networkidle'});
    await page.evaluate(async () => {
      if (typeof window.seek !== 'function' || !window.motionConfig) throw new Error('Missing seek or motionConfig');
      await window.motionReady; await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
    });
    return page;
  }
  let page = await prepare({width: overrides.width || 960, height: overrides.height || 600});
  const meta = await page.evaluate(() => window.motionConfig);
  const config = {...meta, ...overrides};
  for (const key of ['width', 'height']) if (!Number.isInteger(config[key]) || config[key] < 16 || config[key] > 4096 || config[key] % 2) throw new Error('Invalid even dimension: ' + key);
  if (!Number.isInteger(config.fps) || config.fps < 1 || config.fps > 120 || !Number.isFinite(config.duration) || config.duration <= 0 || config.duration > 600) throw new Error('Invalid fps or duration');
  const count = Math.ceil(config.duration * config.fps);
  if (Math.abs(count / config.fps - config.duration) > 1e-7) throw new Error('duration * fps must be an integer to align video and audio');
  if (Math.ceil(config.duration / step) > 64) throw new Error('Contact sheet exceeds 64 stills. Increase --step for this duration.');
  if (stripAt !== null && stripAt >= config.duration) throw new Error('--strip-at is outside the clip');
  // Reload at the actual composition size so viewport-dependent initialization agrees.
  await page.close(); page = await prepare({width: config.width, height: config.height});
  const actualConfig = await page.evaluate(() => window.motionConfig);
  for (const key of ['width', 'height', 'fps']) if (actualConfig[key] !== config[key]) throw new Error('Composition must honor window.renderConfig.' + key);
  async function paint(target, seconds) {
    await target.evaluate(async t => { await window.seek(t); }, seconds);
    const status = await target.evaluate(() => ({running: document.getAnimations().filter(a => a.playState === 'running').length, overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight}));
    if (status.running || status.overflow || errors.length || blocked.length) throw new Error(JSON.stringify({status, errors, blocked}));
    return target.screenshot({animations: 'allow', caret: 'hide'});
  }
  const probeFrame = Math.min(count - 1, Math.floor(count * 0.6)), probeTime = probeFrame / config.fps;
  const first = await paint(page, probeTime);
  await paint(page, (count - 1) / config.fps); await paint(page, 0);
  const revisit = await paint(page, probeTime);
  const fresh = await prepare({width: config.width, height: config.height});
  const freshFrame = await paint(fresh, probeTime); await fresh.close();
  const determinism = {frame: probeFrame, seconds: probeTime, first: sha(first), afterOtherTimes: sha(revisit), freshPage: sha(freshFrame)};
  determinism.match = determinism.first === determinism.afterOtherTimes && determinism.first === determinism.freshPage;
  if (!determinism.match) throw new Error('Frame depends on call order or page initialization: ' + JSON.stringify(determinism));
  const stills = [], stillFolder = path.join(out, 'stills');
  await fs.mkdir(stillFolder);
  for (let t = 0, i = 0; t < config.duration - 1e-7; t = ++i * step) {
    const file = 'stills/frame-' + pad(i) + '.png';
    await fs.writeFile(path.join(out, file), await paint(page, t), {flag: 'wx'}); stills.push({file, seconds: t});
  }
  const scaledHeight = Math.round(360 * config.height / config.width);
  command('ffmpeg', ['-n', '-v', 'error', '-framerate', '1', '-i', path.join(stillFolder, 'frame-%06d.png'), '-vf', 'scale=360:' + scaledHeight + ',tile=4x' + Math.ceil(stills.length / 4) + ':padding=8:margin=8:color=0x172322', '-frames:v', '1', path.join(out, 'contact.png')]);
  const posterTime = Math.max(0, Math.min((count - 1) / config.fps, Number.isFinite(config.posterTime) ? config.posterTime : probeTime));
  await fs.writeFile(path.join(out, 'poster.png'), await paint(page, posterTime), {flag: 'wx'});
  const strip = [];
  if (stripAt !== null) {
    const stripFolder = path.join(out, 'strip'); await fs.mkdir(stripFolder);
    const start = Math.max(0, Math.min(count - 12, Math.floor(stripAt * config.fps) - 6));
    for (let i = 0; i < Math.min(12, count); i++) {
      const frame = start + i, file = 'strip/frame-' + pad(i) + '.png';
      await fs.writeFile(path.join(out, file), await paint(page, frame / config.fps), {flag: 'wx'}); strip.push({file, frame, seconds: frame / config.fps});
    }
    command('ffmpeg', ['-n', '-v', 'error', '-framerate', '1', '-i', path.join(stripFolder, 'frame-%06d.png'), '-vf', 'scale=240:-1,tile=6x2:padding=8:margin=8:color=0x172322', '-frames:v', '1', path.join(out, 'strip.png')]);
  }
  let audio = null, video = null;
  if (options['--video']) {
    const frames = path.join(out, 'frames'); await fs.mkdir(frames);
    for (let frame = 0; frame < count; frame++) {
      await fs.writeFile(path.join(frames, 'frame-' + pad(frame) + '.png'), await paint(page, frame / config.fps), {flag: 'wx'});
      if (frame % config.fps === 0) console.log('Rendered ' + frame + '/' + count);
    }
    let audioFile = audioSource;
    if (options['--synth']) { audioFile = path.join(out, 'cues.wav'); audio = {kind: 'synthesized_cues', ...await synthesizeWav(config, audioFile)}; }
    if (audioSource) audio = {kind: 'supplied_track', filename: path.basename(audioSource), sha256: sha(await fs.readFile(audioSource))};
    const ffargs = ['-n', '-v', 'error', '-framerate', String(config.fps), '-i', path.join(frames, 'frame-%06d.png')];
    if (audioFile) ffargs.push('-i', audioFile);
    ffargs.push('-map', '0:v:0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart');
    if (audioFile) ffargs.push('-map', '1:a:0', '-af', 'apad,atrim=duration=' + config.duration + ',asetpts=N/SR/TB,loudnorm=I=' + lufs + ':TP=-1.5:LRA=11,aresample=48000', '-c:a', 'aac', '-b:a', '160k');
    else ffargs.push('-an');
    ffargs.push('-t', String(config.duration), path.join(out, 'video.mp4')); command('ffmpeg', ffargs);
    const probe = JSON.parse(command('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path.join(out, 'video.mp4')]));
    const stream = probe.streams.find(s => s.codec_type === 'video');
    const audioStream = probe.streams.find(s => s.codec_type === 'audio');
    if (stream.width !== config.width || stream.height !== config.height || Number(stream.nb_frames) !== count || Math.abs(Number(probe.format.duration) - config.duration) > 1 / config.fps || Boolean(audioFile) !== Boolean(audioStream)) throw new Error('Export metadata does not match the composition');
    video = {file: 'video.mp4', sha256: sha(await fs.readFile(path.join(out, 'video.mp4'))), width: stream.width, height: stream.height, fps: config.fps, frameCount: Number(stream.nb_frames), duration: Number(probe.format.duration), hasAudio: Boolean(audioStream)};
    command('ffmpeg', ['-v', 'error', '-i', path.join(out, 'video.mp4'), '-f', 'null', '-']);
    if (audio) {
      const result = spawnSync('ffmpeg', ['-v', 'info', '-i', path.join(out, 'video.mp4'), '-vn', '-af', 'loudnorm=I=' + lufs + ':TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], {encoding: 'utf8', windowsHide: true});
      if (result.error || result.status !== 0) throw new Error('Audio measurement failed');
      const match = result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
      audio = {...audio, targetLufs: lufs, measured: match ? JSON.parse(match[0]) : null, listeningReview: 'not_performed_by_renderer'};
    }
  }
  const manifest = {schemaVersion: 1, generatedAt: new Date().toISOString(), browserVersion: browser.version(), config, determinism, stills, strip, posterTime, video, audio, errors, blockedExternalRequests: blocked, visualReview: 'required'};
  await fs.writeFile(path.join(out, 'capture.json'), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
  const figures = stills.map(s => '<figure><img src="' + s.file + '" alt="Frame at ' + s.seconds.toFixed(2) + ' seconds"><figcaption>' + s.seconds.toFixed(2) + 's</figcaption></figure>').join('\n');
  const stripFigures = strip.map(s => '<figure><img src="' + s.file + '" alt="Frame ' + s.frame + '"><figcaption>' + s.frame + 'f / ' + s.seconds.toFixed(3) + 's</figcaption></figure>').join('\n');
  await fs.writeFile(path.join(out, 'review.html'), '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Motion Reel review</title><style>body{background:#172322;color:#f3f0e7;font:16px system-ui;margin:24px}h1{font-size:28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,360px));gap:16px}figure{margin:0}img,video{width:100%;height:auto}video{max-width:960px}figcaption{padding:8px}a{color:#d5f099}</style><h1>Motion Reel / 出力レビュー</h1><p>' + escape(config.width + ' × ' + config.height + ' / ' + config.fps + ' fps / ' + config.duration + ' s') + '</p><p>同じ時刻の再描画：一致。映像と音のレビューは別途行ってください。</p><p><a href="capture.json">実行記録</a> · <a href="contact.png">全体シート</a> · <a href="poster.png">ポスター</a></p>' + (video ? '<video controls playsinline preload="metadata" src="video.mp4"></video>' : '') + '<h2>代表時刻 / 360px幅</h2><div class="grid">' + figures + '</div>' + (strip.length ? '<h2>連続フレーム</h2><div class="grid">' + stripFigures + '</div>' : '') + '</html>', {flag: 'wx'});
  console.log(JSON.stringify({output: out, stills: stills.length, strip: strip.length, determinism: determinism.match, video}, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
