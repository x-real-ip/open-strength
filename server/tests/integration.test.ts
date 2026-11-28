// The link with Open Nutrilog: token-only integration API, weigh-ins in both directions (with an outbox while
// Open Nutrilog is down), quiet degradation, and nutrition as context only: weights never change because of it.
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startTestDb } from './helpers.ts';

process.env.WEB_DIR = '/nonexistent';
delete process.env.AI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
const testDb = await startTestDb();

// A fake Open Nutrilog that records what it receives.
const received: { method: string; url: string; auth: string; body: string }[] = [];
let nutrilogDown = false;
let phase: Record<string, unknown> = {
  phase: 'cut',
  ratePctPerWeek: 0.75,
  estimatedTdee: 2600,
  proteinGPerKg: 2,
  avgProteinGPerKg14d: 1.3,
  avgEnergyBalance14d: -650,
  loggedDays14d: 12,
};
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (nutrilogDown) {
      res.writeHead(503).end();
      return;
    }
    received.push({ method: req.method!, url: req.url!, auth: String(req.headers.authorization), body });
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/integration/v1/phase') res.end(JSON.stringify(phase));
    else res.end(JSON.stringify({ ok: true }));
  });
});
await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
const fakeUrl = `http://127.0.0.1:${(fake.address() as any).port}`;

const { config } = await import('../config.ts');
const { openDb, closeDb, run } = await import('../db.ts');
const { initAuth } = await import('../auth.ts');
const { buildApp } = await import('../app.ts');
const { clearNutrilogCache, flushOutbox, goalClash, stallNote } = await import('../services/nutrilog.ts');

await openDb(testDb.url);
await initAuth();
const app = await buildApp();

after(async () => {
  await app.close();
  fake.close();
  await closeDb();
  await testDb.stop();
});

const TOKEN = 'nutrilog-to-strength-token';
const call = async (method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) => {
  const res = await app.inject({ method: method as any, url, payload: payload as any, headers });
  return { status: res.statusCode, body: res.headers['content-type']?.toString().includes('json') ? res.json() : res.body };
};
const bearer = { authorization: `Bearer ${TOKEN}` };

const profile = {
  name: 'Test',
  age: 40,
  heightCm: 180,
  weightKg: 80,
  level: 'intermediate',
  goal: 'hypertrophy',
  trainingDays: 2,
  sessionMinutes: 45,
  equipment: ['barbell', 'dumbbell', 'bench', 'cable', 'machine', 'pullup_bar'],
  limitations: '',
  increments: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, kettlebell: 4 },
};

function link(on: boolean) {
  config.integration.token = on ? TOKEN : '';
  config.integration.nutrilogUrl = on ? fakeUrl : '';
  config.integration.nutrilogToken = on ? 'strength-to-nutrilog-token' : '';
  clearNutrilogCache();
}

beforeEach(async () => {
  config.auth.mode = 'none';
  link(false);
  nutrilogDown = false;
  received.length = 0;
  await call('POST', '/api/import/json', { app: 'open-strength', tables: {} });
  await run('DELETE FROM integration_outbox');
});

/** Profile, a rule-based program and one finished workout; returns the advice per exercise. */
async function trainOnce() {
  await call('PUT', '/api/profile', profile);
  await call('POST', '/api/programs/generate', {});
  const today = (await call('GET', '/api/today')).body;
  const workout = (await call('POST', '/api/workouts', { programDayId: today.nextDay.id })).body.workout;
  for (const ex of workout.exercises) {
    for (let i = 0; i < ex.sets; i++) {
      await call('PUT', `/api/workouts/${workout.id}/sets`, { programExerciseId: ex.programExerciseId, setIndex: i, weight: ex.targetWeight, reps: ex.repMax - i, rir: 1 });
    }
  }
  const fin = (await call('POST', `/api/workouts/${workout.id}/finish`)).body;
  return { workout, outcomes: fin.summary.outcomes.map((o: any) => [o.exerciseId, o.decision, o.nextWeight, JSON.stringify(o.nextReps ?? o.repTargets ?? null)]) };
}

test('integration API: 404 without a token, 401 with a wrong one or only a session, 200 with the right one', async () => {
  assert.equal((await call('GET', '/api/integration/v1/profile', undefined, bearer)).status, 404, 'no token configured: the routes do not exist');
  link(true);
  assert.equal((await call('GET', '/api/integration/v1/profile')).status, 401, 'no bearer');
  assert.equal((await call('GET', '/api/integration/v1/profile', undefined, { authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await call('GET', '/api/integration/v1/profile', undefined, { authorization: TOKEN })).status, 401, 'not a bearer');
  assert.equal((await call('GET', '/api/integration/v1/profile', undefined, bearer)).status, 200);

  // A signed-in session (or a proxy header) is not enough.
  config.auth.mode = 'password';
  config.auth.password = 'pw';
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password: 'pw' } });
  const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  assert.equal((await call('GET', '/api/today', undefined, { cookie })).status, 200);
  assert.equal((await call('GET', '/api/integration/v1/profile', undefined, { cookie })).status, 401);
  config.auth.mode = 'proxy';
  assert.equal((await call('GET', '/api/integration/v1/profile', undefined, { 'x-authentik-username': 'coen' })).status, 401);
  assert.equal((await call('GET', '/api/integration/v1/profile', undefined, bearer)).status, 200, 'the token works in every auth mode');
});

test('integration API: profile, workouts by day, body weights in', async () => {
  link(true);
  const { workout } = await trainOnce();
  const p = (await call('GET', '/api/integration/v1/profile', undefined, bearer)).body;
  assert.deepEqual(p, { goal: 'hypertrophy', level: 'intermediate', age: 40, heightCm: 180, weightKg: 80, language: 'en' });

  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
  const ws = (await call('GET', `/api/integration/v1/workouts?from=${day}&to=${day}`, undefined, bearer)).body;
  assert.equal(ws.length, 1);
  assert.equal(ws[0].id, workout.id);
  assert.equal(ws[0].date, day);
  assert.equal(ws[0].status, 'completed');
  assert.ok(ws[0].totalSets > 0 && ws[0].volumeKg > 0);
  assert.equal(typeof ws[0].durationMinutes, 'number');
  assert.equal((await call('GET', '/api/integration/v1/workouts?from=x&to=y', undefined, bearer)).status, 400);

  // Weigh-ins from Open Nutrilog are stored, become the profile weight, and are not sent back.
  received.length = 0;
  assert.equal((await call('PUT', `/api/integration/v1/body-weights/${day}`, { weightKg: 78.44 }, bearer)).status, 200);
  assert.equal((await call('GET', '/api/profile')).body.profile.weightKg, 78.4);
  const list = (await call('GET', `/api/integration/v1/body-weights?from=${day}&to=${day}`, undefined, bearer)).body;
  assert.deepEqual(list, [{ date: day, weightKg: 78.4 }]);
  await call('DELETE', `/api/integration/v1/body-weights/${day}`, undefined, bearer);
  assert.deepEqual((await call('GET', '/api/body-weights')).body.entries, []);
  assert.ok(!received.some((r) => r.url.includes('body-weights')), 'nothing is echoed back');
});

test('weigh-ins logged here go to Open Nutrilog; while it is down they wait in the outbox', async () => {
  link(true);
  await call('POST', '/api/body-weights', { weightKg: 81.2, date: '2026-11-20' });
  const put = received.find((r) => r.method === 'PUT');
  assert.equal(put?.url, '/api/integration/v1/body-weights/2026-11-20');
  assert.equal(put?.auth, 'Bearer strength-to-nutrilog-token');
  assert.deepEqual(JSON.parse(put!.body), { weightKg: 81.2 });

  nutrilogDown = true;
  const logged = await call('POST', '/api/body-weights', { weightKg: 81, date: '2026-11-21' });
  assert.equal(logged.status, 200, 'logging works while Open Nutrilog is down');
  const id = logged.body.entries.find((e: any) => e.date === '2026-11-20').id;
  await call('DELETE', `/api/body-weights/${id}`);
  assert.equal((await call('GET', '/api/linked/nutrition')).body.status, 'unreachable');

  nutrilogDown = false;
  received.length = 0;
  assert.equal(await flushOutbox(), 2);
  assert.deepEqual(
    received.map((r) => `${r.method} ${r.url}`),
    ['PUT /api/integration/v1/body-weights/2026-11-21', 'DELETE /api/integration/v1/body-weights/2026-11-20'],
    'in the order they happened',
  );
  assert.equal(await flushOutbox(), 0);
});

test('not linked or not reachable: the app carries on, quietly', async () => {
  let n = (await call('GET', '/api/linked/nutrition')).body;
  assert.equal(n.status, 'off');
  assert.equal(n.phase, null);
  assert.equal((await call('POST', '/api/body-weights', { weightKg: 80 })).status, 200);
  assert.equal(received.length, 0);

  link(true);
  config.integration.nutrilogUrl = 'http://127.0.0.1:9'; // nothing listens there
  const started = Date.now();
  n = (await call('GET', '/api/linked/nutrition')).body;
  assert.equal(n.status, 'unreachable');
  assert.ok(Date.now() - started < 3000, 'the timeout is short');
  await call('PUT', '/api/profile', profile);
  const coach = await call('POST', '/api/coach/messages', { content: 'How am I doing?' });
  assert.equal(coach.status, 200, 'the coach works without the nutrition facts');
  assert.doesNotMatch(coach.body.messages[1].content, /Nutrition phase/);
});

test('nutrition shows up as context: phase, deficit, protein, stall notes and a goal clash', async () => {
  link(true);
  await call('PUT', '/api/profile', profile);
  const n = (await call('GET', '/api/linked/nutrition')).body;
  assert.equal(n.status, 'ok');
  assert.equal(n.phase.phase, 'cut');
  assert.match(n.facts, /650 kcal below maintenance \(25 %\)/);
  assert.match(n.facts, /1\.3 g per kg/);
  assert.match(n.clash, /large deficit/);

  // The coach without AI shows the facts, nutrition included.
  const coach = (await call('POST', '/api/coach/messages', { content: 'How am I doing?' })).body.messages[1].content;
  assert.match(coach, /Nutrition phase \(from Open Nutrilog\): losing fat, 0\.8 % of body weight per week/);

  // In Dutch too.
  await call('PUT', '/api/profile', { ...profile, language: 'nl' });
  clearNutrilogCache();
  assert.match((await call('GET', '/api/linked/nutrition')).body.facts, /650 kcal onder onderhoud \(25 %\).*\n.*1,3 g per kg/s);
});

test('stall notes: only with a deficit over 20 % or protein under 1.6 g/kg', () => {
  const base = { phase: 'cut' as const, ratePctPerWeek: 0.5, estimatedTdee: 2600, proteinGPerKg: 2, loggedDays14d: 12 };
  const both = stallNote('Bench press', 3, { ...base, avgEnergyBalance14d: -650, avgProteinGPerKg14d: 1.3 })!;
  assert.equal(both.en, "Bench press has stalled for 3 sessions; you've averaged 25 % below maintenance and 1.3 g/kg protein over the last two weeks.");
  assert.equal(both.nl, 'Bench press staat al 3 trainingen stil; je at de afgelopen twee weken gemiddeld 25 % onder onderhoud en 1,3 g/kg eiwit.');
  assert.equal(stallNote('Squat', 3, { ...base, avgEnergyBalance14d: -300, avgProteinGPerKg14d: 2 }), null, '12 % deficit, enough protein');
  assert.match(stallNote('Squat', 3, { ...base, avgEnergyBalance14d: -300, avgProteinGPerKg14d: 1.5 })!.en, /1\.5 g\/kg protein/);
  assert.equal(stallNote('Squat', 3, { ...base, avgEnergyBalance14d: -650, avgProteinGPerKg14d: 2, loggedDays14d: 0 }), null, 'nothing logged: nothing to say');
  assert.equal(stallNote('Squat', 3, null), null);

  assert.equal(goalClash('fat_loss', { ...base, phase: 'bulk', avgEnergyBalance14d: 300, avgProteinGPerKg14d: 2 })!.en.includes('above maintenance'), true);
  assert.equal(goalClash('hypertrophy', { ...base, phase: 'maintain', avgEnergyBalance14d: 0, avgProteinGPerKg14d: 2 }), null);
});

test('the progression engine ignores nutrition: the same workout gives the same advice with and without it', async () => {
  const without = await trainOnce();
  await call('POST', '/api/import/json', { app: 'open-strength', tables: {} });
  link(true);
  phase = { ...phase, avgEnergyBalance14d: -1500, avgProteinGPerKg14d: 0.8 };
  // A huge deficit and very little protein, and the app knows it...
  await call('PUT', '/api/profile', profile);
  assert.match((await call('GET', '/api/linked/nutrition')).body.facts, /1500 kcal below/);
  const withNutrition = await trainOnce();
  // ...yet the advice for the next session is exactly the same.
  assert.ok(withNutrition.outcomes.length > 0);
  assert.deepEqual(withNutrition.outcomes, without.outcomes);
  // And the engine's module doesn't even know the link exists.
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../services/progression.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /nutrilog|nutrition/i);
});
