// Screenshot comparison per view and size (plan step 5). Baselines are NOT in git (tests/ui/.snapshots is ignored): CI keeps them as a cache and
// uploads the images as artifacts. The first run on a machine creates them; run with --update-snapshots after an intended visual change.
// Only Chromium compares pixels (fonts render differently per engine and machine); the other engines are covered by the layout checks.
const { test, expect } = require('@playwright/test');
const { SIZES, VIEWS, openView } = require('./helpers');

test.describe('screenshots', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'pixel comparison runs in Chromium only');
  for (const size of SIZES) for (const view of VIEWS) for (const scheme of (size.name === '390x844' || size.name === '1280x800') ? ['light', 'dark'] : ['light']) {
    test(`${view.name} ${size.name} ${scheme}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block', baseURL: test.info().project.use.baseURL, locale: 'en-GB', timezoneId: 'UTC' });
      const page = await ctx.newPage();
      await page.clock.install({ time: new Date('2026-01-15T10:00:00Z') });   // words of the day and dates stay the same
      await openView(page, view);
      await expect(page).toHaveScreenshot(`${view.name}-${size.name}-${scheme}.png`, { fullPage: false, mask: [page.locator('audio')] });
      await ctx.close();
    });
  }
});
