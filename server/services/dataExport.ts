// JSON/CSV export and JSON import. Database-level backups (pg_dump, storage
// snapshots) are handled outside the app.
import { all, IDENTITY_TABLES, one, run, TABLES, tx } from '../db.ts';
import { pick, UserError } from '../i18n.ts';
import { getExercise } from './exercises.ts';

export async function exportJson() {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await all(`SELECT * FROM ${t}`);
  const version = (await one<{ v: number }>('SELECT max(version) AS v FROM schema_migrations'))?.v ?? 0;
  return { app: 'open-strength', format: 2, schemaVersion: version, exportedAt: new Date().toISOString(), tables };
}

type ColumnInfo = { column_name: string; data_type: string };

/** Coerce values from either export format (v1 SQLite: 0/1 booleans, JSON as text) to Postgres. */
function coerce(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null;
  if (type === 'boolean') return value === true || value === 1 || value === '1' || value === 'true';
  if (type === 'jsonb' || type === 'json') return typeof value === 'string' ? value : JSON.stringify(value);
  return value;
}

/** Columns renamed by migration 5; exports from older versions still use the old names. */
const LEGACY_COLUMNS: Record<string, Record<string, string>> = {
  programs: { weeks: 'rounds', deload_week: 'deload_round' },
  workouts: { week: 'round' },
};

function renameLegacy(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const map = LEGACY_COLUMNS[table];
  if (!map) return row;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [map[k] && !(map[k] in row) ? map[k] : k, v]));
}

/** Exports made before the rename to Open Strength say `overload`; they import the same way. */
const EXPORT_APPS = ['open-strength', 'overload'];

export async function importJson(data: any) {
  if (!data || !EXPORT_APPS.includes(data.app) || typeof data.tables !== 'object')
    throw new UserError(400, 'This is not an Open Strength export file', 'Dit is geen exportbestand van Open Strength');
  await tx(async (c) => {
    await run(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`, [], c);
    for (const t of TABLES) {
      const rows = (data.tables[t] as Record<string, unknown>[] | undefined)?.map((r) => renameLegacy(t, r));
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const columns = await all<ColumnInfo>('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = current_schema()', [t], c);
      const types = new Map(columns.map((col) => [col.column_name, col.data_type]));
      for (const row of rows) {
        const cols = Object.keys(row).filter((k) => types.has(k));
        if (!cols.length) continue;
        await run(
          `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
          cols.map((k) => coerce(row[k], types.get(k)!)),
          c,
        );
      }
    }
    // Continue identity sequences after the highest imported id.
    for (const t of IDENTITY_TABLES) {
      await run(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), coalesce((SELECT max(id) FROM ${t}), 0) + 1, false)`, [], c);
    }
  });
}

export async function exportSetsCsv(): Promise<string> {
  const rows = await all(
    `SELECT w.finished_at, w.day_name, w.is_deload, s.exercise_id, s.set_index, s.weight, s.reps, s.rir
     FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE w.status = 'completed' AND s.completed
     ORDER BY w.finished_at, s.program_exercise_id, s.set_index`,
  );
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = 'date,workout,deload,exercise_id,exercise,set,weight_kg,reps,rir';
  const lines = rows.map((r) =>
    // The CSV is a data file: English names, whatever the app language.
    [r.finished_at, pick(r.day_name, 'en'), r.is_deload, r.exercise_id, getExercise(r.exercise_id)?.name ?? r.exercise_id, r.set_index + 1, r.weight, r.reps, r.rir].map(esc).join(','),
  );
  return [header, ...lines].join('\n') + '\n';
}
