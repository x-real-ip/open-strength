import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.ts';
import { ErrorState, Loading, toast, useLoad } from '../components/ui.tsx';
import { kg, relativeDay, repRange, supersetLabels } from '../format.ts';
import { deloadPreview } from '../workoutMath.ts';

export default function TodayPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => api.today());
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Laden is mislukt'} onRetry={reload} />;

  if (!data.hasProfile) {
    return (
      <main className="page">
        <div className="center-screen">
          <div className="stack" style={{ justifyItems: 'center', maxWidth: 340 }}>
            <h1 style={{ fontSize: 64 }}>Overload</h1>
            <p className="muted">Een trainingsprogramma dat bij jou past, sets loggen in een paar seconden, en precies weten wat je de volgende keer tilt.</p>
            <Link className="btn primary big block" to="/profile">
              Profiel instellen
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const build = async (opts: Parameters<typeof api.generateProgram>[0]) => {
    setBusy(true);
    try {
      const res = await api.generateProgram(opts);
      toast(res.notice ?? 'Nieuw programma staat klaar');
      navigate('/program');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!data.nextDay) return;
    setBusy(true);
    try {
      const { workout } = await api.startWorkout(data.nextDay.id);
      navigate(`/workout/${workout.id}`);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };

  const { program, nextDay } = data;
  const ssLabels = nextDay ? supersetLabels(nextDay.exercises) : [];

  return (
    <main className="page">
      <div className="page-head">
        <div className="brand">OVERLOAD</div>
        {data.lastWorkout && (
          <Link to={`/workout/${data.lastWorkout.id}/summary`} className="faint small">
            Laatst: {data.lastWorkout.dayName}, {relativeDay(data.lastWorkout.finishedAt).toLowerCase()}
          </Link>
        )}
      </div>

      {data.inProgressWorkoutId && (
        <div className="panel stack" style={{ marginBottom: 16 }}>
          <div>
            <h3>Training bezig</h3>
            <p className="muted small" style={{ margin: '4px 0 0' }}>Je gelogde sets zijn bewaard. Ga verder waar je gebleven was.</p>
          </div>
          <Link className="btn primary block" to={`/workout/${data.inProgressWorkoutId}`}>
            Verder met training
          </Link>
        </div>
      )}

      {!program && (
        <div className="panel stack">
          <h2>Nog geen programma</h2>
          <p className="muted" style={{ margin: 0 }}>Maak een programma op basis van je profiel om te beginnen.</p>
          <button className="btn primary big block" disabled={busy} onClick={() => build({})}>
            {busy ? 'Bezig…' : 'Maak mijn programma'}
          </button>
        </div>
      )}

      {program?.isComplete && (
        <div className="panel stack" style={{ marginBottom: 16 }}>
          <h2>Blok afgerond</h2>
          <p className="muted" style={{ margin: 0 }}>
            Je hebt alle {program.weeks} weken van {program.name} gedaan. Maak het volgende blok; je huidige gewichten gaan mee.
          </p>
          <button
            className="btn primary block"
            disabled={busy}
            onClick={() => build({ basedOnCurrent: true, instructions: 'The current block is complete. Build the next training block based on my results, varying exercises that stalled.' })}
          >
            {busy ? 'Bezig…' : 'Maak het volgende blok'}
          </button>
        </div>
      )}

      {program && nextDay && !data.inProgressWorkoutId && (
        <section className="hero-day">
          <header>
            <div className="spread">
              <span className="muted small">
                Volgende training, week {program.currentWeek} van {program.weeks}
              </span>
              {data.isDeload && <span className="tag deload">Deloadweek</span>}
            </div>
            <div className="day-name">{nextDay.name}</div>
            {nextDay.focus && <div className="muted small" style={{ marginTop: 6 }}>{nextDay.focus}</div>}
            <div className="week-track" aria-label={`Week ${program.currentWeek} van ${program.weeks}`}>
              {Array.from({ length: program.weeks }, (_, i) => (
                <span key={i} className={`${i + 1 < program.currentWeek ? 'done' : ''} ${program.deloadWeek === i + 1 ? 'deload' : ''}`} />
              ))}
            </div>
          </header>
          {nextDay.exercises.map((e, i) => {
            const target = e.target?.weight ?? 0;
            const shown = data.isDeload ? deloadPreview(e.sets, target, e.increment) : { sets: e.sets, weight: target };
            return (
              <div className="ex-line" key={e.id}>
                <span className="name">
                  {ssLabels[i] && <span className="ss">{ssLabels[i]}</span>}
                  {e.name}
                </span>
                <span className="weight">
                  {e.loadType === 'bodyweight' ? (
                    <small>LG</small>
                  ) : (
                    <>
                      {kg(shown.weight)}
                      <small>kg</small>
                    </>
                  )}
                </span>
                <span className="presc">
                  {shown.sets} × {repRange(e.repMin, e.repMax)} herhalingen
                  {e.weightNote ? `, ${e.weightNote}` : ''}
                </span>
              </div>
            );
          })}
          <div style={{ padding: 16 }}>
            <button className="btn primary big block" onClick={start} disabled={busy}>
              Start training
            </button>
          </div>
        </section>
      )}

      {program && (
        <section className="section">
          <div className="stat-row">
            <div className="stat">
              <div className="value">{data.workoutsThisWeek}</div>
              <div className="label">deze week</div>
            </div>
            <div className="stat">
              <div className="value">{program.completedWorkouts}</div>
              <div className="label">in dit programma</div>
            </div>
            <div className="stat">
              <div className="value">
                {program.currentWeek}
                <span className="faint" style={{ fontSize: 20 }}>/{program.weeks}</span>
              </div>
              <div className="label">week</div>
            </div>
          </div>
        </section>
      )}

      {data.stalled.length > 0 && (
        <section className="section">
          <h2 style={{ marginBottom: 12 }}>Stagneert</h2>
          <div className="list">
            {data.stalled.map((s) => (
              <Link key={s.exerciseId} className="list-row" to={`/progress/${s.exerciseId}`}>
                <div className="grow">
                  <div className="title">{s.name}</div>
                  <div className="sub">Geen vooruitgang in {s.sessions} trainingen</div>
                </div>
              </Link>
            ))}
          </div>
          <Link className="btn block" style={{ marginTop: 10 }} to="/coach?ask=stall">
            Vraag de coach wat je kunt veranderen
          </Link>
        </section>
      )}
    </main>
  );
}
