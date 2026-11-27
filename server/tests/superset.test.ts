import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Profile } from '../../shared/types.ts';
import { getExercise } from '../services/exercises.ts';
import { sanitizeAiProgram } from '../services/programGenerator.ts';
import { normalizeSupersets } from '../services/programs.ts';
import { buildTemplateProgram, exercisesPerSession, pairIntoSupersets } from '../services/programTemplates.ts';

const profile: Profile = {
  name: 'Test',
  age: 35,
  heightCm: 182,
  weightKg: 80,
  level: 'intermediate',
  goal: 'hypertrophy',
  trainingDays: 2,
  sessionMinutes: 30,
  equipment: ['barbell', 'dumbbell', 'bench', 'cable', 'machine', 'pullup_bar'],
  limitations: '',
  language: 'en',
  increments: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, kettlebell: 4 },
};

const labels = (xs: { superset?: string | null }[]) => xs.map((x) => x.superset ?? null);

test('normalizeSupersets keeps neighbouring pairs, drops singles and relabels in order', () => {
  const out = normalizeSupersets([{ superset: 'x' }, { superset: 'X' }, { superset: 'B' }, { superset: null }, { superset: 'C' }, { superset: 'C' }]);
  assert.deepEqual(labels(out), ['A', 'A', null, null, 'B', 'B']);
});

test('normalizeSupersets splits long runs into groups of at most three', () => {
  assert.deepEqual(labels(normalizeSupersets(Array.from({ length: 3 }, () => ({ superset: 'A' })))), ['A', 'A', 'A']);
  assert.deepEqual(labels(normalizeSupersets(Array.from({ length: 4 }, () => ({ superset: 'A' })))), ['A', 'A', 'B', 'B']);
  assert.deepEqual(labels(normalizeSupersets(Array.from({ length: 5 }, () => ({ superset: 'A' })))), ['A', 'A', 'B', 'B', 'B']);
});

test('normalizeSupersets does not join the same label across a gap', () => {
  const out = normalizeSupersets([{ superset: 'A' }, { superset: null }, { superset: 'A' }]);
  assert.deepEqual(labels(out), [null, null, null]);
});

test('pairIntoSupersets prefers push with pull and never pairs the same region', () => {
  const out = pairIntoSupersets([
    { id: 'squat', pattern: 'squat' as const },
    { id: 'bench', pattern: 'horizontal_push' as const },
    { id: 'row', pattern: 'horizontal_pull' as const },
    { id: 'rdl', pattern: 'hinge' as const },
  ]);
  assert.deepEqual(
    out.map((o) => `${o.superset}:${o.item.id}`),
    ['A:squat', 'A:bench', 'B:row', 'B:rdl'],
  );
  const pushPull = pairIntoSupersets([
    { id: 'bench', pattern: 'horizontal_push' as const },
    { id: 'squat', pattern: 'squat' as const },
    { id: 'row', pattern: 'horizontal_pull' as const },
  ]);
  assert.deepEqual(
    pushPull.map((o) => `${o.superset}:${o.item.id}`),
    ['A:bench', 'A:row', 'null:squat'],
  );
  const same = pairIntoSupersets([
    { id: 'squat', pattern: 'squat' as const },
    { id: 'lunge', pattern: 'lunge' as const },
  ]);
  assert.deepEqual(labels(same), [null, null]);
});

test('30-minute full body A/B uses supersets of non-competing exercises', () => {
  const draft = buildTemplateProgram(profile);
  assert.equal(draft.days.length, 2);
  assert.match(draft.name, /Full body A\/B/);
  assert.match(draft.rationale, /superset/i);
  assert.equal(exercisesPerSession(30), 4);
  for (const day of draft.days) {
    assert.equal(day.exercises.length, 4);
    const groups = new Map<string, string[]>();
    for (const e of day.exercises) {
      assert.ok(e.superset, `${e.exerciseId} is in a superset`);
      groups.set(e.superset!, [...(groups.get(e.superset!) ?? []), e.exerciseId]);
      assert.ok(e.restSeconds <= 120, 'rest is per round and short');
    }
    assert.equal(groups.size, 2);
    for (const ids of groups.values()) {
      assert.equal(ids.length, 2);
      const [a, b] = ids.map((id) => getExercise(id)!);
      assert.notEqual(a.primary, b.primary, `${a.id} and ${b.id} do not compete for the same muscle`);
    }
  }
});

test('60-minute sessions use straight sets', () => {
  const draft = buildTemplateProgram({ ...profile, sessionMinutes: 60 });
  assert.ok(draft.days.every((d) => d.exercises.every((e) => !e.superset)));
});

test('AI supersets are validated: broken pairs lose their label', () => {
  const draft = sanitizeAiProgram(
    {
      name: 'Full body A/B',
      rounds: 6,
      deloadRound: 6,
      days: [
        {
          name: 'Full body A',
          exercises: [
            { exerciseId: 'back_squat', sets: 3, repMin: 8, repMax: 12, restSeconds: 90, superset: 'A' },
            { exerciseId: 'barbell_bench_press', sets: 3, repMin: 8, repMax: 12, restSeconds: 90, superset: 'A' },
            { exerciseId: 'made_up_exercise', sets: 3, repMin: 8, repMax: 12, restSeconds: 90, superset: 'B' },
            { exerciseId: 'romanian_deadlift', sets: 3, repMin: 8, repMax: 12, restSeconds: 90, superset: 'B' },
            { exerciseId: 'lat_pulldown', sets: 3, repMin: 10, repMax: 15, restSeconds: 90, superset: 42 },
          ],
        },
        { name: 'Full body B', exercises: [{ exerciseId: 'overhead_press', sets: 3, repMin: 6, repMax: 10, restSeconds: 120 }] },
      ],
    },
    profile,
  );
  assert.deepEqual(labels(draft.days[0].exercises), ['A', 'A', null, null]);
  assert.deepEqual(labels(draft.days[1].exercises), [null]);
});
