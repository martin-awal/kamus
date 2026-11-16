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
          for (const [name, sel] of Object.entries({ nav: '.rail', search: '.dock form', toc: '#tocWrap #tocBtn', tocList: '#tocWrap .toc', mine: '#mineFloat', histTop: '#histTop', ankiChip: '#ankiChip' })) { const el = document.querySelector(sel); if (vis(el)) fixed[name] = rect(el); }
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

// Not built yet: these describe the target layout of plan steps 7-8 and are switched on there.
test.describe('adaptive layout targets', () => {
  test.fixme('expanded/large: History is a persistent supporting pane (step 7)', async () => {});
  test.fixme('expanded/large: Anki is a list-detail layout (step 8)', async () => {});
  test.fixme('large: content has a capped readable width with panes beside it (step 6)', async () => {});
});
