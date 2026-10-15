"""Combine specialist snapshots, independently curated resources, and finished cases."""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def load_categories():
    categories = json.loads((ROOT / 'data/categories.json').read_text('utf-8'))['categories']
    ids = [item['id'] for item in categories]
    if len(ids) != len(set(ids)) or not all(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', value) for value in ids):
        raise ValueError('Category ids must be unique lowercase slugs')
    if not all(item.get('label') and item.get('description') for item in categories):
        raise ValueError('Every category needs a label and description')
    return categories


def build_catalog(cases):
    catalog = json.loads((ROOT / 'data/catalog.json').read_text('utf-8'))
    curated = json.loads((ROOT / 'data/curated-resources.json').read_text('utf-8'))
    catalog['categories'] = load_categories()
    category_ids = {item['id'] for item in catalog['categories']}
    by_id = {}
    for entry in catalog['entries'] + curated['entries']:
        if entry['id'] in by_id:
            raise ValueError(f'Duplicate catalog id: {entry["id"]}')
        by_id[entry['id']] = entry
    # Finished cases can replace their earlier catalog record with the complete article.
    for case in cases:
        if case.get('catalog_entry'):
            by_id[case['catalog_entry']['id']] = case['catalog_entry']
    for entry in by_id.values():
        if entry.get('category') not in category_ids:
            raise ValueError(f'Unknown catalog category: {entry.get("category")}')
        for key in ('id', 'name', 'summary', 'kind', 'source_url', 'license'):
            if not entry.get(key):
                raise ValueError(f'Missing catalog field {key}: {entry.get("id")}')
    catalog['entries'] = list(by_id.values())
    catalog['updated_on'] = max([catalog.get('updated_on', ''), curated.get('updated_on', '')]
                                + [case.get('updated_on', '') for case in cases])
    return catalog
