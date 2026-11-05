// Deterministic double-progression engine.
//
// The AI never decides training weights. Every weight recommendation comes from this
// function, based only on logged sets. That keeps advice reproducible and explainable.
import type { Decision } from '../../shared/types.ts';
import { floorToStep, formatKg, roundToStep } from './weights.ts';

export interface SetResult {
  weight: number;
  reps: number;
  rir: number | null;
}

export interface ProgressionInput {
  repMin: number;
  repMax: number;
  /** Prescribed number of working sets. */
  sets: number;
  /** Smallest available weight jump in kg; 0 means bodyweight / unloaded. */
  increment: number;
  /** Weight that was prescribed for the session being evaluated. */
  prescribedWeight: number;
  /** Completed sets of the session being evaluated. */
  session: SetResult[];
  /** Completed sets of the session before that (same exercise), if any. */
  previous?: SetResult[] | null;
}

export interface ProgressionResult {
  decision: Exclude<Decision, 'start' | 'deload'>;
  nextWeight: number;
  repTargets: number[];
  reason: string;
}

/** Weight used for most sets; ties resolve to the heavier weight. */
export function workingWeight(sets: SetResult[], fallback: number): number {
  if (sets.length === 0) return fallback;
  const counts = new Map<number, number>();
  for (const s of sets) counts.set(s.weight, (counts.get(s.weight) ?? 0) + 1);
  let best = fallback;
  let bestCount = 0;
  for (const [w, c] of counts) {
    if (c > bestCount || (c === bestCount && w > best)) {
      best = w;
      bestCount = c;
    }
  }
  return best;
}

const list = (nums: number[]) => nums.join(', ');

function setNumbers(indices: number[]): string {
  const n = indices.map((i) => i + 1);
  if (n.length === 1) return `Set ${n[0]}`;
  return `Sets ${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

function fill(n: number, value: number): number[] {
  return Array.from({ length: n }, () => value);
}

/** Sets below the rep minimum, or done with less than the working weight, count as misses. */
function misses(sets: SetResult[], weight: number, repMin: number): number[] {
  const out: number[] = [];
  sets.forEach((s, i) => {
    if (s.reps < repMin || s.weight < weight) out.push(i);
  });
  return out;
}

export function evaluateProgression(input: ProgressionInput): ProgressionResult {
  const { repMin, repMax, sets, increment, session } = input;
  const range = `${repMin}–${repMax}`;

  if (session.length === 0) {
    return {
      decision: 'hold',
      nextWeight: input.prescribedWeight,
      repTargets: fill(sets, repMin),
      reason: 'No sets were logged, so the target stays the same.',
    };
  }

  const weight = workingWeight(session, input.prescribedWeight);
  const reps = session.map((s) => s.reps);
  const rirs = session.map((s) => s.rir).filter((r): r is number => r !== null);
  const minRir = rirs.length ? Math.min(...rirs) : null;
  const completedAll = session.length >= sets;
  const allAtTop = completedAll && session.every((s) => s.weight >= weight && s.reps >= repMax);
  const missed = misses(session, weight, repMin);
  const nextRepTargets = () =>
    Array.from({ length: sets }, (_, i) => {
      const done = session[i]?.reps ?? repMin - 1;
      return Math.min(repMax, Math.max(repMin, done + 1));
    });

  // Unloaded exercises progress by reps only.
  if (increment === 0) {
    if (allAtTop) {
      return {
        decision: 'reps',
        nextWeight: weight,
        repTargets: fill(sets, repMax),
        reason: `All sets reached ${repMax} reps (${list(reps)}). Make it harder: add load, slow the tempo or switch to a harder variation.`,
      };
    }
    return {
      decision: 'hold',
      nextWeight: weight,
      repTargets: nextRepTargets(),
      reason: `Not every set reached ${repMax} reps yet (${list(reps)}). Aim for one more rep per set.`,
    };
  }

  if (allAtTop) {
    if (minRir === 0) {
      return {
        decision: 'hold',
        nextWeight: weight,
        repTargets: fill(sets, repMax),
        reason: `You reached ${repMax} reps on every set (${list(reps)}), but at least one set went to failure. Repeat ${formatKg(weight)} and hit the same reps with 1–2 reps in reserve before adding weight.`,
      };
    }
    const clearlyEasy = session.every((s) => s.reps >= repMax + 2) && (minRir === null || minRir >= 2);
    const steps = clearlyEasy ? 2 : 1;
    const next = roundToStep(weight + steps * increment, increment);
    const reserve = minRir !== null ? ` with at least ${minRir} reps in reserve` : '';
    return {
      decision: 'increase',
      nextWeight: next,
      repTargets: fill(sets, repMin),
      reason: clearlyEasy
        ? `Every set went well past the top of the ${range} range (${list(reps)})${reserve}. Jump two steps: ${formatKg(weight)} → ${formatKg(next)}, and build back up from ${repMin} reps.`
        : `All ${sets} sets reached the top of the ${range} range (${list(reps)})${reserve}. Increase from ${formatKg(weight)} to ${formatKg(next)} and build back up from ${repMin} reps.`,
    };
  }

  if (missed.length > 0) {
    const avgReps = reps.reduce((a, b) => a + b, 0) / reps.length;
    const prev = input.previous ?? [];
    const prevWeight = workingWeight(prev, weight);
    const missedBefore = prev.length > 0 && prevWeight === weight && misses(prev, weight, repMin).length > 0;
    const clearlyTooHeavy = avgReps < repMin - 1;

    if (missedBefore || clearlyTooHeavy) {
      const next = Math.min(floorToStep(weight * 0.9, increment), roundToStep(weight - increment, increment));
      return {
        decision: 'decrease',
        nextWeight: Math.max(0, next),
        repTargets: fill(sets, repMin + 1 <= repMax ? repMin + 1 : repMin),
        reason: clearlyTooHeavy
          ? `Reps were well below the ${range} range (${list(reps)}), so ${formatKg(weight)} is too heavy for now. Drop to ${formatKg(next)} and rebuild with solid reps.`
          : `Second session in a row below ${repMin} reps at ${formatKg(weight)} (${list(reps)}). Drop to ${formatKg(next)} to build back up with good technique.`,
      };
    }

    return {
      decision: 'hold',
      nextWeight: weight,
      repTargets: nextRepTargets(),
      reason: `${setNumbers(missed)} fell short of ${repMin} reps (${list(reps)}). Stay at ${formatKg(weight)}; if it happens again next session, the weight goes down.`,
    };
  }

  if (!completedAll) {
    return {
      decision: 'hold',
      nextWeight: weight,
      repTargets: nextRepTargets(),
      reason: `Only ${session.length} of ${sets} sets were done. Stay at ${formatKg(weight)} and complete all sets.`,
    };
  }

  const shortOfTop = session.map((s, i) => (s.reps < repMax ? i : -1)).filter((i) => i >= 0);
  const targets = nextRepTargets();
  return {
    decision: 'hold',
    nextWeight: weight,
    repTargets: targets,
    reason: `${shortOfTop.length === session.length ? `No set reached ${repMax} yet` : `${setNumbers(shortOfTop)} didn't reach ${repMax} yet`} (${list(reps)}). Stay at ${formatKg(weight)} and aim for ${list(targets)}.`,
  };
}
