# ⚔️ Tense Titans

A small, offline-first PWA that helps kids learn English **irregular verbs** through play.
Pure HTML / CSS / JS — no backend, no build step.

**Play:** https://letulip.github.io/tense-titans/

## Features
- 🎯 **Pick the form** and ⌨️ **Type it** game modes
- 🧠 Spaced repetition (Leitner) — shows the verbs you struggle with more often
- 🌱→🌳 Five clear mastery stages; full mastery (🌳) is earned only in *Type it*
- 🔥 Streaks, ⭐ XP & levels, 🏆 achievements
- 🥚 Tamagotchi-style mascot that evolves as you level up
- 🇷🇺 On-demand translations + 🔊 voice playback (with silly voice presets)
- 🎨 Unlockable themes & mascots, dark mode
- 📲 Installable PWA — works fully offline after first load
- 💾 Progress saved locally; export/import to move between devices

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
