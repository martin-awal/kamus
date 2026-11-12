#!/usr/bin/env bash
# Recreates static/vendor/ (not in git: about 43 MB of WebAssembly + JS) from the npm packages. Needs node/npm.
#   onnxruntime-web 1.31.1            -> static/vendor/ort/          (in-browser Wikidepia TTS)
#   @huggingface/transformers 4.3.2   -> static/vendor/transformers/ (in-browser Opus-MT translation) + the onnxruntime-web build it pins
#   firebase 13.3.0 (compat)         -> static/vendor/firebase/     (optional cloud sync)
#   qrcode-generator 2.0.4 + jsqr 1.4.0 -> static/vendor/qr/   (QR share of the sync config)
#   sql.js 1.16.0 + jszip 3.10.2      -> static/vendor/apkg/         (.apkg export)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$PWD/static/vendor"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT/ort" "$OUT/transformers" "$OUT/apkg"

cd "$TMP"
npm pack onnxruntime-web@1.31.1 >/dev/null && mkdir ort && tar xzf onnxruntime-web-1.31.1.tgz -C ort
for f in ort.wasm.min.mjs ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.wasm; do cp ort/package/dist/$f "$OUT/ort/"; done
cp ort/package/package.json "$OUT/ort/PACKAGE.json"

npm pack @huggingface/transformers@4.3.2 >/dev/null && mkdir hf && tar xzf huggingface-transformers-4.3.2.tgz -C hf
cp hf/package/dist/transformers.min.js hf/package/dist/ort-wasm-simd-threaded.jsep.mjs "$OUT/transformers/"
cp hf/package/LICENSE "$OUT/transformers/LICENSE-transformers.js"
ORT_PIN="$(node -p "require('./hf/package/package.json').dependencies['onnxruntime-web']")"
PIN_TGZ="$(npm pack "onnxruntime-web@$ORT_PIN" 2>/dev/null | tail -1)" && mkdir ort2 && tar xzf "$PIN_TGZ" -C ort2
cp ort2/package/dist/ort-wasm-simd-threaded.jsep.wasm "$OUT/transformers/"
# .apkg export in the browser: sql.js (SQLite in WebAssembly, MIT) and JSZip (MIT or GPL-3.0-or-later; used under MIT)
npm pack sql.js@1.16.0 >/dev/null && mkdir sqljs && tar xzf sql.js-1.16.0.tgz -C sqljs
cp sqljs/package/dist/sql-wasm.js sqljs/package/dist/sql-wasm.wasm "$OUT/apkg/" && cp sqljs/package/LICENSE "$OUT/apkg/LICENSE-sql.js"
npm pack jszip@3.10.2 >/dev/null && mkdir jszip && tar xzf jszip-3.10.2.tgz -C jszip
cp jszip/package/dist/jszip.min.js "$OUT/apkg/" && cp jszip/package/LICENSE.markdown "$OUT/apkg/LICENSE-jszip.markdown"
# optional cloud sync: Firebase JS SDK (compat bundles, Apache-2.0), loaded only when a Firebase config is saved in Settings
mkdir -p "$OUT/firebase" && npm pack firebase@13.3.0 >/dev/null && mkdir fb && tar xzf firebase-13.3.0.tgz -C fb
for f in firebase-app-compat.js firebase-auth-compat.js firebase-firestore-compat.js; do cp fb/package/$f "$OUT/firebase/"; done
cp fb/package/package.json "$OUT/firebase/PACKAGE.json"   # the npm package ships no LICENSE file; Apache-2.0 is declared here
# QR codes for sharing the sync config: qrcode-generator (MIT) draws them, jsQR (Apache-2.0) reads them from the camera
mkdir -p "$OUT/qr" && npm pack qrcode-generator@2.0.4 >/dev/null && mkdir qrg && tar xzf qrcode-generator-2.0.4.tgz -C qrg
cp qrg/package/dist/qrcode.js "$OUT/qr/" && cp qrg/package/package.json "$OUT/qr/PACKAGE-qrcode-generator.json"   # no LICENSE file in the package; MIT is declared here
npm pack jsqr@1.4.0 >/dev/null && mkdir jsqr && tar xzf jsqr-1.4.0.tgz -C jsqr
cp jsqr/package/dist/jsQR.js "$OUT/qr/" && cp jsqr/package/LICENSE "$OUT/qr/LICENSE-jsQR"
echo "vendor files written to $OUT"
