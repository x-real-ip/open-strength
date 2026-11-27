import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExerciseGuide } from '../components/ExerciseGuide.tsx';
import { IconBack } from '../components/Icons.tsx';
import { ErrorState, Loading } from '../components/ui.tsx';
import { equipmentText, MUSCLE_LABEL, PATTERN_LABEL } from '../format.ts';
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
      <h1>{ex.name}</h1>
      <p className="muted small" style={{ marginTop: 8 }}>
        {MUSCLE_LABEL[ex.primary]}
        {ex.secondary.length ? ` (ook ${ex.secondary.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')})` : ''}
        {' · '}
        {equipmentText(ex.equipment)}
        {' · '}
        {PATTERN_LABEL[ex.pattern]}
        {ex.compound ? ', samengesteld' : ', isolatie'}
      </p>

      <ExerciseGuide exercise={ex} />

      <section className="section stack">
        <Link className="btn block" to={`/progress/${ex.id}`}>
          Mijn historie met deze oefening
        </Link>
        <p className="faint small" style={{ margin: 0 }}>
          Foto’s: free-exercise-db (publiek domein).
        </p>
      </section>
    </main>
  );
}
