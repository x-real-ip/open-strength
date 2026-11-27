// Favourite and excluded exercises. Favourites go into generated programs where they fit the split;
// excluded exercises are never generated, offered as a swap, or left in the active program.
import type { ExercisePreference, ExercisePreferences, PreferenceUpdate, Profile } from '../../shared/types.ts';
import { all, getPool, nowIso, run, type Queryable } from '../db.ts';
import { alternativesFor, getExercise, type Prefs } from './exercises.ts';
import { activeProgramId, replaceExercise } from './programs.ts';

export async function getPreferences(db: Queryable = getPool()): Promise<ExercisePreferences> {
  const rows = await all<{ exercise_id: string; preference: ExercisePreference }>(
    'SELECT exercise_id, preference FROM exercise_preferences ORDER BY exercise_id',
    [],
    db,
  );
  return {
    favorites: rows.filter((r) => r.preference === 'favorite').map((r) => r.exercise_id),
    excluded: rows.filter((r) => r.preference === 'excluded').map((r) => r.exercise_id),
  };
}

export async function loadPrefs(): Promise<Prefs> {
  const p = await getPreferences();
  return { favorites: new Set(p.favorites), excluded: new Set(p.excluded) };
}

/**
 * Mark an exercise (null clears the mark). Excluding one also swaps it out of the active program
 * for the best alternative, keeping sets and reps; days without an alternative keep it.
 */
export async function setPreference(exerciseId: string, preference: ExercisePreference | null, profile: Profile | null): Promise<PreferenceUpdate> {
  const def = getExercise(exerciseId);
  if (!def) throw Object.assign(new Error('Alleen oefeningen die in een programma kunnen, kun je markeren'), { status: 400 });

  if (preference) {
    await run(
      `INSERT INTO exercise_preferences (exercise_id, preference, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (exercise_id) DO UPDATE SET preference = excluded.preference, updated_at = excluded.updated_at`,
      [exerciseId, preference, nowIso()],
    );
  } else {
    await run('DELETE FROM exercise_preferences WHERE exercise_id = $1', [exerciseId]);
  }

  const replaced: PreferenceUpdate['replaced'] = [];
  const kept: string[] = [];
  const programId = await activeProgramId();
  if (preference === 'excluded' && programId && profile) {
    const prefs = await loadPrefs();
    const rows = await all<{ id: number; program_day_id: number; day: string }>(
      `SELECT pe.id, pe.program_day_id, d.name AS day FROM program_exercises pe
       JOIN program_days d ON d.id = pe.program_day_id
       WHERE d.program_id = $1 AND pe.exercise_id = $2 ORDER BY d.day_index, pe.position`,
      [programId, exerciseId],
    );
    for (const r of rows) {
      const inDay = (await all<{ exercise_id: string }>('SELECT exercise_id FROM program_exercises WHERE program_day_id = $1', [r.program_day_id])).map(
        (x) => x.exercise_id,
      );
      const alt = alternativesFor(exerciseId, profile.equipment, inDay, prefs)[0];
      if (!alt) {
        kept.push(r.day);
        continue;
      }
      await replaceExercise(r.id, alt.id, profile);
      replaced.push({ day: r.day, from: def.name, to: alt.name });
    }
  }
  return { preferences: await getPreferences(), replaced, kept };
}
