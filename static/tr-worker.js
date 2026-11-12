// Opus-MT (Helsinki-NLP, ONNX by Xenova) translation in the browser with Transformers.js, off the UI thread.
// The model files come from IndexedDB once downloaded from Settings (see the fetch hook below), so it works offline.

const MODELS = '/models/opus-mt/';
function idbGet(key) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('kamus', 1);
    r.onupgradeneeded = () => { for (const s of ['wiki', 'wav', 'models']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const q = r.result.transaction('models', 'readonly').objectStore('models').get(key);
      q.onsuccess = () => { r.result.close(); resolve(q.result); };
      q.onerror = () => reject(q.error);
    };
  });
}
const realFetch = self.fetch.bind(self);
self.fetch = async (input, init) => {   // model files: IndexedDB first, our server as the fallback
  const url = typeof input === 'string' ? input : input.url;
  const path = url.replace(self.location.origin, '');
  if (path.startsWith(MODELS)) {
    const blob = await idbGet('mt:' + path).catch(() => null);
    if (blob) return new Response(blob, { status: 200, headers: { 'Content-Type': path.endsWith('.json') ? 'application/json' : 'application/octet-stream', 'Content-Length': String(blob.size) } });
  }
  return realFetch(input, init);
};

// The library captures `fetch` when it is imported, so it must be imported only after the hook above is in place.
const lib = import('/vendor/transformers/transformers.min.js').then(({ env, pipeline }) => {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = MODELS;
  env.useBrowserCache = false;     // Cache Storage only exists on https/localhost; we keep the files in IndexedDB ourselves
  env.useWasmCache = false;
  env.backends.onnx.wasm.wasmPaths = { mjs: '/vendor/transformers/ort-wasm-simd-threaded.jsep.mjs', wasm: '/vendor/transformers/ort-wasm-simd-threaded.jsep.wasm' };
  env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2))) : 1;
  return { env, pipeline };
});

const pipes = {};
async function getPipe(dir) {
  if (!pipes[dir]) pipes[dir] = lib.then(({ pipeline }) => pipeline('translation', `Xenova/opus-mt-${dir}`, { dtype: 'q8', device: 'wasm' }));
  return pipes[dir];
}
self.onmessage = async (e) => {
  const m = e.data;
  try {
    const t0 = performance.now();
    const first = !pipes[m.dir];
    const p = await getPipe(m.dir);
    const loadMs = first ? performance.now() - t0 : 0;
    if (m.type === 'load') { postMessage({ id: m.id, ok: true, loadMs }); return; }
    const t1 = performance.now();
    const out = await p(m.text, { max_new_tokens: 256 });
    postMessage({ id: m.id, ok: true, text: out[0].translation_text, ms: performance.now() - t1, loadMs, threads: (await lib).env.backends.onnx.wasm.numThreads });
  } catch (err) {
    delete pipes[m.dir];
    postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
