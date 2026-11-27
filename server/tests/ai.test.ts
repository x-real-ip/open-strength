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
    const sent = JSON.parse(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        id: `msg_${requests.length}`,
        type: 'message',
        role: 'assistant',
        model: sent.model,
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1000, output_tokens: 500 },
      }),
    );
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
  assert.equal(sent.headers.authorization, 'Bearer test-key');
  assert.equal(sent.body.model, 'test-model');
  assert.deepEqual(sent.body.output_config, { effort: 'medium' }, 'programs think at medium effort by default');
  assert.equal(sent.body.max_tokens, 16000, 'room for thinking plus the program JSON');
  assert.match(sent.body.messages[0].content, /ALLOWED EXERCISES/);
  assert.doesNotMatch(sent.body.messages[0].content, /kettlebell_row \|/);
});

test('favourites are marked in the prompt; excluded exercises are left out and swapped', async () => {
  const mark = (exerciseId: string, preference: string | null) =>
    app.inject({ method: 'PUT', url: '/api/exercise-preferences', payload: { exerciseId, preference } });
  // Excluding an exercise of the active program swaps it out right away.
  const excluded = await mark('barbell_bench_press', 'excluded');
  assert.equal(excluded.statusCode, 200);
  assert.deepEqual(excluded.json().preferences.excluded, ['barbell_bench_press']);
  assert.ok(excluded.json().replaced.length > 0, 'replaced in the active program');
  const active = (await app.inject({ method: 'GET', url: '/api/programs/active' })).json().program;
  assert.ok(!active.days.some((d: any) => d.exercises.some((e: any) => e.exerciseId === 'barbell_bench_press')));
  assert.equal((await mark('Box_Squat', 'favorite')).statusCode, 200);

  const before = requests.length;
  const res = await app.inject({ method: 'POST', url: '/api/programs/generate', payload: {} });
  assert.equal(res.statusCode, 200);
  const prompt = requests[before].body.messages[0].content as string;
  assert.match(prompt, /^♥ Box_Squat \|/m);
  assert.doesNotMatch(prompt, /^(\* )?barbell_bench_press \|/m);
  assert.match(prompt, /never wants these exercises.*Barbell bench press/);
  // The fake model still answers with barbell_bench_press: the app swaps it for an allowed press.
  const first = res.json().program.days[0].exercises[0];
  assert.notEqual(first.exerciseId, 'barbell_bench_press');

  // Swapping to an excluded exercise is refused; library-only exercises can't be marked.
  const pe = res.json().program.days[0].exercises[0];
  assert.equal((await app.inject({ method: 'POST', url: `/api/program-exercises/${pe.id}/replace`, payload: { exerciseId: 'barbell_bench_press' } })).statusCode, 400);
  assert.equal((await mark('90_90_Hamstring', 'favorite')).statusCode, 400);

  await mark('barbell_bench_press', null);
  await mark('Box_Squat', null);
  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/exercise-preferences' })).json(), { favorites: [], excluded: [] });
});

test('unusable AI output falls back to the template program after one retry', async () => {
  mode = 'bad';
  const before = requests.length;
  const res = await app.inject({ method: 'POST', url: '/api/programs/generate', payload: {} });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().program.source, 'template');
  assert.match(res.json().notice, /not usable/);
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
  assert.deepEqual(sent.body.output_config, { effort: 'low' }, 'the coach answers at low effort by default');
  assert.equal(sent.body.max_tokens, 4000);
});

test('every AI call is recorded; unknown models have no price', async () => {
  const usage = (await app.inject({ method: 'GET', url: '/api/usage' })).json();
  assert.equal(usage.month.calls, requests.length);
  assert.equal(usage.month.inputTokens, 1000 * requests.length);
  // Answers that are not usable JSON still count as successful calls: they were billed.
  assert.equal(usage.month.failed, 0);
  assert.equal(usage.month.costUsd, 0, 'test-model has no known price');
  assert.equal(usage.hasUnpricedCalls, true);
});

test('settings page: the key is stored but never returned; model, effort and budget apply', async () => {
  const view = (await app.inject({ method: 'GET', url: '/api/settings/ai' })).json();
  assert.equal(view.keySource, 'env');
  assert.equal(view.keyHint, '…-key');
  assert.equal(view.coachEffort, 'low');

  const saved = await app.inject({
    method: 'PUT',
    url: '/api/settings/ai',
    payload: { model: 'claude-haiku-5-5', apiKey: 'sk-ant-new-1234', coachEffort: 'high' },
  });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.json().keySource, 'app');
  assert.equal(saved.json().keyHint, '…1234');
  assert.doesNotMatch(saved.body, /sk-ant-new/, 'the key never goes back to the browser');
  assert.equal((await app.inject({ method: 'PUT', url: '/api/settings/ai', payload: { secret: 1 } })).statusCode, 400);

  mode = 'coach';
  const res = await app.inject({ method: 'POST', url: '/api/coach/messages', payload: { content: 'En nu?' } });
  assert.equal(res.statusCode, 200);
  const sent = requests[requests.length - 1];
  assert.equal(sent.headers.authorization, 'Bearer sk-ant-new-1234');
  assert.equal(sent.body.model, 'claude-haiku-5-5');
  assert.deepEqual(sent.body.output_config, { effort: 'high' });
  assert.equal(sent.body.fallbacks, undefined, 'Haiku has no server-side fallback');

  const usage = (await app.inject({ method: 'GET', url: '/api/usage' })).json();
  const last = usage.recent[0];
  assert.equal(last.model, 'claude-haiku-5-5');
  assert.equal(last.costUsd, 0.00035, '1000 × $0.10 + 500 × $0.50 per million tokens');
  assert.equal(usage.daily.length, 30);
  assert.ok(usage.byFeature.some((f: any) => f.feature === 'coach'));

  // Sonnet 5.5 gets the server-side refusal fallback.
  await app.inject({ method: 'PUT', url: '/api/settings/ai', payload: { model: 'claude-sonnet-5-5' } });
  const test = await app.inject({ method: 'POST', url: '/api/settings/ai/test' });
  assert.equal(test.statusCode, 200);
  const fb = requests[requests.length - 1];
  assert.equal(fb.url.split('?')[0], '/v1/messages');
  assert.equal(fb.body.fallbacks, 'default');
  assert.match(String(fb.headers['anthropic-beta']), /server-side-fallback-2026-07-01/);

  // A budget below what was spent blocks further calls without contacting the provider.
  await app.inject({ method: 'PUT', url: '/api/settings/ai', payload: { monthlyBudgetUsd: 0.0001 } });
  const before = requests.length;
  const blocked = await app.inject({ method: 'POST', url: '/api/coach/messages', payload: { content: 'Nog een vraag' } });
  assert.equal(blocked.statusCode, 503);
  assert.match(blocked.json().error, /monthly AI budget/);
  assert.equal(requests.length, before);

  // Removing the app key falls back to the server key.
  const reset = await app.inject({ method: 'PUT', url: '/api/settings/ai', payload: { apiKey: null, monthlyBudgetUsd: null } });
  assert.equal(reset.json().keySource, 'env');
});
