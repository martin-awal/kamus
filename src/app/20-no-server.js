// Kamus app module 20-no-server. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
/* global renderTts */   // from later modules, or assigned here: reached through the window bridge
import { bridge } from './bridge.js';
import { noServer } from './02-speech-history-toc.js';
import { getIdSrc, setIdSrc } from './07-id-source.js';
import { renderTr } from './15-translation.js';
import { loadIdSrc } from './19-id-source-settings.js';
bridge({
  onServerKnown: [() => onServerKnown]
});

// ---- no server: the page keeps working, server-only options are locked
function onServerKnown(){
  const note=document.getElementById('serverCard');if(note)note.hidden=!noServer();
  if(noServer()&&getIdSrc()!=='wikt')setIdSrc('wikt');   // KBBI cannot work without the server
  if(document.body.dataset.view==='settings'){renderTts();renderTr();loadIdSrc();}
}


export { onServerKnown };
