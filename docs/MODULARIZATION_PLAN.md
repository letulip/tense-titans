# Modularization & testing plan for `app.js`

**Status:** proposal (no code moved yet).
**Goal:** split the ~1500-line `app.js` monolith into small ES modules and cover the
game logic with automated tests — **without introducing a build step.**

---

## 1. Goals & non-goals

**Goals**
- One responsibility per file; easy to find and change a piece of behaviour.
- A **DOM-free core** (leveling, spaced repetition, answer matching, store migrations,
  achievements) that can be unit-tested in Node with zero browser and zero dependencies.
- The app keeps working after every step; each phase is its own small PR.

**Non-goals**
- No bundler / transpiler / framework. We stay on **native ES modules** (`<script type="module">`),
  which browsers and GitHub Pages (HTTPS) load directly.
- No change to gameplay, visuals, or the saved-store format. This is a pure refactor.
- No rewrite — we *move* code, keeping behaviour identical, verified by tests + preview.

## 2. Why this is needed (current pain)

- `app.js` mixes config, state, pure math, DOM rendering, audio, and wiring in one scope.
- Two module-level mutables, `store` (~111 refs) and `session` (~112 refs), are read/written
  directly everywhere — so nothing can be tested in isolation and any change risks side effects.
- ~137 `$()/$$()` DOM calls are interleaved with game logic (e.g. `handleAnswer` scores the
  answer **and** renders feedback **and** saves the store), so logic can't be exercised headlessly.

## 3. Constraint that drives the design: **testability = DOM-free**

Node's built-in test runner (`node --test`, no deps) can only import modules that don't touch
`document`/`window`. So the split is organized around a hard line:

```
        pure core  (no DOM, no globals — inputs in, values out)   →  unit-tested in Node
        ----------------------------------------------------------------
        shell      (DOM render, audio, wiring, the mutable store)  →  verified in the browser preview
```

Pure functions that today read globals (`troubleScore`, `pickVerb`, `checkAchievements`,
`reqMet`, …) get their state **passed in as arguments** instead. The mutable singletons live in
one `state.js` that only the shell imports.

## 4. Target layout

```
index.html            → <script type="module" src="src/main.js">
src/
  config.js           constants: versions, SRS tunables, STAGES, EVO_*, RANKS,
                      THEMES, MASCOTS, VOICE_PRESETS, ACHIEVEMENTS, ACH_CATS, SFX defs
  state.js            the mutable singletons: store, session, VERBS, verbById, EXAMPLES
  data.js             load verbs.json / examples.json into VERBS/verbById/EXAMPLES

  core/   ── DOM-free, fully unit-tested ──────────────────────────────
    leveling.js       xpForLevel, levelFromXp, xpIntoLevel, xpForNextLevel,
                      evoStageForLevel, currentEvoStage(level), rankTitle
    srs.js            newForm, minLvl, formDue, isReviewDue, decay/forgetting,
                      applyAnswer(form, ok) → next form state, interval scheduling
    matching.js       lettersOnly, isCorrect, regularize, distractorsFor(q, verbs)
    selection.js      pickVerb, buildReviewQueue, chooseForm, troubleScore, troubleList
                      (all take store/VERBS as params)
    achievements.js   evaluate(stats, progress, …) → unlocked ids; category helpers
    cosmetics.js      reqMet, isUnlocked, markUnlocks, reqText
    store-migrate.js  defaultStore, fillDefaults, migrate (the pure half of the store)

  store.js            localStorage load/save (wraps store-migrate.js); the only fs-ish I/O
  game.js             session orchestration: startSession, the scoring half of handleAnswer,
                      endSession/endSpeed — calls core/*, owns no DOM
  audio.js            SpeechSynthesis + WebAudio SFX (browser only)
  dom.js              $, $$, toast, confetti, small DOM utilities
  ui/
    nav.js            show(screen)
    play.js           renderQuestion, option/type inputs, feedback, example card
    home.js           renderHome
    stats.js          renderStats + activity heatmap
    achievements.js   renderAchievements (categories)
    settings.js       renderSettings (pickers, voice controls)
    results.js        results screen
    modal.js          how-to-play / info modal
    onboarding.js     first-launch flow
  wire.js             event wiring (delegated listeners)
  main.js             boot(): load data → migrate store → wire → first render → SW register

test/                 node --test
  leveling.test.js  srs.test.js  matching.test.js  selection.test.js
  store-migrate.test.js  achievements.test.js  cosmetics.test.js
```

## 5. What gets tested first (highest value, lowest effort)

| Module | Example cases to lock down |
|---|---|
| `leveling` | XP→level boundaries (0/100/300/700/1500/3100/…), rank↔evo-stage alignment (Lv 1/3/5/7/9/11), `xpForNextLevel` |
| `matching` | `isCorrect` accepts `was`/`were`/`was/were`; `burnt`↔`burned`; rejects gibberish; `regularize` stays naive (`cut→cuted`, not `quitted`) |
| `srs` | correct raises level & schedules `due`; wrong drops −2 and re-queues; decay below peak relearns 2× faster; `formDue`/`isReviewDue` gates |
| `selection` | `troubleScore` = 0 once a missed form recovers to the gate (the "stuck forever" bug stays fixed); `chooseForm` picks the weaker form; review queue contains only due forms |
| `store-migrate` | v1→v6 chain keeps user fields; `fillDefaults` never drops data; unknown future fields survive |
| `achievements` | each threshold fires exactly once; categories partition all 41 badges; hidden ones stay hidden until earned |
| `cosmetics` | `reqMet` for level/mastered/streak/champion; sticky once unlocked |

`package.json`: `{ "type": "module", "scripts": { "test": "node --test" } }`. Zero dependencies.
(Optional later: a `test/dom/` suite under **jsdom** or **Playwright** for render smoke tests —
deferred; the preview workflow covers UI for now.)

## 6. Phased rollout (each phase = one PR, app stays shippable)

1. **Scaffold + tooling.** Add `package.json`, `test/`, this plan, CI-less `npm test`. No app
   change yet. Bump `CACHE`. *(Proves `node --test` runs before we depend on it.)*
2. **Extract the leaf-pure core** with characterization tests **first**, then move the code:
   `leveling` → `matching` → `srs`. These have the fewest dependencies. After each, `app.js`
   imports from the new module; behaviour identical; tests green; preview sanity-check.
3. **Stateful-but-pure core:** `store-migrate`, `selection`, `achievements`, `cosmetics` — refactor
   to take `store`/`VERBS` as parameters, add tests, wire `app.js` to call them.
4. **Introduce `state.js` + `config.js`** and switch `index.html` to `<script type="module">`.
   Update `sw.js` `ASSETS` to list every `src/**` file. This is the load-path change — verify
   offline install still works.
5. **Split the shell:** `audio`, `dom`, `game`, then `ui/*`, `wire`, `main`. Mechanical moves,
   verified in preview (console clean + screenshots) since they're DOM-bound.
6. **Delete the old `app.js`** once `main.js` is the entry point and all sections have moved.

Roll back any phase by reverting its single PR.

## 7. Risks & mitigations

- **Many small files = more HTTP requests.** Fine on GH Pages; the SW precaches them all, so
  there's exactly one cold fetch each. Add them to `sw.js` `ASSETS` in the same PR (rule already
  in `CLAUDE.md`).
- **ES modules need HTTP** (no `file://`) — already true because of the service worker. Local dev
  stays `python3 -m http.server`.
- **`<script type="module">` is deferred & strict** — `boot()` already runs after load, and the
  file is already `'use strict'`, so no behaviour change.
- **Global-state untangling is the real cost** (store/session everywhere). Mitigation: do it
  module-by-module behind passing tests; never a big-bang rewrite.
- **Store/back-compat regressions are the scariest.** Mitigation: `store-migrate` gets tests
  covering the full v1→v6 chain *before* it moves; never touch the `localStorage` shape.

## 8. Definition of done

- `npm test` green; pure core has meaningful coverage of the cases in §5.
- `app.js` is gone; `src/main.js` is the entry; `index.html` uses `type="module"`.
- App installs and runs **offline** exactly as before; existing saved progress loads unchanged.
- `CACHE`/`APP_VERSION` bumped; `sw.js` lists all module files.

## 9. Suggested first PR (smallest useful slice)

Phase 1 + the `leveling` half of Phase 2: scaffold `package.json` + `test/`, extract
`src/core/leveling.js`, add `test/leveling.test.js`, and have `app.js` import it. Small, reversible,
and it establishes the test harness everything else builds on.
