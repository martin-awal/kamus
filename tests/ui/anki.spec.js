// Anki bridge (plan step 11) against a fake AnkiConnect: sync, progress, edits (connected and offline), duplicates, import, backup/restore.
// Real Anki is not tested here; this pins down what Kamus sends and how it reacts.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { VIEWS, openView } = require('./helpers');
const { fakeAnki } = require('./fake-anki');
const ankiView = VIEWS.find(v => v.name === 'anki');
const badges = page => page.locator('#ankiList .crow-side').allInnerTexts();
async function sync(page) {   // through the title-bar chip, as a user would
  await page.hover('#ankiChip'); await page.click('[data-chip=sync]');
  await expect(page.locator('#ankiChip')).not.toContainText(/Sending|Preparing|Reading|Updating/, { timeout: 30000 });
  await page.mouse.move(5, 300);
}
const cards = page => page.evaluate(async () => (await KamusCards.list()).map(c => ({ w: c.word, m: c.meaning, note: c.note_id, dirty: c.dirty, p: c.progress })));

test.describe('Anki bridge', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('sync sends every card once, creates the note type and deck, and stores note ids', async ({ page }) => {
    const anki = fakeAnki(); await anki.install(page);
    await openView(page, ankiView);
    await expect(page.locator('#ankiChip')).toContainText('Connected');
    await sync(page);
    expect(anki.S.notes.size).toBe(3); expect(anki.S.decks).toContain('Kamus'); expect(Object.keys(anki.S.models)).toEqual(['Kamus v1']);
    const note = [...anki.S.notes.values()].find(n => n.fields.Word.value === 'rumah');
    expect(note.fields.Index.value).toBe('rumah | house'); expect(note.fields.ExampleBlank.value).toBe('[ … ] itu besar'); expect(note.tags).toContain('kamus');
    expect(anki.S.models['Kamus v1'].fields).toEqual(expect.arrayContaining(['Skip1', 'Skip2', 'Skip3', 'Skip4']));
    expect((await cards(page)).every(c => c.note)).toBe(true);
    for (const b of await badges(page)) expect(b).toMatch(/In Anki/);
    await sync(page); expect(anki.S.notes.size, 'a second sync adds nothing').toBe(3);
    expect(note.audio, 'no audio URL is sent when there is no server to fetch it from').toBe(0);
  });

  test('review progress comes back from Anki', async ({ page }) => {
    const anki = fakeAnki(); await anki.install(page);
    await openView(page, ankiView); await sync(page);
    anki.study(); await sync(page);
    const c = (await cards(page)).find(x => x.note === [...anki.S.notes.keys()][0]);
    expect(c.p).toMatchObject({ cards: 4, review: 4, dueNow: 2, lapses: 1 });
    await expect(page.locator('#ankiList')).toContainText('In Anki · review'); await expect(page.locator('#ankiSummary')).toContainText('2 due now');
  });

  test('an edit goes to Anki at once when connected', async ({ page }) => {
    const anki = fakeAnki(); await anki.install(page);
    await openView(page, ankiView); await sync(page);
    await page.locator('#ankiList .crow', { hasText: 'rumah' }).click(); await page.click('#ankiDetail [data-dact=edit]');
    await page.fill('#csheet [data-f=Wiki]', 'home, house'); await page.click('#csave');
    await expect.poll(() => [...anki.S.notes.values()].find(n => n.fields.Word.value === 'rumah').fields.Wiki.value).toBe('home, house');
    const c = (await cards(page)).find(x => x.w === 'rumah'); expect(c.dirty).toBe(false); expect(c.m).toBe('home, house');
    await expect(page.locator('#ankiList')).not.toContainText('Desynced');
  });

  test('an edit made while Anki is closed is marked Desynced and pushed by the next sync', async ({ page }) => {
    const anki = fakeAnki(); await anki.install(page);
    await openView(page, ankiView); await sync(page);
    anki.S.up = false; await page.reload(); await expect(page.locator('#ankiChip')).toContainText('Disconnected', { timeout: 15000 });
    await page.locator('#ankiList .crow', { hasText: 'pagi' }).click(); await page.click('#ankiDetail [data-dact=edit]');
    await page.fill('#csheet [data-f=Wiki]', 'early morning'); await page.click('#csave');
    await expect(page.locator('#ankiList .crow', { hasText: 'pagi' })).toContainText('Desynced');
    expect([...anki.S.notes.values()].find(n => n.fields.Word.value === 'pagi').fields.Wiki.value).toBe('morning');
    anki.S.up = true; await page.reload(); await expect(page.locator('#ankiChip')).toContainText('Connected', { timeout: 15000 }); await sync(page);
    expect([...anki.S.notes.values()].find(n => n.fields.Word.value === 'pagi').fields.Wiki.value).toBe('early morning');
    await expect(page.locator('#ankiList')).not.toContainText('Desynced');
  });

  test('a note that already exists in Anki is linked, not duplicated', async ({ page }) => {
    const anki = fakeAnki(); await anki.install(page);
    await openView(page, ankiView); await sync(page);
    await page.evaluate(async () => { for (const c of await KamusCards.list()) await KamusCards.report([{ id: c.id, note_id: null }]); });   // Kamus forgot its links (e.g. another browser)
    await page.reload(); await expect(page.locator('#ankiChip')).toContainText('Connected'); await sync(page);
    expect(anki.S.notes.size).toBe(3); expect((await cards(page)).every(c => c.note)).toBe(true);
  });

  test('Import from Anki adds Kamus notes this browser does not have', async ({ page }) => {
    const anki = fakeAnki(); await anki.install(page);
    await openView(page, ankiView); await sync(page);
    await page.evaluate(async () => { const c = (await KamusCards.list()).find(x => x.word === 'makan'); await KamusCards.remove(c.id); });
    await page.reload(); await expect(page.locator('#ankiChip')).toContainText('Connected');
    await page.hover('#ankiChip'); await page.click('[data-chip=info]'); await page.click('[data-dlg=import]');
    await expect.poll(async () => (await cards(page)).map(c => c.w).sort()).toEqual(['makan', 'pagi', 'rumah']);
    expect((await cards(page)).find(c => c.w === 'makan').note).toBeTruthy(); expect(anki.S.notes.size).toBe(3);
  });

  test('a note deleted in Anki shows as "Not in Anki" again', async ({ page }) => {
    const anki = fakeAnki(); await anki.install(page);
    await openView(page, ankiView); await sync(page);
    const id = [...anki.S.notes.values()].find(n => n.fields.Word.value === 'pagi').noteId; anki.S.notes.delete(id);
    await sync(page);
    expect((await cards(page)).find(c => c.w === 'pagi').note).toBeNull();
    await expect(page.locator('#ankiList .crow', { hasText: 'pagi' })).toContainText('Not in Anki');
  });

  test('backup and restore round-trip, including review states', async ({ page }) => {
    await openView(page, ankiView);
    await page.evaluate(async () => { const c = (await KamusCards.list())[0]; await KamusCards.reviewPut({ id: c.id, state: 'review', interval: 8, ease: 2.5, due: 1, reps: 3, lapses: 0, last: 1 }); });
    await page.hover('#ankiChip'); await page.click('[data-chip=info]');
    const dl = page.waitForEvent('download'); await page.click('[data-dlg=backup]'); const file = await (await dl).path();
    const data = JSON.parse(fs.readFileSync(file, 'utf8')); expect(data.cards.length).toBe(3); expect(data.reviews.length).toBe(1);
    await page.evaluate(async () => { for (const c of await KamusCards.list()) { await KamusCards.remove(c.id); await KamusCards.reviewDelete(c.id); } });
    await page.setInputFiles('#aRestore', file);
    await expect.poll(async () => (await cards(page)).length).toBe(3);
    expect(await page.evaluate(async () => (await KamusCards.reviewAll()).length)).toBe(1);
    await page.setInputFiles('#aRestore', file); await expect(page.locator('.toast').last()).toContainText('Nothing new');
  });

  test('delete asks first and removes the card', async ({ page }) => {
    await openView(page, ankiView);
    page.once('dialog', d => d.accept());
    await page.locator('#ankiList .crow', { hasText: 'pagi' }).locator('[data-act=del]').click();
    await expect.poll(async () => (await cards(page)).map(c => c.w).sort()).toEqual(['makan', 'rumah']);
  });
});
