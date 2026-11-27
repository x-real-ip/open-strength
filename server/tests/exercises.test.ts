import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EXERCISES } from '../services/exercises.ts';
import { GUIDES } from '../services/exerciseGuide.ts';

const publicDir = path.resolve(import.meta.dirname, '../../web/public');

test('every exercise has a Dutch name, steps and two bundled photos', () => {
  for (const ex of EXERCISES) {
    assert.ok(GUIDES[ex.id], `${ex.id} has a guide`);
    assert.ok(ex.steps.length >= 2, `${ex.id} has steps`);
    assert.equal(ex.photos.length, 2, `${ex.id} has two photos`);
    for (const p of ex.photos) assert.ok(fs.existsSync(path.join(publicDir, p)), `${p} exists`);
  }
  assert.deepEqual(Object.keys(GUIDES).sort(), EXERCISES.map((e) => e.id).sort(), 'no guides for unknown exercises');
});

test('display names are unique', () => {
  const names = EXERCISES.map((e) => e.name);
  assert.equal(new Set(names).size, names.length);
});
