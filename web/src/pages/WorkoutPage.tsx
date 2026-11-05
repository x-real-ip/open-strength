import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ExerciseDef, LoggedSet, Workout, WorkoutExercise } from '@shared/types.ts';
import { api, dropQueuedSet, flushQueue, pendingCount, pendingFor, queueSet } from '../api.ts';
import { IconCheck, IconClose, IconSwap } from '../components/Icons.tsx';
import { loadRest, primeAudio, RestTimer, saveRest, type RestState } from '../components/RestTimer.tsx';
import { DecisionTag, ErrorState, Loading, Sheet, toast } from '../components/ui.tsx';
import { clock, kg, relativeDay, repRange, rest as restLabel } from '../format.ts';
import { addStep } from '../workoutMath.ts';

type SetsByExercise = Record<number, LoggedSet[]>;

interface Draft {
  weight: number;
  reps: number;
  rir: number | null;
}

function mergeLogged(w: Workout): SetsByExercise {
  const map: SetsByExercise = {};
  for (const ex of w.exercises) map[ex.programExerciseId] = [...ex.logged];
  // Sets that were logged on this device but not yet confirmed by the server win.
  for (const p of pendingFor(w.id)) {
    const list = (map[p.programExerciseId] ??= []);
    const i = list.findIndex((s) => s.setIndex === p.setIndex);
    const s: LoggedSet = { setIndex: p.setIndex, weight: p.weight, reps: p.reps, rir: p.rir, completed: p.completed };
    if (i >= 0) list[i] = s;
    else list.push(s);
  }
  for (const k of Object.keys(map)) map[Number(k)].sort((a, b) => a.setIndex - b.setIndex);
  return map;
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => {});
    void request();
    const onVisible = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}

export default function WorkoutPage() {
  const { id } = useParams();
  const workoutId = Number(id);
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState<SetsByExercise>({});
  const [current, setCurrent] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ weight: 0, reps: 0, rir: null });
  const [rest, setRest] = useState<RestState | null>(loadRest());
  const [now, setNow] = useState(Date.now());
  const [unsynced, setUnsynced] = useState(pendingCount());
  const [finishing, setFinishing] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const posKey = `overload.workout.${workoutId}.current`;

  const load = useCallback(async () => {
    try {
      const { workout: w } = await api.workout(workoutId);
      if (w.status === 'completed') {
        navigate(`/workout/${w.id}/summary`, { replace: true });
        return;
      }
      setWorkout(w);
      const merged = mergeLogged(w);
      setLogged(merged);
      const saved = Number(localStorage.getItem(posKey));
      const firstOpen = w.exercises.findIndex((e) => (merged[e.programExerciseId]?.length ?? 0) < e.sets);
      setCurrent(Number.isFinite(saved) && saved > 0 && saved < w.exercises.length ? saved : Math.max(0, firstOpen));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [workoutId, navigate, posKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useWakeLock(Boolean(workout));

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    const onQueue = (e: Event) => setUnsynced((e as CustomEvent<number>).detail);
    window.addEventListener('overload:queue', onQueue);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('overload:queue', onQueue);
    };
  }, []);

  const ex: WorkoutExercise | undefined = workout?.exercises[current];
  const sets = ex ? logged[ex.programExerciseId] ?? [] : [];
  const totalSets = Math.max(ex?.sets ?? 0, sets.length);
  const activeIndex = editing ?? (sets.length < (ex?.sets ?? 0) ? sets.length : null);

  // Prefill the editor: an edited set keeps its values; a new set uses the last weight
  // used this session (or the recommended weight) and the rep target for that set.
  useEffect(() => {
    if (!ex || activeIndex === null) return;
    const existing = sets.find((s) => s.setIndex === activeIndex);
    if (existing) {
      setDraft({ weight: existing.weight, reps: existing.reps, rir: existing.rir });
      return;
    }
    const lastWeight = sets.length ? sets[sets.length - 1].weight : ex.targetWeight;
    const reps = ex.repTargets[activeIndex] ?? ex.repTargets[ex.repTargets.length - 1] ?? ex.repMin;
    setDraft({ weight: lastWeight, reps, rir: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex?.programExerciseId, activeIndex, sets.length]);

  useEffect(() => {
    localStorage.setItem(posKey, String(current));
    const el = stripRef.current?.children[current] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [current, posKey]);

  const doneCount = useMemo(
    () => workout?.exercises.filter((e) => (logged[e.programExerciseId]?.length ?? 0) >= e.sets).length ?? 0,
    [workout, logged],
  );

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!workout || !ex) return <Loading />;

  const updateRest = (r: RestState | null) => {
    setRest(r);
    saveRest(r);
  };

  const commitSet = (index: number, values: Draft, extra = false) => {
    primeAudio();
    const s: LoggedSet = { setIndex: index, weight: values.weight, reps: values.reps, rir: values.rir, completed: true };
    const isCorrection = sets.some((x) => x.setIndex === index);
    const list = [...sets.filter((x) => x.setIndex !== index), s].sort((a, b) => a.setIndex - b.setIndex);
    const next = { ...logged, [ex.programExerciseId]: list };
    setLogged(next);
    setEditing(null);
    void queueSet({ workoutId, programExerciseId: ex.programExerciseId, ...s });

    if (isCorrection) return; // corrections don't restart the timer
    const exerciseDone = list.length >= ex.sets && !extra;
    const nextOpen = workout.exercises.findIndex((e, i) => i !== current && (next[e.programExerciseId]?.length ?? 0) < e.sets);
    if (!(exerciseDone && nextOpen === -1)) updateRest({ endsAt: Date.now() + ex.restSeconds * 1000, duration: ex.restSeconds });
    if (exerciseDone && nextOpen !== -1) {
      setCurrent(nextOpen);
      toast(`Next: ${workout.exercises[nextOpen].name}`);
    } else if (exerciseDone) {
      toast('All exercises done. Finish when ready.');
    }
  };

  const removeLastSet = async () => {
    const last = sets[sets.length - 1];
    if (!last) return;
    setLogged({ ...logged, [ex.programExerciseId]: sets.slice(0, -1) });
    setEditing(null);
    dropQueuedSet(workoutId, ex.programExerciseId, last.setIndex);
    try {
      await api.deleteSet(workoutId, ex.programExerciseId, last.setIndex);
    } catch {
      toast('Could not remove the set on the server');
    }
  };

  const finish = async () => {
    const missing = workout.exercises.reduce((a, e) => a + Math.max(0, e.sets - (logged[e.programExerciseId]?.length ?? 0)), 0);
    if (missing > 0 && !confirm(`${missing} planned set${missing === 1 ? ' is' : 's are'} not logged. Finish anyway?`)) return;
    setFinishing(true);
    await flushQueue();
    if (pendingFor(workoutId).length > 0) {
      setFinishing(false);
      toast('Some sets are not saved yet. Check your connection and try again.');
      return;
    }
    try {
      await api.finishWorkout(workoutId);
      updateRest(null);
      localStorage.removeItem(posKey);
      navigate(`/workout/${workoutId}/summary`, { replace: true });
    } catch (e) {
      toast((e as Error).message);
      setFinishing(false);
    }
  };

  const discard = async () => {
    if (!confirm('Discard this workout and all its logged sets?')) return;
    for (const p of pendingFor(workoutId)) dropQueuedSet(workoutId, p.programExerciseId, p.setIndex);
    await api.discardWorkout(workoutId);
    updateRest(null);
    localStorage.removeItem(posKey);
    navigate('/', { replace: true });
  };

  const elapsed = (now - new Date(workout.startedAt).getTime()) / 1000;
  const step = ex.increment;
  const bodyweight = ex.loadType === 'bodyweight';
  const showNext = sets.length >= ex.sets && editing === null && current < workout.exercises.length - 1;

  return (
    <main className="page no-nav">
      <div className="wk-top">
        <div className="bar">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="Leave workout (progress is kept)">
            <IconClose />
          </button>
          <div className="title">
            <strong>{workout.dayName}</strong>
            <span className="small muted">
              {clock(elapsed)}, {doneCount} of {workout.exercises.length} done
              {unsynced > 0 && <span className="sync-badge">, {unsynced} not synced</span>}
            </span>
          </div>
          <button className="btn primary" onClick={finish} disabled={finishing} style={{ minHeight: 44 }}>
            {finishing ? 'Saving…' : 'Finish'}
          </button>
        </div>
        <div className="strip" ref={stripRef} role="tablist" aria-label="Exercises">
          {workout.exercises.map((e, i) => {
            const n = logged[e.programExerciseId]?.length ?? 0;
            const done = n >= e.sets;
            return (
              <button
                key={e.programExerciseId}
                role="tab"
                aria-current={i === current}
                aria-selected={i === current}
                className={done ? 'done' : ''}
                onClick={() => {
                  setEditing(null);
                  setCurrent(i);
                }}
              >
                <span className="pip">{done ? '✓' : `${n}/${e.sets}`}</span>
                <span className="lbl">{e.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="ex-head" style={{ marginTop: 8 }}>
        <div className="spread" style={{ alignItems: 'flex-start' }}>
          <h2>{ex.name}</h2>
          {sets.length === 0 && (
            <button className="icon-btn" onClick={() => setSwapOpen(true)} aria-label="Swap exercise">
              <IconSwap />
            </button>
          )}
        </div>
        <div className="presc">
          <span>
            <b>{ex.sets}</b> sets of <b>{repRange(ex.repMin, ex.repMax)}</b> reps
          </span>
          <span>
            {bodyweight ? (
              <b>Bodyweight</b>
            ) : (
              <>
                <b>{kg(ex.targetWeight)} kg</b>
                {ex.weightNote ? ` ${ex.weightNote}` : ''}
              </>
            )}
          </span>
          <span>Rest {restLabel(ex.restSeconds)}</span>
        </div>
        <details className="advice">
          <summary className="spread" style={{ listStyle: 'none', cursor: 'pointer' }}>
            <DecisionTag decision={ex.decision} />
            <span className="faint small">Why this target?</span>
          </summary>
          <p>{ex.reason}</p>
          {ex.notes && <p>Cue: {ex.notes}</p>}
        </details>
        {ex.previous && (
          <div className="prev">
            Last time ({relativeDay(ex.previous.date).toLowerCase()}):{' '}
            <b>{ex.previous.sets.map((s) => (bodyweight ? `${s.reps}` : `${kg(s.weight)}×${s.reps}`)).join(', ')}</b>
          </div>
        )}
      </section>

      <section className="sets" aria-label="Sets">
        {Array.from({ length: totalSets + (activeIndex !== null && activeIndex >= totalSets ? 1 : 0) }, (_, i) => {
          const s = sets.find((x) => x.setIndex === i);
          if (i === activeIndex) {
            return (
              <div className="set-active" key={i}>
                <div className="spread">
                  <span className="set-no" style={{ color: 'var(--chalk)' }}>
                    Set {i + 1}
                  </span>
                  <span className="small muted">
                    Target {bodyweight ? '' : `${kg(ex.targetWeight)} kg × `}
                    {ex.repTargets[i] ?? ex.repMin}
                  </span>
                </div>
                <div className="steppers" style={bodyweight ? { gridTemplateColumns: '1fr' } : undefined}>
                  {!bodyweight && (
                    <div className="stepper">
                      <div className="cap">kg{ex.weightNote ? `, ${ex.weightNote}` : ''}</div>
                      <div className="ctrl">
                        <button type="button" aria-label="Less weight" onClick={() => setDraft((d) => ({ ...d, weight: addStep(d.weight, step, -1) }))}>
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          aria-label="Weight in kg"
                          value={Number.isFinite(draft.weight) ? draft.weight : ''}
                          onChange={(e) => setDraft((d) => ({ ...d, weight: parseFloat(e.target.value) }))}
                          onFocus={(e) => e.target.select()}
                        />
                        <button type="button" aria-label="More weight" onClick={() => setDraft((d) => ({ ...d, weight: addStep(d.weight, step, 1) }))}>
                          +
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="stepper">
                    <div className="cap">reps</div>
                    <div className="ctrl">
                      <button type="button" aria-label="Fewer reps" onClick={() => setDraft((d) => ({ ...d, reps: Math.max(0, d.reps - 1) }))}>
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        aria-label="Reps"
                        value={Number.isFinite(draft.reps) ? draft.reps : ''}
                        onChange={(e) => setDraft((d) => ({ ...d, reps: parseInt(e.target.value, 10) }))}
                        onFocus={(e) => e.target.select()}
                      />
                      <button type="button" aria-label="More reps" onClick={() => setDraft((d) => ({ ...d, reps: d.reps + 1 }))}>
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rir" role="group" aria-label="Reps in reserve (optional)">
                  <span>Reps left</span>
                  {[0, 1, 2, 3, 4].map((r) => (
                    <button key={r} type="button" aria-pressed={draft.rir === r} onClick={() => setDraft((d) => ({ ...d, rir: d.rir === r ? null : r }))}>
                      {r === 4 ? '4+' : r}
                    </button>
                  ))}
                </div>
                <button
                  className="log-btn"
                  disabled={!Number.isFinite(draft.weight) || !Number.isFinite(draft.reps)}
                  onClick={() => commitSet(i, { ...draft, weight: bodyweight ? 0 : draft.weight }, i >= ex.sets)}
                >
                  <IconCheck size={26} />
                  {s ? 'Update set' : `Log ${bodyweight ? '' : `${kg(draft.weight)} kg × `}${draft.reps}`}
                </button>
                {editing !== null && (
                  <div className="set-tools">
                    <button className="link-btn small" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          }
          if (s) {
            return (
              <button className="set-done" key={i} onClick={() => setEditing(i)} aria-label={`Set ${i + 1}, tap to edit`}>
                <span className="set-no">{i + 1}</span>
                <span className="result">
                  {bodyweight ? (
                    <>
                      {s.reps} <small>reps</small>
                    </>
                  ) : (
                    <>
                      {kg(s.weight)} <small>kg ×</small> {s.reps}
                    </>
                  )}
                </span>
                <span className="small muted">{s.rir !== null ? `${s.rir === 4 ? '4+' : s.rir} left` : ''}</span>
              </button>
            );
          }
          return (
            <div className="set-later" key={i}>
              <span className="set-no">{i + 1}</span>
              <span className="result">
                {bodyweight ? '' : `${kg(sets.length ? sets[sets.length - 1].weight : ex.targetWeight)} `}
                <small>{bodyweight ? '' : 'kg × '}</small>
                {ex.repTargets[i] ?? ex.repMin}
                {bodyweight && <small> reps</small>}
              </span>
              <span />
            </div>
          );
        })}
        <div className="set-tools">
          {sets.length >= ex.sets && editing === null ? (
            <button className="link-btn small" onClick={() => setEditing(sets.length)}>
              Add an extra set
            </button>
          ) : (
            <span />
          )}
          {sets.length > 0 && (
            <button className="link-btn small" onClick={removeLastSet}>
              Remove last set
            </button>
          )}
        </div>
      </section>

      <section className="section">
        <button className="btn danger block" onClick={discard}>
          Discard workout
        </button>
      </section>

      {(rest || showNext) && (
        <div className="dock">
          <div className="dock-inner">
            {rest && <RestTimer rest={rest} onChange={updateRest} />}
            {!rest && showNext && (
              <button className="btn primary big block" onClick={() => setCurrent(current + 1)}>
                Next: {workout.exercises[current + 1].name}
              </button>
            )}
          </div>
        </div>
      )}

      <SwapSheet
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        programExerciseId={ex.programExerciseId}
        onSwapped={async () => {
          setSwapOpen(false);
          await load();
          toast('Exercise swapped in your program');
        }}
      />
    </main>
  );
}

export function SwapSheet({ open, onClose, programExerciseId, onSwapped }: { open: boolean; onClose: () => void; programExerciseId: number; onSwapped: () => void }) {
  const [alts, setAlts] = useState<ExerciseDef[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAlts(null);
    api
      .alternatives(programExerciseId)
      .then((r) => setAlts(r.alternatives))
      .catch(() => setAlts([]));
  }, [open, programExerciseId]);

  return (
    <Sheet open={open} onClose={onClose} label="Swap exercise">
      <h2>Swap exercise</h2>
      <p className="muted small">Same sets and reps. The starting weight comes from your history with the new exercise, if any.</p>
      {!alts ? (
        <div className="spinner" style={{ margin: '20px auto' }} />
      ) : alts.length === 0 ? (
        <p className="muted">No alternatives with your equipment.</p>
      ) : (
        <div className="list">
          {alts.map((a) => (
            <button
              key={a.id}
              className="list-row"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.replaceExercise(programExerciseId, a.id);
                  onSwapped();
                } catch (e) {
                  toast((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="grow">
                <div className="title">{a.name}</div>
                <div className="sub">{a.equipment.filter((e) => e !== 'bodyweight').join(', ') || 'No equipment'}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
