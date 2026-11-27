import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestDb } from './helpers.ts';

process.env.WEB_DIR = '/nonexistent';
const testDb = await startTestDb();
delete process.env.AI_API_KEY;

const { openDb, closeDb } = await import('../db.ts');
const { initAuth } = await import('../auth.ts');
const { buildApp } = await import('../app.ts');
const { blockProgress } = await import('../services/programs.ts');
await openDb(testDb.url);
await initAuth();
const app = await buildApp();
after(async () => {
  await app.close();
  await closeDb();
  await testDb.stop();
});

const call = async (method: string, url: string, payload?: unknown) => (await app.inject({ method: method as any, url, payload: payload as any })).json();

test('a block counts workouts, not weeks: 3 days × 6 rounds, the last round is the deload', () => {
  assert.deepEqual(blockProgress(0, 3, 6, 6), { totalWorkouts: 18, workoutNumber: 1, round: 1, deloadFrom: 16, isComplete: false, nextIsDeload: false });
  assert.equal(blockProgress(14, 3, 6, 6).nextIsDeload, false, 'workout 15 is a normal workout');
  assert.equal(blockProgress(15, 3, 6, 6).nextIsDeload, true, 'workout 16 starts the deload');
  assert.equal(blockProgress(17, 3, 6, 6).nextIsDeload, true);
  const done = blockProgress(18, 3, 6, 6);
  assert.equal(done.isComplete, true);
  assert.equal(done.nextIsDeload, false);
  assert.equal(done.workoutNumber, 18);
  assert.equal(blockProgress(5, 2, 4, null).deloadFrom, null, 'beginners have no deload');
});

test('the deload round reduces sets and weight without changing targets; the block completes after the last workout', async () => {
  await call('PUT', '/api/profile', {
    age: 40, heightCm: 175, weightKg: 75, level: 'intermediate', goal: 'strength', trainingDays: 1, sessionMinutes: 45,
    equipment: ['barbell', 'bench', 'dumbbell'], limitations: '',
  });
  const { program } = await call('POST', '/api/programs/generate', {});
  assert.equal(program.deloadRound, 6);
  assert.equal(program.totalWorkouts, 6, 'one training day × 6 rounds');
  assert.equal(program.deloadFrom, 6);

  const runWorkout = async () => {
    const today = await call('GET', '/api/today');
    const { workout } = await call('POST', '/api/workouts', { programDayId: today.nextDay.id });
    for (const ex of workout.exercises) {
      for (let i = 0; i < ex.sets; i++) {
        await call('PUT', `/api/workouts/${workout.id}/sets`, { programExerciseId: ex.programExerciseId, setIndex: i, weight: ex.targetWeight, reps: ex.repMax, rir: 2 });
      }
    }
    await call('POST', `/api/workouts/${workout.id}/finish`);
    return workout;
  };

  for (let i = 0; i < 5; i++) await runWorkout();
  const before = await call('GET', '/api/programs/active');
  const normal = before.program.days[0].exercises[0];

  const today = await call('GET', '/api/today');
  assert.equal(today.isDeload, true);
  const deload = await runWorkout();
  assert.equal(deload.isDeload, true);
  assert.ok(deload.exercises[0].sets < normal.sets);
  assert.ok(deload.exercises[0].targetWeight < normal.target.weight);
  assert.equal(deload.exercises[0].decision, 'deload');

  const afterDeload = await call('GET', '/api/programs/active');
  assert.equal(afterDeload.program.days[0].exercises[0].target.weight, normal.target.weight, 'deload does not change the target');
  assert.equal(afterDeload.program.isComplete, true);
  assert.equal((await call('GET', '/api/today')).program.isComplete, true);
});
