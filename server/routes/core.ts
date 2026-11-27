import zlib from 'node:zlib';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppInfo } from '../../shared/types.ts';
import { checkPassword, clearFailures, loginAllowed, logout, oidcCallback, oidcLoginRedirect, passwordLogin, recordFailure } from '../auth.ts';
import { config } from '../config.ts';
import { langOf, UserError } from '../i18n.ts';
import { aiConfigured, getAiSettings } from '../services/aiSettings.ts';
import { databaseReady } from '../db.ts';
import { libraryFor } from '../services/exercises.ts';
import { getProfile, saveProfile } from '../services/profile.ts';

export async function coreRoutes(app: FastifyInstance) {
  // Kubernetes readiness and liveness probe. Outside /api so it never needs auth.
  // No error details: they could contain connection settings.
  app.get('/healthz', async (_req, reply) => {
    if (await databaseReady()) return { status: 'ok', database: 'ok' };
    return reply.code(503).send({ status: 'error', database: 'error' });
  });

  app.get('/api/info', async (req): Promise<AppInfo> => ({
    aiConfigured: aiConfigured(),
    aiProvider: getAiSettings().provider,
    aiModel: getAiSettings().model,
    authMode: config.auth.mode,
    authRequired: config.auth.mode !== 'none',
    authenticated: Boolean(req.user),
    user: req.user ?? null,
    oidcProviderName: config.auth.oidcProviderName,
    version: config.version,
    language: langOf(await getProfile().catch(() => null)),
  }));

  app.post('/api/auth/login', async (req, reply) => {
    if (config.auth.mode !== 'password') throw new UserError(400, 'Password login is turned off', 'Inloggen met een wachtwoord staat uit');
    const { password } = z.object({ password: z.string() }).parse(req.body);
    if (!loginAllowed(req.ip)) throw new UserError(429, 'Too many attempts. Try again in 15 minutes.', 'Te veel pogingen. Probeer het over 15 minuten opnieuw.');
    if (!checkPassword(password)) {
      recordFailure(req.ip);
      throw new UserError(401, 'Wrong password', 'Verkeerd wachtwoord');
    }
    clearFailures(req.ip);
    passwordLogin(req, reply);
    return { ok: true };
  });

  app.get('/api/auth/oidc/login', async (req, reply) => {
    if (config.auth.mode !== 'oidc') return reply.code(404).send({ error: 'OIDC is not enabled' });
    return oidcLoginRedirect(req, reply);
  });

  app.get('/api/auth/oidc/callback', async (req, reply) => {
    if (config.auth.mode !== 'oidc') return reply.code(404).send({ error: 'OIDC is not enabled' });
    return oidcCallback(req, reply);
  });

  app.post('/api/auth/logout', async (req, reply) => ({ ok: true, redirect: await logout(req, reply) }));

  // The library (~900 exercises with steps) is fixed per release: serialize and gzip it once per language.
  // The language is in the URL (?lang=) so caches keep one copy per language.
  const library = Object.fromEntries(
    (['en', 'nl'] as const).map((l) => {
      const json = JSON.stringify(libraryFor(l));
      return [l, { json, gz: zlib.gzipSync(json) }];
    }),
  ) as Record<'en' | 'nl', { json: string; gz: Buffer }>;
  app.get('/api/exercises', async (req, reply) => {
    const { lang } = z.object({ lang: z.enum(['en', 'nl']).optional() }).parse(req.query);
    const body = library[lang ?? langOf(await getProfile())];
    reply.type('application/json; charset=utf-8').header('vary', 'accept-encoding');
    if (/\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) return reply.header('content-encoding', 'gzip').send(body.gz);
    return reply.send(body.json);
  });

  app.get('/api/profile', async () => ({ profile: await getProfile() }));
  app.put('/api/profile', async (req) => ({ profile: await saveProfile(req.body) }));
}
