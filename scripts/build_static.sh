#!/usr/bin/env bash
# Builds ./dist: Kamus as a plain static website (no Kamus server). Needs node/npm for the vendored libraries.
# Upload the CONTENTS of dist/ to the ROOT of a static host (GitHub Pages user site, Netlify, Cloudflare Pages, your own web server):
# the page uses absolute paths such as /vendor/... so it cannot live in a sub-folder like https://example.org/kamus/.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -s static/vendor/apkg/sql-wasm.wasm ] || scripts/fetch_vendor.sh
[ -d dist ] && rm -r dist
mkdir dist && cp -R static/. dist/
echo "dist/ is ready ($(du -sh dist | cut -f1)). Serve it over https for installing the app and the camera/QR scanner."
