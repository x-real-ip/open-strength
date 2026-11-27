import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ProgramExercise } from '@shared/types.ts';
import { api } from '../api.ts';
import { useInfo } from '../App.tsx';
import { IconChevron } from '../components/Icons.tsx';
import { ProgramExplanationView, ProgramLookahead } from '../components/ProgramLookahead.tsx';
import { DecisionTag, ErrorState, Loading, Sheet, toast, useLoad } from '../components/ui.tsx';
import { kg, repRange, rest, supersetLabels } from '../format.ts';
import { addStep } from '../workoutMath.ts';
import { PreferenceButtons } from '../components/PreferenceButtons.tsx';
import { SwapSheet } from '../components/SwapSheet.tsx';

export default function ProgramPage() {
  const info = useInfo();
  const [params] = useSearchParams();
  const { data, error, loading, reload } = useLoad(() => api.activeProgram());
  const [view, setView] = useState<'schema' | 'ahead' | 'how'>('schema');
  const [dayIdx, setDayIdx] = useState(0);
  const [selected, setSelected] = useState<ProgramExercise | null>(null);
  const [instructions, setInstructions] = useState(params.get('instructions') ?? '');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (params.get('instructions')) document.getElementById('change')?.scrollIntoView({ behavior: 'smooth' });
  }, [params, data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const program = data?.program;

  const generate = async (mode: 'adjust' | 'new') => {
    setBusy(mode);
    try {
      const res = await api.generateProgram(mode === 'adjust' ? { basedOnCurrent: true, instructions: instructions.trim() || undefined } : { instructions: instructions.trim() || undefined });
      await reload();
      setDayIdx(0);
      setView('schema');
      setInstructions('');
      toast(res.notice ?? (mode === 'adjust' ? 'Programma aangepast' : 'Nieuw programma staat klaar'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!program) {
    return (
      <main className="page">
        <div className="page-head">
          <h1>Programma</h1>
        </div>
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            Geen actief programma. Vul je profiel in en maak er dan een.
          </p>
          <Link className="btn block" to="/profile">
            Naar profiel
          </Link>
          <button className="btn primary block" onClick={() => generate('new')} disabled={Boolean(busy)}>
            {busy ? 'Bezig…' : 'Maak mijn programma'}
          </button>
        </div>
      </main>
    );
  }

  const day = program.days[Math.min(dayIdx, program.days.length - 1)];
  const ssLabels = supersetLabels(day.exercises);

  return (
    <main className="page">
      <div className="page-head" style={{ display: 'block' }}>
        <div className="muted small">
          Week {program.currentWeek} van {program.weeks}
          {program.deloadWeek ? `, deload in week ${program.deloadWeek}` : ''}
          {program.source === 'ai' ? ', ontworpen door AI' : ', regelgebaseerd'}
        </div>
        <h1 style={{ marginTop: 4 }}>{program.name}</h1>
        <Link className="link-btn small" to="/exercises" style={{ display: 'inline-block', marginTop: 8 }}>
          Alle oefeningen bekijken
        </Link>
      </div>

      <div className="chips" role="tablist" aria-label="Weergave" style={{ marginBottom: 16 }}>
        <button role="tab" aria-pressed={view === 'schema'} onClick={() => setView('schema')}>
          Schema
        </button>
        <button role="tab" aria-pressed={view === 'ahead'} onClick={() => setView('ahead')}>
          Vooruitkijken
        </button>
        <button role="tab" aria-pressed={view === 'how'} onClick={() => setView('how')}>
          Hoe het is opgebouwd
        </button>
      </div>

      {view === 'ahead' && <ProgramLookahead program={program} />}
      {view === 'how' && <ProgramExplanationView sections={data?.explanation ?? []} />}

      {view === 'schema' && program.days.length > 1 && (
        <div className="seg" role="tablist" style={{ marginBottom: 12, overflowX: 'auto' }}>
          {program.days.map((d, i) => (
            <button key={d.id} role="tab" aria-pressed={i === dayIdx} onClick={() => setDayIdx(i)} style={{ whiteSpace: 'nowrap' }}>
              {d.name}
            </button>
          ))}
        </div>
      )}

      {view === 'schema' && (
        <>
        <section>
          {day.focus && <p className="muted small" style={{ margin: '0 0 10px' }}>{day.focus}</p>}
          <div className="list">
            {day.exercises.map((e, i) => (
              <button className="list-row" key={e.id} onClick={() => setSelected(e)}>
                <div className="grow">
                  <div className="title">
                    {ssLabels[i] && <span className="ss">{ssLabels[i]}</span>}
                    {e.name}
                  </div>
                  <div className="sub">
                    {e.sets} × {repRange(e.repMin, e.repMax)}, rust {rest(e.restSeconds)}
                    {e.superset ? ' na de ronde' : ''}
                  </div>
                </div>
                <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>
                  {e.loadType === 'bodyweight' ? <span className="small muted">LG</span> : `${kg(e.target?.weight ?? 0)} kg`}
                </div>
                <IconChevron />
              </button>
            ))}
          </div>
        </section>

        <section className="section stack" id="change">
          <h2>Programma aanpassen</h2>
          {info.aiConfigured ? (
            <>
              <label className="field">
                <span>Wat moet er anders? (optioneel)</span>
                <textarea
                  className="textarea"
                  placeholder="Bijvoorbeeld: meer rugwerk, geen barbell squats, kortere trainingen"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </label>
              <button className="btn primary block" disabled={Boolean(busy)} onClick={() => generate('adjust')}>
                {busy === 'adjust' ? 'Bezig met aanpassen… (tot een minuut)' : 'Huidig programma aanpassen'}
              </button>
              <button className="btn block" disabled={Boolean(busy)} onClick={() => confirm('Dit programma vervangen door een compleet nieuw programma?') && generate('new')}>
                {busy === 'new' ? 'Bezig…' : 'Nieuw programma maken'}
              </button>
            </>
          ) : (
            <>
              <button className="btn block" disabled={Boolean(busy)} onClick={() => confirm('Het programma opnieuw opbouwen vanuit je profiel?') && generate('new')}>
                {busy ? 'Bezig…' : 'Opnieuw opbouwen vanuit profiel'}
              </button>
              <p className="faint small" style={{ margin: 0 }}>
                Geschreven wensen hebben AI nodig; zet die aan via Profiel → AI-instellingen. Zonder AI kun je nog steeds oefeningen wisselen en opnieuw opbouwen vanuit je profiel.
              </p>
            </>
          )}
          <p className="faint small" style={{ margin: 0 }}>
            Gewichten die je hebt opgebouwd gaan mee naar het nieuwe programma.
          </p>
        </section>
        </>
      )}

      <ExerciseSheet
        exercise={selected}
        onClose={() => setSelected(null)}
        onChanged={async () => {
          setSelected(null);
          await reload();
        }}
      />
    </main>
  );
}

function ExerciseSheet({ exercise, onClose, onChanged }: { exercise: ProgramExercise | null; onClose: () => void; onChanged: () => void }) {
  const [weight, setWeight] = useState(0);
  const [swap, setSwap] = useState(false);

  useEffect(() => {
    setWeight(exercise?.target?.weight ?? 0);
    setSwap(false);
  }, [exercise]);

  if (!exercise) return null;
  const bw = exercise.loadType === 'bodyweight';

  return (
    <>
      <Sheet open={!swap} onClose={onClose} label={exercise.name}>
        <div className="stack">
          <div className="spread">
            <h2>{exercise.name}</h2>
            {exercise.target && <DecisionTag decision={exercise.target.decision} />}
          </div>
          <div className="muted small">
            {exercise.sets} sets van {repRange(exercise.repMin, exercise.repMax)} herhalingen, rust {rest(exercise.restSeconds)}
            {exercise.weightNote ? `, gewicht ${exercise.weightNote}` : ''}
          </div>
          {exercise.target && <p className="small" style={{ margin: 0 }}>{exercise.target.reason}</p>}
          {exercise.notes && <p className="small muted" style={{ margin: 0 }}>Tip: {exercise.notes}</p>}

          {!bw && (
            <div className="stepper">
              <div className="cap">Volgend gewicht (kg)</div>
              <div className="ctrl">
                <button type="button" aria-label="Minder gewicht" onClick={() => setWeight((w) => addStep(w, exercise.increment, -1))}>
                  −
                </button>
                <input type="number" inputMode="decimal" step="any" aria-label="Gewicht in kg" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} />
                <button type="button" aria-label="Meer gewicht" onClick={() => setWeight((w) => addStep(w, exercise.increment, 1))}>
                  +
                </button>
              </div>
            </div>
          )}
          {!bw && weight !== exercise.target?.weight && (
            <button
              className="btn primary block"
              onClick={async () => {
                await api.setWeight(exercise.id, weight);
                toast('Gewicht aangepast');
                onChanged();
              }}
            >
              Volgende keer {kg(weight)} kg
            </button>
          )}
          <Link className="btn block" to={`/exercises/${encodeURIComponent(exercise.exerciseId)}`}>
            Hoe doe je dit?
          </Link>
          <button className="btn block" onClick={() => setSwap(true)}>
            Wisselen voor een andere oefening
          </button>
          <PreferenceButtons exerciseId={exercise.exerciseId} onChanged={(mark) => mark === 'excluded' && onChanged()} />
          <Link className="btn ghost block" to={`/progress/${encodeURIComponent(exercise.exerciseId)}`}>
            Historie bekijken
          </Link>
        </div>
      </Sheet>
      <SwapSheet
        open={swap}
        onClose={() => setSwap(false)}
        programExerciseId={exercise.id}
        current={{ exerciseId: exercise.exerciseId, name: exercise.name }}
        onSwapped={onChanged}
      />
    </>
  );
}
