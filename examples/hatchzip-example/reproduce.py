"""Execute HatchZip only on copies of freshly generated disposable fixtures."""
import hashlib
import json
import os
from pathlib import Path
import random
import shutil
import subprocess
import tarfile
import threading
import time
import zipfile

ROOT = Path(__file__).resolve().parent
EXE = Path(os.environ.get('HATCHZIP_EXE', shutil.which('hatchzip') or 'hatchzip'))
RUN = ROOT / 'out' / time.strftime('%Y%m%d-%H%M%S')
RUN.mkdir(parents=True, exist_ok=False)
RELEASE_COMMIT = '2b754c85b9322da64186e5e199ed22b1e45a5cce'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def command(*args):
    result = subprocess.run([str(EXE), *map(str, args)], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout.strip()

def files_in(folder):
    return [p for p in folder.rglob('*') if p.is_file()]

def size_of(path):
    try:
        return path.stat().st_size
    except FileNotFoundError:
        return 0

if digest(EXE) != '402d8efeb5506cf2e1aaa550801ba081960b61df106f8e05d34d9456bd776247':
    raise SystemExit('Use the official v0.1.2 Windows CLI binary from the documented release; binary hash does not match.')

samples = []
for key, label, count, size, compressed in [
    ('zip-stored', 'ZIP・4,096ファイル', 4096, 16 * 1024, False),
    ('zip-deflate', 'ZIP・圧縮あり', 16, 512 * 1024, True),
    ('tar', 'tar・1,024ファイル', 1024, 32 * 1024, False),
]:
    base = RUN / key
    original = base / 'reference'
    original.mkdir(parents=True)
    expected = {}
    randomizer = random.Random(20261024)
    for index in range(count):
        name = f'fixture-{index+1:02d}.bin'
        content = (b'Yaoyorozu disposable fixture\n' * ((size // 28) + 1))[:size] if compressed else randomizer.randbytes(size)
        path = original / name
        path.write_bytes(content)
        expected[name] = {'bytes': len(content), 'sha256': digest(path)}
    archive = base / ('reference.tar' if key == 'tar' else 'reference.zip')
    if key == 'tar':
        with tarfile.open(archive, 'w') as out:
            for path in files_in(original):
                out.add(path, arcname=path.name)
    else:
        with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED if compressed else zipfile.ZIP_STORED) as out:
            for path in files_in(original):
                out.write(path, arcname=path.name)
    original_archive_hash = digest(archive)
    measured = base / 'measured'
    measured.mkdir()
    copy = measured / archive.name
    shutil.copy2(archive, copy)
    output = measured / 'output'
    before = digest(copy)
    listed = command('list', copy)
    tested = command('test', copy)
    budget_bytes = None
    reserved_bytes = 2 * 1000 * 1000 * 1000
    reserve_argument = '2GB'
    plan = command('check', copy, '-o', output, '--keep-free', reserve_argument)
    assert before == digest(copy), 'Read-only commands modified the copy'
    trace = []
    started = time.perf_counter()
    process = subprocess.Popen([str(EXE), 'extract', str(copy), '-o', str(output), '--verify-first', '--keep-free', reserve_argument, '-y'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    while True:
        moment = time.perf_counter() - started
        archived = size_of(copy)
        output_files = files_in(output) if output.exists() else []
        output_bytes = sum(size_of(p) for p in output_files)
        extra_bytes = sum(size_of(p) for p in measured.iterdir() if p.is_file() and p != copy)
        trace.append({'seconds': round(moment, 6), 'archive_bytes': archived, 'output_bytes': output_bytes, 'sidecar_bytes': extra_bytes, 'total_bytes': archived + output_bytes + extra_bytes, 'output_files': len(output_files)})
        if process.poll() is not None:
            break
        time.sleep(0.001)
    stdout, stderr = process.communicate()
    assert process.returncode == 0, (stdout + stderr).decode('utf-8', errors='replace')
    actual = {p.name: {'bytes': p.stat().st_size, 'sha256': digest(p)} for p in files_in(output)}
    final_bytes = sum(v['bytes'] for v in actual.values())
    trace.append({'seconds': round(time.perf_counter()-started,6), 'archive_bytes': size_of(copy), 'output_bytes': final_bytes, 'sidecar_bytes': sum(size_of(p) for p in measured.iterdir() if p.is_file()), 'total_bytes': final_bytes + sum(size_of(p) for p in measured.iterdir() if p.is_file()), 'output_files':len(actual)})
    assert actual == expected
    assert not copy.exists()
    assert digest(archive) == original_archive_hash
    summary = {
        'id': key, 'label': label,
        'input': {'format': 'tar' if key == 'tar' else 'zip', 'fixture_count': count, 'archive_bytes': archive.stat().st_size, 'archive_sha256': original_archive_hash, 'unpacked_bytes': sum(v['bytes'] for v in expected.values())},
        'output': {'file_count': len(actual), 'bytes': sum(v['bytes'] for v in actual.values()), 'all_hashes_match': actual == expected, 'consumed_copy_absent': not copy.exists(), 'reference_archive_preserved': True},
        'duration_seconds': round(trace[-1]['seconds'], 6),
        'configured_free_budget_bytes': budget_bytes,
        'keep_free_bytes': reserved_bytes,
        'observed_peak_bytes': max(row['total_bytes'] for row in trace),
        'conventional_final_coexistence_bytes': archive.stat().st_size + sum(v['bytes'] for v in actual.values()),
        'trace': trace,
        'source_files': expected,
        'output_files': actual,
        'plan_output': plan,
        'test_output': tested,
        'extract_output': stdout.decode('utf-8', errors='replace').strip(),
    }
    samples.append(summary)
    print(json.dumps({k: summary[k] for k in ('id', 'input', 'output', 'duration_seconds', 'observed_peak_bytes', 'conventional_final_coexistence_bytes')}, ensure_ascii=False), flush=True)

report = {
    'tool': command('--version'), 'binary_sha256': digest(EXE), 'upstream_commit': RELEASE_COMMIT,
    'upstream_release_zip_sha256': '76aef08f88a3ccf5cb96dd98e8cb4bcaf3456df79394d49322dc1a04d9dbbfbb',
    'scope': 'Local Windows execution on generated disposable copies, default 2GB reservation. Many small files make real batch truncations visible. The disk was not filled. No constrained-disk or crash-recovery claim.',
    'measurement': 'Observed sizes in the measured directory only, sampled approximately every 1ms. Original reference fixtures live outside that directory. Sampling may miss instantaneous peaks. Times are this PC only, not a benchmark.',
    'samples': samples,
}
(RUN / 'runtime-results.json').write_bytes((json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
(ROOT / 'out/latest-run.json').write_bytes((json.dumps({'run': str(RUN), 'results': str(RUN / 'runtime-results.json')}, indent=2) + '\n').encode('utf-8'))
print('RESULTS', RUN / 'runtime-results.json')
