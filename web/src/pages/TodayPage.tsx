import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.ts';
import { useInfo } from '../App.tsx';
import { ErrorState, Loading, toast, useLoad } from '../components/ui.tsx';
import { kg, relativeDay, repRange, supersetLabels, versionLabel } from '../format.ts';
import { t } from '../i18n.ts';
import { deloadPreview } from '../workoutMath.ts';

export default function TodayPage() {
  const info = useInfo();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => api.today());
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? t('Loading failed', 'Laden is mislukt')} onRetry={reload} />;

  if (!data.hasProfile) {
    return (
      <main className="page">
        <div className="center-screen">
          <div className="stack" style={{ justifyItems: 'center', maxWidth: 340 }}>
            <h1 style={{ fontSize: 64 }}>Overload</h1>
            <p className="muted">
              {t(
                'A training program that fits you, logging sets in seconds, and knowing exactly what you lift next time.',
                'Een trainingsprogramma dat bij jou past, sets loggen in een paar seconden, en precies weten wat je de volgende keer tilt.',
              )}
            </p>
            <Link className="btn primary big block" to="/profile">
              {t('Set up your profile', 'Profiel instellen')}
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
      toast(res.notice ?? t('Your new program is ready', 'Nieuw programma staat klaar'));
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
        <div className="brand">
          OVERLOAD <span className="version">{versionLabel(info.version)}</span>
        </div>
        {data.lastWorkout && (
          <Link to={`/workout/${data.lastWorkout.id}/summary`} className="faint small">
            {t('Last', 'Laatst')}: {data.lastWorkout.dayName}, {relativeDay(data.lastWorkout.finishedAt).toLowerCase()}
          </Link>
        )}
      </div>

      {data.inProgressWorkoutId && (
        <div className="panel stack" style={{ marginBottom: 16 }}>
          <div>
            <h3>{t('Workout in progress', 'Training bezig')}</h3>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {t('Your logged sets are saved. Carry on where you left off.', 'Je gelogde sets zijn bewaard. Ga verder waar je gebleven was.')}
            </p>
          </div>
          <Link className="btn primary block" to={`/workout/${data.inProgressWorkoutId}`}>
            {t('Continue workout', 'Verder met training')}
          </Link>
        </div>
      )}

      {!program && (
        <div className="panel stack">
          <h2>{t('No program yet', 'Nog geen programma')}</h2>
          <p className="muted" style={{ margin: 0 }}>{t('Make a program from your profile to get started.', 'Maak een programma op basis van je profiel om te beginnen.')}</p>
          <button className="btn primary big block" disabled={busy} onClick={() => build({})}>
            {busy ? t('Working…', 'Bezig…') : t('Make my program', 'Maak mijn programma')}
          </button>
        </div>
      )}

      {program?.isComplete && (
        <div className="panel stack" style={{ marginBottom: 16 }}>
          <h2>{t('Block complete', 'Blok afgerond')}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t(
              `You did all ${program.totalWorkouts} workouts of ${program.name}. Make the next block; your current weights carry over.`,
              `Je hebt alle ${program.totalWorkouts} trainingen van ${program.name} gedaan. Maak het volgende blok; je huidige gewichten gaan mee.`,
            )}
          </p>
          <button
            className="btn primary block"
            disabled={busy}
            onClick={() => build({ basedOnCurrent: true, instructions: 'The current block is complete. Build the next training block based on my results, varying exercises that stalled.' })}
          >
            {busy ? t('Working…', 'Bezig…') : t('Make the next block', 'Maak het volgende blok')}
          </button>
        </div>
      )}

      {program && nextDay && !data.inProgressWorkoutId && (
        <section className="hero-day">
          <header>
            <div className="spread">
              <span className="muted small">
                {t(`Workout ${program.workoutNumber} of ${program.totalWorkouts}`, `Training ${program.workoutNumber} van ${program.totalWorkouts}`)}
              </span>
              {data.isDeload && <span className="tag deload">Deload</span>}
            </div>
            <div className="day-name">{nextDay.name}</div>
            {nextDay.focus && <div className="muted small" style={{ marginTop: 6 }}>{nextDay.focus}</div>}
            {/* One segment per workout in the block; the deload ones are tinted. */}
            <div
              className="block-track"
              role="img"
              aria-label={t(
                `${program.completedWorkouts} of ${program.totalWorkouts} workouts done`,
                `${program.completedWorkouts} van ${program.totalWorkouts} trainingen gedaan`,
              )}
            >
              {Array.from({ length: program.totalWorkouts }, (_, i) => (
                <span
                  key={i}
                  className={`${i < program.completedWorkouts ? 'done' : ''} ${program.deloadFrom !== null && i + 1 >= program.deloadFrom ? 'deload' : ''}`}
                />
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
                    <small>{t('BW', 'LG')}</small>
                  ) : (
                    <>
                      {kg(shown.weight)}
                      <small>kg</small>
                    </>
                  )}
                </span>
                <span className="presc">
                  {shown.sets} × {repRange(e.repMin, e.repMax)} {t('reps', 'herhalingen')}
                  {e.weightNote ? `, ${e.weightNote}` : ''}
                </span>
              </div>
            );
          })}
          <div style={{ padding: 16 }}>
            <button className="btn primary big block" onClick={start} disabled={busy}>
              {t('Start workout', 'Start training')}
            </button>
          </div>
        </section>
      )}

      {program && (
        <section className="section">
          <div className="stat-row">
            <div className="stat">
              <div className="value">{data.workoutsThisWeek}</div>
              <div className="label">{t('this week', 'deze week')}</div>
            </div>
            <div className="stat">
              <div className="value">
                {program.completedWorkouts}
                <span className="faint" style={{ fontSize: 20 }}>/{program.totalWorkouts}</span>
              </div>
              <div className="label">{t('in this block', 'in dit blok')}</div>
            </div>
            <div className="stat">
              <div className="value">{Math.max(0, program.totalWorkouts - program.completedWorkouts)}</div>
              <div className="label">{t('to go', 'te gaan')}</div>
            </div>
          </div>
        </section>
      )}

      {data.stalled.length > 0 && (
        <section className="section">
          <h2 style={{ marginBottom: 12 }}>{t('Stalling', 'Stagneert')}</h2>
          <div className="list">
            {data.stalled.map((s) => (
              <Link key={s.exerciseId} className="list-row" to={`/progress/${encodeURIComponent(s.exerciseId)}`}>
                <div className="grow">
                  <div className="title">{s.name}</div>
                  <div className="sub">{t(`No progress in ${s.sessions} sessions`, `Geen vooruitgang in ${s.sessions} trainingen`)}</div>
                </div>
              </Link>
            ))}
          </div>
          <Link className="btn block" style={{ marginTop: 10 }} to="/coach?ask=stall">
            {t('Ask the coach what you can change', 'Vraag de coach wat je kunt veranderen')}
          </Link>
        </section>
      )}
    </main>
  );
}
