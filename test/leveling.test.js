import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVO_LEVELS, RANKS,
  xpForLevel, levelFromXp, xpIntoLevel, xpForNextLevel,
  evoStageForLevel, rankTitle,
} from '../src/core/leveling.js';

test('xpForLevel: geometric cumulative costs', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8].map(xpForLevel),
    [0, 100, 300, 700, 1500, 3100, 6300, 12700],
  );
});

test('levelFromXp: lands in the right band at and around boundaries', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(99), 1);
  assert.equal(levelFromXp(100), 2);   // exactly enough for L2
  assert.equal(levelFromXp(299), 2);
  assert.equal(levelFromXp(300), 3);
  assert.equal(levelFromXp(6299), 6);
  assert.equal(levelFromXp(6300), 7);
});

test('xpIntoLevel + xpForLevel(level) reconstruct total XP', () => {
  for (const xp of [0, 50, 100, 250, 700, 1500, 5000, 12700, 30000]) {
    const L = levelFromXp(xp);
    assert.equal(xpForLevel(L) + xpIntoLevel(xp), xp);
    assert.ok(xpIntoLevel(xp) >= 0 && xpIntoLevel(xp) < xpForNextLevel(xp));
  }
});

test('xpForNextLevel: span doubles each level', () => {
  assert.equal(xpForNextLevel(0), 100);      // L1 -> L2
  assert.equal(xpForNextLevel(100), 200);    // L2 -> L3
  assert.equal(xpForNextLevel(300), 400);    // L3 -> L4
  assert.equal(xpForNextLevel(700), 800);    // L4 -> L5
});

test('evoStageForLevel: advances at Lv 3/5/7/9/11, capped at 5', () => {
  const stages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(evoStageForLevel);
  assert.deepEqual(stages, [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(evoStageForLevel(100), EVO_LEVELS.length); // never exceeds the last stage index
});

test('rankTitle: one rank per evolution stage', () => {
  assert.equal(rankTitle(1), 'Novice');
  assert.equal(rankTitle(3), 'Apprentice');
  assert.equal(rankTitle(5), 'Squire');
  assert.equal(rankTitle(7), 'Knight');
  assert.equal(rankTitle(9), 'Champion');
  assert.equal(rankTitle(11), 'Titan');
});

test('invariant: rank tracks evolution stage exactly', () => {
  for (let level = 1; level <= 15; level++) {
    assert.equal(rankTitle(level), RANKS[evoStageForLevel(level)]);
  }
});
