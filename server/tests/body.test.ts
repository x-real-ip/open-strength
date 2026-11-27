import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestDb } from './helpers.ts';

process.env.WEB_DIR = '/nonexistent';
const testDb = await startTestDb();
delete process.env.AI_API_KEY;

const { openDb, closeDb } = await import('../db.ts');
const { initAuth } = await import('../auth.ts');
const { buildApp } = await import('../app.ts');
const { setPushSender, restPending } = await import('../services/push.ts');
await openDb(testDb.url);
await initAuth();
const app = await buildApp();
after(async () => {
  await app.close();
  await closeDb();
  await testDb.stop();
});

const call = async (method: string, url: string, payload?: unknown) => {
  const res = await app.inject({ method: method as any, url, payload: payload as any });
  return { status: res.statusCode, body: res.json() };
};
const profile = {
  age: 35, heightCm: 182, weightKg: 82, level: 'intermediate', goal: 'hypertrophy', trainingDays: 3, sessionMinutes: 45,
  equipment: ['barbell', 'dumbbell', 'bench'], limitations: '',
};

test('body weight: one entry per day, the profile follows the latest', async () => {
  assert.equal((await call('PUT', '/api/profile', profile)).status, 200);
  // Creating the profile counts as today's weigh-in.
  assert.equal((await call('GET', '/api/body-weights')).body.entries.length, 1);

  await call('POST', '/api/body-weights', { weightKg: 83.4, date: '2026-10-01' });
  let entries = (await call('POST', '/api/body-weights', { weightKg: 81.26, date: '2026-11-01' })).body.entries;
  assert.deepEqual(entries.slice(0, 2).map((e: any) => [e.date, e.weightKg]), [['2026-10-01', 83.4], ['2026-11-01', 81.3]], 'sorted by date, rounded to 0.1 kg');

  // Logging the same day again replaces it; the latest date decides the profile weight.
  const latest = entries[entries.length - 1];
  entries = (await call('POST', '/api/body-weights', { weightKg: 80.5, date: latest.date })).body.entries;
  assert.equal(entries.length, 3);
  assert.equal((await call('GET', '/api/profile')).body.profile.weightKg, 80.5);

  // Deleting the latest falls back to the one before it.
  entries = (await call('DELETE', `/api/body-weights/${entries[entries.length - 1].id}`)).body.entries;
  assert.equal(entries.length, 2);
  assert.equal((await call('GET', '/api/profile')).body.profile.weightKg, 81.3);

  // Editing the weight in the profile logs it as today's weigh-in.
  const current = (await call('GET', '/api/profile')).body.profile;
  await call('PUT', '/api/profile', { ...current, weightKg: 79 });
  entries = (await call('GET', '/api/body-weights')).body.entries;
  assert.equal(entries[entries.length - 1].weightKg, 79);

  assert.equal((await call('POST', '/api/body-weights', { weightKg: 10 })).status, 400, 'implausible weights are refused');
  assert.equal((await call('GET', '/api/export/json')).body.tables.body_weights.length, 3, 'part of the export');
});

test('rest notifications: pushed at the end of the rest, cancelled when you come back', async () => {
  const sent: { endpoint: string; payload: any }[] = [];
  setPushSender(async (sub, payload) => {
    if (sub.endpoint.endsWith('/gone')) throw Object.assign(new Error('Gone'), { statusCode: 410 });
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
    return 201;
  });

  const key = (await call('GET', '/api/push/key')).body.publicKey;
  assert.match(key, /^[A-Za-z0-9_-]{80,}$/, 'a VAPID public key');
  assert.equal((await call('GET', '/api/push/key')).body.publicKey, key, 'the same key every time');

  const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
  assert.equal((await call('POST', '/api/push/subscriptions', { endpoint: 'https://push.example/phone', keys })).status, 200);
  assert.equal((await call('POST', '/api/push/subscriptions', { endpoint: 'https://push.example/gone', keys })).status, 200);

  // Cancelled before the end: nothing is sent.
  await call('POST', '/api/push/rest', { endsAt: Date.now() + 150, next: 'Squat (barbell)' });
  assert.equal(restPending(), true);
  await call('DELETE', '/api/push/rest');
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(sent.length, 0);

  // Left alone: one push at the end, in the profile's language, and the dead subscription is dropped.
  await call('POST', '/api/push/rest', { endsAt: Date.now() + 100, next: 'Squat (barbell)' });
  await new Promise((r) => setTimeout(r, 300));
  assert.deepEqual(sent, [{ endpoint: 'https://push.example/phone', payload: { title: 'Rest is over', body: 'Next: Squat (barbell)', tag: 'rest' } }]);
  assert.equal((await call('POST', '/api/push/test')).body.sent, 1, 'only the live subscription is left');

  assert.equal((await call('POST', '/api/push/rest', { endsAt: Date.now() + 60 * 60 * 1000 })).body.scheduled, false, 'not a rest timer');
});
