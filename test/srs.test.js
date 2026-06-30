import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY, SCHEDULE_GATE, newForm, minLvl, formDue, isReviewDue, graceDays, decayForm,
} from '../src/core/srs.js';

const NOW = 1_700_000_000_000;

test('newForm: fresh form starts at zero', () => {
  assert.deepEqual(newForm(), { lvl: 0, due: 0, peak: 0, correct: 0, wrong: 0 });
});

test('minLvl: stage follows the weaker form', () => {
  assert.equal(minLvl({ past: { lvl: 2 }, pp: { lvl: 5 } }), 2);
  assert.equal(minLvl({ past: { lvl: 7 }, pp: { lvl: 4 } }), 4);
});

test('formDue: low levels are always due; high levels only when the due date has passed', () => {
  assert.ok(formDue({ lvl: 0, due: NOW + DAY }, NOW));            // below gate -> due regardless
  assert.ok(formDue({ lvl: SCHEDULE_GATE - 1, due: NOW + DAY }, NOW));
  assert.equal(formDue({ lvl: 5, due: NOW + DAY }, NOW), false);  // scheduled, not yet
  assert.ok(formDue({ lvl: 5, due: NOW - DAY }, NOW));            // overdue
});

test('isReviewDue: only past the gate, with the due date reached', () => {
  assert.equal(isReviewDue({ lvl: 0, due: NOW - DAY }, NOW), false); // lvl 0 never reviews
  assert.equal(isReviewDue({ lvl: 2, due: NOW - DAY }, NOW), false); // below gate
  assert.equal(isReviewDue({ lvl: 3, due: NOW + DAY }, NOW), false); // not yet due
  assert.ok(isReviewDue({ lvl: 3, due: NOW - DAY }, NOW));           // due
});

test('graceDays: 2× the interval, floored at 2', () => {
  assert.equal(graceDays(0), 2);    // max(2, 0)
  assert.equal(graceDays(3), 2);    // max(2, 2*1)
  assert.equal(graceDays(5), 6);    // max(2, 2*3)
  assert.equal(graceDays(10), 2);   // interval 0 -> floor
});

test('decayForm: an overdue form slips a level, keeping its peak', () => {
  const f = { lvl: 5, due: NOW - graceDays(5) * DAY - 1000, peak: 5 };
  decayForm(f, NOW);
  assert.equal(f.lvl, 4);    // slipped exactly one window
  assert.equal(f.peak, 5);   // peak preserved for fast relearn
});

test('decayForm: no change when not overdue, and never below 0', () => {
  const fresh = { lvl: 5, due: NOW + 10 * DAY, peak: 5 };
  decayForm(fresh, NOW);
  assert.equal(fresh.lvl, 5);

  const zero = { lvl: 0, due: NOW - 100 * DAY, peak: 3 };
  decayForm(zero, NOW);
  assert.equal(zero.lvl, 0);
});
