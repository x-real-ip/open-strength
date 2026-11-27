import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ExerciseCategory, LibraryExercise, MuscleGroup } from '@shared/types.ts';
import { api } from '../api.ts';
import { IconBack, IconChevron } from '../components/Icons.tsx';
import { ErrorState, Loading, useLoad } from '../components/ui.tsx';
import { CATEGORY_LABEL, equipmentText, hasEquipment, MUSCLE_LABEL } from '../format.ts';
import { loadExercises } from '../exercises.ts';

const MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleGroup[];
const CATEGORIES = Object.keys(CATEGORY_LABEL) as ExerciseCategory[];

export default function ExercisesPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => Promise.all([loadExercises(), api.profile(), api.activeProgram()]));
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  const [onlyProgram, setOnlyProgram] = useState(false);

  const inProgram = useMemo(() => new Set(data?.[2].program?.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)) ?? []), [data]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Laden is mislukt'} onRetry={reload} />;

  const [exercises, { profile }] = data;
  const equipment = profile?.equipment ?? null;
  const q = query.trim().toLowerCase();
  const shown = exercises.filter(
    (e) =>
      (!muscle || e.primary === muscle) &&
      (!category || e.category === category) &&
      (!q || e.name.toLowerCase().includes(q)) &&
      (!onlyMine || hasEquipment(e, equipment)) &&
      (!onlyProgram || e.programmable),
  );
  // The list arrives curated first, so the exercises with a Dutch guide lead each group.
  const groups = MUSCLES.map((m) => ({ muscle: m, items: shown.filter((e) => e.primary === m) })).filter((g) => g.items.length);
  const programmable = exercises.filter((e) => e.programmable).length;
  const curated = exercises.filter((e) => e.source === 'overload').length;

  return (
    <main className="page">
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Terug">
          <IconBack />
        </button>
      </div>
      <h1>Oefeningen</h1>
      <p className="muted small" style={{ marginTop: 8 }}>
        {exercises.length} oefeningen. {programmable} daarvan kunnen in je programma: bij het wisselen van een oefening en als de AI een programma maakt. Het
        programma op basis van regels kiest alleen uit de {curated} vaste oefeningen met Nederlandse uitleg. De rest komt uit free-exercise-db en heeft
        Engelse namen en uitleg.
      </p>

      <div className="stack" style={{ marginBottom: 16 }}>
        <input className="input" type="search" placeholder="Zoeken" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Oefening zoeken" />
        <div className="chips" role="group" aria-label="Spiergroep">
          <button type="button" aria-pressed={muscle === null} onClick={() => setMuscle(null)}>
            Alle spieren
          </button>
          {MUSCLES.map((m) => (
            <button key={m} type="button" aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {MUSCLE_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Soort">
          <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)}>
            Alle soorten
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        {equipment && (
          <label className="row small muted" style={{ gap: 8 }}>
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Alleen oefeningen met mijn apparatuur
          </label>
        )}
        <label className="row small muted" style={{ gap: 8 }}>
          <input type="checkbox" checked={onlyProgram} onChange={(e) => setOnlyProgram(e.target.checked)} />
          Alleen oefeningen die in een programma kunnen
        </label>
        <p className="faint small" style={{ margin: 0 }}>
          {shown.length} {shown.length === 1 ? 'oefening' : 'oefeningen'}
        </p>
      </div>

      {groups.length === 0 && <p className="muted">Geen oefeningen gevonden.</p>}
      {groups.map((g) => (
        <section key={g.muscle} className="section" style={{ marginTop: 0, marginBottom: 20 }}>
          <h2 style={{ marginBottom: 10 }}>{MUSCLE_LABEL[g.muscle]}</h2>
          <div className="list">
            {g.items.map((e) => (
              <ExerciseRow key={e.id} exercise={e} available={hasEquipment(e, equipment)} inProgram={inProgram.has(e.id)} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function ExerciseRow({ exercise: e, available, inProgram }: { exercise: LibraryExercise; available: boolean; inProgram: boolean }) {
  const notes = [
    equipmentText(e.equipment, e.otherEquipment),
    e.category !== 'strength' ? CATEGORY_LABEL[e.category] : null,
    inProgram ? 'in je programma' : null,
    !e.programmable ? 'alleen bekijken' : null,
    !available ? 'niet met jouw apparatuur' : null,
  ].filter(Boolean);
  return (
    <Link className={`list-row ${available ? '' : 'unavailable'}`} to={`/exercises/${encodeURIComponent(e.id)}`}>
      {e.photos[0] ? <img className="thumb" src={e.photos[0]} alt="" loading="lazy" crossOrigin="anonymous" /> : <span className="thumb" aria-hidden="true" />}
      <div className="grow">
        <div className="title">{e.name}</div>
        <div className="sub">{notes.join(' · ')}</div>
      </div>
      <IconChevron />
    </Link>
  );
}
