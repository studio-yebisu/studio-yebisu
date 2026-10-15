"""Render an editable composition with a separately installed Motion Reel.

Keeps the complete relative module/asset layout; never changes source files.
Copyright (c) 2026 Studio Yebisu. MIT License.
"""
from pathlib import Path
import argparse
import re
import shutil
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--renderer', type=Path, required=True,
                        help='Installed Motion Reel scripts/render.mjs')
    parser.add_argument('--composition', choices=['film', 'explanation', 'selection', 'materialize'], default='film')
    parser.add_argument('--out', type=Path, required=True, help='New empty output folder outside this source folder')
    parser.add_argument('--work-root', type=Path, help='Optional parent for the disposable render copy')
    parser.add_argument('--stills-only', action='store_true')
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    renderer = args.renderer.resolve(strict=True)
    output = args.out.resolve()
    if output.is_relative_to(source) or source.is_relative_to(output):
        parser.error('Output and source must be separate directories.')
    if output.exists() and any(output.iterdir()):
        parser.error('Output must be empty; existing results are never overwritten.')
    entries = {'film': 'film/index.html', 'explanation': 'video/index.html',
               'selection': 'lab/index.html', 'materialize': 'lab/materialize.html'}
    entry_path = Path(entries[args.composition])
    entry = (source / entry_path).read_text('utf-8')
    if re.search(r'<base\b', entry, re.I):
        parser.error('Composition already defines a base URL.')
    entry, count = re.subn(r'(<head\b[^>]*>)', rf'\1\n<base href="{entry_path.parent.as_posix()}/">', entry, count=1, flags=re.I)
    if count != 1:
        parser.error('Composition has no head element.')
    base = args.work_root.resolve() if args.work_root else Path(tempfile.gettempdir()).resolve()
    if base.is_relative_to(source):
        parser.error('Disposable render copies must be outside the source folder.')
    base.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='studio-yebisu-motion-kit-', dir=base) as temporary:
        disposable = Path(temporary).resolve()
        assert disposable.is_relative_to(base) and disposable.name.startswith('studio-yebisu-motion-kit-')
        project = disposable / 'project'
        shutil.copytree(source, project, ignore=shutil.ignore_patterns('.git', '.local', '.venv', 'node_modules', '__pycache__', '*.pyc', '*.mp4', '*.zip'))
        (project / 'index.html').write_text(entry, encoding='utf-8')
        command = ['node', str(renderer), '--project', str(project), '--out', str(output), '--step', '0.5' if args.composition in ('selection', 'materialize') else '1']
        if not args.stills_only:
            command += ['--video']
        command += ['--strip-at', '1.9' if args.composition in ('selection', 'materialize') else '11.9']
        subprocess.run(command, check=True)


if __name__ == '__main__':
    main()
