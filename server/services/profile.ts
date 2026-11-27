import { z } from 'zod';
import type { Profile } from '../../shared/types.ts';
import { nowIso, one, run } from '../db.ts';
import { DEFAULT_INCREMENTS } from './weights.ts';

const step = z.number().min(0.25).max(20);

const fields = z.object({
  name: z.string().trim().max(60).default(''),
  age: z.number().int().min(12).max(100),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  goal: z.enum(['hypertrophy', 'strength', 'conditioning', 'fat_loss']),
  trainingDays: z.number().int().min(1).max(6),
  sessionMinutes: z.number().int().min(20).max(180),
  equipment: z
    .array(z.enum(['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'pullup_bar', 'bench', 'bands', 'bodyweight']))
    .default([]),
  limitations: z.string().trim().max(1000).default(''),
  increments: z
    .object({ barbell: step, dumbbell: step, machine: step, cable: step, kettlebell: step })
    .default(DEFAULT_INCREMENTS),
  language: z.enum(['en', 'nl']).default('en'),
});

/** Profiles saved before 1.8 call the number of training days `daysPerWeek`. */
export const profileSchema = z.preprocess((input) => {
  if (input && typeof input === 'object' && !('trainingDays' in input) && 'daysPerWeek' in input) {
    const { daysPerWeek, ...rest } = input as Record<string, unknown>;
    return { ...rest, trainingDays: daysPerWeek };
  }
  return input;
}, fields);

export async function getProfile(): Promise<Profile | null> {
  const row = await one<{ data: unknown; updated_at: string }>('SELECT data, updated_at FROM profile WHERE id = 1');
  if (!row) return null;
  const parsed = profileSchema.safeParse(row.data);
  if (!parsed.success) return null;
  return { ...parsed.data, updatedAt: row.updated_at };
}

export async function saveProfile(input: unknown): Promise<Profile> {
  const data = profileSchema.parse(input);
  const ts = nowIso();
  await run(
    'INSERT INTO profile (id, data, updated_at) VALUES (1, $1, $2) ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
    [JSON.stringify(data), ts],
  );
  return { ...data, updatedAt: ts };
}
