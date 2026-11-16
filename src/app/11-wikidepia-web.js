// Kamus app module 11-wikidepia-web. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
/* global renderTts */   // from later modules, or assigned here: reached through the window bridge
import { bridge } from './bridge.js';
import { getTts } from './02-speech-history-toc.js';
import { idb } from './05-idb.js';
import { fetchJSON } from './09-wiktionary.js';
bridge({
  WD_BASE: [() => WD_BASE],
  WD_MODEL: [() => WD_MODEL],
  WD_CACHE: [() => WD_CACHE],
  WD: [() => WD],
  wdState: [() => wdState],
  wdSource: [() => wdSource, v => { wdSource = v; }],
  wdCtx: [() => wdCtx, v => { wdCtx = v; }],
  WD_KEY: [() => WD_KEY],
  wdHasModel: [() => wdHasModel],
  wdWorker: [() => wdWorker],
  wdCall: [() => wdCall],
  wdAssets: [() => wdAssets],
  wdTokenize: [() => wdTokenize],
  wavEncode: [() => wavEncode],
  wavDecode: [() => wavDecode],
  webSynth: [() => webSynth],
  webSpeak: [() => webSpeak],
  wdWarm: [() => wdWarm],
  webWavBase64: [() => webWavBase64],
  wdDownload: [() => wdDownload],
  wdRemove: [() => wdRemove],
  wdUpdateProgress: [() => wdUpdateProgress]
});

// ---- Wikidepia VITS inside the browser: onnxruntime-web in a worker; the model is downloaded once into the Cache Storage
const WD_BASE='/models/wikidepia/',WD_MODEL=WD_BASE+'vits.onnx',WD_CACHE='kamus-models';
const WD={worker:null,calls:new Map(),seq:0,tokens:null,speakers:null,vocab:null,last:null,info:null};
const wdState={has:false,bytes:0,progress:null,error:''};
let wdSource=null,wdCtx=null;
const WD_KEY='wikidepia-vits';
async function wdHasModel(){
  try{if(await idb.has('models',WD_KEY))return true;}catch{return false;}
  try{   // a model stored by an earlier version in Cache Storage (https/localhost only): move it over
    if(typeof caches!=='undefined'){const c=await caches.open(WD_CACHE),hit=await c.match(WD_MODEL);if(hit){await idb.put('models',WD_KEY,await hit.blob());await c.delete(WD_MODEL);return true;}}
  }catch{}
  return false;
}
function wdWorker(){
  if(!WD.worker){WD.worker=new Worker('/wd-worker.js',{type:'module'});
    WD.worker.onmessage=e=>{const m=e.data,c=WD.calls.get(m.id);if(!c)return;WD.calls.delete(m.id);m.ok?c.resolve(m):c.reject(new Error(m.error));};
    WD.worker.onerror=e=>{for(const c of WD.calls.values())c.reject(new Error('worker error '+(e.message||'')));WD.calls.clear();WD.worker=null;};}
  return WD.worker;
}
const wdCall=(msg,transfer)=>new Promise((resolve,reject)=>{const id=++WD.seq;WD.calls.set(id,{resolve,reject});wdWorker().postMessage({...msg,id},transfer||[]);});
async function wdAssets(){if(!WD.tokens){const [t,s]=await Promise.all([fetch(WD_BASE+'tokens.json').then(r=>r.json()),fetch(WD_BASE+'speakers.json').then(r=>r.json())]);WD.tokens=t;WD.speakers=s;WD.vocab=new Map(t.vocab.map((x,i)=>[x,i]));}}
function wdTokenize(ph){   // same as Coqui's tokenizer for this model: lower-case, collapse spaces, characters -> ids, a blank id around every symbol
  const t=WD.tokens,ids=[];for(const ch of ph.toLowerCase().replace(/\s+/g,' ').trim()){const id=WD.vocab.get(ch);if(id!==undefined)ids.push(id);}
  if(!t.add_blank)return ids;const out=[t.blank_id];for(const id of ids)out.push(id,t.blank_id);return out;
}
function wavEncode(f32,sr){
  const n=f32.length,buf=new ArrayBuffer(44+n*2),v=new DataView(buf),w=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,f32[i]))*32767,true);return new Uint8Array(buf);
}
function wavDecode(ab){const v=new DataView(ab),n=(ab.byteLength-44)/2,f=new Float32Array(n);for(let i=0;i<n;i++)f[i]=v.getInt16(44+i*2,true)/32767;return f;}
async function webSynth(text,voice,opts={}){   // -> {wav:Float32Array, sr, ms, cached}
  await wdAssets();
  const speed=opts.speed||1,key=speed===1?`${voice}/${text}`:`${voice}/x${speed.toFixed(2)}/${text}`;
  if(!opts.phonemes){let hit=null;try{hit=await idb.get('wav',key);}catch{}if(hit)return {wav:wavDecode(hit),sr:WD.tokens.sample_rate,ms:0,cached:true};}
  const ph=opts.phonemes??(await fetchJSON('/api/phonemize?text='+encodeURIComponent(text))).phonemes;   // text -> IPA is the one step that stays on the server
  const ids=wdTokenize(ph),sid=WD.speakers[voice]??WD.speakers.wibowo;
  const r=await wdCall({type:'run',ids,sid,scales:opts.scales||[0.33,1/speed,0.33]});
  WD.last={ms:Math.round(r.ms),audioSec:r.wav.length/WD.tokens.sample_rate,threads:r.threads,isolated:r.isolated};
  if(r.loadMs)WD.info={loadMs:Math.round(r.loadMs),threads:r.threads,isolated:r.isolated};
  if(!opts.phonemes)idb.put('wav',key,wavEncode(r.wav,WD.tokens.sample_rate).buffer).catch(()=>{});
  return {wav:r.wav,sr:WD.tokens.sample_rate,ms:r.ms};
}
async function webSpeak(text,voice,btn,speed=1){
  if(!(await wdHasModel()))throw new Error('the model is not downloaded yet (Settings)');
  const r=await webSynth(text,voice,{speed});
  if(document.body.dataset.view==='settings')renderTts();
  if(!btn.classList.contains('speaking'))return;   // stopped meanwhile
  wdCtx=wdCtx||new AudioContext();if(wdCtx.state==='suspended')await wdCtx.resume();
  const buf=wdCtx.createBuffer(1,r.wav.length,r.sr);buf.copyToChannel(r.wav,0);
  const src=wdCtx.createBufferSource();src.buffer=buf;src.connect(wdCtx.destination);wdSource=src;
  src.onended=()=>{btn.classList.remove('speaking','loading');if(wdSource===src)wdSource=null;};src.start();btn.classList.remove('loading');
}
async function wdWarm(){   // load the model into the worker ahead of the first word (about 4 s)
  if(getTts().engine!=='wikidepia-web'||!(await wdHasModel()))return;
  try{await wdAssets();const r=await wdCall({type:'load'});WD.info={loadMs:Math.round(r.loadMs),threads:r.threads,isolated:r.isolated};if(document.body.dataset.view==='settings')renderTts();}catch{}
}
async function webWavBase64(text,voice){const r=await webSynth(text,voice),b=wavEncode(r.wav,r.sr);let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s);}
async function wdDownload(){
  wdState.progress={got:0,total:0};wdState.error='';renderTts();
  try{
    const res=await fetch(WD_MODEL);if(!res.ok)throw new Error('HTTP '+res.status);
    const total=+res.headers.get('Content-Length')||0,reader=res.body.getReader(),chunks=[];let got=0;
    for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);got+=value.length;wdState.progress={got,total};wdUpdateProgress();}
    await idb.put('models',WD_KEY,new Blob(chunks,{type:'application/octet-stream'}));
    try{await navigator.storage.persist();}catch{}   // ask the browser not to evict it
    wdState.has=true;wdState.bytes=got;try{localStorage.setItem('kamus-wd-bytes',String(got));}catch{}
    if(getTts().engine==='wikidepia-web')wdWarm();
  }catch(err){wdState.error=err.message;}
  wdState.progress=null;renderTts();
}
async function wdRemove(){try{await idb.del('models',WD_KEY);}catch{}if(WD.worker){WD.worker.terminate();WD.worker=null;}wdState.has=false;WD.info=null;try{localStorage.removeItem('kamus-wd-bytes');}catch{}renderTts();}
function wdUpdateProgress(){const pr=wdState.progress,el=document.getElementById('wdProg');if(!pr||!el)return;el.max=pr.total||1;el.value=pr.got;const t=document.getElementById('wdProgText');if(t)t.textContent=`${(pr.got/1e6).toFixed(0)} / ${pr.total?(pr.total/1e6).toFixed(0):'?'} MB`;}


export { WD_BASE, WD_MODEL, WD_CACHE, WD, wdState, wdSource, wdCtx, WD_KEY, wdHasModel, wdWorker, wdCall, wdAssets, wdTokenize, wavEncode, wavDecode, webSynth, webSpeak, wdWarm, webWavBase64, wdDownload, wdRemove, wdUpdateProgress };
