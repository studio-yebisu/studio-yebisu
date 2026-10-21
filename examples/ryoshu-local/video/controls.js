'use strict';
(async()=>{
  if(window.__MOTION_RENDER__)return;
  const play=document.querySelector('#play'),range=document.querySelector('#time'),clock=document.querySelector('#clock');
  let t=0,running=false,start=0,raf=0;
  function pause(){running=false;cancelAnimationFrame(raf);play.textContent='再生';}
  async function seek(next){t=Math.max(0,Math.min(32,next));await window.seek(t);range.value=String(t);clock.textContent=t.toFixed(1)+' / 32秒';}
  async function tick(now){if(!running)return;await seek((now-start)/1000);if(t>=32){pause();return;}raf=requestAnimationFrame(tick);}
  play.disabled=true;range.disabled=true;
  try{await window.motionReady;await seek(0);play.disabled=false;range.disabled=false;
    play.addEventListener('click',()=>{if(running){pause();return;}if(t>=32)t=0;running=true;start=performance.now()-t*1000;play.textContent='一時停止';raf=requestAnimationFrame(tick);});
    range.addEventListener('input',()=>{pause();seek(Number(range.value));});
    for(const [time,label] of [[0,'PC内で'],[4,'OCR'],[8,'科目候補'],[13,'本人が確認'],[18,'CSVへ'],[24,'100件の検証'],[29,'全体を見る']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{pause();seek(time);});document.querySelector('#jumps').append(b);}
  }catch(error){pause();document.querySelector('#error').textContent='映像素材を準備できませんでした。再読み込みしてください。 '+error.message;}
})();
