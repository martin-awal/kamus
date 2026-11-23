// Kamus app module 22-routing-lookup. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
/* global serverUp, aFilter:writable, aText:writable, lastResult:writable */   // from later modules, or assigned here: reached through the window bridge
import { bridge } from './bridge.js';
import { esc, ico, out, pg, q } from './01-core.js';
import { buildToc, closeSheet, ex, fitIdle, hideSuggest, remember, say, snack, stopSpeech, syncBtn, toast } from './02-speech-history-toc.js';
import { closeQuick, hideChip } from './03-quicklook.js';
import { ankiDlg, cardsReady, clip, closeCard, loadAnki, stateOf } from './04-cards-anki.js';
import { idLookup, idwiktLookup } from './07-id-source.js';
import { wlDownload, wlSnapshot, wlState } from './08-wordlist.js';
import { wikiLookup } from './09-wiktionary.js';
import { swapWikiCard, tatoebaLookup, wikiCardHtml } from './10-tatoeba.js';
import { getZh, renderZh, swapZhCard, zhCardHtml, zhLookup } from './10b-chinese.js';
import { wdWarm } from './11-wikidepia-web.js';
import { renderTheme, showSpeed } from './12-appearance.js';
import { renderInstall } from './13-install.js';
import { loadTrStatus } from './15-translation.js';
import { renderSync } from './16-sync-tile.js';
import { handleSyncHash } from './17-sync-import.js';
import { renderStorage } from './18-storage-tile.js';
import { loadIdSrc } from './19-id-source-settings.js';
import { onServerKnown } from './20-no-server.js';
import { loadCredits, loadStatus, renderTts } from './21-settings.js';
bridge({
  navKamus: [() => navKamus],
  navAnki: [() => navAnki],
  navSettings: [() => navSettings],
  navLearn: [() => navLearn],
  navAffix: [() => navAffix],
  route: [() => route],
  mineCards: [() => mineCards, v => { mineCards = v; }],
  mineLoad: [() => mineLoad],
  MINE_LABEL: [() => MINE_LABEL],
  mineHits: [() => mineHits, v => { mineHits = v; }],
  minePinned: [() => minePinned, v => { minePinned = v; }],
  mineT: [() => mineT, v => { mineT = v; }],
  ankiFocusIds: [() => ankiFocusIds, v => { ankiFocusIds = v; }],
  mineHtml: [() => mineHtml],
  mineSize: [() => mineSize],
  mineSet: [() => mineSet],
  renderMine: [() => renderMine],
  goAnki: [() => goAnki],
  morphHtml: [() => morphHtml],
  go: [() => go]
});

// ---- routing: #settings / (anything else = Kamus)
const navKamus=document.getElementById('navKamus'),navAnki=document.getElementById('navAnki'),navSettings=document.getElementById('navSettings'),navLearn=document.getElementById('navLearn'),navAffix=document.getElementById('navAffix');
function route(){
  const v={'#settings':'settings','#anki':'anki','#legal':'legal','#licences':'legal','#learn':'learn','#affixes':'affix'}[location.hash]||'kamus';
  document.body.dataset.view=v;
  for(const k of ['kamus','learn','anki','affix','settings','legal'])document.getElementById('view'+k[0].toUpperCase()+k.slice(1)).hidden=v!==k;
  navKamus.setAttribute('aria-current',v==='kamus'?'page':'false');navAnki.setAttribute('aria-current',v==='anki'?'page':'false');navLearn.setAttribute('aria-current',v==='learn'?'page':'false');navAffix.setAttribute('aria-current',v==='affix'?'page':'false');navSettings.setAttribute('aria-current',v==='settings'||v==='legal'?'page':'false');   // Legal information is a sub-page of Settings
  const TITLES={kamus:'Kamus',learn:'Learn',anki:'Anki',affix:'Affix lessons',settings:'Settings',legal:'Legal information'};
  document.getElementById('pageTitle').innerHTML=v==='kamus'?'Kamus <small>Indonesian ⇄ English</small>':TITLES[v];
  document.title=v==='kamus'?'Kamus':TITLES[v]+' · Kamus';
  stopSpeech();closeSheet();closeQuick();hideChip();closeCard();
  if(v==='settings'){renderZh();onServerKnown();loadIdSrc();renderSync();renderStorage();renderInstall();loadTrStatus();renderTheme();showSpeed();renderTts();loadStatus();loadCredits();}
  if(v==='legal')loadCredits();
  if(window.KamusLearn&&(v==='learn'||v==='affix'||(v==='kamus'&&!lastResult)))cardsReady.then(()=>KamusLearn.enter(v));
  if(v==='anki')loadAnki();if(v!=='kamus')closeCard();
  if(v!=='anki'&&ankiDlg.open)ankiDlg.close();
  scrollTo(0,0);
}
navKamus.onclick=()=>{location.hash='#kamus';};
navAnki.onclick=()=>{location.hash='#anki';};
navLearn.onclick=()=>{location.hash='#learn';};
navAffix.onclick=()=>{location.hash='#affixes';};
navSettings.onclick=()=>{location.hash='#settings';};
document.getElementById('licBack').onclick=()=>{location.hash='#settings';};
document.getElementById('reloadBtn').onclick=async e=>{   // refresh the app files (not the user's data) and reload
  e.currentTarget.disabled=true;
  try{const regs=(navigator.serviceWorker&&await navigator.serviceWorker.getRegistrations())||[];await Promise.all(regs.map(r=>r.update().catch(()=>{})));
    const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('kamus-shell-')).map(k=>caches.delete(k)));}catch{}
  location.reload();};
addEventListener('hashchange',()=>{if(location.hash.startsWith('#sync='))handleSyncHash();else route();});

let mineCards=[];
const mineLoad=()=>cardsReady.then(()=>KamusCards.list()).then(l=>{mineCards=l;}).catch(()=>{mineCards=[];});
const MINE_LABEL={notsynced:'Not in Anki',sent:'In Anki',new:'New',learning:'Learning',review:'Review'};
let mineHits=[],minePinned=false,mineT=0,ankiFocusIds=null;
function mineHtml(){
  const d=lastResult;if(!d)return '';
  const words=new Set([d.word,...d.kbbi.map(e=>e.headword)].map(w=>w.toLowerCase()));
  const hits=mineCards.filter(c=>words.has(c.word.toLowerCase()));
  mineHits=hits;if(!hits.length)return '';
  const inAnki=hits.some(c=>c.note_id),first=hits[0];
  return `<aside class="mine-float" id="mineFloat" aria-label="Your cards for this word">
    <button type="button" class="mine-chip" data-mine-open aria-expanded="false" aria-label="Your cards: ${esc(first.meaning)}">${ico('cards')}<span>${esc(clip(first.meaning,26))}${hits.length>1?` +${hits.length-1}`:''}</span></button>
    <div class="mine mine-body"><div class="mine-head"><button type="button" class="mine-go" data-mine-go title="Open these cards on the Anki page">${inAnki?'In your Anki':'Your cards'}${ico('arrow')}</button><button type="button" class="icon-btn sm" data-mine-min aria-label="Minimise" title="Minimise">${ico('minus')}</button></div>${hits.map(c=>{const st=stateOf(c);
    return `<div class="mine-row"><span class="mine-m">${esc(c.meaning)}</span>${c.fields.POS?`<span class="pos">${esc(c.fields.POS)}</span>`:''}<span class="badge">${MINE_LABEL[st]}</span>${c.dirty&&c.note_id?'<span class="badge warn">Desynced</span>':''}</div>`;}).join('')}</div></aside>`;
}
function mineSize(m,open){   // the card morphs between the chip's and the body's measured size
  const el=m.querySelector(open?'.mine-body':'.mine-chip');m.style.width=el.offsetWidth+'px';m.style.height=el.offsetHeight+'px';
}
function mineSet(open){const m=document.getElementById('mineFloat');if(!m)return;m.classList.toggle('open',open);mineSize(m,open);const c=m.querySelector('.mine-chip');if(c)c.setAttribute('aria-expanded',open);}
function renderMine(){   // always starts as the small chip; the card opens on mouse hover or a tap
  const old=document.getElementById('mineFloat');if(old)old.remove();minePinned=false;clearTimeout(mineT);
  const html=mineHtml();if(!html)return;
  document.body.insertAdjacentHTML('beforeend',html);
  const m=document.getElementById('mineFloat');mineSize(m,false);
  m.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){clearTimeout(mineT);mineSet(true);}});
  m.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!minePinned)mineT=setTimeout(()=>mineSet(false),250);});
}
function goAnki(){   // jump to the Anki page with these cards filtered and highlighted
  if(!mineHits.length)return;
  aText=mineHits[0].word;aFilter='all';ankiFocusIds=new Set(mineHits.map(c=>c.id));
  document.getElementById('aSearch').value=aText;document.querySelectorAll('.a-tools [data-filter]').forEach(x=>x.classList.toggle('on',x.dataset.filter==='all'));
  location.hash='#anki';
}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-mine-open]')){minePinned=true;mineSet(true);return;}
  if(e.target.closest('[data-mine-min]')){minePinned=false;mineSet(false);return;}
  if(e.target.closest('[data-mine-go]')){goAnki();return;}
  const m=document.getElementById('mineFloat');
  if(m&&e.target.closest('#mineFloat')){minePinned=true;return;}   // a click on the opened card (mouse) keeps it open
  if(m&&m.classList.contains('open')&&minePinned){minePinned=false;mineSet(false);}   // tap elsewhere = minimise
});
const morphHtml=a=>{const pre=a.steps.filter(x=>x.kind==='prefix').map(x=>`<b>${esc(x.text)}</b>`),suf=a.steps.filter(x=>x.kind==='suffix').map(x=>`<b>${esc(x.text)}</b>`);
  return [...pre,`<a href="#" class="morph-w" data-gow="${esc(a.stem)}">${esc(a.stem)}</a>`,...suf].join(' + ')+(a.steps.some(x=>x.kind==='redup')?' <span class="muted">(repeated)</span>':'');};
out.addEventListener('click',async e=>{
  const g=e.target.closest('[data-gow]');if(g){e.preventDefault();q.value=g.dataset.gow;fitIdle();syncBtn();go(g.dataset.gow);return;}
  const f=e.target.closest('[data-wl=find]');if(f){const w=f.dataset.w;f.disabled=true;f.textContent='Getting the word list…';if(!(await wlSnapshot()))await wlDownload();if(wlState.has)go(w);else toast('Could not download the word list: '+wlState.error);}
});
// A derived form with no definition of its own (diatur, dianggap): show what its base word means, from English Wiktionary, under the English card
async function baseMeaning(d,bases){
  for(const b of bases){
    let wk;try{wk=await wikiLookup(b);}catch{continue;}
    if(lastResult!==d||!wk||!wk.senses.length||document.getElementById('sec-base-'+b))continue;
    const html=`<section class="card" id="sec-base-${esc(b)}"><h3>Base word: <a href="#" class="morph-w" data-gow="${esc(b)}">${esc(b)}</a> <span class="badge">Wiktionary</span></h3><ol>${wk.senses.slice(0,4).map(x=>`<li><span class="pos">${esc(x.pos)}</span> <span class="def" lang="en">${esc(x.gloss)}</span></li>`).join('')}</ol><p class="src">The meaning of the base word; “${esc(d.word)}” is a form of it. <a href="${esc(wk.url)}" target="_blank" rel="noopener">View on Wiktionary</a> · CC BY-SA</p></section>`;
    const en=document.getElementById('sec-zh')||document.getElementById('sec-en');if(en)en.insertAdjacentHTML('afterend',html);else out.insertAdjacentHTML('beforeend',html);
    break;   // one base word is enough
  }
}
const wordChip=w=>`<a href="#" class="morph-w" data-gow="${esc(w)}">${esc(w)}</a>`;
const didYouMean=word=>{const sim=window.KamusStem?KamusStem.similar(word,6):[];return sim.length?`<p class="didyou">Did you mean: ${sim.map(wordChip).join(' · ')}</p>`:'';};
async function go(word){
  pg.classList.add('on');hideChip();const minePromise=mineLoad();const oldMine=document.getElementById('mineFloat');if(oldMine)oldMine.remove();
  try{
    let r;try{r=await idLookup(word);}catch(err){buildToc(null);out.innerHTML=snack(err.message,true);return;}
    let morph=null;   // how the word is built: ber- + lari (needs the word list)
    if(r.src==='wikt'&&KamusStem.hasWordlist()){
      if(!r.entries.length){for(const c of KamusStem.candidates(word).slice(0,4)){const x=await idwiktLookup(c.stem).catch(()=>null);if(x&&x.entries.length){r={...r,entries:x.entries,base:c.stem};morph=c;break;}}}
      else if(!KamusStem.isKnown(word))morph=KamusStem.analyze(word);   // a word that is itself a known entry is not cut up
    }
    const d={word,kbbi:r.entries,kbbi_base:r.base,wiktionary:null,sentences:[],warnings:r.warnings,source:r.src,morph},wiktOnly=r.src==='wikt';
    buildToc(null);
    const emptyHtml=`<div class="empty"><svg><use href="#i-search"/></svg><p class="h">Tidak ditemukan</p><div>No entry for “${esc(word)}”. Try the base form (makan, not memakan)${wiktOnly?'. Indonesian Wiktionary does not have every word; KBBI can be switched on in Settings → Indonesian definitions':''}.</div>${didYouMean(word)}${wiktOnly&&!KamusStem.hasWordlist()?`<p style="margin-top:12px"><button type="button" class="btn-tonal" data-wl="find" data-w="${esc(word)}">Look for the base word</button><br><span class="muted">Loads a word list of about 200 KB once and keeps it in this browser.</span></p>`:''}</div>`;
    if(!d.kbbi.length&&!wiktOnly){out.innerHTML=emptyHtml;return;}
    lastResult=d;d.wiktionary=null;
    const warn=d.warnings.length?snack('Some sources failed: '+d.warnings.join('; '),true):'';
    const srcLine=r.src==='wikt'?`<p class="src"><a href="https://id.wiktionary.org/wiki/${encodeURIComponent(word)}#Bahasa_Indonesia" target="_blank" rel="noopener">Source: Wiktionary (Indonesian)</a> · CC BY-SA 4.0</p>`:r.src==='kbbi-api'?'<p class="src">Source: KBBI (via the kbbi-api server set up on this Kamus server)</p>':'<p class="src">Source: KBBI (kbbi.web.id)</p>';
    const kb=d.kbbi.map((e,i)=>`<section class="card ${i==0?'hero':''}" ${i<2?`id="${i?'sec-rel':'sec-kbbi'}"`:''}>
      <div class="hero-row"><h2>${esc(e.syllables)}</h2>${say(e.headword,'tonal')}</div>
      ${i==0&&d.morph?`<p class="morph">Word parts: ${morphHtml(d.morph)}</p>`:''}
      ${e.ipa?`<p class="pron">${esc(e.ipa)}${e.exactIpa?'':' · approx.'}</p>`:''}
      <ol>${e.senses.map((s,j)=>`<li class="has-add">${s.pos.length?`<span class="pos">${esc(s.pos.join(' '))}</span>`:''}<span class="def">${esc(s.definition)}</span>${s.examples.map(x=>ex(x)).join('')}<button class="icon-btn sm addcard" data-add="kb" data-e="${i}" data-s="${j}" title="Create Anki card" aria-label="Create Anki card">${ico('add')}</button></li>`).join('')}</ol>
      ${i==0?srcLine:''}</section>`).join('');
    const note=d.kbbi_base?`<div class="snack">${ico('book')}<span>${wiktOnly?`“${esc(word)}” has no entry of its own: showing its base word “${esc(d.kbbi_base)}”.`:`KBBI lists “${esc(word)}” under its base word “${esc(d.kbbi_base)}”.`}</span></div>`:'';
    const noDef=wiktOnly&&!d.kbbi.length&&KamusStem.hasWordlist()?`<div class="snack" id="noDef">${ico('book')}<span>Indonesian Wiktionary has no definition for “${esc(word)}” yet. ${serverUp===false?'':'KBBI (Settings → Indonesian definitions) may have it. '}<span id="noDefChips">${KamusStem.candidates(word).slice(0,3).length?'Base words: '+KamusStem.candidates(word).slice(0,3).map(c=>wordChip(c.stem)).join(' '):''}</span></span></div>`:'';
    const baseHint0=wiktOnly&&!d.kbbi.length&&!KamusStem.hasWordlist()?`<div class="snack">${ico('book')}<span>Indonesian Wiktionary has no definition for “${esc(word)}”. <button type="button" class="text-btn" data-wl="find" data-w="${esc(word)}">Look for the base word</button> <span class="muted">(loads a word list of about 200 KB once)</span></span></div>`:'';
    const baseHint=baseHint0||noDef;
    await minePromise;
    d.sentences=[];out.innerHTML=note+baseHint+warn+kb+wikiCardHtml(null)+zhCardHtml(null);buildToc(d);remember(word,'');renderMine();
    const tat=tatoebaLookup(word).then(list=>{if(lastResult!==d||!list.length)return;d.sentences=list;
      out.insertAdjacentHTML('beforeend',`<section class="card" id="sec-sn"><h3>More example sentences <span class="badge">Tatoeba</span></h3>${list.map(s=>ex(s.id,s.en)).join('')}<p class="src">Tatoeba · CC BY 2.0 FR</p></section>`);buildToc(d);}).catch(()=>{});
    if(getZh().on)zhLookup(word).then(zh=>{if(lastResult===d){swapZhCard(zhCardHtml(zh));buildToc(d);}}).catch(()=>{if(lastResult===d){swapZhCard('');buildToc(d);}});
    const wik=wikiLookup(word).then(wk=>{if(lastResult!==d)return;d.wiktionary=wk;swapWikiCard(wikiCardHtml(wk));buildToc(d);if(!d.kbbi.length){const box=document.getElementById('noDefChips');   // English Wiktionary says what the word is a form of ("passive of menganggap")
        const bases=[...new Set(wk.senses.map(x=>(/\b(?:of|form of)\s+([\p{L}-]{3,})\s*$/u.exec(x.gloss)||[])[1]).filter(Boolean))].filter(b=>b!==word).slice(0,3);
        if(box&&bases.length)box.innerHTML=(box.innerHTML?box.innerHTML+' ':'')+'Form of: '+bases.map(wordChip).join(' ');}if(wk.senses[0])remember(word,wk.senses[0].gloss);
      if(!d.kbbi.length)baseMeaning(d,[...new Set([...(KamusStem.hasWordlist()?KamusStem.candidates(word).map(c=>c.stem):[]),...wk.senses.map(x=>(/\b(?:of|form of)\s+([\p{L}-]{3,})\s*$/u.exec(x.gloss)||[])[1]).filter(Boolean)])].filter(b=>b!==word).slice(0,2));})
      .catch(()=>{if(lastResult===d)swapWikiCard(wikiCardHtml(false));});
    if(!d.kbbi.length)Promise.all([tat,wik]).then(()=>{   // Indonesian Wiktionary had nothing: if the other sources have nothing either, say so
      if(lastResult===d&&!(d.wiktionary&&d.wiktionary.senses.length)&&!d.sentences.length)out.innerHTML=emptyHtml;});
  }catch(err){buildToc(null);out.innerHTML=snack('Error: '+err.message,true);}
  finally{pg.classList.remove('on');}
}
if(window.KamusLearn)KamusLearn.init();
route();handleSyncHash();
(window.requestIdleCallback||setTimeout)(()=>wdWarm());
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
document.getElementById('f').onsubmit=e=>{e.preventDefault();const w=q.value.trim();if(w){hideSuggest();fitIdle();matchMedia('(hover:hover)').matches?q.select():q.blur();go(w);}};

export { navKamus, navAnki, navSettings, navLearn, navAffix, route, mineCards, mineLoad, MINE_LABEL, mineHits, minePinned, mineT, ankiFocusIds, mineHtml, mineSize, mineSet, renderMine, goAnki, morphHtml, go };
