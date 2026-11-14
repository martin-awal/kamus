/* Spaced repetition for Kamus' own review: a small SM-2 style scheduler, kept separate from Anki's (Anki keeps its own schedule).
   A review state per card: {id, state:'new'|'learning'|'review', ease, interval (days), due (ms), reps, lapses, last}.
   Pure functions, no storage: learn.js keeps the states in IndexedDB. */
(function () {
  const MIN = 60000, DAY = 86400000;
  const newState = id => ({ id, state: 'new', ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0, last: 0 });
  const GRADES = ['again', 'hard', 'good', 'easy'];

  function grade(st, g, now) {
    if (!GRADES.includes(g)) throw new Error('unknown grade ' + g);
    const s = { ...st, last: now, reps: st.reps + 1 };
    if (st.state !== 'review') {   // new or still learning
      if (g === 'again') { s.state = 'learning'; s.due = now + MIN; }
      else if (g === 'hard') { s.state = 'learning'; s.due = now + 10 * MIN; }
      else { s.state = 'review'; s.interval = g === 'easy' ? 4 : Math.max(1, st.interval || 1); s.due = now + s.interval * DAY; }
      return s;
    }
    if (g === 'again') { s.state = 'learning'; s.lapses = st.lapses + 1; s.ease = Math.max(1.3, st.ease - 0.2); s.interval = 1; s.due = now + 10 * MIN; return s; }
    const steps = { hard: [1.2, -0.15], good: [st.ease, 0], easy: [st.ease * 1.3, 0.15] }[g];
    s.interval = Math.max(st.interval + 1, Math.round(st.interval * steps[0]));
    s.ease = Math.max(1.3, +(st.ease + steps[1]).toFixed(2));
    s.due = now + s.interval * DAY;
    return s;
  }
  function fmt(ms) {   // 600000 -> "10 min", 86400000 -> "1 day", 8 days -> "8 days", 45 days -> "1.5 months"
    if (ms < 60 * MIN) return Math.max(1, Math.round(ms / MIN)) + ' min';
    const d = ms / DAY; if (d < 1) return Math.round(ms / (60 * MIN)) + ' h';
    if (d < 30) return Math.round(d) + (Math.round(d) === 1 ? ' day' : ' days');
    if (d < 365) { const m = Math.round(d / 30 * 10) / 10; return m + ' months'.replace('1 months', '1 month'); }
    return Math.round(d / 36.5) / 10 + ' years';
  }
  const preview = (st, now) => Object.fromEntries(GRADES.map(g => [g, fmt(grade(st, g, now).due - now)]));
  const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  // which cards to show: learning/review cards that are due (oldest due first), then new cards up to today's allowance
  function queue(cardIds, states, now, { newLimit = 10, newDoneToday = 0 } = {}) {
    const byId = new Map(states.map(s => [s.id, s]));
    const due = states.filter(s => s.state !== 'new' && s.due <= now && cardIds.includes(s.id)).sort((a, b) => a.due - b.due).map(s => s.id);
    const fresh = cardIds.filter(id => !byId.has(id) || byId.get(id).state === 'new').slice(0, Math.max(0, newLimit - newDoneToday));
    return { due, fresh };
  }
  function summary(cardIds, states, now, opts = {}) {
    const q = queue(cardIds, states, now, opts), own = states.filter(s => cardIds.includes(s.id));
    return { total: cardIds.length, due: q.due.length, fresh: q.fresh.length, learning: own.filter(s => s.state === 'learning').length,
      review: own.filter(s => s.state === 'review').length, mature: own.filter(s => s.state === 'review' && s.interval >= 21).length,
      newTotal: cardIds.length - own.filter(s => s.state !== 'new').length };
  }
  window.KamusSrs = { MIN, DAY, GRADES, newState, grade, preview, fmt, queue, summary, dayKey };
  if (typeof module !== 'undefined') module.exports = window.KamusSrs;
})();
