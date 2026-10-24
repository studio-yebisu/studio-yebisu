"""Download only selected, pinned Scenario assets and verify every file hash."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--sample', choices=['frog','chest','lantern'], default='frog')
parser.add_argument('--all', action='store_true', help='Download the three selected examples, not the whole dataset')
args = parser.parse_args()
selected = json.loads((ROOT/'selected.json').read_text('utf-8'))
selected = [row for row in selected if args.all or row['key']==args.sample]
out = ROOT/'out'/('download-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
out.mkdir(parents=True,exist_ok=False)
for row in selected:
    folder=out/row['key'];folder.mkdir()
    for file in row['local_files']:
        source=f"https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/{row['revision']}/"+file['source_path']
        with urllib.request.urlopen(source,timeout=120) as response:
            data=response.read()
        actual=hashlib.sha256(data).hexdigest()
        if actual!=file['sha256']:
            raise SystemExit('SHA-256 mismatch: '+file['source_path'])
        (folder/file['file']).write_bytes(data)
        print(row['key'],file['file'],len(data),actual)
    (folder/'metadata.json').write_bytes((json.dumps(row,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
print('Saved verified files:',out)
print('Credit: Scenario / CC BY 4.0 / https://creativecommons.org/licenses/by/4.0/')
