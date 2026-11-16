// ESLint (flat config). The app's scripts are plain browser scripts that share globals through window.*; index.html's inline script is
// not linted yet (plan step 13 splits it into modules first).
const js = require('@eslint/js'), globals = require('globals');
const appGlobals = Object.fromEntries(['KamusCards', 'KamusSync', 'KamusStem', 'KamusSrs', 'KamusLearn', 'KamusApkg', 'KamusTheme', 'KAMUS_CORE', 'KAMUS_MALAY', 'KAMUS_DRILLS', 'KAMUS_AFFIXES',
  'firebase', 'initSqlJs', 'JSZip', 'qrcode', 'jsQR',
  // defined by index.html's inline script and used by learn.js
  'esc', 'ico', 'say', 'speak', 'stopSpeech', 'toast', 'go', 'q', 'fitIdle', 'syncBtn', 'getModel', 'mrender', 'blankOf', 'hintOf', 'fetchJSON', 'htmlText', 'hist', 'WIKI_REST'].map(n => [n, 'readonly']));

module.exports = [
  { ignores: ['static/vendor/**', 'static/assets/**', 'node_modules/**', 'dist/**', 'test-results/**', 'playwright-report/**', 'models/**', '.venv/**', '.tts-env/**', '.argos-env/**'] },
  js.configs.recommended,
  { files: ['static/**/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser, ...globals.worker, ...appGlobals, module: 'readonly' } },
    rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }], 'no-empty': ['error', { allowEmptyCatch: true }] } },
  { files: ['static/wd-worker.js', 'static/tr-worker.js'], languageOptions: { sourceType: 'module' } },
  // the app modules (split from the old inline script): names from later modules arrive through the window bridge and are listed in each file's /* global */ comment
  { files: ['src/app/**/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser, ...appGlobals } },
    rules: { 'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }], 'no-empty': ['error', { allowEmptyCatch: true }], 'no-redeclare': ['error', { builtinGlobals: false }] } },
  { files: ['tests/**/*.js', 'playwright.config.js', 'eslint.config.js', 'vite.config.js', 'scripts/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser, ...appGlobals,
      // page-side names used inside page.evaluate() callbacks
      serverUp: 'readonly', wlState: 'readonly', SEEDS: 'readonly', syncToAnki: 'readonly', getTts: 'readonly', KamusLearnCfg: 'readonly' } },
    rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }], 'no-empty': ['error', { allowEmptyCatch: true }] } },
];
