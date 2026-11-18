// Kamus app module 02-speech-history-toc. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
/* global go, idLabel, onServerKnown, wdSource:writable, webSpeak, wikiSuggest */   // from later modules, or assigned here: reached through the window bridge
import { bridge } from './bridge.js';
import { esc, ico, out, q } from './01-core.js';
bridge({
  TTS_KEY: [() => TTS_KEY],
  ENGINES: [() => ENGINES],
  TTS_DEFAULT: [() => TTS_DEFAULT],
  serverUp: [() => serverUp, v => { serverUp = v; }],
  noServer: [() => noServer],
  serverProbe: [() => serverProbe],
  ttsDefault: [() => ttsDefault],
  getTts: [() => getTts],
  getTtsRaw: [() => getTtsRaw],
  setTts: [() => setTts],
  toast: [() => toast],
  curAudio: [() => curAudio, v => { curAudio = v; }],
  stopSpeech: [() => stopSpeech],
  browserSpeak: [() => browserSpeak],
  speak: [() => speak],
  say: [() => say],
  ex: [() => ex],
  snack: [() => snack],
  KEY: [() => KEY],
  hist: [() => hist],
  remember: [() => remember],
  renderHist: [() => renderHist],
  sheet: [() => sheet],
  histBtn: [() => histBtn],
  pinned: [() => pinned, v => { pinned = v; }],
  closeT: [() => closeT, v => { closeT = v; }],
  isOpen: [() => isOpen],
  setSheet: [() => setSheet],
  closeSheet: [() => closeSheet],
  dock: [() => dock],
  hovering: [() => hovering, v => { hovering = v; }],
  syncOpen: [() => syncOpen],
  justFocused: [() => justFocused, v => { justFocused = v; }],
  goBtn: [() => goBtn],
  sug: [() => sug],
  fitIdle: [() => fitIdle],
  syncBtn: [() => syncBtn],
  sugItems: [() => sugItems, v => { sugItems = v; }],
  sugActive: [() => sugActive, v => { sugActive = v; }],
  sugTok: [() => sugTok, v => { sugTok = v; }],
  sugT: [() => sugT, v => { sugT = v; }],
  hideSuggest: [() => hideSuggest],
  drawSuggest: [() => drawSuggest],
  pickSuggest: [() => pickSuggest],
  tocWrap: [() => tocWrap],
  tocList: [() => tocList],
  tocBtn: [() => tocBtn],
  tocT: [() => tocT, v => { tocT = v; }],
  setToc: [() => setToc],
  buildToc: [() => buildToc],
  updateToc: [() => updateToc],
  tocPlace: [() => tocPlace]
});

// ---- text-to-speech: engine + voice come from Settings (localStorage), fallback = browser voice
const TTS_KEY='kamus-tts',ENGINES=['browser','edge','wikidepia','wikidepia-web'];
const TTS_DEFAULT={engine:'edge',edge:'gadis',wikidepia:'wibowo','wikidepia-web':'wibowo',speed:1};
// Is the Kamus server there? (Kamus also works as a plain static website: everything that runs in the browser keeps working.)
let serverUp;   // undefined until probed, then true/false
const noServer=()=>serverUp===false;
const serverProbe=fetch('/api/kbbi/status').then(r=>r.ok?r.json():Promise.reject()).then(j=>{serverUp=true;return j;}).catch(()=>{serverUp=false;return null;})
  .then(j=>{if(typeof onServerKnown==='function')onServerKnown();return j;});
const ttsDefault=()=>({...TTS_DEFAULT,engine:noServer()?'browser':'edge'});
function getTts(){const c=getTtsRaw();c.speed=Math.min(1.5,Math.max(.5,+c.speed||1));return c;}
function getTtsRaw(){
  try{const s=JSON.parse(localStorage.getItem(TTS_KEY));if(s&&ENGINES.includes(s.engine))return {...ttsDefault(),...s};}catch{}
  try{const old=localStorage.getItem('kamus-voice');if(old==='browser')return {...ttsDefault(),engine:'browser'};if(old==='ardi')return {...ttsDefault(),edge:'ardi'};}catch{}
  return {...ttsDefault()};
}
function setTts(patch){try{localStorage.setItem(TTS_KEY,JSON.stringify({...getTts(),...patch}));}catch{}}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),4000);}
let curAudio=null;
function stopSpeech(){speechSynthesis.cancel();if(wdSource){try{wdSource.stop();}catch{}wdSource=null;}if(curAudio){curAudio.pause();curAudio=null;}document.querySelectorAll('.speaking,.loading').forEach(b=>b.classList.remove('speaking','loading'));}
function browserSpeak(t,btn,speed=1){
  const u=new SpeechSynthesisUtterance(t);u.lang='id-ID';u.rate=.85*speed;
  const v=speechSynthesis.getVoices().find(v=>v.lang.replace('_','-').startsWith('id'));if(v)u.voice=v;
  btn.classList.add('speaking','loading');u.onstart=()=>btn.classList.remove('loading');u.onend=u.onerror=()=>btn.classList.remove('speaking','loading');
  speechSynthesis.speak(u);
}
function speak(t,btn,override){
  if(btn.classList.contains('speaking')){stopSpeech();return;}   // tap again while it is loading or playing = stop
  stopSpeech();
  const cfg={...getTts(),...override};
  if(cfg.engine==='browser'||noServer()){browserSpeak(t,btn,cfg.speed);return;}   // without the server only the browser voice exists
  btn.classList.add('speaking','loading');   // the spinner shows until the voice is actually playing
  if(cfg.engine==='wikidepia-web'){
    webSpeak(t,cfg['wikidepia-web'],btn,cfg.speed).catch(err=>{btn.classList.remove('speaking','loading');toast('In-browser Wikidepia: '+err.message+'. Using the browser voice.');browserSpeak(t,btn,cfg.speed);});return;}
  const a=new Audio('/api/tts?engine='+cfg.engine+'&voice='+cfg[cfg.engine]+(cfg.speed!==1?'&speed='+cfg.speed:'')+'&text='+encodeURIComponent(t));curAudio=a;
  const fail=()=>{if(curAudio!==a)return;curAudio=null;btn.classList.remove('speaking','loading');toast((cfg.engine==='edge'?'edge-tts':'Wikidepia TTS')+' is unavailable, using the browser voice.');browserSpeak(t,btn,cfg.speed);};
  a.onplaying=()=>btn.classList.remove('loading');
  a.onended=()=>{btn.classList.remove('speaking','loading');if(curAudio===a)curAudio=null;};
  a.onerror=fail;
  a.play().catch(fail);
}
const say=(t,cls='')=>`<button class="icon-btn ${cls}" data-say="${esc(t)}" aria-label="Listen: ${esc(t)}" title="Listen">${ico('vol')}</button>`;
const ex=(id,en)=>`<div class="ex"><div><div class="id" lang="id">${esc(id)}</div>${en?`<div class="en" lang="en">${esc(en)}</div>`:''}</div>${say(id,'sm')}</div>`;
const snack=(msg,err)=>`<div class="snack ${err?'err':''}">${ico('warn')}<span>${esc(msg)}</span></div>`;

out.addEventListener('click',e=>{const b=e.target.closest('[data-say]');if(b)speak(b.dataset.say,b);});
const KEY='kamus-history2';
function hist(){try{let a=JSON.parse(localStorage.getItem(KEY));if(!a)a=(JSON.parse(localStorage.getItem('kamus-history'))||[]).map(w=>({w,g:''}));return a;}catch{return[];}}
function remember(w,g){try{const old=hist().find(x=>x.w===w);localStorage.setItem(KEY,JSON.stringify([{w,g:g||(old&&old.g)||'',t:Date.now()},...hist().filter(x=>x.w!==w)].slice(0,30)));}catch{}renderHist();if(window.KamusSync)KamusSync.schedule();}
function renderHist(){
  const h=hist();
  document.getElementById('hist').innerHTML=h.length?h.map(x=>`<div role="button" tabindex="0" class="hcard" data-w="${esc(x.w)}"><div class="w">${esc(x.w)}</div>${x.g?`<div class="g">${esc(x.g.length>140?x.g.slice(0,139)+'…':x.g)}</div>`:''}</div>`).join('')
    :`<div class="hempty">${ico('history')}<p>No searches yet.</p></div>`;
}
renderHist();
const sheet=document.getElementById('sheet'),histBtn=document.getElementById('histBtn');
let pinned=false,closeT;
const isOpen=()=>sheet.classList.contains('open');
function setSheet(open){sheet.classList.toggle('open',open);sheet.inert=!open;sheet.setAttribute('aria-hidden',!open);histBtn.setAttribute('aria-expanded',open);}
const closeSheet=()=>{pinned=false;setSheet(false);};
document.getElementById('histTop').onclick=()=>histBtn.click();   // phones: History lives in the header, the bottom bar has no room for page functions
histBtn.onclick=()=>{if(isOpen()&&!pinned){pinned=true;}else if(isOpen()){closeSheet();}else{pinned=true;setSheet(true);}};
// hovering the History item opens its sheet; it closes when the pointer leaves both (unless pinned by a click)
[histBtn,sheet].forEach(el=>{
  el.addEventListener('pointerenter',e=>{if(e.pointerType!=='mouse')return;clearTimeout(closeT);if(el===histBtn)setSheet(true);});
  el.addEventListener('pointerleave',e=>{if(e.pointerType!=='mouse'||pinned)return;clearTimeout(closeT);closeT=setTimeout(()=>setSheet(false),220);});
});
document.getElementById('closeSheet').onclick=()=>{closeSheet();histBtn.focus();};
document.getElementById('clearHist').onclick=()=>{try{localStorage.removeItem(KEY);localStorage.removeItem('kamus-history');localStorage.setItem('kamus-history-cleared',String(Date.now()));}catch{}renderHist();if(window.KamusSync)KamusSync.schedule();};
addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){closeSheet();histBtn.focus();}});
document.getElementById('hist').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-w]')){e.preventDefault();e.target.click();}});
document.getElementById('hist').addEventListener('click',e=>{const c=e.target.closest('[data-w]');if(!c)return;q.value=c.dataset.w;go(c.dataset.w);if(matchMedia('(max-width:599.98px)').matches)closeSheet();fitIdle();});

// hovering the search bar focuses it and selects the text; leaving it unfocuses
const dock=document.querySelector('.dock-in');
let hovering=false;
const syncOpen=()=>dock.classList.toggle('open',hovering||dock.matches(':focus-within'));
dock.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){hovering=true;q.focus();q.select();syncOpen();}});
dock.addEventListener('focusin',syncOpen);
dock.addEventListener('focusout',()=>setTimeout(syncOpen,0));
// a tap/click that focuses the box selects its text (so the next word simply replaces it); clicking again just places the caret
let justFocused=false;
q.addEventListener('focus',()=>{justFocused=true;setTimeout(()=>{q.select();try{q.setSelectionRange(0,q.value.length);}catch{}},0);});
q.addEventListener('mouseup',e=>{if(justFocused){e.preventDefault();justFocused=false;}});
q.addEventListener('blur',()=>{justFocused=false;});
document.getElementById('f').addEventListener('click',e=>{if(e.target===e.currentTarget)q.focus();});
dock.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){hovering=false;if(document.activeElement===q)q.blur();syncOpen();}});

const goBtn=document.getElementById('go'),sug=document.getElementById('suggest');
const fitIdle=()=>dock.style.setProperty('--idle-w',(q.value.trim()?Math.min(Math.max(q.value.trim().length*9+56,96),280):64)+'px');
const syncBtn=()=>{goBtn.disabled=!q.value.trim();};
let sugItems=[],sugActive=-1,sugTok=0,sugT;
function hideSuggest(){sug.hidden=true;sug.innerHTML='';sugItems=[];sugActive=-1;sugTok++;}
function drawSuggest(prefix){
  if(!sugItems.length){sug.hidden=true;sug.innerHTML='';return;}
  sug.innerHTML=sugItems.map((s,i)=>`<div class="sg ${i===sugActive?'active':''}" role="option" data-i="${i}">${ico(s.h?'history':'search')}<span>${s.t?esc(s.w):`<b>${esc(s.w.slice(0,prefix.length))}</b>${esc(s.w.slice(prefix.length))}`}</span>${s.h?'<span class="tag">history</span>':s.t?'<span class="tag">did you mean</span>':''}</div>`).join('');
  sug.hidden=false;
}
function pickSuggest(i){const s=sugItems[i];if(!s)return;q.value=s.w;hideSuggest();syncBtn();fitIdle();q.select();go(s.w);}
q.addEventListener('input',()=>{
  syncBtn();fitIdle();clearTimeout(sugT);
  const prefix=q.value.trim().toLowerCase();if(!prefix){hideSuggest();return;}
  const mine=hist().filter(x=>x.w.startsWith(prefix)&&x.w!==prefix).slice(0,3).map(x=>({w:x.w,h:true}));
  sugItems=mine;sugActive=-1;drawSuggest(prefix);
  const tok=++sugTok;
  sugT=setTimeout(async()=>{
    try{const ws=await wikiSuggest(prefix);
      if(tok!==sugTok)return;
      sugItems=[...mine,...ws.filter(w=>w!==prefix&&!mine.some(m=>m.w===w)).map(w=>({w}))].slice(0,6);
      if(sugItems.length<3&&window.KamusStem)for(const w of KamusStem.similar(prefix,4))if(sugItems.length<6&&!sugItems.some(s=>s.w===w))sugItems.push({w,t:true});   // a typo? offer words one or two letters away
      drawSuggest(prefix);
    }catch{}
  },150);
});
q.addEventListener('keydown',e=>{
  if(sug.hidden)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();sugActive=(sugActive+(e.key==='ArrowDown'?1:-1)+sugItems.length+1)%(sugItems.length+1);if(sugActive===sugItems.length)sugActive=-1;drawSuggest(q.value.trim().toLowerCase());}
  else if(e.key==='Enter'&&sugActive>=0){e.preventDefault();pickSuggest(sugActive);}
  else if(e.key==='Escape'){hideSuggest();}
});
sug.addEventListener('mousedown',e=>e.preventDefault());
sug.addEventListener('click',e=>{const el=e.target.closest('[data-i]');if(el)pickSuggest(+el.dataset.i);});
q.addEventListener('blur',()=>setTimeout(hideSuggest,120));
dock.addEventListener('pointerleave',()=>hideSuggest());
fitIdle();

// table of contents
const tocWrap=document.getElementById('tocWrap'),tocList=document.getElementById('tocList'),tocBtn=document.getElementById('tocBtn');
let tocT;
const setToc=o=>{tocWrap.classList.toggle('open',o);tocBtn.setAttribute('aria-expanded',o);};
function buildToc(d){
  if(!d||!d.kbbi||!d.kbbi.length){tocWrap.classList.add('notoc');setToc(false);return;}
  const items=[['sec-kbbi',idLabel(d.source)+' · '+d.kbbi[0].headword]];
  if(d.kbbi.length>1)items.push(['sec-rel','Related words ('+(d.kbbi.length-1)+')']);
  if(document.getElementById('sec-en'))items.push(['sec-en','English · Wiktionary']);
  if(document.getElementById('sec-sn'))items.push(['sec-sn','Examples · Tatoeba']);
  tocList.innerHTML=items.map(([id,l])=>`<a href="#${id}" data-t="${id}">${esc(l)}</a>`).join('');
  tocWrap.classList.remove('notoc');setToc(false);updateToc();tocPlace();
}
function updateToc(){
  const links=[...tocList.children];if(!links.length)return;
  let act=links[0];
  links.forEach(a=>{const el=document.getElementById(a.dataset.t);if(el&&el.getBoundingClientRect().top<=140)act=a;});
  const el=document.documentElement;if(el.scrollHeight>innerHeight+8&&innerHeight+scrollY>=el.scrollHeight-4)act=links[links.length-1];
  links.forEach(a=>a.classList.toggle('active',a===act));
}
addEventListener('scroll',updateToc,{passive:true});
function tocPlace(){   // wide screens: just below the title row; the container appears once the page has scrolled
  const top=Math.max(16,document.getElementById('hd').offsetHeight+8-scrollY);
  tocWrap.style.setProperty('--toc-top',top+'px');tocWrap.classList.toggle('stuck',scrollY>4);
}
addEventListener('scroll',tocPlace,{passive:true});addEventListener('resize',tocPlace);
tocList.addEventListener('click',e=>{const a=e.target.closest('[data-t]');if(!a)return;e.preventDefault();
  document.getElementById(a.dataset.t).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
  if(!matchMedia('(min-width:1600px)').matches)setToc(false);});
tocBtn.onclick=()=>setToc(!tocWrap.classList.contains('open'));
tocWrap.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!tocWrap.classList.contains('notoc')){clearTimeout(tocT);setToc(true);}});
tocWrap.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){clearTimeout(tocT);tocT=setTimeout(()=>setToc(false),220);}});
document.addEventListener('click',e=>{if(!tocWrap.contains(e.target))setToc(false);});


export { TTS_KEY, ENGINES, TTS_DEFAULT, serverUp, noServer, serverProbe, ttsDefault, getTts, getTtsRaw, setTts, toast, curAudio, stopSpeech, browserSpeak, speak, say, ex, snack, KEY, hist, remember, renderHist, sheet, histBtn, pinned, closeT, isOpen, setSheet, closeSheet, dock, hovering, syncOpen, justFocused, goBtn, sug, fitIdle, syncBtn, sugItems, sugActive, sugTok, sugT, hideSuggest, drawSuggest, pickSuggest, tocWrap, tocList, tocBtn, tocT, setToc, buildToc, updateToc, tocPlace };
