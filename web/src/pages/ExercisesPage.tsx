import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ExerciseDef, MuscleGroup } from '@shared/types.ts';
import { api } from '../api.ts';
import { IconBack, IconChevron } from '../components/Icons.tsx';
import { ErrorState, Loading, useLoad } from '../components/ui.tsx';
import { equipmentText, MUSCLE_LABEL } from '../format.ts';
import { loadExercises } from '../exercises.ts';

const MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleGroup[];

/** Bodyweight is always available; everything else must be in the profile. */
function available(ex: ExerciseDef, equipment: string[] | null): boolean {
  if (!equipment) return true;
  return ex.equipment.every((e) => e === 'bodyweight' || equipment.includes(e));
}

export default function ExercisesPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => Promise.all([loadExercises(), api.profile(), api.activeProgram()]));
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);

  const inProgram = useMemo(() => new Set(data?.[2].program?.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)) ?? []), [data]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Laden is mislukt'} onRetry={reload} />;

  const [exercises, { profile }] = data;
  const equipment = profile?.equipment ?? null;
  const q = query.trim().toLowerCase();
  const shown = exercises.filter(
    (e) => (!muscle || e.primary === muscle) && (!q || e.name.toLowerCase().includes(q)) && (!onlyMine || available(e, equipment)),
  );
  const groups = MUSCLES.map((m) => ({ muscle: m, items: shown.filter((e) => e.primary === m) })).filter((g) => g.items.length);
  const availableCount = exercises.filter((e) => available(e, equipment)).length;

  return (
    <main className="page">
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Terug">
          <IconBack />
        </button>
      </div>
      <h1>Oefeningen</h1>
      <p className="muted small" style={{ marginTop: 8 }}>
        Dit zijn alle {exercises.length} oefeningen waaruit de app (en de AI) programma’s kan samenstellen.
        {equipment ? ` Met jouw apparatuur kunnen er ${availableCount} gekozen worden.` : ''}
      </p>

      <div className="stack" style={{ marginBottom: 16 }}>
        <input className="input" type="search" placeholder="Zoeken" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Oefening zoeken" />
        <div className="chips" role="group" aria-label="Spiergroep">
          <button type="button" aria-pressed={muscle === null} onClick={() => setMuscle(null)}>
            Alles
          </button>
          {MUSCLES.map((m) => (
            <button key={m} type="button" aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {MUSCLE_LABEL[m]}
            </button>
          ))}
        </div>
        {equipment && (
          <label className="row small muted" style={{ gap: 8 }}>
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Alleen oefeningen met mijn apparatuur
          </label>
        )}
      </div>

      {groups.length === 0 && <p className="muted">Geen oefeningen gevonden.</p>}
      {groups.map((g) => (
        <section key={g.muscle} className="section" style={{ marginTop: 0, marginBottom: 20 }}>
          <h2 style={{ marginBottom: 10 }}>{MUSCLE_LABEL[g.muscle]}</h2>
          <div className="list">
            {g.items.map((e) => (
              <Link key={e.id} className={`list-row ${available(e, equipment) ? '' : 'unavailable'}`} to={`/exercises/${e.id}`}>
                {e.photos[0] && <img className="thumb" src={e.photos[0]} alt="" loading="lazy" />}
                <div className="grow">
                  <div className="title">{e.name}</div>
                  <div className="sub">
                    {equipmentText(e.equipment)}
                    {inProgram.has(e.id) ? ' · in je programma' : ''}
                    {!available(e, equipment) ? ' · niet met jouw apparatuur' : ''}
                  </div>
                </div>
                <IconChevron />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
