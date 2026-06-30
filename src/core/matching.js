// Answer matching + the confusable "trap" distractor. Pure and DOM-free.

// Verbs whose -ed form is valid but rare / sense-specific (kept single-form in the data),
// so we skip the "-ed" trap for them and never penalise a correct answer.
export const ED_ALSO_VALID = new Set(['kneel', 'light', 'speed', 'shine', 'broadcast']);

// Compare answers letters-only, so spacing / slashes / punctuation never matter.
export function lettersOnly(s) { return String(s).toLowerCase().replace(/[^a-z]+/g, ''); }

// Robust check for answers that may have two valid forms ("was/were", "got/gotten").
// Accepts: either single form, the whole "was/were" token (Pick option), or both forms
// typed together in any order / separator ("was were", "were, was", ...).
export function isCorrect(given, answer) {
  const g = lettersOnly(given);
  if (!g) return false;
  const variants = String(answer).split('/').map(lettersOnly).filter(Boolean);
  if (variants.includes(g)) return true;
  const joined = variants.join('');
  const joinedRev = [...variants].reverse().join('');
  return g === joined || g === joinedRev;
}

// A naive over-regularized form (cut -> cuted) — a realistic learner mistake. Kept naive
// (no consonant doubling) on purpose, so it can't accidentally match a real form like
// "quitted" / "wedded".
export function regularize(base) {
  if (/[^aeiou]y$/i.test(base)) return base.slice(0, -1) + 'ied';
  if (/e$/i.test(base)) return base + 'd';
  return base + 'ed';
}

// The single confusable distractor for a question: the verb's OTHER form (past<->participle,
// e.g. "gone" when asked for "went"), or — when both forms match — a wrong "-ed" form
// (bringed, cuted). Returns null when no safe trap exists.
export function trapFor(v, which, edAlsoValid = ED_ALSO_VALID) {
  const answer = v[which];
  const otherForm = which === 'past' ? v.pp : v.past;
  if (otherForm && !isCorrect(otherForm, answer)) return otherForm;
  if (!edAlsoValid.has(v.id)) {
    const reg = regularize(v.base);
    if (reg && !isCorrect(reg, answer)) return reg;
  }
  return null;
}
