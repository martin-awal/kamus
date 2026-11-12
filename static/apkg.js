/* Builds an Anki .apkg (a zip of an SQLite collection + media) in the browser with sql.js and JSZip.
   A port of what genanki wrote on the server. Not tested against real Anki; checked by re-reading the file with Python's sqlite3. */
(function () {
  const SCHEMA = "CREATE TABLE col (\n    id              integer primary key,\n    crt             integer not null,\n    mod             integer not null,\n    scm             integer not null,\n    ver             integer not null,\n    dty             integer not null,\n    usn             integer not null,\n    ls              integer not null,\n    conf            text not null,\n    models          text not null,\n    decks           text not null,\n    dconf           text not null,\n    tags            text not null\n);\nCREATE TABLE notes (\n    id              integer primary key,   /* 0 */\n    guid            text not null,         /* 1 */\n    mid             integer not null,      /* 2 */\n    mod             integer not null,      /* 3 */\n    usn             integer not null,      /* 4 */\n    tags            text not null,         /* 5 */\n    flds            text not null,         /* 6 */\n    sfld            integer not null,      /* 7 */\n    csum            integer not null,      /* 8 */\n    flags           integer not null,      /* 9 */\n    data            text not null          /* 10 */\n);\nCREATE TABLE cards (\n    id              integer primary key,   /* 0 */\n    nid             integer not null,      /* 1 */\n    did             integer not null,      /* 2 */\n    ord             integer not null,      /* 3 */\n    mod             integer not null,      /* 4 */\n    usn             integer not null,      /* 5 */\n    type            integer not null,      /* 6 */\n    queue           integer not null,      /* 7 */\n    due             integer not null,      /* 8 */\n    ivl             integer not null,      /* 9 */\n    factor          integer not null,      /* 10 */\n    reps            integer not null,      /* 11 */\n    lapses          integer not null,      /* 12 */\n    left            integer not null,      /* 13 */\n    odue            integer not null,      /* 14 */\n    odid            integer not null,      /* 15 */\n    flags           integer not null,      /* 16 */\n    data            text not null          /* 17 */\n);\nCREATE TABLE revlog (\n    id              integer primary key,\n    cid             integer not null,\n    usn             integer not null,\n    ease            integer not null,\n    ivl             integer not null,\n    lastIvl         integer not null,\n    factor          integer not null,\n    time            integer not null,\n    type            integer not null\n);\nCREATE TABLE graves (\n    usn             integer not null,\n    oid             integer not null,\n    type            integer not null\n);\nCREATE INDEX ix_notes_usn on notes (usn);\nCREATE INDEX ix_cards_usn on cards (usn);\nCREATE INDEX ix_revlog_usn on revlog (usn);\nCREATE INDEX ix_cards_nid on cards (nid);\nCREATE INDEX ix_cards_sched on cards (did, queue, due);\nCREATE INDEX ix_revlog_cid on revlog (cid);\nCREATE INDEX ix_notes_csum on notes (csum);";
  const COL = {"crt": 1411124400, "mod": 1425279151694, "scm": 1425279151690, "ver": 11, "dty": 0, "usn": 0, "ls": 0, "conf": "{\n        \"activeDecks\": [\n            1\n        ],\n        \"addToCur\": true,\n        \"collapseTime\": 1200,\n        \"curDeck\": 1,\n        \"curModel\": \"1425279151691\",\n        \"dueCounts\": true,\n        \"estTimes\": true,\n        \"newBury\": true,\n        \"newSpread\": 0,\n        \"nextPos\": 1,\n        \"sortBackwards\": false,\n        \"sortType\": \"noteFld\",\n        \"timeLim\": 0\n    }", "dconf": "{\n        \"1\": {\n            \"autoplay\": true,\n            \"id\": 1,\n            \"lapse\": {\n                \"delays\": [\n                    10\n                ],\n                \"leechAction\": 0,\n                \"leechFails\": 8,\n                \"minInt\": 1,\n                \"mult\": 0\n            },\n            \"maxTaken\": 60,\n            \"mod\": 0,\n            \"name\": \"Default\",\n            \"new\": {\n                \"bury\": true,\n                \"delays\": [\n                    1,\n                    10\n                ],\n                \"initialFactor\": 2500,\n                \"ints\": [\n                    1,\n                    4,\n                    7\n                ],\n                \"order\": 1,\n                \"perDay\": 20,\n                \"separate\": true\n            },\n            \"replayq\": true,\n            \"rev\": {\n                \"bury\": true,\n                \"ease4\": 1.3,\n                \"fuzz\": 0.05,\n                \"ivlFct\": 1,\n                \"maxIvl\": 36500,\n                \"minSpace\": 1,\n                \"perDay\": 100\n            },\n            \"timer\": 0,\n            \"usn\": 0\n        }\n    }", "tags": "{}"};
  const MODEL_ID = 1607392319, DECK_ID = 2059400110;

  // --- the mustache subset Anki templates use here: {{Field}}, {{#Field}}..{{/Field}}, {{^Field}}..{{/Field}}
  function render(tpl, f) {
    let prev;
    do { prev = tpl; tpl = tpl.replace(/\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/g, (_, t, k, inner) => ((t === '#') === !!f[k]) ? inner : ''); } while (tpl !== prev);
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => f[k] || '');
  }
  const textOf = h => h.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, '');
  // genanki's "req" (a legacy hint Anki recomputes itself), except that SkipN fields never count as required
  function requirements(model) {
    const names = model.fields, isSkip = n => /^Skip\d$/.test(n), S = 'SeNtInEl', req = [];
    model.templates.forEach((t, ord) => {
      const need = [];
      names.forEach((n, i) => { if (isSkip(n)) return; const v = {}; names.forEach(m => { v[m] = isSkip(m) ? '' : S; }); v[n] = ''; if (!render(t.Front, v).includes(S)) need.push(i); });
      if (need.length) { req.push([ord, 'all', need]); return; }
      names.forEach((n, i) => { if (isSkip(n)) return; const v = {}; names.forEach(m => { v[m] = ''; }); v[n] = S; if (render(t.Front, v).includes(S)) need.push(i); });
      req.push([ord, 'any', need]);
    });
    return req;
  }
  const loaded = {};
  const loadScript = src => loaded[src] || (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('could not load ' + src)); document.head.appendChild(s); }));

  // build({cards, model, getAudio(text) -> Promise<{bytes, ext}|null>, onProgress(i, n)}) -> Blob (the .apkg)
  async function build({ cards, model, getAudio, onProgress }) {
    await Promise.all([loadScript('/vendor/apkg/sql-wasm.js'), loadScript('/vendor/apkg/jszip.min.js')]);
    const SQL = await initSqlJs({ locateFile: f => '/vendor/apkg/' + f });
    const K = window.KamusCards, ts = Date.now() / 1000, db = new SQL.Database();
    db.run(SCHEMA);
    const fields = model.fields.map((name, ord) => ({ name, ord, font: 'Liberation Sans', media: [], rtl: false, size: 20, sticky: false }));
    const tmpls = model.templates.map((t, ord) => ({ name: t.Name, qfmt: t.Front, afmt: t.Back, ord, bafmt: '', bqfmt: '', bfont: '', bsize: 0, did: null }));
    const modelJson = { css: model.css, did: DECK_ID, flds: fields, id: String(MODEL_ID), latexPost: '\\end{document}',
      latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
      latexsvg: false, mod: Math.floor(ts), name: model.name, req: requirements(model), sortf: 0, tags: [], tmpls, type: 0, usn: -1, vers: [] };
    const deckJson = { collapsed: false, conf: 1, desc: '', dyn: 0, extendNew: 0, extendRev: 50, id: DECK_ID, lrnToday: [163, 2], mod: 1425278051, name: model.deck,
      newToday: [163, 2], revToday: [163, 0], timeToday: [163, 23598], usn: -1 };
    db.run('INSERT INTO col VALUES(null,?,?,?,?,?,?,?,?,?,?,?,?)', [COL.crt, COL.mod, COL.scm, COL.ver, COL.dty, COL.usn, COL.ls, COL.conf,
      JSON.stringify({ [MODEL_ID]: modelJson }), JSON.stringify({ 1: { ...JSON.parse('{"collapsed":false,"conf":1,"desc":"","dyn":0,"extendNew":10,"extendRev":50,"id":1,"lrnToday":[0,0],"mod":1425279151,"name":"Default","newToday":[0,0],"revToday":[0,0],"timeToday":[0,0],"usn":0}') }, [DECK_ID]: deckJson }), COL.dconf, COL.tags]);

    // audio: one file per distinct text
    const media = [], mediaByText = new Map();
    async function sound(text) {
      if (!text || !getAudio) return '';
      if (mediaByText.has(text)) return mediaByText.get(text);
      let tag = '';
      try {
        const a = await getAudio(text);
        if (a && a.bytes && a.bytes.length > 500) { const name = 'kamus-' + K.sha1hex(text).slice(0, 12) + a.ext; media.push([name, a.bytes]); tag = `[sound:${name}]`; }
      } catch (e) {}
      mediaByText.set(text, tag); return tag;
    }
    let nextId = Math.floor(ts * 1000), made = 0, noAudio = 0;
    const nid = () => nextId++;
    for (let i = 0; i < cards.length; i++) {
      const f = { ...cards[i].fields };
      if (onProgress) onProgress(i + 1, cards.length);
      f.Audio = await sound(f.Word); f.ExampleAudio = f.Example ? await sound(f.Example) : '';
      if (!f.Audio) noAudio++;
      const vals = model.fields.map(n => f[n] || ''), noteId = nid();
      db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)', [noteId, K.ankiGuid(f.Index), MODEL_ID, Math.floor(ts), -1, ' kamus ', vals.join('\x1f'), vals[0],
        parseInt(K.sha1hex(vals[0].replace(/<[^>]*>/g, '')).slice(0, 8), 16), 0, '']);
      model.templates.forEach((t, ord) => {
        if (!textOf(render(t.Front, f))) return;   // an empty front = no card (a turned-off type, or a field it needs is empty)
        db.run('INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [nid(), noteId, DECK_ID, ord, Math.floor(ts), -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '']);
        made++;
      });
    }
    const zip = new JSZip();
    zip.file('collection.anki2', db.export());
    zip.file('media', JSON.stringify(Object.fromEntries(media.map(([n], i) => [i, n]))));
    media.forEach(([, bytes], i) => zip.file(String(i), bytes, { compression: 'STORE' }));
    db.close();
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    return { blob, notes: cards.length, cards: made, audio: media.length, noAudio };
  }
  window.KamusApkg = { build, render, requirements };
})();
