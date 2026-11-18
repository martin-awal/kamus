/* Indonesian stemmer in the browser: finds the base word of an affixed word (berlari -> lari, memukul -> pukul, dimakannya -> makan).
   A rule-based stemmer in the Nazief-Adriani / Sastrawi tradition: remove particles (-lah, -kah, -pun), possessives (-ku, -mu, -nya) and
   derivational suffixes (-i, -kan, -an), then up to two prefixes (di-, ke-, se-, ber-, ter-, per-, me-, pe- and their sound changes, e.g.
   mem-+p, men-+t, meng-+k, meny-+s), and reduplication (buku-buku, bermalas-malasan). Every way of stripping is tried; a candidate counts only if
   it is a known word, so a word list is required (setWordlist). No KBBI involved: the list is built from Wiktionary titles (see index.html). */
(function () {
  const VOWELS = 'aiueo';
  let known = null;
  const vowelCount = w => [...w].filter(c => VOWELS.includes(c)).length;
  const plausible = w => w.length >= 3 && vowelCount(w) >= 2 && /^[a-z]+$/.test(w);   // roots are almost always two syllables or more

  const PARTICLES = ['lah', 'kah', 'tah', 'pun'], POSSESSIVE = ['ku', 'mu', 'nya'], DERIVATIONAL = ['kan', 'an', 'i'];
  // [prefix, [text put back in front of the rest]]: '' = nothing, 'p' = the p that mem- swallowed (memukul -> pukul), ...
  const PREFIXES = [['memper', ['']], ['diper', ['']], ['meng', ['', 'k']], ['meny', ['s']], ['men', ['', 't']], ['mem', ['', 'p']], ['me', ['']],
    ['peng', ['', 'k']], ['peny', ['s']], ['pen', ['', 't']], ['pem', ['', 'p']], ['pel', ['']], ['per', ['']], ['pe', ['']],
    ['ber', ['']], ['bel', ['']], ['be', ['']], ['ter', ['']], ['te', ['']], ['di', ['']], ['ke', ['']], ['se', ['']]];

  // all (stem, steps) reachable from one word (no hyphen); the word itself is included with no steps
  function derive(word) {
    const found = new Map();   // stem -> best derivation (fewest steps, then fewest put-back letters)
    const keep = (stem, steps, back) => {
      const old = found.get(stem);
      if (!old || steps.length < old.steps.length || (steps.length === old.steps.length && back < old.back)) found.set(stem, { stem, steps, back });
    };
    const sufStates = [{ w: word, steps: [] }];
    for (const list of [PARTICLES, POSSESSIVE, DERIVATIONAL]) {
      for (const st of [...sufStates]) for (const s of list) {
        if (st.w.length - s.length >= 3 && st.w.endsWith(s)) sufStates.push({ w: st.w.slice(0, -s.length), steps: [...st.steps, { kind: 'suffix', text: '-' + s }] });
      }
    }
    const stripPrefix = (w, steps, back, depth) => {
      keep(w, steps, back);
      if (depth === 2) return;
      for (const [p, puts] of PREFIXES) {
        if (!w.startsWith(p) || w.length - p.length < 3) continue;
        const rest = w.slice(p.length);
        if ((p === 'pel' || p === 'bel') && !rest.startsWith('ajar')) continue;           // only pelajar/belajar (-> ajar) work this way
        if ((p === 'pe' || p === 'be') && rest.startsWith('lajar')) continue;            // ...so pe-/be- + lajar is not a real analysis
        for (const put of puts) stripPrefix(put + w.slice(p.length), [{ kind: 'prefix', text: p + '-' }, ...steps], back + put.length, depth + 1);
      }
    };
    for (const st of sufStates) stripPrefix(st.w, st.steps, 0, 0);
    return found;
  }

  // ranked analyses of a word: known stems only, deepest first (pelajaran -> ajar before pelajar), word itself excluded
  function candidates(word) {
    word = String(word || '').toLowerCase().trim();
    if (!known || !/^[a-z]+(-[a-z]+)?$/.test(word)) return [];
    let found;
    const parts = word.split('-');
    if (parts.length === 2) {   // reduplication: buku-buku, bermalas-malasan (both halves reduce to the same base)
      const a = derive(parts[0]), b = derive(parts[1]);
      found = new Map();
      for (const [stem, x] of a) if (b.has(stem)) { const y = b.get(stem); found.set(stem, { stem, steps: [...x.steps, ...y.steps.filter(s => !x.steps.some(t => t.text === s.text)), { kind: 'redup', text: 'reduplication' }], back: x.back + y.back }); }
    } else found = derive(word);
    const out = [...found.values()].filter(c => c.stem !== word && plausible(c.stem) && known.has(c.stem));
    out.sort((x, y) => y.steps.length - x.steps.length || x.back - y.back || y.stem.length - x.stem.length);
    return out;
  }
  const analyze = word => candidates(word)[0] || null;

  // ---- typo help: words from the list that are a small edit away (substitution, insertion, deletion, swap of neighbours)
  function editDistance(a, b, max) {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    let prev2 = null, prev = Array.from({ length: lb + 1 }, (_, j) => j);
    for (let i = 1; i <= la; i++) {
      const cur = [i]; let rowMin = i;
      for (let j = 1; j <= lb; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v; if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[lb];
  }
  let byLen = null, byLenFor = null;
  function similar(word, n = 6) {
    word = String(word || '').toLowerCase().trim();
    if (!known || word.length < 3 || !/^[a-z-]+$/.test(word) || known.has(word)) return [];
    if (byLenFor !== known) { byLen = new Map(); for (const w of known) { if (!byLen.has(w.length)) byLen.set(w.length, []); byLen.get(w.length).push(w); } byLenFor = known; }
    const max = word.length <= 4 ? 1 : 2, out = [];
    for (let len = word.length - max; len <= word.length + max; len++) for (const w of byLen.get(len) || []) {
      const d = editDistance(word, w, max);
      if (d <= max) { let p = 0; while (p < word.length && p < w.length && word[p] === w[p]) p++; out.push({ w, d, p }); }
    }
    out.sort((x, y) => x.d - y.d || y.p - x.p || Math.abs(x.w.length - word.length) - Math.abs(y.w.length - word.length) || x.w.localeCompare(y.w));
    return out.slice(0, n).map(x => x.w);
  }
  // "ber- + lari", "di- + makan + -nya", "buku (twice)"
  const describe = a => a ? a.steps.filter(s => s.kind === 'prefix').map(s => s.text).join(' ') + (a.steps.some(s => s.kind === 'prefix') ? ' + ' : '') + a.stem
    + a.steps.filter(s => s.kind === 'suffix').map(s => ' + ' + s.text).join('') + (a.steps.some(s => s.kind === 'redup') ? ' (repeated)' : '') : '';

  window.KamusStem = { setWordlist: set => { known = set; }, hasWordlist: () => !!known, isKnown: w => !!known && known.has(w), candidates, analyze, describe, similar, _derive: derive };
  if (typeof module !== 'undefined') module.exports = window.KamusStem;
})();
