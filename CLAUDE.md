# Tense Titans — project guide for Claude

Offline-first PWA that teaches kids English **irregular verbs** through play.
Built for a ~12-year-old learner: short, game-like, rewarding — not a second textbook.

## Stack & shape
- **Pure HTML / CSS / JS. No build step, no bundler, no framework.**
- PWA: `sw.js` (cache-first service worker) + `manifest.json`, fully offline after first load.
- Progress lives in `localStorage` (`verbquest.store`), versioned with backward-compatible migrations.
- Hosted on **GitHub Pages** (`git@github.com:letulip/tense-titans.git`). Target devices: Android (Chrome) + Windows laptop.
- Local dev needs HTTP (service workers + `fetch` don't work over `file://`):
  ```bash
  python3 -m http.server 8123   # → http://localhost:8123
  ```
  The preview launch.json profile is `verb-quest` on port 8123.

## Hard rules (do not break)

### Git workflow
- **Never commit or push to `main` directly.** Always work on a feature branch → push → the user merges the PR on GitHub.
- **Check `git branch --show-current` before every commit.** The user merges/pulls between turns, which silently switches the active branch (this has caused commits to land on `main` by accident — see git history around PR #9).
- After the user merges a PR, `main` advances on the remote; fast-forward local `main` with `git fetch` + checkout, but do new work on a fresh branch.

### Releases
- Every release **must** bump `CACHE` in `sw.js` **and** `APP_VERSION` in `app.js`. The cache-first SW serves stale files otherwise.
- Any **new file** that ships to the client must be added to the `ASSETS` precache list in `sw.js`.
- If the store shape changes, bump `SCHEMA_VERSION` **and** add a migration step in `migrate()`.

### Backward compatibility (sacred)
- Updates must never break an existing player's `localStorage` store or records.
- `fillDefaults()` only fills missing fields — it never drops user data. Migrations are sequential and additive.
- Verb ids are stable (the key is the base form). Never renumber/rename ids.
- **Never edit a migration that has already shipped** — only add the next `if (s.schemaVersion < N)` step.
- Every new migration ships in the same PR as a test of the prior→new transition (`test/store-migrate.test.js`); if the shape changes materially, add/update a real fixture. See `docs/MODULARIZATION_PLAN.md` §11 for the planned durability safeguards (pre-migration backup, non-destructive import).

### Data conventions
- Verbs with multiple valid forms are stored slash-joined: `"was/were"`, `"burnt/burned"`, pp `"got/gotten"`. `isCorrect()` accepts any single form, the whole token, or all forms in any order; matching is letters-only normalized.
- `examples.json` mirrors `verbs.json` by id: 3 sentences per verb (base / past / participle), the target form wrapped in `*asterisks*`.

### Audio & haptics
- Voice (SpeechSynthesis) plays the correct answer on **every** answer, right or wrong.
- `settings.sound` gates SFX; `settings.haptics` is a **separate** toggle (single buzz on correct, double on wrong; Android only).

## Verifying changes
- Use the preview tools (server already runs on :8123). After editing, reload, check the console for errors, and screenshot the result — don't ask the user to verify manually.
- **Preview cache quirk:** `location.reload()` can serve a stale `style.css` (and sometimes `app.js`). To force-refresh CSS:
  `document.querySelector('link[rel=stylesheet]').href = 'style.css?cb=' + Date.now()`.
  For `app.js`: unregister the SW, clear caches, then reload twice. On real GitHub Pages this is solved by bumping `CACHE`.
- For pure logic, prefer the `node --test` suite (see `docs/MODULARIZATION_PLAN.md`) over a browser round-trip.

## Where things live (current monolith)
`app.js` (~1500 lines) is organized in banner-delimited sections: config/constants & state →
store (load/migrate/save) → helpers (leveling & SRS math) → navigation → SRS selection →
session/gameplay → achievements → cosmetics → speech & sound → rendering → modal → onboarding →
utils → wiring → boot. A plan to split this into ES modules + tests lives in
[`docs/MODULARIZATION_PLAN.md`](docs/MODULARIZATION_PLAN.md).
