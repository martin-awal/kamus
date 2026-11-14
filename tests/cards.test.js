// Card rules (static/cards-store.js): text cleaning, ids, tombstones, import, hashes. No browser, no network.
const test = require('node:test'), assert = require('node:assert');
const { loadDevice } = require('./helpers/shims');

test('clean(): spaces, required fields, derived fields', async () => {
  const { K } = await loadDevice();
  const [f, meaning] = K.clean({ Word: '  makan ', KBBI: ' memasukkan   makanan ', Example: 'Saya makan nasi.', POS: 'v.' });
  assert.strictEqual(f.Word, 'makan'); assert.strictEqual(f.KBBI, 'memasukkan makanan'); assert.strictEqual(meaning, 'memasukkan makanan');
  assert.strictEqual(f.ExampleBlank, 'Saya [ … ] nasi.'); assert.strictEqual(f.Hint, 'm _ _ _ _'); assert.strictEqual(f.Index, 'makan | memasukkan makanan');
  assert.strictEqual(f.Audio, ''); assert.strictEqual(f.Skip1, '');
});
test('clean(): the English meaning wins over the Indonesian one; hint of a phrase', async () => {
  const { K } = await loadDevice();
  const [f, meaning] = K.clean({ Word: 'warna-warni', KBBI: 'bermacam warna', Wiki: 'colourful' });
  assert.strictEqual(meaning, 'colourful'); assert.strictEqual(f.Hint, 'w _ _ _ _ - _ _ _ _ _');
});
test('clean(): validation', async () => {
  const { K } = await loadDevice();
  assert.throws(() => K.clean({ KBBI: 'x' }), /Word is required/);
  assert.throws(() => K.clean({ Word: 'x' }), /at least one meaning/);
  assert.throws(() => K.clean({ Word: 'x', KBBI: 'y', Skip1: 1, Skip2: 1, Skip3: 1, Skip4: 1 }), /at least one card type/);
  assert.strictEqual(K.clean({ Word: 'x', KBBI: 'y', Skip3: 'yes' })[0].Skip3, '1');
  assert.strictEqual(K.clean({ Word: 'x', KBBI: 'y', Example: 'z'.repeat(3000) })[0].Example.length, 2000);
});
test('blank only replaces whole words', async () => {
  const { K } = await loadDevice();
  assert.strictEqual(K.clean({ Word: 'makan', KBBI: 'x', Example: 'Makanan enak, makan dulu.' })[0].ExampleBlank, 'Makanan enak, [ … ] dulu.');
  assert.strictEqual(K.clean({ Word: 'makan', KBBI: 'x', Example: 'Makanan enak.' })[0].ExampleBlank, '');
});
test('hash helpers match known values (the ids and Anki guids must never change)', async () => {
  const { K } = await loadDevice();
  assert.strictEqual(K.sha1hex('abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.strictEqual(K.sha1hex('hello world à é — 日本'), 'b4f50b1ae1e5e622b6bd880aa948bcc7cc122c33');
  assert.strictEqual(Buffer.from(K.sha256(K.utf8('abc'))).toString('hex'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.strictEqual(K.ankiGuid('pagi | morning'), 'l+%pgupCa(');   // same as genanki.guid_for
});
test('create: the same word and meaning is stored once; the id comes from them', async () => {
  const { K } = await loadDevice();
  const a = await K.create({ Word: 'Pagi', Wiki: 'Morning' }), b = await K.create({ Word: 'pagi', Wiki: 'morning', Example: 'other' });
  assert.strictEqual(a.created, true); assert.strictEqual(b.created, false); assert.strictEqual(a.card.id, b.card.id);
  assert.match(a.card.id, /^[0-9a-f]{12}$/); assert.strictEqual((await K.list()).length, 1);
});
test('update keeps the id, marks cards in Anki as dirty, and refuses a duplicate', async () => {
  const { K } = await loadDevice();
  const a = (await K.create({ Word: 'pagi', Wiki: 'morning' })).card; await K.create({ Word: 'siang', Wiki: 'noon' });
  const u1 = await K.update(a.id, { ...a.fields, Example: 'Selamat pagi' });
  assert.strictEqual(u1.id, a.id); assert.strictEqual(u1.dirty, false); assert.ok(u1.updated >= a.updated);
  await K.report([{ id: a.id, note_id: 42 }]);
  const u2 = await K.update(a.id, { ...a.fields, Wiki: 'early morning' });
  assert.strictEqual(u2.id, a.id); assert.strictEqual(u2.meaning, 'early morning'); assert.strictEqual(u2.dirty, true); assert.strictEqual(u2.note_id, 42);
  await assert.rejects(K.update(a.id, { Word: 'siang', Wiki: 'noon' }), /already has this word/);
  await assert.rejects(K.update('nope', { Word: 'x', KBBI: 'y' }), /not found/);
});
test('report changes Anki state only, never the content timestamp', async () => {
  const { K } = await loadDevice();
  const a = (await K.create({ Word: 'pagi', Wiki: 'morning' })).card;
  await K.report([{ id: a.id, note_id: 7, progress: { cards: 4, new: 4 } }, { id: 'missing', note_id: 1 }]);
  const c = await K.get(a.id);
  assert.strictEqual(c.updated, a.updated); assert.strictEqual(c.note_id, 7); assert.strictEqual(c.progress.cards, 4);
});
test('remove leaves a tombstone; create brings the card back', async () => {
  const { K } = await loadDevice();
  const a = (await K.create({ Word: 'pagi', Wiki: 'morning' })).card;
  await K.remove(a.id);
  assert.strictEqual((await K.list()).length, 0); assert.strictEqual(await K.get(a.id), null);
  const raw = (await K.listRaw()).find(c => c.id === a.id); assert.strictEqual(raw.deleted, true); assert.ok(raw.updated >= a.updated);
  const again = await K.create({ Word: 'pagi', Wiki: 'morning' });
  assert.strictEqual(again.created, true); assert.strictEqual((await K.list()).length, 1);
});
test('importCards: adds missing cards, skips existing ones, revives deleted ones', async () => {
  const { K } = await loadDevice();
  const keep = (await K.create({ Word: 'pagi', Wiki: 'morning' })).card, gone = (await K.create({ Word: 'siang', Wiki: 'noon' })).card;
  await K.remove(gone.id);
  const mk = (w, m, extra = {}) => { const [f, meaning] = K.clean({ Word: w, Wiki: m }); return { id: K.sha1hex(w + '|' + m).slice(0, 12), word: w, meaning, fields: f, created: 1000, ...extra }; };
  const n = await K.importCards([{ ...keep }, mk('malam', 'night'), { ...gone, fields: K.clean({ Word: 'siang', Wiki: 'noon' })[0], deleted: false }, { id: 'x' }, null]);
  assert.strictEqual(n, 2);
  assert.deepStrictEqual((await K.list()).map(c => c.word).sort(), ['malam', 'pagi', 'siang']);
});
test('cards without a timestamp get one derived from `created` (every browser agrees)', async () => {
  const a = await loadDevice(), b = await loadDevice();
  const old = { id: 'abc', word: 'x', meaning: 'y', fields: a.K.clean({ Word: 'x', Wiki: 'y' })[0], created: 1700000000.5 };
  await a.use().K.importCards([old]); await b.use().K.importCards([old]);
  assert.strictEqual((await a.use().K.get('abc')).updated, 1700000000500); assert.strictEqual((await b.use().K.get('abc')).updated, 1700000000500);
});
test('onChange fires for content changes, not for Anki reports', async () => {
  const { K } = await loadDevice(); let n = 0; K.onChange(() => n++);
  const a = (await K.create({ Word: 'pagi', Wiki: 'morning' })).card;
  await K.update(a.id, { ...a.fields, Example: 'x y z' }); await K.report([{ id: a.id, note_id: 1 }]); await K.remove(a.id);
  assert.strictEqual(n, 3);
});
