import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, defaultStore, migrate, looksLikeStore } from '../src/core/store-migrate.js';

// A representative "real" store (regression net for future migrations).
function realStore() {
  const s = defaultStore();
  s.stats.xp = 5230;
  s.stats.totalCorrect = 142;
  s.stats.dayStreak = 4;
  s.achievements.first = '2026-01-02T10:00:00.000Z';
  s.achievements.streak3 = '2026-01-05T10:00:00.000Z';
  s.settings.name = 'Leo';
  s.settings.mascot = 'fox';
  s.flags.unlocked = { fox: true, ocean: true };
  s.progress.go = { past: { lvl: 7, due: 111, peak: 8, correct: 12, wrong: 1 }, pp: { lvl: 6, due: 222, peak: 6, correct: 5, wrong: 2 }, lastSeen: 333 };
  s.progress.cut = { past: { lvl: 3, due: 0, peak: 3, correct: 2, wrong: 1 }, pp: { lvl: 3, due: 0, peak: 3, correct: 2, wrong: 0 }, lastSeen: 1 };
  return s;
}

test('looksLikeStore: accepts a real exported store', () => {
  assert.ok(looksLikeStore(realStore()));
  assert.ok(looksLikeStore(defaultStore()));
});

test('looksLikeStore: rejects garbage / foreign files', () => {
  assert.equal(looksLikeStore(null), false);
  assert.equal(looksLikeStore(undefined), false);
  assert.equal(looksLikeStore(42), false);
  assert.equal(looksLikeStore('{}'), false);          // a string, not parsed object
  assert.equal(looksLikeStore([]), false);            // array
  assert.equal(looksLikeStore({}), false);            // no progress/stats
  assert.equal(looksLikeStore({ foo: 1 }), false);    // wrong shape
  assert.equal(looksLikeStore({ progress: {} }), false);             // missing stats
  assert.equal(looksLikeStore({ progress: [], stats: {} }), false);  // progress not an object
});

test('export -> import round-trip preserves all data', () => {
  const original = realStore();
  // export = JSON serialise; import = parse + migrate
  const roundTripped = migrate(JSON.parse(JSON.stringify(original)));
  // a complete current-schema store gains nothing from migrate -> identical
  assert.deepEqual(roundTripped, original);
});

test('real fixture survives migration with xp / achievements / per-verb levels intact', () => {
  const s = migrate(JSON.parse(JSON.stringify(realStore())));
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.equal(s.stats.xp, 5230);
  assert.equal(s.stats.totalCorrect, 142);
  assert.equal(s.achievements.first, '2026-01-02T10:00:00.000Z');
  assert.equal(s.settings.name, 'Leo');
  assert.deepEqual(s.flags.unlocked, { fox: true, ocean: true });
  assert.equal(s.progress.go.past.lvl, 7);
  assert.equal(s.progress.go.pp.correct, 5);
});

test('an older-schema store still migrates (and would trigger a pre-migration backup)', () => {
  const old = JSON.parse(JSON.stringify(realStore()));
  old.schemaVersion = 3;                 // pretend it was saved by an older version
  assert.ok((old.schemaVersion || 1) < SCHEMA_VERSION);   // backup condition holds
  const s = migrate(old);
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.equal(s.stats.xp, 5230);        // data still intact after upgrade
});
