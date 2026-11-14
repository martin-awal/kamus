#!/usr/bin/env bash
# Builds ./dist: Kamus as a plain static website (no Kamus server). Needs node/npm for the vendored libraries.
# At the root of a site (user.github.io, a custom domain, Netlify, ...):     scripts/build_static.sh
# In a sub-folder (GitHub project pages, https://user.github.io/kamus/):    BASE=/kamus scripts/build_static.sh
# Then upload the CONTENTS of dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -s static/vendor/apkg/sql-wasm.wasm ] || scripts/fetch_vendor.sh
[ -d dist ] && rm -r dist
mkdir dist && cp -R static/. dist/
[ -f CNAME ] && cp CNAME dist/CNAME   # a custom domain for GitHub Pages
touch dist/.nojekyll
[ -n "${BASE:-}" ] && python3 scripts/set_base.py dist "$BASE"
echo "dist/ is ready ($(du -sh dist | cut -f1)). Serve it over https for installing the app and the camera/QR scanner."
