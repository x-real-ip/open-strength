// Body weight over time, one entry per day. The latest entry is the profile's weight, so the
// heuristic starting weights (weights.ts) always use your current body weight.
//
// When linked with Open Nutrilog, that app owns body weight: weigh-ins logged here are also sent there (queued when
// it is down), and weigh-ins from there arrive through the integration API (applyBodyWeight), which doesn't send
// them back.
import type { BodyWeightEntry, Profile } from '../../shared/types.ts';
import { all, getPool, nowIso, one, run, type Queryable } from '../db.ts';
import { sendWeight } from './nutrilog.ts';
import { getProfile, saveProfile } from './profile.ts';

/** Today in the Netherlands as YYYY-MM-DD; the client normally sends its own date. */
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
}

export async function listBodyWeights(db: Queryable = getPool()): Promise<BodyWeightEntry[]> {
  return all<BodyWeightEntry>('SELECT id, measured_on AS "date", weight_kg AS "weightKg" FROM body_weights ORDER BY measured_on', [], db);
}

/** Record a weight for a day (replacing that day's entry) without touching the profile. */
export async function recordBodyWeight(weightKg: number, date: string = today(), db: Queryable = getPool()): Promise<void> {
  await run(
    `INSERT INTO body_weights (measured_on, weight_kg, created_at) VALUES ($1, $2, $3)
     ON CONFLICT (measured_on) DO UPDATE SET weight_kg = excluded.weight_kg, created_at = excluded.created_at`,
    [date, weightKg, nowIso()],
    db,
  );
}

/** The profile follows the most recent entry. */
async function syncProfile(): Promise<void> {
  const latest = await one<{ weight_kg: number }>('SELECT weight_kg FROM body_weights ORDER BY measured_on DESC LIMIT 1');
  const profile = await getProfile();
  if (latest && profile && profile.weightKg !== latest.weight_kg) await saveProfile({ ...profile, weightKg: latest.weight_kg });
}

export async function logBodyWeight(weightKg: number, date?: string): Promise<BodyWeightEntry[]> {
  const day = date ?? today();
  await recordBodyWeight(weightKg, day);
  await syncProfile();
  await sendWeight(day, weightKg);
  return listBodyWeights();
}

export async function deleteBodyWeight(id: number): Promise<BodyWeightEntry[]> {
  const row = await one<{ day: string }>('SELECT measured_on AS day FROM body_weights WHERE id = $1', [id]);
  await run('DELETE FROM body_weights WHERE id = $1', [id]);
  await syncProfile();
  if (row) await sendWeight(row.day, null);
  return listBodyWeights();
}

/** Editing the weight in the profile also counts as today's weigh-in. */
export async function noteProfileWeight(before: Profile | null, after: Profile): Promise<void> {
  if (!before || before.weightKg !== after.weightKg) {
    await recordBodyWeight(after.weightKg);
    await sendWeight(today(), after.weightKg);
  }
}

/** A weigh-in from Open Nutrilog (or its removal): stored here, never sent back. */
export async function applyBodyWeight(day: string, weightKg: number | null): Promise<void> {
  if (weightKg === null) await run('DELETE FROM body_weights WHERE measured_on = $1', [day]);
  else await recordBodyWeight(Math.round(weightKg * 10) / 10, day);
  await syncProfile();
}
