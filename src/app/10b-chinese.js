// Kamus app module 10b-chinese: Chinese definitions from the Chinese Wiktionary (zh.wiktionary.org, CC BY-SA), read by the browser.
// A card just below the English one. It is on by default; Settings -> What to show turns it off and picks Simplified or Traditional.
// zh.wiktionary has no definition REST endpoint, so the page text is fetched with action=parse and read like the Indonesian Wiktionary card.
// MediaWiki converts the text itself when asked for a variant (zh-hans / zh-hant), so no conversion table is needed here.
import { bridge } from './bridge.js';
import { esc } from './01-core.js';
import { idb } from './05-idb.js';
import { fetchJSON } from './09-wiktionary.js';
bridge({
  getShow: [() => getShow], orderOf: [() => orderOf], CARD_ORDER: [() => CARD_ORDER], setShow: [() => setShow], getZh: [() => getZh], zhVariant: [() => zhVariant], zhLookup: [() => zhLookup], zhCardHtml: [() => zhCardHtml], swapZhCard: [() => swapZhCard],
  zhParse: [() => zhParse]
});

const SHOW_KEY = 'kamus-show', ZH_API = 'https://zh.wiktionary.org/w/api.php', zhMem = new Map();
const zhAuto = () => (/^zh-(tw|hk|mo|hant)/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '') ? 'zh-hant' : 'zh-hans');
// what the result page shows (Settings -> What to show); every flag is on by default
const CARD_ORDER = ['id', 'related', 'en', 'zh', 'examples'];   // the groups of result cards, in the default order
const SHOW_DEFAULTS = { en: true, zh: true, related: true, examples: true, script: 'auto', cardMeaning: 'en', order: CARD_ORDER };
const validOrder = o => (Array.isArray(o) && o.length === CARD_ORDER.length && CARD_ORDER.every(k => o.includes(k)) ? o : CARD_ORDER);
const getShow = () => { const c = getShowRaw(); return { ...c, order: validOrder(c.order) }; };
const orderOf = key => getShow().order.indexOf(key);
const getShowRaw = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SHOW_KEY) || 'null');
    if (saved) return { ...SHOW_DEFAULTS, ...saved };
    const old = JSON.parse(localStorage.getItem('kamus-zh') || 'null');   // the first version stored only the Chinese choices
    return { ...SHOW_DEFAULTS, ...(old ? { zh: old.on !== false, script: old.script || 'auto' } : {}) };
  } catch { return { ...SHOW_DEFAULTS }; }
};
let showDirty = false;   // a setting that changes the result page was edited: the page you left is stale until it is shown again
const setShow = patch => { try { localStorage.setItem(SHOW_KEY, JSON.stringify({ ...getShow(), ...patch })); } catch { /* storage blocked */ } if (Object.keys(patch).some(k => k !== 'cardMeaning')) showDirty = true; };
const takeShowDirty = () => { const d = showDirty; showDirty = false; return d; };
const getZh = () => ({ on: getShow().zh, script: getShow().script });
const zhVariant = () => { const s = getShow().script; return s === 'hans' ? 'zh-hans' : s === 'hant' ? 'zh-hant' : zhAuto(); };

// html of an action=parse answer -> {senses:[{pos, gloss}], ipa, syll}  (only the Indonesian section)
function zhParse(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html'), h = doc.getElementById('印尼語');   // the heading id is always the traditional spelling
  if (!h) return { senses: [], ipa: '', syll: '', derived: [] };
  doc.querySelectorAll('.mw-editsection').forEach(n => n.remove());
  const text = n => (n.textContent || '').replace(/\s+/g, ' ').trim();
  let node = h.closest('.mw-heading') || h.parentElement, pos = '', ipa = '', syll = '', skip = false;
  const senses = [], derived = new Set();
  for (node = node.nextElementSibling; node && !(node.matches('.mw-heading2') || node.querySelector('h2')); node = node.nextElementSibling) {
    const head = node.matches('.mw-heading3') || node.querySelector('h3');
    if (head) { const t = text(node.querySelector('h3') || node); pos = t.replace(/編輯|编辑/g, '').trim(); skip = false; continue; }
    if (node.matches('.mw-heading4,.mw-heading5,.mw-heading6') || node.querySelector('h4,h5,h6')) { skip = true; continue; }   // derived words, see also: not definitions
    if (skip) node.querySelectorAll('ul > li > span > a').forEach(a => { const w = text(a).toLowerCase(); if (/^[a-z][a-z-]{2,}$/.test(w)) derived.add(w); });   // the derived-word lists (berumah, perumahan ...)
    if (!ipa) { const i = node.querySelector('.IPA'); if (i) ipa = text(i); }
    if (!syll) { const m = /(?:斷字|断字)[：:]\s*(\S+)/.exec(text(node)); if (m) syll = m[1]; }
    if (node.tagName !== 'OL' || skip) continue;
    for (const li of node.children) {
      if (li.tagName !== 'LI') continue;
      const c = li.cloneNode(true); c.querySelectorAll('ul,ol,dl,sup,style,.mw-editsection').forEach(n => n.remove());
      const gloss = text(c).replace(/[，,;；。\s]+$/, '');
      if (gloss) senses.push({ pos, gloss });
    }
  }
  return { senses: senses.slice(0, 8), ipa, syll, derived: [...derived].slice(0, 40) };
}

async function zhFetch(word, variant) {
  const j = await fetchJSON(`${ZH_API}?action=parse&page=${encodeURIComponent(word)}&prop=text&format=json&formatversion=2&disabletoc=1&redirects=1&variant=${variant}&uselang=${variant}&origin=*`);
  const r = j && j.parse ? zhParse(j.parse.text) : { senses: [], ipa: '', syll: '', derived: [] };
  return { ...r, url: `https://zh.wiktionary.org/wiki/${encodeURIComponent(word)}#印尼語`, variant };
}
async function zhLookup(word) {
  word = word.toLowerCase().trim(); const variant = zhVariant(), key = variant + ':' + word;
  if (zhMem.has(key)) return zhMem.get(key);
  const p = (async () => {
    try { const r = await zhFetch(word, variant); idb.put('wiki', 'zh:' + key, r).catch(() => {}); return r; }
    catch (err) { let hit = null; try { hit = await idb.get('wiki', 'zh:' + key); } catch { /* no cache */ } if (hit) return hit; throw err; }   // offline: the last answer we saw
  })();
  zhMem.set(key, p); p.catch(() => zhMem.delete(key)); return p;
}

// null = still loading, false = failed, object = result; '' = nothing to show (the card is left out)
function zhCardHtml(zh) {
  if (!getShow().zh) return '';
  const lang = zhVariant() === 'zh-hant' ? 'zh-Hant' : 'zh-Hans';
  const head = '<h3>中文 <span class="badge">Wiktionary</span></h3>';
  if (zh === null) return `<section class="card" id="sec-zh">${head}<p class="muted" lang="en">Looking up the Chinese Wiktionary…</p></section>`;
  if (zh === false || !zh.senses.length) return '';
  return `<section class="card" id="sec-zh" lang="${lang}">${head}
    ${zh.ipa || zh.syll ? `<p class="pron">${[zh.ipa, zh.syll].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
    <ol>${zh.senses.map((s, j) => `<li class="has-add">${s.pos ? `<span class="pos">${esc(s.pos)}</span> ` : ''}<span class="def">${esc(s.gloss)}</span><button class="icon-btn sm addcard" data-add="zh" data-s="${j}" title="Create Anki card with this meaning" aria-label="Create Anki card with this meaning"><svg><use href="#i-add"/></svg></button></li>`).join('')}</ol>
    <p class="src"><a href="${esc(zh.url)}" target="_blank" rel="noopener">在中文维基词典查看</a> · CC BY-SA</p></section>`;
}
function swapZhCard(html) { const el = document.getElementById('sec-zh'); if (html) { if (el) el.outerHTML = html; } else if (el) el.remove(); }

export { takeShowDirty, CARD_ORDER, orderOf, getShow, setShow, getZh, zhVariant, zhLookup, zhCardHtml, swapZhCard, zhParse };
