/* ============================================================
   Tense Titans — irregular verbs trainer (Phase 2)
   Vanilla JS, no build step, offline PWA. Loaded as an ES module.
   ============================================================ */
'use strict';

// Pure, DOM-free, unit-tested cores (see src/core/* and test/*).
import {
  EVO_LEVELS, RANKS,
  xpForLevel, levelFromXp, xpIntoLevel, xpForNextLevel,
  evoStageForLevel, rankTitle,
} from './src/core/leveling.js';
import { ED_ALSO_VALID, lettersOnly, isCorrect, regularize, trapFor } from './src/core/matching.js';
import {
  DAY, FORM_MAX, SCHEDULE_GATE, STAGE_MIN,
  newForm, minLvl, decayForm, applyAnswer,
} from './src/core/srs.js';
import { SCHEMA_VERSION, defaultStore, migrate, looksLikeStore } from './src/core/store-migrate.js';
import {
  troubleList, troubleCount, dueForms, buildReviewQueue, pickVerb, chooseForm,
} from './src/core/selection.js';
import { earnedAchievements } from './src/core/achievements.js';
import { reqMet, reqText } from './src/core/cosmetics.js';

const APP_VERSION = '1.8.18';
const STORE_KEY = 'verbquest.store';
const NEW_PER_SESSION = 5;       // how many brand-new verbs to introduce per session

/* ---- Spaced-repetition progression (per form: past & participle) ---- */
// All SRS tunables/helpers (DAY, FORM_MAX, PICK_FORM_CAP, SCHEDULE_GATE, INTERVAL_DAYS, STAGE_MIN,
// scheduling, applyAnswer) and selection live in src/core/srs.js + src/core/selection.js.
const STAGES = [
  { key: 'new',      emoji: '⚪', name: 'New',      hint: 'Not started yet' },
  { key: 'seedling', emoji: '🌱', name: 'Seedling', hint: 'Just started — keep answering' },
  { key: 'sprout',   emoji: '🌿', name: 'Sprout',   hint: 'Both forms recognised (lvl 3+)' },
  { key: 'growing',  emoji: '🪴', name: 'Growing',  hint: 'Both lvl 5+ — review over a few days' },
  { key: 'mastered', emoji: '🌳', name: 'Mastered', hint: 'Both lvl 7+ via ⌨️ Type it (~1 week+)' },
  { key: 'gold',     emoji: '🌟', name: 'Champion', hint: 'Both lvl 10 — kept perfect for weeks' },
];
// 6 illustrated evolution stages (images 1..6). Evolve every 2 levels -> stages 1..5.
// EVO_LEVELS now lives in src/core/leveling.js (imported above).
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
// Translation languages the hero can choose. 'ru' lives in verbs.json; the rest in translations.json.
const LANGUAGES = [
  { code: 'ru', flag: '🇷🇺', name: 'Русский' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'zh', flag: '🇨🇳', name: '中文' },
  { code: 'ar', flag: '🇸🇦', name: 'العربية', rtl: true },
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
let TRANSLATIONS = {};       // verbId -> { es, fr, de, zh, ar } (ru stays in verbs.json)
let store = null;
let voices = [];
let session = null;
let evoAnimPending = false;   // play the evolution pop on the next home render

/* ============================================================
   Store: load / migrate / save  (backward compatible)
   defaultStore / fillDefaults / migrate now live in src/core/store-migrate.js
   (imported above); only the localStorage I/O stays here.
   ============================================================ */
function loadStore() {
  let raw = null, s;
  try {
    raw = localStorage.getItem(STORE_KEY);
    s = raw ? JSON.parse(raw) : defaultStore();
  } catch (e) {
    console.warn('Store corrupt, starting fresh but keeping a backup.', e);
    try { localStorage.setItem(STORE_KEY + '.broken', localStorage.getItem(STORE_KEY) || ''); } catch (_) {}
    s = defaultStore();
  }
  // Safeguard: before a schema-changing migration overwrites the saved store, snapshot the raw
  // original so a buggy future migration can never make a player's progress unrecoverable.
  try {
    if (raw && (s.schemaVersion || 1) < SCHEMA_VERSION) localStorage.setItem(STORE_KEY + '.bak', raw);
  } catch (_) {}
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

// ---- Translations: the verb's meaning in the hero's chosen language (falls back to Russian) ----
function langDef() { return LANGUAGES.find(l => l.code === (store.settings.lang || 'ru')) || LANGUAGES[0]; }
function trList(v) {
  const lang = store.settings.lang || 'ru';
  if (lang === 'ru') return v.ru;
  const t = TRANSLATIONS[v.id], val = t && t[lang];
  return val ? [val] : v.ru;   // graceful fallback if a translation is missing
}
function trText(v) { return trList(v).join(', '); }

// Leveling math (xpForLevel / levelFromXp / xpIntoLevel / xpForNextLevel) and
// rank titles (RANKS / rankTitle) now live in src/core/leveling.js (imported above).

function prog(id) {
  if (!store.progress[id]) store.progress[id] = { past: newForm(), pp: newForm(), lastSeen: 0 };
  return store.progress[id];
}
function isSeen(id) { return !!store.progress[id]; }
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

// Forgetting curve, scheduling gates, and graceDays now live in src/core/srs.js (imported above).
function decayAll() {
  for (const id in store.progress) {
    const p = store.progress[id];
    if (p && p.past) { decayForm(p.past); decayForm(p.pp); }
  }
}
// dueForms / buildReviewQueue / troubleScore / troubleList / troubleCount / pickVerb / chooseForm
// now live in src/core/selection.js (imported above). dueCount stays — it walks the global VERBS/store.
function dueCount() {
  let n = 0;
  for (const v of VERBS) { const p = store.progress[v.id]; if (p && dueForms(p).length) n++; }
  return n;
}

// ---- Mascot evolution (Tamagotchi-style, driven by level) ----
// evoStageForLevel() now lives in src/core/leveling.js (imported above).
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
// lettersOnly / isCorrect now live in src/core/matching.js (imported above).

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
   Session / gameplay
   (pickVerb / chooseForm / buildReviewQueue live in src/core/selection.js)
   ============================================================ */
function startSession(mode, customQueue) {
  // Only the four game modes count toward the "played all modes" achievement.
  if (['pick', 'type', 'match', 'speed'].includes(mode)) store.stats.modesPlayed[mode] = true;
  let queue = customQueue || null, total = store.settings.dailyGoal || 10;
  if (mode === 'review') {
    queue = shuffle(buildReviewQueue(VERBS, store));
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
    v = pickVerb(VERBS, store, session.lastId, session.newBudget);
    session.lastId = v.id;
  }
  if (session.mode === 'match') {
    session.q = { kind: 'translate', v, answer: trText(v) };
  } else {
    which = which || chooseForm(v, store);   // test the form that needs it most
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
  $('#translation').textContent = trText(v);
  $('#translation').dir = langDef().rtl ? 'rtl' : 'ltr';
  $('#translate-btn').textContent = langDef().flag;   // the hint button shows the chosen language's flag
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

// regularize / ED_ALSO_VALID and the confusable trap (trapFor) now live in src/core/matching.js.

function buildOptions(area) {
  const { v, which, answer } = session.q;
  const opts = new Set([answer]);
  // Sneaky trap: the verb's OTHER form (past<->participle), or a wrong "-ed" form. See trapFor.
  const trap = trapFor(v, which, ED_ALSO_VALID);
  if (trap) opts.add(trap);
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
  const others = VERBS.filter(x => x.id !== session.q.v.id).map(x => trText(x));
  const opts = new Set([answer]);
  while (opts.size < 4 && others.length) opts.add(others[Math.floor(Math.random() * others.length)]);
  const rtl = langDef().rtl;
  for (const opt of shuffle(Array.from(opts))) {
    const b = document.createElement('button');
    b.className = 'opt-btn ru';
    b.textContent = opt;
    if (rtl) b.dir = 'rtl';
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
    // Spaced-repetition leveling — the pure transition lives in src/core/srs.js (applyAnswer).
    const p = prog(q.v.id);
    p.lastSeen = Date.now();
    const otherLvl = (q.which === 'past' ? p.pp : p.past).lvl;
    const res = applyAnswer(p[q.which], { ok, mode: session.mode, otherLvl });
    p[q.which] = res.form;
    hint = res.hint;
    if (ok) {
      if (res.recall) store.stats.typeCorrect++;
      addXp(res.xp);
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
    const left = troubleCount(VERBS, store);
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
// Build a snapshot for the pure evaluator (src/core/achievements.js), then unlock any new ids.
function checkAchievements() {
  const st = store.stats;
  const ids = earnedAchievements({
    stats: st,
    mastered: masteredCount(),
    champions: championCount(),
    totalVerbs: VERBS.length,
    level: levelFromXp(st.xp),
    evoStage: currentEvoStage(),
    evoMaxStage: EVO_NAMES.length - 1,
    hour: new Date().getHours(),
    todayCount: st.history[todayKey()] || 0,
    allCosmeticsUnlocked: cosmeticList().every(isUnlocked),
    has: (id) => !!store.achievements[id],
    comebackPending: !!(store.flags && store.flags.comebackPending),
  });
  for (const id of ids) unlockAchievement(id);
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
// Snapshot of progress for the pure reqMet (src/core/cosmetics.js). reqMet/reqText are imported.
function reqCtx() {
  return { level: levelFromXp(store.stats.xp), mastered: masteredCount(), bestStreak: store.stats.bestStreak, champions: championCount() };
}
function unlockedMap() { if (!store.flags.unlocked) store.flags.unlocked = {}; return store.flags.unlocked; }
function isUnlocked(c) { return !c.req || !!unlockedMap()[c.id] || reqMet(c.req, reqCtx()); }
function cosmeticList() {
  return [...THEMES.map(t => ({ ...t, kind: 'Theme' })), ...MASCOTS.map(m => ({ ...m, kind: 'Mascot' }))];
}
// Flag any newly-earned cosmetics (sticky) and return them for announcement.
function markUnlocks() {
  const u = unlockedMap(), newly = [], ctx = reqCtx();
  for (const c of cosmeticList()) {
    if (c.req && !u[c.id] && reqMet(c.req, ctx)) { u[c.id] = true; newly.push(c); }
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
  const tc = troubleCount(VERBS, store);
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
  const trouble = troubleList(VERBS, store);
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
  // translation language
  const lp = $('#lang-picker'); lp.innerHTML = '';
  LANGUAGES.forEach(l => {
    const b = document.createElement('button');
    b.className = 'lang-opt' + (s.lang === l.code ? ' active' : '');
    b.innerHTML = `<span class="lo-flag">${l.flag}</span><span class="lo-name"${l.rtl ? ' dir="rtl"' : ''}>${l.name}</span>`;
    b.title = l.name;
    b.onclick = () => { s.lang = l.code; saveStore(); renderSettings(); };
    lp.appendChild(b);
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
let onb = { step: 0, name: '', mascot: 'dragon', voiceURI: '', lang: 'ru' };

function startOnboarding() {
  onb = { step: 0, name: store.settings.name || '', mascot: store.settings.mascot || 'dragon', voiceURI: store.settings.voiceURI || '', lang: store.settings.lang || 'ru' };
  $('#onboarding').classList.remove('hidden');
  renderOnboarding();
}

function onbSteps() {
  const adult = (m) => m.forms[2];
  return [
    { key: 'welcome',
      html: `<img class="onb-logo" src="icons/logo.svg" alt="Tense Titans" />
        <h2>Welcome to Tense Titans!</h2>
        <p>Master English irregular verbs by playing. Let's set up your buddy — it takes 20 seconds.</p>`,
      next: 'Let\'s go',
    },
    { key: 'lang',
      html: `<div class="onb-mascot">🌍</div>
        <h2>Your language</h2>
        <p>Which language should we show word meanings in?</p>
        <div class="onb-langs">${LANGUAGES.map(l => `<button class="onb-lang-opt${onb.lang === l.code ? ' active' : ''}" data-l="${l.code}">
          <span class="ol-flag">${l.flag}</span><span class="ol-name"${l.rtl ? ' dir="rtl"' : ''}>${l.name}</span></button>`).join('')}</div>`,
      next: 'Next',
    },
    { key: 'mascot',
      html: `<h2>Choose your buddy</h2>
        <p>It grows up and earns a crown as you level up! 🐲→🐉→👑</p>
        <div class="onb-mascots">${MASCOTS.map(m => {
          const locked = !isUnlocked(m);
          return `<button class="onb-mascot-opt${onb.mascot === m.id ? ' active' : ''}${locked ? ' locked' : ''}" data-m="${m.id}" ${locked ? 'disabled' : ''}>
            <span class="om-emoji">${locked ? '🔒' : adult(m)}</span><span class="om-name">${locked ? reqText(m.req) : m.name}</span></button>`;
        }).join('')}</div>`,
      next: 'Next',
    },
    { key: 'name',
      html: `<div class="onb-mascot">${adult(mascotById(onb.mascot))}</div>
        <h2>What's your name?</h2>
        <p>So your buddy knows who the hero is.</p>
        <input id="onb-name" class="onb-input" type="text" maxlength="12" placeholder="hero" value="${escapeAttr(onb.name)}">`,
      next: 'Next',
    },
    { key: 'voice',
      html: `<div class="onb-mascot">🔊</div>
        <h2>Pick a voice</h2>
        <p>Your buddy can read verbs out loud. Try the silly ones!</p>
        <select id="onb-voice" class="onb-input"></select>
        <div class="onb-presets">${VOICE_PRESETS.map(p => `<button class="preset-opt" data-p="${p.id}">${p.name}</button>`).join('')}</div>
        <button id="onb-test" class="ghost-btn" style="margin-top:12px">🔊 Test</button>`,
      next: 'Next',
    },
    { key: 'howto',
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

  // wire step-specific controls (by key, so steps can be reordered safely)
  if (step.key === 'lang') {
    $$('#onb-body .onb-lang-opt').forEach(b => b.onclick = () => { onb.lang = b.dataset.l; renderOnboarding(); });
  }
  if (step.key === 'mascot') {
    $$('#onb-body .onb-mascot-opt').forEach(b => b.onclick = () => {
      if (b.disabled) return;
      onb.mascot = b.dataset.m; renderOnboarding();
    });
  }
  if (step.key === 'name') {
    const inp = $('#onb-name');
    inp.oninput = () => onb.name = inp.value;
    setTimeout(() => inp.focus(), 50);
  }
  if (step.key === 'voice') {
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
  store.settings.lang = onb.lang || 'ru';
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
  const startTrouble = () => { const q = troubleList(VERBS, store).map(v => ({ v })); if (q.length) startSession('trouble', q); };
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
      if (!looksLikeStore(data)) throw new Error('not a Tense Titans backup');
      // Non-destructive: confirm before replacing real progress, and back up the current store first.
      const hasProgress = store && store.progress && Object.keys(store.progress).length > 0;
      if (hasProgress && !confirm('Importing will replace your current progress. Continue?')) {
        e.target.value = ''; return;
      }
      try { localStorage.setItem(STORE_KEY + '.bak', JSON.stringify(store)); } catch (_) {}
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
  try { TRANSLATIONS = await (await fetch('translations.json')).json(); } catch (e) { TRANSLATIONS = {}; }  // optional; falls back to ru
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
