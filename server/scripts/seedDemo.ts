// Fills an EMPTY database with a demo profile and ~5 weeks of simulated training,
// so you can explore the dashboard and charts. Refuses to run on a database with data.
//   DATABASE_URL=postgres://... npm run seed:demo
import { closeDb, one, openDb, run } from '../db.ts';
import { saveProfile } from '../services/profile.ts';
import { activeProgramId, loadProgram, saveProgram } from '../services/programs.ts';
import { buildTemplateProgram } from '../services/programTemplates.ts';
import { finishWorkout, getWorkout, startWorkout, upsertSet } from '../services/workouts.ts';

await openDb();
const existing = (await one<{ n: number }>('SELECT count(*)::int AS n FROM workouts'))!.n;
if (existing > 0 || (await one('SELECT 1 FROM profile'))) {
  console.error('Database already has data; demo seed only runs on an empty database.');
  process.exit(1);
}

const profile = await saveProfile({
  name: 'Demo',
  age: 34,
  heightCm: 183,
  weightKg: 82,
  level: 'intermediate',
  goal: 'hypertrophy',
  daysPerWeek: 3,
  sessionMinutes: 60,
  equipment: ['barbell', 'dumbbell', 'bench', 'machine', 'cable', 'pullup_bar'],
  limitations: '',
});
await saveProgram(buildTemplateProgram(profile), profile);
const programId = (await activeProgramId())!;

// Deterministic pseudo-random so the demo looks the same every time.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const sessions = 14;
const start = Date.now() - 34 * 86_400_000;
const program = (await loadProgram(programId, profile))!;

for (let n = 0; n < sessions; n++) {
  const day = program.days[n % program.days.length];
  const id = await startWorkout(day.id, profile);
  const w = await getWorkout(id, profile);
  for (const ex of w.exercises) {
    for (let i = 0; i < ex.sets; i++) {
      const target = ex.repTargets[i] ?? ex.repMin;
      // Usually beat the target by a rep, sometimes fall short later in the session.
      const delta = rand() < 0.65 ? 1 : rand() < 0.5 ? 0 : -1 - (i > 1 ? 1 : 0);
      const reps = Math.max(ex.repMin - 1, Math.min(ex.repMax + (rand() < 0.15 ? 1 : 0), target + delta));
      await upsertSet(id, { programExerciseId: ex.programExerciseId, setIndex: i, weight: ex.targetWeight, reps, rir: rand() < 0.5 ? Math.floor(rand() * 3) + 1 : null });
    }
  }
  await finishWorkout(id, profile);
  const startedAt = new Date(start + (n * 34 * 86_400_000) / sessions + 18 * 3_600_000);
  const finishedAt = new Date(startedAt.getTime() + (50 + Math.floor(rand() * 20)) * 60_000);
  await run('UPDATE workouts SET started_at = $1, finished_at = $2 WHERE id = $3', [startedAt.toISOString(), finishedAt.toISOString(), id]);
}

console.log(`Seeded ${sessions} demo workouts.`);
await closeDb();
