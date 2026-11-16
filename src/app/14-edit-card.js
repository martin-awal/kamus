// Kamus app module 14-edit-card. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
/* global draft:writable */   // from later modules, or assigned here: reached through the window bridge
import { bridge } from './bridge.js';
import { toast } from './02-speech-history-toc.js';
import { ac, ankiState, audioFor, audioSpec, capFirst, ensureAnkiModel, loadCards, renderDraft, reportCards } from './04-cards-anki.js';
bridge({
  openEditCard: [() => openEditCard],
  pushNoteUpdate: [() => pushNoteUpdate],
  pushEditToAnki: [() => pushEditToAnki]
});

// ---- Editing a saved card; changes reach Anki through AnkiConnect (now, or on the next Sync)
function openEditCard(c){
  const f=c.fields;
  draft={mode:'edit',id:c.id,word:c.word,fields:{Word:f.Word,IPA:f.IPA||'',POS:f.POS||'',KBBI:f.KBBI||'',Wiki:f.Wiki||'',Example:capFirst(f.Example||''),ExampleEN:f.ExampleEN||'',Skip1:f.Skip1||'',Skip2:f.Skip2||'',Skip3:f.Skip3||'',Skip4:f.Skip4||''},kb:[],wk:[],ex:[],auto:{}};
  renderDraft();
}
async function pushNoteUpdate(card,old){   // old = the fields before the edit (null = refresh all audio)
  const f={...card.fields};delete f.Audio;delete f.ExampleAudio;
  const a=audioFor(),audio=[];const addAudio=x=>{if(x)audio.push(x);};
  if(!old||card.fields.Word!==old.Word)addAudio(await audioSpec(card.fields.Word,a,`kamus-${card.id}-w.${a.ext}`,'Audio'));
  if(card.fields.Example&&(!old||card.fields.Example!==old.Example))addAudio(await audioSpec(card.fields.Example,a,`kamus-${card.id}-e.${a.ext}`,'ExampleAudio'));
  const note={id:card.note_id,fields:f};if(audio.length)note.audio=audio;
  try{await ac('updateNoteFields',{note},120000);}
  catch(err){if(audio.length&&/audio/i.test(err.message)){delete note.audio;await ac('updateNoteFields',{note},120000);}else throw err;}
}
async function pushEditToAnki(card,old){
  if(!card.note_id)return;
  if(ankiState.state!=='ok'){toast('Saved. Anki will get the change on the next Sync.');return;}
  try{await ensureAnkiModel();await pushNoteUpdate(card,old);await reportCards([{id:card.id,dirty:false}]);toast('Saved and updated in Anki.');}
  catch(err){toast('Saved here. Anki update failed ('+err.message+'); it will retry on Sync.');}
  loadCards();
}

export { openEditCard, pushNoteUpdate, pushEditToAnki };
