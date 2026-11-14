const test = require('node:test'), assert = require('node:assert');
global.window = {};
const S = require('../static/srs.js');
const T0 = Date.UTC(2026, 0, 1, 12);

test('a new card: good starts at one day, easy at four, again/hard stay in learning', () => {
  const n = S.newState('a');
  const good = S.grade(n, 'good', T0), easy = S.grade(n, 'easy', T0), again = S.grade(n, 'again', T0), hard = S.grade(n, 'hard', T0);
  assert.deepStrictEqual([good.state, good.interval, good.due - T0], ['review', 1, S.DAY]);
  assert.deepStrictEqual([easy.state, easy.interval], ['review', 4]);
  assert.deepStrictEqual([again.state, again.due - T0, again.reps], ['learning', S.MIN, 1]);
  assert.deepStrictEqual([hard.state, hard.due - T0], ['learning', 10 * S.MIN]);
});
test('review cards: intervals grow, hard grows slowly, easy grows fastest', () => {
  let st = S.grade(S.newState('a'), 'good', T0);   // 1 day
  const seq = []; for (let i = 0; i < 4; i++) { st = S.grade(st, 'good', st.due); seq.push(st.interval); }
  assert.deepStrictEqual(seq, [3, 8, 20, 50]);   // 2.5x each time, always at least one day more
  const base = { ...st, interval: 10, ease: 2.5 };
  const [h, g, e] = ['hard', 'good', 'easy'].map(x => S.grade(base, x, T0).interval);
  assert.ok(h < g && g < e); assert.strictEqual(h, 12); assert.strictEqual(g, 25); assert.strictEqual(e, 33);
});
test('a lapse costs ease, goes back to learning with a one-day interval, and ease never drops below 1.3', () => {
  let st = { ...S.newState('a'), state: 'review', interval: 30, ease: 1.4, reps: 9 };
  st = S.grade(st, 'again', T0);
  assert.deepStrictEqual([st.state, st.interval, st.lapses, st.ease], ['learning', 1, 1, 1.3]);
  const back = S.grade(st, 'good', T0);   // relearned: back to review at the reset interval
  assert.deepStrictEqual([back.state, back.interval], ['review', 1]);
});
test('ease changes: easy up, hard down', () => {
  const st = { ...S.newState('a'), state: 'review', interval: 5, ease: 2.5 };
  assert.strictEqual(S.grade(st, 'easy', T0).ease, 2.65); assert.strictEqual(S.grade(st, 'hard', T0).ease, 2.35); assert.strictEqual(S.grade(st, 'good', T0).ease, 2.5);
});
test('unknown grades are refused', () => assert.throws(() => S.grade(S.newState('a'), 'meh', T0), /unknown grade/));
test('time labels', () => {
  assert.strictEqual(S.fmt(60000), '1 min'); assert.strictEqual(S.fmt(10 * 60000), '10 min'); assert.strictEqual(S.fmt(3 * 3600000), '3 h');
  assert.strictEqual(S.fmt(S.DAY), '1 day'); assert.strictEqual(S.fmt(8 * S.DAY), '8 days'); assert.strictEqual(S.fmt(45 * S.DAY), '1.5 months'); assert.strictEqual(S.fmt(400 * S.DAY), '1.1 years');
  assert.deepStrictEqual(S.preview(S.newState('a'), T0), { again: '1 min', hard: '10 min', good: '1 day', easy: '4 days' });
});
test('queue: due cards first (oldest first), then new ones up to the daily allowance', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const states = [{ ...S.newState('a'), state: 'review', due: T0 - 5 * S.DAY, interval: 3 }, { ...S.newState('b'), state: 'review', due: T0 - S.DAY, interval: 3 },
    { ...S.newState('c'), state: 'review', due: T0 + S.DAY, interval: 3 }, { ...S.newState('gone'), state: 'review', due: T0 - S.DAY }];   // 'gone' no longer exists as a card
  assert.deepStrictEqual(S.queue(ids, states, T0, { newLimit: 2 }), { due: ['a', 'b'], fresh: ['d', 'e'] });
  assert.deepStrictEqual(S.queue(ids, states, T0, { newLimit: 2, newDoneToday: 2 }).fresh, []);
  assert.deepStrictEqual(S.queue(ids, states, T0, { newLimit: 10, newDoneToday: 4 }).fresh, ['d', 'e', 'f']);
});
test('summary counts', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const states = [{ ...S.newState('a'), state: 'review', due: T0 - 1, interval: 30 }, { ...S.newState('b'), state: 'learning', due: T0 - 1 }, { ...S.newState('c'), state: 'review', due: T0 + S.DAY, interval: 3 }];
  assert.deepStrictEqual(S.summary(ids, states, T0, { newLimit: 10 }), { total: 4, due: 2, fresh: 1, learning: 1, review: 2, mature: 1, newTotal: 1 });
});
test('dayKey is the local calendar day', () => assert.match(S.dayKey(T0), /^2026-01-0[12]$/));
