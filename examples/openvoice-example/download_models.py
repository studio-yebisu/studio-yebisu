"""Download only the two pinned public MIT model artifacts to external private folders.
Copyright (c) 2026 Studio Yebisu. MIT License. No account or remote inference.
"""
from pathlib import Path
import argparse,hashlib,json,os,urllib.request
HERE=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def external(value):
 p=value.expanduser().resolve()
 if p.is_relative_to(HERE) or HERE.is_relative_to(p):raise ValueError('Model/cache must be outside the example source.')
 return p
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--model-dir',type=Path,required=True);p.add_argument('--wavmark-cache',type=Path,required=True);p.add_argument('--check-only',action='store_true');a=p.parse_args()
 model,cache=external(a.model_dir),external(a.wavmark_cache)
 if model.is_relative_to(cache) or cache.is_relative_to(model):raise ValueError('Use separate model and cache directories.')
 lock=json.loads((HERE/'model-lock.json').read_text('utf-8'));wm=json.loads((HERE/'watermark-lock.json').read_text('utf-8'))
 assert lock['revision']=='f36e7edfe1684461a8343844af60babc2efbb727' and wm['revision']=='0ad3c7b74f641bddb61f6b85cdf2de0d93a5bfef'
 for n,f in lock['files'].items():
  dest=model/n
  if not dest.exists() and not a.check_only:
   dest.parent.mkdir(parents=True,exist_ok=True);temp=dest.with_name(dest.name+'.partial')
   with urllib.request.urlopen(f['url'],timeout=180) as u,temp.open('xb') as out:
    while b:=u.read(1024*1024):out.write(b)
   assert temp.stat().st_size==f['bytes'] and sha(temp)==f['sha256'];temp.rename(dest)
  assert dest.is_file() and dest.stat().st_size==f['bytes'] and sha(dest)==f['sha256'],n+' missing or mismatched'
 root=cache/'models--M4869--WavMark';dest=root/'snapshots'/wm['revision']/wm['filename'];ref=root/'refs/main'
 if not dest.exists() and not a.check_only:
  os.environ['HF_HUB_DISABLE_XET']='1'
  from huggingface_hub import hf_hub_download
  got=Path(hf_hub_download(repo_id=wm['repository'],filename=wm['filename'],revision=wm['revision'],cache_dir=str(cache)))
  assert got==dest
 assert dest.is_file() and dest.stat().st_size==wm['bytes'] and sha(dest)==wm['sha256'],'WavMark missing or mismatched'
 # Original wavmark.load_model() asks for main. Pin only this external cache's local
 # main reference, then run OpenVoice with HF_HUB_OFFLINE=1; no runtime download.
 if not ref.exists() and not a.check_only:ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text(wm['revision'],'utf-8')
 assert ref.is_file() and ref.read_text('utf-8').strip()==wm['revision'],'Existing cache refers to a different revision; use a new empty cache.'
 print('Verified the pinned OpenVoice V2 and default WavMark artifacts. No inference performed.')
if __name__=='__main__':main()
