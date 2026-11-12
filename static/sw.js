/* Kamus service worker: offline app shell + cached lookups/audio. Bump VERSION when this file's logic changes. */
const VERSION = 'v2', SHELL = 'kamus-shell-' + VERSION, DATA = 'kamus-data-' + VERSION;
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icon.svg', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL, DATA].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;       // fonts, Wiktionary etc. go straight to the network
  if (url.pathname.endsWith('.onnx')) return;                                // the 121 MB TTS model is stored by the page itself (Cache Storage)
  if (url.pathname === '/api/tts') e.respondWith(cacheFirst(req, DATA));     // synthesized audio never changes
  else if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/suggest') return;                             // live only
    e.respondWith(networkFirst(req, DATA));                                  // offline: last seen answer
  } else e.respondWith(networkFirst(req, SHELL));                            // app shell: fresh when online
});
