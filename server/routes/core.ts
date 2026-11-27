import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppInfo } from '../../shared/types.ts';
import { checkPassword, clearFailures, loginAllowed, logout, oidcCallback, oidcLoginRedirect, passwordLogin, recordFailure } from '../auth.ts';
import { config } from '../config.ts';
import { aiConfigured, getAiSettings } from '../services/aiSettings.ts';
import { databaseReady } from '../db.ts';
import { EXERCISES } from '../services/exercises.ts';
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
  }));

  app.post('/api/auth/login', async (req, reply) => {
    if (config.auth.mode !== 'password') return reply.code(400).send({ error: 'Inloggen met een wachtwoord staat uit' });
    const { password } = z.object({ password: z.string() }).parse(req.body);
    if (!loginAllowed(req.ip)) return reply.code(429).send({ error: 'Te veel pogingen. Probeer het over 15 minuten opnieuw.' });
    if (!checkPassword(password)) {
      recordFailure(req.ip);
      return reply.code(401).send({ error: 'Verkeerd wachtwoord' });
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

  app.get('/api/exercises', async () => EXERCISES);

  app.get('/api/profile', async () => ({ profile: await getProfile() }));
  app.put('/api/profile', async (req) => ({ profile: await saveProfile(req.body) }));
}
