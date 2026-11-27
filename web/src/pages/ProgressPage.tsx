import { Link } from 'react-router-dom';
import { api } from '../api.ts';
import { BodyWeightSection } from '../components/BodyWeight.tsx';
import { BarChart } from '../components/Charts.tsx';
import { IconChevron } from '../components/Icons.tsx';
import { ErrorState, Loading, useLoad } from '../components/ui.tsx';
import { compact, kg, muscleLabel, relativeDay, shortDate } from '../format.ts';
import { locale, t } from '../i18n.ts';

export default function ProgressPage() {
  const { data, error, loading, reload } = useLoad(() => Promise.all([api.stats(), api.workouts()]));

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? t('Loading failed', 'Laden is mislukt')} onRetry={reload} />;
  const [stats, { workouts }] = data;

  if (stats.totals.workouts === 0) {
    return (
      <main className="page">
        <div className="page-head">
          <h1>{t('Progress', 'Voortgang')}</h1>
        </div>
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            {t(
              'Finish your first workout and your progress shows up here: volume, records and strength per exercise.',
              'Rond je eerste training af en je voortgang verschijnt hier: volume, records en kracht per oefening.',
            )}
          </p>
        </div>
        <BodyWeightSection />
      </main>
    );
  }

  const weekLabel = (iso: string) => new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  const maxMuscle = Math.max(...stats.muscles.map((m) => Math.max(m.setsPerWeekRecent, m.setsPerWeekPrevious)), 1);

  return (
    <main className="page">
      <div className="page-head">
        <h1>{t('Progress', 'Voortgang')}</h1>
        {stats.totals.firstWorkout && (
          <span className="faint small">
            {t('since', 'sinds')} {shortDate(stats.totals.firstWorkout)}
          </span>
        )}
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="value">{stats.totals.workouts}</div>
          <div className="label">{t('workouts', 'trainingen')}</div>
        </div>
        <div className="stat">
          <div className="value">{compact(stats.totals.sets)}</div>
          <div className="label">sets</div>
        </div>
        <div className="stat">
          <div className="value">{compact(stats.totals.volumeKg)}</div>
          <div className="label">{t('kg lifted', 'kg getild')}</div>
        </div>
      </div>

      <BodyWeightSection />

      <section className="section stack">
        <BarChart
          title={t('Workouts per week', 'Trainingen per week')}
          sub={t('Last 12 weeks', 'Laatste 12 weken')}
          data={stats.weekly.map((w) => ({
            label: weekLabel(w.weekStart),
            value: w.workouts,
            detail: t(`${w.workouts} workout${w.workouts === 1 ? '' : 's'}, ${w.sets} sets`, `${w.workouts} training${w.workouts === 1 ? '' : 'en'}, ${w.sets} sets`),
          }))}
        />
        <BarChart
          title={t('Training volume per week', 'Trainingsvolume per week')}
          sub={t('Weight × reps, summed over all sets', 'Gewicht × herhalingen, opgeteld over alle sets')}
          unit=" kg"
          data={stats.weekly.map((w) => ({ label: weekLabel(w.weekStart), value: w.volumeKg, detail: `${w.volumeKg.toLocaleString(locale())} kg` }))}
        />
      </section>

      {stats.muscles.length > 0 && (
        <section className="section">
          <h2>{t('Sets per muscle group', 'Sets per spiergroep')}</h2>
          <p className="muted small" style={{ margin: '6px 0 10px' }}>
            {t(
              'Weekly average over the last 4 weeks. The marker shows the 4 weeks before.',
              'Gemiddeld per week over de laatste 4 weken. Het streepje toont de 4 weken daarvoor.',
            )}
          </p>
          <div className="panel tight">
            {stats.muscles.map((m) => {
              const diff = m.setsPerWeekRecent - m.setsPerWeekPrevious;
              return (
                <div className="hbar" key={m.muscle}>
                  <span>{muscleLabel(m.muscle)}</span>
                  <div className="track" aria-hidden="true">
                    <div className="bar" style={{ width: `${(m.setsPerWeekRecent / maxMuscle) * 100}%` }} />
                    {m.setsPerWeekPrevious > 0 && <div className="prev" style={{ left: `${(m.setsPerWeekPrevious / maxMuscle) * 100}%` }} />}
                  </div>
                  <span className="v">
                    {m.setsPerWeekRecent}
                    {m.setsPerWeekPrevious > 0 && Math.abs(diff) >= 0.5 && (
                      <span className={diff > 0 ? 'trend-up' : 'trend-down'} aria-label={diff > 0 ? t('up', 'omhoog') : t('down', 'omlaag')}>
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
        <h2>{t('Exercises', 'Oefeningen')}</h2>
        <div className="list" style={{ marginTop: 12 }}>
          {stats.exercises.map((e) => {
            const change = e.firstE1rm > 0 ? ((e.lastE1rm - e.firstE1rm) / e.firstE1rm) * 100 : 0;
            const record = stats.records.find((r) => r.exerciseId === e.exerciseId);
            return (
              <Link className="list-row" key={e.exerciseId} to={`/progress/${encodeURIComponent(e.exerciseId)}`}>
                <div className="grow">
                  <div className="title">{e.name}</div>
                  <div className="sub">
                    {t(`${e.sessions} session${e.sessions === 1 ? '' : 's'}`, `${e.sessions} training${e.sessions === 1 ? '' : 'en'}`)}
                    {record && record.bestWeight > 0 ? `, ${t('best', 'beste')} ${kg(record.bestWeight)} kg × ${record.bestWeightReps}` : ''}
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
        <p className="faint small">
          {t('The percentages compare your estimated 1RM in the first and the last session.', 'De percentages vergelijken je geschatte 1RM in de eerste en de laatste training.')}
        </p>
      </section>

      <section className="section">
        <h2>{t('Recent workouts', 'Recente trainingen')}</h2>
        <div className="list" style={{ marginTop: 12 }}>
          {workouts.slice(0, 15).map((w) => (
            <Link className="list-row" key={w.id} to={`/workout/${w.id}/summary`}>
              <div className="grow">
                <div className="title">
                  {w.dayName}
                  {w.isDeload ? (
                    <span className="tag deload" style={{ marginLeft: 10 }}>
                      Deload
                    </span>
                  ) : null}
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
