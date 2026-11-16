// Kamus app module 15-translation. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
import { esc } from './01-core.js';
import { noServer, toast } from './02-speech-history-toc.js';
import { cbody, draft, updatePreview } from './04-cards-anki.js';
import { idb } from './05-idb.js';
bridge({
  TR_KEY: [() => TR_KEY],
  TR_NAME: [() => TR_NAME],
  getTr: [() => getTr],
  setTr: [() => setTr],
  MT: [() => MT],
  mtDirs: [() => mtDirs],
  mtCall: [() => mtCall],
  MT_SIZES: [() => MT_SIZES],
  mtFiles: [() => mtFiles],
  mtBytes: [() => mtBytes],
  mtRefresh: [() => mtRefresh],
  mtDownload: [() => mtDownload],
  mtRemove: [() => mtRemove],
  mtProgress: [() => mtProgress],
  mmChunks: [() => mmChunks],
  mmDecode: [() => mmDecode],
  mymemoryText: [() => mymemoryText],
  trText: [() => trText],
  trT: [() => trT, v => { trT = v; }],
  trBusy: [() => trBusy],
  trHint: [() => trHint],
  autoFill: [() => autoFill],
  trStatus: [() => trStatus, v => { trStatus = v; }],
  TR_INFO: [() => TR_INFO],
  renderTr: [() => renderTr],
  trBox: [() => trBox],
  loadTrStatus: [() => loadTrStatus]
});

// ---- Translation: fill in the missing language of an example / meaning (engines: MyMemory, Argos Translate, LibreTranslate)
const TR_KEY='kamus-tr',TR_NAME={mymemory:'MyMemory',argos:'Argos Translate',opusmt:'Opus-MT (this browser)',libretranslate:'LibreTranslate'};
const getTr=()=>{try{return {engine:'mymemory',auto:true,url:'',key:'',...JSON.parse(localStorage.getItem(TR_KEY))};}catch{return {engine:'mymemory',auto:true,url:'',key:''};}};
const setTr=patch=>{try{localStorage.setItem(TR_KEY,JSON.stringify({...getTr(),...patch}));}catch{}};
// Opus-MT in the browser (Transformers.js in tr-worker.js); the model files are kept in IndexedDB ('models' store, key mt:<path>)
const MT={worker:null,seq:0,pending:{},has:{},prog:null,err:'',info:null};
const mtDirs=['id-en','en-id'];
function mtCall(msg){
  if(!MT.worker){
    MT.worker=new Worker('/tr-worker.js',{type:'module'});
    MT.worker.onmessage=e=>{const p=MT.pending[e.data.id];if(!p)return;delete MT.pending[e.data.id];e.data.ok?p.res(e.data):p.rej(new Error(e.data.error));};
    MT.worker.onerror=e=>{for(const k in MT.pending){MT.pending[k].rej(new Error(e.message||'translation worker failed'));delete MT.pending[k];}MT.worker=null;};
  }
  return new Promise((res,rej)=>{const id=++MT.seq;MT.pending[id]={res,rej};MT.worker.postMessage({...msg,id});});
}
// The files of each model. They are fetched from this server when it has them (scripts/download_opus_mt.sh), else straight from Hugging Face (it allows cross-origin downloads).
const MT_SIZES={'id-en':[['config.json',1376],['generation_config.json',293],['tokenizer.json',5291338],['tokenizer_config.json',280],['special_tokens_map.json',74],['onnx/encoder_model_quantized.onnx',47674782],['onnx/decoder_model_merged_quantized.onnx',54947024]],
  'en-id':[['config.json',1376],['generation_config.json',293],['tokenizer.json',5291338],['tokenizer_config.json',280],['special_tokens_map.json',74],['onnx/encoder_model_quantized.onnx',47674781],['onnx/decoder_model_merged_quantized.onnx',54947023]]};
const mtFiles=d=>MT_SIZES[d].map(([f,size])=>({path:`/models/opus-mt/Xenova/opus-mt-${d}/${f}`,size,hf:`https://huggingface.co/Xenova/opus-mt-${d}/resolve/main/${f}`}));
const mtBytes=d=>MT_SIZES[d].reduce((a,x)=>a+x[1],0);
async function mtRefresh(){
  for(const d of mtDirs){let ok=true;for(const x of mtFiles(d))if(!(await idb.has('models','mt:'+x.path).catch(()=>false)))ok=false;MT.has[d]=ok;}
}
async function mtDownload(d){
  const files=mtFiles(d),local=!!((((trStatus||{}).opusmt||{})[d]||{}).available);   // this server's copy when it has one
  MT.prog={d,got:0,total:mtBytes(d)};MT.err='';renderTr();
  try{
    let got=0;
    for(const f of files){
      const res=await fetch(local?f.path:f.hf);if(!res.ok)throw new Error('HTTP '+res.status+' '+(local?f.path:f.hf));
      const reader=res.body.getReader(),chunks=[];let n=0;
      for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);n+=value.length;got+=value.length;MT.prog.got=got;mtProgress();}
      if(n!==f.size)throw new Error(`Unexpected size for ${f.path.split('/').pop()} (${n} bytes, expected ${f.size})`);
      await idb.put('models','mt:'+f.path,new Blob(chunks));
    }
    try{await navigator.storage.persist();}catch{}
  }catch(err){MT.err=err.message;for(const f of files)await idb.del('models','mt:'+f.path).catch(()=>{});}
  MT.prog=null;await mtRefresh();renderTr();
}
async function mtRemove(d){
  for(const f of mtFiles(d))await idb.del('models','mt:'+f.path).catch(()=>{});
  if(MT.worker){MT.worker.terminate();MT.worker=null;}   // drops the loaded pipelines too
  await mtRefresh();renderTr();
}
function mtProgress(){const p=document.getElementById('mtProg');if(!p||!MT.prog)return;p.value=MT.prog.got;p.max=MT.prog.total||1;document.getElementById('mtProgText').textContent=` ${(MT.prog.got/1e6).toFixed(0)} / ${(MT.prog.total/1e6).toFixed(0)} MB`;}
// MyMemory is called straight from the browser (it sends CORS headers); the 500-byte limit means long text goes in sentence chunks
const mmChunks=(text,limit=450)=>{const out=[];let cur='';for(const s of text.split(/(?<=[.!?])\s+/)){if(cur&&new TextEncoder().encode(cur+' '+s).length>limit){out.push(cur);cur=s;}else cur=(cur+' '+s).trim();}if(cur)out.push(cur);return out;};
const mmDecode=t=>{const e=document.createElement('textarea');e.innerHTML=t;return e.value;};
async function mymemoryText(text,from,to){
  const key='tr:mm:'+from+to+':'+text;
  try{const hit=await idb.get('wiki',key);if(hit)return hit;}catch{}
  const parts=[];
  for(const ch of mmChunks(text)){
    const r=await fetch('https://api.mymemory.translated.net/get?q='+encodeURIComponent(ch)+'&langpair='+from+'|'+to);
    if(!r.ok)throw new Error('MyMemory: HTTP '+r.status);
    const j=await r.json(),out=mmDecode((j.responseData||{}).translatedText||'');
    if(String(j.responseStatus)!=='200'||/MYMEMORY WARNING/i.test(out))throw new Error('MyMemory: '+out.slice(0,120));
    parts.push(out);
  }
  const res=parts.join(' ');idb.put('wiki',key,res).catch(()=>{});return res;
}
async function trText(text,from,to,override){
  const c={...getTr(),...override};
  if(c.engine==='mymemory')return mymemoryText(text,from,to);
  if(c.engine==='opusmt'){
    const d=from+'-'+to;if(MT.has[d]===undefined)await mtRefresh();if(!MT.has[d])throw new Error('download the '+d+' model in Settings first');
    const r=await mtCall({type:'translate',dir:d,text});MT.info={ms:Math.round(r.ms),loadMs:Math.round(r.loadMs),threads:r.threads};return r.text;
  }
  const r=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,from,to,engine:c.engine,url:c.url,key:c.key})});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'translation failed');return j.text;
}
let trT=0;const trBusy={};
const trHint=(field,text)=>{const e=document.getElementById('trh-'+field);if(e)e.textContent=text||'';};
async function autoFill(){
  if(!draft||!getTr().auto)return;
  const f=draft.fields,auto=draft.auto||(draft.auto={});
  for(const [idF,enF] of [['Example','ExampleEN'],['KBBI','Wiki']]){   // [Indonesian, English]
    const id=(f[idF]||'').trim(),en=(f[enF]||'').trim();let job=null;
    if(id&&(!en||(auto[enF]&&auto[enF].src!==id)))job={target:enF,source:idF,from:'id',to:'en',text:id};
    else if(en&&(!id||(auto[idF]&&auto[idF].src!==en)))job={target:idF,source:enF,from:'en',to:'id',text:en};
    if(!job||trBusy[job.target]===job.text)continue;
    trBusy[job.target]=job.text;trHint(job.target,'Translating…');
    try{
      const out=await trText(job.text,job.from,job.to);
      if(!draft||(draft.fields[job.source]||'').trim()!==job.text||((draft.fields[job.target]||'').trim()&&!draft.auto[job.target]))continue;   // the user changed things meanwhile
      draft.fields[job.target]=out;draft.auto[job.target]={src:job.text};
      const el=cbody.querySelector(`[data-f="${job.target}"]`);if(el)el.value=out;
      trHint(job.target,`Auto-translated with ${TR_NAME[getTr().engine]}; edit if needed.`);updatePreview();
    }catch(err){trBusy[job.target]=null;trHint(job.target,'Translation failed: '+err.message);}
  }
}
let trStatus=null;
const TR_INFO={mymemory:{desc:'Free web service, no setup. Daily limit; quality varies.'},
  argos:{desc:'Open source, works offline on the server (about 100 MB per language pair).'},
  opusmt:{desc:'Argos itself cannot run in a browser, so this is its client-side equivalent: the same kind of open Opus-MT models (Helsinki-NLP), run on this device. Downloaded once (about 108 MB per direction, from this server or from Hugging Face), then fully offline.'},
  libretranslate:{desc:'Open-source server you host or can reach. Needs its address.'}};
function renderTr(){
  const c=getTr(),st=trStatus||{};
  document.getElementById('trAuto').checked=!!c.auto;
  document.getElementById('trOptions').innerHTML=['mymemory','argos','opusmt','libretranslate'].map(e=>{
    const sel=c.engine===e,needsServer=(e==='argos'||e==='libretranslate')&&noServer(),locked=needsServer||(e==='argos'&&trStatus&&!(st.argos||{}).ready)||(e==='opusmt'&&!(MT.has['id-en']||MT.has['en-id']));
    const status=needsServer?'Needs the Kamus server (not reachable).':e==='opusmt'?(MT.err||(MT.has['id-en']&&MT.has['en-id']?'Ready · offline'+(MT.info?` · last ${MT.info.ms} ms`:''):locked?'Download a direction to use it.':'One direction missing: that direction will not translate.')):e==='argos'?(!trStatus?'':locked?'Not installed (run scripts/install_argos.sh).':'Ready · offline'):e==='libretranslate'?(c.url?'Server set.':'Add the server address above.'):'Ready.';
    return `<div class="opt ${sel?'sel':''}" data-tr="${e}" data-locked="${locked}">
      <button type="button" class="radio" role="radio" aria-checked="${sel}" aria-label="${esc(TR_NAME[e])}"></button><div class="opt-main"><div class="opt-title">${TR_NAME[e]}</div><div class="opt-desc">${TR_INFO[e].desc}</div>
      ${e==='opusmt'?`<div class="opt-status">${mtDirs.map(d=>{const lbl=d==='id-en'?'Indonesian → English':'English → Indonesian';
        if(MT.prog&&MT.prog.d===d)return `<div>${lbl}: <progress id="mtProg" max="${MT.prog.total||1}" value="${MT.prog.got}"></progress><span id="mtProgText"></span></div>`;
        return MT.has[d]?`<div>${lbl}: downloaded <button type="button" class="text-btn" data-mtrm="${d}">Remove</button></div>`:`<div>${lbl}: <button type="button" class="text-btn" data-mtdl="${d}">Download${' · '+(mtBytes(d)/1e6).toFixed(0)+' MB'}</button></div>`;}).join('')}</div>`:''}
      ${e==='libretranslate'?`<div class="opt-inputs"><label class="fld"><input data-trin="url" value="${esc(c.url)}" placeholder="https://libretranslate.example.com" aria-label="LibreTranslate address"></label><label class="fld"><input data-trin="key" type="password" value="${esc(c.key)}" placeholder="API key (if required)" aria-label="API key" autocomplete="off"></label></div>`:''}
      <div class="opt-status" id="trs-${e}">${esc(status)}</div></div>
      <button type="button" class="text-btn" data-trtest="${e}" ${locked?'disabled':''}>Test</button></div>`;}).join('');
}
const trBox=document.getElementById('trOptions');
trBox.addEventListener('click',async e=>{
  const dl=e.target.closest('[data-mtdl]'),rm=e.target.closest('[data-mtrm]');
  if(dl){mtDownload(dl.dataset.mtdl);return;}if(rm){mtRemove(rm.dataset.mtrm);return;}
  const t=e.target.closest('[data-trtest]');
  if(t){const en=t.dataset.trtest,out=document.getElementById('trs-'+en);out.textContent='Translating…';
    try{const r=await trText('Pagi ini saya makan ikan.','id','en',{engine:en});out.textContent=`“Pagi ini saya makan ikan.” → “${r}”`;}catch(err){out.textContent='Failed: '+err.message;}return;}
  if(e.target.closest('input'))return;
  const o=e.target.closest('[data-tr]');if(!o)return;
  if(o.dataset.locked==='true'){toast(o.dataset.tr==='opusmt'?'Download an Opus-MT direction first.':'Install Argos Translate first (scripts/install_argos.sh).');return;}
  setTr({engine:o.dataset.tr});renderTr();
});
trBox.addEventListener('change',e=>{const k=e.target.dataset.trin;if(k){setTr({[k]:e.target.value.trim()});renderTr();}});
document.getElementById('trAuto').addEventListener('change',e=>setTr({auto:e.target.checked}));
async function loadTrStatus(){try{trStatus=await (await fetch('/api/translate/status')).json();}catch{trStatus=null;}await mtRefresh();renderTr();}


export { TR_KEY, TR_NAME, getTr, setTr, MT, mtDirs, mtCall, MT_SIZES, mtFiles, mtBytes, mtRefresh, mtDownload, mtRemove, mtProgress, mmChunks, mmDecode, mymemoryText, trText, trT, trBusy, trHint, autoFill, trStatus, TR_INFO, renderTr, trBox, loadTrStatus };
