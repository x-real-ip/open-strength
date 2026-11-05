import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getProfile } from '../services/profile.ts';
import { deleteSet, discardWorkout, finishWorkout, getSummary, getToday, getWorkout, listWorkouts, startWorkout, upsertSet } from '../services/workouts.ts';

const idParam = z.object({ id: z.coerce.number() });

export async function workoutRoutes(app: FastifyInstance) {
  app.get('/api/today', async () => getToday(await getProfile()));

  app.get('/api/workouts', async () => ({ workouts: await listWorkouts() }));

  app.post('/api/workouts', async (req) => {
    const { programDayId } = z.object({ programDayId: z.number().int() }).parse(req.body);
    const profile = await getProfile();
    const id = await startWorkout(programDayId, profile);
    return { workout: await getWorkout(id, profile) };
  });

  app.get('/api/workouts/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return { workout: await getWorkout(id, await getProfile()) };
  });

  app.put('/api/workouts/:id/sets', async (req) => {
    const { id } = idParam.parse(req.params);
    await upsertSet(id, req.body);
    return { ok: true };
  });

  app.delete('/api/workouts/:id/sets/:peId/:setIndex', async (req) => {
    const p = z.object({ id: z.coerce.number(), peId: z.coerce.number(), setIndex: z.coerce.number() }).parse(req.params);
    await deleteSet(p.id, p.peId, p.setIndex);
    return { ok: true };
  });

  app.post('/api/workouts/:id/finish', async (req) => {
    const { id } = idParam.parse(req.params);
    return { summary: await finishWorkout(id, await getProfile()) };
  });

  app.get('/api/workouts/:id/summary', async (req) => {
    const { id } = idParam.parse(req.params);
    return { summary: await getSummary(id, await getProfile()) };
  });

  app.delete('/api/workouts/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    await discardWorkout(id);
    return { ok: true };
  });
}
