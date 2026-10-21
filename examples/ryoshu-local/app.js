'use strict';
(async()=>{
  const tabs=document.querySelector('#sample-tabs'),result=document.querySelector('#sample-result');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  try{
    const response=await fetch('facts.json');if(!response.ok)throw new Error('保存済みデータを取得できませんでした。ページを再読み込みしてください。');
    const facts=await response.json();if(!Array.isArray(facts.samples)||facts.samples.length!==4)throw new Error('保存済みデータの件数を確認できませんでした。');
    const labels={V001:'通常の科目候補',V004:'資産の検討',V038:'外貨は未確定',V070:'店名を手動補正'};
    const decisions={propose:'提案',asset_review:'資産検討',hold:'保留',block:'停止'};
    function show(id){
      const c=facts.samples.find(x=>x.id===id);if(!c)return;
      for(const b of tabs.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.id===id));
      const a=c.actual,manual=c.manual_corrections||[];
      result.innerHTML=`<article class="sample-card"><figure class="original"><img src="${esc(c.image)}" alt="${esc(c.id+' '+c.title)}"><a href="${esc(c.pdf)}" target="_blank" rel="noopener">原本PDFを開く ↗</a></figure><div><span class="badge">${esc(c.id)} / ${esc(decisions[a.decision]||a.decision)}</span><h3>${esc(c.title)}</h3><dl><dt>日付</dt><dd>${esc(a.date||'未確定')}</dd><dt>支払先</dt><dd>${esc(a.merchant||'未確定')}</dd><dt>税込円額</dt><dd>${a.total==null?'未確定':esc(Number(a.total).toLocaleString('ja-JP')+'円')}</dd><dt>科目候補</dt><dd>${esc(a.account||'未確定')}</dd></dl><p class="sample-note">${esc(c.review_note)}</p>${manual.map(m=>`<p class="correction"><strong>確認欄のみ手動補正</strong><br>${esc(m.before)} → ${esc(m.after)}<br>${esc(m.basis)}。元のモデル候補と採点は保持しています。</p>`).join('')}<p class="small">実行元: ${esc(c.source_run)} / 保存済みの架空データ。帳簿へ未登録です。</p></div></article>`;
    }
    for(const c of facts.samples){const b=document.createElement('button');b.type='button';b.dataset.id=c.id;b.textContent=c.id+' '+labels[c.id];b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>show(c.id));tabs.append(b);}show('V001');
  }catch(error){result.className='error';result.textContent=error.message;tabs.replaceChildren();}
})();
