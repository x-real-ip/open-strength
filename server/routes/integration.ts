import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { all } from '../db.ts';
import { langOf, pick } from '../i18n.ts';
import { applyBodyWeight } from '../services/bodyWeight.ts';
import { goalClash, linkStatus, nutritionFacts, nutritionPhase, outboxSize, stallNote } from '../services/nutrilog.ts';
import { getProfile } from '../services/profile.ts';
import { detectStalls } from '../services/stats.ts';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const range = z.object({ from: z.string().regex(DAY), to: z.string().regex(DAY) });

/**
 * The versioned API for Open Nutrilog (/api/integration/v1/*): a bearer token only, checked in authHook (404 when no
 * token is configured). Plus /api/linked/nutrition, which the PWA calls after the page has rendered.
 */
export async function integrationRoutes(app: FastifyInstance) {
  // Workouts in progress or finished, by their day in the Netherlands.
  app.get('/api/integration/v1/workouts', async (req) => {
    const { from, to } = range.parse(req.query);
    const lang = langOf(await getProfile());
    const rows = await all(
      `SELECT w.id, (w.started_at AT TIME ZONE 'Europe/Amsterdam')::date AS day, w.started_at, w.finished_at, w.status, w.day_name, w.is_deload,
         count(s.*) FILTER (WHERE s.completed)::int AS total_sets,
         coalesce(sum(s.weight * s.reps) FILTER (WHERE s.completed), 0) AS volume
       FROM workouts w LEFT JOIN workout_sets s ON s.workout_id = w.id
       WHERE w.status IN ('in_progress', 'completed')
         AND (w.started_at AT TIME ZONE 'Europe/Amsterdam')::date BETWEEN $1 AND $2
       GROUP BY w.id ORDER BY w.started_at`,
      [from, to],
    );
    return rows.map((r) => ({
      id: r.id,
      date: r.day,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      status: r.status,
      durationMinutes: Math.max(0, Math.round(((r.finished_at ? Date.parse(r.finished_at) : Date.now()) - Date.parse(r.started_at)) / 60_000)),
      dayName: pick(r.day_name, lang),
      isDeload: r.is_deload,
      totalSets: r.total_sets,
      volumeKg: Math.round(r.volume),
    }));
  });

  app.get('/api/integration/v1/body-weights', async (req) => {
    const { from, to } = range.parse(req.query);
    return all('SELECT measured_on AS "date", weight_kg AS "weightKg" FROM body_weights WHERE measured_on BETWEEN $1 AND $2 ORDER BY measured_on', [from, to]);
  });

  app.put('/api/integration/v1/body-weights/:date', async (req) => {
    const { date } = z.object({ date: z.string().regex(DAY) }).parse(req.params);
    const { weightKg } = z.object({ weightKg: z.number().min(30).max(300) }).parse(req.body);
    await applyBodyWeight(date, weightKg);
    return { ok: true };
  });

  app.delete('/api/integration/v1/body-weights/:date', async (req) => {
    const { date } = z.object({ date: z.string().regex(DAY) }).parse(req.params);
    await applyBodyWeight(date, null);
    return { ok: true };
  });

  app.get('/api/integration/v1/profile', async () => {
    const p = await getProfile();
    return p ? { goal: p.goal, level: p.level, age: p.age, heightCm: p.heightCm, weightKg: p.weightKg, language: p.language } : null;
  });

  // For the PWA: the link's status and what it adds, loaded after the page itself.
  app.get('/api/linked/nutrition', async () => {
    const profile = await getProfile();
    const lang = langOf(profile);
    const status = await linkStatus();
    const phase = status === 'ok' ? await nutritionPhase() : null;
    const notes: Record<string, string> = {};
    if (phase) {
      for (const s of await detectStalls(lang)) {
        const note = stallNote(s.name, s.sessions, phase);
        if (note) notes[s.exerciseId] = pick(note, lang);
      }
    }
    const clash = profile ? goalClash(profile.goal, phase) : null;
    return {
      status,
      phase,
      facts: phase ? nutritionFacts(phase, lang) : null,
      clash: clash ? pick(clash, lang) : null,
      stallNotes: notes,
      pendingWeights: status === 'off' ? 0 : await outboxSize(),
    };
  });
}
