// Leveling, ranks, and mascot-evolution math.
// Pure and DOM-free: every function takes its inputs as arguments and returns a value,
// so this module can be unit-tested in Node (see test/leveling.test.js).

// Mascot evolution thresholds (by level): stage advances at Lv 3 / 5 / 7 / 9 / 11.
// Cumulative XP for those levels is ~300 / 1500 / 6300 / 25500 / 102300 — a real climb.
export const EVO_LEVELS = [3, 5, 7, 9, 11];

// One rank per evolution stage — rank advances on the same milestones as the mascot.
export const RANKS = ['Novice', 'Apprentice', 'Squire', 'Knight', 'Champion', 'Titan'];

// Geometric level cost: level L costs 100·(2^(L-1) − 1) total XP.
// Cumulative: 0 / 100 / 300 / 700 / 1500 / 3100 / 6300 / 12700 …
export const xpForLevel = (L) => 100 * (Math.pow(2, L - 1) - 1);

export const levelFromXp = (xp) => { let L = 1; while (xpForLevel(L + 1) <= xp) L++; return L; };

// XP earned within the current level.
export const xpIntoLevel = (xp) => xp - xpForLevel(levelFromXp(xp));

// Total XP span of the current level.
export const xpForNextLevel = (xp) => { const L = levelFromXp(xp); return xpForLevel(L + 1) - xpForLevel(L); };

// Evolution stage (0..5) for a given level.
export function evoStageForLevel(level) {
  let stage = 0;
  for (const lv of EVO_LEVELS) if (level >= lv) stage++;
  return stage;
}

// Rank title for a level — one stage maps to exactly one rank, so they level up together.
export function rankTitle(level) { return RANKS[evoStageForLevel(level)]; }
