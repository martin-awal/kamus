/* Learning pages for Kamus: spaced review (also on the home page), words of the day, Malay vs Indonesian, pronunciation practice (the Learn hub),
   and the affix lessons (own page). Everything runs in the browser; progress stays on this device (IndexedDB 'reviews' + localStorage 'kamus-learn').
   Uses the page's globals: esc, ico, say, speak, toast, go, getModel, mrender, blankOf, hintOf, fetchJSON, htmlText, KamusCards, KamusSrs, KamusStem. */
(function () {
  const $ = id => document.getElementById(id);
  const CFG_KEY = 'kamus-learn';
  const cfg = (() => { try { return { newPerDay: 10, newDate: '', newCount: 0, doneDate: '', done: 0, streak: 0, lastDay: '', known: [], pron: {}, affix: {}, ...JSON.parse(localStorage.getItem(CFG_KEY)) }; } catch (e) { return { newPerDay: 10, newDate: '', newCount: 0, doneDate: '', done: 0, streak: 0, lastDay: '', known: [], pron: {}, affix: {} }; } })();
  const save = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} };
  const today = () => KamusSrs.dayKey(Date.now());
  const newToday = () => (cfg.newDate === today() ? cfg.newCount : 0);
  const doneToday = () => (cfg.doneDate === today() ? cfg.done : 0);
  const shuffle = (a, rnd = Math.random) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a, n, rnd) => shuffle(a, rnd).slice(0, n);
  const mulberry = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const goWord = w => { location.hash = '#kamus'; q.value = w; fitIdle(); syncBtn(); go(w); };
  const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  const similarity = (a, b) => { a = a.toLowerCase().replace(/[^a-z]/g, ''); b = b.toLowerCase().replace(/[^a-z]/g, ''); return !a && !b ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length); };

  // ================= Spaced review =================
  async function reviewData() {
    const cards = await KamusCards.list(), ids = cards.map(c => c.id), states = (await KamusCards.reviewAll()).filter(s => ids.includes(s.id));
    return { cards, ids, states, sum: KamusSrs.summary(ids, states, Date.now(), { newLimit: cfg.newPerDay, newDoneToday: newToday() }) };
  }
  const REV = { open: false, q: [], byId: new Map(), states: new Map(), shown: false, face: 0, stats: { n: 0, good: 0 }, again: {}, total: 0 };
  let revDlg;
  function ensureDialog() {
    if (revDlg) return;
    revDlg = document.createElement('dialog'); revDlg.id = 'reviewDlg'; revDlg.className = 'mdialog rev'; revDlg.setAttribute('aria-labelledby', 'revTitle');
    revDlg.innerHTML = `<div class="mdialog-in"><div class="rev-head"><h2 id="revTitle">Review</h2><span class="muted" id="revCount"></span><span class="grow"></span><button type="button" class="icon-btn" id="revClose" aria-label="Close review">${ico('close')}</button></div><div id="revBody" class="rev-body"></div></div>`;
    document.body.appendChild(revDlg);
    $('revClose').onclick = () => revDlg.close();
    revDlg.addEventListener('close', () => { REV.open = false; try { stopSpeech(); } catch (e) {} refreshAll(); });
    revDlg.addEventListener('click', e => {
      const b = e.target.closest('[data-rev]'); if (!b) return;
      if (b.dataset.rev === 'show') showAnswer(); else if (b.dataset.rev === 'close') revDlg.close(); else gradeCurrent(b.dataset.rev);
    });
    revDlg.addEventListener('click', e => { const s = e.target.closest('[data-say]'); if (s) speak(s.dataset.say, s); });
    revDlg.addEventListener('keydown', e => {
      if (!REV.open || !REV.q.length) return;
      if (e.key === ' ' || e.key === 'Enter') { if (!REV.shown) { e.preventDefault(); showAnswer(); } }
      else if (REV.shown && '1234'.includes(e.key)) gradeCurrent(KamusSrs.GRADES[+e.key - 1]);
    });
  }
  async function faceFor(card, st) {   // which of the note's card types to ask now (rotates with every review; turned-off types are skipped)
    const m = await getModel(), f = card.fields;
    const pf = { ...f, ExampleBlank: blankOf(f.Example || '', f.Word || ''), Hint: hintOf(f.Word || 'x'), Audio: '[sound:x]', ExampleAudio: f.Example ? '[sound:x]' : '' };
    const ok = m.templates.map((t, i) => (!f['Skip' + (i + 1)] && mrender(t.Front, pf).replace(/<[^>]*>/g, '').trim() ? i : -1)).filter(i => i >= 0);
    const i = ok.length ? ok[(st.reps || 0) % ok.length] : 1;
    return { i, pf, name: m.templates[i].Name, front: mrender(m.templates[i].Front, pf), back: mrender(m.templates[i].Back, pf) };
  }
  async function startReview(opts = {}) {
    ensureDialog();
    const d = await reviewData();
    if (opts.all) { /* practise ahead: every card, oldest-due first */ }
    const qd = KamusSrs.queue(d.ids, d.states, Date.now(), { newLimit: opts.extraNew ? 999 : cfg.newPerDay, newDoneToday: opts.extraNew ? 0 : newToday() });
    const ids = [...qd.due, ...qd.fresh].slice(0, 30);
    REV.byId = new Map(d.cards.map(c => [c.id, c])); REV.states = new Map(d.states.map(s => [s.id, s]));
    REV.q = ids; REV.total = ids.length; REV.stats = { n: 0, good: 0 }; REV.again = {}; REV.open = true;
    if (!ids.length) { toast('Nothing to review right now.'); return; }
    if (!revDlg.open) revDlg.showModal();
    await nextCard();
  }
  async function nextCard() {
    const body = $('revBody'); $('revCount').textContent = REV.q.length ? `${REV.stats.n + 1} / ${REV.total + Object.values(REV.again).reduce((a, b) => a + b, 0)}` : '';
    if (!REV.q.length) return finishReview();
    const id = REV.q[0], card = REV.byId.get(id), st = REV.states.get(id) || KamusSrs.newState(id);
    const face = await faceFor(card, st); REV.face = face; REV.shown = false;
    body.innerHTML = `<div class="rev-kind muted">${esc(face.name)}${st.state === 'new' ? ' · new' : ''}</div><div class="acard rev-card" data-pane="front">${face.front}</div>
      <div class="rev-act"><button type="button" class="icon-btn lg" data-say="${esc(card.fields.Word)}" aria-label="Listen">${ico('vol')}</button><button type="button" class="btn-filled" data-rev="show">Show answer (Space)</button></div>`;
    revDlg.querySelector('[data-rev=show]').focus();
    if (/^4 /.test(face.name)) { const b = revDlg.querySelector('[data-say]'); try { speak(card.fields.Word, b); } catch (e) {} }   // listening card: play the word straight away
  }
  function showAnswer() {
    if (REV.shown) return; REV.shown = true;
    const id = REV.q[0], st = REV.states.get(id) || KamusSrs.newState(id), card = REV.byId.get(id), pv = KamusSrs.preview(st, Date.now());
    $('revBody').innerHTML = `<div class="rev-kind muted">${esc(REV.face.name)}</div><div class="acard rev-card" data-pane="back">${REV.face.back}</div>
      <div class="rev-act"><button type="button" class="icon-btn lg" data-say="${esc(card.fields.Word)}" aria-label="Listen">${ico('vol')}</button></div>
      <div class="rev-grades">${KamusSrs.GRADES.map((g, i) => `<button type="button" class="rev-g rev-${g}" data-rev="${g}"><span>${['Again', 'Hard', 'Good', 'Easy'][i]}</span><small>${pv[g]} · ${i + 1}</small></button>`).join('')}</div>`;
    revDlg.querySelector('[data-rev=good]').focus();
  }
  async function gradeCurrent(g) {
    if (!REV.shown) return;
    const id = REV.q.shift(), now = Date.now(), old = REV.states.get(id) || KamusSrs.newState(id), ns = KamusSrs.grade(old, g, now);
    await KamusCards.reviewPut(ns); REV.states.set(id, ns);
    if (old.state === 'new') { cfg.newDate = today(); cfg.newCount = newToday() + 1; }
    cfg.doneDate = today(); cfg.done = doneToday() + 1; save();
    REV.stats.n++; if (g === 'good' || g === 'easy') REV.stats.good++;
    if (ns.state === 'learning' && (REV.again[id] || 0) < 3) { REV.again[id] = (REV.again[id] || 0) + 1; REV.q.splice(Math.min(REV.q.length, 3), 0, id); }   // see it again in this session
    await nextCard();
  }
  function finishReview() {
    const t = today(), yest = KamusSrs.dayKey(Date.now() - KamusSrs.DAY);
    if (cfg.lastDay !== t) { cfg.streak = cfg.lastDay === yest ? cfg.streak + 1 : 1; cfg.lastDay = t; save(); }
    const next = [...REV.states.values()].filter(s => s.state !== 'new' && s.due > Date.now()).map(s => s.due).sort((a, b) => a - b)[0];
    const pct = REV.stats.n ? Math.round(100 * REV.stats.good / REV.stats.n) : 0;
    $('revCount').textContent = '';
    $('revBody').innerHTML = `<div class="rev-done"><h3>Done for now</h3><p>${REV.stats.n} answer${REV.stats.n === 1 ? '' : 's'} · ${pct}% good or easy</p><p class="muted">Streak: ${cfg.streak} day${cfg.streak === 1 ? '' : 's'}${next ? ` · next card in ${KamusSrs.fmt(next - Date.now())}` : ''}</p>
      <div class="rev-act"><button type="button" class="btn-filled" data-rev="close">Close</button></div></div>`;
  }

  // ================= Words of the day =================
  async function dailyWords(n = 5) {
    const have = new Set((await KamusCards.list()).map(c => c.word.toLowerCase())), known = new Set(cfg.known);
    const pool = window.KAMUS_CORE.filter(x => !have.has(x.w) && !known.has(x.w));
    return pick(pool, n, mulberry(hash(today())));
  }
  const POS = { v: 'verb', n: 'noun', adj: 'adjective', adv: 'adverb', pron: 'pronoun', prep: 'preposition', conj: 'conjunction', num: 'number', part: 'particle' };
  // audio | word (a link: looks it up) · part of speech · meaning || I know it · [->] (the primary button also looks it up)
  const wordRow = w => `<li class="dw"><button type="button" class="icon-btn sm" data-say="${esc(w.w)}" aria-label="Listen: ${esc(w.w)}">${ico('vol')}</button>
    <div class="dw-main"><a href="#kamus" class="dw-w" lang="id" data-lw="${esc(w.w)}">${esc(w.w)}</a> <span class="pos">${esc(POS[w.p] || w.p)}</span> <span class="dw-g" lang="en">${esc(w.g)}</span></div>
    <div class="dw-act"><button type="button" class="text-btn" data-know="${esc(w.w)}" title="Do not offer this word again">I know it</button><button type="button" class="icon-btn go" data-lw="${esc(w.w)}" aria-label="Look up ${esc(w.w)}" title="Look up">${ico('arrow')}</button></div></li>`;

  // ================= Home page (Kamus) =================
  async function renderHome() {
    const el = $('homeLearn'); if (!el) return;
    const d = await reviewData(), words = await dailyWords(3), s = d.sum;
    const rev = !d.cards.length ? `<p class="muted">Make cards from the words you look up (the + button), then review them here.</p>`
      : `<p><b>${s.due}</b> due · <b>${s.fresh}</b> new today</p><p><button type="button" class="btn-filled" data-hl="review" ${s.due + s.fresh ? '' : 'disabled'}>${s.due + s.fresh ? 'Start review' : 'All done for now'}</button></p>`;
    el.innerHTML = `<div class="home-tiles"><section class="home-tile"><h3>Review</h3>${rev}${cfg.streak ? `<p class="muted">Streak: ${cfg.streak} day${cfg.streak === 1 ? '' : 's'}</p>` : ''}</section>
      <section class="home-tile"><h3>Words of the day</h3><ul class="dw-list">${words.map(wordRow).join('') || '<li class="muted">You know them all!</li>'}</ul></section></div>
      <p class="home-more"><a href="#learn">Open the Learn page</a> · <a href="#affixes">Affix lessons</a></p>`;
  }

  // ================= Learn hub =================
  function hubHtml(d, words) {
    const s = d.sum;
    return `<section class="card" id="lh-review"><h3>Review</h3>
      ${!d.cards.length ? '<p class="muted">You have no cards yet. Look up a word and press + to make one, then it shows up here for spaced review.</p>' :
        `<div class="stats"><div><b>${s.due}</b><span>due now</span></div><div><b>${s.fresh}</b><span>new today</span></div><div><b>${s.learning}</b><span>learning</span></div><div><b>${s.mature}</b><span>well known</span></div><div><b>${cfg.streak}</b><span>day streak</span></div></div>
         <p class="muted">${doneToday()} answer${doneToday() === 1 ? '' : 's'} today. This review is Kamus' own schedule; Anki keeps its own.</p>
         <p><button type="button" class="btn-filled" data-hl="review" ${s.due + s.fresh ? '' : 'disabled'}>Start review</button> <button type="button" class="text-btn" data-hl="more" ${s.newTotal > s.fresh ? '' : 'disabled'}>Learn more new cards</button></p>`}
      <label class="fld inline"><span>New cards per day</span><input type="number" id="newPerDay" min="0" max="50" value="${cfg.newPerDay}" aria-label="New cards per day"></label></section>
    <section class="card" id="lh-words"><h3>Words of the day</h3><p class="muted">Five everyday words a day, chosen for today. Words you already have as cards are left out.</p>
      <ul class="dw-list">${words.map(wordRow).join('') || '<li class="muted">You know every word on the list. Come back after a lookup or two.</li>'}</ul></section>
    <section class="card" id="lh-malay"><h3>Malay vs Indonesian</h3><p class="muted">Type a word to see how Wiktionary describes it in Indonesian and in Malay, or browse the usual differences.</p>
      <form class="cmp-form" id="cmpForm"><label class="fld grow"><input id="cmpIn" placeholder="e.g. kereta" aria-label="Word to compare" autocomplete="off" autocapitalize="off" spellcheck="false"></label><button class="btn-tonal" type="submit">Compare</button></form>
      <div id="cmpOut"></div>
      <h4 class="sub">Common differences</h4>
      <div class="chips" id="cmpChips">${[['all', 'All'], ['word', 'Different word'], ['false', 'False friends'], ['spelling', 'Spelling'], ['tech', 'Technology']].map(([k, l], i) => `<button type="button" class="vchip ${i ? '' : 'on'}" data-cmpf="${k}">${l}</button>`).join('')}</div>
      <div id="cmpList"></div>
      <p><button type="button" class="btn-tonal" data-hl="malayquiz">Quick quiz</button></p><div id="cmpQuiz"></div>
      <h4 class="sub">Good to know</h4><ul class="notes">${window.KAMUS_MALAY.notes.map(n => `<li><b>${esc(n.t)}.</b> ${esc(n.d)}</li>`).join('')}</ul></section>
    <section class="card" id="lh-pron"><h3>Pronunciation practice</h3><p class="muted">Pick a sound, listen, record yourself and listen back. Where the browser can understand Indonesian speech it also tells you what it heard.</p>
      <div class="chips" id="pronChips">${window.KAMUS_DRILLS.map((x, i) => `<button type="button" class="vchip ${i ? '' : 'on'}" data-drill="${x.id}">${esc(x.sound.split('  ')[0])}</button>`).join('')}</div>
      <div id="pronBox"></div></section>
    <section class="card"><h3>Affix lessons</h3><p class="muted">ber-, meN-, di-, ter-, peN-, -an, -kan, -i, ke-…-an and more, with exercises.</p><p><a class="btn-tonal as-btn" href="#affixes">Open the lessons</a></p></section>`;
  }
  let hubReady = false;
  async function renderHub() {
    const root = $('learnRoot'); if (!root) return;
    const d = await reviewData(), words = await dailyWords(5);
    root.innerHTML = hubHtml(d, words); renderCmpList('all'); renderPron(window.KAMUS_DRILLS[0].id);
    if (!hubReady) { hubReady = true; wireHub(root); }
  }
  function refreshAll() { if (document.body.dataset.view === 'learn') renderHub(); else if (document.body.dataset.view === 'kamus') renderHome(); }

  // ---- Malay vs Indonesian
  let cmpAll = false;
  function renderCmpList(kind) {
    const every = window.KAMUS_MALAY.pairs.filter(p => kind === 'all' || p.kind === kind), rows = kind === 'all' && !cmpAll ? every.slice(0, 12) : every;   // the full list only on request, so the page stays short
    $('cmpList').innerHTML = `<div class="tablewrap"><table class="cmp"><thead><tr><th>Indonesian</th><th>Malay (Malaysia)</th><th>English</th></tr></thead><tbody>${rows.map((p, i) => `<tr data-cmprow="${i}" class="${p.kind === 'false' ? 'ff' : ''}"><td lang="id"><b>${esc(p.id)}</b></td><td lang="ms">${esc(p.my)}</td><td lang="en">${esc(p.en)}${p.note ? `<div class="cmp-note">${esc(p.note)}</div>` : ''}${p.kind === 'false' ? ' <span class="badge warn">false friend</span>' : ''}</td></tr>`).join('')}</tbody></table></div>${every.length > rows.length ? `<p><button type="button" class="text-btn" data-cmpall>Show all ${every.length}</button></p>` : ''}`;
  }
  async function compareWord(raw) {
    const w = raw.trim().toLowerCase(), box = $('cmpOut'); if (!w) { box.innerHTML = ''; return; }
    box.innerHTML = '<p class="muted">Looking up…</p>';
    let j = null; try { j = await fetchJSON(WIKI_REST + encodeURIComponent(w)); } catch (e) { box.innerHTML = '<p class="sync-err">Wiktionary could not be reached.</p>'; return; }
    const defs = k => ((j && j[k]) || []).flatMap(b => (b.definitions || []).map(d => ({ pos: (b.partOfSpeech || '').toLowerCase(), gloss: htmlText(d.definition) }))).filter(x => x.gloss).slice(0, 5);
    const col = (title, lang, list) => `<div class="cmp-col"><h5>${title}</h5>${list.length ? `<ol>${list.map(x => `<li><span class="pos">${esc(x.pos)}</span> <span lang="en">${esc(x.gloss)}</span></li>`).join('')}</ol>` : `<p class="muted">No ${lang} entry for “${esc(w)}” on English Wiktionary.</p>`}</div>`;
    const hit = window.KAMUS_MALAY.pairs.find(p => [p.id, p.my].some(x => x.split(' / ').some(y => y.toLowerCase() === w)));
    box.innerHTML = `<div class="cmp-cols">${col('Indonesian', 'Indonesian', defs('id'))}${col('Malay', 'Malay', defs('ms'))}</div>
      ${hit ? `<div class="snack">${ico('info')}<span><b>${esc(hit.id)}</b> (Indonesian) = <b>${esc(hit.my)}</b> (Malay): ${esc(hit.en)}.${hit.note ? ' ' + esc(hit.note) : ''}</span></div>` : ''}
      <p class="src"><a href="https://en.wiktionary.org/wiki/${encodeURIComponent(w)}" target="_blank" rel="noopener">English Wiktionary</a> · CC BY-SA</p>`;
  }
  function malayQuiz() {
    const pairs = window.KAMUS_MALAY.pairs.filter(p => p.kind !== 'spelling'), qs = pick(pairs, 5), box = $('cmpQuiz'); let i = 0, score = 0;
    const show = () => {
      if (i >= qs.length) { box.innerHTML = `<div class="quiz"><b>${score} / ${qs.length}</b> ${score === qs.length ? 'Perfect!' : 'Keep going: try again for a new set.'}</div>`; return; }
      const p = qs[i], toMY = i % 2 === 0, answer = toMY ? p.my : p.id, others = pick(window.KAMUS_MALAY.pairs.filter(x => (toMY ? x.my : x.id) !== answer), 3).map(x => toMY ? x.my : x.id);
      box.innerHTML = `<div class="quiz"><p>${i + 1}/${qs.length} · How do ${toMY ? 'Malaysians' : 'Indonesians'} say <b>${esc(p.en)}</b>?</p><div class="choices">${shuffle([answer, ...others]).map(c => `<button type="button" class="choice" data-ans="${esc(c)}">${esc(c)}</button>`).join('')}</div><p class="muted" id="qzFb"></p></div>`;
      box.querySelectorAll('.choice').forEach(b => b.onclick = () => {
        const ok = b.dataset.ans === answer; if (ok) score++;
        box.querySelectorAll('.choice').forEach(x => { x.disabled = true; if (x.dataset.ans === answer) x.classList.add('ok'); });
        if (!ok) b.classList.add('bad');
        $('qzFb').innerHTML = (ok ? 'Right. ' : `The answer is <b>${esc(answer)}</b>. `) + esc(p.note || '') + ` <button type="button" class="text-btn" id="qzNext">Next</button>`;
        $('qzNext').onclick = () => { i++; show(); };
      });
    };
    show();
  }

  // ---- Pronunciation practice
  const PR = { drill: null, word: null, mr: null, stream: null, recog: null, heard: [], url: '', raf: 0, timer: 0 };
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function renderPron(id, keepWord) {
    const dr = window.KAMUS_DRILLS.find(x => x.id === id); PR.drill = dr; PR.word = keepWord && dr.words.includes(keepWord) ? keepWord : dr.words[0];
    document.querySelectorAll('#pronChips .vchip').forEach(b => b.classList.toggle('on', b.dataset.drill === id));
    $('pronBox').innerHTML = `<div class="pron-sound"><b>${esc(dr.sound)}</b><p>${esc(dr.tip)}</p></div>
      <div class="chips" id="pronWords">${dr.words.map(w => `<button type="button" class="vchip ${w === PR.word ? 'on' : ''}" data-pw="${esc(w)}">${esc(w)}${cfg.pron[w] === 'good' ? ' ✓' : ''}</button>`).join('')}</div>
      <div id="pronStage"></div>`;
    renderStage();
  }
  function renderStage() {
    const w = PR.word, can = window.isSecureContext && navigator.mediaDevices && window.MediaRecorder;
    $('pronStage').innerHTML = `<div class="pron-word" lang="id">${esc(w)}</div>
      <div class="pron-act"><button type="button" class="btn-tonal" data-say="${esc(w)}">${ico('vol')} Listen</button>
        <button type="button" class="btn-filled" id="recBtn" ${can ? '' : 'disabled'}>${ico('mic')} <span id="recLbl">Record</span></button></div>
      <canvas id="meter" class="meter" width="300" height="10" aria-hidden="true"></canvas>
      <div id="pronRes" class="pron-res">${can ? '' : '<p class="muted">Recording needs a secure address (https or localhost) and a browser with microphone recording.</p>'}</div>`;
  }
  async function toggleRecord() {
    if (PR.mr && PR.mr.state === 'recording') { PR.mr.stop(); return; }
    const res = $('pronRes'); res.innerHTML = '';
    try { PR.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { res.innerHTML = `<p class="sync-err">${e.name === 'NotAllowedError' ? 'The microphone is blocked: allow it for this page and try again.' : 'No microphone found.'}</p>`; return; }
    const chunks = []; PR.heard = []; PR.mr = new MediaRecorder(PR.stream);
    PR.mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    PR.mr.onstop = () => {
      clearTimeout(PR.timer); cancelAnimationFrame(PR.raf); if (PR.recog) { try { PR.recog.stop(); } catch (e) {} }
      PR.stream.getTracks().forEach(t => t.stop()); $('recLbl').textContent = 'Record';
      const blob = new Blob(chunks, { type: PR.mr.mimeType || 'audio/webm' }); if (PR.url) URL.revokeObjectURL(PR.url); PR.url = URL.createObjectURL(blob);
      setTimeout(showResult, 450);   // let the recogniser deliver its last result
    };
    $('recLbl').textContent = 'Stop'; PR.mr.start(); PR.timer = setTimeout(() => PR.mr.state === 'recording' && PR.mr.stop(), 6000);
    meter(PR.stream);
    if (SR) { try { PR.recog = new SR(); PR.recog.lang = 'id-ID'; PR.recog.maxAlternatives = 3; PR.recog.interimResults = false; PR.recog.onresult = ev => { PR.heard = [...ev.results[0]].map(a => a.transcript); }; PR.recog.onerror = () => {}; PR.recog.start(); } catch (e) { PR.recog = null; } }
  }
  function meter(stream) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)(), an = ac.createAnalyser(), src = ac.createMediaStreamSource(stream), buf = new Uint8Array(an.fftSize); an.fftSize = 512; src.connect(an);
      const cv = $('meter'), cx = cv && cv.getContext('2d');
      const draw = () => { if (!cv || !PR.mr || PR.mr.state !== 'recording') { ac.close().catch(() => {}); if (cx) cx.clearRect(0, 0, 300, 10); return; }
        an.getByteTimeDomainData(buf); let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128)); cx.clearRect(0, 0, 300, 10); cx.fillStyle = getComputedStyle(document.body).getPropertyValue('--primary') || '#6750a4'; cx.fillRect(0, 0, Math.min(300, peak * 4.5), 10); PR.raf = requestAnimationFrame(draw); };
      draw();
    } catch (e) {}
  }
  function showResult() {
    const w = PR.word; let heardHtml = '';
    if (SR) {
      const best = PR.heard.length ? PR.heard.map(h => ({ h, s: similarity(h, w) })).sort((a, b) => b.s - a.s)[0] : null;
      heardHtml = best ? `<p>I heard: <b>${esc(best.h)}</b> · match ${Math.round(best.s * 100)}%${best.s >= 0.99 ? ' 🎉' : best.s >= 0.7 ? ' (close)' : ' (try again slowly)'}</p>` : '<p class="muted">The browser did not catch any words: try again a little louder and slower.</p>';
    } else heardHtml = '<p class="muted">This browser cannot check what you said: compare the two recordings by ear.</p>';
    $('pronRes').innerHTML = `${heardHtml}<p class="pron-cmp"><span>You:</span> <audio controls src="${PR.url}"></audio></p><p class="muted">Then listen to the voice again and compare. How was it?</p>
      <p><button type="button" class="text-btn" data-rate="good">Sounded right</button> <button type="button" class="text-btn" data-rate="more">Needs more practice</button></p>`;
  }

  // ================= Affix lessons =================
  const AF = { lesson: window.KAMUS_AFFIXES[0].id, ex: null };
  const lessonById = id => window.KAMUS_AFFIXES.find(l => l.id === id);
  const chipsHtml = () => `<div class="chips" id="afChips">${window.KAMUS_AFFIXES.map(l => `<button type="button" class="vchip ${l.id === AF.lesson ? 'on' : ''}" data-lesson="${l.id}">${esc(l.title)}${cfg.affix[l.id] ? ' · ' + cfg.affix[l.id].best + '/10' : ''}</button>`).join('')}</div>`;
  function affixHtml() {
    const L = lessonById(AF.lesson);
    return `<section class="card">${chipsHtml()}</section>
      <section class="card"><h3>${esc(L.title)} <small class="muted">${esc(L.form)}</small></h3><p>${esc(L.lead)}</p>
        <div class="tablewrap"><table class="cmp"><thead><tr><th>When</th><th>Form</th><th>Example</th></tr></thead><tbody>${L.rules.map(r => `<tr><td>${esc(r[0])}</td><td><b>${esc(r[1])}</b></td><td lang="id">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>
        <p class="af-tip">${ico('info')}<span>${esc(L.tip)}</span></p>
        <h4 class="sub">Examples</h4><ul class="dw-list">${L.examples.map(e => `<li class="dw"><button type="button" class="icon-btn sm" data-say="${esc(e.word)}" aria-label="Listen: ${esc(e.word)}">${ico('vol')}</button><div class="dw-main"><a href="#kamus" class="dw-w" lang="id" data-lw="${esc(e.word)}">${esc(e.word)}</a> <span class="muted">= ${esc(e.root)} + ${esc(L.title.replace(/…/g, ''))}</span> <span class="dw-g" lang="en">${esc(e.gloss)}</span></div><div class="dw-act"><button type="button" class="icon-btn go" data-lw="${esc(e.word)}" aria-label="Look up ${esc(e.word)}" title="Look up">${ico('arrow')}</button></div></li>`).join('')}</ul></section>
      <section class="card"><h3>Practise</h3><p class="muted">Ten questions: build the word, or find the root.</p><p><button type="button" class="btn-filled" data-af="start">Practise ${esc(L.title)}</button> <button type="button" class="text-btn" data-af="mix">Mix of all lessons</button></p><div id="afQuiz"></div></section>
      <section class="card"><h3>Your own words</h3><p class="muted">Finds affixed words in your cards and search history and takes them apart.</p><p><button type="button" class="btn-tonal" data-af="mine">Analyse my words</button></p><div id="afMine"></div></section>`;
  }
  function makeQuestions(lessons, n = 10) {
    const all = lessons.flatMap(l => l.examples.map(e => ({ l, e }))), qs = [];
    const order = []; while (order.length < n) order.push(...shuffle(all));   // a short lesson repeats its examples (in a new order and as the other question type) rather than asking fewer questions
    for (const { l, e } of order.slice(0, n)) {
      if (qs.length % 2 === 0) {   // build: root + affix -> which word?
        const wrong = pick(l.alt.map(t => t.replace('{r}', e.root)).filter(x => x !== e.word && x !== e.root), 3);
        qs.push({ kind: 'build', prompt: `${e.root} + ${l.title}`, hint: e.gloss, answer: e.word, choices: shuffle([e.word, ...wrong]), why: `${e.word} = ${e.root} + ${l.title} (${e.gloss})` });
      } else {   // break: which root?
        const wrong = pick(all.map(x => x.e.root).filter(r => r !== e.root), 3);
        qs.push({ kind: 'break', prompt: e.word, hint: e.gloss, answer: e.root, choices: shuffle([e.root, ...new Set(wrong)]), why: `${e.word} = ${e.root} + ${l.title}` });
      }
    }
    return qs;
  }
  function runQuiz(lessons, lessonId) {
    const qs = makeQuestions(lessons), box = $('afQuiz'); let i = 0, score = 0;
    const show = () => {
      if (i >= qs.length) {
        if (lessonId) { const b = cfg.affix[lessonId] || { best: 0 }; cfg.affix[lessonId] = { best: Math.max(b.best, score) }; save(); }
        box.innerHTML = `<div class="quiz"><b>${score} / ${qs.length}</b> ${score >= 9 ? 'Excellent!' : score >= 6 ? 'Good, once more for the rest.' : 'Read the lesson again, then retry.'}</div>`; if (lessonId) $('afChips').outerHTML = chipsHtml(); return;
      }
      const x = qs[i];
      box.innerHTML = `<div class="quiz"><p>${i + 1}/${qs.length} · ${x.kind === 'build' ? 'Which word is' : 'What is the root of'} <b lang="id">${esc(x.prompt)}</b>?</p><p class="muted">${esc(x.hint)}</p><div class="choices">${x.choices.map(c => `<button type="button" class="choice" data-ans="${esc(c)}" lang="id">${esc(c)}</button>`).join('')}</div><p class="muted" id="afFb"></p></div>`;
      box.querySelectorAll('.choice').forEach(b => b.onclick = () => {
        const ok = b.dataset.ans === x.answer; if (ok) score++;
        box.querySelectorAll('.choice').forEach(c => { c.disabled = true; if (c.dataset.ans === x.answer) c.classList.add('ok'); }); if (!ok) b.classList.add('bad');
        $('afFb').innerHTML = (ok ? 'Right. ' : 'Not quite. ') + esc(x.why) + ' <button type="button" class="text-btn" id="afNext">Next</button>'; $('afNext').onclick = () => { i++; show(); };
      });
    };
    show();
  }
  async function analyseMine() {
    const box = $('afMine');
    if (!KamusStem.hasWordlist()) { box.innerHTML = '<p class="muted">The word list is not loaded yet (Settings → Storage → Word list).</p>'; return; }
    const words = new Set([...(await KamusCards.list()).map(c => c.word.toLowerCase()), ...hist().map(h => h.w.toLowerCase())]);
    const rows = [...words].map(w => ({ w, a: KamusStem.analyze(w) })).filter(x => x.a).sort((a, b) => a.w.localeCompare(b.w));
    box.innerHTML = rows.length ? `<ul class="dw-list">${rows.map(r => `<li class="dw"><button type="button" class="icon-btn sm" data-say="${esc(r.w)}" aria-label="Listen: ${esc(r.w)}">${ico('vol')}</button><div class="dw-main"><a href="#kamus" class="dw-w" lang="id" data-lw="${esc(r.w)}">${esc(r.w)}</a> <span class="muted">= ${esc(KamusStem.describe(r.a))}</span></div><div class="dw-act"><button type="button" class="icon-btn go" data-lw="${esc(r.w)}" aria-label="Look up ${esc(r.w)}" title="Look up">${ico('arrow')}</button></div></li>`).join('')}</ul>` : `<p class="muted">None of your ${words.size} words has an affix that I can take apart. Look up a few derived words (berlari, dimakan, kesehatan) and try again.</p>`;
  }
  function renderAffix() { const r = $('affixRoot'); if (r) r.innerHTML = affixHtml(); }

  // ================= wiring =================
  function wireHub(root) {
    root.addEventListener('click', e => {
      const t = e.target;
      let b;
      if ((b = t.closest('[data-hl]'))) { const k = b.dataset.hl; if (k === 'review') startReview(); else if (k === 'more') startReview({ extraNew: true }); else if (k === 'malayquiz') malayQuiz(); }
      else if (t.closest('[data-cmpall]')) { cmpAll = true; renderCmpList('all'); }
      else if ((b = t.closest('[data-cmpf]'))) { document.querySelectorAll('#cmpChips .vchip').forEach(x => x.classList.toggle('on', x === b)); renderCmpList(b.dataset.cmpf); }
      else if ((b = t.closest('[data-drill]'))) renderPron(b.dataset.drill);
      else if ((b = t.closest('[data-pw]'))) { PR.word = b.dataset.pw; document.querySelectorAll('#pronWords .vchip').forEach(x => x.classList.toggle('on', x === b)); renderStage(); }
      else if (t.closest('#recBtn')) toggleRecord();
      else if ((b = t.closest('[data-rate]'))) { cfg.pron[PR.word] = b.dataset.rate === 'good' ? 'good' : 'more'; save(); toast(b.dataset.rate === 'good' ? 'Marked as good.' : 'Marked for more practice.'); renderPron(PR.drill.id, PR.word); }
    });
    root.addEventListener('submit', e => { if (e.target.id === 'cmpForm') { e.preventDefault(); compareWord($('cmpIn').value); } });
    root.addEventListener('change', e => { if (e.target.id === 'newPerDay') { cfg.newPerDay = Math.max(0, Math.min(50, +e.target.value || 0)); save(); renderHub(); } });
  }
  function wireCommon() {
    document.addEventListener('click', e => {   // buttons that appear on several pages (home, hub, affix page)
      const t = e.target; let b;
      if ((b = t.closest('[data-lw]')) && (t.closest('#learnRoot, #affixRoot, #homeLearn'))) { e.preventDefault(); goWord(b.dataset.lw); }
      else if ((b = t.closest('[data-say]')) && t.closest('#learnRoot, #affixRoot, #homeLearn')) speak(b.dataset.say, b);
      else if ((b = t.closest('[data-know]'))) { cfg.known = [...new Set([...cfg.known, b.dataset.know])]; save(); refreshAll(); }
      else if ((b = t.closest('[data-hl=review]')) && t.closest('#homeLearn')) startReview();
    });
    $('affixRoot').addEventListener('click', e => {
      const t = e.target; let b;
      if ((b = t.closest('[data-lesson]'))) { AF.lesson = b.dataset.lesson; renderAffix(); }
      else if ((b = t.closest('[data-af]'))) { const k = b.dataset.af; if (k === 'start') runQuiz([lessonById(AF.lesson)], AF.lesson); else if (k === 'mix') runQuiz(window.KAMUS_AFFIXES); else if (k === 'mine') analyseMine(); }
    });
  }
  function enter(view) { if (view === 'learn') renderHub(); else if (view === 'affix') renderAffix(); else if (view === 'kamus') renderHome(); }
  function init() { wireCommon(); }
  window.KamusLearn = { init, enter, renderHome, startReview, dailyWords, similarity, makeQuestions, mulberry, hash, _cfg: cfg };
})();
