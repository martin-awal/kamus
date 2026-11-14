// Cloud sync logic (static/sync.js): history merge and the pull/merge/push of cards between devices, against a fake cloud.
const test = require('node:test'), assert = require('node:assert');
const { loadDevice } = require('./helpers/shims');

// ---- mergeHistory is pure
test('mergeHistory: newest visit wins, glosses are kept, the list is capped at 30', async () => {
  const { S } = await loadDevice({ sync: true });
  const m = S.mergeHistory({ items: [{ w: 'a', g: '', t: 5 }, { w: 'b', g: 'bee', t: 1 }] }, { items: [{ w: 'a', g: 'ay', t: 3 }, { w: 'c', g: '', t: 9 }] });
  assert.deepStrictEqual(m.items.map(x => x.w), ['c', 'a', 'b']);
  assert.strictEqual(m.items.find(x => x.w === 'a').t, 5); assert.strictEqual(m.items.find(x => x.w === 'a').g, 'ay');   // gloss filled in from the older copy
  const many = Array.from({ length: 50 }, (_, i) => ({ w: 'w' + i, g: '', t: i + 1 }));
  assert.strictEqual(S.mergeHistory({ items: many }, { items: [] }).items.length, 30);
});
test('mergeHistory: "Clear" removes everything older on both sides', async () => {
  const { S } = await loadDevice({ sync: true });
  const m = S.mergeHistory({ items: [{ w: 'old', t: 10 }], clearedAt: 0 }, { items: [{ w: 'new', t: 50 }, { w: 'older', t: 20 }], clearedAt: 30 });
  assert.deepStrictEqual(m.items.map(x => x.w), ['new']); assert.strictEqual(m.clearedAt, 30);
});

// ---- two devices and one cloud
function fakeCloud() {
  const c = { cards: new Map(), hist: { items: [], clearedAt: 0 }, pushes: 0 };
  c.remote = uid => ({ uid,
    pullCards: async since => [...c.cards].map(([id, d]) => ({ id, ...structuredClone(d) })).filter(d => d.updated > since),
    pushCards: async docs => { for (const d of docs) { const { id, ...r } = d; c.cards.set(id, structuredClone(r)); c.pushes++; } },
    getHistory: async () => structuredClone(c.hist), setHistory: async h => { c.hist = structuredClone(h); } });
  return c;
}
async function device() {
  const d = await loadDevice({ sync: true }); d.history = { items: [], clearedAt: 0 };
  d.S._test.setHooks({ getHistory: () => structuredClone(d.history), setHistory: h => { d.history = structuredClone(h); } });
  d.sync = (cloud, uid = 'u1') => { d.use(); return d.S.syncCore(cloud.remote(uid)); };
  d.run = fn => { d.use(); return fn(d.K); };
  return d;
}
const words = async d => d.run(async K => (await K.list()).map(c => c.word + ':' + c.meaning).sort());
const tick = () => new Promise(r => setTimeout(r, 5));

test('a card made on one device appears on the other, and edits and deletions follow', async () => {
  const cloud = fakeCloud(), A = await device(), B = await device();
  await A.run(K => K.create({ Word: 'pagi', Wiki: 'morning' }));
  assert.deepStrictEqual(await A.sync(cloud), { pulled: 0, pushed: 1 });
  assert.deepStrictEqual(await B.sync(cloud), { pulled: 1, pushed: 0 });
  assert.deepStrictEqual(await words(B), ['pagi:morning']);
  await tick(); await B.run(async K => { const c = (await K.list())[0]; await K.update(c.id, { ...c.fields, Example: 'Selamat pagi semua' }); });
  await B.sync(cloud); await A.sync(cloud);
  assert.strictEqual((await A.run(async K => (await K.list())[0])).fields.Example, 'Selamat pagi semua');
  await tick(); await A.run(async K => { await K.remove((await K.list())[0].id); });
  await A.sync(cloud); await B.sync(cloud);
  assert.deepStrictEqual(await words(B), []);
});
test('the later edit wins when both devices changed the same card', async () => {
  const cloud = fakeCloud(), A = await device(), B = await device();
  await A.run(K => K.create({ Word: 'rumah', Wiki: 'house' })); await A.sync(cloud); await B.sync(cloud);
  await tick(); await A.run(async K => { const c = (await K.list())[0]; await K.update(c.id, { ...c.fields, Example: 'from A' }); });
  await tick(); await B.run(async K => { const c = (await K.list())[0]; await K.update(c.id, { ...c.fields, Example: 'from B, later' }); });
  await A.sync(cloud); await B.sync(cloud); await A.sync(cloud);
  for (const d of [A, B]) assert.strictEqual((await d.run(async K => (await K.list())[0])).fields.Example, 'from B, later');
});
test('a card already in Anki on this device becomes dirty when the cloud changes it; Anki ids never leave the device', async () => {
  const cloud = fakeCloud(), A = await device(), B = await device();
  await A.run(K => K.create({ Word: 'pagi', Wiki: 'morning' })); await A.sync(cloud); await B.sync(cloud);
  await A.run(async K => K.report([{ id: (await K.list())[0].id, note_id: 4242 }]));
  await tick(); await B.run(async K => { const c = (await K.list())[0]; await K.update(c.id, { ...c.fields, Wiki: 'early morning' }); }); await B.sync(cloud);
  await A.sync(cloud);
  const a = await A.run(async K => (await K.list())[0]);
  assert.strictEqual(a.meaning, 'early morning'); assert.strictEqual(a.dirty, true); assert.strictEqual(a.note_id, 4242);
  assert.ok([...cloud.cards.values()].every(d => !('note_id' in d) && !('progress' in d)));
});
test('an unchanged card is not pushed again, and a second sync is quiet', async () => {
  const cloud = fakeCloud(), A = await device();
  await A.run(K => K.create({ Word: 'pagi', Wiki: 'morning' })); await A.sync(cloud);
  assert.deepStrictEqual(await A.sync(cloud), { pulled: 0, pushed: 0 }); assert.strictEqual(cloud.pushes, 1);
});
test('history merges across devices and "Clear" travels too', async () => {
  const cloud = fakeCloud(), A = await device(), B = await device();
  A.history = { items: [{ w: 'antre', g: 'queue', t: 100 }], clearedAt: 0 };
  await A.sync(cloud); await B.sync(cloud);
  assert.deepStrictEqual(B.history.items.map(x => x.w), ['antre']);
  B.history = { items: [], clearedAt: 500 }; await B.sync(cloud); await A.sync(cloud);
  assert.deepStrictEqual(A.history.items, []); assert.strictEqual(A.history.clearedAt, 500);
});
test('signing in with another account pushes every card there', async () => {
  const c1 = fakeCloud(), c2 = fakeCloud(), A = await device();
  await A.run(K => K.create({ Word: 'pagi', Wiki: 'morning' })); await A.run(K => K.create({ Word: 'malam', Wiki: 'night' }));
  await A.sync(c1, 'u1'); assert.strictEqual(c1.cards.size, 2);
  assert.deepStrictEqual(await A.sync(c2, 'u2'), { pulled: 0, pushed: 2 }); assert.strictEqual(c2.cards.size, 2);
});
test('parseConfig / share links round-trip and reject nonsense', async () => {
  const { S } = await loadDevice({ sync: true });
  const cfg = S.parseConfig('const firebaseConfig = { apiKey: "AIzaFAKE-key_1", authDomain: "demo.firebaseapp.com", projectId: "demo-proj", appId: "1:2:web:3" };');
  assert.strictEqual(cfg.projectId, 'demo-proj'); assert.strictEqual(cfg.apiKey, 'AIzaFAKE-key_1');
  assert.strictEqual(S.parseConfig('{"apiKey":"k","projectId":"p"}').authDomain, 'p.firebaseapp.com');
  assert.throws(() => S.parseConfig('hello'), /Firebase web config/);
  S.setConfig(cfg); global.location = { origin: 'https://kamus.example' };
  const url = S.shareUrl(), back = S.fromShared(url);
  assert.deepStrictEqual(back, { apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
  assert.throws(() => S.fromShared('https://x/#sync=%%%'), /config|sync link/i);
  assert.throws(() => S.fromShared('https://x/#sync=' + Buffer.from('a b|c|d').toString('base64url')), /not a Kamus sync link/);   // characters that could be injected are refused
});
