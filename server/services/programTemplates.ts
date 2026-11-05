// Rule-based program builder. Used when no AI is configured or the AI response is unusable,
// so the app always works.
import type { ExerciseDef, Goal, MovementPattern, Profile } from '../../shared/types.ts';
import { pickForPattern } from './exercises.ts';
import type { ProgramDraft, ProgramDraftExercise } from './programs.ts';
import { heuristicStartWeight } from './weights.ts';

type DayTemplate = { name: string; focus: string; patterns: MovementPattern[] };

// Patterns are listed in priority order; sessions are trimmed from the end when time is short.
const FULL_A: DayTemplate = { name: 'Full body A', focus: 'Squat, horizontal push and pull', patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'shoulder_iso', 'biceps', 'triceps', 'core'] };
const FULL_B: DayTemplate = { name: 'Full body B', focus: 'Hinge, vertical push and pull', patterns: ['hinge', 'vertical_push', 'vertical_pull', 'lunge', 'chest_iso', 'rear_delt', 'calf', 'core'] };
const FULL_C: DayTemplate = { name: 'Full body C', focus: 'Single leg, presses and rows', patterns: ['lunge', 'horizontal_push', 'vertical_pull', 'glute_iso', 'shoulder_iso', 'triceps', 'biceps', 'core'] };
const UPPER_A: DayTemplate = { name: 'Upper A', focus: 'Chest, back, shoulders, arms', patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'shoulder_iso', 'triceps', 'biceps'] };
const LOWER_A: DayTemplate = { name: 'Lower A', focus: 'Quads, hamstrings, calves', patterns: ['squat', 'hinge', 'lunge', 'hamstring_iso', 'calf', 'core'] };
const UPPER_B: DayTemplate = { name: 'Upper B', focus: 'Back, shoulders, chest, arms', patterns: ['vertical_pull', 'vertical_push', 'horizontal_pull', 'horizontal_push', 'rear_delt', 'biceps', 'triceps'] };
const LOWER_B: DayTemplate = { name: 'Lower B', focus: 'Hinge, glutes, quads', patterns: ['hinge', 'squat', 'glute_iso', 'quad_iso', 'calf', 'core'] };
const PUSH: DayTemplate = { name: 'Push', focus: 'Chest, shoulders, triceps', patterns: ['horizontal_push', 'vertical_push', 'chest_iso', 'shoulder_iso', 'triceps', 'core'] };
const PULL: DayTemplate = { name: 'Pull', focus: 'Back, rear delts, biceps', patterns: ['vertical_pull', 'horizontal_pull', 'rear_delt', 'biceps', 'core'] };
const LEGS: DayTemplate = { name: 'Legs', focus: 'Quads, hamstrings, glutes, calves', patterns: ['squat', 'hinge', 'lunge', 'quad_iso', 'hamstring_iso', 'calf'] };

function splitFor(days: number): { label: string; days: DayTemplate[] } {
  switch (days) {
    case 1:
      return { label: 'Full body', days: [FULL_A] };
    case 2:
      return { label: 'Full body A/B', days: [FULL_A, FULL_B] };
    case 3:
      return { label: 'Full body A/B/C', days: [FULL_A, FULL_B, FULL_C] };
    case 4:
      return { label: 'Upper/lower', days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] };
    case 5:
      return { label: 'Upper/lower + push/pull/legs', days: [UPPER_A, LOWER_A, PUSH, PULL, LEGS] };
    default:
      return {
        label: 'Push/pull/legs ×2',
        days: [PUSH, PULL, LEGS, { ...PUSH, name: 'Push B' }, { ...PULL, name: 'Pull B' }, { ...LEGS, name: 'Legs B' }],
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

export function exercisesPerSession(minutes: number): number {
  return Math.max(3, Math.min(8, Math.round(minutes / 10)));
}

const GOAL_LABEL: Record<Goal, string> = {
  hypertrophy: 'muscle building',
  strength: 'strength',
  conditioning: 'conditioning',
  fat_loss: 'fat loss',
};

export function buildTemplateProgram(profile: Profile): ProgramDraft {
  const split = splitFor(profile.daysPerWeek);
  const perSession = exercisesPerSession(profile.sessionMinutes);
  const deload = profile.level === 'beginner' ? null : 6;

  const days = split.days.map((t) => {
    const used = new Set<string>();
    const exercises: ProgramDraftExercise[] = [];
    for (const pattern of t.patterns) {
      if (exercises.length >= perSession) break;
      const ex: ExerciseDef | undefined = pickForPattern(pattern, profile.equipment, used);
      if (!ex) continue;
      used.add(ex.id);
      const s = scheme(profile.goal, ex.compound, profile.level);
      exercises.push({ exerciseId: ex.id, ...s, startWeight: heuristicStartWeight(ex, profile), notes: '' });
    }
    return { name: t.name, focus: t.focus, exercises };
  });

  return {
    name: `${split.label} for ${GOAL_LABEL[profile.goal]}`,
    weeks: 6,
    deloadWeek: deload,
    source: 'template',
    rationale:
      `${split.label} split for ${profile.daysPerWeek} day${profile.daysPerWeek === 1 ? '' : 's'} a week, about ${perSession} exercises per session. ` +
      'Compound lifts come first while you are fresh; weights progress with double progression.' +
      (deload ? ' Week 6 is a lighter deload week to recover before the next block.' : ''),
    days,
  };
}
