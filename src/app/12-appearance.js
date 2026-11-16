// Kamus app module 12-appearance. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
import { ico } from './01-core.js';
import { getTts, setTts } from './02-speech-history-toc.js';
bridge({
  SEEDS: [() => SEEDS],
  renderTheme: [() => renderTheme],
  spd: [() => spd],
  spdVal: [() => spdVal],
  showSpeed: [() => showSpeed]
});

// ---- Appearance + speech speed (Settings)
const SEEDS=[['#6750a4','Purple (Material default)'],['#0b57d0','Blue'],['#006a6a','Teal'],['#386a20','Green'],['#7d5700','Amber'],['#a04100','Orange'],['#b3261e','Red'],['#984061','Pink'],['#7d5635','Brown']];
function renderTheme(){
  const cur=KamusTheme.current().toLowerCase(),md=KamusTheme.mode();
  const preset=SEEDS.some(([h])=>h===cur);
  document.getElementById('themeBox').innerHTML=`<div class="seg" role="radiogroup" aria-label="Light or dark">${[['light','Light'],['dark','Dark'],['system','Use system']].map(([k,n])=>`<button type="button" role="radio" class="${md===k?'on':''}" aria-checked="${md===k}" data-mode="${k}">${md===k?ico('check'):''}${n}</button>`).join('')}</div>
    <div class="swatches" role="group" aria-label="Seed colour">${SEEDS.map(([h,n])=>`<button type="button" class="swatch ${cur===h?'on':''}" data-seed="${h}" style="--sw:${h}" aria-label="${n}" aria-pressed="${cur===h}" title="${n}">${cur===h?ico('check'):''}</button>`).join('')}
    <label class="swatch custom ${preset?'':'on'}" ${preset?'':`style="--sw:${cur}"`} title="Custom colour">${preset?ico('add'):ico('check')}<input type="color" id="themeCustom" value="${cur}" aria-label="Custom colour"></label></div>
    <div class="theme-row"><button type="button" class="text-btn" id="themeReset">Reset to default</button></div>`;
}
document.getElementById('themeBox').addEventListener('click',e=>{const mb=e.target.closest('[data-mode]');if(mb){KamusTheme.setMode(mb.dataset.mode);renderTheme();return;}
  const s=e.target.closest('[data-seed]');if(s){KamusTheme.apply(s.dataset.seed);renderTheme();}
  if(e.target.id==='themeReset'){KamusTheme.apply(KamusTheme.DEFAULT);renderTheme();}});
document.getElementById('themeBox').addEventListener('input',e=>{if(e.target.id==='themeCustom'){KamusTheme.apply(e.target.value);e.target.parentElement.style.setProperty('--sw',e.target.value);}});
document.getElementById('themeBox').addEventListener('change',e=>{if(e.target.id==='themeCustom')renderTheme();});
const spd=document.getElementById('ttsSpeed'),spdVal=document.getElementById('ttsSpeedVal');
function showSpeed(){const s=getTts().speed;spd.value=s;spdVal.textContent=s.toFixed(2)+'×';}
spd.addEventListener('input',()=>{setTts({speed:+spd.value});spdVal.textContent=(+spd.value).toFixed(2)+'×';});
document.getElementById('ttsSpeedReset').onclick=()=>{setTts({speed:1});showSpeed();};


export { SEEDS, renderTheme, spd, spdVal, showSpeed };
