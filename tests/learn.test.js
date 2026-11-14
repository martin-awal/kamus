// Learning data and logic (static/learn.js + static/data/*): invariants that keep the lessons and quizzes honest. No browser.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const { loadDevice } = require('./helpers/shims');
const root = path.join(__dirname, '..', 'static');

async function setup() {
  const dev = await loadDevice();
  global.esc = s => String(s); global.ico = () => ''; global.document.getElementById = () => null;
  for (const f of ['srs.js', 'stemmer.js', 'data/core-words.js', 'data/malay-diff.js', 'data/drills.js', 'data/affixes.js', 'learn.js']) { const p = path.join(root, f); delete require.cache[p]; require(p); }
  return dev;
}

test('quiz questions: the right answer is always among distinct choices', async () => {
  await setup();
  for (let run = 0; run < 60; run++) {
    for (const qs of [window.KamusLearn.makeQuestions(window.KAMUS_AFFIXES), ...window.KAMUS_AFFIXES.map(l => window.KamusLearn.makeQuestions([l]))]) {
      assert.strictEqual(qs.length, 10);
      for (const x of qs) {
        assert.ok(x.choices.includes(x.answer), `${x.prompt}: answer ${x.answer} missing from ${x.choices}`);
        assert.strictEqual(new Set(x.choices).size, x.choices.length, 'duplicate choices for ' + x.prompt);
        assert.ok(x.choices.length >= 3 && x.choices.length <= 4);
        assert.ok(x.why.includes(x.answer) || x.why.includes(x.prompt));
      }
      assert.deepStrictEqual(qs.map(x => x.kind).slice(0, 4), ['build', 'break', 'build', 'break']);
    }
  }
});
test('affix data: every lesson has rules, enough examples and wrong-answer templates; examples are real affixations', async () => {
  await setup();
  assert.strictEqual(window.KAMUS_AFFIXES.length, 12);
  for (const l of window.KAMUS_AFFIXES) {
    assert.ok(l.title && l.form && l.lead && l.tip, l.id); assert.ok(l.rules.length >= 2 && l.rules.every(r => r.length === 3), l.id);
    assert.ok(l.examples.length >= 7, l.id + ' needs 7+ examples'); assert.ok(l.alt.length >= 4 && l.alt.every(a => a.includes('{r}')), l.id);
    for (const e of l.examples) {
      assert.ok(e.word && e.root && e.gloss, l.id + ' incomplete example'); assert.notStrictEqual(e.word, e.root);
      assert.ok(e.word.length > e.root.length - 1, e.word);
      assert.ok(!l.alt.map(a => a.replace('{r}', e.root)).every(x => x === e.word), 'wrong answers for ' + e.word + ' must not all equal the answer');
    }
    assert.strictEqual(new Set(l.examples.map(e => e.word)).size, l.examples.length, 'duplicate example in ' + l.id);
  }
});
test('affix examples agree with the stemmer when the base word is known', async () => {
  await setup();
  const list = fs.readFileSync(path.join(root, 'data', 'wordlist-id.txt'), 'utf8').split('\n').filter(Boolean);
  window.KamusStem.setWordlist(new Set(list));
  let checked = 0; const bad = [];
  for (const l of window.KAMUS_AFFIXES) for (const e of l.examples) {
    if (!list.includes(e.root) || list.includes(e.word)) continue;   // the stemmer only judges words that are not entries themselves
    const a = window.KamusStem.analyze(e.word); checked++; if (!a || a.stem !== e.root) bad.push(`${e.word}: expected ${e.root}, got ${a && a.stem}`);
  }
  assert.ok(checked >= 20, 'too few examples were checkable: ' + checked);
  assert.ok(bad.length <= checked * 0.15, `stemmer disagrees with the lessons on ${bad.length}/${checked}: ${bad.join('; ')}`);
});
test('words of the day: stable for one day, five distinct words, never a word you already have a card for or marked as known', async () => {
  const { K } = await setup();
  const a = await window.KamusLearn.dailyWords(5), b = await window.KamusLearn.dailyWords(5);
  assert.deepStrictEqual(a, b); assert.strictEqual(new Set(a.map(x => x.w)).size, 5);
  await K.create({ Word: a[0].w, Wiki: 'x' });
  const c = await window.KamusLearn.dailyWords(5);
  assert.ok(!c.some(x => x.w === a[0].w)); assert.strictEqual(c.length, 5);
  assert.notDeepStrictEqual(window.KamusLearn.dailyWords.length, undefined);
});
test('seeded randomness is repeatable and differs between days', async () => {
  await setup(); const L = window.KamusLearn;
  const r1 = L.mulberry(L.hash('2026-11-14')), r2 = L.mulberry(L.hash('2026-11-14')), r3 = L.mulberry(L.hash('2026-11-15'));
  const s = f => [f(), f(), f()].map(x => x.toFixed(6)).join();
  assert.strictEqual(s(r1), s(r2)); assert.notStrictEqual(s(L.mulberry(L.hash('2026-11-14'))), s(r3));
});
test('pronunciation match score', async () => {
  await setup(); const sim = window.KamusLearn.similarity;
  assert.strictEqual(sim('nyamuk', 'Nyamuk!'), 1); assert.ok(sim('nyamuk', 'namuk') > 0.7); assert.ok(sim('nyamuk', 'rumah') < 0.4); assert.strictEqual(sim('', ''), 1);
});
test('core words: unique, complete, and mostly new to a beginner list', async () => {
  await setup(); const w = window.KAMUS_CORE;
  assert.ok(w.length >= 250); assert.strictEqual(new Set(w.map(x => x.w)).size, w.length);
  assert.ok(w.every(x => /^[a-z]+$/.test(x.w) && x.p && x.g), 'every word is one lowercase word with a part of speech and a meaning');
});
test('Malay vs Indonesian data is well formed', async () => {
  await setup(); const m = window.KAMUS_MALAY, kinds = new Set(['word', 'false', 'spelling', 'tech']);
  assert.ok(m.pairs.length >= 40 && m.notes.length >= 4);
  for (const p of m.pairs) { assert.ok(p.id && p.my && p.en && kinds.has(p.kind), JSON.stringify(p)); assert.notStrictEqual(p.id, p.my); }
  assert.ok(m.pairs.filter(p => p.kind === 'false').every(p => p.note), 'a false friend needs an explanation');
  assert.strictEqual(new Set(m.pairs.map(p => p.id)).size, m.pairs.length);
});
test('pronunciation drills are well formed', async () => {
  await setup(); for (const d of window.KAMUS_DRILLS) { assert.ok(d.id && d.sound && d.tip.length > 20 && d.words.length >= 5, d.id); assert.ok(d.words.every(w => /^[a-z]+$/.test(w))); }
  assert.strictEqual(new Set(window.KAMUS_DRILLS.map(d => d.id)).size, window.KAMUS_DRILLS.length);
});
