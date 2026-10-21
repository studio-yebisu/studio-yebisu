(()=>{
'use strict';
const RC=window.renderConfig||{};
const W=Math.max(1,Math.round(RC.width||1920)),H=Math.max(1,Math.round(RC.height||1080)),FPS=RC.fps||30,DUR=32;
const PT=H>W,BW=PT?720:1920,BH=PT?1280:1080,K=Math.min(W/BW,H/BH),OX=(W-BW*K)/2,OY=(H-BH*K)/2;
const cv=document.getElementById('film');cv.width=W;cv.height=H;
// Producer integration: software rasterization keeps receipt downscaling stable across seeks.
const c=cv.getContext('2d',{willReadFrequently:true});
const BASE=new URL('.',(document.currentScript&&document.currentScript.src)||location.href);
window.motionConfig={duration:DUR,fps:FPS,width:W,height:H,posterTime:30,audioEvents:[]};
const C={paper:'#f7f7ef',forest:'#24594d',ink:'#203b33',ochre:'#b9852b',amber:'#d99a14',amberL:'#fbe8b4',mute:'#5f716a',rule:'#c9cfc0'};
const FF='"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP",sans-serif';
const IM={};
function load(n,ext){const img=new Image();img.decoding='async';img.src=new URL('assets/'+n+'.'+ext,BASE).href;IM[n]=img;
  return img.decode().then(()=>img,()=>{throw new Error('Image failed to load: '+n);});}

// math
const cl=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const ss=(a,b,t)=>{const x=cl((t-a)/(b-a));return x*x*(3-2*x);};
const ez=(a,b,t)=>{const x=cl((t-a)/(b-a));return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;};
const lerp=(a,b,k)=>a+(b-a)*k;

// drawing helpers
function rr(x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function box(x,y,w,h,r,fill,stroke,lw=2,a=1,sh=0){if(a<=0)return;c.save();c.globalAlpha*=a;
  if(sh){c.shadowColor='rgba(32,59,51,.14)';c.shadowBlur=sh;c.shadowOffsetY=sh/3;}
  rr(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}c.shadowColor='transparent';
  if(stroke){c.lineWidth=lw;c.strokeStyle=stroke;c.stroke();}c.restore();}
function tx(s,x,y,size,col=C.ink,wt=500,al='left',a=1,maxW=0){if(a<=0)return;c.save();c.globalAlpha*=a;
  let z=size;c.font=`${wt} ${z}px ${FF}`;if(maxW)while(c.measureText(s).width>maxW&&z>9){z-=1;c.font=`${wt} ${z}px ${FF}`;}
  c.fillStyle=col;c.textAlign=al;c.textBaseline='middle';c.fillText(s,x,y);c.restore();}
function mw(s,size,wt){c.save();c.font=`${wt} ${size}px ${FF}`;const w=c.measureText(s).width;c.restore();return w;}
function wrap(s,x,y,maxW,size,lh,col,wt,a){if(a<=0)return;c.save();c.font=`${wt} ${size}px ${FF}`;const out=[];let cur='';
  for(const ch of s){if(cur&&c.measureText(cur+ch).width>maxW){out.push(cur);cur=ch;}else cur+=ch;}out.push(cur);c.restore();
  out.forEach((l,i)=>tx(l,x,y+i*lh,size,col,wt,'left',a));}
function link(x1,y1,x2,y2,col,a,dash,head,lw=2.5){if(a<=0)return;c.save();c.globalAlpha*=a;c.strokeStyle=col;c.fillStyle=col;c.lineWidth=lw;c.lineCap='round';
  if(dash)c.setLineDash(dash);c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
  if(head){c.setLineDash([]);const an=Math.atan2(y2-y1,x2-x1),s=lw*4.2;c.beginPath();c.moveTo(x2,y2);
    c.lineTo(x2-s*Math.cos(an-.45),y2-s*Math.sin(an-.45));c.lineTo(x2-s*Math.cos(an+.45),y2-s*Math.sin(an+.45));c.closePath();c.fill();}
  c.restore();}
function pic(img,x,y,w,h){if(!img||!img.complete||!img.naturalWidth)return;const iw=img.naturalWidth,ih=img.naturalHeight,s=Math.min(w/iw,h/ih);
  c.save();rr(x,y,w,h,4);c.clip();c.drawImage(img,x+(w-iw*s)/2,y+(h-ih*s)/2,iw*s,ih*s);c.restore();}
function receipt(img,x,y,w,h,rot,id,a=1){if(a<=0)return;c.save();c.globalAlpha*=a;c.translate(x,y);c.rotate(rot);
  box(-w/2,-h/2,w,h,8,'#fff','#d6dacd',1.5,1,18);const pad=Math.max(4,w*.05),lab=Math.max(13,h*.1);
  pic(img,-w/2+pad,-h/2+pad,w-2*pad,h-2*pad-lab);tx(id,0,h/2-lab*.6,Math.max(10,lab*.62),C.mute,700,'center');c.restore();}
function tick(x,y,s,col,k){if(k<=0)return;c.save();c.globalAlpha*=k;c.strokeStyle=col;c.lineWidth=s*.17;c.lineCap='round';c.lineJoin='round';
  c.beginPath();c.moveTo(x-s*.32,y);c.lineTo(x-s*.07,y+s*.26);c.lineTo(x+s*.36,y-s*.28);c.stroke();c.restore();}
function person(x,y,r,col){c.save();c.fillStyle=col;c.beginPath();c.arc(x,y-r*.42,r*.36,0,Math.PI*2);c.fill();
  c.beginPath();c.arc(x,y+r*.72,r*.68,Math.PI,0);c.fill();c.restore();}
function cursor(x,y,s,a){if(a<=0)return;c.save();c.globalAlpha*=a;c.translate(x,y);c.scale(s,s);c.beginPath();c.moveTo(0,0);c.lineTo(0,26);c.lineTo(7,20);
  c.lineTo(12,31);c.lineTo(17,29);c.lineTo(12,18);c.lineTo(21,18);c.closePath();c.fillStyle=C.ink;c.fill();c.strokeStyle='#fff';c.lineWidth=2;c.stroke();c.restore();}
function sheet(x,y,w,h,lb,fs,a){if(a<=0)return;box(x,y,w,h,8,'#fff',C.forest,1.8,a,10);c.save();c.globalAlpha*=a;const f=h*.3;
  c.fillStyle='#dfe9e3';c.beginPath();c.moveTo(x+w-f,y);c.lineTo(x+w,y+f);c.lineTo(x+w-f,y+f);c.closePath();c.fill();
  c.fillStyle='#dde2d8';c.fillRect(x+14,y+h*.68,w*.5,3);c.fillRect(x+14,y+h*.82,w*.34,3);c.restore();
  tx(lb,x+14,y+h*.36,fs,C.ink,800,'left',a,w-f-60);tx('.csv',x+w-f-8,y+h*.36,fs*.62,C.ochre,700,'right',a);}

// layouts: landscape 16:9 and native portrait recomposition
const LY=PT?{t:{x:40,y1:62,y2:122,s1:30,s2:44,mw:640,sx:40,sy:176,ss:26,sal:'left',sw:640},
  enc:[28,216,664,950],hdr:[52,248,24,15],st:[355,520,685,850,1015].map(y=>({x:160,y})),cw:220,ch:110,cs:[28,16,14],
  pk:[[380,410],[380,520],[380,685],[334,875]],start:[780,410],rw:140,rh:196,tw:56,th:84,
  fld:{dx:16,w:204,h:60,g:6,s1:13,s2:19},tag:[164,36,18],cat:[300,292,370,96],catL:[300,384,256,463],
  chk:[300,808,370,255],cs2:.82,led:[296,785,376,150],row:[372,832,290,86],rs:17,
  sh:i=>[305+(i%2)*187,960+Math.floor(i/2)*74,172,64],shs:18,shN:[305,1132,14],
  shot:[300,296,370,330],shotL:[300,646,16],thb:i=>[312+(i%2)*184,298+Math.floor(i/2)*162,160,148],thL:[300,640,26,22,14,370],
  foot:[360,1226,22,'center',640,360,1256,14,'center']}
 :{t:{x:80,y1:100,y2:178,s1:40,s2:62,mw:920,sx:1840,sy:178,ss:34,sal:'right',sw:820},
  enc:[70,250,1780,680],hdr:[110,292,30,20],st:[300,630,960,1290,1620].map(x=>({x,y:385})),cw:250,ch:130,cs:[34,19,17],
  pk:[[300,690],[630,690],[960,690],[1143,705]],start:[-20,690],rw:200,rh:280,tw:86,th:120,
  fld:{dx:30,w:310,h:80,g:12,s1:17,s2:27},tag:[220,48,24],cat:[130,560,370,260],catL:[470,560,560,454],
  chk:[430,548,400,286],cs2:1,led:[1084,590,410,210],row:[1198,645,280,120],rs:20,
  sh:i=>[1520,520+i*84,210,70],shs:22,shN:[1520,885,16],
  shot:[120,545,580,330],shotL:[120,522,20],thb:i=>[130+i*170,520,150,200],thL:[130,785,34,28,16,660],
  foot:[80,1032,26,'left',900,1840,1032,18,'right']};

const ST=[['文字を読む','Indra OCR 1.1.2'],['AIが候補','Ollama・Qwen3 4B','CPUで動作・GPU不要'],['本人が確認','原本と照らす'],['帳簿に保存','SQLite'],['CSV出力','4形式']];
const ACT=[[3.4,8.2],[8.8,13.2],[13.8,18.2],[19.2,21.2],[21.2,24]],CW=[[8,9],[13,14],[18,19.5],[20.8,21.8]];
const FD=[['日付','2023-11-02'],['支払先','コンビニ みちのく'],['金額','1,760円']];
const RL=['V001・2023-11-02','コンビニ みちのく','1,760円・消耗品費'];
const SH=['汎用CSV','freee','MFクラウド','弥生'],TH=['V001','V004','V038','V070'];
const anchor=i=>{const s=LY.st[i];return PT?[s.x+LY.cw/2,s.y]:[s.x,s.y+LY.ch/2];};
const act=(i,t)=>ss(ACT[i][0]-.5,ACT[i][0],t)*(1-ss(ACT[i][1],ACT[i][1]+.5,t));

function chip(i,t,fin){const L=LY,s=L.st[i],w=L.cw,h=L.ch,x=s.x-w/2,y=s.y-h/2,a=act(i,t),d=ST[i],o=d[2]?[-.24,.1,.32]:[-.13,.22],z=L.cs;
  box(x,y,w,h,18,'#fff',C.forest,2,1,6+a*12);box(x,y,w,h,18,C.forest,null,0,Math.max(a,fin*.12));
  [[C.ink,C.mute,1-a],['#fff','#dcebe4',a]].forEach(([c1,c2,al])=>{tx(d[0],s.x,s.y+o[0]*h,z[0],c1,800,'center',al,w-24);
    tx(d[1],s.x,s.y+o[1]*h,z[1],c2,600,'center',al,w-24);if(d[2])tx(d[2],s.x,s.y+o[2]*h,z[2],c2,600,'center',al,w-24);});}

function catalog(t,a){if(a<=0)return;const [x,y,w,h]=LY.cat;box(x,y,w,h,16,'#fff',C.forest,2,a,14);
  if(PT){tx('SQLite 科目カタログ',x+16,y+18,14,C.forest,700,'left',a);tx('38科目・14確認条件',x+16,y+48,26,C.ink,800,'left',a,w-32);}
  else{tx('SQLite 科目カタログ',x+24,y+34,20,C.forest,700,'left',a);tx('38科目',x+24,y+92,50,C.ink,800,'left',a);tx('14確認条件',x+24,y+150,32,C.ink,800,'left',a);}
  const hl=ss(10.2,10.6,t),fs=PT?13:18,cy=y+h-(PT?20:40);let cx=x+(PT?16:24);
  ['消耗品費','会議費','通信費','旅費交通費'].forEach((s,i)=>{const tw=mw(s,fs,700)+fs*1.2;if(cx+tw>x+w-10)return;
    box(cx,cy-fs*.8,tw,fs*1.6,fs*.8,'#eef1ea',null,0,a);if(!i)box(cx,cy-fs*.8,tw,fs*1.6,fs*.8,C.amberL,C.amber,2,a*hl);
    tx(s,cx+tw/2,cy,fs,C.ink,700,'center',a);cx+=tw+8;});}

function checklist(t,a){if(a<=0)return;const [x,y,w,h]=LY.chk,s=LY.cs2;box(x,y,w,h,18,'#fff',C.forest,2,a,16);
  c.save();c.globalAlpha*=a;person(x+30*s,y+32*s,24*s,C.forest);tx('本人が確認',x+62*s,y+32*s,26*s,C.forest,800,'left',1,w-90*s);
  ['原本','用途','割合','支払元'].forEach((lb,i)=>{const bx=x+24*s+(i%2)*(w/2),by=y+(88+54*Math.floor(i/2))*s,b=26*s;
    box(bx,by-b/2,b,b,5,'#fff',C.ink,2);tick(bx+b/2,by,b,C.forest,ss(14.4+i*.55,14.7+i*.55,t));
    tx(lb,bx+b+12*s,by,28*s,C.ink,800,'left',1,w/2-b-30*s);});
  wrap('日付・支払先・金額・科目・税区分も本人が確認',x+24*s,y+186*s,w-48*s,15*s,19*s,C.mute,500,1);
  const p=ss(16.6,16.9,t)*(1-ss(17.1,17.4,t)),bh=46*s,bw=w-48*s,bx=x+24*s,by=y+h-bh-16*s;
  c.save();c.translate(bx+bw/2,by+bh/2);c.scale(1-.04*p,1-.04*p);box(-bw/2,-bh/2,bw,bh,bh/2,ss(17.1,17.4,t)>.5?'#1b463c':C.forest,null);
  tx('確認して登録',0,0,22*s,'#fff',800,'center',1,bw-20);c.restore();
  const kc=ez(15.9,16.7,t);cursor(lerp(bx+bw*.85+60*s,bx+bw*.7,kc),lerp(by+bh+60*s,by+bh*.5,kc),s,ss(15.8,16.1,t)*(1-ss(17.6,18,t)));
  c.restore();}

function draw(t){
  c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.setLineDash([]);c.clearRect(0,0,W,H);c.fillStyle=C.paper;c.fillRect(0,0,W,H);
  c.save();c.setTransform(K,0,0,K,OX,OY);
  const L=LY,T=L.t,[ex,ey,ew,eh]=L.enc,fin=ss(28.4,29,t);
  // title
  tx('Ryoshu',T.x,T.y1,T.s1,C.forest,800);tx('領収書整理アプリ',T.x+mw('Ryoshu',T.s1,800)+16,T.y1+2,T.s1*.5,C.ochre,700);
  tx('領収書を、このPCで整える。',T.x,T.y2,T.s2,C.ink,800,'left',1,T.mw);
  if(!PT){c.fillStyle=C.ochre;c.fillRect(80,222,120,4);}
  [['OCRもAIも、PCの中で。',ss(3,4,t)*(1-ss(12.4,13.1,t))],['候補を確認して、CSVへ。',ss(13.2,14,t)*(1-ss(27.9,28.4,t))],
   ['候補 → 本人確認 → CSV ・ GitHubで公開',fin]].forEach(([s,a])=>tx(s,T.sx,T.sy+(1-a)*8,T.ss,C.forest,700,T.sal,a,T.sw));
  // persistent PC enclosure
  const q=PT?.5:1,sx=ex+ew/2,sy=ey+eh;c.save();c.fillStyle='#d5dacd';c.beginPath();c.moveTo(sx-60*q,sy);c.lineTo(sx+60*q,sy);
  c.lineTo(sx+80*q,sy+38*q);c.lineTo(sx-80*q,sy+38*q);c.closePath();c.fill();rr(sx-120*q,sy+36*q,240*q,10*q,5*q);c.fill();c.restore();
  box(ex,ey,ew,eh,PT?22:30,'#fcfcf7',C.forest,3,1,26);
  const [hx,hy,hs,hs2]=L.hdr;tx('このPC',hx,hy,hs,C.forest,800);
  if(PT)tx('OCR・AI判断・SQLite帳簿保存は、このPCの中で実行',hx,hy+28,hs2,C.mute,600,'left',1,ew-48);
  else tx('OCR・AI判断・SQLite帳簿保存は、このPCの中で実行',hx+mw('このPC',hs,800)+20,hy,hs2,C.mute,600,'left',1,ew-220);
  // connectors between stations
  for(let i=0;i<4;i++){const a=L.st[i],b=L.st[i+1],k=ez(CW[i][0],CW[i][1],t);
    const p1=PT?[a.x,a.y+L.ch/2+4]:[a.x+L.cw/2+4,a.y],p2=PT?[b.x,b.y-L.ch/2-4]:[b.x-L.cw/2-4,b.y];
    link(p1[0],p1[1],p2[0],p2[1],C.rule,1,null,true,3);if(k>0)link(p1[0],p1[1],lerp(p1[0],p2[0],k),lerp(p1[1],p2[1],k),C.forest,1,null,k>.98,3);}
  for(let i=0;i<5;i++)chip(i,t,fin);
  // packet state (one receipt moving through all stations)
  const en=ez(.3,3.4,t),m3=ez(18,19.5,t),s=ez(8,9,t)+ez(13,14,t)+m3,si=Math.min(2,Math.floor(s)),f=s-si,P=L.pk;
  let px=lerp(P[si][0],P[si+1][0],f),py=lerp(P[si][1],P[si+1][1],f),rot=.03*Math.sin(Math.PI*f);
  if(t<3.4){px=lerp(L.start[0],P[0][0],en);py=lerp(L.start[1],P[0][1],en);rot=(1-en)*-.12;}
  const rw=lerp(L.rw,L.tw,m3),rh=lerp(L.rh,L.th,m3);
  // ledger + reviewed row
  const la=ss(18.6,19.4,t);if(la>0){const [x,y,w,h]=L.led,hy2=y+(PT?22:28);box(x,y,w,h,16,'#f1f5ef',C.forest,2,la,12);
    tx('SQLite 帳簿',x+16,hy2,PT?16:22,C.forest,800,'left',la);tx('確認済みの行',x+w-16,hy2,PT?13:16,C.mute,600,'right',la);}
  const rk=ez(18.9,19.9,t);if(rk>0){const [x0,y,w,h]=L.row,x=x0-(1-rk)*30,z=L.rs;box(x,y,w,h,10,'#fff',C.forest,2,rk,10);box(x,y+8,5,h-16,3,C.forest,null,0,rk);
    RL.forEach((r,i)=>tx(r,x+18,y+h*(.22+.28*i),z,C.ink,i?800:600,'left',rk,i?w-30:w-z*3.4-34));
    const bw=z*3.4;box(x+w-bw-10,y+h*.22-z*.7,bw,z*1.4,z*.7,C.forest,null,0,rk);tx('確認済',x+w-bw/2-10,y+h*.22,z*.7,'#fff',800,'center',rk);}
  // left-stage panels by phase
  catalog(t,ss(9,9.8,t)*(1-ss(13,13.8,t)));
  const cL=L.catL;link(cL[0],cL[1],cL[2],cL[3],C.ochre,ss(9.6,10.2,t)*(1-ss(13,13.6,t)),[5,7],true,2.5);
  checklist(t,ss(13.6,14.3,t)*(1-ss(18,18.8,t)));
  const sa=ss(19.6,20.4,t)*(1-ss(23.6,24.3,t));if(sa>0){const [x,y,w,h]=L.shot;box(x,y,w,h,12,'#fff',C.rule,2,sa,16);
    c.save();c.globalAlpha*=sa;pic(IM['ryoshu-app'],x+8,y+8,w-16,h-16);c.restore();tx('架空データの実画面',L.shotL[0],L.shotL[1],L.shotL[2],C.forest,700,'left',sa);}
  TH.forEach((id,i)=>{const k=ez(24.2+i*.35,25+i*.35,t);if(k<=0)return;const [x,y,w,h]=L.thb(i);receipt(IM[id],x+w/2,y+h/2+(1-k)*30,w,h,0,id,k);});
  const [lx,ly,s1,s2,s3,lw]=L.thL,ta2=ss(25.6,26.3,t);tx('100種類の架空PDFで検証',lx,ly,s1,C.ink,800,'left',ta2,lw);
  tx('原本と結果を公開',lx,ly+s1*1.35,s2,C.forest,800,'left',ta2,lw);
  wrap('※同じ100件を改善にも使用。未知の実領収書での精度を示すものではありません',lx,ly+s1*1.35+s2*1.5,lw,s3,s3*1.35,C.mute,500,ss(26.4,27,t));
  // OCR fields (follow the packet, retract into the row at 18s)
  const fo=1-ss(18,18.9,t);FD.forEach(([lb,v],i)=>{const k=ez(5+i*.45,5.9+i*.45,t)*fo;if(k<=0)return;const F=L.fld,
    x=lerp(px-F.w/2,px+rw/2+F.dx,k),y=lerp(py-F.h/2,py-(3*F.h+2*F.g)/2+i*(F.h+F.g),k);
    box(x,y,F.w,F.h,10,'#fff','#cfd6c9',1.5,k,10);box(x,y+8,5,F.h-16,3,C.forest,null,0,k);
    tx(lb,x+18,y+F.h*.3,F.s1,C.ochre,700,'left',k);tx(v,x+18,y+F.h*.68,F.s2,C.ink,800,'left',k,F.w-30);});
  // station-to-packet links
  const [tgw,tgh,tgf]=L.tag,lk=(i,tg,a)=>{const A=anchor(i);link(A[0],A[1],tg[0],tg[1],C.forest,a,[6,8],true,2.5);};
  lk(0,PT?[px-rw/2-6,py]:[px,py-rh/2-6],act(0,t));lk(2,PT?[px-rw/2-6,py]:[px,py-rh/2-tgh/2-6],act(2,t));
  lk(3,PT?[L.led[0]-4,L.st[3].y]:[L.st[3].x,L.led[1]-4],ss(18.8,19.4,t));lk(4,PT?[L.sh(0)[0]-4,L.st[4].y]:[L.st[4].x,L.sh(0)[1]-4],ss(21,21.6,t));
  // the receipt packet
  receipt(IM.V001,px,py,rw,rh,rot,'V001');
  const sca=ss(4.2,4.5,t)*(1-ss(5.9,6.3,t));if(sca>0){const yy=py-rh/2+ez(4.3,6,t)*rh;c.save();c.globalAlpha*=sca;
    const g=c.createLinearGradient(0,yy-40,0,yy);g.addColorStop(0,'rgba(36,89,77,0)');g.addColorStop(1,'rgba(36,89,77,.22)');
    c.fillStyle=g;c.fillRect(px-rw/2,Math.max(py-rh/2,yy-40),rw,Math.min(40,yy-py+rh/2));c.fillStyle=C.forest;c.fillRect(px-rw/2-8,yy-1.5,rw+16,3);c.restore();}
  // amber AI candidate tag (not a confirmation)
  const kT=ez(10.5,11.5,t),ta=ss(10.5,10.8,t)*(1-ss(18.5,19.3,t));if(ta>0){const A=anchor(1),x=lerp(A[0],px,kT),y=lerp(A[1],py-rh/2,kT),sc=lerp(.6,1,kT);
    link(A[0],A[1],x,y,C.amber,ss(10.4,10.7,t)*(1-ss(12,12.8,t)),[5,7],false,2.5);
    c.save();c.translate(x,y);c.scale(sc,sc);box(-tgw/2,-tgh/2,tgw,tgh,tgh/2,C.amberL,C.amber,2.5,ta,8);
    tx('消耗品費・候補',0,0,tgf,'#6b4a06',800,'center',ta,tgw-20);c.restore();}
  // person's confirmation badge (appears only after the button press)
  const ba=ss(17.1,17.5,t)*(1-ss(18.4,19,t));if(ba>0){const by=py+rh/2;box(px-tgw/2,by-tgh/2,tgw,tgh,tgh/2,C.forest,null,0,ba,8);
    tick(px-tgw/2+tgh*.6,by,tgh*.5,'#fff',ba);tx('本人が確認',px+tgh*.25,by,tgf,'#fff',800,'center',ba,tgw-tgh*1.3);}
  // four CSV sheets fan out from the reviewed row
  const R=L.row,rcx=R[0]+R[2]/2,rcy=R[1]+R[3]/2;SH.forEach((lb,i)=>{const k=ez(21+i*.3,21.9+i*.3,t),a=ss(21+i*.3,21.3+i*.3,t);if(a<=0)return;
    const [x,y,w,h]=L.sh(i);sheet(lerp(rcx-w/2,x,k),lerp(rcy-h/2,y,k),w,h,lb,L.shs,a);});
  tx('各サービスへの取込は未検証',L.shN[0],L.shN[1],L.shN[2],C.mute,600,'left',ss(22.5,23.2,t),PT?360:300);
  // footer caveat (always legible)
  const F=L.foot;tx('初回のモデル取得にはネット接続が必要',F[0],F[1],F[2],C.ink,800,F[3],1,F[4]);
  tx('使い方の図解・架空データ　｜　code MIT・モデル別条件',F[5],F[6],F[7],C.mute,600,F[8],1,F[4]);
  c.restore();}

window.seek=sec=>{const t=cl(Number(sec)||0,0,DUR);draw(t);return t;};
draw(0);
const fontsReady=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();
window.motionReady=Promise.all([fontsReady,load('V001','jpg'),load('V004','jpg'),load('V038','jpg'),load('V070','jpg'),load('ryoshu-app','png')]).then(()=>{draw(0);});
})();
