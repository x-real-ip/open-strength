import type { Decision, ExerciseDef, Profile, Program, ProgramDay, ProgramExercise, Target } from '../../shared/types.ts';
import { all, getPool, nowIso, one, run, tx, type Queryable } from '../db.ts';
import { alternativesFor, getExercise } from './exercises.ts';
import { clampStartWeight, e1rm, floorToStep, formatKg, incrementFor } from './weights.ts';
import { workingWeight } from './progression.ts';

export interface ProgramDraftExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  startWeight?: number;
  notes?: string;
  /** Same label on neighbouring exercises makes a superset; see normalizeSupersets. */
  superset?: string | null;
}

export interface ProgramDraft {
  name: string;
  weeks: number;
  deloadWeek: number | null;
  source: 'ai' | 'template';
  rationale: string;
  days: { name: string; focus: string; exercises: ProgramDraftExercise[] }[];
}

type Row = Record<string, any>;

const MAX_SUPERSET = 3;

/**
 * Makes superset labels consistent: only runs of neighbouring exercises with the same
 * label count, a run has 2–3 exercises (longer runs are split, single exercises lose the
 * label) and runs are relabelled A, B, C in order. Works for AI output and templates alike.
 */
export function normalizeSupersets<T extends { superset?: string | null }>(exercises: T[]): (T & { superset: string | null })[] {
  const runs: T[][] = [];
  let prev: string | null = null;
  for (const e of exercises) {
    const label = e.superset?.trim().toUpperCase() || null;
    if (label && label === prev) runs[runs.length - 1].push(e);
    else runs.push([e]);
    prev = label;
  }

  const groups: { items: T[]; superset: boolean }[] = [];
  for (const run of runs) {
    if (run.length < 2 || !run[0].superset?.trim()) {
      for (const e of run) groups.push({ items: [e], superset: false });
      continue;
    }
    for (let i = 0; i < run.length; i += 2) {
      const chunk = run.slice(i, i + 2);
      // A trailing single exercise joins the previous pair when that stays within the limit.
      if (chunk.length === 1 && groups.length && groups[groups.length - 1].superset && groups[groups.length - 1].items.length < MAX_SUPERSET) {
        groups[groups.length - 1].items.push(chunk[0]);
      } else {
        groups.push({ items: chunk, superset: chunk.length > 1 });
      }
    }
  }

  let next = 0;
  return groups.flatMap((g) => {
    const label = g.superset ? String.fromCharCode(65 + next++) : null;
    return g.items.map((e) => ({ ...e, superset: label }));
  });
}

export function weekFor(completed: number, daysPerWeek: number): number {
  return Math.floor(completed / Math.max(1, daysPerWeek)) + 1;
}

export interface SessionSets {
  workoutId: number;
  date: string;
  sets: { weight: number; reps: number; rir: number | null }[];
}

/** Most recent completed, non-deload session for an exercise, across all programs. */
export async function lastSessionSets(exerciseId: string, beforeWorkoutId?: number, db: Queryable = getPool()): Promise<SessionSets | null> {
  const workout = await one<{ id: number; finished_at: string }>(
    `SELECT w.id, w.finished_at FROM workouts w
     WHERE w.status = 'completed' AND NOT w.is_deload
       AND EXISTS (SELECT 1 FROM workout_sets s WHERE s.workout_id = w.id AND s.exercise_id = $1 AND s.completed)
       AND ($2::int IS NULL OR w.id < $2::int)
     ORDER BY w.finished_at DESC LIMIT 1`,
    [exerciseId, beforeWorkoutId ?? null],
    db,
  );
  if (!workout) return null;
  const sets = await all<{ weight: number; reps: number; rir: number | null }>(
    'SELECT weight, reps, rir FROM workout_sets WHERE workout_id = $1 AND exercise_id = $2 AND completed ORDER BY set_index',
    [workout.id, exerciseId],
    db,
  );
  return { workoutId: workout.id, date: workout.finished_at, sets };
}

/** Latest engine target for an exercise in any program, with the rep range it was made for. */
async function latestTargetFor(exerciseId: string, db: Queryable) {
  return one<{ weight: number; rep_targets: number[]; decision: Decision; reason: string; rep_min: number; rep_max: number }>(
    `SELECT t.weight, t.rep_targets, t.decision, t.reason, pe.rep_min, pe.rep_max
     FROM exercise_targets t JOIN program_exercises pe ON pe.id = t.program_exercise_id
     WHERE pe.exercise_id = $1 AND t.source_workout_id IS NOT NULL
     ORDER BY t.updated_at DESC LIMIT 1`,
    [exerciseId],
    db,
  );
}

/**
 * Initial target for an exercise in a new program. Logged history always wins over AI or
 * heuristic estimates, so a new program never resets or inflates your weights.
 */
export async function initialTarget(ex: ExerciseDef, d: ProgramDraftExercise, profile: Profile, db: Queryable = getPool()): Promise<Omit<Target, 'updatedAt'>> {
  const step = incrementFor(ex.loadType, profile.increments);
  const fresh = Array.from({ length: d.sets }, () => d.repMin);

  if (step === 0) {
    const last = await lastSessionSets(ex.id, undefined, db);
    if (last && last.sets.length) {
      const best = Math.max(...last.sets.map((s) => s.reps));
      const target = Math.min(d.repMax, Math.max(d.repMin, best));
      return { weight: 0, repTargets: Array.from({ length: d.sets }, () => target), decision: 'start', reason: `Based on your last session (best set ${best} reps).` };
    }
    return { weight: 0, repTargets: fresh, decision: 'start', reason: 'Bodyweight exercise: progress by adding reps.' };
  }

  const prior = await latestTargetFor(ex.id, db);
  if (prior && prior.rep_min === d.repMin && prior.rep_max === d.repMax) {
    const reps = prior.rep_targets;
    const repTargets = Array.from({ length: d.sets }, (_, i) => reps[i] ?? reps[reps.length - 1] ?? d.repMin);
    return { weight: prior.weight, repTargets, decision: 'start', reason: `Carried over from your previous program: ${formatKg(prior.weight)}.` };
  }

  const last = await lastSessionSets(ex.id, undefined, db);
  if (last && last.sets.length) {
    const best = Math.max(...last.sets.map((s) => e1rm(s.weight, s.reps)));
    // Weight at which the top of the new range would be roughly a max effort; the bottom of the range then has reserve.
    const weight = Math.max(step, floorToStep(best / (1 + d.repMax / 30), step));
    const used = workingWeight(last.sets, 0);
    return {
      weight,
      repTargets: fresh,
      decision: 'start',
      reason: `Estimated from your last session (${formatKg(used)}, est. 1RM ${formatKg(Math.round(best))}) for the new ${d.repMin}–${d.repMax} rep range.`,
    };
  }

  return {
    weight: clampStartWeight(d.startWeight, ex, profile),
    repTargets: fresh,
    decision: 'start',
    reason: 'Starting estimate. Pick a weight you can do with good form and 2–3 reps in reserve; the app adjusts after your first session.',
  };
}

export async function saveProgram(draft: ProgramDraft, profile: Profile): Promise<number> {
  return tx(async (c) => {
    await run("UPDATE programs SET status = 'archived' WHERE status = 'active'", [], c);
    const ts = nowIso();
    const program = await one<{ id: number }>(
      'INSERT INTO programs (name, weeks, deload_week, source, rationale, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [draft.name, draft.weeks, draft.deloadWeek, draft.source, draft.rationale, 'active', ts],
      c,
    );
    const programId = program!.id;

    for (const [dayIndex, day] of draft.days.entries()) {
      const d = await one<{ id: number }>('INSERT INTO program_days (program_id, day_index, name, focus) VALUES ($1, $2, $3, $4) RETURNING id', [programId, dayIndex, day.name, day.focus], c);
      const known = normalizeSupersets(day.exercises.filter((e) => getExercise(e.exerciseId)));
      for (const [position, e] of known.entries()) {
        const def = getExercise(e.exerciseId)!;
        const pe = await one<{ id: number }>(
          'INSERT INTO program_exercises (program_day_id, position, exercise_id, sets, rep_min, rep_max, rest_seconds, notes, superset) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
          [d!.id, position, def.id, e.sets, e.repMin, e.repMax, e.restSeconds, e.notes ?? '', e.superset],
          c,
        );
        const t = await initialTarget(def, e, profile, c);
        await run(
          'INSERT INTO exercise_targets (program_exercise_id, weight, rep_targets, decision, reason, source_workout_id, updated_at) VALUES ($1, $2, $3, $4, $5, NULL, $6)',
          [pe!.id, t.weight, JSON.stringify(t.repTargets), t.decision, t.reason, ts],
          c,
        );
      }
    }
    return programId;
  });
}

function mapExercise(r: Row, profile: Profile | null): ProgramExercise {
  const def = getExercise(String(r.exercise_id));
  const loadType = def?.loadType ?? 'bodyweight';
  return {
    id: r.id,
    exerciseId: r.exercise_id,
    name: def?.name ?? r.exercise_id,
    primary: def?.primary ?? 'core',
    loadType,
    weightNote: def?.weightNote,
    position: r.position,
    sets: r.sets,
    repMin: r.rep_min,
    repMax: r.rep_max,
    restSeconds: r.rest_seconds,
    notes: r.notes ?? '',
    increment: profile ? incrementFor(loadType, profile.increments) : 0,
    superset: r.superset ?? null,
    target:
      r.t_weight === null || r.t_weight === undefined
        ? null
        : { weight: r.t_weight, repTargets: r.t_rep_targets, decision: r.t_decision as Decision, reason: r.t_reason, updatedAt: r.t_updated_at },
  };
}

export async function loadProgram(id: number, profile: Profile | null): Promise<Program | null> {
  const p = await one('SELECT * FROM programs WHERE id = $1', [id]);
  if (!p) return null;
  const days = await all('SELECT * FROM program_days WHERE program_id = $1 ORDER BY day_index', [id]);
  const exercises = await all(
    `SELECT pe.*, t.weight AS t_weight, t.rep_targets AS t_rep_targets, t.decision AS t_decision, t.reason AS t_reason, t.updated_at AS t_updated_at
     FROM program_exercises pe
     JOIN program_days d ON d.id = pe.program_day_id
     LEFT JOIN exercise_targets t ON t.program_exercise_id = pe.id
     WHERE d.program_id = $1 ORDER BY pe.position`,
    [id],
  );
  const completed = (await one<{ n: number }>("SELECT count(*)::int AS n FROM workouts WHERE program_id = $1 AND status = 'completed'", [id]))!.n;
  const mappedDays: ProgramDay[] = days.map((d) => ({
    id: d.id,
    dayIndex: d.day_index,
    name: d.name,
    focus: d.focus,
    exercises: exercises.filter((e) => e.program_day_id === d.id).map((r) => mapExercise(r, profile)),
  }));
  const weeks = p.weeks;
  const currentWeek = weekFor(completed, mappedDays.length);
  return {
    id: p.id,
    name: p.name,
    weeks,
    deloadWeek: p.deload_week,
    source: p.source,
    rationale: p.rationale,
    status: p.status,
    createdAt: p.created_at,
    days: mappedDays,
    completedWorkouts: completed,
    currentWeek: Math.min(currentWeek, weeks),
    isComplete: currentWeek > weeks,
  };
}

export async function activeProgramId(): Promise<number | null> {
  return (await one<{ id: number }>("SELECT id FROM programs WHERE status = 'active' ORDER BY id DESC LIMIT 1"))?.id ?? null;
}

export async function getProgramExercise(peId: number) {
  return one<Row & { program_id: number }>(
    'SELECT pe.*, pd.program_id FROM program_exercises pe JOIN program_days pd ON pd.id = pe.program_day_id WHERE pe.id = $1',
    [peId],
  );
}

export async function exerciseAlternatives(peId: number, profile: Profile) {
  const pe = await getProgramExercise(peId);
  if (!pe) return [];
  const inDay = (await all<{ exercise_id: string }>('SELECT exercise_id FROM program_exercises WHERE program_day_id = $1', [pe.program_day_id])).map((r) => r.exercise_id);
  return alternativesFor(pe.exercise_id, profile.equipment, inDay).slice(0, 8);
}

/** Swap an exercise in the program; sets/reps stay, the target is re-derived from history. */
export async function replaceExercise(peId: number, exerciseId: string, profile: Profile) {
  const pe = await getProgramExercise(peId);
  const def = getExercise(exerciseId);
  if (!pe || !def) throw Object.assign(new Error('Unknown exercise'), { status: 404 });
  await tx(async (c) => {
    await run('UPDATE program_exercises SET exercise_id = $1, notes = $2 WHERE id = $3', [def.id, '', peId], c);
    const t = await initialTarget(def, { exerciseId: def.id, sets: pe.sets, repMin: pe.rep_min, repMax: pe.rep_max, restSeconds: pe.rest_seconds }, profile, c);
    await run(
      `INSERT INTO exercise_targets (program_exercise_id, weight, rep_targets, decision, reason, source_workout_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, NULL, $6)
       ON CONFLICT (program_exercise_id) DO UPDATE SET weight = excluded.weight, rep_targets = excluded.rep_targets,
         decision = excluded.decision, reason = excluded.reason, source_workout_id = NULL, updated_at = excluded.updated_at`,
      [peId, t.weight, JSON.stringify(t.repTargets), t.decision, t.reason, nowIso()],
      c,
    );
  });
}

/** Manual weight override from the program screen (e.g. the gym lacks a dumbbell size). */
export async function setTargetWeight(peId: number, weight: number) {
  await run(`UPDATE exercise_targets SET weight = $1, decision = 'hold', reason = $2, updated_at = $3 WHERE program_exercise_id = $4`, [
    weight,
    `Set manually to ${formatKg(weight)}.`,
    nowIso(),
    peId,
  ]);
}
