"""Check user-facing artifacts and links in the generated publication."""
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import re
from catalog import load_categories
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'


def local_file(value, base=DIST):
    url = urlsplit(value)
    if url.scheme or url.netloc or not url.path or url.path.startswith('#'):
        return
    target = (base / unquote(url.path)).resolve()
    if not target.is_relative_to(DIST.resolve()):
        raise ValueError(f'Path escapes publication: {value}')
    if not target.exists():
        raise FileNotFoundError(f'Broken local link: {value} (from {base})')


class Links(HTMLParser):
    def __init__(self, page):
        super().__init__()
        self.page = page

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ('href', 'src', 'poster') and value:
                local_file(value, self.page.parent)


def main():
    for page in DIST.rglob('*.html'):
        Links(page).feed(page.read_text('utf-8'))
    catalog = json.loads((DIST / 'data/catalog.json').read_text('utf-8'))
    ids = [e['id'] for e in catalog['entries']]
    assert len(ids) == len(set(ids)), 'Duplicate catalog ids'
    assert catalog['categories'] == load_categories(), 'Published categories differ from the canonical taxonomy'
    category_ids = {category['id'] for category in catalog['categories']}
    assert all(entry['category'] in category_ids for entry in catalog['entries']), 'Unknown entry category'
    assert 'agents-studio-yebisu' not in ids, 'Internal orchestrator leaked into the catalog'
    assert not (DIST / 'skills/studio-yebisu').exists(), 'Internal orchestrator was distributed'
    for entry in catalog['entries']:
        for key in ('source_url', 'guide_url', 'license_url', 'image', 'skill_download', 'example_url'):
            if entry.get(key):
                local_file(entry[key])
        if entry.get('verification_stage') == 'source-reviewed':
            assert re.fullmatch(r'[0-9a-f]{40}', entry.get('source_commit', '')), 'Curated source is not pinned'
            assert entry['source_commit'] in entry['source_url'], 'Curated URL does not point to the reviewed commit'
            assert entry['source_commit'] in entry['license_url'], 'License does not point to the reviewed commit'
            assert entry.get('workflow') and entry.get('requirements'), 'Curated guide is incomplete'
            assert not entry.get('example_url') and not entry.get('image'), 'Source review cannot claim a new example'
            assert entry.get('source_note') and entry.get('license_note'), 'Curated provenance or conditions missing'
    cases = json.loads((DIST / 'data/cases.json').read_text('utf-8'))['cases']
    assert cases, 'No finished case'
    for case in cases:
        for key in ('demo', 'video', 'poster', 'skill', 'samples'):
            local_file(case[key])
        result = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', str(DIST / case['video'])], encoding='utf-8')
        video = json.loads(result)
        assert float(video['format']['duration']) >= 20, 'Explainer is too short'
        assert any(s.get('width', 0) >= 960 for s in video['streams']), 'Video resolution is too low'
        sample_data = json.loads((DIST / case['samples']).read_text('utf-8'))
        samples = sample_data['samples']
        assert samples, f'No samples for {case["id"]}'
        sample_ids = [sample['id'] for sample in samples]
        assert len(sample_ids) == len(set(sample_ids)), f'Duplicate sample ids: {case["id"]}'
        sample_format = case.get('sample_format', 'brief')
        assert sample_format in ('brief', 'input-output'), f'Unknown sample format: {sample_format}'
        for sample in samples:
            if sample_format == 'input-output':
                assert sample_data.get('format') == sample_format
                for key in ('label', 'input', 'output'):
                    assert sample.get(key), f'Missing sample field {key}'
            else:
                brief = sample['brief']
                for key in ('request', 'category', 'goal', 'inputs', 'skill_refs', 'deliverables', 'acceptance'):
                    assert brief.get(key), f'Missing brief field {key}'
    forbidden = [p for p in DIST.rglob('*') if '.local' in p.parts or '.git' in p.parts or 'workspace' in p.parts]
    assert not forbidden, 'Private workspace leaked into publication'
    print(json.dumps({'status': 'passed', 'catalog_entries': len(ids), 'categories': len(category_ids), 'curated_resources': sum(e.get('verification_stage') == 'source-reviewed' for e in catalog['entries']), 'cases': len(cases), 'html_pages': len(list(DIST.rglob('*.html')))}, ensure_ascii=False))


if __name__ == '__main__':
    main()
