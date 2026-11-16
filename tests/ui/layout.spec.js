// Layout invariants for every view at every size (plan step 2). Tagged @smoke: Firefox runs these too.
const { test, expect } = require('@playwright/test');
const { SIZES, VIEWS, openView, checkBaseline } = require('./helpers');

for (const size of SIZES) {
  test.describe(`${size.name} (${size.cls})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    for (const view of VIEWS) {
      test(`${view.name}: layout invariants @smoke`, async ({ page }) => {
        await openView(page, view);
        const r = await page.evaluate(() => {
          const rect = el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
          const vis = el => { if (!el) return false; const s = getComputedStyle(el), b = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && b.width > 1 && b.height > 1; };
          const fixed = {};
          for (const [name, sel] of Object.entries({ nav: '.rail', history: '#sheet', search: '.dock form', toolbar: '#tocWrap .ftb', tocList: '#tocWrap .toc', mine: '#mineFloat', ankiChip: '#ankiChip' })) { const el = document.querySelector(sel); if (vis(el)) fixed[name] = rect(el); }
          const de = document.documentElement;
          window.scrollTo(0, de.scrollHeight);
          const last = [...document.querySelectorAll('main:not([hidden]) .wrap > *')].filter(vis).pop();
          return { scrollW: de.scrollWidth, innerW: innerWidth, innerH: innerHeight, fixed, lastBottom: last ? last.getBoundingClientRect().bottom : 0, navAfterScroll: rect(document.querySelector('.rail')) };
        });
        // 1. no horizontal scrolling
        expect(checkBaseline('layout', r.scrollW > r.innerW ? [`hscroll|${view.name}|${size.name}`] : []), `page must not scroll sideways (${r.scrollW} > ${r.innerW})`).toEqual([]);
        // 2. navigation type for the window size class
        const nav = r.fixed.nav; expect(nav, 'navigation is visible').toBeTruthy();
        if (size.cls === 'compact') {
          expect(nav.w, 'compact: bottom navigation bar spans the width').toBeGreaterThan(r.innerW - 2);
          expect(nav.b, 'compact: bar sits at the bottom').toBeGreaterThan(r.innerH - 2); expect(nav.h).toBeLessThan(100);
        } else {
          expect(nav.h, `${size.cls}: navigation rail spans the height`).toBeGreaterThan(r.innerH - 2);
          expect(nav.l).toBeLessThan(1); expect(nav.w, 'rail is narrow').toBeLessThanOrEqual(size.cls === 'large' ? 360 : 100);
        }
        // 3. fixed elements must not overlap each other
        const names = Object.keys(r.fixed), hits = [];
        for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
          const a = r.fixed[names[i]], b = r.fixed[names[j]];
          if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1) hits.push(names[i] + ' overlaps ' + names[j]);
        }
        expect(checkBaseline('layout', hits.map(h => `${h}|${view.name}|${size.name}`)), 'fixed elements overlap: ' + hits.join(', ')).toEqual([]);
        // 4. at the end of the page, the last content is not hidden under the bottom bar
        if (size.cls === 'compact') expect(r.lastBottom, 'last content clears the bottom bar').toBeLessThanOrEqual(r.navAfterScroll.t + 1);
      });
    }
  });
}

// The adaptive patterns themselves (plan steps 6-8)
test.describe('adaptive layout', () => {
  for (const size of SIZES) {
    test(`${size.name}: History stays hidden until asked for, then opens as a sheet @smoke`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openView(page, VIEWS[1]);
      const sheet = page.locator('#sheet');
      await expect(sheet).not.toHaveClass(/open/); expect(await sheet.evaluate(el => el.inert && getComputedStyle(el).visibility === 'hidden')).toBe(true);
      const toolbar = page.locator('#tocWrap .ftb');
      if (size.cls === 'compact') {   // floating toolbar, top right: contents + History
        await expect(toolbar.locator('#tocBtn')).toBeVisible(); await expect(toolbar.locator('#histTop')).toBeVisible();
        const b = await toolbar.boundingBox(); expect(b.y).toBeLessThan(40); expect(b.x + b.width).toBeGreaterThan(size.width - 40);
        await toolbar.locator('#histTop').click();
      } else {
        await expect(page.locator('#histTop')).toBeHidden();
        if (size.width < 1600) await expect(toolbar.locator('#tocBtn')).toBeVisible(); else await expect(toolbar).toBeHidden();
        await page.click('#histBtn');
      }
      await expect(sheet).toHaveClass(/open/); await expect(page.locator('#hist .hcard').first()).toContainText('rumah');
      await page.keyboard.press('Escape'); await expect(sheet).not.toHaveClass(/open/);
    });
    test(`${size.name}: text column is capped and other views ignore the pane @smoke`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openView(page, VIEWS.find(v => v.name === 'settings'));
      const w = await page.evaluate(() => { const b = document.querySelector('#viewSettings .wrap').getBoundingClientRect(), n = document.querySelector('.rail').getBoundingClientRect(); return { width: b.width, left: b.left, railRight: innerWidth < 600 ? 0 : n.right, paneVisible: getComputedStyle(document.getElementById('sheet')).display !== 'none' }; });
      expect(w.width).toBeLessThanOrEqual(size.width >= 1600 ? 840 : 720);
      expect(w.left).toBeGreaterThanOrEqual(w.railRight);
    });
  }
  for (const size of SIZES) {
    test(`${size.name}: Anki is ${size.width >= 840 ? 'list + detail' : 'a single list with inline previews'}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openView(page, VIEWS.find(v => v.name === 'anki'));
      const detail = page.locator('#ankiDetail');
      if (size.width >= 840) {
        await expect(detail).toBeVisible(); await expect(detail.locator('.face')).toHaveCount(4);          // first card is selected by default
        const first = await detail.locator('h3').innerText();
        await page.locator('#ankiList .crow').nth(1).click();
        await expect(detail.locator('h3')).not.toHaveText(first); await expect(page.locator('#ankiList .crow.sel')).toHaveCount(1);
        const b = await page.evaluate(() => { const l = document.querySelector('.ld-list').getBoundingClientRect(), d = document.getElementById('ankiDetail').getBoundingClientRect(); return { side: d.left >= l.right, listW: l.width, detW: d.width }; });
        expect(b.side, 'detail sits beside the list').toBe(true); expect(b.listW).toBeGreaterThanOrEqual(300); expect(b.detW).toBeGreaterThanOrEqual(320);
        await detail.locator('[data-dact=edit]').click(); await expect(page.locator('#csheet')).toHaveClass(/open/);
      } else {
        await expect(detail).toBeHidden();
        await page.locator('#ankiList [data-act=prev]').first().click(); await expect(page.locator('#ankiList .crow-prev .face')).toHaveCount(4);
      }
    });
    test(`${size.name}: affix lessons are ${size.width >= 840 ? 'a lesson list beside the lesson' : 'chips above the lesson'}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openView(page, VIEWS.find(v => v.name === 'affixes'));
      const r = await page.evaluate(() => { const c = document.querySelectorAll('#affixRoot > .card'), a = c[0].getBoundingClientRect(), b = c[1].getBoundingClientRect(); return { beside: b.left >= a.right - 1, below: b.top >= a.bottom - 1 }; });
      expect(size.width >= 840 ? r.beside : r.below).toBe(true);
      await page.click('[data-lesson=men]'); await expect(page.locator('#affixRoot')).toContainText('menyapu');
    });
  }
});
