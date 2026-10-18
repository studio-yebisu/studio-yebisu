"""Derive an actual log-Mel display from the fixed example WAV, without model inference.
Copyright (c) 2026 Studio Yebisu. MIT License.
"""
from pathlib import Path
import argparse,hashlib,json,wave
import numpy as np
import torch
from whisper.audio import log_mel_spectrogram,N_SAMPLES,N_FRAMES
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--audio',type=Path,required=True);p.add_argument('--waveform',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
 assert not a.out.exists(),'Never overwrite previous derived feature.'
 raw=a.audio.read_bytes();audio_sha=hashlib.sha256(raw).hexdigest();wf=json.loads(a.waveform.read_text('utf-8-sig'));assert audio_sha==wf['audio_sha256']
 with wave.open(str(a.audio),'rb') as w:
  assert w.getframerate()==16000 and w.getsampwidth()==2 and w.getnchannels()==1;frames=w.getnframes();signal=np.frombuffer(w.readframes(frames),dtype='<i2').astype(np.float64)
 rms=[round(float(np.sqrt(np.mean(signal[i:i+1600]**2))/32768),6) for i in range(0,len(signal),1600)]
 assert rms==wf['values'],'Original RMS input must agree sample-for-sample.'
 torch.set_num_threads(4)
 with torch.no_grad():mel=log_mel_spectrogram(str(a.audio),n_mels=80,padding=N_SAMPLES).cpu().numpy()
 content_frames=mel.shape[1]-N_FRAMES;content=mel[:,:content_frames];bounds=np.linspace(0,content_frames,97,dtype=int);pooled=np.stack([content[:,bounds[i]:bounds[i+1]].mean(axis=1) for i in range(96)],axis=1)
 lo,hi=float(pooled.min()),float(pooled.max());display=np.round((pooled-lo)/(hi-lo),6)
 result={'format':'whisper-feature-display/v1','source_audio_sha256':audio_sha,'source_frames':frames,'sample_rate':16000,'duration_seconds':frames/16000,'api':'whisper.audio.log_mel_spectrogram(audio,n_mels=80,padding=N_SAMPLES)','padded_log_mel_shape':list(mel.shape),'content_log_mel_shape':list(content.shape),'display_shape':list(display.shape),'axis':'Rows are80melbands(low-to-high); columns96timebins. Mean each contenttimebin, then globalminmax normalize for display. Not confidence, word alignment or a captured model activation.','pooled_value_range':[lo,hi],'display_matrix':display.tolist(),'rms_window_samples':1600,'rms_values_verified':len(rms),'scope':'New preprocessing-only visualization of original unchanged audio through fixedofficialaudioAPI. Same API/padding as transcribe, cropped to originalcontent fordisplay. No load_model, model.forward, decode or transcribe invoked; prior ASR outputs reused unchanged.'}
 a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n','utf-8');print(json.dumps({'shape':list(display.shape),'log_mel':list(mel.shape),'content':list(content.shape),'rms_windows':len(rms),'asr_inference':False,'audio_sha256':audio_sha}))
if __name__=='__main__':main()
