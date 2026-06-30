// Cosmetic-unlock requirements. Pure: reqMet checks a requirement against a progress snapshot,
// reqText formats the "how to unlock" label. The sticky bookkeeping (which cosmetics are flagged
// unlocked) lives in app.js, where the store is. Unit-tested in test/cosmetics.test.js.

// ctx: { level, mastered, bestStreak, champions }
export function reqMet(req, ctx) {
  if (!req) return true;
  switch (req.type) {
    case 'level':    return ctx.level >= req.n;
    case 'mastered': return ctx.mastered >= req.n;
    case 'streak':   return ctx.bestStreak >= req.n;   // best ever, so it never re-locks
    case 'champion': return ctx.champions >= req.n;
    default:         return true;
  }
}

export function reqText(req) {
  if (!req) return '';
  switch (req.type) {
    case 'level':    return 'Reach level ' + req.n;
    case 'mastered': return 'Master ' + req.n + ' verbs 🌳';
    case 'streak':   return req.n + '-day streak 🔥';
    case 'champion': return req.n + ' Champion verb 🌟';
    default:         return '';
  }
}
