// Kamus app module 19-id-source-settings. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
import { esc } from './01-core.js';
import { toast } from './02-speech-history-toc.js';
import { getIdSrc, setIdSrc } from './07-id-source.js';
bridge({
  kbbiStatus: [() => kbbiStatus, v => { kbbiStatus = v; }],
  ID_INFO: [() => ID_INFO],
  renderIdSrc: [() => renderIdSrc],
  loadIdSrc: [() => loadIdSrc]
});

// ---- Settings: source of the Indonesian definitions
let kbbiStatus=undefined;   // undefined = not asked yet, null = no Kamus server, else {web, api}
const ID_INFO={wikt:{t:'Wiktionary (Indonesian)',d:'An open dictionary (CC BY-SA 4.0) read straight from your browser: no server needed. Not every word has a definition yet.'},
  'kbbi-web':{t:'KBBI via this server (kbbi.web.id)',d:'Needs the Kamus server, which fetches kbbi.web.id for you. KBBI belongs to Badan Bahasa: personal, non-commercial use only.'},
  'kbbi-api':{t:'KBBI via a kbbi-api server',d:'Needs the Kamus server started with KAMUS_KBBI_API_URL set to a kbbi-api compatible server (github.com/raf555/kbbi-api). Same KBBI terms as above.'}};
function renderIdSrc(){
  const cur=getIdSrc(),box=document.getElementById('idsrcOptions');if(!box)return;
  box.innerHTML=['wikt','kbbi-web','kbbi-api'].map(k=>{
    const locked=k==='kbbi-web'?kbbiStatus===null:k==='kbbi-api'?!(kbbiStatus&&kbbiStatus.api):false;
    const status=k==='wikt'?'Ready · in this browser':kbbiStatus===undefined?'Checking the server…':kbbiStatus===null?'Needs the Kamus server (not reachable).':k==='kbbi-api'&&!kbbiStatus.api?'Not set up: start the server with KAMUS_KBBI_API_URL.':'Ready · through the server';
    return `<div class="opt ${cur===k?'sel':''}" role="radio" aria-checked="${cur===k}" tabindex="0" data-idsrc="${k}" data-locked="${locked}"><span class="radio"></span><div class="opt-main"><div class="opt-title">${ID_INFO[k].t}</div><div class="opt-desc">${ID_INFO[k].d}</div><div class="opt-status">${esc(status)}</div></div></div>`;}).join('');
  const lead=document.getElementById('emptyLead');if(lead)lead.textContent=`Definitions in Indonesian (${cur==='wikt'?'Indonesian Wiktionary':'KBBI'}) and English, plus example sentences and pronunciation.`;
}
async function loadIdSrc(){try{kbbiStatus=await (await fetch('/api/kbbi/status')).json();}catch{kbbiStatus=null;}renderIdSrc();}
document.getElementById('idsrcOptions').addEventListener('click',e=>{
  const o=e.target.closest('[data-idsrc]');if(!o)return;
  if(o.dataset.locked==='true'){toast(o.dataset.idsrc==='kbbi-api'?'Start the Kamus server with KAMUS_KBBI_API_URL first.':'This source needs the Kamus server.');return;}
  setIdSrc(o.dataset.idsrc);renderIdSrc();
});
document.getElementById('idsrcOptions').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-idsrc]')){e.preventDefault();e.target.click();}});
renderIdSrc();


export { kbbiStatus, ID_INFO, renderIdSrc, loadIdSrc };
