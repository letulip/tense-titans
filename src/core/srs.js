// Spaced-repetition scheduling & the forgetting curve. Pure and DOM-free.
// Per-form state shape: { lvl, due, peak, correct, wrong }.

export const DAY = 86400000;
export const SCHEDULE_GATE = 3;   // at lvl >= this, a form advances only when it's "due"
// Days to wait after REACHING a level before the form is due again (index = level).
// Fibonacci-flavoured, tuned so: Growing(5) ≈ 3–5d, Mastered(7) ≈ 7–10d, Champion(10) ≈ 3 weeks.
export const INTERVAL_DAYS = [0, 0, 0, 1, 2, 3, 3, 4, 5, 6, 0];

export function newForm() { return { lvl: 0, due: 0, peak: 0, correct: 0, wrong: 0 }; }

// Stage is read from the WEAKER of the two forms — you must know both.
export function minLvl(p) { return Math.min(p.past.lvl, p.pp.lvl); }

// Is a form ready to advance right now? Low levels are instant; high levels are scheduled.
export function formDue(f, now = Date.now()) { return f.lvl < SCHEDULE_GATE || now >= (f.due || 0); }

// Is a form due for a scheduled review (already past the gate)?
export function isReviewDue(f, now = Date.now()) {
  return f.lvl > 0 && f.lvl >= SCHEDULE_GATE && now >= (f.due || 0);
}

// Grace window (days) before an overdue form slips a level — 2× the interval, min 2.
export function graceDays(lvl) { return Math.max(2, 2 * (INTERVAL_DAYS[lvl] || 0)); }

// Forgetting curve: an overdue form slips levels (peak is kept → 2× faster relearn). Mutates f.
export function decayForm(f, now = Date.now()) {
  let guard = 0;
  while (f.lvl > 0 && f.due && now > f.due + graceDays(f.lvl) * DAY && guard++ < 30) {
    f.due += graceDays(f.lvl) * DAY;   // consume one grace window
    f.lvl -= 1;                        // ...and slip a level (peak is kept → fast relearn)
  }
}
