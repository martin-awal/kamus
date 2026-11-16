// Kamus app module 09-wiktionary. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
import { idb } from './05-idb.js';
bridge({
  WIKI_REST: [() => WIKI_REST],
  WIKI_API: [() => WIKI_API],
  wikiMem: [() => wikiMem],
  wikiSugMem: [() => wikiSugMem],
  cleanIpa: [() => cleanIpa],
  htmlText: [() => htmlText],
  fetchJSON: [() => fetchJSON],
  wikiPron: [() => wikiPron],
  wikiFetch: [() => wikiFetch],
  wikiLookup: [() => wikiLookup]
});

// ---- Wiktionary, called straight from the browser (it sends CORS headers; KBBI and Tatoeba do not, so those stay on the server)
const WIKI_REST='https://en.wiktionary.org/api/rest_v1/page/definition/',WIKI_API='https://en.wiktionary.org/w/api.php';
const wikiMem=new Map(),wikiSugMem=new Map();
// Wiktionary's narrow transcription uses combining marks (e.g. the dental mark U+032A) that no web font supplies and many systems lack: drop them
const cleanIpa=s=>String(s).replace(/[\u0300-\u036F\u200B-\u200F\u2060\uFEFF]/g,'');
const htmlText=h=>(new DOMParser().parseFromString(h||'','text/html').body.textContent||'').replace(/\s+/g,' ').trim();   // DOMParser: nothing runs or loads
async function fetchJSON(url,ms=12000){const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),ms);
  try{const r=await fetch(url,{signal:ctl.signal});if(r.status===404)return null;if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(t);}}
async function wikiPron(word){
  const j=await fetchJSON(`${WIKI_API}?action=parse&page=${encodeURIComponent(word)}&prop=text&format=json&formatversion=2&disabletoc=1&origin=*`);
  if(!j||!j.parse)return {ipa:[],audio:[]};
  const page=j.parse.text,i=page.indexOf('id="Indonesian"');if(i<0)return {ipa:[],audio:[]};
  const k=page.indexOf('<h2',i+1),sec=page.slice(i,k>0?k:undefined);
  const ipa=[...new Set([...sec.matchAll(/class="IPA[^"]*"[^>]*>([^<]+)</g)].map(m=>cleanIpa(m[1])))].filter(x=>'/['.includes(x[0]));
  const audio=[...new Set([...sec.matchAll(/(?:https:)?\/\/upload\.wikimedia\.org\/[^"'\s]+\.(?:ogg|mp3|wav|opus)/g)].map(m=>m[0].startsWith('//')?'https:'+m[0]:m[0]))];
  return {ipa,audio};
}
async function wikiFetch(word){
  const [def,pron]=await Promise.all([fetchJSON(WIKI_REST+encodeURIComponent(word)),wikiPron(word).catch(()=>({ipa:[],audio:[]}))]);
  const senses=[];
  for(const block of (def&&def.id)||[])for(const d of block.definitions||[]){const gloss=htmlText(d.definition);if(!gloss)continue;
    senses.push({pos:(block.partOfSpeech||'').toLowerCase(),gloss,examples:(d.parsedExamples||[]).map(x=>({id:htmlText(x.example),en:htmlText(x.translation)}))});}
  return {senses,...pron,url:`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#Indonesian`};
}
async function wikiLookup(word){
  word=word.toLowerCase().trim();if(wikiMem.has(word))return wikiMem.get(word);
  const p=(async()=>{
    try{const r=await wikiFetch(word);idb.put('wiki',word,r).catch(()=>{});return r;}
    catch(err){let hit=null;try{hit=await idb.get('wiki',word);}catch{}if(hit){hit.ipa=[...new Set((hit.ipa||[]).map(cleanIpa))];return hit;}throw err;}   // offline: the last answer we saw
  })();
  wikiMem.set(word,p);p.catch(()=>wikiMem.delete(word));return p;
}

export { WIKI_REST, WIKI_API, wikiMem, wikiSugMem, cleanIpa, htmlText, fetchJSON, wikiPron, wikiFetch, wikiLookup };
