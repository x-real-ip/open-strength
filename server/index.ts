import { buildApp } from './app.ts';
import { initAuth } from './auth.ts';
import { config } from './config.ts';
import { aiConfigured, getAiSettings, loadAiSettings } from './services/aiSettings.ts';
import { closeDb, openDb } from './db.ts';
import { flushOutbox, linked, startOutboxRetry } from './services/nutrilog.ts';

await openDb(undefined, { migrate: config.migrateOnStart });
await initAuth();
await loadAiSettings();
const app = await buildApp({ logger: { level: config.logLevel } });

app.log.info(
  `AI: ${aiConfigured() ? `${getAiSettings().provider} (${getAiSettings().model})` : 'not configured, using rule-based programs'}; auth: ${config.auth.mode}`,
);

await app.listen({ port: config.port, host: config.host });

// Weigh-ins that couldn't reach Open Nutrilog are retried now and every minute.
if (linked()) {
  app.log.info(`Open Nutrilog: ${config.integration.nutrilogUrl}`);
  void flushOutbox().catch(() => {});
  startOutboxRetry();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    // Stop accepting requests, let in-flight ones finish, then close the pool.
    await app.close();
    await closeDb();
    process.exit(0);
  });
}
