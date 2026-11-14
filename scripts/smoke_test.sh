#!/usr/bin/env bash
# CI / local smoke test: start the server on a spare port and check that the page and its scripts are served.
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-python3}"; PORT="${PORT:-8799}"
LOG="$(mktemp)"; trap 'kill $PID 2>/dev/null || true; rm -f "$LOG"' EXIT
"$PY" server.py --port "$PORT" >"$LOG" 2>&1 &
PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
kill -0 $PID 2>/dev/null || { echo "server did not start:"; cat "$LOG"; exit 1; }
fail=0
for path in / /theme.js /cards-store.js /apkg.js /sync.js /stemmer.js /srs.js /learn.js /learn.css /data/affixes.js /data/core-words.js /data/malay-diff.js /data/drills.js /data/wordlist-id.txt /auth.html /anki-model.json /manifest.webmanifest /sw.js /api/kbbi/status /api/translate/status; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$path")
  [ "$code" = "200" ] && echo "ok   $path" || { echo "FAIL $path -> $code"; fail=1; }
done
# the sign-in page must not be cross-origin isolated (see CLAUDE.md), the main page is
curl -sI "http://127.0.0.1:$PORT/auth.html" | grep -qi '^cross-origin-opener-policy' && { echo "FAIL auth.html must not send COOP"; fail=1; } || echo "ok   auth.html has no COOP"
curl -s "http://127.0.0.1:$PORT/api/lookup?q=pagi" | grep -q "choose a KBBI source" && echo "ok   KBBI is not contacted without an explicit source" || { echo "FAIL /api/lookup without src"; fail=1; }
exit $fail
