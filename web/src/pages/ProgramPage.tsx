import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ProgramExercise } from '@shared/types.ts';
import { api } from '../api.ts';
import { useInfo } from '../App.tsx';
import { IconChevron } from '../components/Icons.tsx';
import { DecisionTag, ErrorState, Loading, Sheet, toast, useLoad } from '../components/ui.tsx';
import { kg, repRange, rest, supersetLabels } from '../format.ts';
import { addStep } from '../workoutMath.ts';
import { SwapSheet } from './WorkoutPage.tsx';

export default function ProgramPage() {
  const info = useInfo();
  const [params] = useSearchParams();
  const { data, error, loading, reload, setData } = useLoad(() => api.activeProgram());
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
      setData({ program: res.program });
      setDayIdx(0);
      setInstructions('');
      toast(res.notice ?? (mode === 'adjust' ? 'Program adjusted' : 'New program ready'));
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
          <h1>Program</h1>
        </div>
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            No active program. Fill in your profile, then build one.
          </p>
          <Link className="btn block" to="/profile">
            Go to profile
          </Link>
          <button className="btn primary block" onClick={() => generate('new')} disabled={Boolean(busy)}>
            {busy ? 'Building…' : 'Build my program'}
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
          Week {program.currentWeek} of {program.weeks}
          {program.deloadWeek ? `, deload in week ${program.deloadWeek}` : ''}
          {program.source === 'ai' ? ', designed by AI' : ', rule-based'}
        </div>
        <h1 style={{ marginTop: 4 }}>{program.name}</h1>
      </div>

      {program.rationale && (
        <details className="why panel tight" style={{ marginBottom: 16 }}>
          <summary>Why this program</summary>
          <p className="muted small" style={{ marginBottom: 0 }}>
            {program.rationale}
          </p>
        </details>
      )}

      {program.days.length > 1 && (
        <div className="seg" role="tablist" style={{ marginBottom: 12, overflowX: 'auto' }}>
          {program.days.map((d, i) => (
            <button key={d.id} role="tab" aria-pressed={i === dayIdx} onClick={() => setDayIdx(i)} style={{ whiteSpace: 'nowrap' }}>
              {d.name}
            </button>
          ))}
        </div>
      )}

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
                  {e.sets} × {repRange(e.repMin, e.repMax)}, rest {rest(e.restSeconds)}
                  {e.superset ? ' after the round' : ''}
                </div>
              </div>
              <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>
                {e.loadType === 'bodyweight' ? <span className="small muted">BW</span> : `${kg(e.target?.weight ?? 0)} kg`}
              </div>
              <IconChevron />
            </button>
          ))}
        </div>
      </section>

      <section className="section stack" id="change">
        <h2>Change the program</h2>
        {info.aiConfigured ? (
          <>
            <label className="field">
              <span>What should change? (optional)</span>
              <textarea
                className="textarea"
                placeholder="For example: more back work, no barbell squats, shorter sessions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </label>
            <button className="btn primary block" disabled={Boolean(busy)} onClick={() => generate('adjust')}>
              {busy === 'adjust' ? 'Adjusting… (up to a minute)' : 'Adjust current program'}
            </button>
            <button className="btn block" disabled={Boolean(busy)} onClick={() => confirm('Replace this program with a completely new one?') && generate('new')}>
              {busy === 'new' ? 'Building…' : 'Build a new program'}
            </button>
          </>
        ) : (
          <>
            <button className="btn block" disabled={Boolean(busy)} onClick={() => confirm('Rebuild the program from your profile?') && generate('new')}>
              {busy ? 'Building…' : 'Rebuild from profile'}
            </button>
            <p className="faint small" style={{ margin: 0 }}>
              Written requests need AI. Add an API key on the server to enable it. Without it you can still swap exercises and rebuild from your profile.
            </p>
          </>
        )}
        <p className="faint small" style={{ margin: 0 }}>
          Weights you have earned carry over to the new program.
        </p>
      </section>

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
            {exercise.sets} sets of {repRange(exercise.repMin, exercise.repMax)} reps, rest {rest(exercise.restSeconds)}
            {exercise.weightNote ? `, weight ${exercise.weightNote}` : ''}
          </div>
          {exercise.target && <p className="small" style={{ margin: 0 }}>{exercise.target.reason}</p>}
          {exercise.notes && <p className="small muted" style={{ margin: 0 }}>Cue: {exercise.notes}</p>}

          {!bw && (
            <div className="stepper">
              <div className="cap">Next weight (kg)</div>
              <div className="ctrl">
                <button type="button" aria-label="Less weight" onClick={() => setWeight((w) => addStep(w, exercise.increment, -1))}>
                  −
                </button>
                <input type="number" inputMode="decimal" step="any" aria-label="Weight in kg" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} />
                <button type="button" aria-label="More weight" onClick={() => setWeight((w) => addStep(w, exercise.increment, 1))}>
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
                toast('Weight updated');
                onChanged();
              }}
            >
              Use {kg(weight)} kg next time
            </button>
          )}
          <button className="btn block" onClick={() => setSwap(true)}>
            Swap for another exercise
          </button>
          <Link className="btn ghost block" to={`/progress/${exercise.exerciseId}`}>
            View history
          </Link>
        </div>
      </Sheet>
      <SwapSheet
        open={swap}
        onClose={() => setSwap(false)}
        programExerciseId={exercise.id}
        onSwapped={() => {
          toast('Exercise swapped');
          onChanged();
        }}
      />
    </>
  );
}
