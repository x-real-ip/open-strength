import type { FastifyInstance } from 'fastify';
import { exportJson, exportSetsCsv, importJson } from '../services/dataExport.ts';

const day = () => new Date().toISOString().slice(0, 10);

export async function dataRoutes(app: FastifyInstance) {
  app.get('/api/export/json', async (_req, reply) => {
    reply.header('content-disposition', `attachment; filename="open-strength-export-${day()}.json"`);
    return exportJson();
  });

  app.get('/api/export/sets.csv', async (_req, reply) => {
    reply.header('content-type', 'text/csv; charset=utf-8');
    reply.header('content-disposition', `attachment; filename="open-strength-sets-${day()}.csv"`);
    return exportSetsCsv();
  });

  // Also accepts exports from the SQLite-based version 1.0.
  app.post('/api/import/json', { bodyLimit: 50 * 1024 * 1024 }, async (req) => {
    await importJson(req.body);
    return { ok: true };
  });
}
