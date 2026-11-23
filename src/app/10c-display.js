// Kamus app module 10c-display: Settings -> "What to show" (English, Chinese, related words, example sentences, what a new card's meaning
// starts from) and the related-words card. Related words come from two places: the Chinese Wiktionary's derived-word lists, and the word list
// (the stemmer finds the words built from this one: rumah -> berumah, perumahan ...), so it also works offline and for words with no Chinese page.
import { bridge } from './bridge.js';
import { esc } from './01-core.js';
import { getShow, setShow } from './10b-chinese.js';
bridge({ showRelated: [() => showRelated], relatedFromList: [() => relatedFromList], renderShow: [() => renderShow] });

let byLen = null, byLenFor = null;
// words of the list that are built from `word` (not the word itself), shortest first, at most `max`
function relatedFromList(word, max = 12) {
  const S = window.KamusStem; if (!S || !S.hasWordlist() || !/^[a-z]{3,}$/.test(word)) return [];
  const known = S._words && S._words();
  if (!known) return [];
  if (byLenFor !== known) { byLen = [...known].filter(w => w.length > 3).sort((a, b) => a.length - b.length || a.localeCompare(b)); byLenFor = known; }
  const out = [];
  for (const w of byLen) {
    if (out.length >= max) break;
    if (w === word || w.length > word.length + 9 || !w.includes(word)) continue;
    if (S.candidates(w).some(c => c.stem === word)) out.push(w);
  }
  return out;
}
const chip = w => `<a href="#" class="morph-w" data-gow="${esc(w)}">${esc(w)}</a>`;
// the card sits after the Indonesian entries: before the English card, else before the Chinese one, else at the end
function placeCard(html) {
  const old = document.getElementById('sec-words'); if (old) old.remove();
  if (!html) return;
  const anchor = document.getElementById('sec-en') || document.getElementById('sec-zh');
  if (anchor) anchor.insertAdjacentHTML('beforebegin', html); else document.getElementById('out').insertAdjacentHTML('beforeend', html);
}
function showRelated(word, extra = []) {
  if (!getShow().related) { placeCard(''); return []; }
  const list = [...new Set([...relatedFromList(word), ...extra])].filter(w => w !== word).slice(0, 14);
  placeCard(list.length ? `<section class="card" id="sec-words"><h3>Related words</h3><p class="rel-chips">${list.map(chip).join(' ')}</p><p class="src">Words built from “${esc(word)}”: from the word list and the Chinese Wiktionary's derived-word lists.</p></section>` : '');
  return list;
}

function renderShow() {
  const box = document.getElementById('showOptions'); if (!box) return;
  const c = getShow(), sw = (id, on, label) => `<label class="switchrow"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
  box.innerHTML = `${sw('enOn', c.en, 'English definitions (English Wiktionary)')}
    ${sw('zhOn', c.zh, 'Chinese definitions (Chinese Wiktionary), just below the English ones')}
    <div class="seg" role="radiogroup" aria-label="Chinese script" ${c.zh ? '' : 'hidden'}>${[['auto', 'Automatic'], ['hans', '简体 Simplified'], ['hant', '繁體 Traditional']].map(([k, n]) =>
      `<button type="button" role="radio" class="${c.script === k ? 'on' : ''}" aria-checked="${c.script === k}" data-zhs="${k}">${esc(n)}</button>`).join('')}</div>
    ${sw('relOn', c.related, 'Related words (rumah also shows berumah, perumahan …)')}
    ${sw('exOn', c.examples, 'More example sentences (Tatoeba)')}
    <h4 class="sub">New cards</h4>
    <div class="seg" role="radiogroup" aria-label="Meaning a new card starts with">${[['en', 'English meaning first'], ['zh', 'Chinese meaning first']].map(([k, n]) =>
      `<button type="button" role="radio" class="${c.cardMeaning === k ? 'on' : ''}" aria-checked="${c.cardMeaning === k}" data-cm="${k}">${esc(n)}</button>`).join('')}</div>
    <p class="muted">The WIKI field of a new card starts with the first meaning in this language (English if the other is missing). You can always choose another meaning, in either language, in the card sheet. Automatic script follows your browser language (Traditional for Taiwan, Hong Kong and Macau, otherwise Simplified).</p>`;
}
const flags = { enOn: 'en', zhOn: 'zh', relOn: 'related', exOn: 'examples' };
document.addEventListener('change', e => { const k = flags[e.target.id]; if (k) { setShow({ [k]: e.target.checked }); renderShow(); } });
document.addEventListener('click', e => {
  const z = e.target.closest('[data-zhs]'), m = e.target.closest('[data-cm]');
  if (z) { setShow({ script: z.dataset.zhs }); renderShow(); } else if (m) { setShow({ cardMeaning: m.dataset.cm }); renderShow(); }
});

export { showRelated, relatedFromList, renderShow };
