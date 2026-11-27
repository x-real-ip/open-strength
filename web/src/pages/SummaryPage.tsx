import { Link, useParams } from 'react-router-dom';
import { api } from '../api.ts';
import { DecisionTag, ErrorState, Loading, useLoad } from '../components/ui.tsx';
import { compact, kg } from '../format.ts';

export default function SummaryPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useLoad(() => api.summary(Number(id)), [id]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Niet gevonden'} onRetry={reload} />;
  const s = data.summary;
  const records = s.outcomes.flatMap((o) => o.newRecords.map((r) => `${o.name}: ${r}`));

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="muted small">Training klaar</div>
          <h1>{s.dayName}</h1>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="value">{s.durationMinutes}</div>
          <div className="label">minuten</div>
        </div>
        <div className="stat">
          <div className="value">{s.totalSets}</div>
          <div className="label">sets</div>
        </div>
        <div className="stat">
          <div className="value">{compact(s.totalVolume)}</div>
          <div className="label">kg volume</div>
        </div>
      </div>

      {records.length > 0 && (
        <section className="section panel stack" style={{ gap: 6 }}>
          <h3>Nieuwe records</h3>
          {records.map((r) => (
            <div key={r} className="small">
              {r}
            </div>
          ))}
        </section>
      )}

      <section className="section">
        <h2>Volgende training</h2>
        <p className="muted small" style={{ marginTop: 6 }}>
          Calculated from the sets you just logged.
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
                    <span>{o.repTargets.join(' / ')} herhalingen</span>
                  ) : o.nextWeight !== o.fromWeight ? (
                    <>
                      <span className="from">{kg(o.fromWeight)}</span>
                      <span className="arrow" aria-label="naar">
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
                  Vandaag: {o.sets.map((x) => (bw ? x.reps : `${kg(x.weight)}×${x.reps}`)).join(', ')}
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
          {s.outcomes.length === 0 && <p className="muted">In deze training zijn geen sets gelogd.</p>}
        </div>
      </section>

      <section className="section">
        <Link to="/" className="btn primary big block">
          Klaar
        </Link>
      </section>
    </main>
  );
}
