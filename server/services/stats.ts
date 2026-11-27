import type { ExerciseHistory, ExerciseUsage, MuscleGroup, StatsResponse } from '../../shared/types.ts';
import { all } from '../db.ts';
import type { Lang } from '../i18n.ts';
import { exerciseName, getExercise } from './exercises.ts';
import { e1rm } from './weights.ts';

interface SetRow {
  workout_id: number;
  finished_at: string;
  is_deload: boolean;
  exercise_id: string;
  weight: number;
  reps: number;
  rir: number | null;
}

function completedSets(exerciseId?: string): Promise<SetRow[]> {
  return all<SetRow>(
    `SELECT s.workout_id, w.finished_at, w.is_deload, s.exercise_id, s.weight, s.reps, s.rir
     FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE w.status = 'completed' AND s.completed AND ($1::text IS NULL OR s.exercise_id = $1::text)
     ORDER BY w.finished_at, s.program_exercise_id, s.set_index`,
    [exerciseId ?? null],
  );
}

function byExercise(rows: SetRow[]): Map<string, SetRow[]> {
  const map = new Map<string, SetRow[]>();
  for (const r of rows) {
    const list = map.get(r.exercise_id) ?? [];
    list.push(r);
    map.set(r.exercise_id, list);
  }
  return map;
}

/** Per exercise: how often and how recently it was trained, and the heaviest set. */
export async function exerciseUsage(): Promise<Record<string, ExerciseUsage>> {
  const rows = await all<{ exercise_id: string; sessions: number; sets: number; last_done: string; top_weight: number; top_reps: number }>(
    `SELECT s.exercise_id, count(DISTINCT s.workout_id)::int AS sessions, count(*)::int AS sets, max(w.finished_at) AS last_done,
            max(s.weight) AS top_weight,
            max(s.reps) FILTER (WHERE s.weight = (SELECT max(s2.weight) FROM workout_sets s2 JOIN workouts w2 ON w2.id = s2.workout_id
                                                  WHERE w2.status = 'completed' AND s2.completed AND s2.exercise_id = s.exercise_id))::int AS top_reps
     FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE w.status = 'completed' AND s.completed
     GROUP BY s.exercise_id`,
  );
  return Object.fromEntries(
    rows.map((r) => [r.exercise_id, { sessions: r.sessions, sets: r.sets, lastDone: r.last_done, topWeight: r.top_weight, topReps: r.top_reps ?? 0 }]),
  );
}

export async function exerciseHistory(exerciseId: string, lang: Lang = 'en'): Promise<ExerciseHistory> {
  return historyFromRows(exerciseId, await completedSets(exerciseId), lang);
}

function historyFromRows(exerciseId: string, rows: SetRow[], lang: Lang = 'en'): ExerciseHistory {
  const bySession = new Map<number, SetRow[]>();
  for (const r of rows) {
    const list = bySession.get(r.workout_id) ?? [];
    list.push(r);
    bySession.set(r.workout_id, list);
  }
  const sessions = [...bySession.values()].map((sets) => ({
    date: sets[0].finished_at,
    isDeload: sets[0].is_deload,
    topWeight: Math.max(...sets.map((s) => s.weight)),
    totalReps: sets.reduce((a, s) => a + s.reps, 0),
    bestReps: Math.max(...sets.map((s) => s.reps)),
    e1rm: Math.max(...sets.map((s) => e1rm(s.weight, s.reps))),
    volume: sets.reduce((a, s) => a + s.weight * s.reps, 0),
    sets: sets.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir })),
  }));
  return { exerciseId, name: exerciseName(exerciseId, lang), sessions };
}

/**
 * An exercise is stalling when its best estimated 1RM (or best reps for bodyweight work)
 * in the last three normal sessions is no better than the session before them.
 */
export async function detectStalls(lang: Lang = 'en'): Promise<{ exerciseId: string; name: string; sessions: number }[]> {
  const out: { exerciseId: string; name: string; sessions: number }[] = [];
  for (const [id, rows] of byExercise(await completedSets())) {
    const h = historyFromRows(id, rows).sessions.filter((s) => !s.isDeload);
    if (h.length < 4) continue;
    const metric = (s: (typeof h)[number]) => (s.topWeight > 0 ? s.e1rm : s.totalReps);
    const recent = h.slice(-3);
    const before = h[h.length - 4];
    if (Math.max(...recent.map(metric)) <= metric(before)) {
      // Count how many sessions since the last improvement.
      let best = -Infinity;
      let lastImprovement = 0;
      h.forEach((s, i) => {
        if (metric(s) > best) {
          best = metric(s);
          lastImprovement = i;
        }
      });
      out.push({ exerciseId: id, name: exerciseName(id, lang), sessions: h.length - 1 - lastImprovement });
    }
  }
  return out;
}

function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

const DAY = 86_400_000;

export async function getStats(weeks = 12, lang: Lang = 'en'): Promise<StatsResponse> {
  const sets = await completedSets();
  const workouts = await all<{ id: number; finished_at: string }>("SELECT id, finished_at FROM workouts WHERE status = 'completed' ORDER BY finished_at");

  const thisMonday = mondayOf(new Date());
  const weekly = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(thisMonday.getTime() - (weeks - 1 - i) * 7 * DAY);
    return { weekStart: start.toISOString().slice(0, 10), workouts: 0, sets: 0, volumeKg: 0, _t: start.getTime() };
  });
  const weekIndex = (iso: string) => {
    const t = mondayOf(new Date(iso)).getTime();
    return weekly.findIndex((w) => w._t === t);
  };
  for (const w of workouts) {
    const i = weekIndex(w.finished_at);
    if (i >= 0) weekly[i].workouts++;
  }
  for (const s of sets) {
    const i = weekIndex(s.finished_at);
    if (i >= 0) {
      weekly[i].sets++;
      weekly[i].volumeKg += s.weight * s.reps;
    }
  }

  // Weekly hard sets per muscle group: primary counts 1, secondary 0.5.
  const now = Date.now();
  const muscleTotals = new Map<MuscleGroup, { recent: number; previous: number }>();
  for (const s of sets) {
    const age = now - new Date(s.finished_at).getTime();
    const bucket = age <= 28 * DAY ? 'recent' : age <= 56 * DAY ? 'previous' : null;
    if (!bucket) continue;
    const def = getExercise(s.exercise_id);
    if (!def) continue;
    const add = (m: MuscleGroup, v: number) => {
      const cur = muscleTotals.get(m) ?? { recent: 0, previous: 0 };
      cur[bucket] += v;
      muscleTotals.set(m, cur);
    };
    add(def.primary, 1);
    def.secondary.forEach((m) => add(m, 0.5));
  }
  const muscleOrder: MuscleGroup[] = [
    'chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves', 'core',
    'lower_back', 'traps', 'forearms', 'adductors', 'abductors', 'neck',
  ];
  const muscles = muscleOrder
    .filter((m) => muscleTotals.has(m))
    .map((m) => ({
      muscle: m,
      setsPerWeekRecent: Math.round((muscleTotals.get(m)!.recent / 4) * 10) / 10,
      setsPerWeekPrevious: Math.round((muscleTotals.get(m)!.previous / 4) * 10) / 10,
    }));

  // Records and per-exercise development.
  const perExercise = byExercise(sets);
  const records: StatsResponse['records'] = [];
  const exercises: StatsResponse['exercises'] = [];
  for (const [id, list] of perExercise) {
    const name = exerciseName(id, lang);
    let best = list[0];
    let bestE = 0;
    let bestEDate = list[0].finished_at;
    for (const s of list) {
      if (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) best = s;
      const e = e1rm(s.weight, s.reps);
      if (e > bestE) {
        bestE = e;
        bestEDate = s.finished_at;
      }
    }
    records.push({ exerciseId: id, name, bestWeight: best.weight, bestWeightReps: best.reps, bestE1rm: bestE, date: bestEDate > best.finished_at ? bestEDate : best.finished_at });
    const sessions = historyFromRows(id, list).sessions;
    exercises.push({
      exerciseId: id,
      name,
      sessions: sessions.length,
      firstE1rm: sessions[0]?.e1rm ?? 0,
      lastE1rm: sessions[sessions.length - 1]?.e1rm ?? 0,
    });
  }
  records.sort((a, b) => b.date.localeCompare(a.date));
  exercises.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));

  return {
    totals: {
      workouts: workouts.length,
      sets: sets.length,
      volumeKg: Math.round(sets.reduce((a, s) => a + s.weight * s.reps, 0)),
      firstWorkout: workouts[0]?.finished_at ?? null,
    },
    weekly: weekly.map(({ _t, ...w }) => ({ ...w, volumeKg: Math.round(w.volumeKg) })),
    muscles,
    records,
    exercises,
  };
}

/** Compact text summary of recent training, used as AI context. */
export async function historyDigest(maxSessionsPerExercise = 5): Promise<string> {
  const grouped = byExercise(await completedSets());
  if (grouped.size === 0) return 'No workouts logged yet.';
  const lines: string[] = [];
  for (const [id, rows] of grouped) {
    const h = historyFromRows(id, rows);
    const recent = h.sessions.slice(-maxSessionsPerExercise);
    const parts = recent.map((s) => `${s.date.slice(0, 10)}${s.isDeload ? ' (deload)' : ''}: ${s.sets.map((x) => `${x.weight}x${x.reps}${x.rir !== null ? `@RIR${x.rir}` : ''}`).join(', ')}`);
    lines.push(`- ${h.name} [${id}] (${h.sessions.length} sessions total)\n  ${parts.join('\n  ')}`);
  }
  return lines.join('\n');
}
