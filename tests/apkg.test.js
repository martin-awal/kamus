// .apkg export (static/apkg.js): build a package, then read it back with the same libraries. Needs static/vendor (scripts/fetch_vendor.sh); skipped without it.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const { loadDevice } = require('./helpers/shims');
const vendor = path.join(__dirname, '..', 'static', 'vendor', 'apkg');
const have = fs.existsSync(path.join(vendor, 'sql-wasm.wasm')) && fs.existsSync(path.join(vendor, 'jszip.min.js'));
const model = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'static', 'anki-model.json'), 'utf8'));

test('export builds a readable Anki package', { skip: !have && 'static/vendor is missing (run scripts/fetch_vendor.sh)' }, async () => {
  const dev = await loadDevice();
  global.initSqlJs = require(path.join(vendor, 'sql-wasm.js')); global.JSZip = require(path.join(vendor, 'jszip.min.js'));
  const realInit = global.initSqlJs; global.initSqlJs = opts => realInit({ locateFile: f => path.join(vendor, f) });
  global.document = { createElement: () => ({}), head: { appendChild: s => queueMicrotask(() => s.onload && s.onload()) } };   // apkg.js "loads" the two libraries: already there
  delete require.cache[path.join(__dirname, '..', 'static', 'apkg.js')]; require('../static/apkg.js');

  const K = dev.K, mk = f => K.clean(f)[0];
  const full = { id: 'a1', fields: mk({ Word: 'pagi', IPA: '/pagi/', POS: 'n.', KBBI: 'waktu', Wiki: 'morning', Example: 'Pagi ini cerah', ExampleEN: 'The morning is clear' }) };
  const noExample = { id: 'a2', fields: mk({ Word: 'siang', Wiki: 'noon' }) };                                   // no example: no fill-the-blank card
  const skipped = { id: 'a3', fields: mk({ Word: 'malam', Wiki: 'night', Example: 'Malam hari sepi', Skip3: '1', Skip4: '1' }) };   // two types switched off
  const r = await window.KamusApkg.build({ cards: [full, noExample, skipped], model, getAudio: async t => ({ bytes: new Uint8Array(700).fill(t.length), ext: '.mp3' }) });
  assert.deepStrictEqual([r.notes, r.cards, r.audio], [3, 4 + 3 + 2, 5]);

  const zip = await JSZip.loadAsync(Buffer.from(await r.blob.arrayBuffer()));
  assert.ok(zip.file('collection.anki2') && zip.file('media'));
  const media = JSON.parse(await zip.file('media').async('string'));
  assert.strictEqual(Object.keys(media).length, 5); assert.ok(Object.values(media).every(n => /^kamus-[0-9a-f]{12}\.mp3$/.test(n)));
  assert.ok(zip.file('0') && zip.file('4'));

  const SQL = await global.initSqlJs(), db = new SQL.Database(await zip.file('collection.anki2').async('uint8array'));
  const one = sql => db.exec(sql)[0].values;
  assert.strictEqual(one('select count(*) from notes')[0][0], 3);
  assert.deepStrictEqual(one('select n.flds is not null, count(c.id) from notes n left join cards c on c.nid=n.id group by n.id order by n.id').map(x => x[1]), [4, 3, 2]);
  assert.deepStrictEqual(one("select ord from cards where nid=(select id from notes where flds like 'malam%' or flds like '%malam |%' limit 1) order by ord").map(x => x[0]), [0, 1]);
  const flds = one('select flds, guid, tags, mid from notes order by id').map(([f, g, t, m]) => ({ f: f.split('\x1f'), g, t, m }));
  assert.strictEqual(flds[0].f.length, model.fields.length); assert.strictEqual(flds[0].f[0], 'pagi | morning');
  assert.strictEqual(flds[0].g, 'l+%pgupCa(');   // same guid genanki gave this note, so re-importing updates instead of duplicating
  assert.strictEqual(flds[0].t, ' kamus '); assert.strictEqual(flds[0].m, 1607392319);
  assert.match(flds[0].f[model.fields.indexOf('Audio')], /^\[sound:kamus-[0-9a-f]{12}\.mp3\]$/);
  assert.strictEqual(flds[2].f[model.fields.indexOf('Skip3')], '1');
  const col = db.exec('select models, decks, ver from col')[0].values[0];
  const m = Object.values(JSON.parse(col[0]))[0];
  assert.strictEqual(m.name, model.name); assert.strictEqual(m.flds.length, model.fields.length); assert.strictEqual(m.tmpls.length, 4); assert.strictEqual(col[2], 11);
  assert.ok(Object.values(JSON.parse(col[1])).some(d => d.name === model.deck));
  assert.deepStrictEqual(db.exec('pragma integrity_check')[0].values[0], ['ok']);
});

test('model templates: every front is wrapped in its Skip switch', () => {
  model.templates.forEach((t, i) => { assert.ok(t.Front.startsWith(`{{^Skip${i + 1}}}`) && t.Front.endsWith(`{{/Skip${i + 1}}}`), t.Name); });
  for (let i = 1; i <= 4; i++) assert.ok(model.fields.includes('Skip' + i));
});
