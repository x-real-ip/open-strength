import { useState } from 'react';
import type { Program, ProgramExplanation } from '@shared/types.ts';
import { kg, repRange, supersetLabels } from '../format.ts';
import { addStep, deloadPreview } from '../workoutMath.ts';

interface Session {
  index: number;
  week: number;
  dayIndex: number;
  status: 'done' | 'next' | 'planned';
}

/** Every session of the block in order. Days rotate, so the next one follows the last completed day. */
function sessionsOf(program: Program): Session[] {
  const n = program.days.length;
  const done = program.completedWorkouts;
  return Array.from({ length: program.weeks * n }, (_, i) => ({
    index: i,
    week: Math.floor(i / n) + 1,
    dayIndex: i < done ? i % n : (program.nextDayIndex + (i - done)) % n,
    status: i < done ? 'done' : i === done ? 'next' : 'planned',
  }));
}

const STATUS: Record<Session['status'], string> = { done: 'gedaan', next: 'volgende', planned: 'gepland' };

export function ProgramLookahead({ program }: { program: Program }) {
  const sessions = sessionsOf(program);
  const [open, setOpen] = useState<number | null>(program.isComplete ? null : program.completedWorkouts);
  const weeks = Array.from({ length: program.weeks }, (_, w) => sessions.filter((s) => s.week === w + 1));

  if (program.isComplete) {
    return <p className="muted">Dit blok is afgerond. Maak het volgende blok op het Vandaag-scherm.</p>;
  }

  return (
    <div className="stack">
      <p className="faint small" style={{ margin: 0 }}>
        Gewichten in latere weken zijn je huidige doelen. Ze gaan omhoog zodra je de bovenkant van de herhalingen haalt; de volgende stap staat erbij.
      </p>
      {weeks.map((list, w) => {
        const week = w + 1;
        const deload = program.deloadWeek === week;
        const allDone = list.every((s) => s.status === 'done');
        return (
          <section key={week}>
            <div className="spread" style={{ marginBottom: 8 }}>
              <h3>
                Week {week}
                {week === program.currentWeek ? ' (nu)' : ''}
              </h3>
              {deload && <span className="tag deload">Deload</span>}
              {allDone && <span className="faint small">afgerond</span>}
            </div>
            {!allDone && (
              <div className="list">
                {list.map((s) => {
                  const day = program.days[s.dayIndex];
                  const expanded = open === s.index;
                  return (
                    <div key={s.index}>
                      <button className="list-row" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : s.index)}>
                        <div className="grow">
                          <div className="title" style={s.status === 'done' ? { color: 'var(--chalk-3)' } : undefined}>
                            {day.name}
                          </div>
                          <div className="sub">
                            Training {s.index + 1} van {sessions.length}, {STATUS[s.status]}
                          </div>
                        </div>
                        <span className="faint" aria-hidden="true">
                          {expanded ? '−' : '+'}
                        </span>
                      </button>
                      {expanded && <SessionPreview program={program} dayIndex={s.dayIndex} deload={deload} />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
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
              {bw ? ', lichaamsgewicht' : ` op ${kg(shown.weight)} kg`}
              {e.weightNote && !bw ? ` ${e.weightNote}` : ''}
            </div>
            {!deload && !bw && e.increment > 0 && (
              <div className="small faint">
                Volgende stap: {kg(addStep(weight, e.increment, 1))} kg zodra je {e.sets} × {e.repMax} haalt
              </div>
            )}
            {!deload && bw && <div className="small faint">Volgende stap: meer herhalingen, tot {e.sets} × {e.repMax}</div>}
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
          {s.text.map((t) => (
            <p key={t} className="small" style={{ margin: 0 }}>
              {t}
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
