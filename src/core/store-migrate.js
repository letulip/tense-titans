// Store shape, defaults, and backward-compatible migrations. Pure and DOM-free —
// there is NO localStorage here (load/save live in app.js). The cardinal rule: a migration
// never drops a player's data. Unit-tested in test/store-migrate.test.js.
import { evoStageForLevel, levelFromXp } from './leveling.js';

export const SCHEMA_VERSION = 6;   // bump + add a migration when the store shape changes

export function defaultStore() {
  return {
    schemaVersion: SCHEMA_VERSION,
    progress: {},          // verbId -> { past:{lvl,due,peak,correct,wrong}, pp:{...}, lastSeen }
    stats: {
      xp: 0, dayStreak: 0, bestStreak: 0, lastStudyDate: null,
      totalAnswers: 0, totalCorrect: 0, history: {},
      typeCorrect: 0, matchCorrect: 0, speedBest: 0, speedBestClean: 0, maxCombo: 0,
      modesPlayed: {},
    },
    achievements: {},      // id -> ISO date unlocked
    settings: {
      name: '', mascot: 'dragon', theme: 'default', dark: false,
      sound: true, haptics: true, voiceURI: '', rate: 1, pitch: 1, dailyGoal: 10, reduceEffects: false,
    },
    flags: { onboarded: false, evoStage: 0, unlocked: {} },
  };
}

// Deep-ish merge that NEVER drops existing user fields, only fills gaps.
export function fillDefaults(target, defaults) {
  for (const k in defaults) {
    if (defaults[k] && typeof defaults[k] === 'object' && !Array.isArray(defaults[k])) {
      if (typeof target[k] !== 'object' || target[k] === null) target[k] = {};
      fillDefaults(target[k], defaults[k]);
    } else if (!(k in target)) {
      target[k] = defaults[k];
    }
  }
  return target;
}

export function migrate(s) {
  // Run sequential migrations; add new `if (s.schemaVersion < N)` blocks over time.
  // v1 -> v2: introduced `flags` (onboarding + mascot evolution). Existing players
  // already have progress, so mark them onboarded so we don't replay the intro.
  if ((s.schemaVersion || 1) < 2) {
    s.flags = s.flags || {};
    const hasProgress = s.progress && Object.keys(s.progress).length > 0;
    if (s.flags.onboarded === undefined) s.flags.onboarded = hasProgress;
  }
  // v2 -> v3: single Leitner `box` (0–5) becomes per-form levels (past + participle, 0–10)
  // with spaced-repetition scheduling. Map old box to a roughly equivalent level on both forms.
  if ((s.schemaVersion || 1) < 3 && s.progress) {
    const boxToLvl = { 0: 0, 1: 2, 2: 3, 3: 4, 4: 5, 5: 7 };
    const now = Date.now();
    for (const id in s.progress) {
      const old = s.progress[id];
      if (old && old.box !== undefined && !old.past) {
        const lvl = boxToLvl[Math.min(old.box, 5)] ?? 0;
        s.progress[id] = {
          past: { lvl, due: now, peak: lvl, correct: old.correct || 0, wrong: old.wrong || 0 },
          pp:   { lvl, due: now, peak: lvl, correct: 0, wrong: 0 },
          lastSeen: old.lastSeen || 0,
        };
      }
    }
  }
  // v4 -> v5: cosmetics now unlock by meaningful milestones (mastery/streak/level),
  // not raw XP. Honestly re-lock everything, but keep whatever the player is currently
  // wearing so nothing they chose disappears. markUnlocks() later re-grants any already met.
  if ((s.schemaVersion || 1) < 5) {
    s.flags = s.flags || {};
    s.flags.unlocked = {};
    const sel = s.settings || {};
    if (sel.mascot) s.flags.unlocked[sel.mascot] = true;
    if (sel.theme) s.flags.unlocked[sel.theme] = true;
    delete s._announced;   // old XP-announcement bookkeeping no longer used
  }
  // v5 -> v6: evolution now happens every 2 levels (steeper). Roll the saved evolution
  // high-water mark back to whatever the player's CURRENT XP/level earns under the new
  // thresholds, so over-evolved players climb (and re-celebrate) the stages again.
  if ((s.schemaVersion || 1) < 6) {
    s.flags = s.flags || {};
    s.flags.evoStage = evoStageForLevel(levelFromXp((s.stats && s.stats.xp) || 0));
  }
  // Always fill any newly-added default fields without dropping the player's data.
  s = fillDefaults(s, defaultStore());
  s.schemaVersion = SCHEMA_VERSION;
  return s;
}
