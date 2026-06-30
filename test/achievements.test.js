import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earnedAchievements } from '../src/core/achievements.js';

const baseStats = {
  totalAnswers: 0, totalCorrect: 0, dayStreak: 0,
  typeCorrect: 0, matchCorrect: 0, speedBest: 0, speedBestClean: 0, maxCombo: 0, modesPlayed: {},
};
function ctx(over = {}) {
  return {
    stats: { ...baseStats, ...(over.stats || {}) },
    mastered: 0, champions: 0, totalVerbs: 150, level: 1, evoStage: 0, evoMaxStage: 5,
    hour: 12, todayCount: 0, allCosmeticsUnlocked: false, has: () => false, comebackPending: false,
    ...over,
  };
}

test('a brand-new player has earned nothing', () => {
  assert.deepEqual(earnedAchievements(ctx()), []);
});

test('one answer earns First steps', () => {
  assert.deepEqual(earnedAchievements(ctx({ stats: { totalAnswers: 1 } })), ['first']);
});

test('correct-answer milestones stack up to the threshold reached', () => {
  const ids = earnedAchievements(ctx({ stats: { totalAnswers: 1, totalCorrect: 100 } }));
  assert.ok(ids.includes('correct10') && ids.includes('correct50') && ids.includes('correct100'));
  assert.ok(!ids.includes('correct250'));
});

test('mastery: 50 mastered fires up to mastered50; all verbs fires masteredAll', () => {
  assert.ok(earnedAchievements(ctx({ mastered: 50 })).includes('mastered50'));
  assert.ok(!earnedAchievements(ctx({ mastered: 50 })).includes('masteredAll'));
  assert.ok(earnedAchievements(ctx({ mastered: 150, totalVerbs: 150 })).includes('masteredAll'));
});

test('levels, big day, evolution, collector', () => {
  assert.ok(earnedAchievements(ctx({ level: 7 })).includes('level10'));
  assert.ok(!earnedAchievements(ctx({ level: 7 })).includes('levelTen'));
  assert.ok(earnedAchievements(ctx({ level: 10 })).includes('levelTen'));
  assert.ok(earnedAchievements(ctx({ todayCount: 50 })).includes('bigday'));
  assert.ok(earnedAchievements(ctx({ evoStage: 5, evoMaxStage: 5 })).includes('evoMax'));
  assert.ok(earnedAchievements(ctx({ allCosmeticsUnlocked: true })).includes('collector'));
});

test('time-of-day badges and the both-of-day badge', () => {
  assert.ok(earnedAchievements(ctx({ hour: 23 })).includes('nightOwl'));
  assert.ok(earnedAchievements(ctx({ hour: 6 })).includes('earlyBird'));
  assert.ok(!earnedAchievements(ctx({ hour: 12 })).includes('nightOwl'));
  // owlAndBird only when both are already unlocked
  assert.ok(!earnedAchievements(ctx({ hour: 23 })).includes('owlAndBird'));
  const has = (id) => id === 'nightOwl' || id === 'earlyBird';
  assert.ok(earnedAchievements(ctx({ has })).includes('owlAndBird'));
});

test('mode badges: allModes needs four modes played', () => {
  assert.ok(!earnedAchievements(ctx({ stats: { modesPlayed: { pick: true, type: true } } })).includes('allModes'));
  assert.ok(earnedAchievements(ctx({ stats: { modesPlayed: { pick: true, type: true, match: true, speed: true } } })).includes('allModes'));
});
