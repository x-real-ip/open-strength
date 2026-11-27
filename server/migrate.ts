// Standalone migration command: `npm run migrate` locally, and the `migrate` init
// container in Kubernetes. Safe to run repeatedly; it exits non-zero on failure so the
// pod does not start on a half-migrated database.
import { closeDb, migrate, openDb } from './db.ts';

try {
  await openDb(undefined, { migrate: false });
  const { from, to } = await migrate();
  console.log(from === to ? `Database schema is up to date (version ${to}).` : `Migrated database schema from version ${from} to ${to}.`);
  await closeDb();
} catch (err) {
  console.error('Migration failed:', (err as Error).message);
  await closeDb().catch(() => {});
  process.exit(1);
}
