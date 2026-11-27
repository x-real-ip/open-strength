import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { authHook } from './auth.ts';
import { config } from './config.ts';
import { coreRoutes } from './routes/core.ts';
import { dataRoutes } from './routes/data.ts';
import { insightRoutes } from './routes/insights.ts';
import { programRoutes } from './routes/programs.ts';
import { workoutRoutes } from './routes/workouts.ts';

export async function buildApp(opts: { logger?: boolean | { level: string } } = {}) {
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: true, bodyLimit: 2 * 1024 * 1024 });

  await app.register(cookie);
  app.addHook('onRequest', authHook);

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') });
    }
    const status = typeof err.status === 'number' ? err.status : typeof err.statusCode === 'number' ? err.statusCode : 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({ error: status >= 500 && !err.status ? 'Internal server error' : err.message });
  });

  await app.register(coreRoutes);
  await app.register(programRoutes);
  await app.register(workoutRoutes);
  await app.register(insightRoutes);
  await app.register(dataRoutes);

  // Serve the built PWA with an SPA fallback.
  if (fs.existsSync(path.join(config.webDir, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: config.webDir,
      wildcard: false,
      setHeaders(res, filePath) {
        const name = path.basename(filePath);
        if (name === 'sw.js' || name === 'index.html' || name.endsWith('.webmanifest')) res.header('cache-control', 'no-cache');
        else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.header('cache-control', 'public, max-age=31536000, immutable');
      },
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.method !== 'GET') return reply.code(404).send({ error: 'Not found' });
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    });
  }

  return app;
}
