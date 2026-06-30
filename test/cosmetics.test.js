import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reqMet, reqText } from '../src/core/cosmetics.js';

const ctx = { level: 5, mastered: 20, bestStreak: 6, champions: 2 };

test('reqMet: no requirement is always met', () => {
  assert.equal(reqMet(null, ctx), true);
  assert.equal(reqMet(undefined, ctx), true);
});

test('reqMet: each requirement type compares against the snapshot', () => {
  assert.equal(reqMet({ type: 'level', n: 5 }, ctx), true);
  assert.equal(reqMet({ type: 'level', n: 6 }, ctx), false);
  assert.equal(reqMet({ type: 'mastered', n: 20 }, ctx), true);
  assert.equal(reqMet({ type: 'mastered', n: 21 }, ctx), false);
  assert.equal(reqMet({ type: 'streak', n: 6 }, ctx), true);   // best ever
  assert.equal(reqMet({ type: 'streak', n: 7 }, ctx), false);
  assert.equal(reqMet({ type: 'champion', n: 2 }, ctx), true);
  assert.equal(reqMet({ type: 'champion', n: 3 }, ctx), false);
});

test('reqMet: unknown type is treated as met (never blocks)', () => {
  assert.equal(reqMet({ type: 'mystery', n: 99 }, ctx), true);
});

test('reqText: human-readable labels', () => {
  assert.equal(reqText({ type: 'level', n: 4 }), 'Reach level 4');
  assert.equal(reqText({ type: 'mastered', n: 15 }), 'Master 15 verbs 🌳');
  assert.equal(reqText({ type: 'streak', n: 3 }), '3-day streak 🔥');
  assert.equal(reqText({ type: 'champion', n: 1 }), '1 Champion verb 🌟');
  assert.equal(reqText(null), '');
});
