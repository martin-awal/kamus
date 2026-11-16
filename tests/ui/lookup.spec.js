// Lookup behaviour (plan step 11): sources, the base-word fallback, KBBI staying opt-in, offline answers, history.
const { test, expect } = require('@playwright/test');
const { VIEWS, openView, json } = require('./helpers');
const home = VIEWS[0];
const search = async (page, w) => { await page.fill('#q', w); await page.press('#q', 'Enter'); };
const idwPage = (word, def, example) => json({ parse: { title: word, text: `<div class="mw-parser-output"><div class="mw-heading mw-heading2"><h2 id="Bahasa_Indonesia">Bahasa Indonesia</h2></div><div class="section-header section-header-def"><dl><dt>Verba&#32;</dt></dl></div><ol><li>${def}<br /><i>${example}</i></li></ol></div>` } });

test.describe('lookup', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('default source is Indonesian Wiktionary, read by the browser; the Kamus server is never asked', async ({ page }) => {
    const api = []; page.on('request', r => { if (/\/api\/(lookup|kbbi\?)/.test(r.url())) api.push(r.url()); });
    await openView(page, home); await search(page, 'rumah');
    const hero = page.locator('#sec-kbbi');
    await expect(hero).toContainText('ru·mah'); await expect(hero).toContainText('tempat tinggal'); await expect(hero).toContainText('Rumah itu besar');
    await expect(hero.locator('.src')).toContainText('Wiktionary (Indonesian)');
    await expect(page.locator('#sec-en')).toContainText('house'); await expect(page.locator('#sec-sn')).toContainText('My house is big.');
    await expect(page.locator('#tocList a')).toHaveText(['Wiktionary (id) · rumah', 'English · Wiktionary', 'Examples · Tatoeba']);
    expect(api, 'KBBI is opt-in: no server lookup without choosing it').toEqual([]);
  });

  test('a derived word falls back to its base word and shows the word parts', async ({ page }) => {
    await openView(page, home);
    await page.route(/id\.wiktionary\.org\/w\/api\.php.*page=lari\b/, r => r.fulfill(idwPage('lari', 'melangkah dengan kecepatan tinggi', 'Anak itu lari ke rumah')));
    await page.waitForFunction(() => wlState.has);
    await search(page, 'berlari');
    await expect(page.locator('#out .snack')).toContainText('showing its base word “lari”');
    await expect(page.locator('#sec-kbbi')).toContainText('melangkah dengan kecepatan tinggi');
    await expect(page.locator('.morph')).toHaveText(/ber-\s*\+\s*lari/);
    await page.click('.morph-w'); await expect(page.locator('#q')).toHaveValue('lari');
  });

  test('KBBI is used only after it is chosen, and then through the server with an explicit source', async ({ page }) => {
    const calls = [];
    await page.route('**/api/kbbi/status', r => r.fulfill(json({ web: true, api: false })));
    await page.route('**/api/lookup?**', r => { calls.push(r.request().url()); r.fulfill(json({ word: 'rumah', kbbi: [{ headword: 'rumah', syllables: 'ru·mah', ipa: '/rumah/', senses: [{ pos: ['n'], definition: 'bangunan untuk tempat tinggal', examples: ['rumah itu baru'] }] }], kbbi_base: null, warnings: [] })); });
    await page.route('**/api/tts/status', r => r.fulfill(json({}))); await page.route('**/api/translate/status', r => r.fulfill(json({})));
    await openViewServer(page);
    await search(page, 'rumah'); await expect(page.locator('#sec-kbbi .src')).toContainText('Wiktionary'); expect(calls).toEqual([]);
    await page.goto('/#settings'); await page.click('[data-idsrc=kbbi-web]'); await expect(page.locator('[data-idsrc=kbbi-web]')).toHaveClass(/sel/);
    await page.goto('/#kamus'); await search(page, 'rumah');
    await expect(page.locator('#sec-kbbi')).toContainText('bangunan untuk tempat tinggal'); await expect(page.locator('#sec-kbbi .src')).toContainText('KBBI (kbbi.web.id)');
    expect(calls.length).toBe(1); expect(calls[0]).toMatch(/src=web/);
  });

  test('without the server the KBBI choices are locked and the setting falls back to Wiktionary', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('kamus-idsrc', 'kbbi-web'));
    await openView(page, VIEWS.find(v => v.name === 'settings'));
    await expect(page.locator('[data-idsrc=kbbi-web]')).toHaveAttribute('data-locked', 'true');
    await expect(page.locator('[data-idsrc=wikt]')).toHaveClass(/sel/);
  });

  test('answers are kept for offline use', async ({ page }) => {
    await openView(page, home); await search(page, 'rumah'); await expect(page.locator('#sec-en')).toContainText('house');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.route(/fonts\.|wiktionary\.org|tatoeba\.org|mymemory/, r => r.abort());
    await page.reload(); await page.waitForFunction(() => typeof serverUp !== 'undefined' && serverUp === false);
    await search(page, 'rumah');
    await expect(page.locator('#sec-kbbi')).toContainText('tempat tinggal'); await expect(page.locator('#sec-en')).toContainText('house'); await expect(page.locator('#sec-sn')).toContainText('My house is big.');
  });

  test('history records the word with its English meaning, newest first, and Clear empties it', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await openView(page, home); await search(page, 'rumah'); await expect(page.locator('#sec-en')).toContainText('house');
    const h = await page.evaluate(() => hist().map(x => [x.w, x.g]));
    expect(h[0]).toEqual(['rumah', 'house']);
    await page.click('#histBtn'); await expect(page.locator('#hist .hcard').first()).toContainText('rumah');
    await page.click('#clearHist'); await expect(page.locator('#hist')).toContainText('No searches yet');
  });

  test('"Your cards" appears for a word that already has a card', async ({ page }) => {
    await openView(page, home); await search(page, 'rumah');
    await expect(page.locator('#mineFloat')).toContainText('house');
  });
});

// a page that believes the Kamus server is there (status endpoints are mocked by the caller)
async function openViewServer(page) {
  const { mockNetwork } = require('./helpers');
  await mockNetwork(page);
  await page.addInitScript(() => { try { localStorage.setItem('kamus-cards-migrated', '1'); } catch (e) {} });
  await page.goto('/'); await page.waitForFunction(() => typeof serverUp !== 'undefined' && serverUp === true);
}
