import type { LibraryExercise } from '@shared/types.ts';
import { t } from '../i18n.ts';

/** Start and end photo, alternating like a slow animation, plus the steps. */
export function ExerciseGuide({ exercise }: { exercise: LibraryExercise }) {
  // Photos of imported exercises come from GitHub; CORS mode lets the service worker cache them.
  const remote = exercise.source === 'free-exercise-db' ? 'anonymous' : undefined;
  return (
    <div className="stack">
      {exercise.photos.length === 2 && (
        <figure className="demo" aria-label={`${t('Example', 'Voorbeeld')}: ${exercise.name}`}>
          <img src={exercise.photos[0]} alt={`${exercise.name}: ${t('start position', 'beginpositie')}`} loading="lazy" crossOrigin={remote} />
          <img src={exercise.photos[1]} alt={`${exercise.name}: ${t('end position', 'eindpositie')}`} loading="lazy" crossOrigin={remote} />
          {exercise.photoNote && <figcaption>{exercise.photoNote}</figcaption>}
        </figure>
      )}
      {exercise.source === 'free-exercise-db' && (
        <p className="faint small" style={{ margin: 0 }}>
          {exercise.steps.length
            ? t('How-to from free-exercise-db.', 'Uitleg uit free-exercise-db (Engels).')
            : t('free-exercise-db has no how-to for this exercise.', 'free-exercise-db heeft geen uitleg voor deze oefening.')}
          {exercise.photos.length < 2 ? t(' There are no photos.', ' Er zijn geen foto’s.') : ''}
        </p>
      )}
      <ol className="steps" lang={exercise.source === 'free-exercise-db' ? 'en' : undefined}>
        {exercise.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
