import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { alternativesFor, CURATED, EXERCISES, LIBRARY, pickForPattern, type Prefs } from '../services/exercises.ts';
import { classifyPattern, PHOTO_BASE } from '../services/freeExerciseDb.ts';
import { GUIDES } from '../services/exerciseGuide.ts';
import { GUIDES_EN } from '../services/exerciseGuideEn.ts';

const publicDir = path.resolve(import.meta.dirname, '../../web/public');

test('every curated exercise has a Dutch name, steps and two bundled photos', () => {
  for (const ex of CURATED) {
    assert.ok(GUIDES[ex.id], `${ex.id} has a guide`);
    assert.ok(ex.steps.length >= 2, `${ex.id} has steps`);
    assert.equal(ex.photos.length, 2, `${ex.id} has two photos`);
    for (const p of ex.photos) assert.ok(fs.existsSync(path.join(publicDir, p)), `${p} exists`);
  }
  assert.deepEqual(Object.keys(GUIDES).sort(), CURATED.map((e) => e.id).sort(), 'no guides for unknown exercises');
});

test('ids and display names are unique across the library', () => {
  const ids = LIBRARY.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  const names = EXERCISES.map((e) => e.name);
  assert.equal(new Set(names).size, names.length);
});

test('the whole free-exercise-db list is in the library', () => {
  const imported = LIBRARY.filter((e) => e.source === 'free-exercise-db');
  // 876 in the pinned import, minus the entries a curated exercise replaces.
  const replaced = new Set(Object.values(GUIDES).filter((g) => !g.similar).map((g) => g.photo));
  assert.equal(imported.length + replaced.size, 876);
  assert.ok(!imported.some((e) => replaced.has(e.id)), 'curated exercises replace their database entry');
  for (const e of imported) assert.ok(e.photos.every((p) => p.startsWith(PHOTO_BASE)), `${e.id} photos come from the pinned fork`);
  // A handful of database entries have no instructions or photos; the guide says so.
  assert.ok(imported.filter((e) => e.steps.length === 0).length <= 10);
  assert.ok(imported.filter((e) => e.photos.length < 2).length <= 10);
  for (const c of ['stretching', 'cardio', 'plyometrics', 'olympic', 'strongman'] as const) {
    assert.ok(imported.some((e) => e.category === c), `${c} is in the library`);
    assert.ok(!imported.some((e) => e.category === c && e.programmable), `${c} is never programmable`);
  }
});

test('programmable imported exercises are complete', () => {
  const imported = EXERCISES.filter((e) => e.source === 'free-exercise-db');
  assert.ok(imported.length > 300, `${imported.length} imported exercises are programmable`);
  for (const e of imported) {
    assert.ok(e.pattern && e.loadType && e.startFactor >= 0, e.id);
    assert.ok(!e.otherEquipment, `${e.id} needs only profile equipment`);
    assert.ok(!/clean|snatch|jerk|jump|chains/i.test(e.name), `${e.id} is not an explosive or special-setup lift`);
  }
});

test('classification of imported exercises', () => {
  const c = (name: string, primary: string, force: 'push' | 'pull' | 'static' | null = 'pull', mechanic: 'compound' | 'isolation' | null = 'compound') =>
    classifyPattern({ name, primaryMuscles: [primary], force, mechanic });
  assert.equal(c('Smith Machine Bent Over Row', 'lats'), 'horizontal_pull', '"machine" is not a chin-up');
  assert.equal(c('V-Bar Pulldown', 'lats'), 'vertical_pull');
  assert.equal(c('Decline Dumbbell Flyes', 'chest', 'push', 'isolation'), 'chest_iso');
  assert.equal(c('Wide-Grip Barbell Bench Press', 'chest', 'push'), 'horizontal_push');
  assert.equal(c('Floor Press', 'triceps', 'push'), 'horizontal_push');
  assert.equal(c('Tricep Dumbbell Kickback', 'triceps', 'push', 'isolation'), 'triceps');
  assert.equal(c('Seated Leg Curl', 'hamstrings', 'pull', 'isolation'), 'hamstring_iso');
  assert.equal(c('Sumo Deadlift', 'hamstrings'), 'hinge');
  assert.equal(c('Barbell Walking Lunge', 'quadriceps', 'push'), 'lunge');
  assert.equal(c('Barbell Shrug', 'traps'), null);
});

test('rule-based templates only pick curated exercises', () => {
  const all = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'pullup_bar', 'bench', 'bands'] as const;
  for (const pattern of new Set(EXERCISES.map((e) => e.pattern))) {
    const pick = pickForPattern(pattern, [...all], new Set());
    if (pick) assert.equal(pick.source, 'overload', `${pattern} picks ${pick.id}`);
  }
});

test('favourites win a pattern, excluded exercises are never picked or offered', () => {
  const gym = ['barbell', 'dumbbell', 'machine', 'cable', 'bench', 'pullup_bar'] as const;
  const prefs: Prefs = { favorites: new Set(['Box_Squat']), excluded: new Set(['barbell_bench_press']) };
  // A favourite from the import beats the curated preference order.
  assert.equal(pickForPattern('squat', [...gym], new Set())?.id, 'back_squat');
  assert.equal(pickForPattern('squat', [...gym], new Set(), prefs)?.id, 'Box_Squat');
  // An excluded curated exercise is skipped.
  assert.equal(pickForPattern('horizontal_push', [...gym], new Set())?.id, 'barbell_bench_press');
  assert.notEqual(pickForPattern('horizontal_push', [...gym], new Set(), prefs)?.id, 'barbell_bench_press');
  // Alternatives: favourites first, excluded never.
  const alts = alternativesFor('back_squat', [...gym], [], prefs);
  assert.equal(alts[0].id, 'Box_Squat');
  assert.ok(!alternativesFor('dumbbell_bench_press', [...gym], [], prefs).some((e) => e.id === 'barbell_bench_press'));
});

test('every curated exercise has English steps too, with a photo note wherever the Dutch guide has one', () => {
  assert.deepEqual(Object.keys(GUIDES_EN).sort(), Object.keys(GUIDES).sort());
  for (const [id, g] of Object.entries(GUIDES)) {
    assert.ok(GUIDES_EN[id].steps.length >= 2, `${id} has English steps`);
    assert.equal(Boolean(GUIDES_EN[id].similar), Boolean(g.similar), `${id} photo note in both languages`);
  }
});
