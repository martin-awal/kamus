// Shared pieces of the UI matrix: sizes, views, network mocks, seeded data, and the "known violations" baseline.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');

// M3 window size classes: compact < 600, medium 600-839, expanded 840-1199, large >= 1200
const SIZES = [
  { name: '360x640', width: 360, height: 640, cls: 'compact', touch: true },
  { name: '390x844', width: 390, height: 844, cls: 'compact', touch: true },
  { name: '820x1180', width: 820, height: 1180, cls: 'medium', touch: true },
  { name: '1180x820', width: 1180, height: 820, cls: 'expanded', touch: true },
  { name: '1280x800', width: 1280, height: 800, cls: 'large', touch: false },
  { name: '1920x1080', width: 1920, height: 1080, cls: 'large', touch: false },
];
// every view, plus the Kamus page with a result on it (that is where the floating elements appear)
const VIEWS = [
  { name: 'kamus', hash: '#kamus', ready: '#homeLearn .home-tile' },
  { name: 'kamus-result', hash: '#kamus', search: 'rumah', ready: '#sec-sn' },
  { name: 'learn', hash: '#learn', ready: '#lh-pron' },
  { name: 'anki', hash: '#anki', ready: '#ankiList .crow' },
  { name: 'affixes', hash: '#affixes', ready: '#afChips' },
  { name: 'settings', hash: '#settings', ready: '#storageBox .st-row' },
  { name: 'legal', hash: '#legal', ready: '#creditsList .legal-h' },
];
const CARDS = [
  { Word: 'rumah', IPA: '/ˈrumah/', POS: 'n.', KBBI: 'tempat tinggal', Wiki: 'house', Example: 'Rumah itu besar', ExampleEN: 'That house is big' },
  { Word: 'pagi', POS: 'n.', KBBI: 'bagian awal hari', Wiki: 'morning', Example: 'Selamat pagi semua', ExampleEN: 'Good morning everyone' },
  { Word: 'makan', POS: 'v.', KBBI: 'memasukkan makanan ke mulut', Wiki: 'to eat', Example: 'Saya mau makan nasi', ExampleEN: 'I want to eat rice' },
];
// a trimmed copy of the Chinese Wiktionary's Indonesian section (heading id is always the traditional spelling)
const zhPage = (gloss, pos) => `<div class="mw-parser-output"><div class="mw-heading mw-heading2"><h2 id="印尼語">印尼語</h2></div><div class="mw-heading mw-heading3"><h3 id="發音">发音</h3></div><ul><li>国际音标: <span class="IPA">[ˈrumah]</span></li><li>断字：<span>ru‧mah</span></li></ul><div class="mw-heading mw-heading3"><h3 id="名詞">${pos}</h3></div><p><b>rumah</b></p><ol><li><a>${gloss.split('，')[0]}</a>，<a>${gloss.split('，')[1]}</a></li></ol><div class="mw-heading mw-heading4"><h4>派生词</h4></div><ol><li>不该出现</li></ol><div class="mw-heading mw-heading2"><h2 id="马来语">马来语</h2></div><ol><li>别的语言</li></ol></div>`;
const json = body => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

async function mockNetwork(page, { offline = false } = {}) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());   // system fonts: same metrics on every run
  await page.route('**/credits.json', r => r.fulfill(json(fs.readFileSync(path.join(ROOT, 'credits.json'), 'utf8'))));
  if (offline) { await page.route(/wiktionary\.org|tatoeba\.org|mymemory/, r => r.abort()); return; }
  await page.route(/id\.wiktionary\.org\/w\/api\.php/, r => /page=rumah/.test(r.request().url()) ? r.fulfill(json(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'idw-rumah.json'), 'utf8'))) : r.fulfill(json({ error: { code: 'missingtitle' } })));
  await page.route(/en\.wiktionary\.org\/api\/rest_v1\/page\/definition\/([^?]+)/, r => /definition\/rumah/.test(r.request().url())
    ? r.fulfill(json({ id: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'house', parsedExamples: [{ example: 'Kemarin aku pergi ke rumah teman.', translation: 'I went to a friend’s home yesterday.' }] }, { definition: 'home' }] }] }))
    : r.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
  await page.route(/en\.wiktionary\.org\/w\/api\.php/, r => r.fulfill(json({ parse: { text: '<p></p>' }, query: { search: [] } })));
  await page.route(/zh\.wiktionary\.org\/w\/api\.php/, r => { const u = r.request().url(), hant = /variant=zh-hant/.test(u);
    r.fulfill(json(/page=rumah/.test(u) ? { parse: { title: 'rumah', text: zhPage(hant ? '家，房子' : '家，房子', hant ? '名詞' : '名词') } } : { error: { code: 'missingtitle' } })); });
  await page.route(/api\.tatoeba\.org/, r => /q=rumah/.test(r.request().url()) ? r.fulfill(json({ data: [{ id: 1, text: 'Rumah saya besar.', translations: [{ lang: 'eng', text: 'My house is big.' }] }, { id: 2, text: 'Kamu di rumah.', translations: [{ lang: 'eng', text: "You're at home." }] }] })) : r.fulfill(json({ data: [] })));
  await page.route(/api\.mymemory/, r => r.fulfill(json({ responseStatus: 200, responseData: { translatedText: 'house' } })));
}
// open one view with seeded cards; resolves when the view's content is there
async function openView(page, view, { cards = true, offline = false } = {}) {
  await mockNetwork(page, { offline });
  await page.addInitScript(() => { try { localStorage.setItem('kamus-cards-migrated', '1'); } catch (e) {} });
  await page.goto('/');
  await page.waitForFunction(() => typeof serverUp !== 'undefined' && serverUp === false);
  if (cards) await page.evaluate(async list => { for (const f of list) await KamusCards.create(f); }, CARDS);
  await page.goto('/' + view.hash); if (cards || view.hash !== '#kamus') await page.reload();
  if (view.search) { await page.fill('#q', view.search); await page.press('#q', 'Enter'); }
  if (view.ready && !(view.name === 'anki' && !cards)) await page.waitForSelector(view.ready, { timeout: 15000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(350);   // entrance animations are off (reduced motion); this covers late async renders
}

// ---- known-violation baseline: a check returns keys; keys already in baseline.json pass, new ones fail.
// UPDATE_BASELINE=1 (one worker) rewrites the file. The goal of plan step 10 is to empty it.
const BASELINE = path.join(__dirname, 'baseline.json');
const readBaseline = () => { try { return JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) { return {}; } };
function checkBaseline(check, keys) {
  keys = [...new Set(keys)].sort();
  const all = readBaseline(), known = new Set(all[check] || []);
  if (process.env.UPDATE_BASELINE) { all[check] = [...new Set([...(all[check] || []), ...keys])].sort(); fs.writeFileSync(BASELINE, JSON.stringify(all, null, 1) + '\n'); return []; }
  return keys.filter(k => !known.has(k));
}
// a short, stable description of an element (tag#id.class[data-attr]) for baseline keys
const DESCRIBE = `el => { const d = [...el.attributes].filter(a => /^data-(?!w$|lw$|say$|know$|id$|s$|e$|word$|gow$)/.test(a.name)).map(a => '[' + a.name + ']').join('');
  return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ([...el.classList].filter(c => !/^(on|sel|open|focus|loading|speaking|ok|bad|stuck)$/.test(c)).slice(0, 2).map(c => '.' + c).join('')) + d; }`;

module.exports = { SIZES, VIEWS, CARDS, mockNetwork, openView, checkBaseline, DESCRIBE, json };
