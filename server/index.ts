import { buildApp } from './app.ts';
import { initAuth } from './auth.ts';
import { aiConfigured, config } from './config.ts';
import { closeDb, openDb } from './db.ts';

await openDb(undefined, { migrate: config.migrateOnStart });
await initAuth();
const app = await buildApp({ logger: { level: config.logLevel } });

app.log.info(
  `AI: ${aiConfigured() ? `${config.ai.provider} (${config.ai.model})` : 'not configured, using rule-based programs'}; auth: ${config.auth.mode}`,
);

await app.listen({ port: config.port, host: config.host });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    // Stop accepting requests, let in-flight ones finish, then close the pool.
    await app.close();
    await closeDb();
    process.exit(0);
  });
}
