// Kamus app module 01-core. Split from the old inline script: top-level names are exported, and also published on window
// through bridge() for code that is not a module yet (learn.js, tests) and for references to modules that load later.
import { bridge } from './bridge.js';
bridge({
  out: [() => out],
  q: [() => q],
  pg: [() => pg],
  esc: [() => esc],
  ico: [() => ico]
});

const out=document.getElementById('out'),q=document.getElementById('q'),pg=document.getElementById('pg');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ico=n=>`<svg><use href="#i-${n}"/></svg>`;


export { out, q, pg, esc, ico };
