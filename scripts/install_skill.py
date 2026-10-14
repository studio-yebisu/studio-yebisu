"""Make the canonical orchestrator discoverable, without replacing existing skills."""
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    skill_home = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'skills'
    skill_home.mkdir(parents=True, exist_ok=True)
    target = ROOT / 'skills/studio-yebisu'
    link = skill_home / 'studio-yebisu'
    if link.exists():
        if link.resolve() != target.resolve():
            raise SystemExit(f'Another skill already exists at {link}; nothing was overwritten.')
    elif os.name == 'nt':
        subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(target)], check=True, capture_output=True)
    else:
        link.symlink_to(target, target_is_directory=True)
    print(link)


if __name__ == '__main__':
    main()
