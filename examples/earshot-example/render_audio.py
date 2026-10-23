"""Render the real earshot bank and place measured sync points on a 30-second timeline."""
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import time

import numpy as np
import soundfile as sf

from earshot.forge import sfx

ROOT = Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    assert importlib.metadata.version('earshot') == '0.4.0', 'Use the pinned earshot v0.4.0 environment.'
    plan = json.loads((ROOT / 'input/sound-design.json').read_text('utf-8'))
    out = ROOT / 'assets'
    if out.exists():
        raise FileExistsError('Preserve existing assets and use a fresh project folder before re-rendering.')
    (out / 'sfx').mkdir(parents=True)
    (ROOT / 'video').mkdir(exist_ok=True)
    rate = plan['sample_rate']
    mix = np.zeros((int(plan['duration'] * rate), 2), dtype=np.float64)
    sounds, rows = {}, []
    for item in plan['sounds']:
        target = out / 'sfx' / (item['key'] + '.wav')
        tick = time.perf_counter()
        result = sfx.sfx_render(item['id'], out=str(target), peak_db=-6.0, **item['params'])
        took = time.perf_counter() - tick
        data, sr = sf.read(target, always_2d=True)
        assert sr == rate and sf.info(target).subtype == 'PCM_24'
        assert np.isfinite(data).all() and np.abs(data).max() > 0.001
        check = sfx.sfx_check(str(target), category=item['id'].split('/')[0])
        assert check['ok'], check['summary']
        check['file'] = target.relative_to(ROOT).as_posix()
        if data.shape[1] == 1:
            data = np.repeat(data, 2, axis=1)
        assert data.shape[1] == 2
        sounds[item['key']] = (data, result['meta'])
        rows.append({**item, 'file': target.relative_to(ROOT).as_posix(),
                     'duration': len(data) / rate, 'render_seconds': round(took, 4),
                     'sha256': digest(target), 'meta': result['meta'], 'check': check})
        print(f"Rendered {item['key']}: {len(data) / rate:.3f}s; clean", flush=True)
    events = []
    for i, cue in enumerate(plan['events']):
        data, meta = sounds[cue['sound']]
        sync = meta[cue['sync'] + '_s']
        start = int(round((cue['time'] - sync) * rate))
        assert start >= 0
        end = start + len(data)
        assert end <= len(mix), 'A sound tail would be truncated.'
        mix[start:end] += data
        error_ms = (start / rate + sync - cue['time']) * 1000
        assert abs(error_ms) < 1000 / rate
        events.append({**cue, 'index': i, 'start': start / rate, 'sync_in_file': sync,
                       'sync_error_ms': round(error_ms, 6)})
    raw_peak = float(np.abs(mix).max())
    scale = min(1.0, 10 ** (-2.0 / 20) / raw_peak)
    mix *= scale
    assert np.isfinite(mix).all() and np.abs(mix).max() <= 10 ** (-2.0 / 20) + 1e-12
    # The end is naturally silent: preserve every decay rather than trimming it.
    assert np.abs(mix[-rate:]).max() == 0
    soundtrack = out / 'soundtrack.wav'
    sf.write(soundtrack, mix, rate, subtype='PCM_24')
    timeline = {'duration': plan['duration'], 'fps': plan['fps'], 'sample_rate': rate,
                'title': plan['title'], 'chapters': plan['chapters'], 'events': events,
                'sounds': [{k: row[k] for k in ('key', 'id', 'label', 'params', 'file', 'duration')}
                           for row in rows]}
    (ROOT / 'video/timeline.json').write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    report = {
        'status': 'passed', 'generated_at': datetime.now(timezone.utc).isoformat(),
        'version': plan['version'], 'source_commit': plan['source_commit'],
        'offline': os.environ.get('EARSHOT_OFFLINE') == '1', 'bank_count': len(sfx.sfx_list()['sounds']),
        'sample_count': len(rows), 'cue_count': len(events), 'duration': len(mix) / rate,
        'sample_rate': rate, 'channels': 2, 'subtype': 'PCM_24',
        'mix_peak_dbfs': float(20 * np.log10(np.abs(mix).max())), 'mix_scale': scale,
        'maximum_sync_error_ms': max(abs(c['sync_error_ms']) for c in events),
        'auditory_review': 'not-performed', 'no_recordings_or_music_used': True,
        'samples': rows, 'soundtrack_sha256': digest(soundtrack),
    }
    (out / 'render-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(json.dumps({k: report[k] for k in ('status', 'sample_count', 'cue_count', 'duration',
                                          'mix_peak_dbfs', 'maximum_sync_error_ms')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
