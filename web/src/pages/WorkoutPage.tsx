import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { LoggedSet, Workout, WorkoutExercise } from '@shared/types.ts';
import { api, dropQueuedSet, flushQueue, pendingCount, pendingFor, queueSet } from '../api.ts';
import { ExerciseGuide } from '../components/ExerciseGuide.tsx';
import { SwapSheet } from '../components/SwapSheet.tsx';
import { IconCheck, IconClose, IconSwap } from '../components/Icons.tsx';
import { useExercises } from '../exercises.ts';
import { loadRest, primeAudio, RestTimer, saveRest, type RestState } from '../components/RestTimer.tsx';
import { DecisionTag, ErrorState, Loading, Sheet, toast } from '../components/ui.tsx';
import { clock, kg, relativeDay, repRange, rest as restLabel, supersetLabels } from '../format.ts';
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
  const [guideOpen, setGuideOpen] = useState(false);
  const library = useExercises();
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

  const ssLabels = useMemo(() => (workout ? supersetLabels(workout.exercises) : []), [workout]);

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

  /** Indices of the exercises in the same superset as `i`; just [i] for straight sets. */
  const groupOf = (i: number): number[] => {
    const label = workout.exercises[i].superset;
    if (!label) return [i];
    return workout.exercises.flatMap((e, j) => (e.superset === label ? [j] : []));
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
    const count = (i: number) => next[workout.exercises[i].programExerciseId]?.length ?? 0;
    const open = (i: number) => count(i) < workout.exercises[i].sets;
    const startRest = () => updateRest({ endsAt: Date.now() + ex.restSeconds * 1000, duration: ex.restSeconds });

    const group = groupOf(current);
    if (group.length > 1 && !extra) {
      // Superset: go straight to a partner that hasn't done this round yet, without rest.
      const round = list.length;
      const behind = group.filter((i) => i !== current && count(i) < round && open(i));
      const partner = behind.find((i) => i > current) ?? behind[0];
      if (partner !== undefined) {
        updateRest(null);
        setCurrent(partner);
        toast(`Superset: ${workout.exercises[partner].name}`);
        return;
      }
      // End of the round: rest, then the first exercise of the superset with sets left,
      // or the next open exercise once the superset is done.
      const inGroup = group.find(open);
      const target = inGroup ?? workout.exercises.findIndex((_, i) => !group.includes(i) && open(i));
      if (target === -1) {
        toast('Alle oefeningen gedaan. Rond af als je klaar bent.');
        return;
      }
      startRest();
      if (target !== current) setCurrent(target);
      toast(inGroup !== undefined ? `Ronde klaar. Nu: ${workout.exercises[target].name}` : `Nu: ${workout.exercises[target].name}`);
      return;
    }

    const exerciseDone = list.length >= ex.sets && !extra;
    const nextOpen = workout.exercises.findIndex((e, i) => i !== current && (next[e.programExerciseId]?.length ?? 0) < e.sets);
    if (!(exerciseDone && nextOpen === -1)) startRest();
    if (exerciseDone && nextOpen !== -1) {
      setCurrent(nextOpen);
      toast(`Nu: ${workout.exercises[nextOpen].name}`);
    } else if (exerciseDone) {
      toast('Alle oefeningen gedaan. Rond af als je klaar bent.');
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
      toast('De set kon niet van de server verwijderd worden');
    }
  };

  const finish = async () => {
    const missing = workout.exercises.reduce((a, e) => a + Math.max(0, e.sets - (logged[e.programExerciseId]?.length ?? 0)), 0);
    if (missing > 0 && !confirm(`${missing} geplande set${missing === 1 ? ' is' : 's zijn'} niet gelogd. Toch afronden?`)) return;
    setFinishing(true);
    await flushQueue();
    if (pendingFor(workoutId).length > 0) {
      setFinishing(false);
      toast('Nog niet alle sets zijn opgeslagen. Controleer je verbinding en probeer het opnieuw.');
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
    if (!confirm('Deze training en alle gelogde sets weggooien?')) return;
    for (const p of pendingFor(workoutId)) dropQueuedSet(workoutId, p.programExerciseId, p.setIndex);
    await api.discardWorkout(workoutId);
    updateRest(null);
    localStorage.removeItem(posKey);
    navigate('/', { replace: true });
  };

  const elapsed = (now - new Date(workout.startedAt).getTime()) / 1000;
  const step = ex.increment;
  const bodyweight = ex.loadType === 'bodyweight';
  // The next exercise that still has sets to do (skips superset partners that are already done).
  const nextTarget = workout.exercises.findIndex((e, i) => i > current && (logged[e.programExerciseId]?.length ?? 0) < e.sets);
  const showNext = sets.length >= ex.sets && editing === null && nextTarget !== -1;

  return (
    <main className="page no-nav">
      <div className="wk-top">
        <div className="bar">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="Training verlaten (voortgang blijft bewaard)">
            <IconClose />
          </button>
          <div className="title">
            <strong>{workout.dayName}</strong>
            <span className="small muted">
              {clock(elapsed)}, {doneCount} van {workout.exercises.length} klaar
              {unsynced > 0 && <span className="sync-badge">, {unsynced} not synced</span>}
            </span>
          </div>
          <button className="btn primary" onClick={finish} disabled={finishing} style={{ minHeight: 44 }}>
            {finishing ? 'Opslaan…' : 'Afronden'}
          </button>
        </div>
        <div className="strip" ref={stripRef} role="tablist" aria-label="Oefeningen">
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
                <span className="lbl">
                  {ssLabels[i] ? `${ssLabels[i]} ` : ''}
                  {e.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="ex-head" style={{ marginTop: 8 }}>
        <div className="spread" style={{ alignItems: 'flex-start' }}>
          <h2>
            {ssLabels[current] && <span className="ss">{ssLabels[current]}</span>}
            {ex.name}
          </h2>
          {sets.length === 0 && (
            <button className="icon-btn" onClick={() => setSwapOpen(true)} aria-label="Oefening wisselen">
              <IconSwap />
            </button>
          )}
        </div>
        <div className="presc">
          <span>
            <b>{ex.sets}</b> sets van <b>{repRange(ex.repMin, ex.repMax)}</b> herhalingen
          </span>
          <span>
            {bodyweight ? (
              <b>Lichaamsgewicht</b>
            ) : (
              <>
                <b>{kg(ex.targetWeight)} kg</b>
                {ex.weightNote ? ` ${ex.weightNote}` : ''}
              </>
            )}
          </span>
          <span>
            Rust {restLabel(ex.restSeconds)}
            {ex.superset ? ' na de ronde' : ''}
          </span>
        </div>
        {library?.get(ex.exerciseId)?.steps.length ? (
          <button className="link-btn small" style={{ marginTop: 6 }} onClick={() => setGuideOpen(true)}>
            Hoe doe je dit?
          </button>
        ) : null}
        {ex.superset && (
          <p className="ss-note">
            Superset met{' '}
            {groupOf(current)
              .filter((i) => i !== current)
              .map((i) => workout.exercises[i].name)
              .join(' en ')}
            : één set van elk, dan rust.
          </p>
        )}
        <details className="advice">
          <summary className="spread" style={{ listStyle: 'none', cursor: 'pointer' }}>
            <DecisionTag decision={ex.decision} />
            <span className="faint small">Waarom dit doel?</span>
          </summary>
          <p>{ex.reason}</p>
          {ex.notes && <p>Tip: {ex.notes}</p>}
        </details>
        {ex.previous && (
          <div className="prev">
            Vorige keer ({relativeDay(ex.previous.date).toLowerCase()}):{' '}
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
                        <button type="button" aria-label="Minder gewicht" onClick={() => setDraft((d) => ({ ...d, weight: addStep(d.weight, step, -1) }))}>
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          aria-label="Gewicht in kg"
                          value={Number.isFinite(draft.weight) ? draft.weight : ''}
                          onChange={(e) => setDraft((d) => ({ ...d, weight: parseFloat(e.target.value) }))}
                          onFocus={(e) => e.target.select()}
                        />
                        <button type="button" aria-label="Meer gewicht" onClick={() => setDraft((d) => ({ ...d, weight: addStep(d.weight, step, 1) }))}>
                          +
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="stepper">
                    <div className="cap">herhalingen</div>
                    <div className="ctrl">
                      <button type="button" aria-label="Minder herhalingen" onClick={() => setDraft((d) => ({ ...d, reps: Math.max(0, d.reps - 1) }))}>
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        aria-label="Herhalingen"
                        value={Number.isFinite(draft.reps) ? draft.reps : ''}
                        onChange={(e) => setDraft((d) => ({ ...d, reps: parseInt(e.target.value, 10) }))}
                        onFocus={(e) => e.target.select()}
                      />
                      <button type="button" aria-label="Meer herhalingen" onClick={() => setDraft((d) => ({ ...d, reps: d.reps + 1 }))}>
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rir" role="group" aria-label="Herhalingen over (optioneel)">
                  <span>Nog over</span>
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
                  {s ? 'Set bijwerken' : `Log ${bodyweight ? '' : `${kg(draft.weight)} kg × `}${draft.reps}`}
                </button>
                {editing !== null && (
                  <div className="set-tools">
                    <button className="link-btn small" onClick={() => setEditing(null)}>
                      Annuleren
                    </button>
                  </div>
                )}
              </div>
            );
          }
          if (s) {
            return (
              <button className="set-done" key={i} onClick={() => setEditing(i)} aria-label={`Set ${i + 1}, tik om te wijzigen`}>
                <span className="set-no">{i + 1}</span>
                <span className="result">
                  {bodyweight ? (
                    <>
                      {s.reps} <small>herh.</small>
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
                {bodyweight && <small> herh.</small>}
              </span>
              <span />
            </div>
          );
        })}
        <div className="set-tools">
          {sets.length >= ex.sets && editing === null ? (
            <button className="link-btn small" onClick={() => setEditing(sets.length)}>
              Extra set toevoegen
            </button>
          ) : (
            <span />
          )}
          {sets.length > 0 && (
            <button className="link-btn small" onClick={removeLastSet}>
              Laatste set verwijderen
            </button>
          )}
        </div>
      </section>

      <section className="section">
        <button className="btn danger block" onClick={discard}>
          Training weggooien
        </button>
      </section>

      {(rest || showNext) && (
        <div className="dock">
          <div className="dock-inner">
            {rest && <RestTimer rest={rest} onChange={updateRest} />}
            {!rest && showNext && (
              <button className="btn primary big block" onClick={() => setCurrent(nextTarget)}>
                Volgende: {workout.exercises[nextTarget].name}
              </button>
            )}
          </div>
        </div>
      )}

      {library?.get(ex.exerciseId) && (
        <Sheet open={guideOpen} onClose={() => setGuideOpen(false)} label={ex.name}>
          <h2 style={{ marginBottom: 12 }}>{ex.name}</h2>
          <ExerciseGuide exercise={library.get(ex.exerciseId)!} />
        </Sheet>
      )}

      <SwapSheet
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        programExerciseId={ex.programExerciseId}
        current={{ exerciseId: ex.exerciseId, name: ex.name }}
        onSwapped={async () => {
          setSwapOpen(false);
          await load();
        }}
      />
    </main>
  );
}
