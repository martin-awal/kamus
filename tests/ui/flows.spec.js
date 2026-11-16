// Task flows with step budgets (plan step 4). A "step" is one user interaction after the page has loaded: a tap, or typing into one field
// (including Enter). If a UI change makes a flow longer than its budget, the test fails.
const { test, expect } = require('@playwright/test');
const { SIZES, VIEWS, openView } = require('./helpers');

function counter(page) {
  let n = 0;
  return { tap: async sel => { n++; await page.click(sel); }, type: async (sel, text) => { n++; await page.fill(sel, text); await page.press(sel, 'Enter'); }, key: async k => { n++; await page.keyboard.press(k); }, get steps() { return n; } };
}
const home = VIEWS[0];

for (const size of [SIZES[1], SIZES[4]]) {   // a phone and a laptop
  test.describe(`flows at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch });

    test('look up a word (budget 2)', async ({ page }) => {
      await openView(page, home); const u = counter(page);
      await u.tap('#q'); await u.type('#q', 'rumah');
      await expect(page.locator('#sec-kbbi')).toContainText('tempat tinggal');
      expect(u.steps).toBeLessThanOrEqual(2);
    });
    test('make a card from a meaning (budget 4)', async ({ page }) => {
      await openView(page, home, { cards: false }); const u = counter(page);
      await u.tap('#q'); await u.type('#q', 'rumah'); await page.waitForSelector('#sec-kbbi .addcard');
      await u.tap('#sec-kbbi .addcard >> nth=0'); await page.waitForSelector('#csheet.open');
      await expect(page.locator('#csave')).toBeEnabled(); await u.tap('#csave');
      await expect.poll(() => page.evaluate(async () => (await KamusCards.list()).length)).toBe(1);
      expect(u.steps).toBeLessThanOrEqual(4);
    });
    test('review three cards (budget 8)', async ({ page }) => {
      await openView(page, home); const u = counter(page);
      await u.tap('#homeLearn [data-hl=review]'); await page.waitForSelector('#reviewDlg[open]');
      for (let i = 0; i < 3; i++) { await u.tap('[data-rev=show]'); await u.tap('[data-rev=good]'); }
      await page.waitForSelector('.rev-done'); await u.tap('[data-rev=close]');
      expect(u.steps).toBeLessThanOrEqual(8);
    });
    test('switch to dark mode (budget 2)', async ({ page }) => {
      await openView(page, home); const u = counter(page);
      await u.tap('#navSettings'); await u.tap('[data-mode=dark]');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      expect(u.steps).toBeLessThanOrEqual(2);
    });
    test('back up cards (budget 3)', async ({ page }) => {
      await openView(page, home); const u = counter(page);
      await u.tap('#navSettings'); await page.waitForSelector('[data-st=backup]');
      const dl = page.waitForEvent('download'); await u.tap('[data-st=backup]');
      expect((await dl).suggestedFilename()).toMatch(/^kamus-cards-backup-.*\.json$/);
      expect(u.steps).toBeLessThanOrEqual(3);
    });
    test('answer an affix practice question (budget 3)', async ({ page }) => {
      await openView(page, home); const u = counter(page);
      await u.tap('#navAffix'); await u.tap('[data-af=start]'); await u.tap('#afQuiz .choice >> nth=0');
      await expect(page.locator('#afFb')).toContainText(/=/);
      expect(u.steps).toBeLessThanOrEqual(3);
    });
    test('compare a word in Malay and Indonesian (budget 3)', async ({ page }) => {
      await openView(page, home); const u = counter(page);
      await u.tap('#navLearn'); await u.type('#cmpIn', 'rumah');
      await expect(page.locator('#cmpOut .cmp-cols')).toBeVisible();
      expect(u.steps).toBeLessThanOrEqual(3);
    });
  });
}
