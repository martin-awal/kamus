// The learning pages in a real browser, against a plain file server (no Kamus server). Wiktionary is mocked, the microphone is a fake device.
// Needs playwright (npm i --no-save playwright) and static/vendor.   node tests/e2e/learn.e2e.js
const { chromium } = require('playwright'), { spawn } = require('child_process'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..', '..'), PORT = 8802, APP = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', path.join(ROOT, 'static')], { stdio: 'ignore' });
  await sleep(1200);
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }), errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 }, permissions: ['microphone'] }), page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/en\.wiktionary\.org\/api\/rest_v1\/page\/definition\/kereta/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ id: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'train carriage' }] }], ms: [{ partOfSpeech: 'Noun', definitions: [{ definition: '<a>car</a>, automobile' }] }] }) }));
    const text = sel => page.innerText(sel);

    await page.goto(APP + '/'); await page.waitForFunction(() => serverUp === false, null, { timeout: 15000 });
    assert.deepStrictEqual(await page.$$eval('.rail-item span:last-child', els => els.map(e => e.textContent)), ['Kamus', 'Learn', 'Anki', 'Affixes', 'History', 'Settings']);
    console.log('ok   rail: Kamus, Learn, Anki, Affixes');

    await page.waitForSelector('#homeLearn .home-tile', { timeout: 10000 });
    assert.match(await text('#homeLearn'), /Make cards from the words you look up/); assert.strictEqual(await page.locator('#homeLearn .dw').count(), 3);
    console.log('ok   home: hint without cards, 3 words of the day');

    // ---- review
    await page.evaluate(async () => { for (const [w, m, e] of [['rumah', 'house', 'Rumah itu besar'], ['pagi', 'morning', 'Selamat pagi semua'], ['makan', 'to eat', 'Saya mau makan nasi']]) await KamusCards.create({ Word: w, Wiki: m, Example: e, ExampleEN: 'x' }); });
    await page.reload(); await page.waitForSelector('#homeLearn [data-hl=review]');
    assert.match(await text('#homeLearn'), /0\s*due\s*·\s*3\s*new today/);
    await page.click('#homeLearn [data-hl=review]'); await page.waitForSelector('#reviewDlg[open]');
    let answers = 0, firstAgain = true;
    for (let guard = 0; guard < 12; guard++) {
      if (await page.locator('.rev-done').count()) break;
      await page.keyboard.press('Space'); await page.waitForSelector('.rev-grades'); answers++;
      await page.keyboard.press(firstAgain ? '1' : '3'); firstAgain = false; await sleep(250);
    }
    await page.waitForSelector('.rev-done'); assert.strictEqual(answers, 4, 'three cards plus the one answered "again"');
    assert.match(await text('.rev-done'), /4 answers · 75% good or easy/); assert.match(await text('.rev-done'), /Streak: 1 day/);
    const states = await page.evaluate(async () => (await KamusCards.reviewAll()).map(s => [s.state, s.interval >= 1, s.lapses]));
    assert.deepStrictEqual(states, [['review', true, 0], ['review', true, 0], ['review', true, 0]]);
    await page.click('[data-rev=close]'); await sleep(400);
    assert.match(await text('#homeLearn'), /0\s*due\s*·\s*0\s*new today/); assert.ok(await page.isDisabled('#homeLearn [data-hl=review]'));
    console.log('ok   review: flip, grade with the keyboard, repeat an "again" card, schedule, streak, home updates');

    // ---- learn hub
    await page.goto(APP + '/#learn'); await page.waitForSelector('#lh-review');
    assert.strictEqual(await page.locator('#lh-words .dw').count(), 5);
    const before = await page.$$eval('#lh-words .dw b', e => e.map(x => x.textContent)); await page.reload(); await page.waitForSelector('#lh-words .dw');
    assert.deepStrictEqual(await page.$$eval('#lh-words .dw b', e => e.map(x => x.textContent)), before, 'the same five words all day');
    await page.click('#lh-words [data-know]'); await sleep(500);
    const after = await page.$$eval('#lh-words .dw b', e => e.map(x => x.textContent)); assert.strictEqual(after.length, 5); assert.ok(!after.includes(before[0]));
    console.log('ok   hub: review stats, five stable words of the day, "I know it" swaps a word');

    await page.fill('#cmpIn', 'kereta'); await page.click('#cmpForm button'); await page.waitForSelector('.cmp-cols');
    const cmp = await text('#cmpOut'); assert.match(cmp, /train carriage/); assert.match(cmp, /car, automobile/); assert.match(cmp, /kereta \(api\) is a train/);
    await page.click('[data-cmpf=false]'); const rows = await page.locator('#cmpList tbody tr').count(); assert.ok(rows >= 3 && rows < 15);
    assert.ok((await page.$$eval('#cmpList tbody tr', r => r.every(x => x.classList.contains('ff')))));
    await page.click('[data-hl=malayquiz]');
    for (let i = 0; i < 5; i++) { await page.click('#cmpQuiz .choice'); await page.click('#qzNext'); }
    assert.match(await text('#cmpQuiz'), /\d \/ 5/);
    console.log('ok   Malay vs Indonesian: live comparison, curated false friends, filter, quiz');

    await page.click('[data-drill=ny]'); assert.match(await text('#pronBox'), /one sound/i); assert.strictEqual(await page.locator('#pronWords .vchip').count(), 5);
    await page.click('[data-pw=nyamuk]'); assert.match(await text('#pronStage'), /nyamuk/);
    await page.click('#recBtn'); await sleep(1500); await page.click('#recBtn'); await page.waitForSelector('#pronRes audio', { timeout: 8000 });
    await page.click('[data-rate=good]'); await sleep(300); assert.match(await text('#pronWords'), /nyamuk ✓/);
    console.log('ok   pronunciation: drill, record with a fake microphone, playback, self-rating');

    // ---- affix lessons
    await page.goto(APP + '/#affixes'); await page.waitForSelector('#afChips');
    assert.strictEqual(await page.locator('#afChips .vchip').count(), 12);
    await page.click('[data-lesson=men]'); assert.match(await text('#affixRoot'), /menyapu/); assert.match(await text('#affixRoot'), /p, t, s, k disappear/);
    await page.click('[data-af=start]');
    for (let i = 0; i < 10; i++) { await page.click('#afQuiz .choice'); await page.click('#afNext'); }
    assert.match(await text('#afQuiz'), /\d+ \/ 10/);
    assert.match(await text('#afChips'), /meN- · \d+\/10/);
    await page.click('[data-af=mix]'); await page.click('#afQuiz .choice'); assert.match(await text('#afFb'), /=.*\+/);
    await page.evaluate(async () => { for (const w of ['berlari', 'dimakan', 'rumah']) await KamusCards.create({ Word: w, Wiki: 'x' }); });
    await page.waitForFunction(() => wlState.has); await page.click('[data-af=mine]'); await page.waitForSelector('#afMine .dw');
    const mine = await text('#afMine'); assert.match(mine, /berlari[\s\S]*ber- \+ lari/); assert.match(mine, /dimakan[\s\S]*di- \+ makan/); assert.ok(!/rumah\s*=/.test(mine));
    console.log('ok   affix lessons: 12 lessons, ten-question practice with saved best score, mixed practice, analysis of your own words');

    assert.deepStrictEqual(errors, [], 'no script errors: ' + errors.join('; '));
    console.log('all learning-page checks passed');
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await browser.close(); srv.kill(); }
})();
