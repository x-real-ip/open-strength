import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { langOf } from '../i18n.ts';
import { deleteBodyWeight, listBodyWeights, logBodyWeight } from '../services/bodyWeight.ts';
import { getProfile } from '../services/profile.ts';
import { cancelRest, deleteSubscription, publicKey, pushAll, saveSubscription, scheduleRest } from '../services/push.ts';

/** Body weight log and push notifications for the rest timer. */
export async function bodyRoutes(app: FastifyInstance) {
  app.get('/api/body-weights', async () => ({ entries: await listBodyWeights() }));

  app.post('/api/body-weights', async (req) => {
    const { weightKg, date } = z
      .object({ weightKg: z.number().min(30).max(300), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .strict()
      .parse(req.body);
    return { entries: await logBodyWeight(Math.round(weightKg * 10) / 10, date) };
  });

  app.delete('/api/body-weights/:id', async (req) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    return { entries: await deleteBodyWeight(id) };
  });

  app.get('/api/push/key', async () => ({ publicKey: await publicKey() }));

  const subscription = z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  });

  app.post('/api/push/subscriptions', async (req) => {
    await saveSubscription(subscription.parse(req.body));
    return { ok: true };
  });

  app.delete('/api/push/subscriptions', async (req) => {
    const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body);
    await deleteSubscription(endpoint);
    return { ok: true };
  });

  // The app went to the background during a rest: push when the rest ends.
  app.post('/api/push/rest', async (req) => {
    const { endsAt, next } = z.object({ endsAt: z.number(), next: z.string().max(120).optional() }).parse(req.body);
    return { scheduled: scheduleRest(endsAt, langOf(await getProfile()), next) };
  });

  // Back in the app (it beeps by itself) or the rest was skipped.
  app.delete('/api/push/rest', async () => {
    cancelRest();
    return { ok: true };
  });

  app.post('/api/push/test', async () => {
    const lang = langOf(await getProfile());
    const sent = await pushAll({
      title: 'Overload',
      body: lang === 'nl' ? 'Meldingen werken. Je krijgt er een als de rust voorbij is.' : 'Notifications work. You get one when a rest is over.',
      tag: 'test',
    });
    return { sent };
  });
}
