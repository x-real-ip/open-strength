import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExerciseGuide } from '../components/ExerciseGuide.tsx';
import { PreferenceButtons } from '../components/PreferenceButtons.tsx';
import { IconBack } from '../components/Icons.tsx';
import { api } from '../api.ts';
import { ErrorState, Loading, useLoad } from '../components/ui.tsx';
import { CATEGORY_LABEL, equipmentText, kg, LEVEL_LABEL, MUSCLE_LABEL, PATTERN_LABEL, relativeDay, repRange } from '../format.ts';
import { useExercises } from '../exercises.ts';

export default function ExerciseGuidePage() {
  const { exerciseId = '' } = useParams();
  const navigate = useNavigate();
  const exercises = useExercises();
  // Your own history with the exercise and where it sits in the program; optional extras.
  const { data: mine } = useLoad(() => Promise.all([api.activeProgram(), api.exerciseUsage()]), [exerciseId]);

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

      {(() => {
        const usage = mine?.[1][ex.id];
        const onDays = (mine?.[0].program?.days ?? []).flatMap((d) => d.exercises.filter((e) => e.exerciseId === ex.id).map((e) => ({ day: d.name, e })));
        if (!usage && onDays.length === 0) return null;
        return (
          <div className="pills stacked" style={{ marginBottom: 16 }}>
            {onDays.map(({ day, e }) => (
              <span key={day} className="pill program">
                In je programma: {day}, {e.sets} × {repRange(e.repMin, e.repMax)}
              </span>
            ))}
            {usage && (
              <span className="pill done">
                {usage.sessions}× gedaan ({usage.sets} sets), laatst {relativeDay(usage.lastDone).toLowerCase()}
                {usage.topWeight > 0 ? ` · zwaarste set ${kg(usage.topWeight)} kg × ${usage.topReps}` : ` · beste set ${usage.topReps} herhalingen`}
              </span>
            )}
          </div>
        );
      })()}

      {ex.programmable && (
        <section className="stack" style={{ marginBottom: 20 }}>
          <PreferenceButtons exerciseId={ex.id} />
          <p className="faint small" style={{ margin: 0 }}>
            Een favoriet zet de AI in je schema waar hij past. Een oefening op "niet gebruiken" komt nooit meer in je schema en wordt meteen vervangen
            als hij er nu in staat.
          </p>
        </section>
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
