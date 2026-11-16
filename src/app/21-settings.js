// Kamus app module 21-settings. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
import { esc } from './01-core.js';
import { ENGINES, curAudio, getTts, noServer, setTts, speak, toast } from './02-speech-history-toc.js';
import { WD, wdDownload, wdHasModel, wdRemove, wdState, wdWarm } from './11-wikidepia-web.js';
bridge({
  ttsStatus: [() => ttsStatus, v => { ttsStatus = v; }],
  SAMPLE: [() => SAMPLE],
  ENGINE_INFO: [() => ENGINE_INFO],
  renderTts: [() => renderTts],
  loadStatus: [() => loadStatus],
  ttsBox: [() => ttsBox],
  creditsLoaded: [() => creditsLoaded, v => { creditsLoaded = v; }],
  SPDX: [() => SPDX],
  LIC_ORDER: [() => LIC_ORDER],
  licLink: [() => licLink],
  credEntry: [() => credEntry],
  SOURCE_URL: [() => SOURCE_URL],
  loadCredits: [() => loadCredits]
});

// ---- Settings page
let ttsStatus=null;
const SAMPLE='Selamat pagi, apa kabar?';
const ENGINE_INFO={
  browser:{title:'Browser built-in',desc:'Free and offline. Uses your system’s Indonesian voice.'},
  edge:{title:'edge-tts',desc:'Natural Microsoft Edge voices. Needs internet; clips are cached.',voices:[['gadis','Gadis · female'],['ardi','Ardi · male']]},
  'wikidepia-web':{title:'Wikidepia · in this browser',desc:'Offline neural voices run in your browser (about 121 MB, downloaded once). Non-commercial use.',voices:[['wibowo','Wibowo · audiobook'],['ardi','Ardi'],['gadis','Gadis']]},
  wikidepia:{title:'Wikidepia · on the server',desc:'Offline neural voices on the server’s CPU. Non-commercial use.',voices:[['wibowo','Wibowo · audiobook'],['ardi','Ardi'],['gadis','Gadis']]}
};
function renderTts(){
  const cfg=getTts(),st=ttsStatus||{},wd=st.wikidepia||{};
  const status=e=>{
    if(e!=='browser'&&noServer())return 'Needs the Kamus server (not reachable).';
    if(e==='browser')return speechSynthesis.getVoices().some(v=>v.lang.replace('_','-').startsWith('id'))?'Indonesian system voice found.':'No Indonesian system voice found.';
    if(e==='edge')return ttsStatus?'Ready.':'';
    if(!ttsStatus)return '';
    if(e==='wikidepia-web'){const web=wd.web||{};if(!web.onnx)return 'Not available on this server.';if(wdState.progress)return '';
      const mb=Math.round((wdState.bytes||+localStorage.getItem('kamus-wd-bytes')||web.bytes)/1e6);
      if(!wdState.has)return (wdState.error?`Download failed: ${wdState.error}. `:'')+`Not downloaded (about ${Math.round(web.bytes/1e6)} MB).`;
      return `Ready · ${mb} MB stored`+(WD.info?` · ${WD.info.threads} thread${WD.info.threads===1?'':'s'}`:'')+(window.isSecureContext?'':' (plain http: https is faster)')+(WD.last?` · ${WD.last.audioSec.toFixed(1)}s of speech in ${(WD.last.ms/1000).toFixed(1)}s`:'');}
    if(!wd.env||!wd.model)return 'Not installed (run scripts/install_wikidepia.sh).';
    return 'Ready · CPU'+(wd.last_seconds?` · last sentence ${wd.last_seconds}s`:'')+(wd.error?` · error: ${wd.error}`:'');
  };
  document.getElementById('ttsOptions').innerHTML=ENGINES.map(e=>{
    const info=ENGINE_INFO[e],needsServer=e!=='browser'&&noServer(),disabled=needsServer||(e==='wikidepia'&&ttsStatus&&!wd.ready),locked=needsServer||(e==='wikidepia-web'&&ttsStatus&&!wdState.has),sel=cfg.engine===e;   // locked: can be chosen only after the model is downloaded; its Download button stays usable
    return `<div class="opt ${sel?'sel':''} ${disabled?'disabled':''}" aria-disabled="${disabled}" data-engine="${e}" data-locked="${!!locked}">
      <button type="button" class="radio" role="radio" aria-checked="${sel}" aria-disabled="${disabled}" aria-label="${esc(info.title)}"></button>
      <div class="opt-main"><div class="opt-title">${esc(info.title)}</div><div class="opt-desc">${esc(info.desc)}</div>
        ${info.voices?`<div class="vchips">${info.voices.map(([v,l])=>`<button type="button" class="vchip ${cfg[e]===v?'on':''}" data-engine="${e}" data-voice="${v}">${esc(l)}</button>`).join('')}</div>`:''}
        <div class="opt-status">${esc(status(e))}</div>
        ${e==='wikidepia-web'&&ttsStatus&&(wd.web||{}).onnx?(wdState.progress?`<div class="opt-status"><progress id="wdProg" max="${wdState.progress.total||1}" value="${wdState.progress.got}" style="width:100%"></progress><span id="wdProgText"></span></div>`
          :wdState.has?'<button type="button" class="vchip" data-wd="remove" style="margin-top:10px">Remove model from this browser</button>':'<button type="button" class="vchip on" data-wd="download" style="margin-top:10px">Download model</button>'):''}</div>
      <button type="button" class="text-btn" data-test="${e}" ${disabled||locked?'disabled':''}>Test</button></div>`;
  }).join('');
}
async function loadStatus(){try{ttsStatus=await (await fetch('/api/tts/status')).json();}catch{ttsStatus=null;}wdState.has=await wdHasModel();renderTts();}
const ttsBox=document.getElementById('ttsOptions');
ttsBox.addEventListener('click',async e=>{
  const wdb=e.target.closest('[data-wd]');if(wdb){wdb.dataset.wd==='download'?wdDownload():wdRemove();return;}
  const test=e.target.closest('[data-test]'),chip=e.target.closest('.vchip'),opt=e.target.closest('.opt');
  if(test){const en=test.dataset.test;test.textContent='…';speak(SAMPLE,test,{engine:en});
    const a=curAudio;const restore=()=>{test.textContent='Test';loadStatus();};
    if(a){a.addEventListener('ended',restore);a.addEventListener('error',restore);}else setTimeout(restore,1500);return;}
  if(chip){setTts({engine:chip.dataset.engine,[chip.dataset.engine]:chip.dataset.voice});renderTts();wdWarm();return;}
  if(opt&&opt.dataset.locked==='true'){toast('Download the model first (button on this card).');return;}
  if(opt&&opt.getAttribute('aria-disabled')!=='true'){setTts({engine:opt.dataset.engine});renderTts();wdWarm();}
});
ttsBox.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('opt')){e.preventDefault();e.target.click();}});
if('speechSynthesis' in window)speechSynthesis.addEventListener('voiceschanged',()=>{if(document.body.dataset.view==='settings')renderTts();});
let creditsLoaded=false;
const SPDX={'MIT':'MIT','Apache-2.0':'Apache-2.0','BSD-3-Clause':'BSD-3-Clause','MPL-2.0':'MPL-2.0','LGPL-3.0':'LGPL-3.0-only','GPL-3.0':'GPL-3.0-only','AGPL-3.0-or-later':'AGPL-3.0-or-later','CC BY-SA 4.0':'CC-BY-SA-4.0'};
const LIC_ORDER=['MIT','Apache-2.0','BSD-3-Clause','MPL-2.0','LGPL-3.0','GPL-3.0','AGPL-3.0-or-later'];
const licLink=l=>SPDX[l]?`<a href="https://spdx.org/licenses/${SPDX[l]}.html" target="_blank" rel="noopener">${esc(l)}</a>`:esc(l);
function credEntry(i){   // name, licence, version, what it is used for, attribution notice, terms
  return `<div class="cred"><div class="cred-head">${i.url?`<a class="cred-name" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.name)}</a>`:`<span class="cred-name">${esc(i.name)}</span>`}
    <span class="badge">${esc(i.license)}</span>${i.version?`<span class="cred-role">v${esc(i.version)}</span>`:''}</div>
    <div class="cred-role">${esc(i.role)}</div>${i.attribution?`<div class="cred-note"><b>Attribution:</b> ${esc(i.attribution)}</div>`:''}${i.note?`<div class="cred-note">${esc(i.note)}</div>`:''}</div>`;
}
// AGPL section 13: this must point at the source of the version people are actually using. A fork/modified copy changes it to its own repository.
const SOURCE_URL='https://github.com/martin-awal/kamus';
async function loadCredits(){
  if(creditsLoaded)return;
  try{
    let d;try{const r=await fetch('/api/credits');if(!r.ok)throw 0;d=await r.json();}catch{d=await (await fetch('credits.json')).json();}   // static site: the build copies credits.json next to the page
    const it=d.items;
    const restricted=it.filter(i=>i.kind==='software'&&/non-commercial/i.test(i.license)),software=it.filter(i=>i.kind==='software'&&!restricted.includes(i));
    const OTHER='Other or combined licences',groups={};software.forEach(i=>{const k=LIC_ORDER.includes(i.license)?i.license:OTHER;(groups[k]=groups[k]||[]).push(i);});
    const order=Object.keys(groups).sort((a,b)=>{const x=LIC_ORDER.indexOf(a),y=LIC_ORDER.indexOf(b);return (x<0?99:x)-(y<0?99:y);});
    const sect=(n,title,sub,body)=>body?`<h4 class="legal-h">${n}. ${title}</h4><p class="legal-sub">${sub}</p>${body}`:'';
    document.getElementById('creditsList').innerHTML=
      `<p class="legal-lead">Kamus is a personal study tool. It displays content from other people’s dictionaries and uses open-source software, each under its own terms, listed below. Kamus is provided “as is”, without warranty of any kind, and is not affiliated with or endorsed by any project, organisation or company named here.</p>`
      +`<h4 class="legal-h">Kamus licence and source code</h4><p class="legal-sub">Kamus is free software under the <a href="${SOURCE_URL}/blob/main/LICENSE" target="_blank" rel="noopener">GNU Affero General Public License v3.0</a>. You may use, study, change and share it under that licence; if you run a modified copy for other people over a network, you must offer them its source code.</p><p class="legal-sub"><a href="${SOURCE_URL}" target="_blank" rel="noopener">Source code: ${esc(SOURCE_URL.replace('https://',''))}</a></p>`
      +sect(1,'Content and data sources','Shown in lookup results. Attribution notices and usage limits apply.',it.filter(i=>i.kind==='data').map(credEntry).join(''))
      +sect(2,'Online services','Contacted while you use Kamus; their own terms apply.',it.filter(i=>i.kind==='service').map(credEntry).join(''))
      +sect(3,'Open-source software','Grouped by licence; each licence name links to its full text.',order.map(l=>`<div class="cred-group lic">${licLink(l)}</div>`+groups[l].map(credEntry).join('')).join(''))
      +sect(4,'Models with usage restrictions','Free for personal, non-commercial use only.',restricted.map(credEntry).join(''))
      +sect(5,'Fonts, icons and design','',it.filter(i=>i.kind==='asset').map(credEntry).join(''))
      +`<h4 class="legal-h">6. Trademarks</h4><p class="legal-sub">Names such as Microsoft, Edge, Google, Material Design, Anki, AnkiWeb, Wikimedia, Wiktionary, Tatoeba and KBBI belong to their owners and are used only to identify the services and content Kamus works with.</p>`
      +`<p class="cred-note" style="margin-top:24px">Last reviewed: ${esc(d.updated)} · source list: <code>credits.json</code></p>`;
    creditsLoaded=true;
    document.getElementById('licSummary').textContent=`Licences, attributions and terms of use · ${it.length} items`;
  }catch{document.getElementById('creditsList').innerHTML='<p class="muted">Could not load the legal information.</p>';}
}

export { ttsStatus, SAMPLE, ENGINE_INFO, renderTts, loadStatus, ttsBox, creditsLoaded, SPDX, LIC_ORDER, licLink, credEntry, SOURCE_URL, loadCredits };
