import { z } from 'zod';
import type { Decision, ExerciseOutcome, Profile, TodayResponse, Workout, WorkoutExercise, WorkoutSummary } from '../../shared/types.ts';
import { all, nowIso, one, run, tx } from '../db.ts';
import { getExercise } from './exercises.ts';
import { evaluateProgression } from './progression.ts';
import { activeProgramId, lastSessionSets, loadProgram } from './programs.ts';
import { detectStalls } from './stats.ts';
import { e1rm, floorToStep, formatKg } from './weights.ts';

type Row = Record<string, any>;

export class NotFound extends Error {
  status = 404;
}

export function deloadPrescription(sets: number, weight: number, increment: number) {
  return { sets: Math.max(1, Math.round(sets * 0.6)), weight: increment > 0 ? floorToStep(weight * 0.9, increment) : weight };
}

const DELOAD_REASON = 'Deload week: fewer sets at about 90% of your working weight to recover. Progression resumes next week.';

export async function getToday(profile: Profile | null): Promise<TodayResponse> {
  const pid = await activeProgramId();
  const program = pid ? await loadProgram(pid, profile) : null;
  const inProgress = await one<{ id: number }>("SELECT id FROM workouts WHERE status = 'in_progress' ORDER BY id DESC LIMIT 1");
  const last = await one("SELECT id, day_name, finished_at FROM workouts WHERE status = 'completed' ORDER BY finished_at DESC LIMIT 1");

  let nextDay = null;
  if (program && program.days.length) {
    const lastInProgram = await one<{ day_index: number }>(
      "SELECT pd.day_index FROM workouts w JOIN program_days pd ON pd.id = w.program_day_id WHERE w.program_id = $1 AND w.status = 'completed' ORDER BY w.finished_at DESC LIMIT 1",
      [program.id],
    );
    const idx = lastInProgram ? (lastInProgram.day_index + 1) % program.days.length : 0;
    nextDay = program.days[idx];
  }

  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const thisWeek = (await one<{ n: number }>("SELECT count(*)::int AS n FROM workouts WHERE status = 'completed' AND finished_at >= $1", [monday.toISOString()]))!.n;

  return {
    hasProfile: Boolean(profile),
    program: program
      ? {
          id: program.id,
          name: program.name,
          weeks: program.weeks,
          deloadWeek: program.deloadWeek,
          currentWeek: program.currentWeek,
          isComplete: program.isComplete,
          completedWorkouts: program.completedWorkouts,
        }
      : null,
    nextDay,
    isDeload: Boolean(program && !program.isComplete && program.deloadWeek === program.currentWeek),
    inProgressWorkoutId: inProgress?.id ?? null,
    lastWorkout: last ? { id: last.id, dayName: last.day_name, finishedAt: last.finished_at } : null,
    workoutsThisWeek: thisWeek,
    stalled: await detectStalls(),
  };
}

export async function startWorkout(programDayId: number, profile: Profile | null): Promise<number> {
  const existing = await one<{ id: number }>("SELECT id FROM workouts WHERE status = 'in_progress' ORDER BY id DESC LIMIT 1");
  if (existing) return existing.id;
  const day = await one('SELECT pd.*, p.id AS pid FROM program_days pd JOIN programs p ON p.id = pd.program_id WHERE pd.id = $1', [programDayId]);
  if (!day) throw new NotFound('Program day not found');
  const program = (await loadProgram(day.pid, profile))!;
  const isDeload = program.deloadWeek === program.currentWeek && !program.isComplete;
  const row = await one<{ id: number }>(
    'INSERT INTO workouts (program_id, program_day_id, day_name, week, is_deload, status, started_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    [day.pid, programDayId, day.name, program.currentWeek, isDeload, 'in_progress', nowIso()],
  );
  return row!.id;
}

export async function getWorkout(id: number, profile: Profile | null): Promise<Workout> {
  const w = await one('SELECT * FROM workouts WHERE id = $1', [id]);
  if (!w) throw new NotFound('Workout not found');
  const program = await loadProgram(w.program_id, profile);
  const day = program?.days.find((d) => d.id === w.program_day_id);
  const logged = await all('SELECT * FROM workout_sets WHERE workout_id = $1 ORDER BY set_index', [id]);
  const outcomes = new Map((await all('SELECT * FROM workout_outcomes WHERE workout_id = $1', [id])).map((o) => [o.program_exercise_id, o]));
  const isDeload: boolean = w.is_deload;

  const exercises: WorkoutExercise[] = [];
  for (const pe of day?.exercises ?? []) {
    const prev = await lastSessionSets(pe.exerciseId, id);
    let sets = pe.sets;
    let targetWeight = pe.target?.weight ?? 0;
    let repTargets = pe.target?.repTargets ?? Array.from({ length: pe.sets }, () => pe.repMin);
    let decision: Decision = pe.target?.decision ?? 'start';
    let reason = pe.target?.reason ?? '';

    const outcome = outcomes.get(pe.id);
    if (w.status === 'completed' && outcome) {
      targetWeight = outcome.from_weight;
    } else if (isDeload) {
      const d = deloadPrescription(pe.sets, targetWeight, pe.increment);
      sets = d.sets;
      targetWeight = d.weight;
      decision = 'deload';
      reason = DELOAD_REASON;
    }
    repTargets = Array.from({ length: sets }, (_, i) => repTargets[i] ?? repTargets[repTargets.length - 1] ?? pe.repMin);

    exercises.push({
      programExerciseId: pe.id,
      exerciseId: pe.exerciseId,
      name: pe.name,
      primary: pe.primary,
      loadType: pe.loadType,
      weightNote: pe.weightNote,
      increment: pe.increment,
      sets,
      repMin: pe.repMin,
      repMax: pe.repMax,
      restSeconds: pe.restSeconds,
      notes: pe.notes,
      targetWeight,
      repTargets,
      decision,
      reason,
      previous: prev ? { date: prev.date, sets: prev.sets } : null,
      logged: logged
        .filter((s) => s.program_exercise_id === pe.id)
        .map((s) => ({ setIndex: s.set_index, weight: s.weight, reps: s.reps, rir: s.rir, completed: s.completed })),
    });
  }

  return {
    id: w.id,
    programId: w.program_id,
    programDayId: w.program_day_id,
    dayName: w.day_name,
    status: w.status,
    startedAt: w.started_at,
    finishedAt: w.finished_at,
    week: w.week,
    isDeload,
    exercises,
  };
}

export const setSchema = z.object({
  programExerciseId: z.number().int(),
  setIndex: z.number().int().min(0).max(20),
  weight: z.number().min(0).max(1000),
  reps: z.number().int().min(0).max(100),
  rir: z.number().int().min(0).max(10).nullable().default(null),
  completed: z.boolean().default(true),
});

async function workoutStatus(workoutId: number): Promise<string> {
  const w = await one<{ status: string }>('SELECT status FROM workouts WHERE id = $1', [workoutId]);
  if (!w) throw new NotFound('Workout not found');
  return w.status;
}

/** Idempotent per (workout, exercise, set index) so the client can safely retry. */
export async function upsertSet(workoutId: number, input: unknown) {
  const s = setSchema.parse(input);
  await workoutStatus(workoutId);
  const pe = await one<{ exercise_id: string }>('SELECT exercise_id FROM program_exercises WHERE id = $1', [s.programExerciseId]);
  if (!pe) throw new NotFound('Exercise not found');
  await run(
    `INSERT INTO workout_sets (workout_id, program_exercise_id, exercise_id, set_index, weight, reps, rir, completed, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (workout_id, program_exercise_id, set_index) DO UPDATE SET
       exercise_id = excluded.exercise_id, weight = excluded.weight, reps = excluded.reps, rir = excluded.rir,
       completed = excluded.completed, updated_at = excluded.updated_at`,
    [workoutId, s.programExerciseId, pe.exercise_id, s.setIndex, s.weight, s.reps, s.rir, s.completed, nowIso()],
  );
}

export async function deleteSet(workoutId: number, programExerciseId: number, setIndex: number) {
  await workoutStatus(workoutId);
  await tx(async (c) => {
    await run('DELETE FROM workout_sets WHERE workout_id = $1 AND program_exercise_id = $2 AND set_index = $3', [workoutId, programExerciseId, setIndex], c);
    // Keep set indices contiguous (ascending order avoids unique-key clashes).
    const later = await all<{ id: number; set_index: number }>(
      'SELECT id, set_index FROM workout_sets WHERE workout_id = $1 AND program_exercise_id = $2 AND set_index > $3 ORDER BY set_index',
      [workoutId, programExerciseId, setIndex],
      c,
    );
    for (const s of later) await run('UPDATE workout_sets SET set_index = $1 WHERE id = $2', [s.set_index - 1, s.id], c);
  });
}

export async function discardWorkout(id: number) {
  await tx(async (c) => {
    await run('DELETE FROM workout_sets WHERE workout_id = $1', [id], c);
    await run('DELETE FROM workout_outcomes WHERE workout_id = $1', [id], c);
    await run('DELETE FROM workouts WHERE id = $1', [id], c);
  });
}

async function recordsBefore(exerciseId: string, workoutId: number) {
  return (await one<{ max_weight: number | null; max_e1rm: number | null }>(
    `SELECT max(s.weight) AS max_weight, max(s.weight * (1 + least(s.reps, 15) / 30.0)) AS max_e1rm
     FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE w.status = 'completed' AND s.completed AND s.exercise_id = $1 AND w.id < $2`,
    [exerciseId, workoutId],
  ))!;
}

export async function finishWorkout(id: number, profile: Profile | null): Promise<WorkoutSummary> {
  if ((await workoutStatus(id)) === 'completed') return getSummary(id, profile);
  const workout = await getWorkout(id, profile);
  const ts = nowIso();

  await tx(async (c) => {
    // Lock the row so a double tap on "Finish" cannot process the workout twice.
    const locked = await one<{ status: string }>('SELECT status FROM workouts WHERE id = $1 FOR UPDATE', [id], c);
    if (locked?.status !== 'in_progress') return;

    for (const ex of workout.exercises) {
      const done = ex.logged.filter((s) => s.completed).map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir }));
      if (done.length === 0) continue;
      const saveOutcome = (decision: string, next: number, reps: unknown, reason: string) =>
        run(
          `INSERT INTO workout_outcomes (workout_id, program_exercise_id, exercise_id, decision, from_weight, next_weight, rep_targets, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (workout_id, program_exercise_id) DO UPDATE SET decision = excluded.decision, from_weight = excluded.from_weight,
             next_weight = excluded.next_weight, rep_targets = excluded.rep_targets, reason = excluded.reason`,
          [id, ex.programExerciseId, ex.exerciseId, decision, ex.targetWeight, next, JSON.stringify(reps), reason],
          c,
        );

      if (workout.isDeload) {
        const t = await one('SELECT weight, rep_targets FROM exercise_targets WHERE program_exercise_id = $1', [ex.programExerciseId], c);
        await saveOutcome('deload', t?.weight ?? ex.targetWeight, t?.rep_targets ?? [], 'Deload session logged. Next week you return to your regular working weight.');
        continue;
      }

      const prev = await lastSessionSets(ex.exerciseId, id, c);
      const result = evaluateProgression({
        repMin: ex.repMin,
        repMax: ex.repMax,
        sets: ex.sets,
        increment: ex.increment,
        prescribedWeight: ex.targetWeight,
        session: done,
        previous: prev?.sets ?? null,
      });

      // The same exercise with the same rep range on another program day shares one progression,
      // so "last time" and the target never disagree.
      await run(
        `UPDATE exercise_targets t SET weight = $1, rep_targets = $2, decision = $3, reason = $4, source_workout_id = $5, updated_at = $6
         FROM program_exercises pe JOIN program_days pd ON pd.id = pe.program_day_id
         WHERE t.program_exercise_id = pe.id AND pd.program_id = $7 AND pe.exercise_id = $8 AND pe.rep_min = $9 AND pe.rep_max = $10`,
        [result.nextWeight, JSON.stringify(result.repTargets), result.decision, result.reason, id, ts, workout.programId, ex.exerciseId, ex.repMin, ex.repMax],
        c,
      );
      await saveOutcome(result.decision, result.nextWeight, result.repTargets, result.reason);
    }
    await run("UPDATE workouts SET status = 'completed', finished_at = $1 WHERE id = $2", [ts, id], c);
  });

  return getSummary(id, profile);
}

export async function getSummary(id: number, profile: Profile | null): Promise<WorkoutSummary> {
  const w = await one('SELECT * FROM workouts WHERE id = $1', [id]);
  if (!w) throw new NotFound('Workout not found');
  const sets = await all('SELECT * FROM workout_sets WHERE workout_id = $1 AND completed ORDER BY program_exercise_id, set_index', [id]);
  const outcomes = await all('SELECT * FROM workout_outcomes WHERE workout_id = $1', [id]);
  const order = (await getWorkout(id, profile)).exercises.map((e) => e.programExerciseId);
  outcomes.sort((a, b) => order.indexOf(a.program_exercise_id) - order.indexOf(b.program_exercise_id));

  const result: ExerciseOutcome[] = [];
  for (const o of outcomes) {
    const exSets = sets.filter((s) => s.program_exercise_id === o.program_exercise_id).map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir }));
    const before = await recordsBefore(o.exercise_id, id);
    const newRecords: string[] = [];
    if (before.max_weight !== null && exSets.length) {
      const top = Math.max(...exSets.map((s) => s.weight));
      const bestE = Math.max(...exSets.map((s) => e1rm(s.weight, s.reps)));
      if (top > 0 && top > before.max_weight) newRecords.push(`Heaviest weight: ${formatKg(top)}`);
      else if (bestE > 0 && before.max_e1rm !== null && bestE > before.max_e1rm + 0.01) newRecords.push(`Best estimated 1RM: ${formatKg(Math.round(bestE * 10) / 10)}`);
    }
    result.push({
      programExerciseId: o.program_exercise_id,
      exerciseId: o.exercise_id,
      name: getExercise(o.exercise_id)?.name ?? o.exercise_id,
      decision: o.decision,
      fromWeight: o.from_weight,
      nextWeight: o.next_weight,
      repTargets: o.rep_targets,
      reason: o.reason,
      weightNote: getExercise(o.exercise_id)?.weightNote,
      sets: exSets,
      newRecords,
    });
  }

  const start = new Date(w.started_at).getTime();
  const end = w.finished_at ? new Date(w.finished_at).getTime() : Date.now();
  return {
    workoutId: id,
    dayName: w.day_name,
    durationMinutes: Math.max(1, Math.round((end - start) / 60000)),
    totalSets: sets.length,
    totalVolume: Math.round(sets.reduce((a, s) => a + s.weight * s.reps, 0)),
    outcomes: result,
  };
}

export async function listWorkouts(limit = 50) {
  const rows = await all(
    `SELECT w.id, w.day_name AS "dayName", w.started_at AS "startedAt", w.finished_at AS "finishedAt", w.is_deload AS "isDeload",
            count(s.id)::int AS sets, coalesce(sum(s.weight * s.reps), 0) AS volume
     FROM workouts w LEFT JOIN workout_sets s ON s.workout_id = w.id AND s.completed
     WHERE w.status = 'completed'
     GROUP BY w.id ORDER BY w.finished_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({ ...r, volume: Math.round(r.volume) }));
}
