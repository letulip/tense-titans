/* ============================================================
   Tense Titans — irregular verbs trainer (Phase 2)
   Vanilla JS, no build step, offline PWA.
   ============================================================ */
'use strict';

const APP_VERSION = '1.2.0';
const SCHEMA_VERSION = 2;        // bump + add a migration when store shape changes
const STORE_KEY = 'verbquest.store';
const MAX_BOX = 5;               // Leitner boxes 0..5 ; 5 = mastered
const PICK_CAP = 4;              // "Pick the form" can grow a verb only up to box 4 (Growing)
const NEW_PER_SESSION = 5;       // how many brand-new verbs to introduce per session

/* Mastery stages by Leitner box (clear, named, with how-to). */
const STAGES = [
  { emoji: '⚪', name: 'New',      hint: 'Not started yet' },               // never seen
  { emoji: '🌱', name: 'Seedling', hint: 'Just learning — keep going!' },    // box 0–1
  { emoji: '🌿', name: 'Sprout',   hint: 'Getting it — answer right to grow' }, // box 2–3
  { emoji: '🪴', name: 'Growing',  hint: 'Almost there! Master it in ⌨️ Type it' }, // box 4
  { emoji: '🌳', name: 'Mastered', hint: 'Fully learned 🎉' },              // box 5
];
const EVO_LEVELS = [2, 5, 9];    // mascot evolves when you reach these levels
const EVO_NAMES = ['Egg', 'Baby', 'Grown', 'Champion'];

/* ---------- Catalog of cosmetics (safe to extend freely) ---------- */
const THEMES = [
  { id: 'default', name: 'Royal',  unlockXp: 0 },
  { id: 'ocean',   name: 'Ocean',  unlockXp: 150 },
  { id: 'forest',  name: 'Forest', unlockXp: 350 },
  { id: 'candy',   name: 'Candy',  unlockXp: 600 },
  { id: 'sunset',  name: 'Sunset', unlockXp: 900 },
];
// forms = evolution chain: [egg, baby, grown, champion]
const MASCOTS = [
  { id: 'dragon', emoji: '🐉', name: 'Dragon',  unlockXp: 0,   forms: ['🥚', '🐲', '🐉', '🐉'] },
  { id: 'fox',    emoji: '🦊', name: 'Fox',     unlockXp: 0,   forms: ['🥚', '🐾', '🦊', '🦊'] },
  { id: 'owl',    emoji: '🦉', name: 'Owl',     unlockXp: 200, forms: ['🥚', '🐥', '🦉', '🦉'] },
  { id: 'robot',  emoji: '🤖', name: 'Robot',   unlockXp: 450, forms: ['📦', '🔩', '🤖', '🤖'] },
  { id: 'unicorn',emoji: '🦄', name: 'Unicorn', unlockXp: 750, forms: ['🥚', '🐴', '🦄', '🦄'] },
];
const VOICE_PRESETS = [
  { id: 'normal',   name: 'Normal',   rate: 1.0, pitch: 1.0 },
  { id: 'robot',    name: '🤖 Robot',  rate: 0.8, pitch: 0.4 },
  { id: 'chipmunk', name: '🐿️ Chipmunk', rate: 1.4, pitch: 2.0 },
  { id: 'slowmo',   name: '🐢 Slow-mo', rate: 0.6, pitch: 1.0 },
];
const ACHIEVEMENTS = [
  { id: 'first',      ico: '👣', name: 'First steps',  desc: 'Answer your first verb' },
  { id: 'correct10',  ico: '✅', name: 'Getting it',   desc: '10 correct answers' },
  { id: 'correct50',  ico: '💪', name: 'On a roll',    desc: '50 correct answers' },
  { id: 'streak3',    ico: '🔥', name: '3-day streak', desc: 'Practice 3 days in a row' },
  { id: 'streak7',    ico: '🌟', name: 'Week warrior', desc: 'Practice 7 days in a row' },
  { id: 'mastered10', ico: '🌳', name: 'Green thumb',  desc: 'Master 10 verbs' },
  { id: 'mastered25', ico: '🏆', name: 'Verb master',  desc: 'Master 25 verbs' },
  { id: 'perfect',    ico: '💯', name: 'Flawless',     desc: 'A perfect session' },
];

/* ---------- State ---------- */
let VERBS = [];
let verbById = {};
let store = null;
let voices = [];
let session = null;

/* ============================================================
   Store: load / migrate / save  (backward compatible)
   ============================================================ */
function defaultStore() {
  return {
    schemaVersion: SCHEMA_VERSION,
    progress: {},          // verbId -> {box, correct, wrong, lastSeen}
    stats: {
      xp: 0, dayStreak: 0, bestStreak: 0, lastStudyDate: null,
      totalAnswers: 0, totalCorrect: 0, history: {},
    },
    achievements: {},      // id -> ISO date unlocked
    settings: {
      name: '', mascot: 'dragon', theme: 'default', dark: false,
      sound: true, voiceURI: '', rate: 1, pitch: 1, dailyGoal: 10,
    },
    flags: { onboarded: false, evoStage: 0 },
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
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, '');
const levelFromXp = (xp) => 1 + Math.floor(xp / 100);
const xpIntoLevel = (xp) => xp % 100;

function prog(id) {
  if (!store.progress[id]) store.progress[id] = { box: 0, correct: 0, wrong: 0, lastSeen: 0 };
  return store.progress[id];
}
function isSeen(id) { return !!store.progress[id]; }
function masteredCount() {
  return VERBS.filter(v => store.progress[v.id] && store.progress[v.id].box >= MAX_BOX).length;
}
// Map a verb to one of the 5 named mastery stages.
function stageOf(id) {
  const p = store.progress[id];
  if (!p) return { idx: 0, box: -1, ...STAGES[0] };
  const b = p.box;
  let idx;
  if (b >= MAX_BOX) idx = 4;
  else if (b >= PICK_CAP) idx = 3;
  else if (b >= 2) idx = 2;
  else idx = 1;
  return { idx, box: b, ...STAGES[idx] };
}

// ---- Mascot evolution (Tamagotchi-style, driven by level) ----
function evoStageForLevel(level) {
  let stage = 0;
  for (const lv of EVO_LEVELS) if (level >= lv) stage++;
  return stage; // 0..3
}
function currentEvoStage() { return evoStageForLevel(levelFromXp(store.stats.xp)); }
function mascotDef() { return MASCOTS.find(m => m.id === store.settings.mascot) || MASCOTS[0]; }
function mascotFormEmoji(stage) { return mascotDef().forms[stage] || mascotDef().emoji; }
// XP remaining until the next evolution (or null if maxed).
function xpToNextEvo() {
  const lvl = levelFromXp(store.stats.xp);
  const next = EVO_LEVELS.find(lv => lv > lvl);
  if (!next) return null;
  return (next - 1) * 100 - store.stats.xp;
}
// Accept either alternative for "got/gotten", "was/were", etc.
function acceptedForms(str) { return str.split('/').map(norm); }

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
  const now = Date.now();
  const pool = [];
  for (const v of VERBS) {
    if (v.id === excludeId) continue;
    const p = store.progress[v.id];
    let weight;
    if (!p) {
      weight = newBudgetRef.left > 0 ? 8 : 0.2;   // gate how many new verbs appear
    } else {
      weight = (MAX_BOX + 1 - p.box);             // lower box -> higher priority
      const days = (now - (p.lastSeen || 0)) / 86400000;
      weight *= 1 + Math.min(days, 5) / 5;        // overdue boost
      if (p.box >= MAX_BOX) weight *= 0.25;       // mastered shows rarely
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

/* ============================================================
   Session / gameplay
   ============================================================ */
function startSession(mode) {
  const goal = store.settings.dailyGoal || 10;
  session = { mode, total: goal, index: 0, correct: 0, lastId: null,
              newBudget: { left: NEW_PER_SESSION }, q: null, answered: false };
  show('play');
  nextQuestion();
}

function nextQuestion() {
  if (session.index >= session.total) return endSession();
  session.answered = false;
  const v = pickVerb(session.lastId, session.newBudget);
  session.lastId = v.id;
  // pick which form to test: 'past' or 'pp'
  const which = Math.random() < 0.5 ? 'past' : 'pp';
  session.q = { v, which, answer: v[which] };
  renderQuestion();
}

function renderQuestion() {
  const { v, which } = session.q;
  $('#play-count').textContent = (session.index + 1) + '/' + session.total;
  $('#play-progress-fill').style.width = (session.index / session.total * 100) + '%';
  $('#feedback').textContent = '';
  $('#feedback').className = 'feedback';
  $('#translation').classList.add('hidden');
  $('#translation').textContent = v.ru.join(', ');

  // Build the triple with the tested form blanked
  const pastCell = which === 'past'
    ? `<span class="blank" id="blank">?</span>`
    : `<span class="form muted">${v.past}</span>`;
  const ppCell = which === 'pp'
    ? `<span class="blank" id="blank">?</span>`
    : `<span class="form muted">${v.pp}</span>`;
  $('#triple').innerHTML = `
    <div class="label">base · past · participle</div>
    <div class="form-line">
      <span class="form">${v.base}</span>
      <span class="arrow">→</span>
      ${pastCell}
      <span class="arrow">→</span>
      ${ppCell}
    </div>`;

  const area = $('#answer-area');
  area.innerHTML = '';
  if (session.mode === 'pick') {
    buildOptions(area);
  } else {
    buildTypeInput(area);
  }
}

function buildOptions(area) {
  const { which, answer } = session.q;
  // distractors: same form-type from other verbs
  const others = VERBS.filter(x => x.id !== session.q.v.id).map(x => x[which]);
  const opts = new Set([answer]);
  while (opts.size < 4 && others.length) {
    opts.add(others[Math.floor(Math.random() * others.length)]);
  }
  const list = shuffle(Array.from(opts));
  for (const opt of list) {
    const b = document.createElement('button');
    b.className = 'opt-btn';
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

function handleAnswer(given, el) {
  if (session.answered) return;
  session.answered = true;
  const { v, which, answer } = session.q;
  const ok = acceptedForms(answer).includes(norm(given));
  const p = prog(v.id);
  p.lastSeen = Date.now();
  store.stats.totalAnswers++;

  if (ok) {
    // Only Type it can push a verb to full mastery (box 5). Pick caps at box 4.
    const cap = session.mode === 'type' ? MAX_BOX : PICK_CAP;
    const before = p.box;
    p.box = Math.min(cap, p.box + 1);
    p.correct++;
    session.correct++;
    store.stats.totalCorrect++;
    store.stats.xp += session.mode === 'type' ? 15 : 10;   // Type it = +50% XP
    const cappedHint = session.mode === 'pick' && before >= PICK_CAP;
    feedbackGood(el, answer, cappedHint ? 'Master it in ⌨️ Type it!' : '');
    sfx(true);
    speak(answer);
  } else {
    p.box = 0;                  // back to the start for a missed verb
    p.wrong++;
    feedbackBad(el, answer);
    sfx(false);
  }

  // reveal answer in the triple
  const blank = $('#blank');
  if (blank) { blank.textContent = answer; blank.classList.add('filled'); if (!ok) blank.classList.add('wrong'); }

  // disable options / lock input
  if (session.mode === 'pick') {
    $$('.opt-btn').forEach(b => {
      b.disabled = true;
      if (acceptedForms(answer).includes(norm(b.textContent))) b.classList.add('correct');
      else if (b === el && !ok) b.classList.add('wrong');
    });
  }

  checkAchievements();
  saveStore();
  session.index++;
  $('#play-progress-fill').style.width = (session.index / session.total * 100) + '%';
  setTimeout(nextQuestion, ok ? 900 : 1700);
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

function endSession() {
  // streak bookkeeping (only counts once per calendar day)
  const today = todayKey();
  const last = store.stats.lastStudyDate;
  if (last !== today) {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    store.stats.dayStreak = (last === y) ? store.stats.dayStreak + 1 : 1;
    store.stats.lastStudyDate = today;
    store.stats.bestStreak = Math.max(store.stats.bestStreak, store.stats.dayStreak);
  }
  store.stats.history[today] = (store.stats.history[today] || 0) + session.total;

  const acc = session.total ? Math.round(session.correct / session.total * 100) : 0;
  const gainedXp = session.correct * (session.mode === 'type' ? 15 : 10);
  const perfect = session.correct === session.total && session.total > 0;
  if (perfect) store.stats.xp += 20; // bonus

  const unlocks = checkUnlocks();
  if (perfect) unlockAchievement('perfect');
  checkAchievements();

  // Mascot evolution: did this session push us to a new evolution stage?
  const newEvo = currentEvoStage();
  let evolved = null;
  if (newEvo > (store.flags.evoStage || 0)) {
    evolved = newEvo;
    store.flags.evoStage = newEvo;
  }
  saveStore();

  $('#results-emoji').textContent = perfect ? '🏆' : (acc >= 60 ? '🎉' : '💡');
  $('#results-title').textContent = perfect ? 'Flawless quest!' : 'Quest complete!';
  $('#results-correct').textContent = session.correct + '/' + session.total;
  $('#results-accuracy').textContent = acc + '%';
  $('#results-xp').textContent = '+' + (gainedXp + (perfect ? 20 : 0));
  const ul = $('#results-unlocks');
  ul.innerHTML = '';
  if (evolved !== null) {
    const d = document.createElement('div');
    d.className = 'unlock-pill evo';
    d.textContent = `${mascotFormEmoji(evolved)} Your ${mascotDef().name} evolved to ${EVO_NAMES[evolved]}!`;
    ul.appendChild(d);
  }
  unlocks.forEach(u => {
    const d = document.createElement('div');
    d.className = 'unlock-pill';
    d.textContent = '🔓 Unlocked: ' + u;
    ul.appendChild(d);
  });
  show('results');
}

/* ============================================================
   Achievements & unlocks
   ============================================================ */
function unlockAchievement(id) {
  if (store.achievements[id]) return false;
  store.achievements[id] = new Date().toISOString();
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (a) toast('🏆 ' + a.name + ' unlocked!');
  return true;
}
function checkAchievements() {
  const st = store.stats;
  if (st.totalAnswers >= 1) unlockAchievement('first');
  if (st.totalCorrect >= 10) unlockAchievement('correct10');
  if (st.totalCorrect >= 50) unlockAchievement('correct50');
  if (st.dayStreak >= 3) unlockAchievement('streak3');
  if (st.dayStreak >= 7) unlockAchievement('streak7');
  const mc = masteredCount();
  if (mc >= 10) unlockAchievement('mastered10');
  if (mc >= 25) unlockAchievement('mastered25');
}
// Returns names of cosmetics newly crossed the XP threshold (for the results screen).
function checkUnlocks() {
  const xp = store.stats.xp;
  if (!store._announced) store._announced = {};
  const out = [];
  const all = [...THEMES.map(t => ({ ...t, kind: 'Theme' })),
               ...MASCOTS.map(m => ({ ...m, kind: 'Mascot' }))];
  for (const c of all) {
    if (c.unlockXp > 0 && xp >= c.unlockXp && !store._announced[c.kind + c.id]) {
      store._announced[c.kind + c.id] = true;
      out.push(c.kind + ' ' + (c.name || c.emoji));
    }
  }
  return out;
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
    const u = new SpeechSynthesisUtterance(text.replace('/', ' or '));
    const v = voices.find(v => v.voiceURI === store.settings.voiceURI);
    if (v) u.voice = v;
    u.rate = store.settings.rate || 1;
    u.pitch = store.settings.pitch || 1;
    u.lang = (v && v.lang) || 'en-US';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}
// tiny WebAudio blip so we don't ship sound files
let audioCtx = null;
function sfx(good) {
  if (!store.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sine';
    const t = audioCtx.currentTime;
    if (good) { o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + 0.09); }
    else { o.frequency.setValueAtTime(300, t); o.frequency.setValueAtTime(200, t + 0.12); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.start(t); o.stop(t + 0.26);
  } catch (e) { /* ignore */ }
}

/* ============================================================
   Rendering: home / stats / achievements / settings
   ============================================================ */
function applyCosmetics() {
  document.documentElement.setAttribute('data-theme', store.settings.theme || 'default');
  document.documentElement.setAttribute('data-dark', store.settings.dark ? 'true' : 'false');
}

function renderHome() {
  applyCosmetics();
  const s = store.settings, st = store.stats;
  const stage = currentEvoStage();
  const mEl = $('#home-mascot');
  mEl.textContent = mascotFormEmoji(stage);
  mEl.className = 'mascot evo-' + stage;            // CSS grows the glyph per stage
  mEl.classList.toggle('champion', stage === 3);
  $('#home-hello').textContent = s.name ? `Hey, ${s.name}!` : 'Hey, hero!';
  $('#home-sub').textContent = homeMood();
  $('#home-evo').textContent = evoCaption();
  $('#home-streak').textContent = st.dayStreak;
  $('#home-level').textContent = levelFromXp(st.xp);
  $('#home-mastered').textContent = masteredCount();
  $('#home-xpfill').style.width = xpIntoLevel(st.xp) + '%';
  $('#home-xptext').textContent = st.xp + ' XP';
  $('#home-xpnext').textContent = 'Lv ' + (levelFromXp(st.xp) + 1) + ' in ' + (100 - xpIntoLevel(st.xp)) + ' XP';
  const doneToday = st.history[todayKey()] || 0;
  const goal = s.dailyGoal || 10;
  $('#home-goaltext').textContent = Math.min(doneToday, goal) + ' / ' + goal;
  $('#home-goalfill').style.width = Math.min(100, doneToday / goal * 100) + '%';
}

// Mascot speech bubble — reacts to streak / daily goal.
function homeMood() {
  const st = store.stats, goal = store.settings.dailyGoal || 10;
  const doneToday = st.history[todayKey()] || 0;
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

function renderStats() {
  const st = store.stats;
  const learning = VERBS.filter(v => { const p = store.progress[v.id]; return p && p.box >= 1 && p.box < MAX_BOX; }).length;
  const acc = st.totalAnswers ? Math.round(st.totalCorrect / st.totalAnswers * 100) : 0;
  $('#stats-summary').innerHTML = `
    <div class="box"><b>${masteredCount()}</b><small>mastered 🌳</small></div>
    <div class="box"><b>${learning}</b><small>learning 🌿</small></div>
    <div class="box"><b>${acc}%</b><small>accuracy</small></div>
    <div class="box"><b>${st.bestStreak}</b><small>best streak 🔥</small></div>`;

  // Legend: explain the stages and how to advance.
  $('#stats-legend').innerHTML = STAGES.map(s =>
    `<div class="legend-item"><span class="lg-emoji">${s.emoji}</span><span class="lg-text"><b>${s.name}</b> — ${s.hint}</span></div>`
  ).join('');

  const list = $('#verb-list');
  list.innerHTML = '';
  const sorted = [...VERBS].sort((a, b) => (store.progress[b.id]?.box ?? -1) - (store.progress[a.id]?.box ?? -1));
  for (const v of sorted) {
    const p = store.progress[v.id];
    const stg = stageOf(v.id);
    const filled = Math.max(0, stg.box);
    let pips = '';
    for (let i = 0; i < MAX_BOX; i++) pips += `<span class="pip${i < filled ? ' on' : ''}"></span>`;
    const row = document.createElement('div');
    row.className = 'verb-row';
    row.innerHTML = `<div class="stage" title="${stg.name}">${stg.emoji}</div>
      <div class="forms"><span class="b">${v.base}</span> · <span class="f">${v.past} · ${v.pp}</span>
        <div class="pips">${pips}</div></div>
      <div class="stagename">${stg.name}</div>`;
    list.appendChild(row);
  }
}

function renderAchievements() {
  const grid = $('#ach-grid');
  grid.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const on = !!store.achievements[a.id];
    const d = document.createElement('div');
    d.className = 'ach' + (on ? ' unlocked' : '');
    d.innerHTML = `<div class="ico">${on ? a.ico : '🔒'}</div>
      <div class="name">${a.name}</div><div class="desc">${a.desc}</div>`;
    grid.appendChild(d);
  }
}

function renderSettings() {
  const s = store.settings, xp = store.stats.xp;
  $('#set-name').value = s.name || '';
  $('#set-dark').checked = !!s.dark;
  $('#set-sound').checked = !!s.sound;
  $('#set-rate').value = s.rate; $('#rate-val').textContent = '×' + s.rate;
  $('#set-pitch').value = s.pitch; $('#pitch-val').textContent = '×' + s.pitch;
  $('#set-goal').value = String(s.dailyGoal);
  $('#version-line').textContent = 'Tense Titans v' + APP_VERSION;

  // mascots
  const mp = $('#mascot-picker'); mp.innerHTML = '';
  MASCOTS.forEach(m => {
    const locked = xp < m.unlockXp;
    const b = document.createElement('button');
    b.className = 'mascot-opt' + (s.mascot === m.id ? ' active' : '') + (locked ? ' locked' : '');
    b.textContent = locked ? '🔒' : m.emoji;
    b.title = locked ? `Unlock at ${m.unlockXp} XP` : m.id;
    if (!locked) b.onclick = () => { s.mascot = m.id; saveStore(); renderSettings(); };
    mp.appendChild(b);
  });
  // themes
  const tp = $('#theme-picker'); tp.innerHTML = '';
  THEMES.forEach(t => {
    const locked = xp < t.unlockXp;
    const b = document.createElement('button');
    b.className = 'theme-dot' + (s.theme === t.id ? ' active' : '') + (locked ? ' locked' : '');
    b.setAttribute('data-theme', t.id);
    b.style.background = themeSwatch(t.id);
    b.title = locked ? `${t.name} — unlock at ${t.unlockXp} XP` : t.name;
    if (!locked) b.onclick = () => { s.theme = t.id; saveStore(); applyCosmetics(); renderSettings(); };
    tp.appendChild(b);
  });
  // voice presets
  const pr = $('#preset-row'); pr.innerHTML = '';
  VOICE_PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.className = 'preset-opt';
    b.textContent = p.name;
    b.onclick = () => {
      s.rate = p.rate; s.pitch = p.pitch; saveStore(); renderSettings();
      speak('I sound like this');
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
        <small>Spell the form yourself. <b>Only Type it can fully master a verb 🌳</b> — and it pays more XP!</small></div></div>
      <hr>
      <div class="how-stages">
        ${STAGES.map(s => `<div class="how-stage"><span>${s.emoji}</span> <b>${s.name}</b><small>${s.hint}</small></div>`).join('')}
      </div>
      <p class="how-foot">Answer correctly to grow a verb. Miss it and it drops back — so come back often! 🔁</p>
    </div>`;
}
function openModal(title, html) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }

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
      html: `<div class="onb-mascot">🥚</div>
        <h2>Welcome to Tense Titans!</h2>
        <p>Master English irregular verbs by playing. Let's set up your buddy — it takes 20 seconds.</p>`,
      next: 'Let\'s go',
    },
    { // mascot
      html: `<h2>Choose your buddy</h2>
        <p>It hatches from an egg and evolves as you level up! 🥚→🐲→🐉</p>
        <div class="onb-mascots">${MASCOTS.map(m => {
          const locked = store.stats.xp < m.unlockXp;
          return `<button class="onb-mascot-opt${onb.mascot === m.id ? ' active' : ''}${locked ? ' locked' : ''}" data-m="${m.id}" ${locked ? 'disabled' : ''}>
            <span class="om-emoji">${locked ? '🔒' : adult(m)}</span><span class="om-name">${locked ? m.unlockXp + ' XP' : m.name}</span></button>`;
        }).join('')}</div>`,
      next: 'Next',
    },
    { // name
      html: `<div class="onb-mascot">${adult(mascotById(onb.mascot))}</div>
        <h2>What's your name?</h2>
        <p>So your buddy knows who the hero is.</p>
        <input id="onb-name" class="onb-input" type="text" maxlength="16" placeholder="hero" value="${escapeAttr(onb.name)}">`,
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
  $('#play-quit').onclick = () => { if (confirm('Quit this quest? Progress so far is saved.')) show('home'); };
  $('#translate-btn').onclick = () => $('#translation').classList.toggle('hidden');
  $('#speak-btn').onclick = () => { if (session && session.q) speak(session.q.v.base + '. ' + session.q.v.past + '. ' + session.q.v.pp); };
  $('#results-again').onclick = () => startSession(session ? session.mode : 'pick');

  // settings inputs
  $('#set-name').oninput = (e) => { store.settings.name = e.target.value; saveStore(); };
  $('#set-dark').onchange = (e) => { store.settings.dark = e.target.checked; applyCosmetics(); saveStore(); };
  $('#set-sound').onchange = (e) => { store.settings.sound = e.target.checked; saveStore(); };
  $('#set-rate').oninput = (e) => { store.settings.rate = +e.target.value; $('#rate-val').textContent = '×' + e.target.value; saveStore(); };
  $('#set-pitch').oninput = (e) => { store.settings.pitch = +e.target.value; $('#pitch-val').textContent = '×' + e.target.value; saveStore(); };
  $('#set-goal').onchange = (e) => { store.settings.dailyGoal = +e.target.value; saveStore(); };
  $('#set-voice').onchange = (e) => { store.settings.voiceURI = e.target.value; saveStore(); };
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
  $('#modal-close').onclick = closeModal;
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };

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
  applyCosmetics();
  wire();
  show('home');
  if (!store.flags.onboarded) startOnboarding();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
