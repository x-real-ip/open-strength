// Rule-based program builder. Used when no AI is configured or the AI response is unusable,
// so the app always works.
import type { ExerciseDef, Goal, MovementPattern, Profile } from '../../shared/types.ts';
import { pickForPattern } from './exercises.ts';
import type { ProgramDraft, ProgramDraftExercise } from './programs.ts';
import { heuristicStartWeight } from './weights.ts';

type DayTemplate = { name: string; focus: string; patterns: MovementPattern[] };

// Patterns are listed in priority order; sessions are trimmed from the end when time is short.
const FULL_A: DayTemplate = { name: 'Full body A', focus: 'Squat, horizontaal duwen en trekken', patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'shoulder_iso', 'biceps', 'triceps', 'core'] };
const FULL_B: DayTemplate = { name: 'Full body B', focus: 'Heupscharnier, verticaal duwen en trekken', patterns: ['hinge', 'vertical_push', 'vertical_pull', 'lunge', 'chest_iso', 'rear_delt', 'calf', 'core'] };
const FULL_C: DayTemplate = { name: 'Full body C', focus: 'Eén been, drukken en roeien', patterns: ['lunge', 'horizontal_push', 'vertical_pull', 'glute_iso', 'shoulder_iso', 'triceps', 'biceps', 'core'] };
const UPPER_A: DayTemplate = { name: 'Bovenlichaam A', focus: 'Borst, rug, schouders, armen', patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'shoulder_iso', 'triceps', 'biceps'] };
const LOWER_A: DayTemplate = { name: 'Onderlichaam A', focus: 'Quadriceps, hamstrings, kuiten', patterns: ['squat', 'hinge', 'lunge', 'hamstring_iso', 'calf', 'core'] };
const UPPER_B: DayTemplate = { name: 'Bovenlichaam B', focus: 'Rug, schouders, borst, armen', patterns: ['vertical_pull', 'vertical_push', 'horizontal_pull', 'horizontal_push', 'rear_delt', 'biceps', 'triceps'] };
const LOWER_B: DayTemplate = { name: 'Onderlichaam B', focus: 'Heupscharnier, billen, quadriceps', patterns: ['hinge', 'squat', 'glute_iso', 'quad_iso', 'calf', 'core'] };
const PUSH: DayTemplate = { name: 'Duwen', focus: 'Borst, schouders, triceps', patterns: ['horizontal_push', 'vertical_push', 'chest_iso', 'shoulder_iso', 'triceps', 'core'] };
const PULL: DayTemplate = { name: 'Trekken', focus: 'Rug, achterkant schouders, biceps', patterns: ['vertical_pull', 'horizontal_pull', 'rear_delt', 'biceps', 'core'] };
const LEGS: DayTemplate = { name: 'Benen', focus: 'Quadriceps, hamstrings, billen, kuiten', patterns: ['squat', 'hinge', 'lunge', 'quad_iso', 'hamstring_iso', 'calf'] };

function splitFor(days: number): { label: string; days: DayTemplate[] } {
  switch (days) {
    case 1:
      return { label: 'Full body', days: [FULL_A] };
    case 2:
      return { label: 'Full body A/B', days: [FULL_A, FULL_B] };
    case 3:
      return { label: 'Full body A/B/C', days: [FULL_A, FULL_B, FULL_C] };
    case 4:
      return { label: 'Boven/onder', days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] };
    case 5:
      return { label: 'Boven/onder + duwen/trekken/benen', days: [UPPER_A, LOWER_A, PUSH, PULL, LEGS] };
    default:
      return {
        label: 'Duwen/trekken/benen ×2',
        days: [PUSH, PULL, LEGS, { ...PUSH, name: 'Duwen B' }, { ...PULL, name: 'Trekken B' }, { ...LEGS, name: 'Benen B' }],
      };
  }
}

export function scheme(goal: Goal, compound: boolean, level: Profile['level']) {
  const maxSets = level === 'beginner' ? 3 : 4;
  switch (goal) {
    case 'strength':
      return compound ? { sets: Math.min(4, maxSets + 1), repMin: 4, repMax: 6, restSeconds: 180 } : { sets: 3, repMin: 8, repMax: 12, restSeconds: 90 };
    case 'hypertrophy':
      return compound ? { sets: Math.min(maxSets, 3), repMin: 8, repMax: 12, restSeconds: 120 } : { sets: 3, repMin: 10, repMax: 15, restSeconds: 75 };
    case 'conditioning':
      return { sets: 3, repMin: 12, repMax: 15, restSeconds: compound ? 60 : 45 };
    case 'fat_loss':
      return compound ? { sets: 3, repMin: 8, repMax: 12, restSeconds: 90 } : { sets: 3, repMin: 12, repMax: 15, restSeconds: 60 };
  }
}

/** Short sessions use supersets so a full-body day still fits in the time. */
export function useSupersets(minutes: number): boolean {
  return minutes <= 45;
}

export function exercisesPerSession(minutes: number): number {
  // Supersets fit about two exercises per 15 minutes; straight sets one per 10.
  if (useSupersets(minutes)) return Math.max(4, Math.min(8, 2 * Math.round(minutes / 15)));
  return Math.max(3, Math.min(8, Math.round(minutes / 10)));
}

type Region = 'lower' | 'push' | 'pull' | 'core';

const REGION: Record<MovementPattern, Region> = {
  squat: 'lower',
  lunge: 'lower',
  hinge: 'lower',
  quad_iso: 'lower',
  hamstring_iso: 'lower',
  glute_iso: 'lower',
  calf: 'lower',
  horizontal_push: 'push',
  vertical_push: 'push',
  chest_iso: 'push',
  shoulder_iso: 'push',
  triceps: 'push',
  horizontal_pull: 'pull',
  vertical_pull: 'pull',
  rear_delt: 'pull',
  biceps: 'pull',
  core: 'core',
};

/** How well two exercises pair in a superset: opposing muscles let one rest while the other works. */
function pairScore(a: Region, b: Region): number {
  if (a === b) return 0;
  if ((a === 'push' && b === 'pull') || (a === 'pull' && b === 'push')) return 3;
  if (a === 'core' || b === 'core') return 1;
  return 2; // lower body with upper body
}

/**
 * Orders a session into supersets of two non-competing exercises, keeping the priority
 * order of the first exercise in each pair. An exercise without a partner stays a straight set.
 */
export function pairIntoSupersets<T extends { pattern: MovementPattern }>(items: T[]): { item: T; superset: string | null }[] {
  const left = [...items];
  const out: { item: T; superset: string | null }[] = [];
  let label = 0;
  while (left.length) {
    const first = left.shift()!;
    let best = -1;
    let bestScore = 0;
    left.forEach((other, i) => {
      const score = pairScore(REGION[first.pattern], REGION[other.pattern]);
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    });
    if (best === -1) {
      out.push({ item: first, superset: null });
      continue;
    }
    const tag = String.fromCharCode(65 + label++);
    out.push({ item: first, superset: tag }, { item: left.splice(best, 1)[0], superset: tag });
  }
  return out;
}

/** Rest after a full superset round (both exercises), in seconds. */
function supersetRest(goal: Goal): number {
  return { strength: 150, hypertrophy: 90, fat_loss: 75, conditioning: 60 }[goal];
}

const GOAL_LABEL: Record<Goal, string> = {
  hypertrophy: 'spiermassa',
  strength: 'kracht',
  conditioning: 'conditie',
  fat_loss: 'vetverlies',
};

export function buildTemplateProgram(profile: Profile): ProgramDraft {
  const split = splitFor(profile.daysPerWeek);
  const perSession = exercisesPerSession(profile.sessionMinutes);
  const deload = profile.level === 'beginner' ? null : 6;

  const supersets = useSupersets(profile.sessionMinutes);

  const days = split.days.map((t) => {
    const used = new Set<string>();
    const picked: ExerciseDef[] = [];
    for (const pattern of t.patterns) {
      if (picked.length >= perSession) break;
      const ex: ExerciseDef | undefined = pickForPattern(pattern, profile.equipment, used);
      if (!ex) continue;
      used.add(ex.id);
      picked.push(ex);
    }
    const ordered = supersets ? pairIntoSupersets(picked) : picked.map((item) => ({ item, superset: null }));
    const exercises: ProgramDraftExercise[] = ordered.map(({ item: ex, superset }) => {
      const s = scheme(profile.goal, ex.compound, profile.level);
      return {
        exerciseId: ex.id,
        ...s,
        restSeconds: superset ? supersetRest(profile.goal) : s.restSeconds,
        startWeight: heuristicStartWeight(ex, profile),
        notes: '',
        superset,
      };
    });
    return { name: t.name, focus: t.focus, exercises };
  });

  return {
    name: `${split.label} voor ${GOAL_LABEL[profile.goal]}`,
    weeks: 6,
    deloadWeek: deload,
    source: 'template',
    rationale:
      `Schema ${split.label} voor ${profile.daysPerWeek} ${profile.daysPerWeek === 1 ? 'dag' : 'dagen'} per week, ongeveer ${perSession} oefeningen per training. ` +
      'Samengestelde oefeningen komen eerst, als je nog fris bent; de gewichten gaan omhoog met double progression.' +
      (supersets ? ' Oefeningen zijn gekoppeld tot supersets van tegengestelde spiergroepen, zodat de training in de tijd past: één set van elk, dan rust.' : '') +
      (deload ? ' Week 6 is een lichtere deloadweek om te herstellen voor het volgende blok.' : ''),
    days,
  };
}
