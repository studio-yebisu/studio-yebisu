"""Connect existing repositories without moving their files or Git histories."""
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    projects = json.loads((ROOT / 'data/projects.json').read_text('utf-8'))['projects']
    links = ROOT / 'workspace'
    links.mkdir(exist_ok=True)
    result = {}
    for project in projects:
        if project['id'] == 'agents':
            continue
        target = (ROOT.parent / project['folder']).resolve(strict=True)
        link = links / project['id']
        if link.exists():
            if link.resolve() != target:
                raise RuntimeError(f'Existing link has another target: {link}')
        elif os.name == 'nt':
            subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(target)], check=True, capture_output=True)
        else:
            link.symlink_to(target, target_is_directory=True)
        result[project['id']] = str(target)
    (ROOT / '.local').mkdir(exist_ok=True)
    (ROOT / '.local/workspaces.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
