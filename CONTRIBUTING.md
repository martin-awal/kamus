# Contributing to Kamus

Thanks for helping. Kamus is a small personal-learning tool made public, so the process is light.

## Set up
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
scripts/fetch_vendor.sh            # browser libraries (needs node/npm)
.venv/bin/python server.py         # http://localhost:8765
```
Optional extras (offline voices, Argos, models) are described in the README. You do not need them to work on most of the code.

## Before you open a pull request
```bash
node --test tests/*.test.js        # stemmer, card rules, sync merging, .apkg export (needs scripts/fetch_vendor.sh)
npm ci && npx playwright test      # UI matrix: layout, accessibility, task flows (needs scripts/fetch_vendor.sh)
scripts/smoke_test.sh              # starts the server and checks the page and its scripts
python3 scripts/check_credits.py   # credits.json is complete
```
CI runs the same checks. If you change behaviour, add or update a test where it is easy (the stemmer is the model: a table of words and expected results).

## Rules that matter here
- **Credits:** if you add, remove or change a library, data source, online service, font or model, update `credits.json` in the same pull request (licence from the project's own metadata, not from memory). The Legal page is generated from it.
- **Licences:** Kamus is AGPL-3.0. Do not add code or data you cannot license that way. In particular, never commit KBBI text, the server's `cache.db`, model files, or anything from `models/` or `static/vendor/` (they are git-ignored on purpose).
- **KBBI stays optional.** It belongs to Badan Bahasa; the app must work without it and must not contact it unless the user chose it in Settings.
- **No personal data:** no emails, hostnames or API keys in the repository. Firebase config values live in the user's browser only.
- **Servers you start in tests:** stop them afterwards (a stale server on the same port will serve old code).
- **Forks:** if you run a modified copy for other people, change `SOURCE_URL` in `static/index.html` to your repository (AGPL section 13).

## How the code is laid out
`CLAUDE.md` is the working notes file: every subsystem (cards in the browser, sync, `.apkg` export, stemmer, sources) has a short note with the gotchas learned the hard way. Read the section you are about to touch.

## Style
Match the surrounding code: plain JavaScript without a build step, standard-library Python. Keep comments short and explain *why*. UI follows Material Design 3; see the UI rules in `CLAUDE.md` (pickers look like menu buttons, the search bar is the highest floating element, and so on).

## Reporting problems
Use the issue templates. For security problems, do **not** open a public issue: see `SECURITY.md`.

By contributing you agree that your contribution is licensed under the GNU AGPL-3.0, like the rest of the project. Everyone taking part is expected to follow the `CODE_OF_CONDUCT.md`.
