"""Original 128 BPM score + real earshot v0.4 sound design. No external recordings."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import time

import numpy as np
from scipy.signal import butter, sosfilt
import soundfile as sf
from earshot.forge import sfx

ROOT = Path(__file__).resolve().parent
SR, DURATION, BPM = 48000, 30, 128
BEAT = 60 / BPM
BANK = [
    ('pop', 'ui_pop/soft', 'Pop', {'seed': 104}),
    ('pop-low', 'ui_pop/wide', 'Low pop', {'seed': 104}),
    ('pop-tight', 'ui_pop/step', 'Tight pop', {'seed': 104}),
    ('tick', 'pro_hover_tick/ping', 'Tick', {}),
    ('click', 'fit/click/floss_lid', 'Click', {}),
    ('knock', 'knock/wood', 'Knock', {}),
    ('hit', 'cut_hit/punch', 'Hit', {}),
    ('drop', 'cut_hit/kick', 'Drop', {}),
    ('whoosh', 'whoosh_fast/crisp', 'Whoosh', {'dur': .5, 'apex': .23}),
    ('sweep', 'whoosh_big/thump', 'Sweep', {'dur': .8, 'apex': .26}),
    ('riser', 'riser/dark', 'Riser', {'dur': .75}),
    ('glitch', 'pro_glitch/framelock', 'Glitch', {'dur': .42}),
    ('shutter', 'shutter/dslr', 'Shutter', {}),
    ('bell', 'mallet/glock', 'Bell', {'pitch': 'C5'}),
    ('pluck', 'mallet/marimba', 'Pluck', {'pitch': 'F4'}),
    ('sting', 'logo_sting/soft_bloom', 'Bloom', {'dur': 1.65}),
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def read(path):
    y, rate = sf.read(path, always_2d=True)
    assert rate == SR
    return np.repeat(y, 2, axis=1) if y.shape[1] == 1 else y


def bank():
    dest = ROOT / 'assets/sfx'
    dest.mkdir(parents=True, exist_ok=True)
    rows = []
    for key, source, label, params in BANK:
        target = dest / (key + '.wav')
        meta_path = dest / (key + '.json')
        start = time.perf_counter()
        if target.exists() and (not json.loads(meta_path.read_text('utf-8'))['checks']['ok'] or
                                json.loads(meta_path.read_text('utf-8'))['id'] != source):
            rejected = ROOT.parent / 'rejected-takes'
            rejected.mkdir(exist_ok=True)
            suffix = json.loads(meta_path.read_text('utf-8'))['id'].replace('/', '-')
            target.replace(rejected / (key + '-' + suffix + '.wav'))
            meta_path.replace(rejected / (key + '-' + suffix + '.json'))
        if not target.exists():
            result = sfx.sfx_render(source, out=str(target), peak_db=-6, **params)
            dump(meta_path, result['meta'])
        meta = json.loads(meta_path.read_text('utf-8'))
        samples = read(target)
        audit = sfx.sfx_check(str(target), category=source.split('/')[0])
        assert audit['ok'], (key, audit['summary'])
        assert np.isfinite(samples).all() and np.abs(samples).max() > .001
        rows.append(dict(key=key, id=source, label=label, params={**params, 'seed': meta['seed']},
                         file='assets/sfx/' + target.name, duration=len(samples) / SR,
                         render_seconds=round(time.perf_counter() - start, 4),
                         sha256=digest(target), meta=meta,
                         check={k: v for k, v in audit.items() if k != 'file'}))
        print('Ready:', key, flush=True)
    dump(ROOT / 'assets/bank-report.json', rows)
    return rows


def add(bus, sound, at, db=0, pan=0):
    sound = np.asarray(sound)
    if sound.ndim == 1:
        sound = np.repeat(sound[:, None], 2, axis=1)
    start = round(at * SR)
    offset = max(0, -start)
    start = max(0, start)
    size = min(len(sound) - offset, len(bus) - start)
    if size <= 0:
        return
    gain = 10 ** (db / 20)
    # Equal-power pan, with centered stereo preserving its width.
    lr = np.sqrt(np.array([1 - pan, 1 + pan]))
    bus[start:start + size] += sound[offset:offset + size] * lr * gain


def fade(y, attack=.004, release=.02):
    y = y.copy()
    a, r = min(round(attack * SR), len(y)), min(round(release * SR), len(y))
    if a:
        y[:a] *= np.linspace(0, 1, a) ** 2
    if r:
        y[-r:] *= np.linspace(1, 0, r) ** 2
    return y


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def bass(midi, dur, velocity):
    t = np.arange(round(dur * SR)) / SR
    f = hz(midi)
    # Warm low register, rounded transient, no ascending oscillator whip.
    phase = 2 * np.pi * f * t
    env = np.exp(-t / .14) * velocity
    y = (.75 * np.sin(phase) + .20 * np.sin(phase * 2) + .05 * np.sin(phase * 3)) * env
    return fade(y, .008, .035)


def chord(midis, dur, seed):
    t = np.arange(round(dur * SR)) / SR
    rng = np.random.default_rng(seed)
    stereo = np.zeros((len(t), 2))
    for midi in midis:
        f = hz(midi)
        phase = rng.uniform(0, 2 * np.pi)
        for channel, detune in enumerate([-.0016, .0016]):
            p = 2 * np.pi * f * (1 + detune) * t + phase
            stereo[:, channel] += .75 * np.sin(p) + .14 * np.sin(2 * p) + .04 * np.sin(3 * p)
    envelope = (1 - np.exp(-t / .06)) * np.exp(-t / 1.5)
    stereo *= envelope[:, None] / len(midis)
    for c in range(2):
        stereo[:, c] = fade(stereo[:, c], .03, .15)
    return stereo


def score(sounds):
    """64-beat original arrangement: dry groove, break, return, short ending."""
    music = np.zeros((DURATION * SR, 2))
    rng = np.random.default_rng(211339)
    kick = sounds['drop'][0]
    click = sounds['tick'][0]
    wood = sounds['knock'][0]
    for beat in range(60):
        at = beat * BEAT + .035
        bar = beat // 4
        if 8 <= bar < 10:
            continue  # deliberate space for exposed sound design, not a long silent reset
        if beat % 4 in (0, 2) or (bar >= 4 and beat % 8 == 7):
            add(music, kick, at, -9 if bar < 2 else -7)
        if beat % 4 in (1, 3):
            add(music, wood, at, -15, -.1)
        if bar >= 2:
            # Small offbeat noise hats; quieter upbeats avoid a metronome feel.
            add(music, click, at + BEAT / 2 + .008, -18, .45)
            if beat % 2 == 1:
                add(music, click, at + BEAT * .75, -25, -.45)
        root = [29, 29, 32, 27][bar % 4]  # F1/F1/Ab1/Eb1
        if beat % 4 in (0, 2):
            add(music, bass(root, .34, .6), at + .005, -7)
        if bar >= 4 and beat % 4 == 3:
            add(music, bass(root + 12, .19, .3), at + BEAT / 2, -11)

    for bar in range(15):
        # Fm9 -> Abmaj7 -> Eb(add9); restrained sustained color beneath the SFX.
        harmony = [[53, 56, 60, 67], [53, 56, 60, 67], [56, 60, 63, 67], [51, 55, 58, 65]][bar % 4]
        if bar in (8, 9):
            continue
        pad = chord(harmony, 2.3, 800 + bar)
        add(music, pad, bar * 4 * BEAT + .02, -24 if bar < 2 else -21)

    # A simple syncopated motif appears in the body, not a stream of demo beeps.
    motif = [(0, 65), (1.5, 72), (2.75, 68), (3.5, 63)]
    for bar in [2, 3, 4, 5, 6, 7, 10, 11, 12, 13]:
        for step, note in motif:
            t = np.arange(round(.32 * SR)) / SR
            f = hz(note)
            tone = (np.sin(2 * np.pi * f * t + .7 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / .035))
                    * np.exp(-t / .085))
            tone = fade(tone, .003, .03)
            at = (bar * 4 + step) * BEAT + .02
            pan = (-.25 if step < 2 else .25)
            add(music, tone, at, -26, pan)
            add(music, tone, at + BEAT * .75, -35, -pan)

    # Musical tension/release: low air in the break, then stop immediately before the mark.
    noise = rng.normal(0, 1, round(3.75 * SR))
    noise = sosfilt(butter(2, [180, 1800], btype='bandpass', fs=SR, output='sos'), noise)
    noise = fade(noise, .2, .18)
    add(music, noise, 15, -34)
    grid = np.arange(len(music)) / SR
    # Light sidechain-style pulse, generated against a known grid (not a detected beat claim).
    pulse = 1 - .14 * np.exp(-((grid - .035) % BEAT) / .07)
    music *= pulse[:, None]
    gate = np.ones(len(music))
    stop = (grid > 27.88) & (grid < 28.125)
    gate[stop] = 0
    # Smooth both edges of the intentional stop to avoid clicks.
    for at in [27.88, 28.125]:
        q = round(at * SR)
        ramp = round(.008 * SR)
        if at < 28:
            gate[q-ramp:q] = np.linspace(1, 0, ramp)
        else:
            gate[q:q+ramp] = np.linspace(0, 1, ramp)
    music *= gate[:, None]
    add(music, chord([41, 53, 56, 60, 67], 1.8, 999), 28.125, -16)
    add(music, kick, 28.125, -7)
    music[-round(.18 * SR):] *= np.linspace(1, 0, round(.18 * SR))[:, None] ** 2
    return music


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bank-only', action='store_true')
    args = ap.parse_args()
    assert importlib.metadata.version('earshot') == '0.4.0'
    rows = bank()
    if args.bank_only:
        return
    timeline_path = ROOT / 'video/timeline.json'
    timeline = json.loads(timeline_path.read_text('utf-8'))
    sounds = {r['key']: (read(ROOT / r['file']), r['meta']) for r in rows}
    fx = np.zeros((SR * DURATION, 2))
    events = []
    for i, cue in enumerate(timeline['events']):
        data, meta = sounds[cue['sound']]
        sync = meta[cue['sync'] + '_s']
        start = round((cue['time'] - sync) * SR) / SR
        assert start >= 0, (i, cue, start)
        assert start + len(data) / SR <= DURATION, ('Tail would be truncated', i, cue)
        add(fx, data, start, cue.get('gain_db', -5), cue.get('pan', 0))
        events.append({**cue, 'index': i, 'start': start, 'sync_in_file': sync,
                       'sync_error_ms': round((start + sync - cue['time']) * 1000, 6)})
    music = score(sounds)
    mix = music + fx
    assert np.isfinite(mix).all()
    mix *= min(1, .85 / np.abs(mix).max())
    scratch = ROOT.parent / 'audio-review'
    scratch.mkdir(exist_ok=True)
    sf.write(scratch / 'music.wav', music, SR, subtype='PCM_24')
    sf.write(scratch / 'sfx.wav', fx, SR, subtype='FLOAT')
    sf.write(scratch / 'premaster.wav', mix, SR, subtype='FLOAT')
    target = ROOT / 'assets/soundtrack.wav'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'info', '-y', '-i', str(scratch / 'premaster.wav'),
                    '-af', 'loudnorm=I=-15:TP=-1.5:LRA=8:print_format=json', '-ar', str(SR),
                    '-c:a', 'pcm_s24le', str(target)], check=True, capture_output=True)
    master = read(target)
    assert len(master) == SR * DURATION and np.isfinite(master).all()
    assert np.abs(master).max() < .95
    playback = ROOT / 'assets/playback.m4a'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(target),
                    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(playback)], check=True)
    timeline['events'] = events
    timeline['score'] = {'bpm': BPM, 'beat_seconds': BEAT, 'beats': 64,
                         'credit': 'Original score by Studio Yebisu: earshot percussion + procedural synthesis.'}
    timeline['sounds'] = [{k: r[k] for k in ('key', 'id', 'label', 'params', 'file', 'duration')} for r in rows]
    timeline['waveforms'] = {}
    for key, (y, _) in sounds.items():
        mono = y.mean(1)
        edges = np.linspace(0, len(mono), 193).astype(int)
        wave = np.array([np.abs(mono[a:b]).max() for a, b in zip(edges[:-1], edges[1:])])
        timeline['waveforms'][key] = (wave / max(.0001, wave.max())).round(4).tolist()
    dump(timeline_path, timeline)
    plan = {'version': '0.4.0', 'source_commit': '591fa3e028032e6dce56620a20e932e35667e8d8',
            'duration': DURATION, 'sample_rate': SR, 'fps': 30, 'bpm': BPM,
            'sounds': [{k: r[k] for k in ('key', 'id', 'label', 'params')} for r in rows],
            'events': [{k: v for k, v in e.items() if k not in ('index', 'start', 'sync_in_file', 'sync_error_ms')}
                       for e in events]}
    dump(ROOT / 'input/sound-design.json', plan)
    report = {'status': 'passed', 'revision': 2, 'generated_at': datetime.now(timezone.utc).isoformat(),
              'version': '0.4.0', 'source_commit': plan['source_commit'],
              'offline': os.environ.get('EARSHOT_OFFLINE') == '1', 'sample_count': len(rows),
              'cue_count': len(events), 'duration': DURATION, 'sample_rate': SR,
              'channels': 2, 'subtype': 'PCM_24', 'bpm': BPM,
              'mix_peak_dbfs': round(float(20 * np.log10(np.abs(master).max())), 3),
              'maximum_sync_error_ms': max(abs(e['sync_error_ms']) for e in events),
              'auditory_review': 'not-performed', 'external_recordings_used': False,
              'music': timeline['score'], 'samples': rows, 'soundtrack_sha256': digest(target),
              'browser_audio_sha256': digest(playback)}
    dump(ROOT / 'assets/render-report.json', report)
    print(json.dumps({k: report[k] for k in ('status', 'sample_count', 'cue_count', 'duration', 'mix_peak_dbfs')}))


if __name__ == '__main__':
    main()
