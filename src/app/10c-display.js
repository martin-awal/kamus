// Kamus app module 10c-display: Settings -> "What to show" (English, Chinese, related words, example sentences, what a new card's meaning
// starts from) and the related-words card. Related words come from two places: the Chinese Wiktionary's derived-word lists, and the word list
// (the stemmer finds the words built from this one: rumah -> berumah, perumahan ...), so it also works offline and for words with no Chinese page.
import { bridge } from './bridge.js';
import { esc } from './01-core.js';
import { CARD_ORDER, getShow, setShow } from './10b-chinese.js';
bridge({ showRelated: [() => showRelated], relatedFromList: [() => relatedFromList], renderShow: [() => renderShow], orderCards: [() => orderCards] });

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

// ---- the order of the result cards (Settings -> What to show). The DOM itself is reordered (not only the look), so keyboard and screen reader order match.
const GROUP_NAMES = { id: 'Indonesian definitions', related: 'Related words', en: 'English definitions', zh: 'Chinese definitions', examples: 'Example sentences (Tatoeba)' };
function cardGroup(el) {
  if (el.dataset.card === 'id') return 'id';
  if (el.id === 'sec-words') return 'related';
  if (el.id === 'sec-en') return 'en';
  if (el.id === 'sec-zh') return 'zh';
  if (el.id === 'sec-sn') return 'examples';
  if (el.id && el.id.startsWith('sec-base-')) return 'base';
  return '';
}
let ordering = false;
function orderCards() {
  const out = document.getElementById('out'); if (!out || ordering) return;
  const order = getShow().order, rank = el => { const g = cardGroup(el); return g === 'base' ? order.indexOf('id') * 10 + 5 : g ? order.indexOf(g) * 10 : -1; };   // notices stay on top, the base-word card follows the Indonesian ones
  const kids = [...out.children], cards = kids.filter(k => k.tagName === 'SECTION' && cardGroup(k));
  const want = [...cards].map((c, i) => ({ c, i, r: rank(c) })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.c);
  if (want.every((c, i) => c === cards[i])) return;
  ordering = true;
  const first = cards[0], marker = document.createComment(''); out.insertBefore(marker, first);
  for (const c of want) out.insertBefore(c, marker);
  marker.remove(); ordering = false;
}
const outEl = document.getElementById('out');
if (outEl) new MutationObserver(() => orderCards()).observe(outEl, { childList: true });

function renderShow() {
  const box = document.getElementById('showOptions'); if (!box) return;
  const c = getShow(), sw = (id, on, label) => `<label class="switchrow"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
  box.innerHTML = `${sw('enOn', c.en, 'English definitions (English Wiktionary)')}
    ${sw('zhOn', c.zh, 'Chinese definitions (Chinese Wiktionary), just below the English ones')}
    <div class="seg" role="radiogroup" aria-label="Chinese script" ${c.zh ? '' : 'hidden'}>${[['auto', 'Automatic'], ['hans', '简体 Simplified'], ['hant', '繁體 Traditional']].map(([k, n]) =>
      `<button type="button" role="radio" class="${c.script === k ? 'on' : ''}" aria-checked="${c.script === k}" data-zhs="${k}">${esc(n)}</button>`).join('')}</div>
    ${sw('relOn', c.related, 'Related words (rumah also shows berumah, perumahan …)')}
    ${sw('exOn', c.examples, 'More example sentences (Tatoeba)')}
    <h4 class="sub">Order of the cards</h4>
    <ol class="order-list" aria-label="Order of the result cards">${c.order.map((k, i) => `<li class="${c[{ id: 'id', related: 'related', en: 'en', zh: 'zh', examples: 'examples' }[k]] === false ? 'off' : ''}"><span class="order-name">${esc(GROUP_NAMES[k])}${k !== 'id' && c[k] === false ? ' <span class="muted">(hidden)</span>' : ''}</span>
      <button type="button" class="icon-btn sm" data-mv="${k}" data-dir="-1" aria-label="Move ${esc(GROUP_NAMES[k])} up" ${i === 0 ? 'disabled' : ''}><svg style="transform:rotate(180deg)"><use href="#i-expand"/></svg></button>
      <button type="button" class="icon-btn sm" data-mv="${k}" data-dir="1" aria-label="Move ${esc(GROUP_NAMES[k])} down" ${i === c.order.length - 1 ? 'disabled' : ''}><svg><use href="#i-expand"/></svg></button></li>`).join('')}</ol>
    <p><button type="button" class="text-btn" id="orderReset" ${c.order.join() === CARD_ORDER.join() ? 'disabled' : ''}>Reset the order</button></p>
    <h4 class="sub">New cards</h4>
    <div class="seg" role="radiogroup" aria-label="Meaning a new card starts with">${[['en', 'English meaning first'], ['zh', 'Chinese meaning first']].map(([k, n]) =>
      `<button type="button" role="radio" class="${c.cardMeaning === k ? 'on' : ''}" aria-checked="${c.cardMeaning === k}" data-cm="${k}">${esc(n)}</button>`).join('')}</div>
    <p class="muted">The WIKI field of a new card starts with the first meaning in this language (English if the other is missing). You can always choose another meaning, in either language, in the card sheet. Automatic script follows your browser language (Traditional for Taiwan, Hong Kong and Macau, otherwise Simplified).</p>`;
}
function move(key, dir) {
  const o = [...getShow().order], i = o.indexOf(key), j = i + dir;
  if (i < 0 || j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]]; setShow({ order: o }); renderShow(); orderCards();
  const again = document.querySelector(`[data-mv="${key}"][data-dir="${dir}"]:not([disabled])`) || document.querySelector(`[data-mv="${key}"]:not([disabled])`);
  if (again) again.focus();   // keep the keyboard on the row that moved
}
const flags = { enOn: 'en', zhOn: 'zh', relOn: 'related', exOn: 'examples' };
document.addEventListener('change', e => { const k = flags[e.target.id]; if (k) { setShow({ [k]: e.target.checked }); renderShow(); } });
document.addEventListener('click', e => {
  const z = e.target.closest('[data-zhs]'), m = e.target.closest('[data-cm]'), mv = e.target.closest('[data-mv]');
  if (mv) { move(mv.dataset.mv, +mv.dataset.dir); return; }
  if (e.target.closest('#orderReset')) { setShow({ order: CARD_ORDER }); renderShow(); orderCards(); return; }
  if (z) { setShow({ script: z.dataset.zhs }); renderShow(); } else if (m) { setShow({ cardMeaning: m.dataset.cm }); renderShow(); }
});

export { showRelated, relatedFromList, renderShow, orderCards };
