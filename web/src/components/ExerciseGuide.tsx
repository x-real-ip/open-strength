import type { ExerciseDef } from '@shared/types.ts';

/** Start and end photo, alternating like a slow animation, plus the steps. */
export function ExerciseGuide({ exercise }: { exercise: ExerciseDef }) {
  return (
    <div className="stack">
      {exercise.photos.length === 2 && (
        <figure className="demo" aria-label={`Voorbeeld: ${exercise.name}`}>
          <img src={exercise.photos[0]} alt={`${exercise.name}: beginpositie`} loading="lazy" />
          <img src={exercise.photos[1]} alt={`${exercise.name}: eindpositie`} loading="lazy" />
          {exercise.photoNote && <figcaption>{exercise.photoNote}</figcaption>}
        </figure>
      )}
      <ol className="steps">
        {exercise.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
