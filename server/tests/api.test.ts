import zlib from 'node:zlib';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestDb } from './helpers.ts';

process.env.WEB_DIR = '/nonexistent';
const testDb = await startTestDb();
delete process.env.AI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

const { openDb, closeDb, migrate } = await import('../db.ts');
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
  trainingDays: 3,
  sessionMinutes: 60,
  equipment: ['barbell', 'dumbbell', 'bench', 'cable', 'machine', 'pullup_bar'],
  limitations: '',
  increments: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, kettlebell: 4 },
};

test('healthz reports the database without auth; migrations are idempotent', async () => {
  const health = await call('GET', '/healthz');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { status: 'ok', database: 'ok' });
  const again = await migrate();
  assert.equal(again.from, again.to, 'a second migrate run is a no-op');
});

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
  assert.equal(today.body.program.workoutNumber, 1);
  assert.equal(today.body.program.totalWorkouts, program.days.length * 6, 'a block of 6 rounds, counted in workouts');

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

  // Nothing counts as trained until the workout is finished.
  assert.deepEqual((await call('GET', '/api/stats/exercise-usage')).body, {});

  const reloaded = await call('GET', `/api/workouts/${workout.id}`);
  assert.equal(reloaded.body.workout.exercises[0].logged.length, first.sets);

  const fin = await call('POST', `/api/workouts/${workout.id}/finish`);
  assert.equal(fin.status, 200);
  // The library shows how often each exercise was trained and the heaviest set.
  const usage = (await call('GET', '/api/stats/exercise-usage')).body;
  assert.deepEqual(Object.keys(usage).sort(), [first.exerciseId, second.exerciseId].sort());
  assert.equal(usage[first.exerciseId].sessions, 1);
  assert.equal(usage[first.exerciseId].sets, first.sets);
  assert.equal(usage[first.exerciseId].topWeight, first.targetWeight);
  assert.equal(usage[first.exerciseId].topReps, first.repMax);
  assert.ok(usage[first.exerciseId].lastDone);
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
  assert.equal(alts.body.alternatives[0].source, 'overload', 'curated alternatives come first');

  // Imported exercises can be swapped in; the target comes from the start-weight estimate.
  const pe2 = programAfter.body.program.days[0].exercises[1];
  const alts2 = await call('GET', `/api/program-exercises/${pe2.id}/alternatives`);
  const imported = alts2.body.alternatives.find((a: any) => a.source === 'free-exercise-db');
  assert.ok(imported, 'imported exercises are offered when swapping');
  const swapped = await call('POST', `/api/program-exercises/${pe2.id}/replace`, { exerciseId: imported.id });
  assert.equal(swapped.status, 200);
  const after = swapped.body.program.days[0].exercises.find((e: any) => e.id === pe2.id);
  assert.equal(after.exerciseId, imported.id);
  assert.equal(after.name, imported.name);
  assert.ok(after.target.weight >= 0);
  // Library-only exercises (stretching, ...) cannot be swapped in.
  const library = await app.inject({ method: 'GET', url: '/api/exercises', headers: { 'accept-encoding': 'gzip' } });
  assert.equal(library.headers['content-encoding'], 'gzip');
  const all = JSON.parse(zlib.gunzipSync(library.rawPayload).toString());
  assert.ok(all.length > 800);
  const stretch = all.find((e: any) => e.category === 'stretching');
  assert.equal((await call('POST', `/api/program-exercises/${pe2.id}/replace`, { exerciseId: stretch.id })).status, 400);

  // Regenerating keeps the earned weight for exercises that carry over with the same rep range.
  const regen = await call('POST', '/api/programs/generate', {});
  const carried = regen.body.program.days.flatMap((d: any) => d.exercises).find((e: any) => e.exerciseId === pe.exerciseId && e.repMin === pe.repMin && e.repMax === pe.repMax);
  if (carried) assert.equal(carried.target.weight, pe.target.weight);

  // Without AI the rule-based program uses favourites and skips excluded exercises.
  assert.equal((await call('PUT', '/api/exercise-preferences', { exerciseId: 'Box_Squat', preference: 'favorite' })).status, 200);
  assert.equal((await call('PUT', '/api/exercise-preferences', { exerciseId: 'deadlift', preference: 'excluded' })).status, 200);
  const marked = (await call('POST', '/api/programs/generate', {})).body.program;
  const ids = marked.days.flatMap((d: any) => d.exercises.map((e: any) => e.exerciseId));
  assert.ok(ids.includes('Box_Squat'), 'favourite squat is used');
  assert.ok(!ids.includes('deadlift'), 'excluded exercise is not used');

  const exported = await call('GET', '/api/export/json');
  assert.equal(exported.body.app, 'overload');
  assert.equal(exported.body.tables.workouts.length, 1);
  assert.equal(exported.body.tables.exercise_preferences.length, 2, 'marks are part of the export');
  const csv = await call('GET', '/api/export/sets.csv');
  assert.match(String(csv.body), /^date,workout/);

  assert.equal((await call('POST', '/api/import/json', exported.body)).status, 200);
  assert.equal((await call('GET', '/api/stats')).body.totals.workouts, 1);
  assert.deepEqual((await call('GET', '/api/exercise-preferences')).body, { favorites: ['Box_Squat'], excluded: ['deadlift'] });
  assert.equal((await call('POST', '/api/import/json', { foo: 1 })).status, 400);

  const coach = await call('POST', '/api/coach/messages', { content: 'How am I doing?' });
  assert.equal(coach.status, 200);
  assert.match(coach.body.messages[1].content, /AI is off/);
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
  assert.equal(active.body.program.rounds, 6, 'old exports use weeks/deload_week; they map onto rounds');
  assert.equal(active.body.program.deloadRound, 6);
  assert.equal(active.body.program.days[0].exercises[0].target.weight, 42.5);
  assert.deepEqual(active.body.program.days[0].exercises[0].target.repTargets, [8, 8, 8]);
  assert.equal((await call('GET', '/api/stats')).body.totals.workouts, 1);
  // Identity sequences continue after imported ids.
  const regen = await call('POST', '/api/programs/generate', {});
  assert.ok(regen.body.program.id > 7);
});

test('30-minute sessions get superset pairs that reach the workout screen', async () => {
  const today = await call('GET', '/api/today');
  if (today.body.inProgressWorkoutId) await call('DELETE', `/api/workouts/${today.body.inProgressWorkoutId}`);

  assert.equal((await call('PUT', '/api/profile', { ...profile, trainingDays: 2, sessionMinutes: 30 })).status, 200);
  const gen = await call('POST', '/api/programs/generate', {});
  assert.equal(gen.status, 200);
  const day = gen.body.program.days[0];
  assert.deepEqual(
    day.exercises.map((e: any) => e.superset),
    ['A', 'A', 'B', 'B'],
  );

  const started = await call('POST', '/api/workouts', { programDayId: day.id });
  assert.equal(started.status, 200);
  const workout = (await call('GET', `/api/workouts/${started.body.workout.id}`)).body.workout;
  assert.deepEqual(
    workout.exercises.map((e: any) => e.superset),
    ['A', 'A', 'B', 'B'],
  );
  assert.equal((await call('DELETE', `/api/workouts/${workout.id}`)).status, 200);
});

test('the active program explains how it was built and which day is next', async () => {
  const res = await call('GET', '/api/programs/active');
  assert.equal(res.status, 200);
  const { program, explanation } = res.body;
  assert.equal(program.nextDayIndex, 0, 'no workouts done in this program yet');
  const titles = explanation.map((s: any) => s.title);
  for (const t of ['Who made it', 'Schedule', 'Exercises per session', 'Sets, reps and rest', 'Starting weights', 'How weights change', 'Deload']) {
    assert.ok(titles.includes(t), `has section ${t}`);
  }
  const sets = explanation.find((s: any) => s.title === 'Sets, reps and rest');
  assert.ok(sets.bullets.some((b: string) => b.includes('3 × 8–12')), 'hypertrophy compound scheme');
  assert.ok(sets.bullets.some((b: string) => b.includes('superset')), 'superset rest is explained for 30-minute sessions');
  const perSession = explanation.find((s: any) => s.title === 'Exercises per session');
  assert.equal(perSession.bullets.length, program.days.length, 'one line per training day');
});

test('profiles saved with daysPerWeek (before 1.8) read as trainingDays', async () => {
  const current = (await call('GET', '/api/profile')).body.profile;
  const { trainingDays, ...rest } = current;
  assert.equal((await call('PUT', '/api/profile', { ...rest, daysPerWeek: trainingDays })).status, 200);
  assert.equal((await call('GET', '/api/profile')).body.profile.trainingDays, trainingDays);
});

test('everything the user sees follows the language in the profile', async () => {
  const en = (await call('GET', '/api/programs/active')).body.program;
  assert.match(en.name, / for muscle growth$/);
  assert.equal((await call('GET', '/api/info')).body.language, 'en');

  const current = (await call('GET', '/api/profile')).body.profile;
  assert.equal(current.language, 'en', 'English by default');
  assert.equal((await call('PUT', '/api/profile', { ...current, language: 'nl' })).status, 200);
  assert.equal((await call('GET', '/api/info')).body.language, 'nl');

  // The same stored program now reads in Dutch: name, days, engine advice, explanation.
  const { program, explanation } = (await call('GET', '/api/programs/active')).body;
  assert.match(program.name, / voor spiermassa$/);
  assert.notEqual(program.days[0].focus, en.days[0].focus, 'day focus is stored in both languages');
  assert.ok(program.days.flatMap((d: any) => d.exercises).some((e: any) => /Eerste schatting|Meegenomen|Geschat|lichaamsgewicht/.test(e.target.reason)));
  assert.ok(explanation.some((s: any) => s.title === 'Wie het heeft gemaakt'));
  const bench = program.days.flatMap((d: any) => d.exercises).find((e: any) => e.exerciseId === 'barbell_bench_press');
  if (bench) assert.equal(bench.name, 'Bankdrukken (barbell)');

  // The library: Dutch names and steps for curated exercises, English for imported ones.
  const nl = (await app.inject({ method: 'GET', url: '/api/exercises?lang=nl' })).json();
  assert.equal(nl.find((e: any) => e.id === 'barbell_bench_press').name, 'Bankdrukken (barbell)');
  assert.equal(nl.find((e: any) => e.id === 'Box_Squat').name, 'Box Squat');
  const enLib = (await app.inject({ method: 'GET', url: '/api/exercises?lang=en' })).json();
  assert.equal(enLib.find((e: any) => e.id === 'barbell_bench_press').name, 'Barbell bench press');
  assert.match(enLib.find((e: any) => e.id === 'barbell_bench_press').steps[0], /^Lie on the bench/);

  // Errors too.
  assert.match((await call('POST', '/api/import/json', { foo: 1 })).body.error, /geen exportbestand/);
  assert.equal((await call('PUT', '/api/profile', { ...current, language: 'en' })).status, 200);
  assert.match((await call('POST', '/api/import/json', { foo: 1 })).body.error, /not an Overload export/);
});
