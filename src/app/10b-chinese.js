// Kamus app module 10b-chinese: Chinese definitions from the Chinese Wiktionary (zh.wiktionary.org, CC BY-SA), read by the browser.
// A card just below the English one. It is on by default; Settings -> Chinese definitions turns it off and picks Simplified or Traditional.
// zh.wiktionary has no definition REST endpoint, so the page text is fetched with action=parse and read like the Indonesian Wiktionary card.
// MediaWiki converts the text itself when asked for a variant (zh-hans / zh-hant), so no conversion table is needed here.
import { bridge } from './bridge.js';
import { esc } from './01-core.js';
import { idb } from './05-idb.js';
import { fetchJSON } from './09-wiktionary.js';
bridge({
  getZh: [() => getZh], setZh: [() => setZh], zhLookup: [() => zhLookup], zhCardHtml: [() => zhCardHtml], swapZhCard: [() => swapZhCard],
  zhParse: [() => zhParse], renderZh: [() => renderZh]
});

const ZH_KEY = 'kamus-zh', ZH_API = 'https://zh.wiktionary.org/w/api.php', zhMem = new Map();
const zhAuto = () => (/^zh-(tw|hk|mo|hant)/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '') ? 'zh-hant' : 'zh-hans');
const getZh = () => { try { return { on: true, script: 'auto', ...JSON.parse(localStorage.getItem(ZH_KEY)) }; } catch { return { on: true, script: 'auto' }; } };
const setZh = patch => { try { localStorage.setItem(ZH_KEY, JSON.stringify({ ...getZh(), ...patch })); } catch { /* storage blocked */ } };
const zhVariant = () => { const s = getZh().script; return s === 'hans' ? 'zh-hans' : s === 'hant' ? 'zh-hant' : zhAuto(); };

// html of an action=parse answer -> {senses:[{pos, gloss}], ipa, syll}  (only the Indonesian section)
function zhParse(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html'), h = doc.getElementById('印尼語');   // the heading id is always the traditional spelling
  if (!h) return { senses: [], ipa: '', syll: '' };
  doc.querySelectorAll('.mw-editsection').forEach(n => n.remove());
  const text = n => (n.textContent || '').replace(/\s+/g, ' ').trim();
  let node = h.closest('.mw-heading') || h.parentElement, pos = '', ipa = '', syll = '', skip = false;
  const senses = [];
  for (node = node.nextElementSibling; node && !(node.matches('.mw-heading2') || node.querySelector('h2')); node = node.nextElementSibling) {
    const head = node.matches('.mw-heading3') || node.querySelector('h3');
    if (head) { const t = text(node.querySelector('h3') || node); pos = t.replace(/編輯|编辑/g, '').trim(); skip = false; continue; }
    if (node.matches('.mw-heading4,.mw-heading5,.mw-heading6') || node.querySelector('h4,h5,h6')) { skip = true; continue; }   // derived words, see also: not definitions
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
  return { senses: senses.slice(0, 8), ipa, syll };
}

async function zhFetch(word, variant) {
  const j = await fetchJSON(`${ZH_API}?action=parse&page=${encodeURIComponent(word)}&prop=text&format=json&formatversion=2&disabletoc=1&redirects=1&variant=${variant}&uselang=${variant}&origin=*`);
  const r = j && j.parse ? zhParse(j.parse.text) : { senses: [], ipa: '', syll: '' };
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
  if (!getZh().on) return '';
  const lang = zhVariant() === 'zh-hant' ? 'zh-Hant' : 'zh-Hans';
  const head = '<h3>中文 <span class="badge">Wiktionary</span></h3>';
  if (zh === null) return `<section class="card" id="sec-zh">${head}<p class="muted" lang="en">Looking up the Chinese Wiktionary…</p></section>`;
  if (zh === false || !zh.senses.length) return '';
  return `<section class="card" id="sec-zh" lang="${lang}">${head}
    ${zh.ipa || zh.syll ? `<p class="pron">${[zh.ipa, zh.syll].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
    <ol>${zh.senses.map(s => `<li>${s.pos ? `<span class="pos">${esc(s.pos)}</span> ` : ''}<span class="def">${esc(s.gloss)}</span></li>`).join('')}</ol>
    <p class="src"><a href="${esc(zh.url)}" target="_blank" rel="noopener">在中文维基词典查看</a> · CC BY-SA</p></section>`;
}
function swapZhCard(html) { const el = document.getElementById('sec-zh'); if (html) { if (el) el.outerHTML = html; } else if (el) el.remove(); }

// ---- Settings -> Chinese definitions
function renderZh() {
  const box = document.getElementById('zhOptions'); if (!box) return;
  const c = getZh();
  box.innerHTML = `<label class="switchrow"><input type="checkbox" id="zhOn" ${c.on ? 'checked' : ''}> Show Chinese definitions (Chinese Wiktionary) under the English ones</label>
    <div class="seg" role="radiogroup" aria-label="Chinese script" ${c.on ? '' : 'hidden'}>${[['auto', 'Automatic'], ['hans', '简体 Simplified'], ['hant', '繁體 Traditional']].map(([k, n]) =>
      `<button type="button" role="radio" class="${c.script === k ? 'on' : ''}" aria-checked="${c.script === k}" data-zhs="${k}">${esc(n)}</button>`).join('')}</div>
    <p class="muted">Automatic follows your browser language (Traditional for Taiwan, Hong Kong and Macau, otherwise Simplified). Not every word has an entry.</p>`;
}
document.addEventListener('change', e => { if (e.target.id === 'zhOn') { setZh({ on: e.target.checked }); renderZh(); } });
document.addEventListener('click', e => { const b = e.target.closest('[data-zhs]'); if (b) { setZh({ script: b.dataset.zhs }); renderZh(); } });

export { getZh, setZh, zhLookup, zhCardHtml, swapZhCard, zhParse, renderZh };
