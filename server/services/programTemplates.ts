// Rule-based program builder. Used when no AI is configured or the AI response is unusable,
// so the app always works.
import type { ExerciseDef, Goal, MovementPattern, Profile } from '../../shared/types.ts';
import { NO_PREFS, pickForPattern, type Prefs } from './exercises.ts';
import { encode, loc, type Localized } from '../i18n.ts';
import type { ProgramDraft, ProgramDraftExercise } from './programs.ts';
import { heuristicStartWeight } from './weights.ts';

type DayTemplate = { name: Localized; focus: Localized; patterns: MovementPattern[] };

// Patterns are listed in priority order; sessions are trimmed from the end when time is short.
const FULL_A: DayTemplate = { name: loc('Full body A', 'Full body A'), focus: loc('Squat, horizontal push and pull', 'Squat, horizontaal duwen en trekken'), patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'shoulder_iso', 'biceps', 'triceps', 'core'] };
const FULL_B: DayTemplate = { name: loc('Full body B', 'Full body B'), focus: loc('Hip hinge, vertical push and pull', 'Heupscharnier, verticaal duwen en trekken'), patterns: ['hinge', 'vertical_push', 'vertical_pull', 'lunge', 'chest_iso', 'rear_delt', 'calf', 'core'] };
const FULL_C: DayTemplate = { name: loc('Full body C', 'Full body C'), focus: loc('Single leg, pressing and rowing', 'Eén been, drukken en roeien'), patterns: ['lunge', 'horizontal_push', 'vertical_pull', 'glute_iso', 'shoulder_iso', 'triceps', 'biceps', 'core'] };
const UPPER_A: DayTemplate = { name: loc('Upper A', 'Bovenlichaam A'), focus: loc('Chest, back, shoulders, arms', 'Borst, rug, schouders, armen'), patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'shoulder_iso', 'triceps', 'biceps'] };
const LOWER_A: DayTemplate = { name: loc('Lower A', 'Onderlichaam A'), focus: loc('Quads, hamstrings, calves', 'Quadriceps, hamstrings, kuiten'), patterns: ['squat', 'hinge', 'lunge', 'hamstring_iso', 'calf', 'core'] };
const UPPER_B: DayTemplate = { name: loc('Upper B', 'Bovenlichaam B'), focus: loc('Back, shoulders, chest, arms', 'Rug, schouders, borst, armen'), patterns: ['vertical_pull', 'vertical_push', 'horizontal_pull', 'horizontal_push', 'rear_delt', 'biceps', 'triceps'] };
const LOWER_B: DayTemplate = { name: loc('Lower B', 'Onderlichaam B'), focus: loc('Hip hinge, glutes, quads', 'Heupscharnier, billen, quadriceps'), patterns: ['hinge', 'squat', 'glute_iso', 'quad_iso', 'calf', 'core'] };
const PUSH: DayTemplate = { name: loc('Push', 'Duwen'), focus: loc('Chest, shoulders, triceps', 'Borst, schouders, triceps'), patterns: ['horizontal_push', 'vertical_push', 'chest_iso', 'shoulder_iso', 'triceps', 'core'] };
const PULL: DayTemplate = { name: loc('Pull', 'Trekken'), focus: loc('Back, rear delts, biceps', 'Rug, achterkant schouders, biceps'), patterns: ['vertical_pull', 'horizontal_pull', 'rear_delt', 'biceps', 'core'] };
const LEGS: DayTemplate = { name: loc('Legs', 'Benen'), focus: loc('Quads, hamstrings, glutes, calves', 'Quadriceps, hamstrings, billen, kuiten'), patterns: ['squat', 'hinge', 'lunge', 'quad_iso', 'hamstring_iso', 'calf'] };

export function splitFor(days: number): { label: Localized; days: DayTemplate[] } {
  switch (days) {
    case 1:
      return { label: loc('Full body', 'Full body'), days: [FULL_A] };
    case 2:
      return { label: loc('Full body A/B', 'Full body A/B'), days: [FULL_A, FULL_B] };
    case 3:
      return { label: loc('Full body A/B/C', 'Full body A/B/C'), days: [FULL_A, FULL_B, FULL_C] };
    case 4:
      return { label: loc('Upper/lower', 'Boven/onder'), days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] };
    case 5:
      return { label: loc('Upper/lower + push/pull/legs', 'Boven/onder + duwen/trekken/benen'), days: [UPPER_A, LOWER_A, PUSH, PULL, LEGS] };
    default:
      return {
        label: loc('Push/pull/legs ×2', 'Duwen/trekken/benen ×2'),
        days: [PUSH, PULL, LEGS, { ...PUSH, name: loc('Push B', 'Duwen B') }, { ...PULL, name: loc('Pull B', 'Trekken B') }, { ...LEGS, name: loc('Legs B', 'Benen B') }],
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
export function supersetRest(goal: Goal): number {
  return { strength: 150, hypertrophy: 90, fat_loss: 75, conditioning: 60 }[goal];
}

const GOAL_LABEL: Record<'en' | 'nl', Record<Goal, string>> = {
  en: { hypertrophy: 'muscle growth', strength: 'strength', conditioning: 'conditioning', fat_loss: 'fat loss' },
  nl: { hypertrophy: 'spiermassa', strength: 'kracht', conditioning: 'conditie', fat_loss: 'vetverlies' },
};

export function buildTemplateProgram(profile: Profile, prefs: Prefs = NO_PREFS): ProgramDraft {
  const split = splitFor(profile.trainingDays);
  const perSession = exercisesPerSession(profile.sessionMinutes);
  const deload = profile.level === 'beginner' ? null : 6;

  const supersets = useSupersets(profile.sessionMinutes);

  const days = split.days.map((t) => {
    const used = new Set<string>();
    const picked: ExerciseDef[] = [];
    for (const pattern of t.patterns) {
      if (picked.length >= perSession) break;
      const ex: ExerciseDef | undefined = pickForPattern(pattern, profile.equipment, used, prefs);
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
    // Stored with both languages; the program is shown in the profile's language.
    return { name: encode(t.name), focus: encode(t.focus), exercises };
  });

  const d = profile.trainingDays;
  const rounds = 6;
  const total = rounds * d;
  const deloadFrom = total - d + 1;
  const deloadRange = d === 1 ? `${total}` : `${deloadFrom}–${total}`;
  return {
    name: encode(loc(`${split.label.en} for ${GOAL_LABEL.en[profile.goal]}`, `${split.label.nl} voor ${GOAL_LABEL.nl[profile.goal]}`)),
    rounds,
    deloadRound: deload ? rounds : null,
    source: 'template',
    rationale: encode(
      loc(
        `${split.label.en}: ${d} training ${d === 1 ? 'day' : 'days'} in rotation, about ${perSession} exercises per session. ` +
          `The block is ${total} workouts (${rounds} rounds through the days); train as often as suits your week, the next workout is always the next day. ` +
          'Compound lifts come first, while you are fresh; weights go up with double progression.' +
          (supersets ? ' Exercises are paired into supersets of opposing muscle groups so the session fits the time: one set of each, then rest.' : '') +
          (deload ? ` Workout${d === 1 ? '' : 's'} ${deloadRange} ${d === 1 ? 'is a lighter deload' : 'are a lighter deload'} to recover before the next block.` : ''),
        `${split.label.nl}: ${d} ${d === 1 ? 'trainingsdag' : 'trainingsdagen'} die rouleren, ongeveer ${perSession} oefeningen per training. ` +
          `Het blok is ${total} trainingen (${rounds} rondes door de dagen); train zo vaak als in je week past, de volgende training is altijd de volgende dag. ` +
          'Samengestelde oefeningen komen eerst, als je nog fris bent; de gewichten gaan omhoog met double progression.' +
          (supersets ? ' Oefeningen zijn gekoppeld tot supersets van tegengestelde spiergroepen, zodat de training in de tijd past: één set van elk, dan rust.' : '') +
          (deload ? ` Training ${deloadRange} ${d === 1 ? 'is een lichtere deload' : 'zijn een lichtere deload'} om te herstellen voor het volgende blok.` : ''),
      ),
    ),
    days,
  };
}
