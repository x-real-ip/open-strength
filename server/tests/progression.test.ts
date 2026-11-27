import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateProgression, workingWeight } from '../services/progression.ts';
import { clampStartWeight, heuristicStartWeight, roundToStep, floorToStep, e1rm } from '../services/weights.ts';
import { getExercise } from '../services/exercises.ts';

const bench = { repMin: 8, repMax: 12, sets: 3, increment: 2.5, prescribedWeight: 40 };
const s = (weight: number, reps: number, rir: number | null = null) => ({ weight, reps, rir });

test('spec example 12/11/10 at 40 kg holds the weight', () => {
  const r = evaluateProgression({ ...bench, session: [s(40, 12), s(40, 11), s(40, 10)] });
  assert.equal(r.decision, 'hold');
  assert.equal(r.nextWeight, 40);
  assert.deepEqual(r.repTargets, [12, 12, 11]);
  assert.match(r.reason.nl, /Sets 2 en 3/);
  assert.match(r.reason.en, /Sets 2 and 3 did not reach 12 yet \(12\/11\/10\)\. Stay at 40 kg and aim for 12\/12\/11\./);
  // The wording from the spec: stay at 40 kg, aim for 12/12/11.
  assert.match(r.reason.nl, /Blijf op 40 kg en mik op 12\/12\/11/);
});

test('all sets at the top with reserve increases one step', () => {
  const r = evaluateProgression({ ...bench, session: [s(40, 12, 2), s(40, 12, 1), s(40, 12, 1)] });
  assert.equal(r.decision, 'increase');
  assert.equal(r.nextWeight, 42.5);
  assert.deepEqual(r.repTargets, [8, 8, 8]);
  assert.match(r.reason.nl, /van 40 kg naar 42,5 kg/);
  assert.match(r.reason.en, /from 40 kg to 42\.5 kg/);
});

test('top of range but a set to failure holds', () => {
  const r = evaluateProgression({ ...bench, session: [s(40, 12, 1), s(40, 12, 0), s(40, 12, 0)] });
  assert.equal(r.decision, 'hold');
  assert.equal(r.nextWeight, 40);
});

test('well past the top with lots of reserve jumps two steps', () => {
  const r = evaluateProgression({ ...bench, session: [s(40, 15, 3), s(40, 14, 3), s(40, 14, 2)] });
  assert.equal(r.decision, 'increase');
  assert.equal(r.nextWeight, 45);
});

test('first miss below the minimum holds, second consecutive miss decreases', () => {
  const first = evaluateProgression({ ...bench, session: [s(40, 9), s(40, 8), s(40, 7)] });
  assert.equal(first.decision, 'hold');
  assert.equal(first.nextWeight, 40);

  const second = evaluateProgression({
    ...bench,
    session: [s(40, 9), s(40, 7), s(40, 6)],
    previous: [s(40, 9), s(40, 8), s(40, 7)],
  });
  assert.equal(second.decision, 'decrease');
  assert.equal(second.nextWeight, 35);
});

test('clearly too heavy decreases immediately', () => {
  const r = evaluateProgression({ ...bench, session: [s(40, 6), s(40, 5), s(40, 4)] });
  assert.equal(r.decision, 'decrease');
  assert.ok(r.nextWeight < 40);
});

test('incomplete session holds', () => {
  const r = evaluateProgression({ ...bench, session: [s(40, 12), s(40, 12)] });
  assert.equal(r.decision, 'hold');
  assert.match(r.reason.nl, /2 van de 3 sets/);
  assert.match(r.reason.en, /2 of 3 sets/);
});

test('a lighter back-off set counts as a miss', () => {
  const r = evaluateProgression({ ...bench, session: [s(40, 12), s(40, 12), s(35, 12)] });
  assert.equal(r.decision, 'hold');
  assert.equal(r.nextWeight, 40);
});

test('heavier sets than prescribed use the actual working weight', () => {
  const r = evaluateProgression({ ...bench, session: [s(42.5, 12, 2), s(42.5, 12, 2), s(42.5, 12, 1)] });
  assert.equal(r.decision, 'increase');
  assert.equal(r.nextWeight, 45);
});

test('bodyweight exercises progress by reps', () => {
  const r = evaluateProgression({ repMin: 6, repMax: 10, sets: 3, increment: 0, prescribedWeight: 0, session: [s(0, 10), s(0, 10), s(0, 10)] });
  assert.equal(r.decision, 'reps');
  const r2 = evaluateProgression({ repMin: 6, repMax: 10, sets: 3, increment: 0, prescribedWeight: 0, session: [s(0, 8), s(0, 7), s(0, 6)] });
  assert.equal(r2.decision, 'hold');
  assert.deepEqual(r2.repTargets, [9, 8, 7]);
});

test('machine increments of 5 kg are respected', () => {
  const r = evaluateProgression({ repMin: 10, repMax: 15, sets: 3, increment: 5, prescribedWeight: 50, session: [s(50, 15, 2), s(50, 15, 2), s(50, 15, 1)] });
  assert.equal(r.nextWeight, 55);
});

test('helpers', () => {
  assert.equal(workingWeight([s(40, 1), s(40, 1), s(42.5, 1)], 0), 40);
  assert.equal(workingWeight([s(40, 1), s(42.5, 1)], 0), 42.5);
  assert.equal(roundToStep(41.3, 2.5), 42.5);
  assert.equal(floorToStep(41.3, 2.5), 40);
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 10), 133.33);
});

test('start weights are rounded to steps and AI suggestions are clamped', () => {
  const profile = { weightKg: 80, level: 'beginner' as const, increments: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, kettlebell: 4 } };
  const benchDef = getExercise('barbell_bench_press')!;
  assert.equal(heuristicStartWeight(benchDef, profile), 40);
  assert.equal(clampStartWeight(500, benchDef, profile), 80);
  assert.equal(clampStartWeight(41, benchDef, profile), 40);
  assert.equal(clampStartWeight(undefined, benchDef, profile), 40);
  assert.equal(clampStartWeight(60, getExercise('pull_up')!, profile), 0);
});
