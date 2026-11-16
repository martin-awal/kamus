// Kamus app module 08-wordlist. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
/* global fetchJSON, renderStorage */   // from later modules, or assigned here: reached through the window bridge
import { bridge } from './bridge.js';
import { idb } from './05-idb.js';
bridge({
  WL_KEY: [() => WL_KEY],
  wlState: [() => wlState],
  wlUse: [() => wlUse],
  wlLoad: [() => wlLoad],
  wlSnapshot: [() => wlSnapshot],
  wlDownload: [() => wlDownload],
  wlRemove: [() => wlRemove]
});

// ---- Word list for the stemmer: titles of English Wiktionary's Indonesian lemmas (about 34,000 words), downloaded once on request and kept in IndexedDB
const WL_KEY='wordlist:v1',wlState={has:false,n:0,bytes:0,at:0,progress:0,busy:false,error:''};
function wlUse(words,at,source){const set=new Set(words);KamusStem.setWordlist(set);Object.assign(wlState,{has:true,n:set.size,bytes:words.join('\n').length,at,source});}
async function wlLoad(){
  try{const v=await idb.get('wiki',WL_KEY);if(v&&v.words){wlUse(v.words.split('\n'),v.at,v.source||'wiktionary');return;}}catch{}
  await wlSnapshot();   // first run: the list that ships with Kamus (same address, about 200 KB), no request to Wikimedia
}
async function wlSnapshot(){
  try{
    const r=await fetch('/data/wordlist-id.txt');if(!r.ok)return false;
    const words=(await r.text()).split('\n').filter(w=>/^[a-z]+$/.test(w));if(words.length<1000)return false;   // a static host may answer with its 404 page
    const at=Date.now();await idb.put('wiki',WL_KEY,{words:words.join('\n'),n:words.length,at,source:'snapshot'}).catch(()=>{});wlUse(words,at,'snapshot');return true;
  }catch{return false;}
}
async function wlDownload(){
  if(wlState.busy)return;wlState.busy=true;wlState.error='';wlState.progress=0;
  try{
    const words=new Set();
    for(const cat of ['Category:Indonesian_lemmas','Category:Indonesian_non-lemma_forms']){
      let cont='';
      do{
        const j=await fetchJSON(`https://en.wiktionary.org/w/api.php?action=query&list=categorymembers&cmtitle=${cat}&cmlimit=500&cmnamespace=0&cmprop=title&format=json&origin=*`+(cont?`&cmcontinue=${encodeURIComponent(cont)}`:''),20000);
        if(!j)throw new Error('Wiktionary did not answer');
        for(const m of j.query.categorymembers)if(/^[a-z]+$/.test(m.title))words.add(m.title);   // single lowercase words only (no names, no phrases)
        cont=(j.continue&&j.continue.cmcontinue)||'';wlState.progress=words.size;if(typeof renderStorage==='function'&&document.body.dataset.view==='settings')renderStorage();
      }while(cont);
    }
    const text=[...words].sort().join('\n');await idb.put('wiki',WL_KEY,{words:text,n:words.size,at:Date.now(),source:'wiktionary'});
    KamusStem.setWordlist(words);Object.assign(wlState,{has:true,n:words.size,bytes:text.length,at:Date.now(),source:'wiktionary'});
  }catch(err){wlState.error=err.message||String(err);}
  wlState.busy=false;if(document.body.dataset.view==='settings')renderStorage();
}
async function wlRemove(){try{await idb.del('wiki',WL_KEY);}catch{}KamusStem.setWordlist(null);Object.assign(wlState,{has:false,n:0,bytes:0,at:0});}
wlLoad();


export { WL_KEY, wlState, wlUse, wlLoad, wlSnapshot, wlDownload, wlRemove };
