// Kamus app module 04-cards-anki. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
/* global ankiFocusIds:writable, autoFill, cleanIpa, getShow, mineLoad, openEditCard, pushEditToAnki, pushNoteUpdate, renderMine, trHint, trT:writable, wavEncode, wdHasModel, webSynth, webWavBase64 */   // from later modules, or assigned here: reached through the window bridge
import { bridge } from './bridge.js';
import { esc, ico, out } from './01-core.js';
import { getTts, noServer, say, speak, toast } from './02-speech-history-toc.js';
import { openQuick, shortGloss } from './03-quicklook.js';
bridge({
  ANKI_URL_KEY: [() => ANKI_URL_KEY],
  ANKI_KEY_KEY: [() => ANKI_KEY_KEY],
  ankiModel: [() => ankiModel, v => { ankiModel = v; }],
  cardList: [() => cardList, v => { cardList = v; }],
  ankiState: [() => ankiState, v => { ankiState = v; }],
  lastResult: [() => lastResult, v => { lastResult = v; }],
  draft: [() => draft, v => { draft = v; }],
  aFilter: [() => aFilter, v => { aFilter = v; }],
  aText: [() => aText, v => { aText = v; }],
  aBusy: [() => aBusy, v => { aBusy = v; }],
  KB_POS: [() => KB_POS],
  WK_POS: [() => WK_POS],
  kbPos: [() => kbPos],
  wkPos: [() => wkPos],
  reEsc: [() => reEsc],
  hasWord: [() => hasWord],
  hintOf: [() => hintOf],
  blankOf: [() => blankOf],
  capFirst: [() => capFirst],
  clip: [() => clip],
  getModel: [() => getModel],
  mrender: [() => mrender],
  skipN: [() => skipN],
  cardCount: [() => cardCount],
  facesHtml: [() => facesHtml],
  csheet: [() => csheet],
  cbody: [() => cbody],
  closeCard: [() => closeCard],
  openCard: [() => openCard],
  POS_LIST: [() => POS_LIST],
  renderDraft: [() => renderDraft],
  updatePreview: [() => updatePreview],
  ankiCfg: [() => ankiCfg],
  isMobile: [() => isMobile],
  ac: [() => ac],
  checkAnki: [() => checkAnki],
  unsynced: [() => unsynced],
  synced: [() => synced],
  ankiChip: [() => ankiChip],
  ankiDlg: [() => ankiDlg],
  chipT: [() => chipT, v => { chipT = v; }],
  chipPinned: [() => chipPinned, v => { chipPinned = v; }],
  exportApkg: [() => exportApkg],
  importFromAnki: [() => importFromAnki],
  backupCards: [() => backupCards],
  restoreCards: [() => restoreCards],
  ankiWebSync: [() => ankiWebSync],
  renderConn: [() => renderConn],
  openAnkiDialog: [() => openAnkiDialog],
  renderAnkiDialog: [() => renderAnkiDialog],
  audioFor: [() => audioFor],
  audioSpec: [() => audioSpec],
  absTts: [() => absTts],
  escSearch: [() => escSearch],
  reportCards: [() => reportCards],
  ensureAnkiModel: [() => ensureAnkiModel],
  syncToAnki: [() => syncToAnki],
  refreshProgress: [() => refreshProgress],
  stateOf: [() => stateOf],
  STATE_LABEL: [() => STATE_LABEL],
  renderCards: [() => renderCards],
  ldMq: [() => ldMq],
  ankiSel: [() => ankiSel, v => { ankiSel = v; }],
  renderAnkiDetail: [() => renderAnkiDetail],
  deleteCard: [() => deleteCard],
  cardsReady: [() => cardsReady],
  loadCards: [() => loadCards],
  loadAnki: [() => loadAnki]
});

// ---- Anki cards: one word + one meaning = one note, 4 cards (model comes from /api/anki/model)
const ANKI_URL_KEY='kamus-ankiurl',ANKI_KEY_KEY='kamus-ankikey';
let ankiModel=null,cardList=[],ankiState={state:'unknown'},lastResult=null,draft=null,aFilter='all',aText='',aBusy='';
const KB_POS={n:'n.',v:'v.',a:'adj.',adv:'adv.',num:'num.',pron:'pron.',p:'part.',pre:'prep.',kon:'conj.'};
const WK_POS={noun:'n.',verb:'v.',adjective:'adj.',adverb:'adv.',pronoun:'pron.',preposition:'prep.',conjunction:'conj.',numeral:'num.',particle:'part.','proper noun':'n.'};
const kbPos=s=>{const t=(s.pos||[]).find(x=>KB_POS[x]);return t?KB_POS[t]:'';};
const wkPos=s=>WK_POS[(s.pos||'').toLowerCase()]||'';
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const hasWord=(text,w)=>!!text&&new RegExp('(?<!\\w)'+reEsc(w)+'(?!\\w)','i').test(text);
const hintOf=w=>w.split(/\s+/).map(p=>[p[0],...[...p].slice(1).map(c=>/\p{L}/u.test(c)?'_':c)].join(' ')).join(' · ');
const blankOf=(ex,w)=>hasWord(ex,w)?ex.replace(new RegExp('(?<!\\w)'+reEsc(w)+'(?!\\w)','gi'),'[ … ]'):'';
const capFirst=s=>String(s).replace(/^(\s*)(\p{L})/u,(m,sp,c)=>sp+c.toUpperCase());   // first letter of an Indonesian sentence
const clip=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
async function getModel(){
  if(!ankiModel){ankiModel=await (await fetch('/anki-model.json')).json();
    const css=ankiModel.css.split('}').map(r=>{const i=r.indexOf('{');if(i<0)return '';const sels=r.slice(0,i).split(',').map(s=>s.trim()).filter(s=>s&&!/night/i.test(s));
      return sels.length?sels.map(s=>/^\.card\b/.test(s)?s.replace(/^\.card/,'.acard'):'.acard '+s).join(',')+r.slice(i)+'}':'';}).join('\n');
    const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);}
  return ankiModel;
}
function mrender(tpl,f){   // also {{^Field}}…{{/Field}} (shown when empty)
  tpl=tpl.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,(_,k,inner)=>f[k]?'':inner);
  let prev;do{prev=tpl;tpl=tpl.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,(_,k,inner)=>f[k]?inner:'');}while(tpl!==prev);
  return tpl.replace(/\{\{(\w+)\}\}/g,(_,k)=>{const v=f[k]||'';return /^\[sound:/.test(v)?'<span class="snd">🔊</span>':esc(v);});
}
const skipN=f=>[1,2,3,4].filter(n=>f['Skip'+n]).length,cardCount=f=>4-skipN(f);
function facesHtml(f,toggles){
  const pf={...f,ExampleBlank:blankOf(f.Example||'',f.Word||''),Hint:hintOf(f.Word||'x'),Audio:f.Word?'[sound:x]':'',ExampleAudio:f.Example?'[sound:x]':''};
  return ankiModel.templates.map((t,i)=>{const front=mrender(t.Front,pf);
    const off=!!f['Skip'+(i+1)];
    return `<div class="face${off?' off':''}"><div class="face-head">${toggles?`<label class="face-on"><input type="checkbox" data-skip="${i+1}" ${off?'':'checked'}><span class="face-name">${esc(t.Name)}</span></label>`:`<span class="face-name">${esc(t.Name)}${off?' · off':''}</span>`}<span class="face-tabs"><button type="button" class="vchip on" data-side="front">Front</button><button type="button" class="vchip" data-side="back">Back</button></span></div>`
      +(front.trim()?`<div class="acard" data-pane="front">${front}</div><div class="acard" data-pane="back" hidden>${mrender(t.Back,pf)}</div>`:`<div class="face-none">${off?'Turned off: this card is not made.':'No card is made from this template (a field it needs is empty).'}</div>`)+'</div>';}).join('');
}
document.addEventListener('click',e=>{const b=e.target.closest('.face .vchip');if(!b)return;const face=b.closest('.face');
  face.querySelectorAll('.vchip').forEach(x=>x.classList.toggle('on',x===b));face.querySelectorAll('[data-pane]').forEach(x=>x.hidden=x.dataset.pane!==b.dataset.side);});

// -- "+" next to each meaning in the results -> create-card sheet
const csheet=document.getElementById('csheet'),cbody=document.getElementById('cbody');
const closeCard=()=>{csheet.classList.remove('open');csheet.inert=true;csheet.setAttribute('aria-hidden','true');};
function openCard(kind,ei,si){
  const d=lastResult;if(!d)return;const wk=d.wiktionary||{senses:[],ipa:[]};
  let entry,ks,ws,word;
  const zhs=(d.zh&&d.zh.senses)||[];
  if(kind==='zh'){word=d.word;entry=d.kbbi.find(e=>e.headword===word)||d.kbbi[0];ks=entry&&entry.senses[0];ws=wk.senses[0];}
  else if(kind==='kb'){entry=d.kbbi[ei];ks=entry.senses[si];word=entry.headword;const pos=kbPos(ks);ws=wk.senses.find(w=>pos&&wkPos(w)===pos)||wk.senses[0];}
  else{ws=wk.senses[si];word=d.word;entry=d.kbbi.find(e=>e.headword===word)||d.kbbi[0];const pos=wkPos(ws);ks=entry&&(entry.senses.find(s=>pos&&kbPos(s)===pos)||entry.senses[0]);}
  const exs=[];const addEx=(id,en,src)=>{id=id&&capFirst(id);if(id&&!exs.some(x=>x.id===id))exs.push({id,en:en||'',src});};
  if(ws)ws.examples.forEach(x=>addEx(x.id,x.en,'Wiktionary'));
  wk.senses.forEach(w=>w.examples.forEach(x=>addEx(x.id,x.en,'Wiktionary')));
  (d.sentences||[]).forEach(s=>addEx(s.id,s.en,'Tatoeba'));
  if(ks)ks.examples.forEach(x=>addEx(x,'','KBBI'));
  const ex=exs.find(x=>hasWord(x.id,word))||exs[0]||{id:'',en:''};
  draft={word,fields:{Word:word,IPA:(wk.ipa&&wk.ipa[0])||(entry&&entry.ipa)||'',POS:(ks&&kbPos(ks))||(ws&&wkPos(ws))||'',KBBI:ks?ks.definition:'',Wiki:kind==='zh'?zhs[si].gloss:(getShow().cardMeaning==='zh'&&zhs.length?zhs[0].gloss:(ws?shortGloss(ws.gloss):'')),Example:ex.id,ExampleEN:ex.en,Skip1:'',Skip2:'',Skip3:'',Skip4:''},
    kb:(entry?entry.senses:[]).map(s=>({label:(kbPos(s)?kbPos(s)+' ':'')+s.definition,val:s.definition})),
    wk:[...wk.senses.map(w=>({label:(wkPos(w)?wkPos(w)+' ':'')+w.gloss,val:w.gloss})),...zhs.map(z=>({label:'中文 '+(z.pos?z.pos+' ':'')+z.gloss,val:z.gloss}))],ex:exs,auto:{}};
  renderDraft();
}
const POS_LIST=['n.','v.','adj.','adv.','pron.','num.','part.','prep.','conj.','interj.'];
async function renderDraft(){
  await getModel();const f=draft.fields;
  const opts=(list,key)=>draft.mode==='edit'?'':`<span class="pick-wrap"><select class="pick" data-pick="${key}" aria-label="Choose another ${key==='kb'?'Indonesian meaning':key==='wk'?'meaning, English or Chinese':'example'}"><option value="">Choose another…</option>${list.map((o,i)=>`<option value="${i}">${esc(clip(key==='ex'?(o.src+': '+o.id):o.label,70))}</option>`).join('')}</select>${ico('drop')}</span>`;
  const posList=f.POS&&!POS_LIST.includes(f.POS)?[f.POS,...POS_LIST]:POS_LIST;
  const posPick=`<span class="pick-wrap"><select class="pick" data-pick="pos" aria-label="Part of speech"><option value=""${f.POS?'':' selected'}>Part of speech</option>${posList.map(x=>`<option value="${esc(x)}"${x===f.POS?' selected':''}>${esc(x)}</option>`).join('')}</select>${ico('drop')}</span>`;
  cbody.innerHTML=`<div class="frow top"><label class="fld w2"><input data-f="Word" value="${esc(f.Word)}" placeholder="Word" aria-label="Word"></label><div class="fld">${posPick}</div></div>
    <label class="fld"><input data-f="IPA" value="${esc(f.IPA)}" placeholder="Pronunciation (IPA)" aria-label="Pronunciation (IPA)"></label>
    <hr class="sdiv">
    <h4>Meaning</h4>
    <div class="fld"><div class="fld-head"><span>Indonesian</span>${opts(draft.kb,'kb')}</div><textarea data-f="KBBI" rows="2" placeholder="Meaning in Indonesian" aria-label="Indonesian meaning">${esc(f.KBBI)}</textarea><span class="trhint" id="trh-KBBI"></span></div>
    <div class="fld"><div class="fld-head"><span>WIKI</span>${opts(draft.wk,'wk')}</div><input data-f="Wiki" value="${esc(f.Wiki)}" placeholder="Meaning (English or Chinese)" aria-label="WIKI meaning"><span class="trhint" id="trh-Wiki"></span></div>
    <hr class="sdiv">
    <div class="fld-head sect"><h4>Example</h4>${opts(draft.ex,'ex')}</div>
    <label class="fld"><textarea data-f="Example" rows="2" placeholder="Sentence in Indonesian" aria-label="Example sentence in Indonesian">${esc(f.Example)}</textarea><span class="trhint" id="trh-Example"></span></label>
    <label class="fld"><textarea data-f="ExampleEN" rows="2" placeholder="Translation in English" aria-label="Example translation in English">${esc(f.ExampleEN)}</textarea><span class="trhint" id="trh-ExampleEN"></span></label>
    <hr class="sdiv">
    <h4>Cards to make</h4><p class="muted" style="margin:0 0 8px">Turn off a type you do not want. In Anki an unwanted card is simply not made (an existing one becomes empty and disappears with Tools → Empty Cards); turn it on again to get it back.</p><div id="cprev"></div>`;
  csheet.querySelector('.qw').textContent=draft.mode==='edit'?'Edit card':'New card';document.getElementById('csave').textContent=draft.mode==='edit'?'Save changes':'Add card';
  csheet.classList.add('open');csheet.inert=false;csheet.setAttribute('aria-hidden','false');document.getElementById('qsheet').classList.remove('open');
  updatePreview();autoFill();
}
function updatePreview(){
  const f=draft.fields,ok=f.Word&&(f.KBBI||f.Wiki);document.getElementById('csave').disabled=!ok||cardCount(f)<1;
  document.getElementById('cnote').textContent=ok?`One word + one meaning = one note (${cardCount(f)} card${cardCount(f)===1?'':'s'}).`:'Needs a word and a meaning.';
  const keep=[...document.querySelectorAll('#cprev .face')].map(x=>x.querySelector('.vchip.on')?.dataset.side);
  document.getElementById('cprev').innerHTML=facesHtml(f,true);
  document.querySelectorAll('#cprev .face').forEach((fc,i)=>{if(keep[i]==='back')fc.querySelector('.vchip[data-side=back]')?.click();});
}
cbody.addEventListener('change',e=>{const n=e.target.dataset.skip;if(!n)return;draft.fields['Skip'+n]=e.target.checked?'':'1';if(cardCount(draft.fields)<1){draft.fields['Skip'+n]='';toast('Keep at least one card type.');}updatePreview();});
cbody.addEventListener('input',e=>{const k=e.target.dataset.f;if(!k)return;draft.fields[k]=e.target.value;if(draft.auto)delete draft.auto[k];trHint(k,'');updatePreview();clearTimeout(trT);trT=setTimeout(autoFill,800);});
cbody.addEventListener('change',e=>{const key=e.target.dataset.pick;if(key==='pos'){draft.fields.POS=e.target.value;updatePreview();return;}if(!key||e.target.value==='')return;const f=draft.fields;
  if(key==='kb')f.KBBI=draft.kb[e.target.value].val;else if(key==='wk')f.Wiki=draft.wk[e.target.value].val;else{const x=draft.ex[e.target.value];f.Example=x.id;f.ExampleEN=x.en;}
  cbody.querySelectorAll('[data-f]').forEach(i=>{i.value=f[i.dataset.f]??'';});e.target.value='';draft.auto={};updatePreview();autoFill();});
document.getElementById('cclose').onclick=document.getElementById('ccancel').onclick=closeCard;
document.getElementById('csave').onclick=async()=>{
  try{
    if(draft.mode==='edit'){
      const old=(cardList.find(x=>x.id===draft.id)||{}).fields;
      const card=await KamusCards.update(draft.id,draft.fields);
      closeCard();await loadCards();pushEditToAnki(card,old);return;
    }const j=await KamusCards.create(draft.fields);
    toast(j.created?`Card added: ${j.card.word} · ${j.card.meaning}`:'You already have a card for this word and meaning.');closeCard();mineLoad().then(renderMine);
  }catch(err){toast(err.message||'Could not save the card');}
};
out.addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(!b)return;
  b.dataset.add==='kb'?openCard('kb',+b.dataset.e,+b.dataset.s):b.dataset.add==='zh'?openCard('zh',0,+b.dataset.s):openCard('wk',0,+b.dataset.s);});

// -- AnkiConnect (talks from THIS browser to the Anki desktop app on THIS device)
const ankiCfg=()=>{let url='http://127.0.0.1:8765',key='';try{url=localStorage.getItem(ANKI_URL_KEY)||url;key=localStorage.getItem(ANKI_KEY_KEY)||'';}catch{}return {url,key};};
// AnkiConnect only exists in Anki desktop; phones/tablets (incl. iPadOS, which reports itself as a Mac) cannot run it
const isMobile=()=>!!(navigator.userAgentData&&navigator.userAgentData.mobile)||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
async function ac(action,params={},timeout=10000){
  const {url,key}=ankiCfg(),ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeout);
  try{const r=await fetch(url,{method:'POST',body:JSON.stringify({action,version:6,params,...(key?{key}:{})}),signal:ctl.signal});
    const j=await r.json();if(j.error)throw new Error(j.error);return j.result;}finally{clearTimeout(t);}
}
async function checkAnki(){
  ankiState={state:'checking'};renderConn();
  if(isMobile()){ankiState={state:'mobile'};renderConn();return;}
  try{const u=new URL(ankiCfg().url),local=['localhost','127.0.0.1'];
    if(local.includes(location.hostname)&&local.includes(u.hostname)&&u.port===location.port){ankiState={state:'conflict',port:u.port};renderConn();return;}}catch{}
  try{const v=await ac('version',{},4000);const decks=await ac('deckNames',{},4000);ankiState={state:'ok',version:v,decks};}
  catch(err){ankiState={state:err instanceof TypeError||err.name==='AbortError'?'offline':'error',message:err.message};}
  renderConn();
}
const unsynced=()=>cardList.filter(c=>!c.note_id);
const synced=()=>cardList.filter(c=>c.note_id);
const ankiChip=document.getElementById('ankiChip'),ankiDlg=document.getElementById('ankiDlg');
let chipT=0,chipPinned=false;
async function exportApkg(){   // the .apkg is built in this browser (apkg.js); the audio comes from the voice chosen in Settings
  const cards=await KamusCards.list();if(!cards.length){toast('There are no cards to export.');return;}
  const m=await getModel(),a=audioFor();
  const getAudio=async text=>{
    if(a.e==='web'){if(!(await wdHasModel()))return null;const r=await webSynth(text,a.voice);return {bytes:wavEncode(r.wav,r.sr),ext:'.wav'};}
    const res=await fetch(absTts(text,a));if(!res.ok)return null;return {bytes:new Uint8Array(await res.arrayBuffer()),ext:'.'+a.ext};
  };
  try{
    aBusy='Exporting…';renderConn();
    const r=await KamusApkg.build({cards,model:m,getAudio,onProgress:(i,n)=>{aBusy=`Exporting ${i}/${n}…`;renderConn();}});
    const url=URL.createObjectURL(r.blob),link=document.createElement('a');link.href=url;link.download='kamus.apkg';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    toast(`Exported ${r.notes} note${r.notes===1?'':'s'} (${r.cards} cards)`+(r.noAudio?`; ${r.noAudio} without audio (no voice available)`:'')+'.');
  }catch(err){toast('Export failed: '+err.message);}
  aBusy='';renderConn();
}
async function importFromAnki(){   // notes that use the Kamus note type in Anki but are not in Kamus yet (made in the Anki app, or in another browser)
  if(ankiState.state!=='ok')return;
  try{
    const m=await getModel();aBusy='Reading Anki…';renderConn();
    const ids=await ac('findNotes',{query:`"note:${m.name}"`}),notes=ids.length?await ac('notesInfo',{notes:ids}):[];
    const haveNid=new Set(cardList.filter(c=>c.note_id).map(c=>c.note_id));
    const txt=h=>{const d=document.createElement('div');d.innerHTML=h||'';return (d.textContent||'').trim();};
    let added=0,linked=0,failed=0,last='';
    for(const n of notes){
      if(haveNid.has(n.noteId))continue;
      const f={};for(const k of ['Word','IPA','POS','KBBI','Wiki','Example','ExampleEN','Skip1','Skip2','Skip3','Skip4'])f[k]=txt((n.fields[k]||{}).value);
      try{
        const r=await KamusCards.create(f);
        if(r.created){await KamusCards.report([{id:r.card.id,note_id:n.noteId}]);added++;}
        else if(!r.card.note_id){await KamusCards.report([{id:r.card.id,note_id:n.noteId}]);linked++;}   // the same word and meaning was already here: just connect it to the Anki note
      }catch(err){failed++;last=err.message;}
    }
    toast(!added&&!linked&&!failed?`Nothing new: Kamus already has all ${notes.length} “${m.name}” note${notes.length===1?'':'s'} from Anki.`
      :`Imported ${added} card${added===1?'':'s'} from Anki`+(linked?`, linked ${linked} existing`:'')+(failed?`, ${failed} skipped (${last})`:'')+'.');
  }catch(err){toast('Import failed: '+err.message);}
  aBusy='';await loadCards();await refreshProgress(false);
}
async function backupCards(){
  const cards=await KamusCards.list();if(!cards.length)return;
  const reviews=await KamusCards.reviewAll();
  const blob=new Blob([JSON.stringify({kamus_cards:1,exported:new Date().toISOString(),cards,reviews},null,1)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='kamus-cards-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  toast(`Backed up ${cards.length} card${cards.length===1?'':'s'}.`);
}
async function restoreCards(file){
  try{
    const j=JSON.parse(await file.text());if(!j||!Array.isArray(j.cards))throw new Error('this is not a Kamus backup');
    const n=await KamusCards.importCards(j.cards);for(const r of Array.isArray(j.reviews)?j.reviews:[])if(r&&r.id&&!(await KamusCards.reviewGet(r.id)))await KamusCards.reviewPut(r);toast(n?`Restored ${n} card${n===1?'':'s'} (${j.cards.length-n} already here).`:'Nothing new: all those cards are already here.');await loadCards();
  }catch(err){toast('Could not restore: '+err.message);}
}
document.addEventListener('change',e=>{if(e.target.id==='aRestore'&&e.target.files[0]){restoreCards(e.target.files[0]);e.target.value='';}});
async function ankiWebSync(){aBusy='Syncing with AnkiWeb…';renderConn();try{await ac('sync',{},120000);toast('Anki synced with AnkiWeb.');}catch(err){toast('AnkiWeb sync failed: '+err.message);}aBusy='';renderConn();}
function renderConn(){   // the chip in the title bar (+ a one-line note, + the dialog if it is open)
  const s=ankiState.state,ok=s==='ok',checking=s==='checking'||s==='unknown',n=unsynced().length+cardList.filter(c=>c.note_id&&c.dirty).length,busy=!!aBusy;
  const label=busy?aBusy:checking?'Checking…':ok?'Connected':'Disconnected';
  ankiChip.innerHTML=`<span class="chipbody"><span class="dot ${ok?'ok':(checking?'':'bad')}"></span><span class="gx lbl"><span class="gi">${esc(label)}</span></span><span class="gx acts"><span class="gi">`
    +(ok?`<button type="button" class="icon-btn sm${busy?' loading':''}" data-chip="sync" ${busy?'disabled':''} title="${n?`Send ${n} new or edited card${n===1?'':'s'} to Anki and refresh progress`:'Refresh progress from Anki'}" aria-label="Sync with Anki"><svg><use href="#i-sync"/></svg></button>
      <button type="button" class="icon-btn sm" data-chip="export" ${cardList.length?'':'disabled'} title="Export all cards as .apkg" aria-label="Export .apkg"><svg><use href="#i-download"/></svg></button><span class="vdiv"></span>`:'')
    +(!ok&&!checking&&s!=='mobile'?'<button type="button" class="text-btn chip-re" data-chip="reconnect">Reconnect</button>':'')
    +`<button type="button" class="icon-btn sm" data-chip="info" title="Connection details" aria-label="Connection details"><svg><use href="#i-info"/></svg></button></span></span></span>`;
  if(!ankiChip.classList.contains('open')){ankiChip.style.minWidth='';ankiChip.style.minWidth=ankiChip.firstElementChild.offsetWidth+'px';}   // hover area never shrinks below the collapsed pill (no flicker when the open pill is narrower)
  document.getElementById('ankiNote').innerHTML=!ok&&!checking?`<div class="snack">${ico('warn')}<span>Anki is not connected. Your cards are saved here; open ⓘ in the title bar to connect.</span></div>`:'';
  if(ankiDlg.open)renderAnkiDialog();
}
ankiChip.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){clearTimeout(chipT);ankiChip.classList.add('open');}});
ankiChip.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!chipPinned)chipT=setTimeout(()=>ankiChip.classList.remove('open'),250);});
ankiChip.addEventListener('click',e=>{
  const b=e.target.closest('[data-chip]');
  if(!b){   // clicking/tapping the chip itself pins the actions open, or hides them again (touch has no hover)
    if(ankiChip.classList.contains('open')&&chipPinned){chipPinned=false;ankiChip.classList.remove('open');}else{chipPinned=true;ankiChip.classList.add('open');}
    return;}
  const act=b.dataset.chip;if(act==='reconnect')checkAnki();else if(act==='sync')syncToAnki();else if(act==='export')exportApkg();else if(act==='info')openAnkiDialog();
});
document.addEventListener('click',e=>{if(chipPinned&&!e.target.closest('#ankiChip')){chipPinned=false;ankiChip.classList.remove('open');}});
function openAnkiDialog(){renderAnkiDialog();if(!ankiDlg.open)ankiDlg.showModal();}
ankiDlg.addEventListener('click',e=>{if(e.target===ankiDlg)ankiDlg.close();});
function renderAnkiDialog(){
  const s=ankiState.state,ok=s==='ok',checking=s==='checking'||s==='unknown',origin=location.origin,{url}=ankiCfg(),busy=!!aBusy;
  const msg={unknown:'',checking:'Looking for Anki…',ok:`Connected to Anki (AnkiConnect v${ankiState.version}) · ${esc(String(ankiState.decks&&ankiState.decks.length||0))} decks`,
    offline:'Anki is not reachable from this browser.',error:'AnkiConnect answered with an error: '+esc(ankiState.message||''),
    mobile:'This device cannot run AnkiConnect (it is desktop-only: Windows, macOS, Linux).',
    conflict:`Kamus and AnkiConnect both use port ${esc(ankiState.port||'')} on this computer.`}[s]||'';
  const hint={offline:'Open Anki on this computer with the AnkiConnect add-on, and allow this page in its settings (see “Set up AnkiConnect”).',
    mobile:'Export an .apkg file and import it into AnkiDroid or AnkiMobile; cards stay here in Kamus.',
    conflict:'Start Kamus with <code>--port 8780</code> (or set <code>webBindPort</code> in AnkiConnect to another port, then update the address below).'}[s]||'';
  document.getElementById('ankiDlgBody').innerHTML=`<div class="a-status"><span class="dot ${ok?'ok':(checking?'':'bad')}"></span><span>${msg}</span></div>
    ${hint?`<p style="margin:8px 0 0">${hint}</p>`:''}
    ${!ok&&!checking?`<p class="muted" style="margin-top:10px">Your cards live in Kamus first. When Anki is open with AnkiConnect, <b>Sync</b> in the title bar sends them and brings your learning progress back, so you can add and manage cards here and practise in your local Anki.</p>`:''}
    <details class="setup" ${ok?'':'open'}><summary>Set up AnkiConnect</summary>
      <ol><li><span class="def">In Anki: <b>Tools → Add-ons → Get Add-ons…</b>, enter code <code>2055492159</code>, restart Anki.</span></li>
      <li><span class="def">Open <b>Tools → Add-ons → AnkiConnect → Config</b> and let this page talk to it:<pre class="cfg">"webCorsOriginList": ["http://localhost", "${esc(origin)}"]</pre><button class="text-btn" data-dlg="copy" type="button">Copy</button> Restart Anki afterwards.</span></li>
      <li><span class="def">Keep Anki open while syncing. Anki’s own <b>Sync</b> (or the AnkiWeb button here) then pushes everything to your AnkiWeb account.</span></li></ol>
      <div class="frow"><label class="fld"><span>AnkiConnect address</span><input id="aUrl" value="${esc(url)}"></label><label class="fld"><span>API key (only if you set one)</span><input id="aKey" type="password" value="${esc(ankiCfg().key)}" autocomplete="off"></label></div>
      <p class="muted">Audio is fetched by Anki from this page’s address (${esc(origin)}), must stay reachable while syncing.</p></details>
    <div class="a-backup"><h4>Backup</h4><p class="muted">Your cards are stored in this browser only (each address, such as localhost or a Tailscale name, has its own). Download a backup to keep them safe or move them to another browser.</p>
      <button class="text-btn" data-dlg="backup" type="button" ${cardList.length?'':'disabled'}>Back up cards</button><button class="text-btn" data-dlg="restore" type="button">Restore from backup…</button><input type="file" id="aRestore" accept="application/json,.json" hidden></div>`;
  document.getElementById('ankiDlgAct').innerHTML=`<button class="text-btn" data-dlg="check" type="button">Check again</button>
    ${ok?`<button class="text-btn" data-dlg="prog" type="button" ${synced().length&&!busy?'':'disabled'}>Refresh progress</button><button class="text-btn" data-dlg="import" type="button" ${busy?'disabled':''} title="Add notes of the 'Kamus v1' note type that Kamus does not have yet">Import from Anki</button><button class="text-btn" data-dlg="web" type="button" ${busy?'disabled':''}>Sync with AnkiWeb</button>`:''}
    <button class="text-btn" data-dlg="export" type="button" ${cardList.length?'':'disabled'}>Export .apkg</button>
    <button class="btn-filled" data-dlg="close" type="button">Close</button>`;
}
ankiDlg.addEventListener('click',async e=>{
  const b=e.target.closest('[data-dlg]');if(!b)return;const a=b.dataset.dlg;
  if(a==='close')ankiDlg.close();else if(a==='check')checkAnki();else if(a==='prog')refreshProgress(true);else if(a==='web')ankiWebSync();else if(a==='export')exportApkg();else if(a==='backup')backupCards();else if(a==='import')importFromAnki();else if(a==='restore')document.getElementById('aRestore').click();
  else if(a==='copy'){try{await navigator.clipboard.writeText(`"webCorsOriginList": ["http://localhost", "${location.origin}"]`);toast('Copied.');}catch{toast('Select the text and copy it manually.');}}
});
ankiDlg.addEventListener('change',e=>{
  if(e.target.id==='aUrl'){try{localStorage.setItem(ANKI_URL_KEY,e.target.value.trim());}catch{}checkAnki();}
  if(e.target.id==='aKey'){try{localStorage.setItem(ANKI_KEY_KEY,e.target.value);}catch{}checkAnki();}
});
const audioFor=()=>{const c=getTts();if(c.engine==='wikidepia-web')return {e:'web',voice:c['wikidepia-web'],ext:'wav'};const e=c.engine==='browser'?'edge':c.engine;return {e,voice:c[e],ext:e==='wikidepia'?'wav':'mp3'};};
async function audioSpec(text,a,filename,field){if(noServer()&&a.e!=='web')return null;   // AnkiConnect would fetch the audio from a server that is not there
  return a.e==='web'?{data:await webWavBase64(text,a.voice),filename,fields:[field]}:{url:absTts(text,a),filename,fields:[field]};}
const absTts=(t,a)=>`${location.origin}/api/tts?engine=${a.e}&voice=${a.voice}&text=${encodeURIComponent(t)}`;
const escSearch=s=>s.replace(/[\\"*_]/g,'\\$&');
async function reportCards(updates){if(updates.length)await KamusCards.report(updates);}
async function ensureAnkiModel(){   // Anki's 'Kamus v1' may predate the SkipN fields: add them and refresh the templates (old notes keep working: empty Skip = card is made)
  const m=await getModel();
  if(!(await ac('modelNames')).includes(m.name))return;
  const have=await ac('modelFieldNames',{modelName:m.name});
  const missing=m.fields.filter(x=>!have.includes(x));if(!missing.length)return;
  for(const fn of missing)await ac('modelFieldAdd',{modelName:m.name,fieldName:fn});
  await ac('updateModelTemplates',{model:{name:m.name,templates:Object.fromEntries(m.templates.map(t=>[t.Name,{Front:t.Front,Back:t.Back}]))}});
}
async function syncToAnki(){
  const m=await getModel(),todo=unsynced(),a=audioFor(),updates=[];let failed=0,last='';
  try{
    aBusy='Preparing Anki…';renderConn();
    if(!(await ac('modelNames')).includes(m.name))await ac('createModel',{modelName:m.name,inOrderFields:m.fields,css:m.css,isCloze:false,cardTemplates:m.templates.map(t=>({Name:t.Name,Front:t.Front,Back:t.Back}))});
    await ensureAnkiModel();await ac('createDeck',{deck:m.deck});
    for(const c of cardList.filter(c=>c.note_id&&c.dirty)){aBusy='Updating edited cards…';renderConn();try{await pushNoteUpdate(c,null);updates.push({id:c.id,dirty:false});}catch(err){failed++;last=err.message;}}
    for(let i=0;i<todo.length;i++){
      const c=todo[i];aBusy=`Sending ${i+1}/${todo.length}…`;renderConn();
      const f={...c.fields,Audio:'',ExampleAudio:''};
      const audio=[await audioSpec(f.Word,a,`kamus-${c.id}-w.${a.ext}`,'Audio')];
      if(f.Example)audio.push(await audioSpec(f.Example,a,`kamus-${c.id}-e.${a.ext}`,'ExampleAudio'));
      for(let k=audio.length-1;k>=0;k--)if(!audio[k])audio.splice(k,1);
      try{const id=await ac('addNote',{note:{deckName:m.deck,modelName:m.name,fields:f,options:{allowDuplicate:false},tags:['kamus'],audio}},120000);updates.push({id:c.id,note_id:id});}
      catch(err){
        if(/duplicate/i.test(err.message)){const ids=await ac('findNotes',{query:`"note:${m.name}" "Index:${escSearch(f.Index)}"`});if(ids[0]){updates.push({id:c.id,note_id:ids[0]});continue;}}
        failed++;last=err.message;
      }
    }
    await reportCards(updates);
    toast(failed?`${updates.length} sent, ${failed} failed (${last})`:`${updates.length} card${updates.length===1?'':'s'} sent to Anki.`);
  }catch(err){toast('Sync failed: '+err.message);}
  aBusy='';await loadCards();await refreshProgress(false);
}
async function refreshProgress(announce){
  if(ankiState.state!=='ok')return;
  try{
    const m=await getModel();aBusy='Reading progress…';renderConn();
    const ids=await ac('findNotes',{query:`"note:${m.name}"`}),notes=ids.length?await ac('notesInfo',{notes:ids}):[];
    const cardIds=notes.flatMap(n=>n.cards),infos=cardIds.length?await ac('cardsInfo',{cards:cardIds}):[],due=cardIds.length?await ac('areDue',{cards:cardIds}):[];
    const dueSet=new Set(cardIds.filter((_,i)=>due[i])),byNote={};
    infos.forEach(ci=>{(byNote[ci.note]=byNote[ci.note]||[]).push(ci);});
    const byIndex=Object.fromEntries(cardList.map(c=>[c.fields.Index,c])),byNid=new Map(cardList.filter(c=>c.note_id).map(c=>[c.note_id,c])),updates=[],seen=new Set();   // note id first: an edited card's Index may differ from the old note's
    notes.forEach(n=>{const c=byNid.get(n.noteId)||byIndex[n.fields.Index&&n.fields.Index.value];if(!c)return;seen.add(c.id);const cs=byNote[n.noteId]||[];
      const rev=cs.filter(x=>x.type===2);
      updates.push({id:c.id,note_id:n.noteId,progress:{cards:cs.length,new:cs.filter(x=>x.type===0).length,learning:cs.filter(x=>x.type===1||x.type===3).length,review:rev.length,
        reps:cs.reduce((a,x)=>a+x.reps,0),lapses:cs.reduce((a,x)=>a+x.lapses,0),interval:rev.length?Math.round(rev.reduce((a,x)=>a+x.interval,0)/rev.length):0,
        dueNow:cs.filter(x=>dueSet.has(x.cardId)).length,suspended:cs.filter(x=>x.queue===-1).length}});});
    cardList.filter(c=>c.note_id&&!seen.has(c.id)).forEach(c=>updates.push({id:c.id,note_id:null}));   // deleted in Anki
    await reportCards(updates);if(announce)toast('Progress updated from Anki.');
  }catch(err){toast('Could not read progress: '+err.message);}
  aBusy='';await loadCards();
}
// -- the card list (served from Kamus's own database first; Anki is optional)
const stateOf=c=>{const p=c.progress;if(!c.note_id)return 'notsynced';if(!p||!p.cards)return 'sent';if(p.new===p.cards)return 'new';if(p.review===p.cards)return 'review';return 'learning';};
const STATE_LABEL={notsynced:'Not in Anki',sent:'In Anki',new:'In Anki · new',learning:'In Anki · learning',review:'In Anki · review'};
function renderCards(){
  const q=aText.trim().toLowerCase();
  const list=cardList.filter(c=>(!q||(c.word+' '+c.meaning+' '+c.fields.KBBI).toLowerCase().includes(q))&&
    (aFilter==='all'||(aFilter==='new'&&!c.note_id)||(aFilter==='due'&&c.progress&&c.progress.dueNow>0)||(aFilter==='learning'&&c.progress&&c.progress.learning>0)));
  const tot=cardList.length,inA=synced().length,dueN=cardList.reduce((a,c)=>a+((c.progress&&c.progress.dueNow)||0),0),lrn=cardList.filter(c=>stateOf(c)==='learning').length;
  document.getElementById('ankiSummary').innerHTML=tot?`<span class="badge">${tot} note${tot===1?'':'s'} · ${cardList.reduce((a,c)=>a+cardCount(c.fields),0)} cards</span><span class="badge ok">${inA} in Anki</span><span class="badge">${tot-inA} not in Anki</span><span class="badge">${dueN} due now</span><span class="badge">${lrn} learning</span>`:'';
  document.getElementById('ankiList').innerHTML=!tot?`<div class="empty"><svg><use href="#i-cards"/></svg><p class="h">No cards yet</p><div>Look up a word, then tap <b>+</b> next to a meaning to make an Anki card from it.</div></div>`
    :!list.length?'<p class="muted" style="padding:16px 0">No cards match.</p>':list.map(c=>{const f=c.fields,p=c.progress,st=stateOf(c);
      return `<article class="crow${ankiFocusIds&&ankiFocusIds.has(c.id)?' focus':''}" data-id="${esc(c.id)}"><div class="crow-top"><div class="crow-main">
        <div class="crow-head">${say(c.word,'sm')}<span role="button" tabindex="0" class="cw" data-word="${esc(c.word)}" title="Look this word up in the side sheet">${esc(c.word)}</span><span class="pron" style="display:inline;margin:0">${esc(cleanIpa(f.IPA||''))}</span>${f.POS?`<span class="pos" style="margin:0">${esc(f.POS)}</span>`:''}</div>
        <div class="crow-meaning" lang="${/[\u3400-\u9fff]/.test(c.meaning)?'zh':'en'}">${esc(c.meaning)}</div>${f.Wiki&&f.KBBI?`<div class="crow-kbbi">${esc(clip(f.KBBI,160))}</div>`:''}
        ${f.Example?`<hr class="crow-div"><div class="crow-ex">${say(f.Example,'sm')}<div class="crow-kbbi"><i lang="id">${esc(capFirst(f.Example))}</i></div></div>`:''}</div>
        <div class="crow-side">${c.dirty&&c.note_id?'<span class="badge warn" title="Changed here; the next Sync updates Anki">Desynced</span>':''}${p&&p.cards?`<span class="statwrap"><button type="button" class="badge ok stat" aria-describedby="stat-${esc(c.id)}">${STATE_LABEL[st]}</button><div class="statpop" role="tooltip" id="stat-${esc(c.id)}">${p.dueNow?`<b>${p.dueNow} due</b> · `:''}${p.reps} reviews · ${p.lapses} lapses${p.interval?` · interval ${p.interval}d`:''}<br>cards: ${p.new} new, ${p.learning} learning, ${p.review} review${c.progress_at?`<br>progress ${new Date(c.progress_at*1000).toLocaleDateString()}`:''}</div></span>`:`<span class="badge ${c.note_id?'ok':''}">${STATE_LABEL[st]}</span>`}
          <div class="crow-act"><button class="icon-btn sm" data-act="prev" title="Show the cards" aria-label="Show the cards" aria-expanded="false"><svg><use href="#i-expand"/></svg></button>
            <button class="icon-btn sm" data-act="edit" title="Edit this card" aria-label="Edit"><svg><use href="#i-edit"/></svg></button>
            <button class="icon-btn sm" data-act="del" title="Delete from Kamus" aria-label="Delete"><svg><use href="#i-delete"/></svg></button></div></div></div>
        <div class="crow-prev" hidden></div></article>`;}).join('');
  renderConn();renderAnkiDetail();
}
document.getElementById('ankiList').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.cw')){e.preventDefault();e.target.click();}});
// list-detail: from 840px a row is selected and shown in the detail pane; below that the preview opens inside the row
const ldMq=matchMedia('(min-width:840px)');let ankiSel=null;
async function renderAnkiDetail(){
  const box=document.getElementById('ankiDetail');if(!ldMq.matches){box.innerHTML='';return;}
  let c=cardList.find(x=>x.id===ankiSel);
  if(!c){const first=document.querySelector('#ankiList .crow');c=first&&cardList.find(x=>x.id===first.dataset.id);ankiSel=c?c.id:null;}
  document.querySelectorAll('#ankiList .crow').forEach(r=>{const on=r.dataset.id===ankiSel;r.classList.toggle('sel',on);on?r.setAttribute('aria-current','true'):r.removeAttribute('aria-current');});
  if(!c){box.innerHTML='<p class="muted">Select a card to see its card types.</p>';return;}
  await getModel();
  box.innerHTML=`<h3>${esc(c.word)} <span class="muted" lang="en">· ${esc(c.meaning)}</span></h3><div class="ld-act"><button type="button" class="btn-tonal" data-dact="edit">${ico('edit')}Edit</button><button type="button" class="text-btn" data-dact="del">Delete</button></div>${facesHtml(c.fields)}`;
}
ldMq.addEventListener('change',()=>{if(document.body.dataset.view==='anki')renderAnkiDetail();});
async function deleteCard(c){if(confirm(`Delete “${c.word} · ${c.meaning}” from Kamus?`+(c.note_id?'\n\nIt stays in Anki (delete it there too if you want it gone).':''))){await KamusCards.remove(c.id);await loadCards();}}
document.getElementById('ankiDetail').addEventListener('click',e=>{const b=e.target.closest('[data-dact]'),c=cardList.find(x=>x.id===ankiSel);if(!b||!c)return;b.dataset.dact==='edit'?openEditCard(c):deleteCard(c);});
document.getElementById('ankiList').addEventListener('click',async e=>{
  if(getSelection().toString())return;   // the user is selecting text, not tapping
  if(ldMq.matches&&!e.target.closest('[data-say],[data-word],[data-act=edit],[data-act=del],.statwrap')){const r=e.target.closest('.crow');if(r){ankiSel=r.dataset.id;renderAnkiDetail();}return;}
  
  const sp=e.target.closest('[data-say]');if(sp){speak(sp.dataset.say,sp);return;}   // pronunciation
  const wd=e.target.closest('[data-word]');if(wd){openQuick(wd.dataset.word);return;}   // look the word up in the side sheet
  const b=e.target.closest('[data-act]');if(!b)return;const row=b.closest('.crow'),c=cardList.find(x=>x.id===row.dataset.id);
  if(b.dataset.act==='prev'){const box=row.querySelector('.crow-prev');if(box.hidden){await getModel();box.innerHTML=facesHtml(c.fields);}box.hidden=!box.hidden;row.classList.toggle('open',!box.hidden);b.setAttribute('aria-expanded',!box.hidden);}
  else if(b.dataset.act==='edit'){openEditCard(c);}
  else if(b.dataset.act==='del')deleteCard(c);
});
document.getElementById('aSearch').addEventListener('input',e=>{aText=e.target.value;renderCards();});
document.querySelector('.a-tools').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;aFilter=b.dataset.filter;
  document.querySelectorAll('.a-tools [data-filter]').forEach(x=>x.classList.toggle('on',x===b));renderCards();});
// the cards live in this browser (cards-store.js); the first time, the old server database (cards.db) is copied in
const cardsReady=KamusCards.migrateFromServer().then(n=>{if(n)toast(`Moved ${n} card${n===1?'':'s'} from the server into this browser.`);}).catch(()=>{});
async function loadCards(){await cardsReady;try{cardList=await KamusCards.list();}catch{}renderCards();}
async function loadAnki(){
  await loadCards();await getModel();renderCards();checkAnki();
  const f=document.querySelector('.crow.focus');if(f){f.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}
  ankiFocusIds=null;   // the highlight animation has already been applied
}


export { ANKI_URL_KEY, ANKI_KEY_KEY, ankiModel, cardList, ankiState, lastResult, draft, aFilter, aText, aBusy, KB_POS, WK_POS, kbPos, wkPos, reEsc, hasWord, hintOf, blankOf, capFirst, clip, getModel, mrender, skipN, cardCount, facesHtml, csheet, cbody, closeCard, openCard, POS_LIST, renderDraft, updatePreview, ankiCfg, isMobile, ac, checkAnki, unsynced, synced, ankiChip, ankiDlg, chipT, chipPinned, exportApkg, importFromAnki, backupCards, restoreCards, ankiWebSync, renderConn, openAnkiDialog, renderAnkiDialog, audioFor, audioSpec, absTts, escSearch, reportCards, ensureAnkiModel, syncToAnki, refreshProgress, stateOf, STATE_LABEL, renderCards, ldMq, ankiSel, renderAnkiDetail, deleteCard, cardsReady, loadCards, loadAnki };
