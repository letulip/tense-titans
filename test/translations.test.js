import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const verbs = JSON.parse(readFileSync(new URL('../verbs.json', import.meta.url)));
const tr = JSON.parse(readFileSync(new URL('../translations.json', import.meta.url)));
const LANGS = ['es', 'fr', 'de', 'zh', 'ar'];

test('every verb has a translation entry for every language', () => {
  const missing = [];
  for (const v of verbs) {
    const t = tr[v.id];
    if (!t) { missing.push(`${v.id} (no entry)`); continue; }
    for (const l of LANGS) {
      if (typeof t[l] !== 'string' || !t[l].trim()) missing.push(`${v.id}:${l}`);
    }
  }
  assert.deepEqual(missing, [], `missing translations: ${missing.join(', ')}`);
});

test('translations.json has no entries for unknown verbs', () => {
  const ids = new Set(verbs.map(v => v.id));
  const extra = Object.keys(tr).filter(id => !ids.has(id));
  assert.deepEqual(extra, [], `unknown verb ids: ${extra.join(', ')}`);
});

test('every verb still has its Russian base translation', () => {
  for (const v of verbs) {
    assert.ok(Array.isArray(v.ru) && v.ru.length > 0, `${v.id} missing ru`);
  }
});
