import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY } from '../src/core/srs.js';
import {
  troubleScore, troubleList, troubleCount, dueForms, buildReviewQueue, pickVerb, chooseForm,
} from '../src/core/selection.js';

const NOW = Date.now();
const form = (lvl, { due = 0, peak = lvl, correct = 0, wrong = 0 } = {}) => ({ lvl, due, peak, correct, wrong });
const verb = (id) => ({ id, base: id, past: id + 'ed', pp: id + 'ed' });
const storeWith = (progress) => ({ progress });

test('troubleScore: 0 without progress, without wrongs, or once recovered to the gate', () => {
  const v = verb('go');
  assert.equal(troubleScore(v, storeWith({})), 0);                                       // never seen
  assert.equal(troubleScore(v, storeWith({ go: { past: form(2), pp: form(2) } })), 0);    // no wrongs
  assert.equal(troubleScore(v, storeWith({ go: { past: form(3, { wrong: 2 }), pp: form(3) } })), 0); // recovered
});

test('troubleScore: positive while a missed form is below the gate, worse = higher', () => {
  const v = verb('go');
  const mild = troubleScore(v, storeWith({ go: { past: form(2, { wrong: 1, correct: 3 }), pp: form(4) } }));
  const bad = troubleScore(v, storeWith({ go: { past: form(0, { wrong: 5, correct: 1 }), pp: form(0, { wrong: 3 }) } }));
  assert.ok(mild > 0);
  assert.ok(bad > mild);
});

test('troubleList / troubleCount: only struggling verbs, hardest first, capped', () => {
  const verbs = [verb('a'), verb('b'), verb('c')];
  const store = storeWith({
    a: { past: form(1, { wrong: 1, correct: 5 }), pp: form(4) },   // mild
    b: { past: form(0, { wrong: 6 }), pp: form(0, { wrong: 4 }) }, // worst
    c: { past: form(5), pp: form(5) },                            // fine
  });
  assert.deepEqual(troubleList(verbs, store).map(v => v.id), ['b', 'a']);
  assert.equal(troubleCount(verbs, store), 2);
  assert.equal(troubleList(verbs, store, 1).length, 1);
});

test('dueForms / buildReviewQueue: only forms past their review date', () => {
  const verbs = [verb('a'), verb('b')];
  const store = storeWith({
    a: { past: form(5, { due: NOW - DAY }), pp: form(5, { due: NOW + DAY }) }, // past overdue, pp not
    b: { past: form(2, { due: NOW - DAY }), pp: form(2) },                     // lvl < gate -> not a review
  });
  assert.deepEqual(dueForms(store.progress.a), ['past']);
  assert.deepEqual(buildReviewQueue(verbs, store), [{ v: verbs[0], which: 'past' }]);
});

test('chooseForm: picks the form that needs it most', () => {
  const v = verb('go');
  assert.equal(chooseForm(v, storeWith({ go: { past: form(1), pp: form(8, { due: NOW + 100 * DAY }) } })), 'past');
  assert.equal(chooseForm(v, storeWith({ go: { past: form(8, { due: NOW + 100 * DAY }), pp: form(1) } })), 'pp');
});

test('pickVerb: never returns the excluded verb and spends the new-verb budget', () => {
  const verbs = [verb('a'), verb('b'), verb('c')];
  const store = storeWith({});  // all brand-new
  for (let i = 0; i < 40; i++) {
    const budget = { left: 5 };
    const picked = pickVerb(verbs, store, 'a', budget);
    assert.notEqual(picked.id, 'a');
    assert.ok(verbs.includes(picked));
    assert.equal(budget.left, 4);   // a new verb was chosen -> one budget spent
  }
});
