// Verb selection & scheduling queues: what to ask next, what's due, what's "trouble".
// store and verbs are passed in (not module globals), so this is unit-testable.
import { minLvl, formDue, isReviewDue, SCHEDULE_GATE, FORM_MAX, STAGE_MIN } from './srs.js';

// "Trouble spots": verbs you keep missing — but only while a missed form still sits below the
// stable gate. Once correct answers lift it back, the verb counts as fixed (score 0).
export function troubleScore(v, store) {
  const p = store.progress[v.id];
  if (!p) return 0;
  const wrongs = p.past.wrong + p.pp.wrong;
  if (wrongs === 0) return 0;
  if (minLvl(p) >= SCHEDULE_GATE) return 0;
  const total = wrongs + p.past.correct + p.pp.correct;
  const acc = total ? (p.past.correct + p.pp.correct) / total : 1;
  return wrongs * 2 + (1 - acc) * 10 + (SCHEDULE_GATE - minLvl(p)) * 2;
}

export function troubleList(verbs, store, n = 10) {
  return verbs.filter(v => troubleScore(v, store) > 0)
    .sort((a, b) => troubleScore(b, store) - troubleScore(a, store))
    .slice(0, n);
}

export function troubleCount(verbs, store) {
  return verbs.filter(v => troubleScore(v, store) > 0).length;
}

// Which of a verb's two forms are due for a scheduled review right now.
export function dueForms(p) {
  const out = [];
  if (isReviewDue(p.past)) out.push('past');
  if (isReviewDue(p.pp)) out.push('pp');
  return out;
}

// The "do your reviews" queue: every form past its review date. Unshuffled — the caller shuffles.
export function buildReviewQueue(verbs, store) {
  const q = [];
  for (const v of verbs) {
    const p = store.progress[v.id];
    if (!p) continue;
    for (const which of dueForms(p)) q.push({ v, which });
  }
  return q;
}

// Weighted random pick of the next verb: weak / overdue verbs surface most; brand-new verbs are
// gated by newBudgetRef.left (decremented when a new verb is chosen). Excludes the previous verb.
export function pickVerb(verbs, store, excludeId, newBudgetRef) {
  const pool = [];
  for (const v of verbs) {
    if (v.id === excludeId) continue;
    const p = store.progress[v.id];
    let weight;
    if (!p) {
      weight = newBudgetRef.left > 0 ? 8 : 0.2;   // gate how many new verbs appear
    } else {
      const m = minLvl(p);
      weight = (FORM_MAX + 1 - m);                // weaker verbs -> higher priority
      if (formDue(p.past) || formDue(p.pp)) weight *= 2.2;   // due for review -> surface it
      else weight *= 0.3;                                    // not due -> show rarely
      if (m >= STAGE_MIN.mastered) weight *= 0.6;            // mastered shows less (unless due)
    }
    if (weight > 0) pool.push({ v, weight });
  }
  if (!pool.length) return verbs[Math.floor(Math.random() * verbs.length)];
  const total = pool.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.weight;
    if (r <= 0) {
      if (!store.progress[item.v.id]) newBudgetRef.left--;
      return item.v;
    }
  }
  return pool[pool.length - 1].v;
}

// Which form to test: the one that needs it most (due / lower level). Ties break randomly.
export function chooseForm(v, store) {
  const p = store.progress[v.id];
  if (!p) return Math.random() < 0.5 ? 'past' : 'pp';
  const need = (f) => (formDue(f) ? 100 : 0) + (FORM_MAX - f.lvl);
  const np = need(p.past), npp = need(p.pp);
  if (np === npp) return Math.random() < 0.5 ? 'past' : 'pp';
  return np > npp ? 'past' : 'pp';
}
