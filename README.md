# ⚔️ Tense Titans

A small, offline-first PWA that helps kids learn English **irregular verbs** through play.
Pure HTML / CSS / JS — no backend, no build step.

**Play:** https://letulip.github.io/tense-titans/

## Features
- 🎯 **Pick the form**, ⌨️ **Type it**, 🌍 **Match meaning**, ⚡ **Speed round**, plus 🔔 **Review** and 🛠️ **Fix mistakes**
- 🧠 Per-form spaced repetition — surfaces the verbs you struggle with, on a real review schedule
- 🌱→🌳→🌟 Mastery stages; full mastery is earned only in *Type it* (recall, not recognition)
- 🔥 Streaks, ⭐ XP & geometric levels, 🏅 rank titles, 🏆 41 achievements in three categories
- 🐲 Illustrated mascot that evolves through six stages as you level up
- 🇷🇺 On-demand translations + 🔊 voice playback (with silly voice presets) + 📳 haptics
- 🎨 Themes & mascots unlocked by real progress, dark mode, reduced-motion
- 📲 Installable PWA — works fully offline after first load
- 💾 Progress saved locally; export/import to move between devices

## Project docs
- [`CLAUDE.md`](CLAUDE.md) — conventions & hard rules (git flow, cache busting, backward compat)
- [`docs/MODULARIZATION_PLAN.md`](docs/MODULARIZATION_PLAN.md) — plan to split `app.js` into ES modules + tests

## Run locally
Service workers need HTTP (not `file://`):
```bash
python3 -m http.server 8123
# open http://localhost:8123
```

## Updating
On each release bump `CACHE` in `sw.js` so updated files reach installed devices.
Player progress lives in `localStorage` and is never touched by updates
(the store is versioned with backward-compatible migrations).
