"""Render a case with the installed Motion Reel runtime and retain its original output."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('id')
    parser.add_argument('--renderer', type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', args.id):
        raise SystemExit('Invalid case id.')
    home = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex')))
    renderer = args.renderer or home / 'skills/motion-reel/scripts/render.mjs'
    if not renderer.is_file():
        raise SystemExit('Install Motion Reel or pass --renderer pointing to its render.mjs.')
    project = ROOT / 'examples' / args.id / 'video'
    if not (project / 'index.html').is_file():
        raise SystemExit('The case has no finished video source.')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    output = ROOT / '.local/renders' / f'{args.id}-{stamp}'
    source_hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in project.iterdir() if p.is_file()}
    subprocess.run(['node', str(renderer), '--project', str(project), '--out', str(output), '--video', '--step', '2', '--strip-at', '11.9'], cwd=ROOT, check=True)
    if source_hashes != {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in project.iterdir() if p.is_file()}:
        raise SystemExit('Video source changed during rendering. Originals retained; nothing published.')
    capture = json.loads((output / 'capture.json').read_text('utf-8'))
    if capture['errors'] or not capture['video']:
        raise SystemExit('Render has errors. Originals remain in the private render directory.')
    media = ROOT / 'media'
    media.mkdir(exist_ok=True)
    destination = media / (args.id + '.mp4')
    if destination.exists():
        archived = output / 'previous-published.mp4'
        shutil.copy2(destination, archived)
    shutil.copy2(output / 'video.mp4', destination)
    poster = media / (args.id + '.webp')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(output / 'poster.png'), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '90', str(poster)], check=True)
    reviews = ROOT / 'reviews'
    reviews.mkdir(exist_ok=True)
    shutil.copy2(output / 'contact.png', reviews / (args.id + '-contact.png'))
    (ROOT / '.local/latest-render.json').write_text(json.dumps({'id': args.id, 'output': str(output), 'video': capture['video'], 'determinism': capture['determinism']}, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(json.dumps({'video': str(destination), 'poster': str(poster), 'contact': str(reviews / (args.id + '-contact.png')), 'originals': str(output)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
