import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestDb } from './helpers.ts';

process.env.WEB_DIR = '/nonexistent';
const testDb = await startTestDb();
delete process.env.AI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

const { openDb, closeDb } = await import('../db.ts');
const { initAuth } = await import('../auth.ts');
const { buildApp } = await import('../app.ts');

await openDb(testDb.url);
await initAuth();
const app = await buildApp();

const call = async (method: string, url: string, payload?: unknown) => {
  const res = await app.inject({ method: method as any, url, payload: payload as any });
  const body = res.headers['content-type']?.toString().includes('json') ? res.json() : res.body;
  return { status: res.statusCode, body };
};

before(async () => {});
after(async () => {
  await app.close();
  await closeDb();
  await testDb.stop();
});

const profile = {
  name: 'Test',
  age: 35,
  heightCm: 182,
  weightKg: 80,
  level: 'intermediate',
  goal: 'hypertrophy',
  daysPerWeek: 3,
  sessionMinutes: 60,
  equipment: ['barbell', 'dumbbell', 'bench', 'cable', 'machine', 'pullup_bar'],
  limitations: '',
  increments: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, kettlebell: 4 },
};

test('full flow: profile, program, workout, progression, stats, export', async () => {
  const info = await call('GET', '/api/info');
  assert.equal(info.body.aiConfigured, false);

  assert.equal((await call('POST', '/api/programs/generate', {})).status, 409, 'needs a profile first');
  assert.equal((await call('PUT', '/api/profile', { ...profile, age: 5 })).status, 400);
  assert.equal((await call('PUT', '/api/profile', profile)).status, 200);

  const gen = await call('POST', '/api/programs/generate', {});
  assert.equal(gen.status, 200);
  const program = gen.body.program;
  assert.equal(program.days.length, 3);
  assert.equal(program.source, 'template');
  assert.ok(gen.body.notice);
  for (const d of program.days) assert.ok(d.exercises.length >= 4 && d.exercises.length <= 8);

  const today = await call('GET', '/api/today');
  assert.equal(today.body.nextDay.id, program.days[0].id);
  assert.equal(today.body.program.currentWeek, 1);

  const started = await call('POST', '/api/workouts', { programDayId: today.body.nextDay.id });
  const workout = started.body.workout;
  assert.equal(workout.status, 'in_progress');
  // Starting again returns the same in-progress workout.
  assert.equal((await call('POST', '/api/workouts', { programDayId: today.body.nextDay.id })).body.workout.id, workout.id);

  const first = workout.exercises[0];
  const second = workout.exercises[1];
  for (let i = 0; i < first.sets; i++) {
    const r = await call('PUT', `/api/workouts/${workout.id}/sets`, { programExerciseId: first.programExerciseId, setIndex: i, weight: first.targetWeight, reps: first.repMax, rir: 2 });
    assert.equal(r.status, 200);
  }
  // Retrying the same set is idempotent.
  await call('PUT', `/api/workouts/${workout.id}/sets`, { programExerciseId: first.programExerciseId, setIndex: 0, weight: first.targetWeight, reps: first.repMax, rir: 2 });
  const reps = [12, 11, 10];
  for (let i = 0; i < second.sets; i++) {
    await call('PUT', `/api/workouts/${workout.id}/sets`, { programExerciseId: second.programExerciseId, setIndex: i, weight: second.targetWeight, reps: Math.min(reps[i] ?? 10, second.repMax), rir: null });
  }

  const reloaded = await call('GET', `/api/workouts/${workout.id}`);
  assert.equal(reloaded.body.workout.exercises[0].logged.length, first.sets);

  const fin = await call('POST', `/api/workouts/${workout.id}/finish`);
  assert.equal(fin.status, 200);
  const outcomes = fin.body.summary.outcomes;
  assert.equal(outcomes.length, 2);
  assert.equal(outcomes[0].decision, first.increment > 0 ? 'increase' : 'reps');
  if (first.increment > 0) assert.equal(outcomes[0].nextWeight, first.targetWeight + first.increment);
  assert.equal(outcomes[1].decision, 'hold');

  const programAfter = await call('GET', '/api/programs/active');
  const pe = programAfter.body.program.days[0].exercises[0];
  assert.equal(pe.target.weight, outcomes[0].nextWeight);
  assert.equal(programAfter.body.program.completedWorkouts, 1);

  const today2 = await call('GET', '/api/today');
  assert.equal(today2.body.nextDay.id, program.days[1].id);
  assert.equal(today2.body.inProgressWorkoutId, null);

  const history = await call('GET', '/api/workouts');
  assert.ok(Array.isArray(history.body.workouts));
  assert.equal(history.body.workouts.length, 1);

  const stats = await call('GET', '/api/stats');
  assert.equal(stats.body.totals.workouts, 1);
  assert.ok(stats.body.totals.volumeKg > 0);
  assert.ok(stats.body.muscles.length > 0);

  // Swapping an exercise keeps sets/reps and offers sensible alternatives.
  const alts = await call('GET', `/api/program-exercises/${pe.id}/alternatives`);
  assert.ok(alts.body.alternatives.length > 0);

  // Regenerating keeps the earned weight for exercises that carry over with the same rep range.
  const regen = await call('POST', '/api/programs/generate', {});
  const carried = regen.body.program.days.flatMap((d: any) => d.exercises).find((e: any) => e.exerciseId === pe.exerciseId && e.repMin === pe.repMin && e.repMax === pe.repMax);
  if (carried) assert.equal(carried.target.weight, pe.target.weight);

  const exported = await call('GET', '/api/export/json');
  assert.equal(exported.body.app, 'overload');
  assert.equal(exported.body.tables.workouts.length, 1);
  const csv = await call('GET', '/api/export/sets.csv');
  assert.match(String(csv.body), /^date,workout/);

  assert.equal((await call('POST', '/api/import/json', exported.body)).status, 200);
  assert.equal((await call('GET', '/api/stats')).body.totals.workouts, 1);
  assert.equal((await call('POST', '/api/import/json', { foo: 1 })).status, 400);

  const coach = await call('POST', '/api/coach/messages', { content: 'How am I doing?' });
  assert.equal(coach.status, 200);
  assert.match(coach.body.messages[1].content, /not configured/);
});

test('imports an export from the SQLite-based version 1.0', async () => {
  const v1 = {
    app: 'overload',
    schemaVersion: 1,
    exportedAt: '2026-10-30T10:00:00.000Z',
    tables: {
      profile: [{ id: 1, data: JSON.stringify(profile), updated_at: '2026-10-01T10:00:00.000Z' }],
      programs: [{ id: 7, name: 'Old program', weeks: 6, deload_week: 6, source: 'template', rationale: '', status: 'active', created_at: '2026-10-01T10:00:00.000Z' }],
      program_days: [{ id: 3, program_id: 7, day_index: 0, name: 'Full body A', focus: '' }],
      program_exercises: [{ id: 11, program_day_id: 3, position: 0, exercise_id: 'barbell_bench_press', sets: 3, rep_min: 8, rep_max: 12, rest_seconds: 120, notes: '' }],
      exercise_targets: [{ program_exercise_id: 11, weight: 42.5, rep_targets: '[8,8,8]', decision: 'increase', reason: 'x', source_workout_id: 5, updated_at: '2026-10-02T10:00:00.000Z' }],
      workouts: [{ id: 5, program_id: 7, program_day_id: 3, day_name: 'Full body A', week: 1, is_deload: 0, status: 'completed', started_at: '2026-10-02T09:00:00.000Z', finished_at: '2026-10-02T10:00:00.000Z' }],
      workout_sets: [0, 1, 2].map((i) => ({ id: 20 + i, workout_id: 5, program_exercise_id: 11, exercise_id: 'barbell_bench_press', set_index: i, weight: 40, reps: 12, rir: 2, completed: 1, updated_at: '2026-10-02T10:00:00.000Z' })),
      workout_outcomes: [{ workout_id: 5, program_exercise_id: 11, exercise_id: 'barbell_bench_press', decision: 'increase', from_weight: 40, next_weight: 42.5, rep_targets: '[8,8,8]', reason: 'x' }],
      coach_messages: [],
    },
  };
  assert.equal((await call('POST', '/api/import/json', v1)).status, 200);
  const active = await call('GET', '/api/programs/active');
  assert.equal(active.body.program.name, 'Old program');
  assert.equal(active.body.program.days[0].exercises[0].target.weight, 42.5);
  assert.deepEqual(active.body.program.days[0].exercises[0].target.repTargets, [8, 8, 8]);
  assert.equal((await call('GET', '/api/stats')).body.totals.workouts, 1);
  // Identity sequences continue after imported ids.
  const regen = await call('POST', '/api/programs/generate', {});
  assert.ok(regen.body.program.id > 7);
});
