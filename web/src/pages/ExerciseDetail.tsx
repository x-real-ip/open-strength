import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.ts';
import { BarChart, LineChart } from '../components/Charts.tsx';
import { IconBack } from '../components/Icons.tsx';
import { ErrorState, Loading, useLoad } from '../components/ui.tsx';
import { kg, shortDate } from '../format.ts';

export default function ExerciseDetail() {
  const { exerciseId = '' } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => api.exerciseHistory(exerciseId), [exerciseId]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Niet gevonden'} onRetry={reload} />;

  const sessions = data.sessions;
  const loaded = sessions.some((s) => s.topWeight > 0);
  const best = sessions.reduce((b, s) => (s.e1rm > b ? s.e1rm : b), 0);

  return (
    <main className="page">
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Terug">
          <IconBack />
        </button>
      </div>
      <h1>{data.name}</h1>
      <p className="muted small" style={{ marginTop: 8 }}>
        {sessions.length} training{sessions.length === 1 ? '' : 'en'}
        {loaded && best > 0 ? `, beste geschatte 1RM ${kg(Math.round(best * 10) / 10)} kg` : ''}
      </p>

      {sessions.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>Nog geen sets gelogd voor deze oefening.</p>
        </div>
      ) : (
        <div className="stack section">
          {loaded ? (
            <>
              <LineChart
                title="Geschatte 1RM"
                sub="Uit je beste set per training (formule van Epley)"
                unit=" kg"
                data={sessions.map((s) => ({ label: shortDate(s.date), value: s.e1rm, detail: `${kg(Math.round(s.e1rm * 10) / 10)} kg` }))}
              />
              <LineChart
                title="Zwaarste gewicht"
                unit=" kg"
                data={sessions.map((s) => ({ label: shortDate(s.date), value: s.topWeight, detail: `${kg(s.topWeight)} kg` }))}
              />
            </>
          ) : null}
          <BarChart
            title="Totaal herhalingen per training"
            data={sessions.map((s) => ({ label: shortDate(s.date), value: s.totalReps, detail: `${s.totalReps} herhalingen` }))}
          />

          <section className="section">
            <h2>Trainingen</h2>
            <div className="list" style={{ marginTop: 12 }}>
              {[...sessions].reverse().map((s, i) => (
                <div className="list-row" key={i}>
                  <div className="grow">
                    <div className="title">
                      {shortDate(s.date)}
                      {s.isDeload && <span className="tag deload" style={{ marginLeft: 10 }}>Deload</span>}
                    </div>
                    <div className="sub">
                      {s.sets.map((x) => (loaded ? `${kg(x.weight)}×${x.reps}` : `${x.reps}`)).join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
