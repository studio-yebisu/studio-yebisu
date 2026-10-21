"""Check the public, source-reviewed model collection and its diagram assets."""
import argparse
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ID = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')
REVISION = re.compile(r'[0-9a-f]{40}')


def https_url(value):
    assert isinstance(value, str) and not re.search(r'[\x00-\x20\x7f\\]', value), f'Unsafe URL: {value!r}'
    parsed = urlsplit(value)
    assert parsed.scheme == 'https' and parsed.hostname and not parsed.username and not parsed.password, f'Invalid public source URL: {value!r}'
    return parsed


def check_open_models(root):
    root = Path(root).resolve()
    data = json.loads((root / 'data/open-models.json').read_text('utf-8'))
    category_data = json.loads((root / 'data/categories.json').read_text('utf-8'))['categories']
    categories = {c['id'] for c in category_data}
    assert data['schema_version'] == 3
    assert data['title'] == 'OpenWeight'
    assert data['scope'] == {'model_axis': 'task-specialist', 'general_llm': 'excluded'}
    assert 'owm-llm' not in categories, 'OpenLLM category must not return'
    assert next(c['label'] for c in category_data if c['id'] == 'owm-tools') == 'OpenWeight'
    assert 'llm_models' not in data and 'llm_guide' not in data, 'OpenLLM introductions and comparisons are excluded'
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', data['updated_on'])
    assert data['definition'] and data['evidence_note']
    models = data['models']
    assert all(m.get('model_axis') == 'task-specialist' for m in models), 'General LLM mixed into task specialists'
    assert models, 'No source-reviewed models'
    assert len({m['id'] for m in models}) == len(models), 'Duplicate model ids'
    model_ids = set()
    for model in models:
        ident = model['id']
        assert ID.fullmatch(ident), f'Invalid model id: {ident}'
        assert model['category'] in categories, f'Unknown model category: {ident}'
        assert model['category'] == 'owm-tools', f'Only the OpenWeight category is allowed: {ident}'
        assert model['task_category'] in categories, f'Unknown model task category: {ident}'
        for key in ('name', 'provider', 'task', 'headline', 'summary', 'concept_alt', 'requirements'):
            assert isinstance(model[key], str) and model[key].strip(), f'Missing {key}: {ident}'
        for step in ('input', 'process', 'output'):
            assert model[step]['label'] and model[step]['text'], f'Missing diagram explanation: {ident}'
        assert model['verification']['stage'] == 'source-reviewed', f'Unverified runtime claim: {ident}'
        assert model['verification']['inference'] == 'not-run', f'Unsupported inference claim: {ident}'
        assert model['verification']['checked_on'] == data['updated_on']
        post = https_url(model['post']['url'])
        assert post.hostname == 'x.com' and re.fullmatch(r'/studio_yebisu/status/\d+', post.path), f'Not the selected author introduction: {ident}'
        assert model['post']['posted_at'] and model['post']['context']
        weights = model['weights']
        assert weights['model_id'] not in model_ids, f'Duplicate model checkpoint: {ident}'
        model_ids.add(weights['model_id'])
        revision = weights['revision']
        assert REVISION.fullmatch(revision), f'Unpinned model card: {ident}'
        assert weights['availability'] == 'published' and weights['weight_files_count'] > 0, f'Weights not confirmed: {ident}'
        assert isinstance(weights['gated'], bool)
        base = 'https://huggingface.co/' + weights['model_id']
        assert weights['url'] == base
        https_url(weights['url'])
        assert model['sources'], f'Missing primary sources: {ident}'
        for source in model['sources']:
            https_url(source['url'])
            assert source['label'] and source['url'].startswith(base + '/blob/' + revision + '/'), f'Primary source not pinned: {ident}'
        https_url(model['license']['url'])
        assert model['license']['url'].startswith(base + '/blob/' + revision + '/'), f'Unpinned conditions: {ident}'
        assert model['license']['name'] and model['license']['note']
        example = model['example']
        assert example['kind'] in ('linked-demo', 'introduced-workflow', 'illustrative-use'), f'Unknown example scope: {ident}'
        https_url(example['url'])
        for key in ('title', 'description', 'label', 'credit', 'note'):
            assert example[key], f'Missing example attribution or scope: {ident}'
        assert model['limitations'], f'Missing limitations: {ident}'
        explanation = model.get('explanation', [])
        assert len(explanation) == 2 and all(p.get('title') and p.get('text') for p in explanation), f'Missing model-specific explanation: {ident}'
        assert model.get('diagram_note'), f'Missing diagram reading note: {ident}'
        expected_concept = f'media/open-models/{ident}.svg'
        assert model['concept'] == expected_concept, f'Unexpected diagram path: {ident}'
        asset = (root / expected_concept).resolve()
        assert asset.is_relative_to(root), f'Diagram escapes the public root: {ident}'
        tree = ET.parse(asset)
        svg = tree.getroot()
        assert svg.tag == '{http://www.w3.org/2000/svg}svg' and svg.get('viewBox'), f'Invalid vector diagram: {ident}'
        assert svg.find('{http://www.w3.org/2000/svg}title') is not None, f'Missing SVG title: {ident}'
        assert svg.find('{http://www.w3.org/2000/svg}desc') is not None, f'Missing SVG description: {ident}'
        for element in svg.iter():
            tag = element.tag.rsplit('}', 1)[-1].lower()
            assert tag not in ('script', 'foreignobject', 'iframe', 'image'), f'Unexpected SVG content: {ident}'
            for key, value in element.attrib.items():
                assert not key.lower().startswith('on'), f'Executable SVG attribute: {ident}'
                if key.rsplit('}', 1)[-1] == 'href':
                    assert value.startswith('#'), f'External SVG resource: {ident}'
                assert not re.search(r'url\(\s*[\"\x27]?\s*(?:https?:|//|data:)', value, re.I), f'External SVG style: {ident}'
    for filename in ('open-models.html', 'open-models.css', 'open-models.js'):
        path = root / filename if (root / 'index.html').is_file() else root / 'src' / filename
        assert path.is_file(), f'Missing model page component: {path}'
    diagram_ids = {p.stem for p in (root / 'media/open-models').glob('*.svg')}
    assert diagram_ids == {m['id'] for m in models}, 'Unlisted model diagram remains in the publication'
    receipt = json.loads((root / 'data/production/open-models-gallery.json').read_text('utf-8'))
    assert receipt['general_llm_reference_count'] == 0 and 'llm_comparison_source' not in receipt, 'LLM comparison remains in the public receipt'
    expected_pins = [{'id': m['id'], 'axis': m['model_axis'], 'model_id': m['weights']['model_id'], 'revision': m['weights']['revision']} for m in models]
    assert receipt['source_pins'] == expected_pins, 'Public source pins differ from the OpenWeight collection'
    return {'open_weight_models': len(models), 'model_diagrams': len(models), 'general_llm_references': 0, 'model_inference_run': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    print(json.dumps({'status': 'passed', **check_open_models(args.root)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
