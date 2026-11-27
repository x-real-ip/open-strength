import { Link, useParams } from 'react-router-dom';
import { api } from '../api.ts';
import { DecisionTag, ErrorState, Loading, useLoad } from '../components/ui.tsx';
import { compact, kg } from '../format.ts';
import { t } from '../i18n.ts';

export default function SummaryPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useLoad(() => api.summary(Number(id)), [id]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? t('Not found', 'Niet gevonden')} onRetry={reload} />;
  const s = data.summary;
  const records = s.outcomes.flatMap((o) => o.newRecords.map((r) => `${o.name}: ${r}`));

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="muted small">{t('Workout done', 'Training klaar')}</div>
          <h1>{s.dayName}</h1>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="value">{s.durationMinutes}</div>
          <div className="label">{t('minutes', 'minuten')}</div>
        </div>
        <div className="stat">
          <div className="value">{s.totalSets}</div>
          <div className="label">sets</div>
        </div>
        <div className="stat">
          <div className="value">{compact(s.totalVolume)}</div>
          <div className="label">{t('kg volume', 'kg volume')}</div>
        </div>
      </div>

      {records.length > 0 && (
        <section className="section panel stack" style={{ gap: 6 }}>
          <h3>{t('New records', 'Nieuwe records')}</h3>
          {records.map((r) => (
            <div key={r} className="small">
              {r}
            </div>
          ))}
        </section>
      )}

      <section className="section">
        <h2>{t('Next workout', 'Volgende training')}</h2>
        <p className="muted small" style={{ marginTop: 6 }}>
          {t('Calculated from the sets you just logged.', 'Berekend uit de sets die je net hebt gelogd.')}
        </p>
        <div className="stack" style={{ marginTop: 12 }}>
          {s.outcomes.map((o) => {
            const bw = o.nextWeight === 0 && o.fromWeight === 0;
            return (
              <article className="outcome" key={o.programExerciseId}>
                <div className="spread">
                  <h3>{o.name}</h3>
                  <DecisionTag decision={o.decision} />
                </div>
                <div className="next">
                  {bw ? (
                    <span>
                      {o.repTargets.join(' / ')} {t('reps', 'herhalingen')}
                    </span>
                  ) : o.nextWeight !== o.fromWeight ? (
                    <>
                      <span className="from">{kg(o.fromWeight)}</span>
                      <span className="arrow" aria-label={t('to', 'naar')}>
                        →
                      </span>
                      <span>{kg(o.nextWeight)} kg</span>
                    </>
                  ) : (
                    <span>{kg(o.nextWeight)} kg</span>
                  )}
                </div>
                <p className="reason">{o.reason}</p>
                <div className="sets-line">
                  {t('Today', 'Vandaag')}: {o.sets.map((x) => (bw ? x.reps : `${kg(x.weight)}×${x.reps}`)).join(', ')}
                  {o.weightNote ? ` (${o.weightNote})` : ''}
                </div>
                {o.newRecords.map((r) => (
                  <span className="pr" key={r}>
                    {r}
                  </span>
                ))}
              </article>
            );
          })}
          {s.outcomes.length === 0 && <p className="muted">{t('No sets were logged in this workout.', 'In deze training zijn geen sets gelogd.')}</p>}
        </div>
      </section>

      <section className="section">
        <Link to="/" className="btn primary big block">
          {t('Done', 'Klaar')}
        </Link>
      </section>
    </main>
  );
}
