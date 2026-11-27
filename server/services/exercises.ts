// Curated exercise library. Programs (AI or template) may only use exercises from this list,
// so history, statistics and weight steps stay consistent across programs.
import type { Equipment, ExerciseDef, MovementPattern, MuscleGroup } from '../../shared/types.ts';
import { GUIDES } from './exerciseGuide.ts';

// `name` here is the English working name; the Dutch display name, steps and photos come from GUIDES.
type Def = Omit<ExerciseDef, 'secondary' | 'steps' | 'photos' | 'photoNote'> & { secondary?: MuscleGroup[] };

const defs: Def[] = [
  // Horizontal push
  { id: 'barbell_bench_press', name: 'Barbell bench press', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: ['barbell', 'bench'], loadType: 'barbell', pattern: 'horizontal_push', compound: true, startFactor: 0.5 },
  { id: 'incline_barbell_bench_press', name: 'Incline barbell bench press', primary: 'chest', secondary: ['shoulders', 'triceps'], equipment: ['barbell', 'bench'], loadType: 'barbell', pattern: 'horizontal_push', compound: true, startFactor: 0.4 },
  { id: 'dumbbell_bench_press', name: 'Dumbbell bench press', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: ['dumbbell', 'bench'], loadType: 'dumbbell', pattern: 'horizontal_push', compound: true, startFactor: 0.18, weightNote: 'per hand' },
  { id: 'incline_dumbbell_press', name: 'Incline dumbbell press', primary: 'chest', secondary: ['shoulders', 'triceps'], equipment: ['dumbbell', 'bench'], loadType: 'dumbbell', pattern: 'horizontal_push', compound: true, startFactor: 0.15, weightNote: 'per hand' },
  { id: 'machine_chest_press', name: 'Machine chest press', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: ['machine'], loadType: 'machine', pattern: 'horizontal_push', compound: true, startFactor: 0.45 },
  { id: 'push_up', name: 'Push-up', primary: 'chest', secondary: ['triceps', 'shoulders', 'core'], equipment: ['bodyweight'], loadType: 'bodyweight', pattern: 'horizontal_push', compound: true, startFactor: 0 },
  { id: 'close_grip_bench_press', name: 'Close-grip bench press', primary: 'triceps', secondary: ['chest'], equipment: ['barbell', 'bench'], loadType: 'barbell', pattern: 'triceps', compound: true, startFactor: 0.4 },

  // Chest isolation
  { id: 'cable_fly', name: 'Cable fly', primary: 'chest', equipment: ['cable'], loadType: 'cable', pattern: 'chest_iso', compound: false, startFactor: 0.08, weightNote: 'per kant' },
  { id: 'dumbbell_fly', name: 'Dumbbell fly', primary: 'chest', equipment: ['dumbbell', 'bench'], loadType: 'dumbbell', pattern: 'chest_iso', compound: false, startFactor: 0.07, weightNote: 'per hand' },
  { id: 'pec_deck', name: 'Pec deck', primary: 'chest', equipment: ['machine'], loadType: 'machine', pattern: 'chest_iso', compound: false, startFactor: 0.3 },

  // Vertical push
  { id: 'overhead_press', name: 'Overhead press', primary: 'shoulders', secondary: ['triceps', 'core'], equipment: ['barbell'], loadType: 'barbell', pattern: 'vertical_push', compound: true, startFactor: 0.3 },
  { id: 'dumbbell_shoulder_press', name: 'Dumbbell shoulder press', primary: 'shoulders', secondary: ['triceps'], equipment: ['dumbbell'], loadType: 'dumbbell', pattern: 'vertical_push', compound: true, startFactor: 0.12, weightNote: 'per hand' },
  { id: 'machine_shoulder_press', name: 'Machine shoulder press', primary: 'shoulders', secondary: ['triceps'], equipment: ['machine'], loadType: 'machine', pattern: 'vertical_push', compound: true, startFactor: 0.3 },
  { id: 'kettlebell_press', name: 'Kettlebell press', primary: 'shoulders', secondary: ['triceps', 'core'], equipment: ['kettlebell'], loadType: 'kettlebell', pattern: 'vertical_push', compound: true, startFactor: 0.12, weightNote: 'per hand' },
  { id: 'pike_push_up', name: 'Pike push-up', primary: 'shoulders', secondary: ['triceps'], equipment: ['bodyweight'], loadType: 'bodyweight', pattern: 'vertical_push', compound: true, startFactor: 0 },

  // Shoulder isolation / rear delts
  { id: 'lateral_raise', name: 'Dumbbell lateral raise', primary: 'shoulders', equipment: ['dumbbell'], loadType: 'dumbbell', pattern: 'shoulder_iso', compound: false, startFactor: 0.06, weightNote: 'per hand' },
  { id: 'cable_lateral_raise', name: 'Cable lateral raise', primary: 'shoulders', equipment: ['cable'], loadType: 'cable', pattern: 'shoulder_iso', compound: false, startFactor: 0.05 },
  { id: 'band_lateral_raise', name: 'Band lateral raise', primary: 'shoulders', equipment: ['bands'], loadType: 'bodyweight', pattern: 'shoulder_iso', compound: false, startFactor: 0 },
  { id: 'face_pull', name: 'Cable face pull', primary: 'shoulders', secondary: ['back'], equipment: ['cable'], loadType: 'cable', pattern: 'rear_delt', compound: false, startFactor: 0.15 },
  { id: 'reverse_dumbbell_fly', name: 'Reverse dumbbell fly', primary: 'shoulders', secondary: ['back'], equipment: ['dumbbell'], loadType: 'dumbbell', pattern: 'rear_delt', compound: false, startFactor: 0.05, weightNote: 'per hand' },
  { id: 'band_pull_apart', name: 'Band pull-apart', primary: 'shoulders', secondary: ['back'], equipment: ['bands'], loadType: 'bodyweight', pattern: 'rear_delt', compound: false, startFactor: 0 },

  // Horizontal pull
  { id: 'barbell_row', name: 'Barbell row', primary: 'back', secondary: ['biceps', 'shoulders'], equipment: ['barbell'], loadType: 'barbell', pattern: 'horizontal_pull', compound: true, startFactor: 0.45 },
  { id: 'dumbbell_row', name: 'One-arm dumbbell row', primary: 'back', secondary: ['biceps'], equipment: ['dumbbell', 'bench'], loadType: 'dumbbell', pattern: 'horizontal_pull', compound: true, startFactor: 0.2, weightNote: 'per hand' },
  { id: 'seated_cable_row', name: 'Seated cable row', primary: 'back', secondary: ['biceps'], equipment: ['cable'], loadType: 'cable', pattern: 'horizontal_pull', compound: true, startFactor: 0.45 },
  { id: 'chest_supported_row', name: 'Chest-supported machine row', primary: 'back', secondary: ['biceps'], equipment: ['machine'], loadType: 'machine', pattern: 'horizontal_pull', compound: true, startFactor: 0.4 },
  { id: 'kettlebell_row', name: 'Kettlebell row', primary: 'back', secondary: ['biceps'], equipment: ['kettlebell'], loadType: 'kettlebell', pattern: 'horizontal_pull', compound: true, startFactor: 0.16, weightNote: 'per hand' },
  { id: 'band_row', name: 'Band row', primary: 'back', secondary: ['biceps'], equipment: ['bands'], loadType: 'bodyweight', pattern: 'horizontal_pull', compound: true, startFactor: 0 },

  // Vertical pull
  { id: 'pull_up', name: 'Pull-up', primary: 'back', secondary: ['biceps'], equipment: ['pullup_bar'], loadType: 'bodyweight', pattern: 'vertical_pull', compound: true, startFactor: 0 },
  { id: 'chin_up', name: 'Chin-up', primary: 'back', secondary: ['biceps'], equipment: ['pullup_bar'], loadType: 'bodyweight', pattern: 'vertical_pull', compound: true, startFactor: 0 },
  { id: 'lat_pulldown', name: 'Lat pulldown', primary: 'back', secondary: ['biceps'], equipment: ['cable'], loadType: 'cable', pattern: 'vertical_pull', compound: true, startFactor: 0.45 },
  { id: 'band_pulldown', name: 'Band pulldown', primary: 'back', secondary: ['biceps'], equipment: ['bands'], loadType: 'bodyweight', pattern: 'vertical_pull', compound: true, startFactor: 0 },

  // Squat
  { id: 'back_squat', name: 'Back squat', primary: 'quads', secondary: ['glutes', 'core'], equipment: ['barbell'], loadType: 'barbell', pattern: 'squat', compound: true, startFactor: 0.6 },
  { id: 'front_squat', name: 'Front squat', primary: 'quads', secondary: ['glutes', 'core'], equipment: ['barbell'], loadType: 'barbell', pattern: 'squat', compound: true, startFactor: 0.45 },
  { id: 'leg_press', name: 'Leg press', primary: 'quads', secondary: ['glutes'], equipment: ['machine'], loadType: 'machine', pattern: 'squat', compound: true, startFactor: 1.0 },
  { id: 'hack_squat', name: 'Hack squat', primary: 'quads', secondary: ['glutes'], equipment: ['machine'], loadType: 'machine', pattern: 'squat', compound: true, startFactor: 0.5 },
  { id: 'goblet_squat', name: 'Goblet squat', primary: 'quads', secondary: ['glutes', 'core'], equipment: ['dumbbell'], loadType: 'dumbbell', pattern: 'squat', compound: true, startFactor: 0.25, weightNote: 'één dumbbell' },
  { id: 'kettlebell_goblet_squat', name: 'Kettlebell goblet squat', primary: 'quads', secondary: ['glutes', 'core'], equipment: ['kettlebell'], loadType: 'kettlebell', pattern: 'squat', compound: true, startFactor: 0.2 },
  { id: 'bodyweight_squat', name: 'Bodyweight squat', primary: 'quads', secondary: ['glutes'], equipment: ['bodyweight'], loadType: 'bodyweight', pattern: 'squat', compound: true, startFactor: 0 },

  // Lunge / single leg
  { id: 'bulgarian_split_squat', name: 'Bulgarian split squat', primary: 'quads', secondary: ['glutes'], equipment: ['dumbbell', 'bench'], loadType: 'dumbbell', pattern: 'lunge', compound: true, startFactor: 0.1, weightNote: 'per hand' },
  { id: 'walking_lunge', name: 'Dumbbell walking lunge', primary: 'quads', secondary: ['glutes'], equipment: ['dumbbell'], loadType: 'dumbbell', pattern: 'lunge', compound: true, startFactor: 0.1, weightNote: 'per hand' },
  { id: 'step_up', name: 'Dumbbell step-up', primary: 'quads', secondary: ['glutes'], equipment: ['dumbbell', 'bench'], loadType: 'dumbbell', pattern: 'lunge', compound: true, startFactor: 0.1, weightNote: 'per hand' },
  { id: 'reverse_lunge', name: 'Reverse lunge', primary: 'quads', secondary: ['glutes'], equipment: ['bodyweight'], loadType: 'bodyweight', pattern: 'lunge', compound: true, startFactor: 0 },

  // Hinge
  { id: 'deadlift', name: 'Deadlift', primary: 'hamstrings', secondary: ['glutes', 'back', 'core'], equipment: ['barbell'], loadType: 'barbell', pattern: 'hinge', compound: true, startFactor: 0.8 },
  { id: 'romanian_deadlift', name: 'Romanian deadlift', primary: 'hamstrings', secondary: ['glutes', 'back'], equipment: ['barbell'], loadType: 'barbell', pattern: 'hinge', compound: true, startFactor: 0.5 },
  { id: 'dumbbell_romanian_deadlift', name: 'Dumbbell Romanian deadlift', primary: 'hamstrings', secondary: ['glutes'], equipment: ['dumbbell'], loadType: 'dumbbell', pattern: 'hinge', compound: true, startFactor: 0.2, weightNote: 'per hand' },
  { id: 'kettlebell_swing', name: 'Kettlebell swing', primary: 'glutes', secondary: ['hamstrings', 'core'], equipment: ['kettlebell'], loadType: 'kettlebell', pattern: 'hinge', compound: true, startFactor: 0.24 },
  { id: 'hip_thrust', name: 'Barbell hip thrust', primary: 'glutes', secondary: ['hamstrings'], equipment: ['barbell', 'bench'], loadType: 'barbell', pattern: 'glute_iso', compound: true, startFactor: 0.6 },
  { id: 'glute_bridge', name: 'Glute bridge', primary: 'glutes', secondary: ['hamstrings'], equipment: ['bodyweight'], loadType: 'bodyweight', pattern: 'glute_iso', compound: false, startFactor: 0 },

  // Leg isolation
  { id: 'leg_extension', name: 'Leg extension', primary: 'quads', equipment: ['machine'], loadType: 'machine', pattern: 'quad_iso', compound: false, startFactor: 0.3 },
  { id: 'leg_curl', name: 'Leg curl', primary: 'hamstrings', equipment: ['machine'], loadType: 'machine', pattern: 'hamstring_iso', compound: false, startFactor: 0.25 },
  { id: 'standing_calf_raise', name: 'Machine calf raise', primary: 'calves', equipment: ['machine'], loadType: 'machine', pattern: 'calf', compound: false, startFactor: 0.6 },
  { id: 'dumbbell_calf_raise', name: 'Dumbbell calf raise', primary: 'calves', equipment: ['dumbbell'], loadType: 'dumbbell', pattern: 'calf', compound: false, startFactor: 0.15, weightNote: 'per hand' },
  { id: 'bodyweight_calf_raise', name: 'Single-leg calf raise', primary: 'calves', equipment: ['bodyweight'], loadType: 'bodyweight', pattern: 'calf', compound: false, startFactor: 0 },

  // Arms
  { id: 'barbell_curl', name: 'Barbell curl', primary: 'biceps', equipment: ['barbell'], loadType: 'barbell', pattern: 'biceps', compound: false, startFactor: 0.2 },
  { id: 'dumbbell_curl', name: 'Dumbbell curl', primary: 'biceps', equipment: ['dumbbell'], loadType: 'dumbbell', pattern: 'biceps', compound: false, startFactor: 0.08, weightNote: 'per hand' },
  { id: 'hammer_curl', name: 'Hammer curl', primary: 'biceps', equipment: ['dumbbell'], loadType: 'dumbbell', pattern: 'biceps', compound: false, startFactor: 0.09, weightNote: 'per hand' },
  { id: 'cable_curl', name: 'Cable curl', primary: 'biceps', equipment: ['cable'], loadType: 'cable', pattern: 'biceps', compound: false, startFactor: 0.15 },
  { id: 'band_curl', name: 'Band curl', primary: 'biceps', equipment: ['bands'], loadType: 'bodyweight', pattern: 'biceps', compound: false, startFactor: 0 },
  { id: 'triceps_pushdown', name: 'Triceps pushdown', primary: 'triceps', equipment: ['cable'], loadType: 'cable', pattern: 'triceps', compound: false, startFactor: 0.2 },
  { id: 'overhead_triceps_extension', name: 'Overhead dumbbell triceps extension', primary: 'triceps', equipment: ['dumbbell'], loadType: 'dumbbell', pattern: 'triceps', compound: false, startFactor: 0.12, weightNote: 'één dumbbell' },
  { id: 'skull_crusher', name: 'EZ-bar skull crusher', primary: 'triceps', equipment: ['barbell', 'bench'], loadType: 'barbell', pattern: 'triceps', compound: false, startFactor: 0.2 },
  { id: 'bench_dip', name: 'Bench dip', primary: 'triceps', secondary: ['chest'], equipment: ['bench'], loadType: 'bodyweight', pattern: 'triceps', compound: false, startFactor: 0 },
  { id: 'band_pushdown', name: 'Band triceps pushdown', primary: 'triceps', equipment: ['bands'], loadType: 'bodyweight', pattern: 'triceps', compound: false, startFactor: 0 },

  // Core
  { id: 'cable_crunch', name: 'Cable crunch', primary: 'core', equipment: ['cable'], loadType: 'cable', pattern: 'core', compound: false, startFactor: 0.3 },
  { id: 'pallof_press', name: 'Pallof press', primary: 'core', equipment: ['cable'], loadType: 'cable', pattern: 'core', compound: false, startFactor: 0.1 },
  { id: 'hanging_knee_raise', name: 'Hanging knee raise', primary: 'core', equipment: ['pullup_bar'], loadType: 'bodyweight', pattern: 'core', compound: false, startFactor: 0 },
  { id: 'dead_bug', name: 'Dead bug', primary: 'core', equipment: ['bodyweight'], loadType: 'bodyweight', pattern: 'core', compound: false, startFactor: 0 },
];

export const EXERCISES: ExerciseDef[] = defs.map((d) => {
  const g = GUIDES[d.id];
  return {
    secondary: [],
    ...d,
    name: g?.name ?? d.name,
    steps: g?.steps ?? [],
    photos: g ? [`/exercises/${g.photo}-0.webp`, `/exercises/${g.photo}-1.webp`] : [],
    photoNote: g?.similar,
  };
});

const byId = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): ExerciseDef | undefined {
  return byId.get(id);
}

/** Bodyweight is always available; everything else must be in the profile. */
export function isAvailable(ex: ExerciseDef, equipment: Equipment[]): boolean {
  const have = new Set<Equipment>([...equipment, 'bodyweight']);
  return ex.equipment.every((e) => have.has(e));
}

export function availableExercises(equipment: Equipment[]): ExerciseDef[] {
  return EXERCISES.filter((e) => isAvailable(e, equipment));
}

/**
 * Alternatives for an exercise: same movement pattern first, then same primary muscle.
 * Loaded variants rank above bodyweight variants when the user has the gear.
 */
export function alternativesFor(id: string, equipment: Equipment[], exclude: string[] = []): ExerciseDef[] {
  const ex = byId.get(id);
  if (!ex) return [];
  const skip = new Set([id, ...exclude]);
  const pool = availableExercises(equipment).filter((e) => !skip.has(e.id));
  const score = (e: ExerciseDef) =>
    (e.pattern === ex.pattern ? 0 : 10) + (e.primary === ex.primary ? 0 : 5) + (e.loadType === 'bodyweight' ? 1 : 0);
  return pool
    .filter((e) => e.pattern === ex.pattern || e.primary === ex.primary)
    .sort((a, b) => score(a) - score(b));
}

/** Pick the best available exercise for a movement pattern, honouring a preference order. */
export function pickForPattern(pattern: MovementPattern, equipment: Equipment[], used: Set<string>): ExerciseDef | undefined {
  const candidates = availableExercises(equipment).filter((e) => e.pattern === pattern && !used.has(e.id));
  // Library order within a pattern is the preference order (free weights first, bodyweight last),
  // but prefer anything loadable over bodyweight.
  return candidates.find((e) => e.loadType !== 'bodyweight') ?? candidates[0];
}
