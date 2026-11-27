import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExerciseGuide } from '../components/ExerciseGuide.tsx';
import { IconBack } from '../components/Icons.tsx';
import { ErrorState, Loading } from '../components/ui.tsx';
import { CATEGORY_LABEL, equipmentText, LEVEL_LABEL, MUSCLE_LABEL, PATTERN_LABEL } from '../format.ts';
import { useExercises } from '../exercises.ts';

export default function ExerciseGuidePage() {
  const { exerciseId = '' } = useParams();
  const navigate = useNavigate();
  const exercises = useExercises();

  if (!exercises) return <Loading />;
  const ex = exercises.get(exerciseId);
  if (!ex) return <ErrorState message="Oefening niet gevonden" />;

  return (
    <main className="page">
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Terug">
          <IconBack />
        </button>
      </div>
      <h1 lang={ex.source === 'free-exercise-db' ? 'en' : undefined}>{ex.name}</h1>
      <p className="muted small" style={{ marginTop: 8 }}>
        {[
          `${MUSCLE_LABEL[ex.primary]}${ex.secondary.length ? ` (ook ${ex.secondary.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')})` : ''}`,
          equipmentText(ex.equipment, ex.otherEquipment),
          `${ex.pattern ? PATTERN_LABEL[ex.pattern] : CATEGORY_LABEL[ex.category]}, ${ex.compound ? 'samengesteld' : 'isolatie'}`,
          ex.level ? `niveau: ${LEVEL_LABEL[ex.level]}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {!ex.programmable && (
        <p className="faint small">
          {ex.category === 'strength' || ex.category === 'powerlifting'
            ? 'Deze oefening kan niet in een programma: de app kan er geen bewegingspatroon of gewichtsstap aan koppelen.'
            : 'Deze oefening kan niet in een programma: de app plant alleen krachtoefeningen met sets, herhalingen en gewicht.'}
        </p>
      )}

      <ExerciseGuide exercise={ex} />

      <section className="section stack">
        {ex.programmable && (
          <Link className="btn block" to={`/progress/${encodeURIComponent(ex.id)}`}>
            Mijn historie met deze oefening
          </Link>
        )}
        <p className="faint small" style={{ margin: 0 }}>
          {ex.source === 'free-exercise-db' ? 'Naam, uitleg en foto’s' : 'Foto’s'}: free-exercise-db (publiek domein).
        </p>
      </section>
    </main>
  );
}
