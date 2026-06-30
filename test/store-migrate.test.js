import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, defaultStore, fillDefaults, migrate } from '../src/core/store-migrate.js';

test('fillDefaults: fills gaps, never overwrites or drops user data', () => {
  const t = { a: 1, nested: { x: 1 }, custom: 42 };
  fillDefaults(t, { a: 9, b: 2, nested: { x: 9, y: 3 } });
  assert.equal(t.a, 1);          // kept
  assert.equal(t.b, 2);          // filled
  assert.equal(t.nested.x, 1);   // kept
  assert.equal(t.nested.y, 3);   // filled
  assert.equal(t.custom, 42);    // unknown user field survives
});

test('fillDefaults: arrays are values, not merged', () => {
  const t = { arr: [1] };
  fillDefaults(t, { arr: [1, 2, 3] });
  assert.deepEqual(t.arr, [1]);
});

test('defaultStore: a fresh store is at the current schema and not onboarded', () => {
  const s = defaultStore();
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.equal(s.flags.onboarded, false);
  assert.deepEqual(s.progress, {});
});

test('migrate: a brand-new (empty) store gets full defaults, stays not-onboarded', () => {
  const s = migrate({});
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.ok(!s.flags.onboarded);                  // no prior progress -> intro will play (falsy)
  assert.equal(s.settings.haptics, true);         // default filled
  assert.equal(s.stats.xp, 0);
  assert.deepEqual(s.progress, {});
});

test('migrate v1 -> latest: legacy box progress becomes per-form levels, marked onboarded', () => {
  const s = migrate({ progress: { go: { box: 3, correct: 2, wrong: 1, lastSeen: 5 } } });
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.equal(s.flags.onboarded, true);          // had progress -> skip intro
  const go = s.progress.go;
  assert.ok(go.past && go.pp, 'converted to per-form shape');
  assert.equal(go.past.lvl, 4);                   // box 3 -> lvl 4
  assert.equal(go.pp.lvl, 4);
  assert.equal(go.past.correct, 2);               // carried over
  assert.equal(go.past.wrong, 1);
  assert.equal(go.lastSeen, 5);
  assert.equal(go.box, undefined);                // old field replaced
});

test('migrate v4 -> v5: cosmetics re-lock but keep what the player is wearing', () => {
  const s = migrate({
    schemaVersion: 4,
    settings: { mascot: 'fox', theme: 'ocean' },
    flags: { unlocked: { dragon: true, fox: true, candy: true } },
  });
  assert.deepEqual(s.flags.unlocked, { fox: true, ocean: true });
});

test('migrate v5 -> v6: evolution stage is recomputed from current XP', () => {
  // xp 3100 -> level 6 -> evo stage 2 (EVO_LEVELS 3/5/7/9/11). An "over-evolved" stage 5 rolls back.
  const s = migrate({ schemaVersion: 5, stats: { xp: 3100 }, flags: { evoStage: 5, unlocked: {} } });
  assert.equal(s.flags.evoStage, 2);
});

test('migrate: a current-schema store keeps all user data intact', () => {
  const cur = defaultStore();
  cur.stats.xp = 5000;
  cur.achievements.first = '2026-01-01T00:00:00.000Z';
  cur.progress.go = { past: { lvl: 7, due: 0, peak: 7, correct: 9, wrong: 0 }, pp: { lvl: 6, due: 0, peak: 6, correct: 4, wrong: 1 }, lastSeen: 1 };
  cur.settings.name = 'Leo';
  const s = migrate(cur);
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.equal(s.stats.xp, 5000);
  assert.equal(s.achievements.first, '2026-01-01T00:00:00.000Z');
  assert.equal(s.progress.go.past.lvl, 7);
  assert.equal(s.settings.name, 'Leo');
});
