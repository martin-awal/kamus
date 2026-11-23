// The order also holds when the Indonesian source is KBBI (several entries, served by the Kamus server).
const { test, expect } = require('@playwright/test');
const { json, mockNetwork } = require('./helpers');
const search = async (page, w) => { await page.fill('#q', w); await page.press('#q', 'Enter'); };

test('KBBI source: cards follow the order, fresh and when searched again', async ({ page }) => {
  const e = (h, s) => ({ headword: h, syllables: s, ipa: '/' + h + '/', senses: [{ pos: ['n'], definition: 'x ' + h, examples: [] }] });
  await mockNetwork(page);
  await page.route('**/api/kbbi/status', r => r.fulfill(json({ web: true, api: false })));
  await page.route('**/api/lookup?**', r => r.fulfill(json({ word: 'rumah', kbbi: [e('rumah', 'ru·mah'), e('berumah', 'be·ru·mah'), e('berumahkan', 'be·ru·mah·kan')], kbbi_base: null, warnings: [] })));
  await page.route('**/api/tts/status', r => r.fulfill(json({}))); await page.route('**/api/translate/status', r => r.fulfill(json({})));
  await page.route(/en\.wiktionary\.org\/api\/rest_v1\/page\/definition\/rumah/, r => r.fulfill(json({ id: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'house' }] }] })));
  await page.route(/zh\.wiktionary\.org\/w\/api\.php/, r => r.fulfill(json({ parse: { title: 'rumah', text: '<div class="mw-parser-output"><div class="mw-heading mw-heading2"><h2 id="印尼語">印尼語</h2></div><div class="mw-heading mw-heading3"><h3>名词</h3></div><ol><li>家</li></ol><div class="mw-heading mw-heading4"><h4>派生词</h4></div><ul><li><span><a>berumah</a></span></li></ul></div>' } })));
  await page.route(/api\.tatoeba\.org/, r => r.fulfill(json({ data: [{ id: 1, text: 'Rumah saya besar.', translations: [{ lang: 'eng', text: 'My house is big.' }] }] })));
  await page.addInitScript(() => { localStorage.setItem('kamus-idsrc', 'kbbi-web'); localStorage.setItem('kamus-show', JSON.stringify({ order: ['id', 'en', 'zh', 'related', 'examples'] })); });
  await page.addInitScript(() => { try { localStorage.setItem('kamus-cards-migrated', '1'); } catch (e) {} });
  await page.goto('/'); await page.waitForFunction(() => typeof serverUp !== 'undefined' && serverUp === true);
  for (const round of [1, 2, 3]) {
    await search(page, 'rumah'); await expect(page.locator('#sec-sn')).toHaveCount(1); await page.waitForTimeout(500);
    const got = await page.evaluate(() => [...document.querySelectorAll('#out > section')].map(s => s.dataset.card === 'id' ? 'id' : s.id));
    expect(got, 'round ' + round).toEqual(['id', 'id', 'id', 'sec-en', 'sec-zh', 'sec-words', 'sec-sn']);
  }
});
