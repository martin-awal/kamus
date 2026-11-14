// Just enough of the browser for static/cards-store.js and static/sync.js to run under Node: an in-memory IndexedDB and a localStorage.
class Req { constructor() { this.result = undefined; this.error = null; this.onsuccess = null; this.onerror = null; } }

class FakeStore {
  constructor(name, keyPath, tx) { this.name = name; this.keyPath = keyPath; this.tx = tx; }
  get data() { return this.tx.db._data[this.name]; }
  _req(fn) { const r = new Req(); this.tx._pending++; queueMicrotask(() => { r.result = fn(); if (r.onsuccess) r.onsuccess({ target: r }); this.tx._done(); }); return r; }
  get(k) { return this._req(() => { const v = this.data.get(k); return v === undefined ? undefined : structuredClone(v); }); }
  getAll() { return this._req(() => [...this.data.values()].map(v => structuredClone(v))); }
  put(v, k) { return this._req(() => { this.data.set(this.keyPath ? v[this.keyPath] : k, structuredClone(v)); return undefined; }); }
  delete(k) { return this._req(() => { this.data.delete(k); }); }
  count(k) { return this._req(() => (k === undefined ? this.data.size : this.data.has(k) ? 1 : 0)); }
  clear() { return this._req(() => { this.data.clear(); }); }
}
class FakeTx {
  constructor(db) { this.db = db; this._pending = 0; this.oncomplete = null; this.onerror = null; this.onabort = null; }
  objectStore(name) { return new FakeStore(name, this.db._keyPaths[name], this); }
  _done() { if (--this._pending === 0) queueMicrotask(() => this.oncomplete && this.oncomplete()); }
}
class FakeDb {
  constructor() { this._data = {}; this._keyPaths = {}; this.objectStoreNames = { contains: n => n in this._data }; }
  createObjectStore(name, opts) { this._data[name] = new Map(); this._keyPaths[name] = opts && opts.keyPath; }
  transaction() { return new FakeTx(this); }
  close() {}
}
class FakeIndexedDB {
  constructor() { this.db = null; }
  open() {
    const r = new Req();
    queueMicrotask(() => {
      const fresh = !this.db; if (fresh) this.db = new FakeDb();
      r.result = this.db;
      if (fresh && r.onupgradeneeded) r.onupgradeneeded({ target: r });
      if (r.onsuccess) r.onsuccess({ target: r });
    });
    return r;
  }
}
class FakeLocalStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

// load cards-store.js (and optionally sync.js) as one "device": its own IndexedDB and localStorage
function loadDevice({ sync = false } = {}) {
  const path = require('path'), root = path.join(__dirname, '..', '..', 'static');
  global.window = global; global.indexedDB = new FakeIndexedDB(); global.localStorage = new FakeLocalStorage();
  global.navigator = { storage: { persist: async () => true } }; global.document = { addEventListener() {}, visibilityState: 'visible' }; global.addEventListener = () => {};
  for (const f of ['cards-store.js', 'sync.js']) if (f !== 'sync.js' || sync) { const p = path.join(root, f); delete require.cache[p]; require(p); }
  const dev = { indexedDB: global.indexedDB, localStorage: global.localStorage, K: global.KamusCards, S: sync ? global.KamusSync : null };
  dev.use = () => { global.indexedDB = dev.indexedDB; global.localStorage = dev.localStorage; global.KamusCards = dev.K; if (dev.S) global.KamusSync = dev.S; return dev; };
  return dev.K.list().then(() => dev);   // opens the database now, while this device's globals are in place
}
module.exports = { loadDevice };
