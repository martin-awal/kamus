// Kamus app module 07-id-source. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
/* global cleanIpa, fetchJSON */   // from later modules, or assigned here: reached through the window bridge
import { bridge } from './bridge.js';
import { getJSON, kcache } from './03-quicklook.js';
import { capFirst } from './04-cards-anki.js';
import { idb } from './05-idb.js';
bridge({
  IDSRC_KEY: [() => IDSRC_KEY],
  getIdSrc: [() => getIdSrc],
  setIdSrc: [() => setIdSrc],
  idLabel: [() => idLabel],
  idApi: [() => idApi],
  IDW_API: [() => IDW_API],
  idwMem: [() => idwMem],
  IDW_POS: [() => IDW_POS],
  idwiktParse: [() => idwiktParse],
  idwiktFetch: [() => idwiktFetch],
  idwiktLookup: [() => idwiktLookup],
  idLookup: [() => idLookup],
  kbbiData: [() => kbbiData]
});

// ---- Where the Indonesian definitions come from: Indonesian Wiktionary (default, read by the browser) or, optionally, KBBI through the Kamus server
const IDSRC_KEY='kamus-idsrc';
const getIdSrc=()=>{try{const v=localStorage.getItem(IDSRC_KEY);return v==='kbbi-web'||v==='kbbi-api'?v:'wikt';}catch{return 'wikt';}};
const setIdSrc=v=>{try{localStorage.setItem(IDSRC_KEY,v);}catch{}};
const idLabel=src=>src==='wikt'?'Wiktionary (id)':'KBBI';
const idApi=src=>src==='kbbi-api'?'api':'web';
const IDW_API='https://id.wiktionary.org/w/api.php',idwMem=new Map();
const IDW_POS={nomina:'n',verba:'v',adjektiva:'a',adverbia:'adv',pronomina:'pron',numeralia:'num',preposisi:'pre',konjungsi:'kon',partikel:'p'};   // the page's usual KBBI-style codes
function idwiktParse(html,word){
  const doc=new DOMParser().parseFromString(html,'text/html'),h=doc.getElementById('Bahasa_Indonesia');if(!h)return [];
  const text=n=>(n.textContent||'').replace(/\s+/g,' ').trim();
  let node=h.closest('.mw-heading')||h.parentElement,syll='',ipa='',pos=null;const senses=[];
  for(node=node.nextElementSibling;node&&!node.classList.contains('mw-heading2');node=node.nextElementSibling){
    const hy=node.querySelector&&node.querySelector('.hyphenation');if(hy&&!syll)syll=text(hy);
    const ip=node.querySelector&&node.querySelector('.IPA');if(ip&&!ipa)ipa=cleanIpa(text(ip));
    if(node.classList.contains('section-header-def')){const dt=node.querySelector('dt');pos=dt?[IDW_POS[text(dt).toLowerCase()]||'']:[''];continue;}
    if(node.tagName!=='OL'||pos===null)continue;
    for(const li of node.children){
      if(li.tagName!=='LI')continue;
      const cite=[...li.querySelectorAll('.citation-whole')].filter(w=>{const y=+(((w.querySelector('.cited-source b')||{}).textContent)||0);return y>=1972;}).map(w=>{const n=w.querySelector('.e-normalization')||w.querySelector('.e-quotation');return n?text(n).replace(/^\[|\]$/g,''):'';}).filter(Boolean).slice(0,2);   // only quotations in the current spelling (1972 on)
      const c=li.cloneNode(true);c.querySelectorAll('ul,ol,dl,style,sup,.mw-editsection').forEach(n=>n.remove());
      const parts=c.innerHTML.split(/<br\s*\/?>/i),tmp=document.createElement('div');
      tmp.innerHTML=parts[0];const def=text(tmp).replace(/[:;\s]+$/,'');
      if(!def||/rfdef|memerlukan penerangan/i.test(def))continue;
      tmp.innerHTML=parts.slice(1).join(' ');
      let exs=[...tmp.querySelectorAll('i')].map(text).flatMap(t=>t.split(';')).map(t=>t.trim()).filter(t=>t.length>3);
      if(!exs.length)exs=cite;
      senses.push({pos:pos[0]?[pos[0]]:[],definition:def,examples:exs.map(capFirst).slice(0,3)});
    }
  }
  if(!senses.length)return [];
  return [{headword:word,syllables:(syll||word).replace(/\u2027/g,'·'),ipa,exactIpa:true,senses:senses.slice(0,10)}];
}
async function idwiktFetch(word){
  const j=await fetchJSON(`${IDW_API}?action=parse&page=${encodeURIComponent(word)}&prop=text&format=json&formatversion=2&disabletoc=1&redirects=1&origin=*`);
  if(!j||!j.parse)return {entries:[],base:null};   // no such page
  return {entries:idwiktParse(j.parse.text,word),base:null};
}
async function idwiktLookup(word){
  word=word.toLowerCase().trim();if(idwMem.has(word))return idwMem.get(word);
  const p=(async()=>{
    try{const r=await idwiktFetch(word);idb.put('wiki','idw:'+word,r).catch(()=>{});return r;}
    catch(err){let hit=null;try{hit=await idb.get('wiki','idw:'+word);}catch{}if(hit)return hit;throw new Error('Wiktionary could not be reached from this browser.');}   // offline: the last answer we saw
  })();
  idwMem.set(word,p);p.catch(()=>idwMem.delete(word));return p;
}
async function idLookup(word){   // -> {entries, base, src, warnings}
  const src=getIdSrc();
  if(src==='wikt'){const r=await idwiktLookup(word);return {entries:r.entries,base:null,src,warnings:[]};}
  let d;try{d=await (await fetch('/api/lookup?q='+encodeURIComponent(word)+'&src='+idApi(src))).json();}catch(err){throw new Error('Could not reach the server: '+err.message);}
  if(d.error)throw new Error('Error: '+d.error);
  return {entries:d.kbbi,base:d.kbbi_base,src,warnings:d.warnings||[]};
}
const kbbiData=async w=>{   // quick-look sheet: the same source as the main lookup
  const src=getIdSrc();
  if(src==='wikt'){
    try{
      const r=await idwiktLookup(w);
      if(!r.entries.length&&KamusStem.hasWordlist())for(const c of KamusStem.candidates(w).slice(0,3)){const x=await idwiktLookup(c.stem).catch(()=>null);if(x&&x.entries.length)return {entries:x.entries,base:c.stem};}
      return r;
    }catch{return {error:true};}
  }
  return getJSON(kcache,'/api/kbbi?q='+encodeURIComponent(w)+'&src='+idApi(src));
};


export { IDSRC_KEY, getIdSrc, setIdSrc, idLabel, idApi, IDW_API, idwMem, IDW_POS, idwiktParse, idwiktFetch, idwiktLookup, idLookup, kbbiData };
