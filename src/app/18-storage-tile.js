// Kamus app module 18-storage-tile. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
import { esc } from './01-core.js';
import { toast } from './02-speech-history-toc.js';
import { backupCards } from './04-cards-anki.js';
import { idb } from './05-idb.js';
import { wlDownload, wlRemove, wlSnapshot, wlState } from './08-wordlist.js';
import { wikiMem } from './09-wiktionary.js';
import { tatMem } from './10-tatoeba.js';
import { wdRemove } from './11-wikidepia-web.js';
import { mtDirs, mtRemove } from './15-translation.js';
bridge({
  fmtB: [() => fmtB],
  renderStorage: [() => renderStorage]
});

// ---- Storage tile (Settings): what Kamus keeps in this browser
const fmtB=n=>n>=1e9?(n/1e9).toFixed(2)+' GB':n>=1e6?(n/1e6).toFixed(1)+' MB':n>=1e3?Math.round(n/1e3)+' KB':n+' B';
async function renderStorage(){
  const box=document.getElementById('storageBox');if(!box||!navigator.storage||!navigator.storage.estimate){if(box)box.innerHTML='<p class="muted">This browser does not report storage use.</p>';return;}
  const z={n:0,bytes:0},safe=p=>p.catch(()=>z);
  const [est,persisted,cards,look,wav,wd,mt]=await Promise.all([navigator.storage.estimate().catch(()=>({})),(navigator.storage.persisted?navigator.storage.persisted():Promise.resolve(false)).catch(()=>false),
    safe(KamusCards.stats()),safe(idb.stats('wiki')),safe(idb.stats('wav')),safe(idb.stats('models',k=>!String(k).startsWith('mt:'))),safe(idb.stats('models',k=>String(k).startsWith('mt:')))]);
  const used=est.usage||0,quota=est.quota||0,appFiles=(est.usageDetails||{}).caches||0;
  const row=(t,d,sz,btn)=>`<div class="st-row"><div class="st-main"><div class="st-t">${t}</div><div class="st-d">${d}</div></div><span class="st-sz">${sz}</span>${btn||''}</div>`;
  box.innerHTML=`<div class="st-total"><div><b>${fmtB(used)}</b> used${quota?` of about ${fmtB(quota)} this browser allows`:''}</div>${quota?`<progress max="${quota}" value="${used}"></progress>`:''}</div>`
   +row('Your cards',`${cards.n} card${cards.n===1?'':'s'}. Only stored here: back them up.`,fmtB(cards.bytes),`<button type="button" class="text-btn" data-st="backup" ${cards.n?'':'disabled'}>Back up</button>`)
   +row('Lookup cache','Wiktionary, Tatoeba and translation answers, kept for offline use.',fmtB(look.bytes),`<button type="button" class="text-btn" data-st="wiki" ${look.n?'':'disabled'}>Clear</button>`)
   +row('Audio cache','Speech made by the in-browser voice.',fmtB(wav.bytes),`<button type="button" class="text-btn" data-st="wav" ${wav.n?'':'disabled'}>Clear</button>`)
   +row('Voice model (Wikidepia)','Downloaded for offline voices. Download it again in the voice settings.',fmtB(wd.bytes),`<button type="button" class="text-btn" data-st="wd" ${wd.n?'':'disabled'}>Remove</button>`)
   +row('Translation models (Opus-MT)','Downloaded for offline translation.',fmtB(mt.bytes),`<button type="button" class="text-btn" data-st="mt" ${mt.n?'':'disabled'}>Remove</button>`)
   +(appFiles?row('App files','The offline copy of the page and recent lookups (service worker).',fmtB(appFiles),''):'')
   +row('Word list (stemming)',wlState.busy?`Downloading… ${wlState.progress.toLocaleString()} words so far.`:wlState.has?`${wlState.n.toLocaleString()} Indonesian words from Wiktionary (${wlState.source==='snapshot'?'the list that ships with Kamus':'updated '+new Date(wlState.at).toLocaleDateString()}); used to find base words (berlari → lari).`:wlState.error?`Failed: ${esc(wlState.error)}`:'Not loaded: needed to find base words and show word parts (about 200 KB).',fmtB(wlState.bytes),
     wlState.busy?'':wlState.has?`<button type="button" class="text-btn" data-st="wlup" title="Fetch the newest titles from Wiktionary (about a minute)">Update</button><button type="button" class="text-btn" data-st="wlrm">Remove</button>`:`<button type="button" class="text-btn" data-st="wldl">Download</button>`)
   +row('Keep my data',persisted?'The browser has agreed not to delete Kamus data when space runs low.':'The browser may delete Kamus data when space runs low.',persisted?'Protected':'Not protected',persisted?'':`<button type="button" class="text-btn" data-st="persist">Protect</button>`);
}
document.getElementById('storageBox').addEventListener('click',async e=>{
  const b=e.target.closest('[data-st]');if(!b)return;const k=b.dataset.st;
  if(k==='backup')await backupCards();
  else if(k==='wiki'){await idb.clear('wiki');wikiMem.clear();tatMem.clear();toast('Lookup cache cleared.');}
  else if(k==='wav'){await idb.clear('wav');toast('Audio cache cleared.');}
  else if(k==='wd'){await wdRemove();toast('Voice model removed.');}
  else if(k==='mt'){for(const d of mtDirs)await mtRemove(d);toast('Translation models removed.');}
  else if(k==='wldl'){(async()=>{if(!(await wlSnapshot()))await wlDownload();renderStorage();})();return;}
  else if(k==='wlup'){wlDownload();renderStorage();return;}
  else if(k==='wlrm'){await wlRemove();toast('Word list removed.');}
  else if(k==='persist'){let ok=false;try{ok=await navigator.storage.persist();}catch{}toast(ok?'Kamus data is now protected.':'The browser did not agree (it decides by itself, for example for installed apps).');}
  renderStorage();
});


export { fmtB, renderStorage };
