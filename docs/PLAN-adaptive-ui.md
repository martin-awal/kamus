# Plan: adaptive UI, automated HCI tests, code quality, real-user testing

Status: approved and in progress. Done: steps 1-12 and 14. Not started: step 13 (Vite + TypeScript split), which needs a separate go-ahead.

Progress notes:
- Steps 2-5 found and fixed real problems: the New card sheet's buttons were hidden behind the bottom bar on phones, the Legal page was empty on static hosts, 170 small touch targets, nested interactive controls in Settings, card-preview contrast, sideways scroll in Settings at 360px.
- `tests/ui/baseline.json` (known violations) is empty.
- Local runs cover Chromium and Firefox. WebKit could not be run on this machine (system libraries need `sudo npx playwright install-deps webkit`); it runs in CI only, so its first CI run may show new failures.
Scope: four tracks, ordered so that tests exist before the code they protect is changed.

## 0. Starting point (checked in the repo, not from memory)

- `static/index.html` is 2000 lines (HTML, CSS, JS in one file); `static/learn.js` 334 lines; `static/learn.css` 70 lines.
- Layout is driven by a few one-off media queries: `max-width: 480px`, `600px`, `1100px`, `min-width: 1280px`, plus `pointer: coarse` in learn.css. There are **zero container queries**.
- Navigation today: left rail (80px) above 600px, bottom bar at 600px and below (`--bnav`). There is nothing for medium/expanded sizes beyond that, and no list-detail or supporting-pane layout.
- Tests: `node --test tests/*.test.js` (111 cases, unit-level) and two Playwright scripts (`tests/e2e/static-site.e2e.js`, `learn.e2e.js`), Chromium only, no axe, no viewport matrix, no screenshots.
- Playwright is not a project dependency (CI installs it with `npm install --no-save`). Chromium builds exist locally; WebKit browsers were **not** found in the local Playwright cache.
- There is no `package.json`, bundler, linter or type checker.

## 1. Constraints that apply to every step

- All existing tests keep passing: `node --test tests/*.test.js`, `tests/e2e/static-site.e2e.js`, `tests/e2e/learn.e2e.js`, also with `KAMUS_BASE=/kamus`.
- Any new library (including dev tools: axe-core, Vite, TypeScript, ESLint, Playwright WebKit) gets a `credits.json` entry in the same commit (licence read from its package metadata); `python3 scripts/check_credits.py` stays green.
- No personal data in the repo. KBBI stays opt-in and server-side only.
- New fixed-position UI uses `var(--bnav)` for its bottom offset; the search dock stays the highest floating element (z-index 45, elevation 3).
- Page files remain servable with no build step until Track 3 step 3.3 is approved separately; the static build (`scripts/build_static.sh`, `set_base.py`) must keep working, including the `BASE=/kamus` variant.
- No push to GitHub. One commit per step, with the commit message ending in the attribution line the repo already uses.

## 2. Model labels

- **needs strong model**: design judgement, cross-cutting CSS/JS changes in the 2000-line page, or subtle browser behaviour where a wrong guess is hard to notice.
- **any model**: mechanical, well-specified, and verified by a test that fails loudly.

## 3. Ordered steps

### Track 2a: test harness first (so layout work is measurable)

**Step 1: Playwright project setup. any model.** Reason: configuration with a clear pass/fail.
- Files: new `package.json` (devDependencies only: `@playwright/test`, `@axe-core/playwright`), `playwright.config.ts` (or `.js`), `tests/viewport/` folder, `.github/workflows/ci.yml` (install browsers incl. WebKit), `.gitignore` (node_modules, test-results), `credits.json`.
- Verify: `npx playwright test --list` shows the matrix; CI job installs chromium, webkit and firefox (Firefox is a smoke run only, see section 6).
- Risk: CI minutes; WebKit on Linux is not Safari on macOS (see section 6).

**Step 2: viewport matrix + layout invariants, run against the CURRENT code. needs strong model.** Reason: deciding what counts as a violation (overlap, overflow, nav type) needs care to avoid flaky or meaningless assertions.
- Matrix: 360x640, 390x844, 820x1180, 1180x820, 1280x800, 1920x1080 x views Kamus, Learn, Anki, Affixes, Settings, Legal Chromium and WebKit run the full suite; Firefox runs only the layout invariants and axe checks (smoke run).
- Invariants: no horizontal scroll (`documentElement.scrollWidth <= innerWidth`); expected navigation type per size class (computed from `getComputedStyle` of `.rail`); no overlap between fixed elements (dock, bottom bar/rail, toc, "Your cards" chip, toasts, sheets) via bounding rectangles; content not hidden under the bottom bar (last element's bottom <= bar's top when scrolled to the end).
- Seed data: a fixture with a few cards and a lookup result (mock Wiktionary/Tatoeba as the existing e2e tests do) so every view has realistic content.
- Verify: the suite runs and **fails on today's code** where known gaps exist (no medium/expanded layout rules); those failures become the work list for Track 1. Commit the failing tests as `test.fixme` with a tracking list, not as red CI.
- Risk: flakiness from fonts/animations; mitigate with `reducedMotion: 'reduce'`, local font fallback, waiting on `document.fonts.ready`.

**Step 3: HCI checks, still against current code. needs strong model.** Reason: thresholds and the "thumb reachability" rule involve interpretation.
- Checks: touch targets >= 48x48 CSS px on `pointer: coarse` as a HARD failure (the hit area, not the visible icon, counts); on `pointer: fine` a 32px minimum as a WARNING only; minimum computed font size 12px; axe-core (WCAG 2.1 AA rules, contrast included) per view in light and dark, with the seed colours default purple, teal and red in the per-push run; every colour in `SEEDS` runs in a scheduled nightly job; keyboard path (Tab order reaches nav, search, results, dialogs; focus visible; Escape closes sheets/dialogs and restores focus; no keyboard trap); reduced motion (no running animations beyond a threshold); 200% zoom (set `deviceScaleFactor`/CSS zoom, assert no horizontal scroll at 360 wide equivalent); dark mode; error and empty states (offline, empty search, no entry, blocked microphone) each show a message plus a next action.
- Phone reachability: compact only; the primary actions (search, navigation, Start review, speaker) must have their centre in the lower 60% of a portrait phone viewport or be reachable from the bottom bar. It is a heuristic, so it is reported as a WARNING, never a failing test.
- Verify: report lists every violation with selector and size; known violations are tracked in a baseline file, new ones fail CI.
- Risk: axe finds many existing issues; do not fix them in this step, only baseline them.

**Step 4: task-flow tests with step counts. any model.** Reason: scripted flows with explicit budgets.
- Flows (budgets are interaction counts, i.e. taps/keystrokes after page load): look up a word (<= 3); make a card from a meaning (<= 4); start and finish a 3-card review (<= 12); change theme mode (<= 3); back up cards (<= 4); open Affix lesson and run a quiz question (<= 4).
- Files: `tests/viewport/flows.spec.ts`.
- Verify: each flow passes at compact and large sizes; the budget is asserted, so a UI change that adds steps fails.

**Step 5: screenshot comparison. any model.** Reason: Playwright's built-in snapshot comparison is mechanical.
- Baselines are CI artifacts, NOT committed (binary images bloat history and fonts differ between machines). Later, a small set of key views at three sizes may be committed if pull-request diffs are wanted.
- Verify: first run creates baselines; second run is green; an intentional CSS change turns it red.
- Risk: font rendering differs between machines; run snapshots only in CI's Linux container and update them there.

### Track 1: adaptive layout and Expressive styling

**Step 6: window size classes as shared tokens. needs strong model.** Reason: a design-system change touching every view; the container-query vs media-query split has to be chosen carefully.
- Define in `static/index.html` (later its own `layout.css`): `--wsc` classes via four media queries used ONLY to set a small set of custom properties (`--rail-w`, `--bnav`, `--gutter`, `--content-max`, `--cols`, `--pane-w`). Everything else reads those variables or uses container queries (`container-type: inline-size` on `main` and on cards) so a component adapts to the space it is given, not to the window.
- Replace the existing one-off queries (480/600/1100/1280) with the four classes: compact < 600, medium 600-839, expanded 840-1199, large >= 1200.
- Files: `static/index.html`, `static/learn.css`, `docs/` (a short layout spec).
- Verify: Step 2 invariants go green for the rows this step targets; the old e2e tests still pass; manual screenshot review at the six sizes.
- Risk: the page has many components with hard-coded paddings; regressions in sheets/dialogs. Do it view by view.

**Step 7: navigation per size class. needs strong model.** Reason: touches routing, focus handling, the history sheet and the toc, all fixed-position and mutually dependent.
- Compact: bottom bar (exists; keep `--bnav`). Medium: rail with icons and labels. Expanded: rail; History is a persistent supporting pane from 840px up (a sheet below that, keeping the hover-open sheet for mouse users on medium screens). Large: extended rail or standard rail with labels, plus the toc and History panes visible together.
- Files: `static/index.html` (rail, sheet, toc, `histTop`), `static/learn.css`.
- Verify: nav-type invariant at all six sizes in Chromium and WebKit; keyboard test still reaches every destination; z-index/elevation rule (dock highest) unchanged.
- Risk: the hover-open History sheet and sticky-hover rules (CLAUDE.md) must be preserved on touch devices.

**Step 8: canonical layouts (list-detail, supporting pane). needs strong model.** Reason: new page structure and state handling.
- Anki page: list-detail at expanded/large (card list left, preview/edit pane right); sheet at compact/medium. Kamus: results with supporting pane (history/quick look/contents) at expanded/large. Learn/Affixes: lesson list + content at expanded/large.
- Files: `static/index.html` (Anki view, csheet/qsheet), `static/learn.js`/`learn.css`.
- Verify: flow tests from Step 4 still pass at every size; no overlapping fixed elements; screenshot baselines reviewed by a person before acceptance.
- Risk: the edit sheet and the quick-look sheet are currently both right-side overlays; reusing the pane must not break `closeCard`/`closeQuick` logic.

**Step 9: Expressive styling pass. needs strong model.** Reason: a design interpretation with taste and with the elevation/colour rules in CLAUDE.md.
- Bolder type scale (display/headline/title with heavier weights), more varied shapes (shape tokens beyond the current s/m/l/xl; shape morphing on active nav indicator and on pressed buttons), stronger active indicator (taller/pill with colour fill), spring-style motion via `linear()` easing curves or the Web Animations API, respecting `prefers-reduced-motion`. Keep the elevation rule.
- Files: `static/index.html` (tokens, components), `static/theme.js` only if new colour roles are needed.
- Verify: reduced-motion test (Step 3) still green; axe contrast still green for light and dark and for non-default seed colours (test at least purple, teal, red seeds); screenshot review.
- Risk: see section 5 (Expressive on the web is thinly specified).

**Step 10: fix the baselined violations from Steps 2-3. any model.** Reason: each item is a specific, test-backed defect.
- Work through the baseline file: target sizes, contrast, labels, focus visibility. Remove entries as they are fixed; CI fails if the baseline grows.
- Verify: baseline shrinks to empty (or to documented exceptions).

### Track 3: code quality

**Step 11: more tests around lookup and Anki sync, before any split. needs strong model.** Reason: the logic lives inside `index.html` and must first be made testable without changing behaviour.
- Add tests (Playwright with mocked network + a mock AnkiConnect, as `mock_anki.py` did earlier but committed under `tests/`): lookup for each definition source, fallback to base word, derived-word path, offline cache, card create/edit/delete, Sync, Import from Anki, desync badge, backup/restore.
- Files: `tests/e2e/lookup.e2e.js`, `tests/e2e/anki.e2e.js`, `tests/helpers/mock-anki.*`, fixtures.
- Verify: tests pass on the unchanged code; mutate the code on purpose (e.g. break `reportCards`) to confirm they fail.
- Risk: real Anki still not testable here (section 6).

**Step 12: ESLint and a type check on the existing JS. any model.** Reason: configuration plus mechanical fixes; verified by CI.
- Add ESLint (flat config) for `static/*.js` and `tests/`, and `tsc --checkJs` with JSDoc types on the already-separate modules (`cards-store.js`, `sync.js`, `srs.js`, `stemmer.js`, `apkg.js`). Start with warnings; make errors fail CI once clean.
- Files: `eslint.config.js`, `tsconfig.json`, `package.json`, CI, `credits.json`.
- Verify: `npm run lint` and `npm run typecheck` pass locally and in CI.

**Step 13: split `index.html` into modules (Vite + TypeScript). needs strong model.** Reason: a large refactor of a 2000-line file with globals, load-order assumptions and inline handlers; it needs deliberate sequencing.
- Approach: extract in this order, each in its own commit with tests green: CSS to `styles/*.css`; pure helpers; storage (`idb`); sources (Wiktionary, Tatoeba, translate); TTS; Anki bridge; views (lookup, anki, settings, legal). Keep `window.*` shims until every consumer is migrated. Vite builds to `dist/`; `scripts/build_static.sh`, `set_base.py` (or Vite's `base`), the service worker's file list and `server.py`'s static routes must be updated together.
- Decision gate (owner decision): a build step is accepted ONLY for this split and only after the Step 11 tests exist and are green. `dist/` output must keep working for GitHub Pages, the sub-path build (`BASE=/kamus`) and server mode.
- Verify: all existing tests plus Step 11 tests green; bundle size compared before/after; the static build, the sub-path build and the server mode all load; PWA install and service worker still work (manual check).
- Risk: highest in the plan: load order, the service worker cache, COOP/COEP and worker URLs (`wd-worker.js`, `tr-worker.js` import from absolute paths), AGPL `SOURCE_URL`, and `scripts/fetch_vendor.sh` interaction.

### Track 4: real-user testing

**Step 14: usability test kit. any model.** Reason: document writing from a template; the content is specified below.
- Files: `docs/usability/test-script.md`, `docs/usability/feedback-form.md`, `docs/usability/sus.md`, `docs/usability/notes-template.md`.
- Contents: moderator script (consent, no-leading-questions wording, think-aloud instructions); five tasks (look up an unknown word and find its English meaning; make a flashcard from a meaning; do a spaced review of three cards; find and compare how Malay and Indonesian differ for one word; change the app to dark mode and install it on the home screen); success criteria and time per task; a note sheet (observations, quotes, errors, severity); SUS questionnaire (10 items, 1-5) with the scoring formula; a short free-text feedback form; guidance for 5 participants per device class.
- Verify: a dry run by the maintainer on one phone and one laptop; the scripts are revised from what was unclear.
- Cannot be automated: whether the app is understandable and pleasant, whether labels make sense to a learner, screen-reader experience with VoiceOver/TalkBack, and the SUS score itself. The automated tests only catch measurable proxies.

## 4. Suggested order and checkpoints

1 -> 2 -> 3 -> 4 -> 5 (harness and baselines), then checkpoint: you review the baseline report.
6 -> 7 -> 8 -> 9 -> 10 (layout and Expressive), checkpoint after 7 and after 9 with screenshots for you.
11 -> 12 (quality), checkpoint, then decide on 13 separately.
14 can run in parallel with anything once Step 8 is done.

## 5. Where Material 3 Expressive guidance for the web is thin (my interpretation)

- Expressive was introduced mainly for Android/Compose and Material Design 3 components in Figma; the official web components (`@material/web`) are no longer actively developed and do not ship the Expressive component set. There is no web spec to test "strict" compliance against.
- Window size classes and canonical layouts (list-detail, supporting pane) are well documented; I would follow those directly.
- For Expressive-specific items I would interpret from the published guidance rather than copy a spec: bolder emphasis type styles, larger and more varied corner shapes with shape morphing, spring-based motion (approximated with CSS `linear()` easing or Web Animations, since the web has no spring primitive), stronger selection indicators, and more colour contrast.
- I will say "interpreted" next to each such choice in `docs/` and in commit messages, and I cannot certify the result as "strictly" Expressive.

## 6. Decisions (owner, resolving the earlier open questions)

1. **Browsers:** Chromium and WebKit run the full suite; Firefox is a smoke run (layout invariants and axe only).
2. **Build step:** allowed only for the module split (Step 13), only after the Step 11 tests exist; `dist/` must keep working for GitHub Pages and the sub-path build.
3. **Screenshot baselines:** CI artifacts, not in the repo, at least at first; a small committed set (key views, three sizes) may be added later.
4. **Thumb reachability:** primary actions (search, navigation, Start review, speaker) in the lower 60% of a portrait phone or reachable from the bottom bar; a warning, not a failure.
5. **Contrast seeds:** default purple, teal and red in light and dark on every run; all `SEEDS` as a nightly job.
6. **History:** REVISED by the owner after trying it: History is a sheet at every size and hidden by default (no persistent pane). On phones it opens from a floating toolbar at the top right that also holds the contents button; from 600px it opens from the rail (hover or click).
7. **Target size:** 48px hard failure on `pointer: coarse`; 32px warning on `pointer: fine`.

Still open: nothing from the owner's list; new questions are added here as steps reveal them.

## 7. What I could not verify

- WebKit/Safari behaviour: Playwright's Linux WebKit is not Safari on macOS or iOS; several earlier bugs only appeared in the owner's Safari. The matrix reduces risk but does not replace a manual check on a real iPhone/Mac.
- Real Anki and the real Firebase service were never tested here (mock AnkiConnect and a fake cloud only).
- Whether the WebKit browser can be installed in the CI/local environment (not found in the local Playwright cache); Step 1 will confirm.
- Axe-core finds a subset of accessibility problems; the number of existing violations is unknown until Step 3 runs.
- The effect on PWA install and the service worker of Step 13 can only be fully checked on real devices over https.
- Exact effort per step; the sizes above are untested estimates, not measurements.
