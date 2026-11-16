// Kamus app module 03-quicklook. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
/* global closeCard, getIdSrc, go, idLabel, kbbiData, trText, wikiLookup */   // from later modules, or assigned here: reached through the window bridge
import { bridge } from './bridge.js';
import { esc, ico, q } from './01-core.js';
import { fitIdle, say, speak, syncBtn } from './02-speech-history-toc.js';
bridge({
  qchip: [() => qchip],
  qsheet: [() => qsheet],
  qbody: [() => qbody],
  qcache: [() => qcache],
  kcache: [() => kcache],
  getJSON: [() => getJSON],
  quickData: [() => quickData],
  qWord: [() => qWord, v => { qWord = v; }],
  qRange: [() => qRange, v => { qRange = v; }],
  qTimer: [() => qTimer, v => { qTimer = v; }],
  qLang: [() => qLang, v => { qLang = v; }],
  qTarget: [() => qTarget, v => { qTarget = v; }],
  selectedWord: [() => selectedWord],
  placeChip: [() => placeChip],
  hideChip: [() => hideChip],
  shortGloss: [() => shortGloss],
  setChip: [() => setChip],
  onSel: [() => onSel],
  closeQuick: [() => closeQuick],
  openQuick: [() => openQuick]
});

// ---- quick look: select a word on the page -> chip with its English gloss -> right side sheet
const qchip=document.createElement('div');qchip.setAttribute('role','group');qchip.className='qchip';qchip.hidden=true;document.body.appendChild(qchip);
const qsheet=document.getElementById('qsheet'),qbody=document.getElementById('qbody');
const qcache=new Map(),kcache=new Map();
const getJSON=(cache,url)=>{if(!cache.has(url))cache.set(url,fetch(url).then(r=>r.json()).catch(()=>({error:true})));return cache.get(url);};
const quickData=w=>wikiLookup(w).catch(()=>({senses:[],ipa:[],audio:[]}));
let qWord='',qRange=null,qTimer,qLang='id',qTarget='';
function selectedWord(){
  const s=getSelection();if(!s||s.isCollapsed||!s.rangeCount)return null;
  const r=s.getRangeAt(0),n=r.commonAncestorContainer,el=n.nodeType===1?n:n.parentElement;
  if(!el||!el.closest('#out,#qsheet,#ankiList,#viewLegal'))return null;
  const t=s.toString().replace(/·/g,'').replace(/\s+/g,' ').trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu,'').toLowerCase();
  if(t.length<2||t.length>40||t.split(' ').length>3||!/^[\p{L}\- ]+$/u.test(t))return null;
  return {t,r,lang:(el.closest('#out [lang],#qsheet [lang],#ankiList [lang],#viewLegal [lang]')||{getAttribute:()=>'id'}).getAttribute('lang')==='en'?'en':'id'   /* the page's own lang=en must not count */};
}
function placeChip(){
  if(!qRange||qchip.hidden)return;
  const rects=qRange.getClientRects();if(!rects.length)return;
  const l=rects[rects.length-1],w=qchip.offsetWidth;
  // sits just under the selected word; above it only if there is no room below
  let x=Math.max(8,Math.min(l.left,innerWidth-w-8)),y=l.bottom+3;
  if(y+28>innerHeight-8)y=l.top-28-3;
  qchip.style.left=x+'px';qchip.style.top=Math.max(8,y)+'px';
}
const hideChip=()=>{qchip.hidden=true;};
const shortGloss=g=>g.replace(/\s*\([^)]*\)/g,'').trim()||g;
function setChip(text,muted,say){   // [speaker] meaning ; the speaker plays `say` (the Indonesian word)
  qchip.className='qchip'+(muted?' muted':'')+(say?'':' nosay');
  qchip.innerHTML=(say?`<button type="button" class="icon-btn sm" data-say="${esc(say)}" aria-label="Listen: ${esc(say)}" title="Listen">${ico('vol')}</button>`:'')+'<span class="qm">'+esc(text)+'</span>';
  qchip.hidden=false;placeChip();
}
function onSel(){
  const s=selectedWord();if(!s){hideChip();return;}
  qWord=s.t;qRange=s.r.cloneRange();qLang=s.lang;qTarget='';setChip('…',true);
  if(s.lang==='en'){   // English text: show its Indonesian translation; the speaker and a tap use that word
    trText(s.t,'en','id').then(r=>{if(qWord!==s.t||qchip.hidden)return;const w=(r||'').trim().toLowerCase().replace(/[.!?]+$/,'');
      qTarget=/^[\p{L}-]+$/u.test(w)?w:'';setChip(w||'No translation',!w,qTarget);}).catch(()=>{if(qWord===s.t&&!qchip.hidden)setChip('Translation unavailable',true);});
    return;
  }
  // Indonesian word: its English meaning from the translation engine chosen in Settings; Wiktionary's gloss if that fails
  const fallback=()=>quickData(qWord).then(d=>{const g=d&&d.senses&&d.senses[0];return g?shortGloss(g.gloss):'';}).catch(()=>'');
  trText(s.t,'id','en').then(r=>{const t=(r||'').trim().replace(/[.!?]+$/,'');if(!t)throw 0;return t;}).catch(fallback).then(t=>{
    if(qWord!==s.t||qchip.hidden)return;
    t?setChip(t,false,s.t):setChip('No English meaning',true,s.t);
  });
}
document.addEventListener('selectionchange',()=>{clearTimeout(qTimer);qTimer=setTimeout(onSel,250);});
addEventListener('scroll',placeChip,{passive:true});addEventListener('resize',placeChip);
qchip.addEventListener('mousedown',e=>e.preventDefault());   // keep the text selected
qchip.addEventListener('click',e=>{const sp=e.target.closest('[data-say]');if(sp){speak(sp.dataset.say,sp);return;}const w=qLang==='en'?qTarget:qWord;if(w)openQuick(w);});
const closeQuick=()=>{qsheet.classList.remove('open');qsheet.inert=true;qsheet.setAttribute('aria-hidden','true');};
document.getElementById('qclose').onclick=closeQuick;
qsheet.addEventListener('click',e=>{const b=e.target.closest('[data-say]');if(b)speak(b.dataset.say,b);});
addEventListener('keydown',e=>{if(e.key==='Escape'){hideChip();closeQuick();closeCard();}});
async function openQuick(w){
  hideChip();
  document.getElementById('qw').textContent=w;document.getElementById('qsay').innerHTML=say(w,'tonal');
  qbody.innerHTML='<p class="note">Loading…</p><div id="qkbbi"></div>';
  qsheet.classList.add('open');qsheet.inert=false;qsheet.setAttribute('aria-hidden','false');
  const d=await quickData(w);
  if(!qsheet.classList.contains('open')||document.getElementById('qw').textContent!==w)return;
  const senses=(d&&d.senses)||[];
  qbody.innerHTML=(d&&d.ipa&&d.ipa.length?`<p class="pron">${d.ipa.map(esc).join(' · ')}</p>`:'')
    +`<h3>English <span class="badge">Wiktionary</span></h3>`
    +(senses.length?`<ol>${senses.slice(0,5).map(s=>`<li><span class="pos">${esc(s.pos)}</span> <span class="def" lang="en">${esc(s.gloss)}</span></li>`).join('')}</ol>`:'<p class="note">No English entry on Wiktionary for this form.</p>')
    +`<h3>Indonesian <span class="badge">${esc(idLabel(getIdSrc()))}</span></h3><div id="qkbbi"><p class="note">Loading…</p></div>`
    +`<button class="btn-filled" id="qopen" type="button">Open full entry</button>`;
  document.getElementById('qopen').onclick=()=>{if(document.body.dataset.view!=='kamus')location.hash='#kamus';q.value=w;fitIdle();syncBtn();go(w);closeQuick();};
  const kd=await kbbiData(w);
  const box=document.getElementById('qkbbi');if(!box||document.getElementById('qw').textContent!==w)return;
  const e=kd&&kd.entries&&kd.entries[0];
  box.innerHTML=e?`${kd.base?`<p class="note">Listed under “${esc(kd.base)}”.</p>`:''}<p class="pron">${esc(e.syllables)}</p><ol>${e.senses.slice(0,3).map(s=>`<li>${s.pos.length?`<span class="pos">${esc(s.pos.join(' '))}</span>`:''}<span class="def">${esc(s.definition)}</span></li>`).join('')}</ol>`
    :`<p class="note">No ${esc(idLabel(getIdSrc()))} entry found.</p>`;
}


export { qchip, qsheet, qbody, qcache, kcache, getJSON, quickData, qWord, qRange, qTimer, qLang, qTarget, selectedWord, placeChip, hideChip, shortGloss, setChip, onSel, closeQuick, openQuick };
