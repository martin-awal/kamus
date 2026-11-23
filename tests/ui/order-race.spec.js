// Whatever order the sources answer in (fresh or cached, fast or slow), the cards end up in the order chosen in Settings.
const { test, expect } = require('@playwright/test');
const { VIEWS, openView, json } = require('./helpers');
const KEYS = ['id', 'related', 'en', 'zh', 'examples'], SEC = { id: 'sec-kbbi', related: 'sec-words', en: 'sec-en', zh: 'sec-zh', examples: 'sec-sn' };
const rotate = (a, n) => [...a.slice(n), ...a.slice(0, n)];
const ORDERS = [KEYS, [...KEYS].reverse(), rotate(KEYS, 2), ['examples', 'zh', 'id', 'en', 'related'], ['zh', 'en', 'related', 'examples', 'id']];
const DELAYS = [[0, 0, 0], [400, 0, 0], [0, 400, 0], [0, 0, 400], [300, 100, 200], [100, 300, 0]];   // [English, Chinese, Tatoeba] answer times in ms

test.describe('card order is stable whatever the answer timing', () => {
  test.use({ viewport: { width: 1100, height: 900 } });
  ORDERS.forEach((order, oi) => DELAYS.forEach((delay, di) => {
    test(`order ${oi} delays ${di}: fresh, then the same word again from the caches`, async ({ page }) => {
      await openView(page, VIEWS[0]);
      const [dEn, dZh, dTat] = delay, wait = ms => new Promise(r => setTimeout(r, ms));
      await page.route(/en\.wiktionary\.org\/api\/rest_v1\/page\/definition\/rumah/, async r => { await wait(dEn); r.fulfill(json({ id: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'house' }] }] })); });
      await page.route(/zh\.wiktionary\.org\/w\/api\.php/, async r => { await wait(dZh); r.fulfill(json({ parse: { title: 'rumah', text: '<div class="mw-parser-output"><div class="mw-heading mw-heading2"><h2 id="印尼語">印尼語</h2></div><div class="mw-heading mw-heading3"><h3>名词</h3></div><ol><li>家</li></ol><div class="mw-heading mw-heading4"><h4>派生词</h4></div><ul><li><span><a>berumah</a></span></li></ul></div>' } })); });
      await page.route(/api\.tatoeba\.org/, async r => { await wait(dTat); r.fulfill(json({ data: [{ id: 1, text: 'Rumah saya besar.', translations: [{ lang: 'eng', text: 'My house is big.' }] }] })); });
      await page.evaluate(o => { const s = JSON.parse(localStorage.getItem('kamus-show') || '{}'); localStorage.setItem('kamus-show', JSON.stringify({ ...s, order: o })); }, order);
      const expected = order.map(k => SEC[k]);
      for (const round of ['fresh', 'cached']) {
        await page.fill('#q', 'rumah'); await page.press('#q', 'Enter');
        for (const id of Object.values(SEC)) await expect(page.locator('#' + id), `${round}: ${id}`).toHaveCount(1, { timeout: 15000 });
        await page.waitForTimeout(450);
        const got = await page.evaluate(() => [...document.querySelectorAll('#out > section')].map(s => s.id));
        expect(got, `${round} lookup`).toEqual(expected);
      }
    });
  }));
});
