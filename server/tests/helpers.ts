// Test database: a throwaway embedded PostgreSQL per test file, or TEST_DATABASE_URL
// (its public schema is wiped first, so never point this at real data).
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export async function startTestDb(): Promise<{ url: string; stop: () => Promise<void> }> {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    const c = new pg.Client({ connectionString: external });
    await c.connect();
    await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await c.end();
    return { url: external, stop: async () => {} };
  }

  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  // Let embedded-postgres create the directory itself (it may run initdb as another user).
  const dir = path.join(os.tmpdir(), `overload-pg-${process.pid}-${Date.now()}`);
  const port = await freePort();
  const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'test', port, persistent: false, onLog: () => {} });
  await server.initialise();
  await server.start();
  await server.createDatabase('overload');
  return {
    url: `postgres://postgres:test@127.0.0.1:${port}/overload`,
    stop: async () => {
      await server.stop();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
