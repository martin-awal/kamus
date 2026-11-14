// Kamus with NO server: python's plain file server stands in for a static host. External services are mocked, so this runs offline.
// KAMUS_E2E_DIR=<folder to serve> KAMUS_BASE=/kamus  tests a build that lives in a sub-folder (see scripts/build_static.sh); by default it serves static/ at the root.
// Needs playwright (npm i --no-save playwright) and static/vendor (scripts/fetch_vendor.sh).   node tests/e2e/static-site.e2e.js
const { chromium } = require('playwright'), { spawn } = require('child_process'), fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..', '..'), PORT = 8801, BASE = process.env.KAMUS_BASE || '', APP = `http://127.0.0.1:${PORT}${BASE}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = n => fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', n), 'utf8');

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', process.env.KAMUS_E2E_DIR || path.join(ROOT, 'static')], { stdio: 'ignore' });
  await sleep(1200);
  const browser = await chromium.launch(), errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } }), page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const json = body => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
    await page.route(/id\.wiktionary\.org\/w\/api\.php/, r => r.fulfill(json(fx('idw-rumah.json'))));
    await page.route(/en\.wiktionary\.org\/api\/rest_v1/, r => r.fulfill(json({ id: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'house', parsedExamples: [] }] }] })));
    await page.route(/en\.wiktionary\.org\/w\/api\.php/, r => r.fulfill(json({ parse: { text: '<p></p>' } })));
    await page.route(/api\.tatoeba\.org/, r => r.fulfill(json({ data: [{ id: 1, text: 'Rumah saya besar.', translations: [{ lang: 'eng', text: 'My house is big.' }] }] })));

    await page.goto(APP + '/'); await page.waitForFunction(() => serverUp === false, null, { timeout: 15000 });
    console.log('ok   page loads and notices there is no server');

    await page.fill('#q', 'rumah'); await page.press('#q', 'Enter'); await page.waitForSelector('#sec-kbbi', { timeout: 15000 });
    const hero = await page.innerText('#sec-kbbi');
    assert.match(hero, /ru·mah/); assert.match(hero, /tempat tinggal/); assert.match(hero, /Rumah itu besar/); assert.match(hero, /Wiktionary \(Indonesian\)/);
    assert.ok(!/penerangan|rfdef|bukan ini/.test(hero), 'placeholders and other languages must be skipped');
    await page.waitForSelector('#sec-sn', { timeout: 10000 }); assert.match(await page.innerText('#sec-sn'), /My house is big/);
    console.log('ok   lookup works in the browser alone (Indonesian Wiktionary, English Wiktionary, Tatoeba)');

    await page.goto(APP + '/#settings'); await sleep(1500);
    assert.ok(await page.isVisible('#serverCard'), 'the "No Kamus server" note shows');
    const locked = await page.evaluate(() => ({
      kbbi: [...document.querySelectorAll('[data-idsrc]')].map(o => o.dataset.idsrc + ':' + o.dataset.locked),
      tts: [...document.querySelectorAll('#ttsOptions [data-engine].opt')].map(o => o.dataset.engine + ':' + o.dataset.locked),
      tr: [...document.querySelectorAll('[data-tr]')].map(o => o.dataset.tr + ':' + o.dataset.locked) }));
    assert.deepStrictEqual(locked.kbbi, ['wikt:false', 'kbbi-web:true', 'kbbi-api:true']);
    assert.deepStrictEqual(locked.tts, ['browser:false', 'edge:true', 'wikidepia:true', 'wikidepia-web:true']);
    assert.strictEqual(locked.tr.find(x => x.startsWith('argos')), 'argos:true'); assert.strictEqual(locked.tr.find(x => x.startsWith('mymemory')), 'mymemory:false');
    assert.strictEqual(await page.evaluate(() => getTts().engine), 'browser');
    console.log('ok   server-only options are locked, the browser voice is the default');

    const made = await page.evaluate(async () => { await KamusCards.create({ Word: 'rumah', KBBI: 'tempat tinggal', Wiki: 'house', Example: 'Rumah itu besar' }); return (await KamusCards.list()).length; });
    assert.strictEqual(made, 1);
    await page.reload(); await sleep(800); assert.strictEqual(await page.evaluate(async () => (await KamusCards.list()).length), 1);
    const apkg = await page.evaluate(async () => { const r = await KamusApkg.build({ cards: await KamusCards.list(), model: await getModel(), getAudio: null }); return [r.notes, r.cards, r.blob.size > 1000]; });
    assert.deepStrictEqual(apkg, [1, 3, true]);   // no audio without a server voice, so no listening card
    console.log('ok   cards persist in the browser and the .apkg export builds without a server');

    await page.waitForFunction(() => wlState.has, null, { timeout: 10000 });
    const stem = await page.evaluate(() => ({ source: wlState.source, n: wlState.n, parts: ['berlari', 'memperbaiki', 'dimakannya', 'terbang'].map(w => KamusStem.analyze(w) ? KamusStem.describe(KamusStem.analyze(w)) : null) }));
    assert.strictEqual(stem.source, 'snapshot'); assert.ok(stem.n > 20000);
    assert.deepStrictEqual(stem.parts, ['ber- + lari', 'memper- + baik + -i', 'di- + makan + -nya', null]);
    console.log('ok   the shipped word list loads by itself and the stemmer uses it (' + stem.n + ' words)');

    assert.deepStrictEqual(errors, [], 'no script errors: ' + errors.join('; '));
    console.log('all static-site checks passed');
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await browser.close(); srv.kill(); }
})();
