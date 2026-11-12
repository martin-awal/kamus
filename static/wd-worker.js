// Runs the Wikidepia VITS model (exported to ONNX, see scripts/export_wikidepia_onnx.py) with onnxruntime-web, off the UI thread.
// The model file comes from IndexedDB (downloaded once from Settings), so it works offline afterwards.
import * as ort from '/vendor/ort/ort.wasm.min.mjs';

ort.env.wasm.wasmPaths = '/vendor/ort/';
// IndexedDB (not Cache Storage): it also exists on plain-http origins such as http://192.168.x.x
function idbGet(store, key) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('kamus', 1);
    r.onupgradeneeded = () => { for (const s of ['wiki', 'wav', 'models']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const q = r.result.transaction(store, 'readonly').objectStore(store).get(key);
      q.onsuccess = () => { r.result.close(); resolve(q.result); };
      q.onerror = () => reject(q.error);
    };
  });
}
let session = null, loadMs = 0;

async function load(threads) {
  if (session) return;
  const t0 = performance.now();
  const blob = await idbGet('models', 'wikidepia-vits');
  if (!blob) throw new Error('model not downloaded');
  const buf = await blob.arrayBuffer();
  // several WASM threads need cross-origin isolation (the server sends COOP/COEP); otherwise a single thread
  ort.env.wasm.numThreads = threads || (self.crossOriginIsolated ? Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2))) : 1);   // measured: more threads than physical cores does not help
  session = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  loadMs = performance.now() - t0;
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      await load(m.threads);
      postMessage({ id: m.id, ok: true, loadMs, threads: ort.env.wasm.numThreads, isolated: self.crossOriginIsolated });
    } else if (m.type === 'run') {
      const firstRun = !session;
      await load();
      const t0 = performance.now();
      const out = await session.run({
        input: new ort.Tensor('int64', BigInt64Array.from(m.ids, BigInt), [1, m.ids.length]),
        input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(m.ids.length)]), [1]),
        scales: new ort.Tensor('float32', Float32Array.from(m.scales), [3]),
        sid: new ort.Tensor('int64', BigInt64Array.from([BigInt(m.sid)]), [1]),
      });
      const wav = out.output.data;
      postMessage({ id: m.id, ok: true, wav, ms: performance.now() - t0, loadMs: firstRun ? loadMs : 0, threads: ort.env.wasm.numThreads, isolated: self.crossOriginIsolated }, [wav.buffer]);
    }
  } catch (err) {
    postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
