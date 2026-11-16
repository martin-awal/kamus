/* Seed colour -> Material 3 colour tokens. Own implementation: tonal palettes built in OKLCH (an approximation of Material's HCT
   "tonal spot" scheme). The default purple (#6750a4) is NOT generated: the page keeps Material's exact baseline values for it. */
(function () {
  const DEFAULT = '#6750a4', KEY = 'kamus-theme';
  const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const delin = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  const hexToRgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
  const rgbToHex = rgb => '#' + rgb.map(c => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('');

  /** @param {number[]} v */
  function rgbToOklab([r, g, b]) {
    r = lin(r); g = lin(g); b = lin(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  /** @param {number[]} v */
  function oklabToLinear([L, a, b]) {
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  }
  const lstar = /** @param {number[]} v */ ([r, g, b]) => { const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, f = y > 216 / 24389 ? Math.cbrt(y) : (24389 / 27 * y + 16) / 116; return 116 * f - 16; };
  const inGamut = lr => lr.every(c => c >= -0.0005 && c <= 1.0005);
  const lch = (L, C, h) => [L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)];

  /** Colour with the given OKLCH hue and Material "tone" (CIE L*). Chroma is the most that fits in sRGB, up to `chroma`. */
  function tone(hue, chroma, t) {
    if (t <= 0) return [0, 0, 0];
    if (t >= 100) return [1, 1, 1];
    const at = L => { let lo = 0, hi = chroma;   // largest in-gamut chroma at this lightness
      if (inGamut(oklabToLinear(lch(L, hi, hue)))) return oklabToLinear(lch(L, hi, hue));
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; inGamut(oklabToLinear(lch(L, mid, hue))) ? lo = mid : hi = mid; }
      return oklabToLinear(lch(L, lo, hue)); };
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; lstar(at(mid)) < t ? lo = mid : hi = mid; }
    return at((lo + hi) / 2).map(delin);
  }

  const K = 0.0027;   // Material chroma units -> OKLCH chroma (48 -> about 0.13)
  function palettes(seed) {
    const [, a, b] = rgbToOklab(hexToRgb(seed)), hue = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360, c = Math.hypot(a, b);
    const gray = c < 0.02;   // a (nearly) grey seed gives a neutral theme, like Material's monochrome handling
    const P = gray ? 0.01 : Math.max(0.13, c * 0.9);
    return { P: t => tone(hue, P, t), S: t => tone(hue, gray ? 0.01 : 16 * K, t), T: t => tone(hue + 60, gray ? 0.01 : 24 * K, t),
      N: t => tone(hue, gray ? 0.003 : 6 * K * 0.75, t), NV: t => tone(hue, gray ? 0.004 : 8 * K * 0.75, t) };
  }
  const MAP = [   // css variable, palette, light tone, dark tone
    ['primary', 'P', 40, 80], ['on-primary', 'P', 100, 20], ['primary-container', 'P', 90, 30], ['on-primary-container', 'P', 10, 90],
    ['secondary-container', 'S', 90, 30], ['on-secondary-container', 'S', 10, 90], ['tertiary-container', 'T', 90, 30], ['on-tertiary-container', 'T', 10, 90],
    ['surface', 'N', 98, 6], ['surface-container', 'N', 94, 12], ['surface-container-high', 'N', 92, 17], ['surface-container-highest', 'N', 90, 22],
    ['on-surface', 'N', 10, 90], ['on-surface-variant', 'NV', 30, 80], ['outline', 'NV', 50, 60], ['outline-variant', 'NV', 80, 30]];
  function tokens(seed, dark) { const p = palettes(seed), o = {}; for (const [name, pal, l, d] of MAP) o[name] = rgbToHex(p[pal](dark ? d : l)); o.error = dark ? '#f2b8b5' : '#b3261e'; return o; }   // error is not seed-dependent in Material
  const block = o => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(';');
  const css = seed => `:root{${block(tokens(seed, false))}}\n@media(prefers-color-scheme:dark){:root:not([data-theme=light]){${block(tokens(seed, true))}}}\n:root[data-theme=dark]{${block(tokens(seed, true))}}`;

  function inject(text) {
    let el = document.getElementById('themeStyle');
    if (!text) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('style'); el.id = 'themeStyle'; document.head.appendChild(el); }
    el.textContent = text;
  }
  function apply(seed) {
    seed = (seed || DEFAULT).toLowerCase();
    const isDefault = seed === DEFAULT;
    const text = isDefault ? '' : css(seed);
    inject(text);
    try { isDefault ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, JSON.stringify({ seed, css: text })); } catch (e) {}
    updateMeta();
  }
  // browser/system bars take the header colour (surface-container) of the scheme in use, so they blend with the page
  function updateMeta() {
    const seed = current(), m = mode(), def = seed === DEFAULT;
    const col = dark => def ? (dark ? '#211f26' : '#f3edf7') : tokens(seed, dark)['surface-container'];
    document.querySelectorAll('meta[name=theme-color]').forEach(el => { const isDark = /dark/.test(el.getAttribute('media') || ''); el.setAttribute('content', col(m === 'system' ? isDark : m === 'dark')); });
  }
  function current() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.seed ? s.seed : DEFAULT; } catch (e) { return DEFAULT; } }
  // light / dark / system: an explicit choice is stamped on <html data-theme>; 'system' leaves only prefers-color-scheme
  const MODE_KEY = 'kamus-mode';
  function mode() { try { const m = localStorage.getItem(MODE_KEY); return m === 'light' || m === 'dark' ? m : 'system'; } catch (e) { return 'system'; } }
  function setMode(m) {
    const el = document.documentElement;
    m === 'light' || m === 'dark' ? el.setAttribute('data-theme', m) : el.removeAttribute('data-theme');
    try { m === 'light' || m === 'dark' ? localStorage.setItem(MODE_KEY, m) : localStorage.removeItem(MODE_KEY); } catch (e) {}
    updateMeta();
  }
  setMode(mode());
  window.KamusTheme = { DEFAULT, apply, current, tokens, css, mode, setMode };
  try {   // before first paint
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.css) inject(s.css);
    updateMeta();
  } catch (e) {}
})();
