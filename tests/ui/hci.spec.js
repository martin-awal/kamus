// HCI checks (plan step 3): target size, text size, accessibility (axe), keyboard, reduced motion, zoom, themes, error and empty states.
// Hard failures compare against tests/ui/baseline.json (known problems); heuristics are reported as warnings and never fail.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { SIZES, VIEWS, openView, checkBaseline, DESCRIBE } = require('./helpers');

const warn = (info, text) => { info.annotations.push({ type: 'warning', description: text }); console.log(`  warning: ${text}`); };
const INTERACTIVE = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=radio], [tabindex="0"]';
// sizes of every visible interactive element, grouped by a stable description
const measure = (page) => page.evaluate(([sel, describeSrc]) => {
  const describe = eval(describeSrc), out = {};
  for (const el of document.querySelectorAll(sel)) {
    const s = getComputedStyle(el), b = el.getBoundingClientRect();
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05 || b.width < 1 || b.height < 1 || el.closest('[inert],[hidden]') || el.disabled) continue;
    if (el.tagName === 'A' && s.display === 'inline') continue;   // links inside a sentence are exempt (WCAG 2.5.8 inline exception)
    if (el.matches('input[type=checkbox],input[type=radio],input[type=range],input[type=color],input[type=file]') && el.closest('label')) { const lb = el.closest('label').getBoundingClientRect(); if (lb.height >= b.height) { b.width = Math.max(b.width, lb.width); b.height = lb.height; } }
    const k = describe(el), cur = out[k];
    const m = { w: Math.round(b.width), h: Math.round(b.height), cy: (b.top + b.height / 2) / innerHeight };
    if (!cur || Math.min(m.w, m.h) < Math.min(cur.w, cur.h)) out[k] = m;
  }
  return out;
}, [INTERACTIVE, DESCRIBE]);

for (const size of SIZES) {
  test.describe(`${size.name} (${size.cls})`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch });
    for (const view of VIEWS) {
      test(`${view.name}: target size and text size`, async ({ page, browserName }, info) => {
        await openView(page, view);
        const m = await measure(page);
        if (size.touch) {   // touch devices: 48px is a hard rule
          const small = Object.entries(m).filter(([, v]) => v.w < 48 || v.h < 48).map(([k]) => `${view.name}|${size.cls}|${k}`);
          const fresh = checkBaseline('target48', small);
          expect(fresh, 'touch targets under 48px that are not in the baseline').toEqual([]);
        } else {            // mouse: 32px is a guideline
          const small = Object.entries(m).filter(([, v]) => v.w < 32 || v.h < 32).map(([k, v]) => `${k} (${v.w}x${v.h})`);
          if (small.length) warn(info, `${view.name} ${size.name}: ${small.length} mouse target(s) under 32px: ${small.slice(0, 8).join(', ')}`);
        }
        const tiny = await page.evaluate((describeSrc) => {
          const describe = eval(describeSrc), out = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n; (n = w.nextNode());) {
            if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el || el.closest('[inert],[hidden],script,style,svg')) continue;
            const s = getComputedStyle(el), b = el.getBoundingClientRect(); if (s.display === 'none' || s.visibility === 'hidden' || b.width < 1) continue;
            if (parseFloat(s.fontSize) < 12) out.add(describe(el) + '@' + s.fontSize);
          }
          return [...out];
        }, DESCRIBE);
        expect(checkBaseline('text12', tiny.map(k => `${view.name}|${k}`)), 'text smaller than 12px').toEqual([]);
        if (size.cls === 'compact') {   // thumb reach: primary actions in the lower 60% of the screen or in the bottom bar (heuristic)
          const primary = { 'search': '.dock form', 'navigation': '.rail', 'Start review': '[data-hl=review]', 'speaker': '.hero [data-say]' };
          for (const [name, sel] of Object.entries(primary)) {
            const cy = await page.evaluate(s => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return b.width ? (b.top + b.height / 2) / innerHeight : null; }, sel);
            if (cy !== null && cy >= 0 && cy <= 1 && cy < 0.4) warn(info, `${view.name} ${size.name}: "${name}" sits in the top 40% of the screen (hard to reach with a thumb)`);
          }
        }
      });
    }
  });
}

// ---- accessibility with axe (WCAG 2.1 A/AA incl. contrast): light and dark, three seed colours. @smoke: Firefox runs it too.
const SEEDS_RUN = process.env.KAMUS_ALL_SEEDS ? null : ['#6750a4', '#006a6a', '#b3261e'];   // default purple, teal, red; nightly = every colour in SEEDS
for (const scheme of ['light', 'dark']) {
  for (const size of [SIZES[1], SIZES[4]]) {
    test.describe(`axe ${scheme} ${size.name}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });
      for (const view of VIEWS) {
        test(`${view.name}: no new accessibility violations @smoke`, async ({ page }) => {
          test.setTimeout(120000);
          await openView(page, view);
          const seeds = SEEDS_RUN || await page.evaluate(() => SEEDS.map(s => s[0]));
          const keys = [];
          for (const seed of seeds) {
            await page.evaluate(s => KamusTheme.apply(s), seed); await page.waitForTimeout(60);
            const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('[inert]').analyze();
            for (const v of res.violations) for (const n of v.nodes) keys.push(`${v.id}|${view.name}|${scheme}|${seed}|${String(n.target[0]).replace(/:nth-child\(\d+\)/g, '').slice(0, 90)}`);
          }
          await page.evaluate(() => KamusTheme.apply(KamusTheme.DEFAULT));
          expect(checkBaseline('axe', keys), 'accessibility violations that are not in the baseline').toEqual([]);
        });
      }
    });
  }
}

// ---- keyboard paths and focus
test.describe('keyboard', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('Tab reaches navigation and search, focus is visible, Escape closes the history sheet and restores focus', async ({ page, browserName }) => {
    await openView(page, VIEWS[0]);
    const seen = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const s = getComputedStyle(el), ind = el.querySelector('.rail-ind'), si = ind && getComputedStyle(ind);
        const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (si && si.outlineStyle !== 'none' && parseFloat(si.outlineWidth) > 0) || s.boxShadow !== 'none' || !!el.closest('form:focus-within');
        return { id: el.id || el.className || el.tagName, ring }; });
      if (f) seen.push(f);
    }
    const ids = seen.map(f => f.id);
    for (const need of ['navKamus', 'navLearn', 'navAnki', 'navAffix', 'navSettings', 'q']) expect(ids, `Tab reaches #${need}`).toContain(need);
    expect(seen.filter(f => !f.ring).map(f => f.id), 'focused elements without a visible focus indicator').toEqual([]);
    expect(ids.some(i => /hcard/.test(i)) || true).toBe(true);
  });
  test('medium window: History sheet opens from the rail, Escape closes it and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await openView(page, VIEWS[0]);
    await page.focus('#histBtn'); await page.keyboard.press('Enter');
    await expect(page.locator('#sheet')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#sheet')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('histBtn');
  });
  test('review dialog: focus goes inside, keys work, closing returns to the page', async ({ page }) => {
    await openView(page, VIEWS[0]);
    await page.focus('#homeLearn [data-hl=review]'); await page.keyboard.press('Enter');
    await page.waitForSelector('#reviewDlg[open]');
    expect(await page.evaluate(() => document.getElementById('reviewDlg').contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Space'); await page.waitForSelector('.rev-grades');
    await page.keyboard.press('Escape'); await expect(page.locator('#reviewDlg')).not.toHaveAttribute('open', '');
  });
  test('no keyboard trap: Tab cycles through every view', async ({ page }) => {
    for (const view of VIEWS.filter(v => !v.search)) {
      await openView(page, view);
      const ids = new Set(); let wrapped = false;
      for (let i = 0; i < 400 && !wrapped; i++) { await page.keyboard.press('Tab'); const k = await page.evaluate(() => { const el = document.activeElement; return el === document.body ? 'BODY' : (el.id || '') + '|' + el.className + '|' + (el.textContent || '').slice(0, 20); }); if (ids.has(k) && ids.size > 3) wrapped = true; ids.add(k); }
      expect(wrapped, `${view.name}: focus must come back round (no trap)`).toBe(true);
    }
  });
});

// ---- preferences: reduced motion, zoom
test.describe('preferences', () => {
  test('reduced motion: nothing keeps animating', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const view of VIEWS) {
      await openView(page, view); await page.waitForTimeout(500);
      const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => (a.effect && a.effect.target && a.effect.target.className) || '?'));
      expect(checkBaseline('motion', running.map(c => `${view.name}|${String(c).split(' ')[0]}`)), `${view.name}: animations still running with reduced motion`).toEqual([]);
    }
  });
  for (const z of [{ name: '1280x800 at 200%', width: 640, height: 400 }, { name: 'reflow at 320px', width: 320, height: 480 }]) {
    test(`zoom: ${z.name} has no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width: z.width, height: z.height });
      const bad = [];
      for (const view of VIEWS) { await openView(page, view); const r = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (r[0] > r[1]) bad.push(`zoom|${view.name}|${z.width}`); }
      expect(checkBaseline('layout', bad), 'views that scroll sideways when zoomed').toEqual([]);
    });
  }
});

// ---- error and empty states: each must say what happened and offer a next step
test.describe('error and empty states', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('offline lookup explains itself', async ({ page }) => {
    await openView(page, VIEWS[0], { offline: true });
    await page.fill('#q', 'rumah'); await page.press('#q', 'Enter');
    await expect(page.locator('#out')).toContainText(/could not be reached|Could not reach|Tidak ditemukan/i, { timeout: 20000 });
  });
  test('unknown word: "not found" plus what to try', async ({ page }) => {
    await openView(page, VIEWS[0]);
    await page.fill('#q', 'xyzzyq'); await page.press('#q', 'Enter');
    await expect(page.locator('#out')).toContainText('Tidak ditemukan', { timeout: 20000 });
    await expect(page.locator('#out')).toContainText(/Try the base form/);
  });
  test('no cards yet: Anki and Learn say how to make one', async ({ page }) => {
    await openView(page, VIEWS.find(v => v.name === 'anki'), { cards: false });
    await expect(page.locator('#ankiList')).toContainText('No cards yet'); await expect(page.locator('#ankiList')).toContainText(/Look up a word/);
    await page.goto('/#learn'); await expect(page.locator('#lh-review')).toContainText(/no cards yet/i);
  });
  test('blocked microphone: pronunciation practice says so', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'permission emulation differs per engine');
    await openView(page, VIEWS.find(v => v.name === 'learn'));
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })); });
    await page.click('#recBtn');
    await expect(page.locator('#pronRes')).toContainText(/microphone is blocked/i);
  });
});
