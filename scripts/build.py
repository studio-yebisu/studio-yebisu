"""Build the static public allowlist, with no local state or linked workspaces."""
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def main():
    target = ROOT / 'dist'
    target.mkdir(exist_ok=True)
    cases = [json.loads(p.read_text('utf-8')) for p in sorted((ROOT / 'data/cases').glob('*.json'))]
    (ROOT / 'data/cases.json').write_text(json.dumps({'cases': cases}, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    for p in (ROOT / 'src').rglob('*'):
        if p.is_file():
            dest = target / p.relative_to(ROOT / 'src')
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, dest)
    for folder in ('data', 'examples', 'media', 'skills'):
        shutil.copytree(ROOT / folder, target / folder, dirs_exist_ok=True, ignore=shutil.ignore_patterns('node_modules', '__pycache__', '.local', 'reviews', 'out'))
    catalog = json.loads((ROOT / 'data/catalog.json').read_text('utf-8'))
    by_id = {entry['id']: entry for entry in catalog['entries']}
    for case in cases:
        if case.get('catalog_entry'):
            entry = case['catalog_entry']
            if entry.get('category') not in {category['id'] for category in catalog['categories']}:
                raise ValueError('Unknown case catalog category')
            for key in ('id', 'name', 'summary', 'kind', 'source_url', 'license'):
                if not entry.get(key):
                    raise ValueError(f'Missing catalog_entry field: {key}')
            by_id[entry['id']] = entry
    catalog['entries'] = list(by_id.values())
    (target / 'data/catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    if (ROOT / 'integrations').is_dir():
        shutil.copytree(ROOT / 'integrations', target / 'guides', dirs_exist_ok=True)
    for name in ('LICENSE', 'README.md'):
        if (ROOT / name).is_file():
            shutil.copy2(ROOT / name, target / name)
    (target / '.nojekyll').touch()
    print(f'Built {len(cases)} case(s) -> {target}')


if __name__ == '__main__':
    main()
