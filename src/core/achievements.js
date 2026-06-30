// Pure achievement evaluation: given a snapshot of the player's progress, return the ids that
// are currently earned. No DOM, no store — the caller (app.js) builds the snapshot, then unlocks
// any ids it doesn't already have (and shows the pop). Unit-tested in test/achievements.test.js.
export function earnedAchievements(ctx) {
  const {
    stats: st, mastered, champions, totalVerbs, level, evoStage, evoMaxStage,
    hour, todayCount, allCosmeticsUnlocked, has, comebackPending,
  } = ctx;
  const ids = [];
  const add = (cond, id) => { if (cond) ids.push(id); };

  add(st.totalAnswers >= 1, 'first');
  add(st.totalCorrect >= 10, 'correct10');
  add(st.totalCorrect >= 50, 'correct50');
  add(st.totalCorrect >= 100, 'correct100');
  add(st.totalCorrect >= 250, 'correct250');
  add(st.totalCorrect >= 500, 'correct500');
  add(st.dayStreak >= 3, 'streak3');
  add(st.dayStreak >= 7, 'streak7');
  add(st.dayStreak >= 14, 'streak14');
  add(st.dayStreak >= 30, 'streak30');
  add(mastered >= 10, 'mastered10');
  add(mastered >= 25, 'mastered25');
  add(mastered >= 50, 'mastered50');
  add(totalVerbs > 0 && mastered >= totalVerbs, 'masteredAll');
  add(champions >= 1, 'champion1');
  add(champions >= 10, 'champion10');
  add((st.typeCorrect || 0) >= 50, 'type50');
  add((st.typeCorrect || 0) >= 100, 'type100');
  add((st.matchCorrect || 0) >= 25, 'match25');
  add((st.matchCorrect || 0) >= 50, 'polyglot');
  add((st.matchCorrect || 0) >= 100, 'match100');
  add((st.speedBest || 0) >= 15, 'speed15');
  add((st.speedBest || 0) >= 25, 'speed25');
  add((st.speedBest || 0) >= 35, 'speed35');
  add((st.maxCombo || 0) >= 10, 'combo10');
  add((st.maxCombo || 0) >= 20, 'combo20');
  add((st.speedBestClean || 0) >= 15, 'flawlessSpd');
  add(Object.keys(st.modesPlayed || {}).length >= 4, 'allModes');
  add(level >= 7, 'level10');
  add(level >= 10, 'levelTen');
  add(todayCount >= 50, 'bigday');
  add(evoStage >= evoMaxStage, 'evoMax');
  add(allCosmeticsUnlocked, 'collector');
  add(hour >= 22 || hour < 5, 'nightOwl');
  add(hour >= 5 && hour < 8, 'earlyBird');
  // Both-of-day badge: night-owl and early-bird can't be earned in the same call, so it relies on
  // the two being already unlocked from earlier sessions.
  add(has('nightOwl') && has('earlyBird'), 'owlAndBird');
  add(comebackPending, 'comeback');
  return ids;
}
