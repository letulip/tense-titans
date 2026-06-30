/* ============================================================
   Tense Titans — irregular verbs trainer (Phase 2)
   Vanilla JS, no build step, offline PWA.
   ============================================================ */
'use strict';

const APP_VERSION = '1.8.10';
const SCHEMA_VERSION = 6;        // bump + add a migration when store shape changes
const STORE_KEY = 'verbquest.store';
const NEW_PER_SESSION = 5;       // how many brand-new verbs to introduce per session

/* ---- Spaced-repetition progression (per form: past & participle) ---- */
const DAY = 86400000;
const FORM_MAX = 10;             // top per-form level
const PICK_FORM_CAP = 3;         // "Pick" (recognition) can raise a form only to level 3
const SCHEDULE_GATE = 3;         // at level >= this, a form advances only when it's "due"
// Days to wait after REACHING a level before the form is due to advance again (index = level).
// Fibonacci-flavoured, tuned so: Growing(5)≈3–5d, Mastered(7)≈7–10d, Champion(10)≈3 weeks.
const INTERVAL_DAYS = [0, 0, 0, 1, 2, 3, 3, 4, 5, 6, 0];
// Stage thresholds by the WEAKER of the two forms (min level) — you must know BOTH.
const STAGE_MIN = { sprout: 3, growing: 5, mastered: 7, gold: 10 };
const STAGES = [
  { key: 'new',      emoji: '⚪', name: 'New',      hint: 'Not started yet' },
  { key: 'seedling', emoji: '🌱', name: 'Seedling', hint: 'Just started — keep answering' },
  { key: 'sprout',   emoji: '🌿', name: 'Sprout',   hint: 'Both forms recognised (lvl 3+)' },
  { key: 'growing',  emoji: '🪴', name: 'Growing',  hint: 'Both lvl 5+ — review over a few days' },
  { key: 'mastered', emoji: '🌳', name: 'Mastered', hint: 'Both lvl 7+ via ⌨️ Type it (~1 week+)' },
  { key: 'gold',     emoji: '🌟', name: 'Champion', hint: 'Both lvl 10 — kept perfect for weeks' },
];
// 6 illustrated evolution stages (images 1..6). Evolve every 2 levels -> stages 1..5.
const EVO_LEVELS = [3, 5, 7, 9, 11];   // ~300 / 1500 / 6300 / 25500 / 102300 XP — a real climb
const EVO_NAMES = ['Hatchling', 'Youngling', 'Adept', 'Warrior', 'Elder', 'Champion'];

/* ---------- Catalog of cosmetics (safe to extend freely) ---------- */
// Cosmetics unlock by MEANINGFUL milestones (req), not raw XP — see reqMet/reqText.
// req types: {level:n} | {mastered:n} | {streak:n} | {champion:n}. No req = always free.
const THEMES = [
  { id: 'default', name: 'Royal',  req: null },
  { id: 'ocean',   name: 'Ocean',  req: { type: 'level',    n: 4 } },
  { id: 'forest',  name: 'Forest', req: { type: 'streak',   n: 3 } },
  { id: 'candy',   name: 'Candy',  req: { type: 'mastered', n: 15 } },
  { id: 'sunset',  name: 'Sunset', req: { type: 'mastered', n: 30 } },
];
// forms = evolution chain: [baby, young, grown, champion]. The creature is always
// visible (so picking a mascot is obvious); evolution grows its size + adds a crown.
// img = filename prefix in images/mascots/<id>/<img>{1..6}-fs8.webp ; emoji used in settings only.
const MASCOTS = [
  { id: 'dragon', emoji: '🐉', name: 'Dragon',  img: 'dragon', req: null,                       forms: ['🐲', '🐲', '🐉', '🐉'] },
  { id: 'fox',    emoji: '🦊', name: 'Fox',     img: 'fox',    req: null,                       forms: ['🦊', '🦊', '🦊', '🦊'] },
  { id: 'owl',    emoji: '🦉', name: 'Owl',     img: 'owl',    req: { type: 'mastered', n: 5 }, forms: ['🦉', '🦉', '🦉', '🦉'] },
  { id: 'robot',  emoji: '🤖', name: 'Robot',   img: 'robot',  req: { type: 'level',    n: 6 }, forms: ['🤖', '🤖', '🤖', '🤖'] },
  { id: 'unicorn',emoji: '🦄', name: 'Unicorn', img: 'uni',    req: { type: 'streak',   n: 7 }, forms: ['🐴', '🐴', '🦄', '🦄'] },
];
const VOICE_PRESETS = [
  { id: 'normal',   name: 'Normal',   rate: 1.0, pitch: 1.0 },
  { id: 'robot',    name: '🤖 Robot',  rate: 0.8, pitch: 0.4 },
  { id: 'chipmunk', name: '🐿️ Chipmunk', rate: 1.4, pitch: 2.0 },
  { id: 'slowmo',   name: '🐢 Slow-mo', rate: 0.6, pitch: 1.0 },
];
const SPEED_SECONDS = 60;        // Speed round length
// hidden: true -> shown as "???" until earned
// Achievements are grouped into categories (shown as sections on the Achievements screen).
const ACH_CATS = [
  { id: 'progress',  name: '📈 Progress' },
  { id: 'modes',     name: '🎮 Game modes' },
  { id: 'challenge', name: '🏅 Challenges' },
];
const ACHIEVEMENTS = [
  // --- Progress ---
  { id: 'first',       cat: 'progress', ico: '👣', name: 'First steps',  desc: 'Answer your first verb' },
  { id: 'correct10',   cat: 'progress', ico: '✅', name: 'Getting it',   desc: '10 correct answers' },
  { id: 'correct50',   cat: 'progress', ico: '💪', name: 'On a roll',    desc: '50 correct answers' },
  { id: 'correct100',  cat: 'progress', ico: '🎯', name: 'Centurion',    desc: '100 correct answers' },
  { id: 'correct250',  cat: 'progress', ico: '🎓', name: 'Scholar',      desc: '250 correct answers' },
  { id: 'correct500',  cat: 'progress', ico: '🧠', name: 'Verb genius',  desc: '500 correct answers' },
  { id: 'streak3',     cat: 'progress', ico: '🔥', name: '3-day streak', desc: 'Practice 3 days in a row' },
  { id: 'streak7',     cat: 'progress', ico: '🌟', name: 'Week warrior', desc: 'Practice 7 days in a row' },
  { id: 'streak14',    cat: 'progress', ico: '📅', name: 'Fortnight',    desc: 'Practice 14 days in a row' },
  { id: 'streak30',    cat: 'progress', ico: '🗓️', name: 'Unstoppable',  desc: 'Practice 30 days in a row' },
  { id: 'mastered10',  cat: 'progress', ico: '🌳', name: 'Green thumb',  desc: 'Master 10 verbs' },
  { id: 'mastered25',  cat: 'progress', ico: '🏆', name: 'Verb master',  desc: 'Master 25 verbs' },
  { id: 'mastered50',  cat: 'progress', ico: '🌲', name: 'Forest keeper', desc: 'Master 50 verbs' },
  { id: 'masteredAll', cat: 'progress', ico: '📚', name: 'Completionist', desc: 'Master all 150 verbs' },
  { id: 'champion1',   cat: 'progress', ico: '👑', name: 'Legend',       desc: 'Get your first 🌟 Champion verb' },
  { id: 'champion10',  cat: 'progress', ico: '💎', name: 'Hall of fame', desc: 'Get 10 🌟 Champion verbs' },
  { id: 'level10',     cat: 'progress', ico: '🎖️', name: 'Veteran',      desc: 'Reach level 7' },
  { id: 'levelTen',    cat: 'progress', ico: '🏅', name: 'Double digits', desc: 'Reach level 10' },
  // --- Game modes ---
  { id: 'type50',      cat: 'modes', ico: '⌨️', name: 'Touch typist', desc: '50 correct in Type it' },
  { id: 'type100',     cat: 'modes', ico: '📝', name: 'Wordsmith',    desc: '100 correct in Type it' },
  { id: 'match25',     cat: 'modes', ico: '🌍', name: 'Translator',   desc: '25 correct in Match' },
  { id: 'match100',    cat: 'modes', ico: '🌐', name: 'Globetrotter', desc: '100 correct in Match' },
  { id: 'speed15',     cat: 'modes', ico: '⚡', name: 'Speed demon',  desc: 'Score 15+ in a Speed round' },
  { id: 'speed25',     cat: 'modes', ico: '🚀', name: 'Lightning',    desc: 'Score 25+ in a Speed round' },
  { id: 'speed35',     cat: 'modes', ico: '🛸', name: 'Supersonic',   desc: 'Score 35+ in a Speed round' },
  { id: 'combo10',     cat: 'modes', ico: '🔗', name: 'Combo master', desc: '10-answer combo in Speed' },
  { id: 'combo20',     cat: 'modes', ico: '⛓️', name: 'Unbroken',     desc: '20-answer combo in Speed' },
  { id: 'allModes',    cat: 'modes', ico: '🎮', name: 'Jack of all',  desc: 'Play all four game modes' },
  { id: 'polyglot',    cat: 'modes', ico: '🗺️', name: 'Polyglot',     desc: '50 correct in Match', hidden: true },
  { id: 'flawlessSpd', cat: 'modes', ico: '🛡️', name: 'Untouchable',  desc: 'Speed round 15+ with zero misses', hidden: true },
  // --- Challenges ---
  { id: 'perfect',     cat: 'challenge', ico: '💯', name: 'Flawless',     desc: 'A perfect session' },
  { id: 'bigday',      cat: 'challenge', ico: '🏃', name: 'Marathon',     desc: 'Answer 50 verbs in one day' },
  { id: 'evoMax',      cat: 'challenge', ico: '🐉', name: 'Final form',   desc: 'Evolve your mascot to the max' },
  { id: 'fixer',       cat: 'challenge', ico: '🔧', name: 'Mistake mender', desc: 'Clear a Trouble session with no misses' },
  { id: 'collector',   cat: 'challenge', ico: '🎨', name: 'Collector',    desc: 'Unlock every theme & mascot' },
  { id: 'nightOwl',    cat: 'challenge', ico: '🦉', name: 'Night Owl',    desc: 'Practice late at night', hidden: true },
  { id: 'earlyBird',   cat: 'challenge', ico: '🐤', name: 'Early Bird',   desc: 'Practice early in the morning', hidden: true },
  { id: 'comeback',    cat: 'challenge', ico: '💖', name: 'Comeback Kid', desc: 'Return after a week away', hidden: true },
  { id: 'perfectType', cat: 'challenge', ico: '✍️', name: 'Spotless',     desc: 'A perfect Type it session', hidden: true },
  { id: 'reviewZero',  cat: 'challenge', ico: '📭', name: 'Inbox zero',   desc: 'Clear every verb due for review', hidden: true },
  { id: 'owlAndBird',  cat: 'challenge', ico: '🌗', name: 'Round the clock', desc: 'Practice both late night and early morning', hidden: true },
];

/* ---------- State ---------- */
let VERBS = [];
let verbById = {};
let EXAMPLES = {};            // verbId -> [baseSentence, pastSentence, ppSentence] (form in *asterisks*)
let store = null;
let voices = [];
let session = null;
let evoAnimPending = false;   // play the evolution pop on the next home render

/* ============================================================
   Store: load / migrate / save  (backward compatible)
   ============================================================ */
function defaultStore() {
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
function fillDefaults(target, defaults) {
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

function migrate(s) {
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

function loadStore() {
  let s;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    s = raw ? JSON.parse(raw) : defaultStore();
  } catch (e) {
    console.warn('Store corrupt, starting fresh but keeping a backup.', e);
    try { localStorage.setItem(STORE_KEY + '.broken', localStorage.getItem(STORE_KEY) || ''); } catch (_) {}
    s = defaultStore();
  }
  store = migrate(s);
  saveStore();
}

let saveTimer = null;
function saveStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch (e) { console.error('save failed', e); }
  }, 60);
}

/* ============================================================
   Helpers
   ============================================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const todayKey = () => new Date().toISOString().slice(0, 10);
// Levels cost progressively more: level L costs 100·2^(L-1) XP, so the cumulative
// XP to REACH level L is 100·(2^(L-1) - 1)  ->  L1=0, L2=100, L3=300, L4=700, L5=1500…
const xpForLevel = (L) => 100 * (Math.pow(2, L - 1) - 1);
const levelFromXp = (xp) => { let L = 1; while (xpForLevel(L + 1) <= xp) L++; return L; };
const xpIntoLevel = (xp) => xp - xpForLevel(levelFromXp(xp));            // XP within the current level
const xpForNextLevel = (xp) => { const L = levelFromXp(xp); return xpForLevel(L + 1) - xpForLevel(L); }; // span of current level
// Rank titles by level (cosmetic motivator).
// One rank per evolution stage — rank advances on the same level milestones as the mascot (Lv 1/3/5/7/9/11).
const RANKS = ['Novice', 'Apprentice', 'Squire', 'Knight', 'Champion', 'Titan'];
function rankTitle(level) { return RANKS[evoStageForLevel(level)]; }

function newForm() { return { lvl: 0, due: 0, peak: 0, correct: 0, wrong: 0 }; }
function prog(id) {
  if (!store.progress[id]) store.progress[id] = { past: newForm(), pp: newForm(), lastSeen: 0 };
  return store.progress[id];
}
function isSeen(id) { return !!store.progress[id]; }
function minLvl(p) { return Math.min(p.past.lvl, p.pp.lvl); }
function masteredCount() {
  return VERBS.filter(v => { const p = store.progress[v.id]; return p && minLvl(p) >= STAGE_MIN.mastered; }).length;
}
// Map a verb to one of the named mastery stages, by the WEAKER of its two forms.
function stageOf(id) {
  const p = store.progress[id];
  if (!p) return { idx: 0, m: -1, ...STAGES[0] };
  const m = minLvl(p);
  let idx;
  if (m >= STAGE_MIN.gold) idx = 5;
  else if (m >= STAGE_MIN.mastered) idx = 4;
  else if (m >= STAGE_MIN.growing) idx = 3;
  else if (m >= STAGE_MIN.sprout) idx = 2;
  else idx = 1; // answered at least once
  return { idx, m, ...STAGES[idx] };
}

// ---- Forgetting curve: overdue forms slip levels (recover 2x faster via peak) ----
function graceDays(lvl) { return Math.max(2, 2 * (INTERVAL_DAYS[lvl] || 0)); }
function decayForm(f) {
  let guard = 0;
  while (f.lvl > 0 && f.due && Date.now() > f.due + graceDays(f.lvl) * DAY && guard++ < 30) {
    f.due += graceDays(f.lvl) * DAY;   // consume one grace window
    f.lvl -= 1;                        // ...and slip a level (peak is kept → fast relearn)
  }
}
function decayAll() {
  for (const id in store.progress) {
    const p = store.progress[id];
    if (p && p.past) { decayForm(p.past); decayForm(p.pp); }
  }
}
// Is a form ready to advance right now? (low levels are instant; high levels are scheduled)
function formDue(f) { return f.lvl < SCHEDULE_GATE || Date.now() >= (f.due || 0); }
// A scheduled form that is past its review date (the "do your reviews" queue).
function isReviewDue(f) { return f.lvl > 0 && f.lvl >= SCHEDULE_GATE && Date.now() >= (f.due || 0); }
function dueForms(p) {
  const out = [];
  if (isReviewDue(p.past)) out.push('past');
  if (isReviewDue(p.pp)) out.push('pp');
  return out;
}
// How many seen verbs have at least one form due for review right now.
function dueCount() {
  let n = 0;
  for (const v of VERBS) { const p = store.progress[v.id]; if (p && dueForms(p).length) n++; }
  return n;
}
// Flat, shuffled queue of every due form (a verb with both due appears twice).
function buildReviewQueue() {
  const q = [];
  for (const v of VERBS) {
    const p = store.progress[v.id];
    if (!p) continue;
    for (const which of dueForms(p)) q.push({ v, which });
  }
  return shuffle(q);
}

// "Trouble spots": verbs you keep missing (weighted by wrongs, low accuracy, low level).
function troubleScore(v) {
  const p = store.progress[v.id];
  if (!p) return 0;
  const wrongs = p.past.wrong + p.pp.wrong;
  if (wrongs === 0) return 0;
  // A verb is a "trouble spot" only while a missed form still sits below a stable level.
  // Once correct answers lift it back to the gate, it counts as fixed and leaves the list.
  if (minLvl(p) >= SCHEDULE_GATE) return 0;
  const total = wrongs + p.past.correct + p.pp.correct;
  const acc = total ? (p.past.correct + p.pp.correct) / total : 1;
  return wrongs * 2 + (1 - acc) * 10 + (SCHEDULE_GATE - minLvl(p)) * 2;
}
function troubleList(n = 10) {
  return VERBS.filter(v => troubleScore(v) > 0)
    .sort((a, b) => troubleScore(b) - troubleScore(a))
    .slice(0, n);
}
function troubleCount() { return VERBS.filter(v => troubleScore(v) > 0).length; }

// ---- Mascot evolution (Tamagotchi-style, driven by level) ----
function evoStageForLevel(level) {
  let stage = 0;
  for (const lv of EVO_LEVELS) if (level >= lv) stage++;
  return stage; // 0..3
}
function currentEvoStage() { return evoStageForLevel(levelFromXp(store.stats.xp)); }
function mascotDef() { return MASCOTS.find(m => m.id === store.settings.mascot) || MASCOTS[0]; }
function mascotFormEmoji(stage) { return mascotDef().forms[stage] || mascotDef().emoji; }
// Path to the illustrated artwork for an evolution stage (0..5 -> image 1..6).
function mascotImg(stage) { const m = mascotDef(); return `images/mascots/${m.id}/${m.img}${stage + 1}-fs8.webp`; }
// XP remaining until the next evolution (or null if maxed).
function xpToNextEvo() {
  const lvl = levelFromXp(store.stats.xp);
  const next = EVO_LEVELS.find(lv => lv > lvl);
  if (!next) return null;
  return xpForLevel(next) - store.stats.xp;
}
// Compare answers letters-only, so spacing / slashes / punctuation never matter.
function lettersOnly(s) { return String(s).toLowerCase().replace(/[^a-z]+/g, ''); }
// Robust check for answers that may have two valid forms ("was/were", "got/gotten").
// Accepts: either single form, the whole "was/were" token (Pick option), or both
// forms typed together in any order / separator ("was were", "were, was", ...).
function isCorrect(given, answer) {
  const g = lettersOnly(given);
  if (!g) return false;
  const variants = answer.split('/').map(lettersOnly).filter(Boolean);
  if (variants.includes(g)) return true;
  const joined = variants.join('');
  const joinedRev = [...variants].reverse().join('');
  return g === joined || g === joinedRev;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* ============================================================
   Navigation
   ============================================================ */
function show(screen) {
  $$('.screen').forEach(s => s.classList.add('hidden'));
  $('#screen-' + screen).classList.remove('hidden');
  window.scrollTo(0, 0);
  if (screen === 'home') renderHome();
  if (screen === 'stats') renderStats();
  if (screen === 'achievements') renderAchievements();
  if (screen === 'settings') renderSettings();
}

/* ============================================================
   Spaced-repetition selection (Leitner-flavoured)
   ============================================================ */
function pickVerb(excludeId, newBudgetRef) {
  const pool = [];
  for (const v of VERBS) {
    if (v.id === excludeId) continue;
    const p = store.progress[v.id];
    let weight;
    if (!p) {
      weight = newBudgetRef.left > 0 ? 8 : 0.2;   // gate how many new verbs appear
    } else {
      const m = minLvl(p);
      weight = (FORM_MAX + 1 - m);                // weaker verbs -> higher priority
      if (formDue(p.past) || formDue(p.pp)) weight *= 2.2;   // due for review -> surface it
      else weight *= 0.3;                                    // not due -> show rarely
      if (m >= STAGE_MIN.mastered) weight *= 0.6;            // mastered shows less (unless due)
    }
    if (weight > 0) pool.push({ v, weight });
  }
  if (!pool.length) return VERBS[Math.floor(Math.random() * VERBS.length)];
  let total = pool.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const item of pool) { r -= item.weight; if (r <= 0) {
    if (!store.progress[item.v.id]) newBudgetRef.left--;
    return item.v;
  } }
  return pool[pool.length - 1].v;
}

// Test the form that needs work most: prefer a due form, then the lower level.
function chooseForm(v) {
  const p = store.progress[v.id];
  if (!p) return Math.random() < 0.5 ? 'past' : 'pp';
  const need = (f) => (formDue(f) ? 100 : 0) + (FORM_MAX - f.lvl);
  const np = need(p.past), npp = need(p.pp);
  if (np === npp) return Math.random() < 0.5 ? 'past' : 'pp';
  return np > npp ? 'past' : 'pp';
}

/* ============================================================
   Session / gameplay
   ============================================================ */
function startSession(mode, customQueue) {
  // Only the four game modes count toward the "played all modes" achievement.
  if (['pick', 'type', 'match', 'speed'].includes(mode)) store.stats.modesPlayed[mode] = true;
  let queue = customQueue || null, total = store.settings.dailyGoal || 10;
  if (mode === 'review') {
    queue = buildReviewQueue();
    if (!queue.length) { show('home'); return; }   // nothing due — safety
  }
  if (queue) total = Math.min(queue.length, 30);
  session = {
    mode, total, index: 0, correct: 0, answered: 0, gainedXp: 0,
    lastId: null, newBudget: { left: NEW_PER_SESSION }, q: null, queue,
    // speed-round state
    score: 0, combo: 0, bestCombo: 0, misses: 0,
    endTime: mode === 'speed' ? Date.now() + SPEED_SECONDS * 1000 : 0,
    timer: null, ended: false,
  };
  document.getElementById('screen-play').classList.toggle('mode-speed', mode === 'speed');
  show('play');
  if (mode === 'speed') {
    session.timer = setInterval(tickSpeed, 100);
    tickSpeed();
  }
  nextQuestion();
}

function tickSpeed() {
  if (!session || session.mode !== 'speed' || session.ended) return;
  const left = Math.max(0, session.endTime - Date.now());
  $('#play-timer-fill').style.width = (left / (SPEED_SECONDS * 1000) * 100) + '%';
  $('#play-count').textContent = '⏱ ' + Math.ceil(left / 1000) + 's';
  $('#play-score').textContent = '🏆 ' + session.score;
  if (left <= 0) endSpeed();
}

function nextQuestion() {
  if (session.mode === 'speed') {
    if (session.ended || Date.now() >= session.endTime) return endSpeed();
  } else if (session.index >= session.total) {
    return endSession();
  }
  session.answered = false;
  let v, which = null;
  if (session.queue) {            // review / trouble-spots use a fixed queue
    const item = session.queue[session.index];
    v = item.v; which = item.which || null;
  } else {
    v = pickVerb(session.lastId, session.newBudget);
    session.lastId = v.id;
  }
  if (session.mode === 'match') {
    session.q = { kind: 'translate', v, answer: v.ru.join(', ') };
  } else {
    which = which || chooseForm(v);   // test the form that needs it most
    session.q = { kind: 'form', v, which, answer: v[which] };
  }
  renderQuestion();
}

function renderQuestion() {
  const { v, kind } = session.q;
  if (session.mode !== 'speed') {
    $('#play-count').textContent = (session.index + 1) + '/' + session.total;
    $('#play-progress-fill').style.width = (session.index / session.total * 100) + '%';
  }
  $('#feedback').textContent = '';
  $('#feedback').className = 'feedback';
  $('#example').classList.add('hidden');
  $('#next-btn').classList.add('hidden');
  $('#translation').classList.add('hidden');
  $('#translation').textContent = v.ru.join(', ');
  $('#translate-btn').classList.toggle('hidden', kind === 'translate'); // no hint button when translation IS the question

  if (kind === 'translate') {
    $('#triple').innerHTML = `
      <div class="label">what does it mean?</div>
      <div class="form-line"><span class="form">${v.base}</span></div>
      <div class="sub-forms">${v.past} · ${v.pp}</div>`;
  } else {
    const which = session.q.which;
    const pastCell = which === 'past' ? `<span class="blank" id="blank">?</span>` : `<span class="form muted">${v.past}</span>`;
    const ppCell = which === 'pp' ? `<span class="blank" id="blank">?</span>` : `<span class="form muted">${v.pp}</span>`;
    $('#triple').innerHTML = `
      <div class="label">base · past · participle</div>
      <div class="form-line">
        <span class="form">${v.base}</span><span class="arrow">→</span>${pastCell}<span class="arrow">→</span>${ppCell}
      </div>`;
  }

  const area = $('#answer-area');
  area.innerHTML = '';
  if (kind === 'translate') buildTranslateOptions(area);
  else if (session.mode === 'type' || session.mode === 'review') buildTypeInput(area);  // recall
  else buildOptions(area);              // pick, speed, trouble -> multiple choice
}

// A naive over-regularized form (cut -> cuted) — a realistic learner mistake. Kept naive (no
// consonant doubling) on purpose, so it can't accidentally match a real form like "quitted"/"wedded".
function regularize(base) {
  if (/[^aeiou]y$/i.test(base)) return base.slice(0, -1) + 'ied';
  if (/e$/i.test(base)) return base + 'd';
  return base + 'ed';
}
// The clean -t/-ed pairs (burn, learn, spell…) now carry BOTH forms in verbs.json ("burnt/burned"),
// so isCorrect accepts either and the -ed distractor is auto-rejected. This set is only the verbs
// whose -ed form is valid but rarer/sense-specific (kept single-form), so we skip the -ed trap there.
const ED_ALSO_VALID = new Set(['kneel', 'light', 'speed', 'shine', 'broadcast']);

function buildOptions(area) {
  const { v, which, answer } = session.q;
  const opts = new Set([answer]);
  // Sneaky trap: the verb's OTHER form (past<->participle), e.g. "gone" when asked for "went".
  const otherForm = which === 'past' ? v.pp : v.past;
  if (otherForm && !isCorrect(otherForm, answer)) {
    opts.add(otherForm);
  } else if (!ED_ALSO_VALID.has(v.id)) {
    // past == participle (or never-changing): trap with the wrong "-ed" form (bringed, cuted...)
    const reg = regularize(v.base);
    if (reg && !isCorrect(reg, answer)) opts.add(reg);
  }
  // Fill the rest with same-type forms from other verbs.
  const others = VERBS.filter(x => x.id !== v.id).map(x => x[which]);
  while (opts.size < 4 && others.length) opts.add(others[Math.floor(Math.random() * others.length)]);
  for (const opt of shuffle(Array.from(opts))) {
    const b = document.createElement('button');
    b.className = 'opt-btn';
    b.textContent = opt;
    b.onclick = () => handleAnswer(opt, b);
    area.appendChild(b);
  }
}

function buildTranslateOptions(area) {
  const answer = session.q.answer;                 // correct ru joined
  const others = VERBS.filter(x => x.id !== session.q.v.id).map(x => x.ru.join(', '));
  const opts = new Set([answer]);
  while (opts.size < 4 && others.length) opts.add(others[Math.floor(Math.random() * others.length)]);
  for (const opt of shuffle(Array.from(opts))) {
    const b = document.createElement('button');
    b.className = 'opt-btn ru';
    b.textContent = opt;
    b.onclick = () => handleAnswer(opt, b);
    area.appendChild(b);
  }
}

function buildTypeInput(area) {
  const row = document.createElement('div');
  row.className = 'type-row';
  const input = document.createElement('input');
  input.className = 'type-input';
  input.type = 'text';
  input.autocapitalize = 'none';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'type here…';
  const btn = document.createElement('button');
  btn.className = 'big-btn check-btn';
  btn.textContent = 'Check';
  const submit = () => { if (!session.answered && input.value.trim()) handleAnswer(input.value, input); };
  btn.onclick = submit;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  row.appendChild(input);
  row.appendChild(btn);
  area.appendChild(row);
  setTimeout(() => input.focus(), 50);
}

function addXp(n) { store.stats.xp += n; session.gainedXp += n; }

function handleAnswer(given, el) {
  if (session.answered) return;
  session.answered = true;
  const q = session.q, answer = q.answer;
  const ok = q.kind === 'translate' ? given === answer : isCorrect(given, answer);
  store.stats.totalAnswers++;
  if (ok) { session.correct++; store.stats.totalCorrect++; }

  let hint = '';
  if (q.kind === 'form' && ['pick', 'type', 'review', 'trouble'].includes(session.mode)) {
    // --- spaced-repetition leveling (learning + review + trouble modes) ---
    const recall = session.mode === 'type' || session.mode === 'review';   // typed = recall
    const p = prog(q.v.id), f = p[q.which];
    p.lastSeen = Date.now();
    if (ok) {
      f.correct++;
      if (recall) store.stats.typeCorrect++;
      addXp(recall || session.mode === 'trouble' ? 15 : 10);   // fixing mistakes pays a bonus
      if (session.mode === 'trouble') {
        // Focused drill: a correct recall lifts the weak form back to the stable gate,
        // so a fixed verb actually drops off the trouble list.
        if (f.lvl < SCHEDULE_GATE) { f.lvl = SCHEDULE_GATE; f.peak = Math.max(f.peak, f.lvl); }
        f.due = Date.now() + (INTERVAL_DAYS[f.lvl] || 0) * DAY;
        hint = minLvl(p) >= SCHEDULE_GATE ? '✅ Fixed!' : 'Good — its other form still needs a fix';
      } else {
        const modeCap = recall ? FORM_MAX : PICK_FORM_CAP;
        if (f.lvl >= modeCap) {
          hint = !recall ? 'Switch to ⌨️ Type it to level up!' : '';
        } else if (f.lvl >= SCHEDULE_GATE && Date.now() < (f.due || 0)) {
          hint = 'Counts! Comes back for review later ⏳';
        } else {
          f.lvl++;
          f.peak = Math.max(f.peak, f.lvl);
          let wait = INTERVAL_DAYS[f.lvl] || 0;
          if (f.lvl < f.peak) wait = Math.ceil(wait / 2);
          f.due = Date.now() + wait * DAY;
          if (minLvl(p) === STAGE_MIN.mastered) hint = '🌳 Mastered!';
          else if (minLvl(p) === STAGE_MIN.gold) hint = '🌟 Champion verb!';
        }
      }
    } else {
      f.wrong++; f.lvl = Math.max(0, f.lvl - 2); f.due = Date.now();
    }
  } else if (q.kind === 'translate') {
    if (ok) { store.stats.matchCorrect++; addXp(8); }
  } else if (session.mode === 'speed') {
    if (ok) {
      session.score++; session.combo++;
      session.bestCombo = Math.max(session.bestCombo, session.combo);
      store.stats.maxCombo = Math.max(store.stats.maxCombo || 0, session.combo);
      addXp(5 + Math.min(session.combo, 5));   // combo bonus
    } else { session.misses++; session.combo = 0; }
  }

  // --- feedback / juice ---
  if (ok) {
    feedbackGood(el, answer, hint);
    sfx(session.mode === 'speed' && session.combo >= 3 ? 'combo' : 'good');
    confettiBurst(session.combo >= 5 ? 22 : 12);
    if (session.mode === 'speed' && session.combo >= 3) showCombo(session.combo);
  } else {
    feedbackBad(el, answer);
    sfx('bad');
  }
  haptic(ok);
  speak(q.kind === 'translate' ? q.v.base : answer);   // always voice the correct answer, even on a miss

  const blank = $('#blank');
  if (blank) { blank.textContent = answer; blank.classList.add('filled'); if (!ok) blank.classList.add('wrong'); }

  // Any multiple-choice mode (pick / speed / match / trouble): mark the right option, flag the wrong pick.
  $$('.opt-btn').forEach(b => {
    b.disabled = true;
    const isAns = q.kind === 'translate' ? b.textContent === answer : isCorrect(b.textContent, answer);
    if (isAns) b.classList.add('correct');
    else if (b === el && !ok) b.classList.add('wrong');
  });
  // Type / review: lock the field and drop the now-useless Check button (Next takes over).
  const checkBtn = $('.check-btn');
  if (checkBtn) checkBtn.classList.add('hidden');
  const typedInput = $('.type-input');
  if (typedInput) typedInput.disabled = true;

  checkAchievements();
  saveStore();

  if (session.mode === 'speed') {
    setTimeout(nextQuestion, ok ? 300 : 650);   // timed: keep it fast, no examples
  } else {
    session.index++;
    $('#play-progress-fill').style.width = (session.index / session.total * 100) + '%';
    // show the verb in example sentences and wait for the player to tap Next
    renderExample(q.v);
    const nb = $('#next-btn');
    nb.textContent = session.index >= session.total ? 'Finish →' : 'Next →';
    nb.classList.remove('hidden');
    setTimeout(() => nb.focus(), 50);
  }
}

function feedbackGood(el, answer, hint) {
  const f = $('#feedback');
  f.textContent = pickFrom(['Nice! 🎉', 'Correct! ⭐', 'Yes! 🔥', 'Great! 💪']) + (hint ? '  ·  ' + hint : '');
  f.className = 'feedback good';
  $('#verb-card').classList.add('pop');
  setTimeout(() => $('#verb-card').classList.remove('pop'), 400);
}
function feedbackBad(el, answer) {
  const f = $('#feedback');
  f.textContent = 'Answer: ' + answer;
  f.className = 'feedback bad';
  if (el) { el.classList.add('shake', 'wrong'); setTimeout(() => el.classList.remove('shake'), 350); }
}

// Show the verb in three example sentences (base / past / participle), form highlighted.
function boldForm(s) { return String(s).replace(/\*([^*]+)\*/g, '<b>$1</b>'); }
function renderExample(v) {
  const ex = EXAMPLES[v.id], el = $('#example');
  if (!ex) { el.classList.add('hidden'); return; }
  const labels = ['base', 'past', 'participle'];
  el.innerHTML = `<div class="ex-title">📖 ${v.base} in sentences</div>` +
    ex.map((s, i) => `<div class="ex-line"><span class="ex-label">${labels[i]}</span><span class="ex-sent">${boldForm(s)}</span></div>`).join('');
  el.classList.remove('hidden');
}

// Streak + daily-goal history bookkeeping (any mode counts toward the streak).
function recordSession(answered) {
  const today = todayKey(), last = store.stats.lastStudyDate;
  if (last !== today) {
    const y = new Date(Date.now() - DAY).toISOString().slice(0, 10);
    store.stats.dayStreak = (last === y) ? store.stats.dayStreak + 1 : 1;
    store.stats.lastStudyDate = today;
    store.stats.bestStreak = Math.max(store.stats.bestStreak, store.stats.dayStreak);
  }
  store.stats.history[today] = (store.stats.history[today] || 0) + answered;
}

function collectRewards() {
  const unlocks = checkUnlocks();
  checkAchievements();
  const newEvo = currentEvoStage();
  let evolved = null;
  if (newEvo > (store.flags.evoStage || 0)) { evolved = newEvo; store.flags.evoStage = newEvo; evoAnimPending = true; }
  return { unlocks, evolved };
}

function renderResultUnlocks(evolved, unlocks) {
  const ul = $('#results-unlocks'); ul.innerHTML = '';
  if (evolved !== null) {
    const d = document.createElement('div'); d.className = 'unlock-pill evo';
    d.textContent = `${mascotFormEmoji(evolved)} Your ${mascotDef().name} evolved to ${EVO_NAMES[evolved]}!`;
    ul.appendChild(d);
  }
  unlocks.forEach(u => {
    const d = document.createElement('div'); d.className = 'unlock-pill';
    d.textContent = '🔓 Unlocked: ' + u; ul.appendChild(d);
  });
}
function setResultLabels(a, b, c) {
  $('#results-l1').textContent = a; $('#results-l2').textContent = b; $('#results-l3').textContent = c;
}

function endSession() {
  recordSession(session.total);
  const acc = session.total ? Math.round(session.correct / session.total * 100) : 0;
  const perfect = session.correct === session.total && session.total > 0;
  if (perfect) { addXp(20); unlockAchievement('perfect'); }
  if (perfect && session.mode === 'trouble') unlockAchievement('fixer');
  if (perfect && session.mode === 'type') unlockAchievement('perfectType');
  if (session.mode === 'review' && dueCount() === 0) unlockAchievement('reviewZero');
  const { unlocks, evolved } = collectRewards();
  saveStore();

  const titles = {
    review:  perfect ? 'Reviews cleared! 🔔' : 'Reviews done!',
    trouble: perfect ? 'Trouble cleared! 💪' : 'Good practice!',
  };
  $('#results-emoji').textContent = perfect ? '🏆' : (acc >= 60 ? '🎉' : '💡');
  $('#results-title').textContent = titles[session.mode] || (perfect ? 'Flawless quest!' : 'Quest complete!');
  $('#results-correct').textContent = session.correct + '/' + session.total;
  $('#results-accuracy').textContent = acc + '%';
  $('#results-xp').textContent = '+' + session.gainedXp;
  setResultLabels('correct', 'accuracy', 'XP');
  renderResultUnlocks(evolved, unlocks);
  if (session.mode === 'trouble') {
    const left = troubleCount();
    const d = document.createElement('div'); d.className = 'unlock-pill';
    d.textContent = left === 0 ? '🎉 All trouble spots cleared!' : `🛠️ ${left} verb${left > 1 ? 's' : ''} still to fix`;
    $('#results-unlocks').appendChild(d);
  }
  if (perfect) confettiBurst(40);
  show('results');
}

function endSpeed() {
  if (session.ended) return;
  session.ended = true;
  clearInterval(session.timer);
  recordSession(session.score);
  store.stats.speedBest = Math.max(store.stats.speedBest || 0, session.score);
  if (session.misses === 0 && session.score > 0) store.stats.speedBestClean = Math.max(store.stats.speedBestClean || 0, session.score);
  const { unlocks, evolved } = collectRewards();
  saveStore();

  $('#results-emoji').textContent = session.score >= 20 ? '🚀' : session.score >= 10 ? '⚡' : '⏱️';
  $('#results-title').textContent = 'Time! Speed round done';
  $('#results-correct').textContent = session.score;
  $('#results-accuracy').textContent = '🔗 ' + session.bestCombo;
  $('#results-xp').textContent = '+' + session.gainedXp;
  setResultLabels('score', 'best combo', 'XP');
  renderResultUnlocks(evolved, unlocks);
  if (session.score >= 15) confettiBurst(40);
  show('results');
}

/* ============================================================
   Achievements & unlocks
   ============================================================ */
function championCount() {
  return VERBS.filter(v => { const p = store.progress[v.id]; return p && minLvl(p) >= STAGE_MIN.gold; }).length;
}
function unlockAchievement(id) {
  if (store.achievements[id]) return false;
  store.achievements[id] = new Date().toISOString();
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (a) showAchievementPop(a);
  return true;
}
function checkAchievements() {
  const st = store.stats, hour = new Date().getHours();
  if (st.totalAnswers >= 1) unlockAchievement('first');
  if (st.totalCorrect >= 10) unlockAchievement('correct10');
  if (st.totalCorrect >= 50) unlockAchievement('correct50');
  if (st.totalCorrect >= 100) unlockAchievement('correct100');
  if (st.totalCorrect >= 250) unlockAchievement('correct250');
  if (st.totalCorrect >= 500) unlockAchievement('correct500');
  if (st.dayStreak >= 3) unlockAchievement('streak3');
  if (st.dayStreak >= 7) unlockAchievement('streak7');
  if (st.dayStreak >= 14) unlockAchievement('streak14');
  if (st.dayStreak >= 30) unlockAchievement('streak30');
  const mc = masteredCount();
  if (mc >= 10) unlockAchievement('mastered10');
  if (mc >= 25) unlockAchievement('mastered25');
  if (mc >= 50) unlockAchievement('mastered50');
  if (mc >= VERBS.length && VERBS.length > 0) unlockAchievement('masteredAll');
  const cc = championCount();
  if (cc >= 1) unlockAchievement('champion1');
  if (cc >= 10) unlockAchievement('champion10');
  if ((st.typeCorrect || 0) >= 50) unlockAchievement('type50');
  if ((st.typeCorrect || 0) >= 100) unlockAchievement('type100');
  if ((st.matchCorrect || 0) >= 25) unlockAchievement('match25');
  if ((st.matchCorrect || 0) >= 50) unlockAchievement('polyglot');
  if ((st.matchCorrect || 0) >= 100) unlockAchievement('match100');
  if ((st.speedBest || 0) >= 15) unlockAchievement('speed15');
  if ((st.speedBest || 0) >= 25) unlockAchievement('speed25');
  if ((st.speedBest || 0) >= 35) unlockAchievement('speed35');
  if ((st.maxCombo || 0) >= 10) unlockAchievement('combo10');
  if ((st.maxCombo || 0) >= 20) unlockAchievement('combo20');
  if ((st.speedBestClean || 0) >= 15) unlockAchievement('flawlessSpd');
  if (Object.keys(st.modesPlayed || {}).length >= 4) unlockAchievement('allModes');
  if (levelFromXp(st.xp) >= 7) unlockAchievement('level10');
  if (levelFromXp(st.xp) >= 10) unlockAchievement('levelTen');
  if ((st.history[todayKey()] || 0) >= 50) unlockAchievement('bigday');
  if (currentEvoStage() >= EVO_NAMES.length - 1) unlockAchievement('evoMax');
  if (cosmeticList().every(isUnlocked)) unlockAchievement('collector');
  if (hour >= 22 || hour < 5) unlockAchievement('nightOwl');
  if (hour >= 5 && hour < 8) unlockAchievement('earlyBird');
  if (store.achievements.nightOwl && store.achievements.earlyBird) unlockAchievement('owlAndBird');
  if (store.flags && store.flags.comebackPending) unlockAchievement('comeback');
}

// Animated unlock banner (queued so multiple unlocks don't overlap).
let achQueue = [];
function showAchievementPop(a) { achQueue.push(a); if (achQueue.length === 1) drainAchQueue(); }
function drainAchQueue() {
  const a = achQueue[0]; if (!a) return;
  const el = $('#ach-pop');
  el.innerHTML = `<div class="ap-ico">${a.ico}</div><div class="ap-txt"><div class="ap-title">Achievement unlocked!</div><div class="ap-name">${a.name}</div></div>`;
  el.classList.remove('hidden', 'show'); void el.offsetWidth; el.classList.add('show');
  sfx('achievement'); confettiBurst(26);
  setTimeout(() => {
    el.classList.add('hidden'); el.classList.remove('show');
    achQueue.shift(); if (achQueue.length) drainAchQueue();
  }, 2700);
}
/* ============================================================
   Cosmetic unlocks (meaningful milestones, sticky once earned)
   ============================================================ */
function reqMet(req) {
  if (!req) return true;
  const st = store.stats;
  switch (req.type) {
    case 'level':    return levelFromXp(st.xp) >= req.n;
    case 'mastered': return masteredCount() >= req.n;
    case 'streak':   return st.bestStreak >= req.n;   // best ever, so it never re-locks
    case 'champion': return championCount() >= req.n;
    default:         return true;
  }
}
function reqText(req) {
  if (!req) return '';
  switch (req.type) {
    case 'level':    return 'Reach level ' + req.n;
    case 'mastered': return 'Master ' + req.n + ' verbs 🌳';
    case 'streak':   return req.n + '-day streak 🔥';
    case 'champion': return req.n + ' Champion verb 🌟';
    default:         return '';
  }
}
function unlockedMap() { if (!store.flags.unlocked) store.flags.unlocked = {}; return store.flags.unlocked; }
function isUnlocked(c) { return !c.req || !!unlockedMap()[c.id] || reqMet(c.req); }
function cosmeticList() {
  return [...THEMES.map(t => ({ ...t, kind: 'Theme' })), ...MASCOTS.map(m => ({ ...m, kind: 'Mascot' }))];
}
// Flag any newly-earned cosmetics (sticky) and return them for announcement.
function markUnlocks() {
  const u = unlockedMap(), newly = [];
  for (const c of cosmeticList()) {
    if (c.req && !u[c.id] && reqMet(c.req)) { u[c.id] = true; newly.push(c); }
  }
  if (newly.length) saveStore();
  return newly;
}
// Names of cosmetics newly unlocked this session (for the results screen).
function checkUnlocks() {
  return markUnlocks().map(c => c.kind + ' ' + (c.name || c.emoji));
}

/* ============================================================
   Speech & sound
   ============================================================ */
function loadVoices() {
  voices = (window.speechSynthesis ? speechSynthesis.getVoices() : [])
    .filter(v => /en(-|_)/i.test(v.lang) || /^en$/i.test(v.lang));
  if (!voices.length && window.speechSynthesis) voices = speechSynthesis.getVoices();
}
function speak(text) {
  if (!store.settings.sound || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/\//g, ' or '));
    const v = voices.find(v => v.voiceURI === store.settings.voiceURI);
    if (v) u.voice = v;
    u.rate = store.settings.rate || 1;
    u.pitch = store.settings.pitch || 1;
    u.lang = (v && v.lang) || 'en-US';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}
// Speak a short sample with the CURRENT voice/rate/pitch (so settings give feedback).
let voicePreviewTimer = null;
function previewVoice(delay = 0) {
  clearTimeout(voicePreviewTimer);
  voicePreviewTimer = setTimeout(() => speak('Go, went, gone'), delay);
}
// Highlight the preset whose rate+pitch matches the current settings (if any).
function markActivePreset() {
  $$('#preset-row .preset-opt').forEach(b => {
    const p = VOICE_PRESETS.find(x => x.id === b.dataset.preset);
    b.classList.toggle('active', !!p && store.settings.rate === p.rate && store.settings.pitch === p.pitch);
  });
}

// tiny WebAudio note sequences so we don't ship sound files
let audioCtx = null;
const SFX = {
  good:        [[660, 0], [880, 0.09]],
  bad:         [[300, 0], [200, 0.12]],
  combo:       [[660, 0], [880, 0.06], [1175, 0.12]],
  achievement: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32]],
};
function sfx(type) {
  if (!store.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = SFX[type] || SFX.good;
    const t0 = audioCtx.currentTime;
    notes.forEach(([f, dt]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'sine'; o.frequency.value = f;
      const t = t0 + dt;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
      o.start(t); o.stop(t + 0.2);
    });
  } catch (e) { /* ignore */ }
}
// Haptic feedback (Android): single buzz on correct, double on wrong.
function haptic(ok) {
  if (!store.settings.haptics || !navigator.vibrate) return;
  try { navigator.vibrate(ok ? 35 : [30, 60, 30]); } catch (e) { /* ignore */ }
}

// Lightweight confetti (DOM particles, auto-removed). Visual only.
function confettiBurst(n = 14) {
  if (reduceMotion()) return;
  const root = $('#confetti'); if (!root) return;
  const colors = ['#ffd166', '#6c5ce7', '#2ecc71', '#ff6b6b', '#a29bfe', '#00b3c4'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = (50 + (Math.random() * 46 - 23)) + '%';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', (Math.random() * 220 - 110) + 'px');
    p.style.setProperty('--dy', (160 + Math.random() * 260) + 'px');
    p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    p.style.animationDelay = (Math.random() * 0.08) + 's';
    root.appendChild(p);
    setTimeout(() => p.remove(), 1300);
  }
}
function showCombo(n) {
  const el = $('#combo-badge'); if (!el) return;
  el.textContent = '🔥 ' + n + ' combo!';
  el.classList.remove('hidden', 'show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(showCombo._t);
  showCombo._t = setTimeout(() => el.classList.add('hidden'), 800);
}

/* ============================================================
   Rendering: home / stats / achievements / settings
   ============================================================ */
function reduceMotion() {
  return !!store.settings.reduceEffects ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function applyCosmetics() {
  document.documentElement.setAttribute('data-theme', store.settings.theme || 'default');
  document.documentElement.setAttribute('data-dark', store.settings.dark ? 'true' : 'false');
  document.documentElement.setAttribute('data-reduce', reduceMotion() ? 'true' : 'false');
}

function renderHome() {
  applyCosmetics();
  decayAll();
  const s = store.settings, st = store.stats;
  const stage = currentEvoStage();
  const mEl = $('#home-mascot');
  const src = mascotImg(stage);
  mEl.className = 'mascot-banner';
  mEl.innerHTML = `<img class="mascot-img" src="${src}" alt="${mascotDef().name}" />`;
  // graceful fallback to the emoji if the artwork can't load (e.g. offline & uncached)
  mEl.firstChild.onerror = () => { mEl.classList.add('emoji-fallback'); mEl.textContent = mascotDef().emoji; };
  mEl.onclick = () => openLightbox(src, `${mascotDef().name} · ${EVO_NAMES[stage]}`);
  if (evoAnimPending && !reduceMotion()) {   // just evolved -> pop the new artwork in
    evoAnimPending = false;
    void mEl.offsetWidth; mEl.classList.add('evolve-in');
    setTimeout(() => mEl.classList.remove('evolve-in'), 800);
  }
  $('#home-hello').textContent = s.name ? `Hey, ${s.name}!` : 'Hey, hero!';
  $('#home-sub').textContent = homeMood();
  $('#home-evo').textContent = evoCaption();
  $('#home-streak').textContent = st.dayStreak;
  $('#home-level').textContent = levelFromXp(st.xp);
  $('#home-mastered').textContent = masteredCount();
  const into = xpIntoLevel(st.xp), span = xpForNextLevel(st.xp);
  $('#home-xpfill').style.width = Math.min(100, into / span * 100) + '%';
  $('#home-xptext').textContent = st.xp + ' XP';
  $('#home-xpnext').textContent = 'Lv ' + (levelFromXp(st.xp) + 1) + ' in ' + (span - into) + ' XP';
  $('#home-rank').textContent = rankTitle(levelFromXp(st.xp));
  const doneToday = st.history[todayKey()] || 0;
  const goal = s.dailyGoal || 10;
  $('#home-goaltext').textContent = Math.min(doneToday, goal) + ' / ' + goal;
  $('#home-goalfill').style.width = Math.min(100, doneToday / goal * 100) + '%';
  // Review banner: show due count, or a calm "caught up" note
  const due = dueCount();
  const banner = $('#review-banner');
  banner.classList.toggle('hidden', due === 0);
  if (due > 0) $('#review-count').textContent = due;
  // Trouble-spots banner at the bottom: the verbs being missed most
  const tc = troubleCount();
  $('#trouble-banner').classList.toggle('hidden', tc === 0);
  if (tc > 0) $('#trouble-count').textContent = tc;
}

// Mascot speech bubble — reacts to streak / daily goal.
function homeMood() {
  const st = store.stats, goal = store.settings.dailyGoal || 10;
  const doneToday = st.history[todayKey()] || 0;
  const due = dueCount();
  if (due > 0) return `🔔 ${due} verb${due > 1 ? 's' : ''} due for review!`;
  if (doneToday >= goal) return pickFrom(["Goal smashed today! 🎉", "You did it today — bonus round? 💪"]);
  if (doneToday > 0) return `${goal - doneToday} more to hit today's goal!`;
  if (st.dayStreak >= 2) return `Day ${st.dayStreak} streak — don't break it! 🔥`;
  return pickFrom(["Ready for today's quest?", "Let's learn some verbs! ⚔️", "I'm ready when you are!"]);
}
// Little evolution nudge under the mascot.
function evoCaption() {
  const toNext = xpToNextEvo();
  if (toNext === null) return `👑 Champion ${mascotDef().name} — max evolution!`;
  return `✨ ${toNext} XP to evolve your ${mascotDef().name}`;
}

// GitHub-style activity heatmap of the last 12 weeks from stats.history.
function actLevel(c) { if (!c) return 0; if (c >= 20) return 4; if (c >= 10) return 3; if (c >= 5) return 2; return 1; }
function renderActivity() {
  const st = store.stats;
  $('#activity-streaks').innerHTML =
    `<span>🔥 Current <b>${st.dayStreak}</b></span><span>🏆 Best <b>${st.bestStreak}</b></span>`;
  const weeks = 12, total = weeks * 7;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const oldest = new Date(today.getTime() - (total - 1) * DAY);
  const padStart = (oldest.getDay() + 6) % 7;   // weekday with Monday = 0
  const grid = [];
  let week = new Array(padStart).fill(null);
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY);
    const key = d.toISOString().slice(0, 10);
    week.push({ key, count: st.history[key] || 0, isToday: i === 0 });
    if (week.length === 7) { grid.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); grid.push(week); }
  $('#activity-grid').innerHTML = grid.map(col =>
    `<div class="act-week">${col.map(cell => cell
      ? `<span class="act act-${actLevel(cell.count)}${cell.isToday ? ' today' : ''}" title="${cell.key}: ${cell.count}"></span>`
      : `<span class="act empty"></span>`).join('')}</div>`
  ).join('');
}

function renderStats() {
  const st = store.stats;
  decayAll();
  const inProgress = VERBS.filter(v => { const p = store.progress[v.id]; return p && minLvl(p) >= STAGE_MIN.sprout && minLvl(p) < STAGE_MIN.mastered; }).length;
  const acc = st.totalAnswers ? Math.round(st.totalCorrect / st.totalAnswers * 100) : 0;
  const due = dueCount();
  $('#stats-summary').innerHTML = `
    <div class="box"><b>${masteredCount()}</b><small>mastered 🌳</small></div>
    <div class="box"><b>${inProgress}</b><small>growing 🌿</small></div>
    <div class="box"><b>${acc}%</b><small>accuracy</small></div>
    <div class="box"><b>${due}</b><small>due now 🔔</small></div>`;

  renderActivity();

  // Legend: explain the stages and how to advance.
  $('#stats-legend').innerHTML = STAGES.map(s =>
    `<div class="legend-item"><span class="lg-emoji">${s.emoji}</span><span class="lg-text"><b>${s.name}</b> — ${s.hint}</span></div>`
  ).join('');

  // Trouble spots: the verbs you keep missing.
  const trouble = troubleList();
  $('#trouble-section').classList.toggle('hidden', trouble.length === 0);
  if (trouble.length) {
    $('#trouble-list').innerHTML = trouble.map(v => `<span class="trouble-chip">${v.base}</span>`).join('');
  }

  const lvlBar = (f, label) => {
    const dueNow = f.lvl >= SCHEDULE_GATE && Date.now() >= (f.due || 0);
    return `<div class="lvlrow"><span class="lvllabel">${label}</span>
      <div class="lvlbar"><div class="lvlbar-fill" style="width:${f.lvl / FORM_MAX * 100}%"></div></div>
      <span class="lvlnum${dueNow ? ' due' : ''}">${dueNow ? '🔔' : f.lvl}</span></div>`;
  };

  const list = $('#verb-list');
  list.innerHTML = '';
  const sorted = [...VERBS].sort((a, b) => (store.progress[b.id] ? minLvl(store.progress[b.id]) : -1) - (store.progress[a.id] ? minLvl(store.progress[a.id]) : -1));
  for (const v of sorted) {
    const p = store.progress[v.id];
    const stg = stageOf(v.id);
    const row = document.createElement('div');
    row.className = 'verb-row';
    const bars = p ? `<div class="lvlbars">${lvlBar(p.past, 'past')}${lvlBar(p.pp, 'p.p.')}</div>` : '';
    row.innerHTML = `<div class="stage" title="${stg.name}">${stg.emoji}</div>
      <div class="forms"><span class="b">${v.base}</span> · <span class="f">${v.past} · ${v.pp}</span>${bars}</div>
      <div class="stagename">${stg.name}</div>`;
    list.appendChild(row);
  }
}

function renderAchievements() {
  const grid = $('#ach-grid');
  grid.innerHTML = '';
  const got = ACHIEVEMENTS.filter(a => store.achievements[a.id]).length;
  $('#ach-progress-text').textContent = got + ' / ' + ACHIEVEMENTS.length + ' unlocked';
  $('#ach-progress-fill').style.width = (got / ACHIEVEMENTS.length * 100) + '%';
  for (const cat of ACH_CATS) {
    const items = ACHIEVEMENTS.filter(a => a.cat === cat.id);
    if (!items.length) continue;
    const gotInCat = items.filter(a => store.achievements[a.id]).length;
    const head = document.createElement('div');
    head.className = 'ach-cat-head';
    head.innerHTML = `<span>${cat.name}</span><small>${gotInCat}/${items.length}</small>`;
    grid.appendChild(head);
    for (const a of items) {
      const on = !!store.achievements[a.id];
      const secret = a.hidden && !on;
      const d = document.createElement('div');
      d.className = 'ach' + (on ? ' unlocked' : '') + (a.hidden ? ' secret' : '');
      d.innerHTML = `<div class="ico">${on ? a.ico : (secret ? '❓' : '🔒')}</div>
        <div class="name">${secret ? '???' : a.name}</div>
        <div class="desc">${secret ? 'Hidden — keep playing!' : a.desc}</div>`;
      grid.appendChild(d);
    }
  }
}

function renderSettings() {
  const s = store.settings;
  markUnlocks();   // flag anything just earned so the pickers are current
  $('#set-name').value = s.name || '';
  $('#set-dark').checked = !!s.dark;
  $('#set-reduce').checked = !!s.reduceEffects;
  $('#set-sound').checked = !!s.sound;
  $('#set-haptics').checked = !!s.haptics;
  $('#set-rate').value = s.rate; $('#rate-val').textContent = '×' + s.rate;
  $('#set-pitch').value = s.pitch; $('#pitch-val').textContent = '×' + s.pitch;
  $('#set-goal').value = String(s.dailyGoal);
  $('#version-line').textContent = 'Tense Titans v' + APP_VERSION;

  // mascots
  const mp = $('#mascot-picker'); mp.innerHTML = '';
  MASCOTS.forEach(m => {
    const unlocked = isUnlocked(m);
    const b = document.createElement('button');
    b.className = 'mascot-opt' + (s.mascot === m.id ? ' active' : '') + (unlocked ? '' : ' locked');
    b.textContent = unlocked ? m.emoji : '🔒';
    b.title = unlocked ? m.name : `${m.name} — ${reqText(m.req)}`;
    b.onclick = unlocked
      ? () => { s.mascot = m.id; saveStore(); renderSettings(); }
      : () => toast(`🔒 ${m.emoji} ${m.name} — ${reqText(m.req)}`);
    mp.appendChild(b);
  });
  // themes
  const tp = $('#theme-picker'); tp.innerHTML = '';
  THEMES.forEach(t => {
    const unlocked = isUnlocked(t);
    const b = document.createElement('button');
    b.className = 'theme-dot' + (s.theme === t.id ? ' active' : '') + (unlocked ? '' : ' locked');
    b.setAttribute('data-theme', t.id);
    b.style.background = themeSwatch(t.id);
    b.title = unlocked ? t.name : `${t.name} — ${reqText(t.req)}`;
    b.onclick = unlocked
      ? () => { s.theme = t.id; saveStore(); applyCosmetics(); renderSettings(); }
      : () => toast(`🔒 ${t.name} theme — ${reqText(t.req)}`);
    tp.appendChild(b);
  });
  // voice presets
  const pr = $('#preset-row'); pr.innerHTML = '';
  VOICE_PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.className = 'preset-opt' + (s.rate === p.rate && s.pitch === p.pitch ? ' active' : '');
    b.dataset.preset = p.id;
    b.textContent = p.name;
    b.onclick = () => {
      s.rate = p.rate; s.pitch = p.pitch; saveStore(); renderSettings();
      previewVoice();
    };
    pr.appendChild(b);
  });
  // voices
  const vs = $('#set-voice'); vs.innerHTML = '';
  if (!voices.length) loadVoices();
  if (!voices.length) {
    vs.innerHTML = '<option>No voices on this device</option>'; vs.disabled = true;
  } else {
    vs.disabled = false;
    voices.forEach(v => {
      const o = document.createElement('option');
      o.value = v.voiceURI; o.textContent = `${v.name} (${v.lang})`;
      if (v.voiceURI === s.voiceURI) o.selected = true;
      vs.appendChild(o);
    });
  }
}
function themeSwatch(id) {
  const map = { default: '#6c5ce7', ocean: '#00b3c4', forest: '#3fbf6f', candy: '#ff5fa2', sunset: '#ff7b54' };
  return map[id] || '#6c5ce7';
}

/* ============================================================
   Info modal + "How to play"
   ============================================================ */
function howToPlayHTML() {
  return `
    <div class="how">
      <div class="how-row"><div class="how-ico">🎯</div><div>
        <b>Pick the form</b><br><small>Choose the right answer from 4. Great for learning new verbs.</small></div></div>
      <div class="how-row"><div class="how-ico">⌨️</div><div>
        <b>Type it</b> <span class="xp-badge">+50% XP</span><br>
        <small>Spell the form yourself. <b>Only Type it can grow a verb past level 3</b> — needed for 🌳 — and it pays more XP!</small></div></div>
      <div class="how-row"><div class="how-ico">🌍</div><div>
        <b>Match meaning</b><br><small>Pick the Russian translation. A fun warm-up — earns XP &amp; achievements.</small></div></div>
      <div class="how-row"><div class="how-ico">⚡</div><div>
        <b>Speed round</b><br><small>60 seconds, as many as you can. Build a 🔥 combo for bonus XP!</small></div></div>
      <hr>
      <div class="how-stages">
        ${STAGES.map(s => `<div class="how-stage"><span>${s.emoji}</span> <b>${s.name}</b><small>${s.hint}</small></div>`).join('')}
      </div>
      <p class="how-foot">Each verb has <b>two forms</b> (past &amp; participle) — you must know <b>both</b>. The top levels unlock only on <b>scheduled reviews</b> over days, and a miss drops you back. Come back when verbs are 🔔 due!</p>
    </div>`;
}
function openModal(title, html) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }

function openLightbox(src, caption) {
  $('#lightbox-img').src = src;
  $('#lightbox').querySelector('.lb-cap').textContent = caption || 'tap to close';
  $('#lightbox').classList.remove('hidden');
}
function closeLightbox() { $('#lightbox').classList.add('hidden'); $('#lightbox-img').src = ''; }

/* ============================================================
   Onboarding (first launch)
   ============================================================ */
let onb = { step: 0, name: '', mascot: 'dragon', voiceURI: '' };

function startOnboarding() {
  onb = { step: 0, name: store.settings.name || '', mascot: store.settings.mascot || 'dragon', voiceURI: store.settings.voiceURI || '' };
  $('#onboarding').classList.remove('hidden');
  renderOnboarding();
}

function onbSteps() {
  const adult = (m) => m.forms[2];
  return [
    { // welcome
      html: `<img class="onb-logo" src="icons/logo.svg" alt="Tense Titans" />
        <h2>Welcome to Tense Titans!</h2>
        <p>Master English irregular verbs by playing. Let's set up your buddy — it takes 20 seconds.</p>`,
      next: 'Let\'s go',
    },
    { // mascot
      html: `<h2>Choose your buddy</h2>
        <p>It grows up and earns a crown as you level up! 🐲→🐉→👑</p>
        <div class="onb-mascots">${MASCOTS.map(m => {
          const locked = !isUnlocked(m);
          return `<button class="onb-mascot-opt${onb.mascot === m.id ? ' active' : ''}${locked ? ' locked' : ''}" data-m="${m.id}" ${locked ? 'disabled' : ''}>
            <span class="om-emoji">${locked ? '🔒' : adult(m)}</span><span class="om-name">${locked ? reqText(m.req) : m.name}</span></button>`;
        }).join('')}</div>`,
      next: 'Next',
    },
    { // name
      html: `<div class="onb-mascot">${adult(mascotById(onb.mascot))}</div>
        <h2>What's your name?</h2>
        <p>So your buddy knows who the hero is.</p>
        <input id="onb-name" class="onb-input" type="text" maxlength="12" placeholder="hero" value="${escapeAttr(onb.name)}">`,
      next: 'Next',
    },
    { // voice
      html: `<div class="onb-mascot">🔊</div>
        <h2>Pick a voice</h2>
        <p>Your buddy can read verbs out loud. Try the silly ones!</p>
        <select id="onb-voice" class="onb-input"></select>
        <div class="onb-presets">${VOICE_PRESETS.map(p => `<button class="preset-opt" data-p="${p.id}">${p.name}</button>`).join('')}</div>
        <button id="onb-test" class="ghost-btn" style="margin-top:12px">🔊 Test</button>`,
      next: 'Next',
    },
    { // how to play
      html: `<h2>How to play</h2>${howToPlayHTML()}`,
      next: 'Start playing! 🚀',
    },
  ];
}
function mascotById(id) { return MASCOTS.find(m => m.id === id) || MASCOTS[0]; }
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

function renderOnboarding() {
  const steps = onbSteps();
  const step = steps[onb.step];
  $('#onb-body').innerHTML = step.html;
  $('#onb-next').textContent = step.next;
  $('#onb-back').style.display = onb.step === 0 ? 'none' : '';
  $('#onb-dots').innerHTML = steps.map((_, i) => `<span class="onb-dot${i === onb.step ? ' on' : ''}"></span>`).join('');

  // wire step-specific controls
  if (onb.step === 1) {
    $$('#onb-body .onb-mascot-opt').forEach(b => b.onclick = () => {
      if (b.disabled) return;
      onb.mascot = b.dataset.m; renderOnboarding();
    });
  }
  if (onb.step === 2) {
    const inp = $('#onb-name');
    inp.oninput = () => onb.name = inp.value;
    setTimeout(() => inp.focus(), 50);
  }
  if (onb.step === 3) {
    if (!voices.length) loadVoices();
    const vs = $('#onb-voice');
    if (!voices.length) { vs.innerHTML = '<option>No voices on this device</option>'; vs.disabled = true; }
    else {
      vs.innerHTML = voices.map(v => `<option value="${escapeAttr(v.voiceURI)}"${v.voiceURI === onb.voiceURI ? ' selected' : ''}>${v.name} (${v.lang})</option>`).join('');
      onb.voiceURI = onb.voiceURI || voices[0].voiceURI;
      vs.onchange = () => { onb.voiceURI = vs.value; applyOnbVoice(); speak('Hello!'); };
    }
    $$('#onb-body .preset-opt').forEach(b => b.onclick = () => {
      const p = VOICE_PRESETS.find(x => x.id === b.dataset.p);
      store.settings.rate = p.rate; store.settings.pitch = p.pitch; applyOnbVoice(); speak('I sound like this');
    });
    $('#onb-test').onclick = () => { applyOnbVoice(); speak('Go, went, gone!'); };
  }
}
// commit current onboarding voice pick into settings so speak() uses it live
function applyOnbVoice() { store.settings.voiceURI = onb.voiceURI; }

function onbNext() {
  const steps = onbSteps();
  if (onb.step < steps.length - 1) { onb.step++; renderOnboarding(); return; }
  finishOnboarding();
}
function onbBack() { if (onb.step > 0) { onb.step--; renderOnboarding(); } }
function finishOnboarding() {
  store.settings.name = (onb.name || '').trim();
  store.settings.mascot = onb.mascot;
  if (onb.voiceURI) store.settings.voiceURI = onb.voiceURI;
  store.flags.onboarded = true;
  saveStore();
  $('#onboarding').classList.add('hidden');
  show('home');
}

/* ============================================================
   Small utils
   ============================================================ */
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function pickFrom(a) { return a[Math.floor(Math.random() * a.length)]; }

/* ============================================================
   Wiring
   ============================================================ */
function wire() {
  $$('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));
  $$('[data-mode]').forEach(b => b.onclick = () => startSession(b.dataset.mode));
  $('#play-quit').onclick = () => {
    if (confirm('Quit this round? Progress so far is saved.')) {
      if (session) { session.ended = true; clearInterval(session.timer); }
      show('home');
    }
  };
  $('#next-btn').onclick = () => { $('#example').classList.add('hidden'); $('#next-btn').classList.add('hidden'); nextQuestion(); };
  $('#translate-btn').onclick = () => $('#translation').classList.toggle('hidden');
  $('#speak-btn').onclick = () => { if (session && session.q) speak(session.q.v.base + '. ' + session.q.v.past + '. ' + session.q.v.pp); };
  $('#results-again').onclick = () => startSession(session ? session.mode : 'pick');

  // settings inputs
  $('#set-name').oninput = (e) => { store.settings.name = e.target.value; saveStore(); };
  $('#set-dark').onchange = (e) => { store.settings.dark = e.target.checked; applyCosmetics(); saveStore(); };
  $('#set-reduce').onchange = (e) => { store.settings.reduceEffects = e.target.checked; applyCosmetics(); saveStore(); };
  $('#set-sound').onchange = (e) => { store.settings.sound = e.target.checked; saveStore(); };
  $('#set-haptics').onchange = (e) => { store.settings.haptics = e.target.checked; saveStore(); if (e.target.checked) haptic(true); };
  $('#set-rate').oninput = (e) => { store.settings.rate = +e.target.value; $('#rate-val').textContent = '×' + e.target.value; saveStore(); markActivePreset(); previewVoice(450); };
  $('#set-pitch').oninput = (e) => { store.settings.pitch = +e.target.value; $('#pitch-val').textContent = '×' + e.target.value; saveStore(); markActivePreset(); previewVoice(450); };
  $('#set-goal').onchange = (e) => { store.settings.dailyGoal = +e.target.value; saveStore(); };
  $('#set-voice').onchange = (e) => { store.settings.voiceURI = e.target.value; saveStore(); previewVoice(); };
  $('#test-voice').onclick = () => speak('Hello! Go, went, gone.');

  $('#reset-btn').onclick = () => {
    if (confirm('This erases all progress, streaks and unlocks. Are you sure?')) {
      store = defaultStore(); saveStore(); applyCosmetics(); show('home'); toast('Progress reset');
    }
  };
  $('#export-btn').onclick = exportData;
  $('#import-btn').onclick = () => $('#import-file').click();
  $('#import-file').onchange = importData;
  $('#replay-onboarding').onclick = () => startOnboarding();

  // onboarding + info modal
  $('#onb-next').onclick = onbNext;
  $('#onb-back').onclick = onbBack;
  $('#onb-skip').onclick = finishOnboarding;
  $('#how-btn').onclick = () => openModal('How to play', howToPlayHTML());
  const startTrouble = () => { const q = troubleList().map(v => ({ v })); if (q.length) startSession('trouble', q); };
  $('#trouble-practice').onclick = startTrouble;
  $('#trouble-banner').onclick = startTrouble;
  $('#modal-close').onclick = closeModal;
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
  $('#lightbox').onclick = closeLightbox;

  if (window.speechSynthesis) {
    loadVoices();
    speechSynthesis.onvoiceschanged = () => { loadVoices(); if (!$('#screen-settings').classList.contains('hidden')) renderSettings(); };
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tense-titans-progress.json'; a.click();
  URL.revokeObjectURL(url);
  toast('Progress exported');
}
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object') throw new Error('bad file');
      store = migrate(data);
      saveStore(); applyCosmetics(); renderSettings();
      toast('Progress imported ✔');
    } catch (err) { toast('Could not read that file'); }
    e.target.value = '';
  };
  reader.readAsText(file);
}

/* ============================================================
   Boot
   ============================================================ */
async function boot() {
  loadStore();
  try {
    const res = await fetch('verbs.json');
    VERBS = await res.json();
  } catch (e) {
    document.body.innerHTML = '<p style="padding:20px">Could not load verbs.json — run from a web server (or GitHub Pages).</p>';
    return;
  }
  VERBS.forEach(v => verbById[v.id] = v);
  try { EXAMPLES = await (await fetch('examples.json')).json(); } catch (e) { EXAMPLES = {}; }  // optional; graceful if missing
  decayAll();           // apply the forgetting curve for any time away
  markUnlocks();        // grant any cosmetics already earned under the new rules
  // "Comeback Kid": flag a long absence so the next answer unlocks it
  const last = store.stats.lastStudyDate;
  if (last && (Date.now() - new Date(last).getTime()) / DAY >= 7) store.flags.comebackPending = true;
  saveStore();
  applyCosmetics();
  wire();
  show('home');
  if (!store.flags.onboarded) startOnboarding();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
