"""Render the editable explainer with the bundled Motion Reel runtime.
Copyright (c) 2026 Studio Yebisu. MIT License.
"""
from pathlib import Path
import argparse,re,shutil,subprocess,tempfile

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--renderer',type=Path,default=Path(__file__).resolve().parent/'tools/motion-reel/render.mjs')
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--work-root',type=Path)
    p.add_argument('--stills-only',action='store_true')
    p.add_argument('--strip-at',type=float,default=8.1)
    a=p.parse_args();source=Path(__file__).resolve().parent;output=a.out.resolve();renderer=a.renderer.resolve(strict=True)
    if output.is_relative_to(source) or source.is_relative_to(output):p.error('Output must be separate from source.')
    if output.exists() and any(output.iterdir()):p.error('Output must be empty; existing renders are never overwritten.')
    entry=(source/'video/index.html').read_text('utf-8')
    if re.search(r'<base\b',entry,re.I):p.error('Composition already defines a base URL.')
    entry,n=re.subn(r'(<head\b[^>]*>)',r'\1\n<base href="video/">',entry,count=1,flags=re.I)
    if n!=1:p.error('Composition must have a head element.')
    base=a.work_root.resolve() if a.work_root else Path(tempfile.gettempdir()).resolve()
    if base.is_relative_to(source):p.error('Disposable copy must be outside source.')
    base.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='studio-yebisu-train-llm-from-scratch-',dir=base) as temporary:
        disposable=Path(temporary).resolve()
        assert disposable.is_relative_to(base) and disposable.name.startswith('studio-yebisu-train-llm-from-scratch-')
        project=disposable/'project'
        shutil.copytree(source,project,ignore=shutil.ignore_patterns('.git','.local','.venv','node_modules','__pycache__','*.pyc','*.mp4','*.zip'))
        (project/'index.html').write_text(entry,encoding='utf-8')
        command=['node',str(renderer),'--project',str(project),'--out',str(output),'--step','2','--strip-at',str(a.strip_at)]
        if not a.stills_only:command+=['--video']
        subprocess.run(command,check=True)

if __name__=='__main__':main()
