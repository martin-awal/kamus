/* Kamus cards live in this browser (IndexedDB database 'kamus-cards'), not on the server.
   One row = one word with one meaning = one Anki note. Shapes match the old server API so the page code stays the same:
   {id, word, meaning, fields, created (seconds), note_id, synced_at, progress, progress_at, dirty}. */
(function () {
  // --- SHA-1 / SHA-256 in plain JS (crypto.subtle only exists on https/localhost, but Kamus is also opened over plain http)
  const rotl = (x, n) => (x << n) | (x >>> (32 - n)), rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const utf8 = s => new TextEncoder().encode(s);
  function pad(bytes) {
    const l = bytes.length, n = (((l + 8) >> 6) + 1) << 6, b = new Uint8Array(n);
    b.set(bytes); b[l] = 0x80;
    const dv = new DataView(b.buffer); dv.setUint32(n - 4, (l * 8) >>> 0); dv.setUint32(n - 8, Math.floor(l * 8 / 4294967296));
    return dv;
  }
  function sha1(bytes) {
    const dv = pad(bytes), h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0], w = new Array(80);
    for (let o = 0; o < dv.byteLength; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      let [a, b, c, d, e] = h;
      for (let i = 0; i < 80; i++) {
        const [f, k] = i < 20 ? [(b & c) | (~b & d), 0x5a827999] : i < 40 ? [b ^ c ^ d, 0x6ed9eba1] : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
        const t = (rotl(a, 5) + f + e + k + w[i]) | 0; e = d; d = c; c = rotl(b, 30); b = a; a = t;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0;
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  const K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(bytes) {   // -> Uint8Array(32)
    const dv = pad(bytes), h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Array(64);
    for (let o = 0; o < dv.byteLength; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K256[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    const out = new Uint8Array(32), ov = new DataView(out.buffer); h.forEach((x, i) => ov.setUint32(i * 4, x)); return out;
  }
  const sha1hex = s => sha1(utf8(s));
  const BASE91 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';
  function ankiGuid(...values) {   // same as genanki.guid_for: first 8 bytes of SHA-256, in Anki's base-91
    let n = 0n; for (const b of sha256(utf8(values.map(String).join('__'))).slice(0, 8)) n = (n << 8n) | BigInt(b);
    let out = ''; while (n > 0n) { out = BASE91[Number(n % 91n)] + out; n /= 91n; }
    return out;
  }

  // --- card text rules (the same as the old cards.py)
  const BASE_FIELDS = ['Word', 'IPA', 'POS', 'KBBI', 'Wiki', 'Example', 'ExampleEN', 'Skip1', 'Skip2', 'Skip3', 'Skip4'];
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hint = word => word.split(/\s+/).filter(Boolean).map(p => { const cs = [...p]; return [cs[0], ...cs.slice(1).map(c => /\p{L}/u.test(c) ? '_' : c)].join(' '); }).join(' · ');
  const blank = (ex, word) => { const re = new RegExp('(?<!\\w)' + reEsc(word) + '(?!\\w)', 'gi'); return ex && re.test(ex) ? ex.replace(re, '[ … ]') : ''; };
  function clean(fields) {
    const f = {};
    for (const k of BASE_FIELDS) f[k] = String(fields[k] == null ? '' : fields[k]).split(/\s+/).filter(Boolean).join(' ').slice(0, 2000);
    if (!f.Word) throw new Error('Word is required');
    if (!(f.Wiki || f.KBBI)) throw new Error('Give at least one meaning (KBBI or WIKI)');
    for (const k of ['Skip1', 'Skip2', 'Skip3', 'Skip4']) f[k] = f[k] ? '1' : '';
    if (['Skip1', 'Skip2', 'Skip3', 'Skip4'].every(k => f[k])) throw new Error('Keep at least one card type');
    f.ExampleBlank = blank(f.Example, f.Word);
    f.Hint = hint(f.Word);
    f.Audio = f.ExampleAudio = '';   // filled in when the note is sent to Anki / exported
    const meaning = f.Wiki || f.KBBI;
    f.Index = (f.Word + ' | ' + meaning).slice(0, 200);
    return [f, meaning];
  }
  const idFor = (f, meaning) => sha1hex(f.Word.toLowerCase() + '|' + meaning.toLowerCase()).slice(0, 12);

  // --- IndexedDB
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('kamus-cards', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('cards')) r.result.createObjectStore('cards', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  async function tx(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => { const t = db.transaction('cards', mode), req = fn(t.objectStore('cards')); t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  // `updated` (ms) changes only when the card's CONTENT changes (not for Anki note id/progress); `sync_u` = the `updated` the cloud sync last agreed on.
  // A deleted card stays as a tombstone ({deleted:true}) so the deletion can sync too.
  const norm = c => { const o = { note_id: null, synced_at: null, progress: null, progress_at: null, dirty: false, deleted: false, sync_u: null, ...c }; if (o.updated == null) o.updated = Math.round((o.created || 0) * 1000); return o; };
  const listRaw = async () => ((await tx('readonly', o => o.getAll())) || []).map(norm);
  const list = async () => (await listRaw()).filter(c => !c.deleted).sort((a, b) => b.created - a.created);
  const getRaw = async id => { const c = await tx('readonly', o => o.get(id)); return c ? norm(c) : null; };
  const get = async id => { const c = await getRaw(id); return c && !c.deleted ? c : null; };
  const put = c => tx('readwrite', o => o.put(c));
  const persist = () => { try { navigator.storage.persist(); } catch (e) {} };
  const listeners = [];
  const onChange = fn => listeners.push(fn);
  const changed = () => listeners.forEach(fn => { try { fn(); } catch (e) {} });

  async function create(fields) {   // -> {card, created}; the id comes from word + meaning, so the same pair is never stored twice
    const [f, meaning] = clean(fields), id = idFor(f, meaning), existing = await getRaw(id);
    if (existing && !existing.deleted) return { card: existing, created: false };
    const card = norm({ ...(existing || {}), id, word: f.Word, meaning, fields: f, created: Date.now() / 1000, updated: Date.now(), deleted: false, dirty: false });   // a deleted card comes back
    await put(card); persist(); changed();
    return { card, created: true };
  }
  async function update(id, fields) {   // edit in place: the id stays (Anki's note keeps matching); a card already in Anki becomes dirty
    const old = await get(id);
    if (!old) throw new Error('card not found');
    const [f, meaning] = clean(fields), newId = idFor(f, meaning);
    if (newId !== id && await get(newId)) throw new Error('Another card already has this word and meaning');
    const card = { ...old, word: f.Word, meaning, fields: f, dirty: !!old.note_id, updated: Date.now() };
    await put(card); changed(); return card;
  }
  const stats = async () => { const l = await list(); return { n: l.length, bytes: JSON.stringify(l).length }; };
  async function remove(id) {
    const old = await getRaw(id); if (!old) return;
    await put({ id, word: old.word, meaning: old.meaning, fields: {}, created: old.created, deleted: true, updated: Date.now(), sync_u: old.sync_u, note_id: null, synced_at: null, progress: null, progress_at: null, dirty: false });
    changed();
  }
  async function report(updates) {   // what happened in Anki: {id, note_id?, dirty?, progress?}
    const now = Date.now() / 1000;
    for (const u of updates) {
      const c = await get(u.id); if (!c) continue;
      if ('note_id' in u) { c.note_id = u.note_id; c.synced_at = now; }
      if ('dirty' in u) c.dirty = !!u.dirty;
      if ('progress' in u) { c.progress = u.progress; c.progress_at = now; }
      await put(c);
    }
  }
  // --- backup / restore / one-time move from the old server database
  async function importCards(cards) {   // adds the cards this browser does not have yet (by id); returns how many
    let n = 0;
    for (const c of cards) { if (!c || !c.id || !c.fields || await get(c.id)) continue; const old = await getRaw(c.id); await put(norm({ ...c, deleted: false, sync_u: old ? old.sync_u : null, updated: Math.max(c.updated == null ? Math.round((c.created || 0) * 1000) : c.updated, old ? old.updated + 1 : 0) })); n++; }   // no timestamp (old data): derived from `created`, so every browser agrees
    if (n) { persist(); changed(); }
    return n;
  }
  async function migrateFromServer() {   // once per browser: copy the cards the old server kept in cards.db
    try { if (localStorage.getItem('kamus-cards-migrated')) return 0; } catch (e) {}
    let j;
    try { const r = await fetch('/api/cards'); if (!r.ok) throw new Error(); j = await r.json(); } catch (e) { return 0; }   // no server / no old data: try again next time
    const n = await importCards(j.cards || []);
    try { localStorage.setItem('kamus-cards-migrated', '1'); } catch (e) {}
    return n;
  }
  // --- cloud sync support (see sync.js)
  const pending = async () => (await listRaw()).filter(c => c.sync_u !== c.updated);
  async function markSynced(id, updated) { const c = await getRaw(id); if (c && c.updated === updated) { c.sync_u = updated; await put(c); } }
  async function resetSyncMarks() { for (const c of await listRaw()) if (c.sync_u != null) { c.sync_u = null; await put(c); } }   // another account: everything must be pushed again
  async function applyRemote(d) {   // a card document from the cloud; the newest edit wins. -> true when the local card changed
    const local = await getRaw(d.id);
    if (local && local.updated >= d.updated) return false;
    if (d.deleted) { await put(norm({ ...(local || {}), id: d.id, deleted: true, fields: {}, word: (local && local.word) || d.word || '', meaning: (local && local.meaning) || d.meaning || '', created: (local && local.created) || d.created || 0, updated: d.updated, sync_u: d.updated, note_id: null, progress: null, dirty: false })); return true; }
    let f, meaning;
    try { [f, meaning] = clean(d.fields || {}); } catch (e) { return false; }   // unusable document: ignore it
    await put(norm({ ...(local || {}), id: d.id, word: f.Word, meaning, fields: f, created: d.created || (local && local.created) || Date.now() / 1000, deleted: false, updated: d.updated, sync_u: d.updated,
      dirty: local && !local.deleted && local.note_id ? true : false }));   // already in Anki: the next Anki sync sends the changed text
    return true;
  }
  window.KamusCards = { onChange, listRaw, pending, markSynced, resetSyncMarks, applyRemote, stats, list, get, create, update, remove, report, importCards, migrateFromServer, clean, ankiGuid, sha1hex, sha256, utf8 };
})();
