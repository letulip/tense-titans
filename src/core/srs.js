// Spaced-repetition scheduling & the forgetting curve. Pure and DOM-free.
// Per-form state shape: { lvl, due, peak, correct, wrong }.

export const DAY = 86400000;
export const FORM_MAX = 10;       // top per-form level
export const PICK_FORM_CAP = 3;   // recognition ("Pick") can raise a form only this high
export const SCHEDULE_GATE = 3;   // at lvl >= this, a form advances only when it's "due"
// Days to wait after REACHING a level before the form is due again (index = level).
// Fibonacci-flavoured, tuned so: Growing(5) ≈ 3–5d, Mastered(7) ≈ 7–10d, Champion(10) ≈ 3 weeks.
export const INTERVAL_DAYS = [0, 0, 0, 1, 2, 3, 3, 4, 5, 6, 0];
// Mastery-stage thresholds, read from the WEAKER of the two forms (min level).
export const STAGE_MIN = { sprout: 3, growing: 5, mastered: 7, gold: 10 };

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

// Apply one answer to a single form. Pure: returns a NEW form state (input untouched) plus the
// XP to award, a UI hint, and whether this was a recall mode. The caller applies the side effects
// (XP, per-mode counters, lastSeen). `otherLvl` is the partner form's level (for stage hints).
export function applyAnswer(form, { ok, mode, otherLvl = 0, now = Date.now() }) {
  const recall = mode === 'type' || mode === 'review';   // typed = recall
  const f = { ...form };
  let hint = '', xp = 0;
  if (ok) {
    f.correct++;
    xp = (recall || mode === 'trouble') ? 15 : 10;   // recall / fixing mistakes pays a bonus
    if (mode === 'trouble') {
      // Focused drill: a correct recall lifts the weak form back to the stable gate,
      // so a fixed verb actually drops off the trouble list.
      if (f.lvl < SCHEDULE_GATE) { f.lvl = SCHEDULE_GATE; f.peak = Math.max(f.peak, f.lvl); }
      f.due = now + (INTERVAL_DAYS[f.lvl] || 0) * DAY;
      hint = Math.min(f.lvl, otherLvl) >= SCHEDULE_GATE ? '✅ Fixed!' : 'Good — its other form still needs a fix';
    } else {
      const modeCap = recall ? FORM_MAX : PICK_FORM_CAP;
      if (f.lvl >= modeCap) {
        hint = !recall ? 'Switch to ⌨️ Type it to level up!' : '';
      } else if (f.lvl >= SCHEDULE_GATE && now < (f.due || 0)) {
        hint = 'Counts! Comes back for review later ⏳';
      } else {
        f.lvl++;
        f.peak = Math.max(f.peak, f.lvl);
        let wait = INTERVAL_DAYS[f.lvl] || 0;
        if (f.lvl < f.peak) wait = Math.ceil(wait / 2);   // relearn faster below your peak
        f.due = now + wait * DAY;
        const m = Math.min(f.lvl, otherLvl);
        if (m === STAGE_MIN.mastered) hint = '🌳 Mastered!';
        else if (m === STAGE_MIN.gold) hint = '🌟 Champion verb!';
      }
    }
  } else {
    f.wrong++; f.lvl = Math.max(0, f.lvl - 2); f.due = now;   // a miss drops two levels, back to review now
  }
  return { form: f, hint, xp, recall };
}
