import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startTestDb } from './helpers.ts';

process.env.WEB_DIR = '/nonexistent';
const testDb = await startTestDb();

const { config } = await import('../config.ts');
const { openDb, closeDb } = await import('../db.ts');
const { initAuth } = await import('../auth.ts');
const { buildApp } = await import('../app.ts');

await openDb(testDb.url);
await initAuth();
const app = await buildApp();

// Local OpenID Provider for the OIDC redirect test.
const { default: Provider } = await import('oidc-provider');
const idpServer = http.createServer();
await new Promise<void>((r) => idpServer.listen(0, '127.0.0.1', r));
const issuer = `http://127.0.0.1:${(idpServer.address() as any).port}`;
const provider = new Provider(issuer, {
  clients: [{ client_id: 'overload', client_secret: 'secret', redirect_uris: ['https://fitness.example.com/api/auth/oidc/callback'] }],
  pkce: { required: () => true },
});
idpServer.on('request', provider.callback());

after(async () => {
  await app.close();
  idpServer.close();
  await closeDb();
  await testDb.stop();
});

const get = (url: string, headers: Record<string, string> = {}) => app.inject({ method: 'GET', url, headers });

test('none: everything is open', async () => {
  config.auth.mode = 'none';
  assert.equal((await get('/api/today')).statusCode, 200);
  assert.equal((await get('/api/info')).json().user.username, 'local');
});

test('password: login sets a session cookie; wrong password and changed password are rejected', async () => {
  config.auth.mode = 'password';
  config.auth.password = 'hunter2';
  assert.equal((await get('/api/today')).statusCode, 401);
  const bad = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password: 'nope' } });
  assert.equal(bad.statusCode, 401);
  const ok = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password: 'hunter2' } });
  assert.equal(ok.statusCode, 200);
  const cookie = ok.cookies.find((c) => c.name === 'overload_session')!;
  const headers = { cookie: `overload_session=${cookie.value}` };
  assert.equal((await get('/api/today', headers)).statusCode, 200);
  config.auth.password = 'changed';
  assert.equal((await get('/api/today', headers)).statusCode, 401, 'password change invalidates sessions');
  // A tampered cookie is rejected.
  assert.equal((await get('/api/today', { cookie: `overload_session=${cookie.value.replace(/.$/, 'x')}` })).statusCode, 401);
});

test('proxy: trusts the Authentik headers and applies the allowlist', async () => {
  config.auth.mode = 'proxy';
  assert.equal((await get('/api/today')).statusCode, 401);
  const res = await get('/api/info', { 'x-authentik-username': 'coen', 'x-authentik-email': 'coen@example.com', 'x-authentik-groups': 'admins|fitness' });
  assert.equal(res.json().user.username, 'coen');

  config.auth.allowedGroups = ['fitness'];
  assert.equal((await get('/api/today', { 'x-authentik-username': 'coen', 'x-authentik-groups': 'admins|fitness' })).statusCode, 200);
  assert.equal((await get('/api/today', { 'x-authentik-username': 'guest', 'x-authentik-groups': 'family' })).statusCode, 401);
  config.auth.allowedGroups = [];
  config.auth.allowedUsers = ['coen@example.com'];
  assert.equal((await get('/api/today', { 'x-authentik-username': 'coen', 'x-authentik-email': 'coen@example.com' })).statusCode, 200);
  assert.equal((await get('/api/today', { 'x-authentik-username': 'other' })).statusCode, 401);
  config.auth.allowedUsers = [];
});

test('oidc: login redirects to the provider with PKCE, state and nonce; callback without state is refused', async () => {
  config.auth.mode = 'oidc';
  config.auth.oidcIssuer = issuer;
  config.auth.oidcClientId = 'overload';
  config.auth.oidcClientSecret = 'secret';
  config.auth.oidcAllowInsecure = true;
  config.publicUrl = 'https://fitness.example.com';

  assert.equal((await get('/api/today')).statusCode, 401);
  const res = await get('/api/auth/oidc/login');
  assert.equal(res.statusCode, 302);
  const location = new URL(res.headers.location as string);
  assert.equal(location.origin, issuer);
  assert.equal(location.searchParams.get('client_id'), 'overload');
  assert.equal(location.searchParams.get('redirect_uri'), 'https://fitness.example.com/api/auth/oidc/callback');
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(location.searchParams.get('state'));
  assert.ok(location.searchParams.get('nonce'));
  assert.ok(res.cookies.find((c) => c.name === 'overload_oidc'));

  const cb = await get('/api/auth/oidc/callback?code=abc&state=xyz');
  assert.equal(cb.statusCode, 302);
  assert.match(String(cb.headers.location), /login_error=expired/);
});
