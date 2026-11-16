/* Optional cloud sync of cards and search history through the user's OWN Firebase project (Google sign-in + Firestore).
   Nothing here is used until a Firebase config is pasted in Settings. The local data (cards-store.js, localStorage) stays the source of truth:
   a sync pulls what changed in the cloud, merges (newest edit per card wins), pushes local changes, and merges the history.
   Cloud layout:  users/{uid}/cards/{id}  = {fields, word, meaning, created, updated(ms), deleted}   users/{uid}/meta/history = {items:[{w,g,t}], clearedAt}
   Anki note ids and progress are per device and never leave it. */
(function () {
  const CFG_KEY = 'kamus-fb', META_KEY = 'kamus-sync', HIST_MAX = 30;
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: k => { try { localStorage.removeItem(k); } catch (e) {} } };
  const state = { status: 'off', user: null, error: '', last: 0, pulled: 0, pushed: 0 };   // off | signedout | signedin | syncing | error
  const subs = [];
  const emit = () => subs.forEach(fn => { try { fn(state); } catch (e) {} });
  let hooks = null, remote = null, timer = 0, running = false, again = false, lastKick = 0;

  // --- config: accepts the snippet Firebase shows ("const firebaseConfig = { apiKey: ..., ... };") or JSON
  const KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
  function parseConfig(text) {
    const cfg = {};
    for (const k of KEYS) { const m = new RegExp('["\']?' + k + '["\']?\\s*:\\s*["\']([^"\']+)["\']').exec(text || ''); if (m) cfg[k] = m[1]; }
    if (!cfg.apiKey || !cfg.projectId) throw new Error('This does not look like a Firebase web config (apiKey and projectId are needed).');
    if (!cfg.authDomain) cfg.authDomain = cfg.projectId + '.firebaseapp.com';
    return cfg;
  }
  // --- sharing the config with another device: a link  <origin>/#sync=<base64url(apiKey|authDomain|projectId|appId)>  (the hash never goes to a server)
  const b64u = t => btoa(unescape(encodeURIComponent(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = t => decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/'))));
  const OK = /^[A-Za-z0-9_.:-]{1,200}$/;
  function shareUrl() { const c = getConfig(); if (!c) return ''; return location.origin + '/#sync=' + b64u([c.apiKey, c.authDomain, c.projectId, c.appId || ''].join('|')); }
  function fromShared(text) {   // a share link, "#sync=…", or the pasted firebaseConfig snippet -> config object (throws when it is neither)
    const m = /#sync=([A-Za-z0-9_-]+)/.exec(text || '');
    if (!m) return parseConfig(text);
    let parts; try { parts = unb64u(m[1]).split('|'); } catch (e) { throw new Error('This QR code is not a Kamus sync link.'); }
    const [apiKey, authDomain, projectId, appId] = parts;
    if (![apiKey, authDomain, projectId].every(v => v && OK.test(v)) || (appId && !OK.test(appId))) throw new Error('This QR code is not a Kamus sync link.');
    return { apiKey, authDomain, projectId, ...(appId ? { appId } : {}) };
  }
  function setConfig(cfg) { ls.set(CFG_KEY, JSON.stringify(cfg)); }
  const getConfig = () => { try { return JSON.parse(ls.get(CFG_KEY)); } catch (e) { return null; } };
  const meta = () => { try { return JSON.parse(ls.get(META_KEY)) || {}; } catch (e) { return {}; } };
  const setMeta = p => ls.set(META_KEY, JSON.stringify({ ...meta(), ...p }));

  // --- history merge (pure): newest visit per word wins; a "Clear" (clearedAt) removes everything older
  function mergeHistory(a, b) {
    const clearedAt = Math.max(a.clearedAt || 0, b.clearedAt || 0), by = new Map();
    for (const it of [...(a.items || []), ...(b.items || [])]) {
      if (!it || !it.w) continue;
      const t = it.t || 0, cur = by.get(it.w);
      if (!cur) by.set(it.w, { w: it.w, g: it.g || '', t });
      else { if (t > cur.t) { cur.t = t; if (it.g) cur.g = it.g; } else if (!cur.g && it.g) cur.g = it.g; }
    }
    const items = [...by.values()].filter(x => x.t > clearedAt || (clearedAt === 0)).sort((x, y) => y.t - x.t).slice(0, HIST_MAX);
    return { items, clearedAt };
  }
  const sameHist = (a, b) => (a.clearedAt || 0) === (b.clearedAt || 0) && JSON.stringify((a.items || []).map(x => [x.w, x.g || '', x.t || 0])) === JSON.stringify((b.items || []).map(x => [x.w, x.g || '', x.t || 0]));

  // --- the sync itself; `rem` = {uid, pullCards(since), pushCards(docs), getHistory(), setHistory(h)} (Firebase below, a fake in the tests)
  async function syncCore(rem) {
    const K = window.KamusCards, m = meta();
    if (m.uid && m.uid !== rem.uid) { await K.resetSyncMarks(); setMeta({ lastPull: 0 }); }   // signed in with another account: push everything there
    setMeta({ uid: rem.uid });
    let since = meta().lastPull || 0, pulled = 0, pushed = 0;
    for (const d of await rem.pullCards(since)) { since = Math.max(since, d.updated || 0); if (await K.applyRemote(d)) pulled++; }
    const pend = await K.pending();
    if (pend.length) {
      await rem.pushCards(pend.map(c => ({ id: c.id, fields: c.deleted ? {} : c.fields, word: c.word || '', meaning: c.meaning || '', created: c.created || 0, updated: c.updated, deleted: !!c.deleted })));
      for (const c of pend) await K.markSynced(c.id, c.updated);
      pushed = pend.length;
    }
    const local = hooks.getHistory(), cloud = await rem.getHistory(), merged = mergeHistory(local, cloud);
    if (!sameHist(merged, local)) hooks.setHistory(merged);
    if (!sameHist(merged, cloud)) await rem.setHistory(merged);
    setMeta({ lastPull: since, lastSync: Date.now() });
    return { pulled, pushed };
  }

  // --- Firebase (SDK files are loaded only when a config exists)
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('could not load ' + src)); document.head.appendChild(s); });
  let sdk = null;
  function loadSdk() {
    return sdk || (sdk = (async () => {
      for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']) await loadScript('/vendor/firebase/' + f);
      const cfg = getConfig(); const app = firebase.initializeApp(cfg);
      return { auth: firebase.auth(app), db: firebase.firestore(app) };
    })());
  }
  const friendly = e => {
    const c = e && e.code || '', host = location.hostname;
    if (c === 'auth/unauthorized-domain') return `Firebase does not allow this address yet: add “${host}” under Authentication → Settings → Authorised domains.`;
    if (c === 'auth/operation-not-allowed') return 'Google sign-in is not turned on: Firebase console → Authentication → Sign-in method → Google → Enable.';
    if (c === 'auth/popup-blocked') return 'The browser blocked the sign-in window. Allow pop-ups for this page and try again.';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return 'Sign-in was cancelled.';
    if (c === 'auth/invalid-api-key' || c === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') return 'The apiKey in the pasted config is not valid.';
    if (c === 'permission-denied' || /permission/i.test(e && e.message || '')) return 'Firestore refused the request: check the security rules (see the setup steps) and that Firestore is created.';
    return (e && e.message) || String(e);
  };
  function firebaseRemote(db, user) {
    const base = db.collection('users').doc(user.uid), cards = base.collection('cards'), hist = base.collection('meta').doc('history');
    return {
      uid: user.uid,
      async pullCards(since) { const q = await cards.where('updated', '>', since).orderBy('updated').get(); return q.docs.map(d => ({ id: d.id, ...d.data() })); },
      async pushCards(docs) {
        for (let i = 0; i < docs.length; i += 400) { const b = db.batch(); docs.slice(i, i + 400).forEach(d => { const { id, ...rest } = d; b.set(cards.doc(id), rest); }); await b.commit(); }
      },
      async getHistory() { const d = await hist.get(); return d.exists ? d.data() : { items: [], clearedAt: 0 }; },
      setHistory: h => hist.set(h)
    };
  }

  async function syncNow() {
    if (!remote) return;
    if (running) { again = true; return; }
    running = true; state.status = 'syncing'; state.error = ''; emit();
    try {
      const r = await syncCore(remote);
      state.pulled = r.pulled; state.pushed = r.pushed; state.last = meta().lastSync; state.status = 'signedin';
      if (r.pulled && hooks.onRemoteChange) hooks.onRemoteChange();
    } catch (e) { state.status = 'error'; state.error = friendly(e); }
    running = false; emit();
    if (again) { again = false; schedule(1500); }
  }
  function schedule(ms = 4000) { if (!remote || meta().auto === false) return; clearTimeout(timer); timer = setTimeout(syncNow, ms); }

  async function connect() {   // called at start when a config is saved
    if (!getConfig()) { state.status = 'off'; emit(); return; }
    state.status = 'signedout'; emit();
    try {
      const { auth, db } = await loadSdk();
      auth.onAuthStateChanged(u => {
        state.user = u ? { email: u.email, name: u.displayName, uid: u.uid } : null;
        remote = u ? firebaseRemote(db, u) : null;
        state.status = u ? 'signedin' : 'signedout'; state.last = meta().lastSync || 0; emit();
        if (u && meta().auto !== false) schedule(500);
      });
    } catch (e) { state.status = 'error'; state.error = friendly(e); emit(); }
  }
  // Sign-in runs on its own page (/auth.html), which the server sends WITHOUT cross-origin isolation: a page with COOP same-origin
  // cannot talk to the Google pop-up it opens ("Sign-in was cancelled"). The signed-in state is kept in this origin's IndexedDB.
  function signIn() { location.href = '/auth.html'; }
  async function signOut() { try { const { auth } = await loadSdk(); await auth.signOut(); } catch (e) {} }
  function saveConfig(text) { const cfg = parseConfig(text); ls.set(CFG_KEY, JSON.stringify(cfg)); return cfg; }
  function removeConfig() { ls.del(CFG_KEY); ls.del(META_KEY); }

  function init(h) {
    hooks = h;
    window.KamusCards.onChange(() => schedule());
    addEventListener('online', () => schedule(1000));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastKick > 60000) { lastKick = Date.now(); schedule(500); } });
    if ('requestIdleCallback' in window) requestIdleCallback(connect); else setTimeout(connect, 800);
  }
  window.KamusSync = { init, state, loadSdk, friendly, shareUrl, fromShared, setConfig, onState: fn => subs.push(fn), parseConfig, saveConfig, removeConfig, getConfig, signIn, signOut, syncNow, schedule, mergeHistory, syncCore, setAuto: v => { setMeta({ auto: !!v }); if (v) schedule(500); }, isAuto: () => meta().auto !== false,
    _test: { setHooks: h => { hooks = h; } } };
})();
