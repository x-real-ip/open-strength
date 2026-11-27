import { useState } from 'react';
import type { Program, ProgramExplanation } from '@shared/types.ts';
import { kg, repRange, supersetLabels } from '../format.ts';
import { t } from '../i18n.ts';
import { addStep, deloadPreview } from '../workoutMath.ts';

interface Session {
  /** 0-based position in the block; the workout number is index + 1. */
  index: number;
  dayIndex: number;
  deload: boolean;
  status: 'done' | 'next' | 'planned';
}

/** Every workout of the block in order. Days rotate, so the next one follows the last completed day. */
function sessionsOf(program: Program): Session[] {
  const n = program.days.length;
  const done = program.completedWorkouts;
  return Array.from({ length: program.totalWorkouts }, (_, i) => ({
    index: i,
    dayIndex: i < done ? i % n : (program.nextDayIndex + (i - done)) % n,
    deload: program.deloadFrom !== null && i + 1 >= program.deloadFrom,
    status: i < done ? 'done' : i === done ? 'next' : 'planned',
  }));
}

export function ProgramLookahead({ program }: { program: Program }) {
  const sessions = sessionsOf(program);
  const [open, setOpen] = useState<number | null>(program.isComplete ? null : program.completedWorkouts);

  if (program.isComplete) {
    return <p className="muted">{t('This block is done. Make the next block on the Today screen.', 'Dit blok is afgerond. Maak het volgende blok op het Vandaag-scherm.')}</p>;
  }

  const done = program.completedWorkouts;
  const upcoming = sessions.filter((s) => s.status !== 'done');

  return (
    <div className="stack">
      <p className="faint small" style={{ margin: 0 }}>
        {t(
          `The block is ${program.totalWorkouts} workouts, whenever you train them. Weights further on are your current targets; they go up once you reach the top of the rep range, and the next step is shown.`,
          `Het blok is ${program.totalWorkouts} trainingen, wanneer je ze ook doet. Gewichten verderop zijn je huidige doelen; ze gaan omhoog zodra je de bovenkant van de herhalingen haalt, en de volgende stap staat erbij.`,
        )}
      </p>
      {done > 0 && (
        <p className="small muted" style={{ margin: 0 }}>
          {t(`${done} of ${program.totalWorkouts} workouts done.`, `${done} van ${program.totalWorkouts} trainingen gedaan.`)}
        </p>
      )}
      <div className="list">
        {upcoming.map((s) => {
          const day = program.days[s.dayIndex];
          const expanded = open === s.index;
          return (
            <div key={s.index}>
              <button className="list-row" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : s.index)}>
                <span className="num faint" style={{ minWidth: 28 }}>
                  {s.index + 1}
                </span>
                <div className="grow">
                  <div className="title">{day.name}</div>
                  <div className="sub">
                    {s.status === 'next' ? t('next', 'volgende') : t(`after ${s.index - done} more`, `na nog ${s.index - done}`)}
                  </div>
                </div>
                {s.deload && <span className="tag deload">Deload</span>}
                <span className="faint" aria-hidden="true">
                  {expanded ? '−' : '+'}
                </span>
              </button>
              {expanded && <SessionPreview program={program} dayIndex={s.dayIndex} deload={s.deload} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionPreview({ program, dayIndex, deload }: { program: Program; dayIndex: number; deload: boolean }) {
  const day = program.days[dayIndex];
  const labels = supersetLabels(day.exercises);
  return (
    <div className="preview">
      {day.exercises.map((e, i) => {
        const weight = e.target?.weight ?? 0;
        const shown = deload ? deloadPreview(e.sets, weight, e.increment) : { sets: e.sets, weight };
        const bw = e.loadType === 'bodyweight';
        return (
          <div key={e.id} className="preview-line">
            <div>
              {labels[i] && <span className="ss">{labels[i]}</span>}
              {e.name}
            </div>
            <div className="small muted">
              {shown.sets} × {repRange(e.repMin, e.repMax)}
              {bw ? t(', bodyweight', ', lichaamsgewicht') : t(` at ${kg(shown.weight)} kg`, ` op ${kg(shown.weight)} kg`)}
              {e.weightNote && !bw ? ` ${e.weightNote}` : ''}
            </div>
            {!deload && !bw && e.increment > 0 && (
              <div className="small faint">
                {t(
                  `Next step: ${kg(addStep(weight, e.increment, 1))} kg once you hit ${e.sets} × ${e.repMax}`,
                  `Volgende stap: ${kg(addStep(weight, e.increment, 1))} kg zodra je ${e.sets} × ${e.repMax} haalt`,
                )}
              </div>
            )}
            {!deload && bw && (
              <div className="small faint">{t(`Next step: more reps, up to ${e.sets} × ${e.repMax}`, `Volgende stap: meer herhalingen, tot ${e.sets} × ${e.repMax}`)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProgramExplanationView({ sections }: { sections: ProgramExplanation[] }) {
  return (
    <div className="stack">
      {sections.map((s) => (
        <section key={s.title} className="panel stack" style={{ gap: 8 }}>
          <h3>{s.title}</h3>
          {s.text.map((line) => (
            <p key={line} className="small" style={{ margin: 0 }}>
              {line}
            </p>
          ))}
          {s.bullets && (
            <ul className="small muted" style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
