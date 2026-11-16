// UI test matrix (docs/PLAN-adaptive-ui.md). Serves static/ with a plain file server: the app runs in its no-server mode and every
// external service is mocked in tests/ui/helpers.js, so the suite is offline and deterministic.
//   npx playwright test                      Chromium (full) + Firefox (smoke) [+ WebKit when available]
//   KAMUS_WEBKIT=1 npx playwright test       include WebKit locally (needs: sudo npx playwright install-deps webkit)
//   UPDATE_BASELINE=1 npx playwright test --workers=1 --project=chromium     rewrite tests/ui/baseline.json
const { defineConfig } = require('@playwright/test');
const PORT = 8811, withWebkit = !!process.env.CI || !!process.env.KAMUS_WEBKIT;

module.exports = defineConfig({
  testDir: 'tests/ui',
  outputDir: 'test-results',
  snapshotPathTemplate: 'tests/ui/.snapshots/{projectName}/{arg}{ext}',   // git-ignored: baselines are CI artifacts (plan, decision 3)
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: { baseURL: `http://127.0.0.1:${PORT}`, reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'UTC' },
  webServer: { command: `npm run build --silent && python3 -m http.server ${PORT} --bind 127.0.0.1 --directory static`, port: PORT, reuseExistingServer: false, timeout: 120000, stdout: 'ignore', stderr: 'ignore' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    ...(withWebkit ? [{ name: 'webkit', use: { browserName: 'webkit' } }] : []),
    { name: 'firefox', use: { browserName: 'firefox' }, grep: /@smoke/ },   // engine-difference smoke run: layout invariants and axe only
  ],
});
