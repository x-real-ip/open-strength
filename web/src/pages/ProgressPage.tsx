import { Link } from 'react-router-dom';
import { api } from '../api.ts';
import { BarChart } from '../components/Charts.tsx';
import { IconChevron } from '../components/Icons.tsx';
import { ErrorState, Loading, useLoad } from '../components/ui.tsx';
import { compact, kg, MUSCLE_LABEL, relativeDay, shortDate } from '../format.ts';

export default function ProgressPage() {
  const { data, error, loading, reload } = useLoad(() => Promise.all([api.stats(), api.workouts()]));

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load'} onRetry={reload} />;
  const [stats, { workouts }] = data;

  if (stats.totals.workouts === 0) {
    return (
      <main className="page">
        <div className="page-head">
          <h1>Progress</h1>
        </div>
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            Finish your first workout and your progress shows up here: volume, records and strength per exercise.
          </p>
        </div>
      </main>
    );
  }

  const weekLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const maxMuscle = Math.max(...stats.muscles.map((m) => Math.max(m.setsPerWeekRecent, m.setsPerWeekPrevious)), 1);

  return (
    <main className="page">
      <div className="page-head">
        <h1>Progress</h1>
        {stats.totals.firstWorkout && <span className="faint small">since {shortDate(stats.totals.firstWorkout)}</span>}
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="value">{stats.totals.workouts}</div>
          <div className="label">workouts</div>
        </div>
        <div className="stat">
          <div className="value">{compact(stats.totals.sets)}</div>
          <div className="label">sets</div>
        </div>
        <div className="stat">
          <div className="value">{compact(stats.totals.volumeKg)}</div>
          <div className="label">kg lifted</div>
        </div>
      </div>

      <section className="section stack">
        <BarChart
          title="Workouts per week"
          sub="Last 12 weeks"
          data={stats.weekly.map((w) => ({ label: weekLabel(w.weekStart), value: w.workouts, detail: `${w.workouts} workout${w.workouts === 1 ? '' : 's'}, ${w.sets} sets` }))}
        />
        <BarChart
          title="Training volume per week"
          sub="Weight × reps, summed over all sets"
          unit=" kg"
          data={stats.weekly.map((w) => ({ label: weekLabel(w.weekStart), value: w.volumeKg, detail: `${w.volumeKg.toLocaleString()} kg` }))}
        />
      </section>

      {stats.muscles.length > 0 && (
        <section className="section">
          <h2>Sets per muscle group</h2>
          <p className="muted small" style={{ margin: '6px 0 10px' }}>
            Weekly average over the last 4 weeks. The marker shows the 4 weeks before.
          </p>
          <div className="panel tight">
            {stats.muscles.map((m) => {
              const diff = m.setsPerWeekRecent - m.setsPerWeekPrevious;
              return (
                <div className="hbar" key={m.muscle}>
                  <span>{MUSCLE_LABEL[m.muscle]}</span>
                  <div className="track" aria-hidden="true">
                    <div className="bar" style={{ width: `${(m.setsPerWeekRecent / maxMuscle) * 100}%` }} />
                    {m.setsPerWeekPrevious > 0 && <div className="prev" style={{ left: `${(m.setsPerWeekPrevious / maxMuscle) * 100}%` }} />}
                  </div>
                  <span className="v">
                    {m.setsPerWeekRecent}
                    {m.setsPerWeekPrevious > 0 && Math.abs(diff) >= 0.5 && (
                      <span className={diff > 0 ? 'trend-up' : 'trend-down'} aria-label={diff > 0 ? 'up' : 'down'}>
                        {diff > 0 ? ' ▲' : ' ▼'}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <h2>Exercises</h2>
        <div className="list" style={{ marginTop: 12 }}>
          {stats.exercises.map((e) => {
            const change = e.firstE1rm > 0 ? ((e.lastE1rm - e.firstE1rm) / e.firstE1rm) * 100 : 0;
            const record = stats.records.find((r) => r.exerciseId === e.exerciseId);
            return (
              <Link className="list-row" key={e.exerciseId} to={`/progress/${e.exerciseId}`}>
                <div className="grow">
                  <div className="title">{e.name}</div>
                  <div className="sub">
                    {e.sessions} session{e.sessions === 1 ? '' : 's'}
                    {record && record.bestWeight > 0 ? `, best ${kg(record.bestWeight)} kg × ${record.bestWeightReps}` : ''}
                  </div>
                </div>
                {e.sessions > 1 && e.firstE1rm > 0 && (
                  <span className={`num ${change > 0 ? 'trend-up' : change < 0 ? 'trend-down' : 'faint'}`} style={{ fontSize: 18, fontWeight: 600 }}>
                    {change > 0 ? '+' : ''}
                    {change.toFixed(0)}%
                  </span>
                )}
                <IconChevron />
              </Link>
            );
          })}
        </div>
        <p className="faint small">Percentages compare your estimated 1-rep max in the first and latest session.</p>
      </section>

      <section className="section">
        <h2>Recent workouts</h2>
        <div className="list" style={{ marginTop: 12 }}>
          {workouts.slice(0, 15).map((w) => (
            <Link className="list-row" key={w.id} to={`/workout/${w.id}/summary`}>
              <div className="grow">
                <div className="title">
                  {w.dayName}
                  {w.isDeload ? <span className="tag deload" style={{ marginLeft: 10 }}>Deload</span> : null}
                </div>
                <div className="sub">
                  {relativeDay(w.finishedAt)}, {w.sets} sets, {compact(w.volume)} kg
                </div>
              </div>
              <IconChevron />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
