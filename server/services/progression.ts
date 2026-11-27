// Deterministic double-progression engine.
//
// The AI never decides training weights. Every weight recommendation comes from this
// function, based only on logged sets. That keeps advice reproducible and explainable.
import type { Decision } from '../../shared/types.ts';
import { formatKg, setNumbers, loc, type Lang, type Localized } from '../i18n.ts';
import { floorToStep, roundToStep } from './weights.ts';

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
  /** Why, in plain language; stored with both languages. */
  reason: Localized;
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

const list = (nums: number[]) => nums.join('/');
const en: Lang = 'en';
const nl: Lang = 'nl';
const kg = (w: number) => ({ en: formatKg(w, en), nl: formatKg(w, nl) });

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
      reason: loc('No sets were logged, so the target stays the same.', 'Er zijn geen sets gelogd, dus het doel blijft hetzelfde.'),
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
        reason: loc(
          `Every set reached ${repMax} reps (${list(reps)}). Make it harder: add weight, slow the tempo or pick a harder variation.`,
          `Alle sets haalden ${repMax} herhalingen (${list(reps)}). Maak het zwaarder: voeg gewicht toe, train langzamer of kies een zwaardere variant.`,
        ),
      };
    }
    return {
      decision: 'hold',
      nextWeight: weight,
      repTargets: nextRepTargets(),
      reason: loc(
        `Not every set reached ${repMax} reps yet (${list(reps)}). Aim for one more rep per set.`,
        `Nog niet elke set haalde ${repMax} herhalingen (${list(reps)}). Mik op één herhaling meer per set.`,
      ),
    };
  }

  if (allAtTop) {
    if (minRir === 0) {
      return {
        decision: 'hold',
        nextWeight: weight,
        repTargets: fill(sets, repMax),
        reason: loc(
          `You hit ${repMax} reps in every set (${list(reps)}), but at least one set went to failure. Repeat ${kg(weight).en} and get the same reps with 1–2 in reserve before the weight goes up.`,
          `Je haalde ${repMax} herhalingen in elke set (${list(reps)}), maar minstens één set ging tot falen. Herhaal ${kg(weight).nl} en haal dezelfde herhalingen met 1–2 over voordat het gewicht omhoog gaat.`,
        ),
      };
    }
    const clearlyEasy = session.every((s) => s.reps >= repMax + 2) && (minRir === null || minRir >= 2);
    const steps = clearlyEasy ? 2 : 1;
    const next = roundToStep(weight + steps * increment, increment);
    const reserve =
      minRir !== null
        ? { en: ` with at least ${minRir} rep${minRir === 1 ? '' : 's'} in reserve`, nl: ` met minstens ${minRir} herhaling${minRir === 1 ? '' : 'en'} over` }
        : { en: '', nl: '' };
    return {
      decision: 'increase',
      nextWeight: next,
      repTargets: fill(sets, repMin),
      reason: clearlyEasy
        ? loc(
            `Every set went well past ${range} reps (${list(reps)})${reserve.en}. Two steps up: ${kg(weight).en} → ${kg(next).en}, and build back up from ${repMin} reps.`,
            `Elke set ging ruim boven de ${range} herhalingen (${list(reps)})${reserve.nl}. Twee stappen omhoog: ${kg(weight).nl} → ${kg(next).nl}, en bouw weer op vanaf ${repMin} herhalingen.`,
          )
        : loc(
            `All ${sets} sets reached the top of ${range} reps (${list(reps)})${reserve.en}. Up from ${kg(weight).en} to ${kg(next).en}; build back up from ${repMin} reps.`,
            `Alle ${sets} sets haalden de bovenkant van ${range} herhalingen (${list(reps)})${reserve.nl}. Omhoog van ${kg(weight).nl} naar ${kg(next).nl} en bouw weer op vanaf ${repMin} herhalingen.`,
          ),
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
          ? loc(
              `The reps were well below ${range} (${list(reps)}), so ${kg(weight).en} is too heavy for now. Go to ${kg(next).en} and build back up with good reps.`,
              `De herhalingen lagen ruim onder ${range} (${list(reps)}), dus ${kg(weight).nl} is nu te zwaar. Ga naar ${kg(next).nl} en bouw weer op met goede herhalingen.`,
            )
          : loc(
              `Second session in a row below ${repMin} reps at ${kg(weight).en} (${list(reps)}). Go to ${kg(next).en} and build back up with good technique.`,
              `Tweede training op rij onder ${repMin} herhalingen op ${kg(weight).nl} (${list(reps)}). Ga naar ${kg(next).nl} en bouw weer op met goede techniek.`,
            ),
      };
    }

    return {
      decision: 'hold',
      nextWeight: weight,
      repTargets: nextRepTargets(),
      reason: loc(
        `${setNumbers(missed, en)} stayed below ${repMin} reps (${list(reps)}). Stay at ${kg(weight).en}; if it happens again next session, the weight goes down.`,
        `${setNumbers(missed, nl)} bleef onder ${repMin} herhalingen (${list(reps)}). Blijf op ${kg(weight).nl}; gebeurt dat de volgende training weer, dan gaat het gewicht omlaag.`,
      ),
    };
  }

  if (!completedAll) {
    return {
      decision: 'hold',
      nextWeight: weight,
      repTargets: nextRepTargets(),
      reason: loc(
        `You did ${session.length} of ${sets} sets. Stay at ${kg(weight).en} and finish all sets.`,
        `Je deed ${session.length} van de ${sets} sets. Blijf op ${kg(weight).nl} en maak alle sets af.`,
      ),
    };
  }

  const shortOfTop = session.map((s, i) => (s.reps < repMax ? i : -1)).filter((i) => i >= 0);
  const targets = nextRepTargets();
  return {
    decision: 'hold',
    nextWeight: weight,
    repTargets: targets,
    reason: loc(
      `${shortOfTop.length === session.length ? `No set reached ${repMax} yet` : `${setNumbers(shortOfTop, en)} did not reach ${repMax} yet`} (${list(reps)}). Stay at ${kg(weight).en} and aim for ${list(targets)}.`,
      `${shortOfTop.length === session.length ? `Nog geen set haalde ${repMax}` : `${setNumbers(shortOfTop, nl)} haalde${shortOfTop.length === 1 ? '' : 'n'} ${repMax} nog niet`} (${list(reps)}). Blijf op ${kg(weight).nl} en mik op ${list(targets)}.`,
    ),
  };
}
