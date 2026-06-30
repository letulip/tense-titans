import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, applyAnswer } from '../src/core/srs.js';

const NOW = 1_700_000_000_000;
const form = (lvl, { due = 0, peak = lvl, correct = 0, wrong = 0 } = {}) => ({ lvl, due, peak, correct, wrong });

test('pick correct: new form climbs one level, awards 10 XP, recognition not recall', () => {
  const r = applyAnswer(form(0), { ok: true, mode: 'pick', otherLvl: 9, now: NOW });
  assert.equal(r.form.lvl, 1);
  assert.equal(r.form.peak, 1);
  assert.equal(r.form.correct, 1);
  assert.equal(r.form.due, NOW);          // INTERVAL_DAYS[1] = 0 -> due now
  assert.equal(r.xp, 10);
  assert.equal(r.recall, false);
  assert.equal(r.hint, '');
});

test('pick correct at the recognition cap: no level up, nudges toward Type it', () => {
  const r = applyAnswer(form(3, { due: 123 }), { ok: true, mode: 'pick', otherLvl: 9, now: NOW });
  assert.equal(r.form.lvl, 3);            // capped
  assert.equal(r.form.due, 123);          // untouched in the cap branch
  assert.equal(r.hint, 'Switch to ⌨️ Type it to level up!');
  assert.equal(r.xp, 10);
});

test('type correct (recall) can climb past 3 and awards 15 XP', () => {
  const r = applyAnswer(form(3, { due: 0, peak: 3 }), { ok: true, mode: 'type', otherLvl: 9, now: NOW });
  assert.equal(r.form.lvl, 4);
  assert.equal(r.form.peak, 4);
  assert.equal(r.form.due, NOW + 2 * DAY);  // INTERVAL_DAYS[4] = 2, not below peak -> no halving
  assert.equal(r.xp, 15);
  assert.equal(r.recall, true);
});

test('scheduled-but-not-due recall counts without advancing', () => {
  const r = applyAnswer(form(5, { due: NOW + DAY }), { ok: true, mode: 'type', otherLvl: 9, now: NOW });
  assert.equal(r.form.lvl, 5);            // not yet due -> no advance
  assert.equal(r.hint, 'Counts! Comes back for review later ⏳');
});

test('relearn below peak schedules 2x faster', () => {
  const r = applyAnswer(form(4, { due: 0, peak: 8 }), { ok: true, mode: 'type', otherLvl: 9, now: NOW });
  assert.equal(r.form.lvl, 5);
  assert.equal(r.form.peak, 8);                  // peak preserved
  assert.equal(r.form.due, NOW + 2 * DAY);       // ceil(INTERVAL_DAYS[5]=3 / 2) = 2
});

test('wrong answer: counts a miss, drops two levels (floored at 0), back to review now, 0 XP', () => {
  const r = applyAnswer(form(5, { due: NOW + 99 * DAY }), { ok: false, mode: 'pick', otherLvl: 9, now: NOW });
  assert.equal(r.form.lvl, 3);
  assert.equal(r.form.wrong, 1);
  assert.equal(r.form.due, NOW);
  assert.equal(r.xp, 0);

  const floored = applyAnswer(form(1), { ok: false, mode: 'type', otherLvl: 0, now: NOW });
  assert.equal(floored.form.lvl, 0);
});

test('trouble correct lifts a weak form to the gate; hint depends on the other form', () => {
  const fixed = applyAnswer(form(1), { ok: true, mode: 'trouble', otherLvl: 5, now: NOW });
  assert.equal(fixed.form.lvl, 3);                       // lifted to SCHEDULE_GATE
  assert.equal(fixed.form.due, NOW + 1 * DAY);           // INTERVAL_DAYS[3] = 1
  assert.equal(fixed.hint, '✅ Fixed!');
  assert.equal(fixed.xp, 15);

  const partial = applyAnswer(form(1), { ok: true, mode: 'trouble', otherLvl: 1, now: NOW });
  assert.equal(partial.hint, 'Good — its other form still needs a fix');
});

test('stage hints fire when the weaker form crosses Mastered / Champion', () => {
  const mastered = applyAnswer(form(6, { due: 0, peak: 6 }), { ok: true, mode: 'type', otherLvl: 7, now: NOW });
  assert.equal(mastered.form.lvl, 7);
  assert.equal(mastered.hint, '🌳 Mastered!');

  const champ = applyAnswer(form(9, { due: 0, peak: 9 }), { ok: true, mode: 'type', otherLvl: 10, now: NOW });
  assert.equal(champ.form.lvl, 10);
  assert.equal(champ.hint, '🌟 Champion verb!');
});

test('the input form object is never mutated', () => {
  const original = form(2, { correct: 1 });
  const snapshot = JSON.stringify(original);
  applyAnswer(original, { ok: true, mode: 'pick', otherLvl: 9, now: NOW });
  assert.equal(JSON.stringify(original), snapshot);
});
