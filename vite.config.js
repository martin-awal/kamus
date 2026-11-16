// Vite builds the app shell: src/index.html + src/styles + src/app  ->  static/index.html + static/assets/.
// Everything else in static/ (other scripts, data, vendor, icons, service worker) is served as it is and is NOT touched by the build,
// so server.py, the static build (scripts/build_static.sh) and the tests keep using static/ as the web root.
const { defineConfig } = require('vite');
const path = require('path');

// Keep the cascade order of the old page: app CSS first, then learn.css, then theme.js (which appends the seed-colour tokens when it runs).
// Vite would put its stylesheet link at the end of <head>, after both.
const cssInPlace = { name: 'kamus-css-in-place', transformIndexHtml: { order: 'post', handler(html) {
  const m = html.match(/\s*<link rel="stylesheet"[^>]*href="\.\/assets\/[^"]+\.css"[^>]*>/);
  if (!m || !html.includes('<!--app-css-->')) throw new Error('kamus-css-in-place: stylesheet link or placeholder not found');
  return html.replace(m[0], '').replace('<!--app-css-->', m[0].trim());
} } };

module.exports = defineConfig({
  plugins: [cssInPlace],
  root: path.join(__dirname, 'src'),
  base: './',            // relative asset URLs: the page works at the site root and in a sub-folder
  publicDir: false,
  build: { outDir: path.join(__dirname, 'static'), emptyOutDir: false, assetsDir: 'assets', sourcemap: true, target: 'es2022', chunkSizeWarningLimit: 1500 },
  logLevel: 'warn',
});
