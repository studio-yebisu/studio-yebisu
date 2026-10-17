"""Create the four synthetic inputs with the fixed Irodori-TTS CLI, then resample for OpenVoice.
Copyright (c) 2026 Studio Yebisu. MIT License.
Requires a separately installed official Irodori-TTS environment and its cached model dependencies.
Never downloads, substitutes a voice/model, or overwrites an existing output.
"""
from pathlib import Path
import argparse,hashlib,json,os,subprocess
HERE=Path(__file__).resolve().parent
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__)
 for key in ['tts-root','tts-python','checkpoint','hf-cache','out']:p.add_argument('--'+key,type=Path,required=True)
 a=p.parse_args();root=a.tts_root.resolve(strict=True);interpreter=a.tts_python.resolve(strict=True);checkpoint=a.checkpoint.resolve(strict=True);cache=a.hf_cache.resolve(strict=True);out=a.out.resolve()
 if out.is_relative_to(HERE) or HERE.is_relative_to(out) or out.exists():p.error('Use a new output folder outside this example.')
 lock=json.loads((HERE/'tts-lock.json').read_text('utf-8'));req=json.loads((HERE/'input/voice-requests.json').read_text('utf-8'))
 assert req['synthetic_only'] and req['tts']['revision']==lock['revision']
 assert sha(checkpoint)==lock['checkpoint_sha256'] and checkpoint.stat().st_size==lock['bytes']
 assert sha(root/'infer.py')==lock['infer_sha256']
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==lock['code_commit']
 assert not subprocess.check_output(['git','diff','--name-only','--','infer.py','irodori_tts'],cwd=root,text=True).strip()
 voices=req['voices'];assert [v['id'] for v in voices]==['welcome','closing','ichiro','sayaka']
 out.mkdir(parents=True);raw=out/'raw';raw.mkdir()
 env=dict(os.environ,HF_HOME=str(cache.parent),HF_HUB_CACHE=str(cache),HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',PYTHONIOENCODING='utf-8')
 produced=[]
 for v in voices:
  conf=v['tts'];assert conf['repository']==lock['repository'] and conf['revision']==lock['revision'] and conf['steps']==40
  target=out/Path(v['file']).name;original=raw/(v['id']+'.wav')
  cmd=[str(interpreter),'-X','utf8',str(root/'infer.py'),'--checkpoint',str(checkpoint),'--text',v['text'],'--caption',conf['caption'],'--output-wav',str(original),'--model-device','cuda','--model-precision','bf16','--codec-device','cpu','--codec-precision','fp32','--num-steps','40','--seed',str(conf['seed']),'--cfg-scale-text','3','--cfg-scale-caption','3','--cfg-scale-speaker','5']
  if conf['reference']:
   assert v['id']=='closing' and conf['reference']=='welcome';cmd+=['--ref-wav',str(raw/'welcome.wav')]
  else:cmd+=['--no-ref']
  subprocess.run(cmd,cwd=out,env=env,check=True)
  subprocess.run(['ffmpeg','-v','error','-n','-i',str(original),'-ar','22050','-ac','1','-c:a','pcm_s16le','-map_metadata','-1',str(target)],check=True)
  produced.append({'id':v['id'],'file':target.name,'sha256':sha(target),'bytes':target.stat().st_size,'raw_sha256':sha(original)})
 (out/'synthesis.json').write_text(json.dumps({'provider':lock['repository'],'revision':lock['revision'],'files':produced,'listening_confirmed':False,'note':'New generation on another runtime is not guaranteed byte-identical. The distributed frozen WAVs are the original production inputs.'},ensure_ascii=False,indent=2)+'\n','utf-8')
if __name__=='__main__':main()
