import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clearMessages, listMessages, sendMessage } from '../services/coach.ts';
import { langOf } from '../i18n.ts';
import { getProfile } from '../services/profile.ts';
import { exerciseHistory, exerciseUsage, getStats } from '../services/stats.ts';

export async function insightRoutes(app: FastifyInstance) {
  app.get('/api/stats', async (req) => {
    const { weeks } = z.object({ weeks: z.coerce.number().int().min(4).max(52).default(12) }).parse(req.query);
    return getStats(weeks, langOf(await getProfile()));
  });

  app.get('/api/stats/exercise-usage', async () => exerciseUsage());

  app.get('/api/stats/exercises/:exerciseId', async (req) => {
    const { exerciseId } = z.object({ exerciseId: z.string() }).parse(req.params);
    return exerciseHistory(exerciseId, langOf(await getProfile()));
  });

  app.get('/api/coach/messages', async () => ({ messages: await listMessages() }));

  app.post('/api/coach/messages', async (req) => {
    const { content } = z.object({ content: z.string().trim().min(1).max(4000) }).parse(req.body);
    return { messages: await sendMessage(content, await getProfile()) };
  });

  app.delete('/api/coach/messages', async () => {
    await clearMessages();
    return { ok: true };
  });
}
