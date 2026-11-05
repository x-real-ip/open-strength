import type { ExerciseDef, Increments, Level, LoadType, Profile } from '../../shared/types.ts';

export const DEFAULT_INCREMENTS: Increments = {
  barbell: 2.5,
  dumbbell: 2,
  machine: 5,
  cable: 2.5,
  kettlebell: 4,
};

export function incrementFor(loadType: LoadType, increments: Increments): number {
  if (loadType === 'bodyweight') return 0;
  const v = increments[loadType];
  return v > 0 ? v : DEFAULT_INCREMENTS[loadType];
}

const clean = (n: number) => Math.round(n * 100) / 100;

export function roundToStep(weight: number, step: number): number {
  if (step <= 0) return clean(weight);
  return clean(Math.max(0, Math.round(weight / step) * step));
}

export function floorToStep(weight: number, step: number): number {
  if (step <= 0) return clean(weight);
  return clean(Math.max(0, Math.floor(weight / step + 1e-9) * step));
}

export function formatKg(weight: number): string {
  return `${Number.isInteger(weight) ? weight : weight.toFixed(2).replace(/0$/, '')} kg`;
}

/** Epley estimated one-rep max. Only meaningful for loaded sets with reps in a sane range. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return clean(weight * (1 + Math.min(reps, 15) / 30));
}

const LEVEL_MULTIPLIER: Record<Level, number> = { beginner: 1, intermediate: 1.4, advanced: 1.8 };

/** Conservative starting weight estimate from body weight and level. */
export function heuristicStartWeight(ex: ExerciseDef, profile: Pick<Profile, 'weightKg' | 'level' | 'increments'>): number {
  const step = incrementFor(ex.loadType, profile.increments);
  if (step === 0) return 0;
  const raw = ex.startFactor * profile.weightKg * LEVEL_MULTIPLIER[profile.level];
  // Never suggest less than one step (an empty bar is handled by the user adjusting).
  return Math.max(step, floorToStep(raw, step));
}

/** Keep an AI-suggested start weight within a plausible band around the heuristic. */
export function clampStartWeight(suggested: number | undefined, ex: ExerciseDef, profile: Pick<Profile, 'weightKg' | 'level' | 'increments'>): number {
  const step = incrementFor(ex.loadType, profile.increments);
  if (step === 0) return 0;
  const base = heuristicStartWeight(ex, profile);
  if (suggested === undefined || !Number.isFinite(suggested) || suggested <= 0) return base;
  const min = base * 0.5;
  const max = base * 2;
  return Math.max(step, roundToStep(Math.min(max, Math.max(min, suggested)), step));
}
