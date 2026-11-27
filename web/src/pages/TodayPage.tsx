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
  if (error || !data) return <ErrorState message={error ?? 'Could not load'} onRetry={reload} />;

  if (!data.hasProfile) {
    return (
      <main className="page">
        <div className="center-screen">
          <div className="stack" style={{ justifyItems: 'center', maxWidth: 340 }}>
            <h1 style={{ fontSize: 64 }}>Overload</h1>
            <p className="muted">Get a training program built around you, log sets in seconds, and know exactly what to lift next time.</p>
            <Link className="btn primary big block" to="/profile">
              Set up your profile
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
      toast(res.notice ?? 'New program ready');
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
            Last: {data.lastWorkout.dayName}, {relativeDay(data.lastWorkout.finishedAt).toLowerCase()}
          </Link>
        )}
      </div>

      {data.inProgressWorkoutId && (
        <div className="panel stack" style={{ marginBottom: 16 }}>
          <div>
            <h3>Workout in progress</h3>
            <p className="muted small" style={{ margin: '4px 0 0' }}>Your logged sets are saved. Pick up where you left off.</p>
          </div>
          <Link className="btn primary block" to={`/workout/${data.inProgressWorkoutId}`}>
            Resume workout
          </Link>
        </div>
      )}

      {!program && (
        <div className="panel stack">
          <h2>No program yet</h2>
          <p className="muted" style={{ margin: 0 }}>Build a program from your profile to get started.</p>
          <button className="btn primary big block" disabled={busy} onClick={() => build({})}>
            {busy ? 'Building…' : 'Build my program'}
          </button>
        </div>
      )}

      {program?.isComplete && (
        <div className="panel stack" style={{ marginBottom: 16 }}>
          <h2>Block complete</h2>
          <p className="muted" style={{ margin: 0 }}>
            You finished all {program.weeks} weeks of {program.name}. Build the next block; your current weights carry over.
          </p>
          <button
            className="btn primary block"
            disabled={busy}
            onClick={() => build({ basedOnCurrent: true, instructions: 'The current block is complete. Build the next training block based on my results, varying exercises that stalled.' })}
          >
            {busy ? 'Building…' : 'Build next block'}
          </button>
        </div>
      )}

      {program && nextDay && !data.inProgressWorkoutId && (
        <section className="hero-day">
          <header>
            <div className="spread">
              <span className="muted small">
                Next workout, week {program.currentWeek} of {program.weeks}
              </span>
              {data.isDeload && <span className="tag deload">Deload week</span>}
            </div>
            <div className="day-name">{nextDay.name}</div>
            {nextDay.focus && <div className="muted small" style={{ marginTop: 6 }}>{nextDay.focus}</div>}
            <div className="week-track" aria-label={`Week ${program.currentWeek} of ${program.weeks}`}>
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
                    <small>BW</small>
                  ) : (
                    <>
                      {kg(shown.weight)}
                      <small>kg</small>
                    </>
                  )}
                </span>
                <span className="presc">
                  {shown.sets} × {repRange(e.repMin, e.repMax)} reps
                  {e.weightNote ? `, ${e.weightNote}` : ''}
                </span>
              </div>
            );
          })}
          <div style={{ padding: 16 }}>
            <button className="btn primary big block" onClick={start} disabled={busy}>
              Start workout
            </button>
          </div>
        </section>
      )}

      {program && (
        <section className="section">
          <div className="stat-row">
            <div className="stat">
              <div className="value">{data.workoutsThisWeek}</div>
              <div className="label">this week</div>
            </div>
            <div className="stat">
              <div className="value">{program.completedWorkouts}</div>
              <div className="label">in this program</div>
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
          <h2 style={{ marginBottom: 12 }}>Stalling</h2>
          <div className="list">
            {data.stalled.map((s) => (
              <Link key={s.exerciseId} className="list-row" to={`/progress/${s.exerciseId}`}>
                <div className="grow">
                  <div className="title">{s.name}</div>
                  <div className="sub">No improvement in {s.sessions} sessions</div>
                </div>
              </Link>
            ))}
          </div>
          <Link className="btn block" style={{ marginTop: 10 }} to="/coach?ask=stall">
            Ask the coach what to change
          </Link>
        </section>
      )}
    </main>
  );
}
