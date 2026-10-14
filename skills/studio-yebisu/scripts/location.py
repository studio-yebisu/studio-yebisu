"""Resolve the canonical workspace even through an installed skill junction."""
from pathlib import Path

root = Path(__file__).resolve().parents[3]
if not (root / 'data/projects.json').is_file():
    raise SystemExit('Run this skill from a complete Studio Yebisu checkout.')
print(root)
