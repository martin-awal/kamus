// A fake AnkiConnect for the browser tests: page.route answers the JSON API from an in-memory collection.
// It covers the actions Kamus uses; anything else answers "unsupported action" so a new call is noticed.
const ANKI_URL = 'http://127.0.0.1:8765';
function fakeAnki() {
  const S = { up: true, models: {}, decks: ['Default'], notes: new Map(), next: 1000, log: [], synced: 0 };
  const cardsOf = n => n.cards;
  function handle(action, p = {}) {
    S.log.push(action);
    switch (action) {
      case 'version': return 6;
      case 'deckNames': return S.decks;
      case 'createDeck': if (!S.decks.includes(p.deck)) S.decks.push(p.deck); return 1;
      case 'modelNames': return Object.keys(S.models);
      case 'createModel': S.models[p.modelName] = { fields: [...p.inOrderFields], templates: p.cardTemplates.map(t => t.Name) }; return { id: 1 };
      case 'modelFieldNames': return S.models[p.modelName].fields;
      case 'modelFieldAdd': S.models[p.modelName].fields.push(p.fieldName); return null;
      case 'updateModelTemplates': return null;
      case 'addNote': {
        const n = p.note, idx = n.fields.Index;
        if ([...S.notes.values()].some(x => x.fields.Index.value === idx)) throw new Error('cannot create note because it is a duplicate');
        const id = S.next++, count = S.models[n.modelName].templates.length;
        S.notes.set(id, { noteId: id, modelName: n.modelName, tags: n.tags || [], audio: (n.audio || []).length, fields: Object.fromEntries(Object.entries(n.fields).map(([k, v]) => [k, { value: v }])),
          cards: Array.from({ length: count }, (_, i) => ({ cardId: id * 10 + i, note: id, type: 0, queue: 0, reps: 0, lapses: 0, interval: 0, due: false })) });
        return id;
      }
      case 'findNotes': { const m = /Index:(.+?)"$/.exec(p.query || ''); return [...S.notes.values()].filter(n => !m || n.fields.Index.value === m[1].replace(/\\/g, '')).map(n => n.noteId); }
      case 'notesInfo': return p.notes.map(id => { const n = S.notes.get(id); return { noteId: n.noteId, modelName: n.modelName, fields: n.fields, cards: cardsOf(n).map(c => c.cardId) }; });
      case 'cardsInfo': return [...S.notes.values()].flatMap(cardsOf).filter(c => p.cards.includes(c.cardId));
      case 'areDue': return p.cards.map(id => !![...S.notes.values()].flatMap(cardsOf).find(c => c.cardId === id && c.due));
      case 'updateNoteFields': { const n = S.notes.get(p.note.id); if (!n) throw new Error('note not found'); for (const [k, v] of Object.entries(p.note.fields)) n.fields[k] = { value: v }; S.log.push('updated:' + p.note.id); return null; }
      case 'sync': S.synced++; return null;
      default: throw new Error('unsupported action ' + action);
    }
  }
  async function install(page) {
    await page.route(ANKI_URL + '/**', async route => {
      if (!S.up) return route.abort();
      const req = route.request(), headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      let result = null, error = null;
      try { const body = JSON.parse(req.postData() || '{}'); result = handle(body.action, body.params); } catch (e) { error = e.message; }
      route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ result, error }) });
    });
    await page.addInitScript(u => { try { localStorage.setItem('kamus-ankiurl', u); } catch (e) {} }, ANKI_URL);
  }
  // pretend the learner studied: the first note's cards become review cards, two of them due
  const study = () => { const n = [...S.notes.values()][0]; n.cards.forEach((c, i) => Object.assign(c, { type: 2, reps: 5 - i, lapses: i === 0 ? 1 : 0, interval: 21, due: i < 2 })); };
  return { S, install, study, ANKI_URL };
}
module.exports = { fakeAnki };
