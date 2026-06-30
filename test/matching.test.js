import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lettersOnly, isCorrect, regularize, trapFor, ED_ALSO_VALID } from '../src/core/matching.js';

test('lettersOnly strips everything but letters and lowercases', () => {
  assert.equal(lettersOnly('Was/Were'), 'waswere');
  assert.equal(lettersOnly('  GoNe! '), 'gone');
  assert.equal(lettersOnly('123'), '');
});

test('isCorrect: single form, whole token, or both forms in any order', () => {
  assert.ok(isCorrect('was', 'was/were'));
  assert.ok(isCorrect('were', 'was/were'));
  assert.ok(isCorrect('was/were', 'was/were'));   // the whole Pick option
  assert.ok(isCorrect('was were', 'was/were'));    // both, in order
  assert.ok(isCorrect('were, was', 'was/were'));   // both, reversed
  assert.ok(isCorrect('WENT', 'went'));            // case-insensitive
  assert.ok(isCorrect('burned', 'burnt/burned'));  // dual -t/-ed, either accepted
  assert.ok(isCorrect('burnt', 'burnt/burned'));
});

test('isCorrect: rejects wrong and empty input', () => {
  assert.equal(isCorrect('gone', 'went'), false);
  assert.equal(isCorrect('', 'went'), false);
  assert.equal(isCorrect('   ', 'went'), false);
});

test('regularize stays naive (no consonant doubling) to avoid real words', () => {
  assert.equal(regularize('cut'), 'cuted');     // not "cutted"
  assert.equal(regularize('quit'), 'quited');   // not the real "quitted"
  assert.equal(regularize('carry'), 'carried'); // consonant + y -> ied
  assert.equal(regularize('like'), 'liked');    // ends in e -> +d
  assert.equal(regularize('play'), 'played');   // vowel + y -> +ed
  assert.equal(regularize('bring'), 'bringed');
});

test('trapFor: uses the OTHER form when past != participle', () => {
  const go = { id: 'go', base: 'go', past: 'went', pp: 'gone' };
  assert.equal(trapFor(go, 'past'), 'gone');  // asked past -> trap with pp
  assert.equal(trapFor(go, 'pp'), 'went');    // asked pp   -> trap with past
});

test('trapFor: falls back to a wrong -ed form when both forms match', () => {
  const cut = { id: 'cut', base: 'cut', past: 'cut', pp: 'cut' };
  assert.equal(trapFor(cut, 'past'), 'cuted');
});

test('trapFor: returns null for sense-specific -ed verbs (no unfair trap)', () => {
  const shine = { id: 'shine', base: 'shine', past: 'shone', pp: 'shone' };
  // past==pp so the "other form" is itself (skipped); shine is in ED_ALSO_VALID -> no -ed trap
  assert.ok(ED_ALSO_VALID.has('shine'));
  assert.equal(trapFor(shine, 'past'), null);
});
