// Kamus app module 10-tatoeba. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
import { esc, ico } from './01-core.js';
import { ex } from './02-speech-history-toc.js';
import { reEsc } from './04-cards-anki.js';
import { idb } from './05-idb.js';
import { WIKI_API, fetchJSON, wikiSugMem } from './09-wiktionary.js';
bridge({
  TATOEBA: [() => TATOEBA],
  tatMem: [() => tatMem],
  tatoebaFetch: [() => tatoebaFetch],
  tatoebaLookup: [() => tatoebaLookup],
  wikiSuggest: [() => wikiSuggest],
  wikiCardHtml: [() => wikiCardHtml],
  swapWikiCard: [() => swapWikiCard]
});

// ---- Tatoeba, also called straight from the browser (api.tatoeba.org sends CORS headers; CC BY 2.0 FR, each sentence carries its licence)
const TATOEBA='https://api.tatoeba.org/v1/sentences',tatMem=new Map();
async function tatoebaFetch(word){
  const j=await fetchJSON(`${TATOEBA}?lang=ind&q=${encodeURIComponent(word)}&trans%3Alang=eng&is_unapproved=no&sort=relevance&limit=30`,10000);
  const re=new RegExp('(?<!\\p{L})'+reEsc(word)+'(?!\\p{L})','iu'),out=[];
  for(const x of (j&&j.data)||[]){
    if(!re.test(x.text))continue;
    const en=(x.translations||[]).find(t=>t.lang==='eng');
    if(en)out.push({id:x.text,en:en.text,tatoeba_id:x.id});
    if(out.length>=5)break;
  }
  return out;
}
async function tatoebaLookup(word){
  word=word.toLowerCase().trim();if(tatMem.has(word))return tatMem.get(word);
  const p=(async()=>{
    try{const r=await tatoebaFetch(word);idb.put('wiki','tat:'+word,r).catch(()=>{});return r;}
    catch(err){let hit=null;try{hit=await idb.get('wiki','tat:'+word);}catch{}if(hit)return hit;throw err;}   // offline: the last answer we saw
  })();
  tatMem.set(word,p);p.catch(()=>tatMem.delete(word));return p;
}
async function wikiSuggest(prefix){
  prefix=prefix.toLowerCase().replace(/[^\p{L}\p{N} -]/gu,'').slice(0,30).trim();if(!prefix)return [];
  if(wikiSugMem.has(prefix))return wikiSugMem.get(prefix);
  const j=await fetchJSON(`${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(`incategory:Indonesian_lemmas prefix:"${prefix}"`)}&srnamespace=0&srlimit=20&format=json&origin=*`,8000);
  const titles=[...new Set(((j&&j.query&&j.query.search)||[]).map(h=>h.title).filter(t=>t.toLowerCase().startsWith(prefix)))].sort((a,b)=>a.length-b.length||a.localeCompare(b)).slice(0,6);
  if(wikiSugMem.size>300)wikiSugMem.clear();wikiSugMem.set(prefix,titles);return titles;
}
function wikiCardHtml(wk){   // null = still loading, false = failed, object = result (no card when it has no senses)
  if(wk===null)return `<section class="card" id="sec-en"><h3>English <span class="badge">Wiktionary</span></h3><p class="muted">Looking up Wiktionary…</p></section>`;
  if(wk===false)return `<section class="card" id="sec-en"><h3>English <span class="badge">Wiktionary</span></h3><p class="muted">Wiktionary could not be reached from this browser.</p></section>`;
  if(!wk.senses.length)return '';
  return `<section class="card" id="sec-en"><h3>English <span class="badge">Wiktionary</span></h3>
      ${wk.ipa.length?`<p class="pron">${wk.ipa.map(esc).join(' · ')}${wk.audio.slice(0,1).map(u=>`<audio controls src="${esc(u)}"></audio>`).join('')}</p>`:''}
      <ol>${wk.senses.map((s,j)=>`<li class="has-add"><span class="pos">${esc(s.pos)}</span> <span class="def" lang="en">${esc(s.gloss)}</span>${s.examples.map(x=>ex(x.id,x.en)).join('')}<button class="icon-btn sm addcard" data-add="wk" data-s="${j}" title="Create Anki card" aria-label="Create Anki card">${ico('add')}</button></li>`).join('')}</ol>
      <p class="src"><a href="${esc(wk.url)}" target="_blank" rel="noopener">View on Wiktionary</a> · CC BY-SA</p></section>`;
}
function swapWikiCard(html){const el=document.getElementById('sec-en');if(html){if(el)el.outerHTML=html;}else if(el)el.remove();}


export { TATOEBA, tatMem, tatoebaFetch, tatoebaLookup, wikiSuggest, wikiCardHtml, swapWikiCard };
