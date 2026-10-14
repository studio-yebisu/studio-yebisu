"""Reusable intake -> local publication -> optional approved deployment."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='action', required=True)
    new = sub.add_parser('new')
    new.add_argument('id')
    new.add_argument('--source', required=True)
    new.add_argument('--category', choices=['ui-ux', 'slides', 'motion', 'agents'], required=True)
    publish = sub.add_parser('publish')
    publish.add_argument('id')
    publish.add_argument('--deploy', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', args.id):
        raise SystemExit('Use a lowercase hyphenated case id.')
    if args.action == 'new':
        folder = ROOT / 'data/intakes'
        folder.mkdir(exist_ok=True)
        payload = {'id': args.id, 'source': args.source, 'category': args.category, 'requested_model': 'claude-opus-5-5', 'stage': 'intake', 'created_at': datetime.now(timezone.utc).isoformat()}
        with (folder / (args.id + '.json')).open('x', encoding='utf-8') as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
        print(f'Created intake {args.id}. Use skills/studio-yebisu/SKILL.md to produce the case.')
        return
    case_file = ROOT / 'data/cases' / (args.id + '.json')
    case = json.loads(case_file.read_text('utf-8'))
    if case.get('id') != args.id:
        raise SystemExit('Case id and filename do not match.')
    for key in ('demo', 'video', 'poster', 'skill', 'samples'):
        target = (ROOT / case[key]).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            raise SystemExit(f'Missing or unsafe case artifact: {key}')
    for script in ('build.py', 'check.py'):
        subprocess.run([sys.executable, str(ROOT / 'scripts' / script)], cwd=ROOT, check=True)
    if args.deploy:
        subprocess.run(['powershell', '-NoProfile', '-File', str(ROOT / 'scripts/deploy.ps1'), '-CaseId', args.id], cwd=ROOT, check=True)
    else:
        print('Local site updated. --deploy publishes only when authorized by the user request.')


if __name__ == '__main__':
    main()
