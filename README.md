# Kamus

[![CI](https://github.com/martin-awal/kamus/actions/workflows/ci.yml/badge.svg)](https://github.com/martin-awal/kamus/actions/workflows/ci.yml)

Source: https://github.com/martin-awal/kamus · Licence: AGPL-3.0 · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Code of Conduct](CODE_OF_CONDUCT.md)

A personal Indonesian dictionary for learners, run on your own computer. Look up a word and get Indonesian definitions (Indonesian Wiktionary by default, KBBI optional),
English and Chinese glosses from Wiktionary, example sentences, pronunciation (several text-to-speech engines), and turn what you
find into Anki flashcards. It is a Material Design 3 web app (installable as a PWA); the server is plain Python.

> Status: a personal learning tool, published as-is. See [Legal notes](#legal-notes) about KBBI, which is optional and off by default.

## Features
- **What to show** (Settings): English definitions, Chinese definitions (Simplified or Traditional), related words, example sentences, and which language a new card's meaning starts in. Everything is on by default.
- **Lookup**: Indonesian Wiktionary (default) or optionally KBBI, English Wiktionary, Tatoeba, with history, a quick-look chip for any word you select, and suggestions.
- **Base words**: a rule-based Indonesian stemmer (berlari → ber- + lari) in the browser, checked against a word list of Wiktionary titles (a snapshot ships with Kamus; Settings can update it). It finds the entry for derived words and shows their word parts.
- **Learn** (its own page, plus tiles on the Kamus home page): spaced review of your cards with Kamus' own schedule (separate from Anki's), five words of the day, Malay vs Indonesian (live Wiktionary comparison, common differences, false friends, a quiz), and pronunciation practice (record yourself, listen back, and a match score where the browser understands Indonesian speech).
- **Affix lessons** (own page): ber-, meN-, di-, ter-, peN-, -an, -kan, -i, ke-…-an, per-…-an, se- and reduplication, with sound-change tables and ten-question practice; it can also take apart the words from your own cards and history.
- **Pronunciation**: browser voice, edge-tts, or the offline Wikidepia voices (on the server or inside the browser).
- **Anki bridge**: save cards (stored in your browser) (4 card types per note, each can be switched off), edit them, send them to Anki desktop
  through AnkiConnect, read review progress back, or export an `.apkg`.
- **Translation** of missing example/meaning text: MyMemory, Argos Translate (server), Opus-MT (in the browser), or LibreTranslate.
- **Storage tile** in Settings (what Kamus keeps in the browser, with clear/remove buttons) and **Import from Anki** for notes of the Kamus note type.
- Light/dark/system theme, a seed colour picker, speech speed, offline app shell.

## Quick start
```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci && npm run build               # builds the page: src/ -> static/index.html + static/assets (needs Node 20+)
scripts/fetch_vendor.sh               # browser libraries
.venv/bin/python server.py            # http://localhost:8765  (this computer only)
.venv/bin/python server.py --lan      # whole local network
.venv/bin/python server.py --port 8770 --cert cert.pem --key key.pem   # https
```
PWA install, multi-threaded WebAssembly and service workers need https or `localhost`.
AnkiConnect also wants port 8765, so run Kamus with `--port` on the computer where Anki runs.

## Running without the server (static website)
Most of Kamus runs in the browser: Indonesian and English Wiktionary, Tatoeba, cards (stored in the browser), backup, sync, `.apkg` export, the
base-word finder, MyMemory and Opus-MT translation, the learning pages and the browser voice. Without the Kamus server only these things are switched off:
KBBI, edge-tts, the Wikidepia voices, Argos and LibreTranslate. The page notices on its own and locks those options in Settings.
```bash
scripts/build_static.sh                  # dist/ for the root of a site
BASE=/kamus scripts/build_static.sh      # dist/ for a sub-folder such as https://USER.github.io/kamus/
python3 -m http.server --directory dist 8000
```
**GitHub Pages:** yes. Settings → Pages → Source: *GitHub Actions*, then run the workflow *Deploy to GitHub Pages* (Actions tab). It builds with the
right sub-path for a project site (`https://USER.github.io/REPO/`) and at the root for a user site (a repository named `USER.github.io`) or a custom
domain (a `CNAME` file). Pages cannot send the headers that allow multi-threaded WebAssembly, so the in-browser voice models would be slower; the
Wikidepia model is not part of the site anyway. Add the site's address to Firebase's *Authorised domains* if you use sync, and use https for the QR scanner.
`tests/e2e/*.e2e.js` check this mode at the root and in a sub-folder (CI runs both).

## Optional cloud sync (your own Firebase project)
Kamus can keep cards and search history in step across devices with Google sign-in and Firestore. It is off until you paste a
Firebase web config in **Settings → Sync**, so no one else's account is involved and the data lives in your own Firebase project.
1. **Create a project** at console.firebase.google.com (free Spark plan; Analytics can stay off).
2. **Google sign-in:** Security → Authentication → Get started → Sign-in method → Google → Enable (choose a support email). Then Settings → Authorised domains → Add domain: the address you open Kamus from (`localhost` is allowed; a bare IP address is not; add every device's address).
3. **Database:** Databases and storage → Firestore → Create database (Standard, nearby region, production mode). In **Rules** paste `firestore.rules` and Publish.
4. **Config:** Project Overview → + Add app → Web (`</>`) → Register app (no Hosting) → copy the `firebaseConfig` block.
5. **In Kamus:** Settings → Sync → paste it → Save config → Sign in with Google (opens `/auth.html`, then returns).
6. **Another device:** on the set-up device open Settings → Sync → *Set up another device (QR code)*. On the new device either point its camera app at the code and open the link, or use Settings → Sync → *Scan a QR code* (needs https for the camera). Confirm, then sign in with the same Google account. (Pasting the same config by hand also works.)
Cards merge by id (newest edit wins, deletions sync), history merges by word. Anki note ids and progress stay on each device.
The Firebase config values are not secrets; the security rules protect the data. Needs `scripts/fetch_vendor.sh` to have been run.

**Wikimedia contact (optional):** the server's Wiktionary requests (suggestions, quick look) send a User-Agent. Wikimedia asks for contact
details in it, so set `KAMUS_CONTACT="you@example.com"` (or a URL) before starting the server. It is read from the environment and never committed.

## Optional extras (each is downloaded by you, nothing large is in the repository)
| Extra | Command | Size | Notes |
|---|---|---|---|
| Browser runtimes (in-browser TTS, translation, .apkg export, optional sync) | `scripts/fetch_vendor.sh` | about 46 MB | needs node/npm |
| Opus-MT translation models (in the browser) | nothing to install | 216 MB | download per direction in Settings, straight from Hugging Face; `scripts/download_opus_mt.sh` makes your server serve a local copy instead |
| Argos Translate (on the server) | `scripts/install_argos.sh` | 1.7 GB | own Python env `.argos-env` |
| Wikidepia voices (on the server) | `scripts/install_wikidepia.sh` | 2.5 GB | own Python 3.10 env `.tts-env`; non-commercial model |
| Wikidepia voices in the browser | `scripts/export_wikidepia_onnx.py` | 121 MB | converts the model to ONNX; download in Settings |

## Where things run, and under which licence
"Server" = the Python process you start. "Browser" = the page on your device.

| Source / model | Runs on | Licence / terms | Notes |
|---|---|---|---|
| Wiktionary, Chinese edition | browser, directly | CC BY-SA 4.0 | Chinese definitions under the English card (on by default) |
| Wiktionary, Indonesian edition | browser, directly | CC BY-SA 4.0 | the default source of Indonesian definitions |
| KBBI (optional, off by default) | via the Kamus server: kbbi.web.id, or a kbbi-api server you configure | No open licence (Badan Bahasa); personal use only | **Unresolved**, see below |
| Wiktionary | browser, directly | CC BY-SA 4.0 | attribution shown in the app |
| Tatoeba | browser, directly (api.tatoeba.org/v1) | CC BY 2.0 FR (some CC0) | attribution shown in the app |
| edge-tts (Microsoft read-aloud) | server calls Microsoft | Microsoft terms; unofficial | may break any time; opt-in |
| Browser voice | browser | OS voice | offline |
| Wikidepia VITS voices | server (CPU) or browser (ONNX) | non-commercial only | not redistributed here |
| MyMemory | browser, directly | service terms | text you translate leaves your machine |
| Argos Translate | server | MIT | models downloaded separately, licence not verified |
| Opus-MT id↔en | browser (Transformers.js) | Apache-2.0 | OPUS training data has its own licences |
| LibreTranslate | any server you configure | AGPL-3.0 (server) | not bundled |
| Firebase (Auth + Firestore), optional | browser, your own project | SDK Apache-2.0; Google service terms | off until you add a config |
| Anki / AnkiConnect | Anki desktop, called from the browser | AGPL-3.0+ / GPL-3.0 | not bundled |
| Google Fonts (Roboto) | browser, CDN | service terms; font Apache-2.0 | falls back to the system font offline |

The full, per-package list is in `credits.json` and on the app's Settings → Legal information page.
Update both whenever you add or swap a dependency (see `CLAUDE.md`).

## Legal notes
- **KBBI is optional and off by default.** Its content belongs to Badan Pengembangan dan Pembinaan Bahasa and has no open licence, so
  nothing from it is shipped or cached in this repository. To use it, choose it in Settings → Indonesian definitions: either
  `kbbi.web.id` through your own Kamus server, or a [kbbi-api](https://github.com/raf555/kbbi-api)-compatible server whose address you
  put in the server's environment (`KAMUS_KBBI_API_URL=https://… .venv/bin/python server.py`). For personal, non-commercial study only;
  check the terms of whichever service you use. Do not publish KBBI text or the server's `cache.db`.
- Indonesian Wiktionary is community-written; some entries may be adapted from other dictionaries despite its own rules. Check an entry
  before relying on it, and keep its CC BY-SA attribution (the app shows a source link under each entry).
- **Wikidepia voices are non-commercial** (and the model repository has no licence file). They are not included; you
  download them yourself. The AGPL licence of this code does not change that.
- Your cards live in the browser (IndexedDB), per browser and address, so make backups. An old `cards.db` from earlier versions is copied into the browser once. Never commit `cards.db`, `cache.db`, `tts_cache/` or the downloaded models; `.gitignore` covers them.

## Tests
`node --test tests/*.test.js` runs the tests: stemmer, card rules, cloud-sync merging, spaced repetition, the learning data and the `.apkg` export (the last one needs `scripts/fetch_vendor.sh` first and is skipped without it). No network needed.

## Project layout
`server.py` (HTTP server), `kbbi.py` / `wiktionary.py` (server-side sources; Wiktionary and Tatoeba are fetched by the page itself), `static/cards-store.js` (cards, kept in the browser) + `static/anki-model.json` (the Anki note type) + `static/apkg.js` (.apkg export), `translate.py`, `wikidepia*.py` (TTS), `src/` (the page: markup, styles and 22 app modules, built by Vite into `static/`), `static/*-worker.js`
(in-browser TTS and translation), `scripts/` (installers). `CLAUDE.md` holds the working notes.

## Licence
Kamus is free software under the **GNU Affero General Public License v3.0** (see `LICENSE`). If you run a modified copy for other people over a network, offer them its source: change `SOURCE_URL` in `src/app/21-settings.js` to your fork (shown on Settings → Legal information). Third-party components keep their own licences.
