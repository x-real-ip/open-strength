// Exercises the AI path against a local fake of the Anthropic Messages API.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestDb } from './helpers.ts';
import http from 'node:http';

const requests: any[] = [];
let mode: 'program' | 'bad' | 'coach' = 'program';

const aiProgram = {
  name: 'Upper/lower hypertrophy',
  weeks: 6,
  deloadWeek: 6,
  rationale: 'Two upper and two lower days.',
  days: [
    { name: 'Upper A', focus: 'chest, back', exercises: [
      { exerciseId: 'barbell_bench_press', sets: 3, repMin: 6, repMax: 10, restSeconds: 150, startWeight: 400, notes: 'Pause on the chest' },
      { exerciseId: 'made_up_exercise', sets: 3, repMin: 8, repMax: 12, restSeconds: 90, startWeight: 20 },
      { exerciseId: 'kettlebell_row', sets: 3, repMin: 8, repMax: 9, restSeconds: 90, startWeight: 20 },
    ] },
    { name: 'Lower A', focus: 'legs', exercises: [{ exerciseId: 'back_squat', sets: 3, repMin: 6, repMax: 10, restSeconds: 180, startWeight: 60 }] },
    { name: 'Upper B', focus: 'shoulders', exercises: [{ exerciseId: 'overhead_press', sets: 3, repMin: 6, repMax: 10, restSeconds: 150, startWeight: 30 }] },
    { name: 'Lower B', focus: 'hinge', exercises: [{ exerciseId: 'romanian_deadlift', sets: 3, repMin: 8, repMax: 12, restSeconds: 150, startWeight: 50 }] },
  ],
};

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    requests.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
    const text =
      mode === 'program' ? 'Here you go:\n```json\n' + JSON.stringify(aiProgram) + '\n```' : mode === 'bad' ? 'not json at all' : 'Your bench press is progressing well.';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ content: [{ type: 'text', text }] }));
  });
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const port = (server.address() as any).port;

process.env.WEB_DIR = '/nonexistent';
const testDb = await startTestDb();
process.env.AI_PROVIDER = 'anthropic';
process.env.AI_API_KEY = 'test-key';
process.env.AI_BASE_URL = `http://127.0.0.1:${port}`;
process.env.AI_MODEL = 'test-model';

const { openDb, closeDb } = await import('../db.ts');
const { initAuth } = await import('../auth.ts');
const { buildApp } = await import('../app.ts');
await openDb(testDb.url);
await initAuth();
const app = await buildApp();

after(async () => {
  await app.close();
  server.close();
  await closeDb();
  await testDb.stop();
});

test('AI program is validated, repaired and weights are clamped', async () => {
  await app.inject({
    method: 'PUT',
    url: '/api/profile',
    payload: { age: 30, heightCm: 180, weightKg: 80, level: 'intermediate', goal: 'hypertrophy', daysPerWeek: 4, sessionMinutes: 60, equipment: ['barbell', 'dumbbell', 'bench'], limitations: '' },
  });
  const res = await app.inject({ method: 'POST', url: '/api/programs/generate', payload: {} });
  assert.equal(res.statusCode, 200);
  const { program, notice } = res.json();
  assert.equal(notice, null);
  assert.equal(program.source, 'ai');
  assert.equal(program.days.length, 4);

  const upper = program.days[0].exercises;
  // Unknown id dropped; kettlebell row (no kettlebell available) swapped for an available row.
  assert.equal(upper.length, 2);
  assert.equal(upper[0].exerciseId, 'barbell_bench_press');
  assert.ok(['barbell_row', 'dumbbell_row'].includes(upper[1].exerciseId));
  assert.equal(upper[0].target.weight, 110); // 400 kg clamped to 2x the heuristic (55 kg)
  assert.equal(upper[1].repMax - upper[1].repMin >= 2, true);

  const sent = requests[0];
  assert.equal(sent.url, '/v1/messages');
  assert.equal(sent.headers['x-api-key'], 'test-key');
  assert.equal(sent.body.model, 'test-model');
  assert.match(sent.body.messages[0].content, /ALLOWED EXERCISES/);
  assert.doesNotMatch(sent.body.messages[0].content, /kettlebell_row \|/);
});

test('unusable AI output falls back to the template program after one retry', async () => {
  mode = 'bad';
  const before = requests.length;
  const res = await app.inject({ method: 'POST', url: '/api/programs/generate', payload: {} });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().program.source, 'template');
  assert.match(res.json().notice, /niet bruikbaar/);
  assert.equal(requests.length - before, 2);
});

test('coach replies through the AI with training context', async () => {
  mode = 'coach';
  const res = await app.inject({ method: 'POST', url: '/api/coach/messages', payload: { content: 'Hoe gaat het?' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().messages[1].content, 'Your bench press is progressing well.');
  const sent = requests[requests.length - 1];
  assert.match(sent.body.system, /TRAINING SUMMARY/);
  assert.equal(sent.body.messages[0].role, 'user');
});
