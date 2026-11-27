import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ExerciseCategory, ExercisePreference, ExerciseUsage, LibraryExercise, MuscleGroup } from '@shared/types.ts';
import { api } from '../api.ts';
import { IconBan, IconChevron, IconStar } from '../components/Icons.tsx';
import { PreferenceMark } from '../components/PreferenceButtons.tsx';
import { ErrorState, Loading, toast, useLoad } from '../components/ui.tsx';
import { CATEGORIES, categoryLabel, equipmentText, hasEquipment, MUSCLE_GROUPS, muscleLabel, relativeDay } from '../format.ts';
import { getLang, t } from '../i18n.ts';
import { loadExercises } from '../exercises.ts';
import { preferenceMessage, preferenceOf, setPreference, usePreferences } from '../preferences.ts';

/** "Mine" filters: what's in the program, what was trained, and the user's marks. */
type MineFilter = 'all' | 'program' | 'done' | ExercisePreference;
/** Favourites first and excluded last within a group; otherwise keep the library order. */
const MARK_ORDER: Record<string, number> = { favorite: 0, none: 1, excluded: 2 };

const MUSCLES = MUSCLE_GROUPS;

interface Group {
  key: string;
  title: string;
  items: LibraryExercise[];
}

export default function ExercisesPage() {
  const { data, error, loading, reload } = useLoad(() =>
    Promise.all([loadExercises(), api.profile(), api.activeProgram(), api.exerciseUsage().catch(() => ({}) as Record<string, ExerciseUsage>)]),
  );
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  const [onlyProgram, setOnlyProgram] = useState(false);
  const [mine, setMine] = useState<MineFilter>('all');
  const prefs = usePreferences();

  // Which program days each exercise is on, in program order.
  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const d of data?.[2].program?.days ?? []) for (const e of d.exercises) map.set(e.exerciseId, [...(map.get(e.exerciseId) ?? []), d.name]);
    return map;
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? t('Loading failed', 'Laden is mislukt')} onRetry={reload} />;

  const [exercises, { profile }, { program }, usage] = data;
  const equipment = profile?.equipment ?? null;
  const q = query.trim().toLowerCase();
  const markOf = (id: string) => preferenceOf(prefs, id);
  const matchesMine = (e: LibraryExercise) =>
    mine === 'all' ? true : mine === 'program' ? days.has(e.id) : mine === 'done' ? !!usage[e.id] : markOf(e.id) === mine;
  const shown = exercises.filter(
    (e) =>
      matchesMine(e) &&
      (!muscle || e.primary === muscle) &&
      (!category || e.category === category) &&
      (!q || e.name.toLowerCase().includes(q)) &&
      // Your own lists (program, trained, marked) show everything in them, whatever the equipment.
      (!onlyMine || mine !== 'all' || hasEquipment(e, equipment)) &&
      (!onlyProgram || e.programmable),
  );

  const count = (f: MineFilter) => exercises.filter((e) => (f === 'program' ? days.has(e.id) : f === 'done' ? !!usage[e.id] : markOf(e.id) === f)).length;
  const rank = (e: LibraryExercise) => MARK_ORDER[markOf(e.id) ?? 'none'];
  let groups: Group[];
  if (mine === 'program' && program) {
    // The program filter follows the program: one group per training day, in order.
    groups = program.days.map((d) => ({
      key: `day-${d.id}`,
      title: d.name,
      items: d.exercises.map((pe) => shown.find((e) => e.id === pe.exerciseId)).filter((e): e is LibraryExercise => !!e),
    }));
  } else if (mine === 'done') {
    groups = [{ key: 'done', title: t('Most done first', 'Meest gedaan eerst'), items: [...shown].sort((a, b) => usage[b.id].sessions - usage[a.id].sessions) }];
  } else {
    groups = MUSCLES.map((m) => ({ key: m, title: muscleLabel(m), items: shown.filter((e) => e.primary === m).sort((a, b) => rank(a) - rank(b)) }));
  }
  groups = groups.filter((g) => g.items.length);
  const programmable = exercises.filter((e) => e.programmable).length;
  const curated = exercises.filter((e) => e.source === 'overload').length;

  const chip = (f: MineFilter, label: ReactNode) => (
    <button type="button" aria-pressed={mine === f} onClick={() => setMine(mine === f ? 'all' : f)}>
      {label}
    </button>
  );

  return (
    <main className="page">
      <h1>{t('Exercises', 'Oefeningen')}</h1>
      <details className="why" style={{ margin: '8px 0 16px' }}>
        <summary>{t('How does this list work?', 'Hoe werkt deze lijst?')}</summary>
        <p className="muted small">
          {t(
            `${exercises.length} exercises. ${programmable} of them can be in your program: when you swap an exercise and when the AI makes a program. The rule-based program picks from the ${curated} core exercises and from your favourites. The rest comes from free-exercise-db.`,
            `${exercises.length} oefeningen. ${programmable} daarvan kunnen in je programma: bij het wisselen van een oefening en als de AI een programma maakt. Het programma op basis van regels kiest uit de ${curated} vaste oefeningen met Nederlandse uitleg, en uit je favorieten. De rest komt uit free-exercise-db en heeft Engelse namen en uitleg.`,
          )}
        </p>
        {getLang() === 'nl' ? (
          <p className="muted small">
            Tik op de <IconStar size={14} /> om een oefening favoriet te maken: de AI en de regels zetten favorieten in je schema waar ze passen. Wil je een
            oefening nooit meer, open hem dan en kies <strong>Niet gebruiken</strong>.
          </p>
        ) : (
          <p className="muted small">
            Tap the <IconStar size={14} /> to make an exercise a favourite: the AI and the rules put favourites in your schedule where they fit. Never want an
            exercise again? Open it and choose <strong>Never use</strong>.
          </p>
        )}
      </details>

      <div className="stack" style={{ marginBottom: 16 }}>
        <div className="chips" role="group" aria-label={t('My exercises', 'Mijn oefeningen')}>
          <button type="button" aria-pressed={mine === 'all'} onClick={() => setMine('all')}>
            {t('All', 'Alles')}
          </button>
          {chip('program', `${t('In my program', 'In mijn programma')} (${count('program')})`)}
          {chip('done', `${t('Done', 'Gedaan')} (${count('done')})`)}
          {chip(
            'favorite',
            <>
              <span className="pref-mark favorite">
                <IconStar size={15} filled />
              </span>
              {t('Favourites', 'Favorieten')} ({prefs?.favorites.length ?? 0})
            </>,
          )}
          {chip(
            'excluded',
            <>
              <span className="pref-mark excluded">
                <IconBan size={15} />
              </span>
              {t('Never use', 'Niet gebruiken')} ({prefs?.excluded.length ?? 0})
            </>,
          )}
        </div>
        <input className="input" type="search" placeholder={t('Search', 'Zoeken')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('Search exercises', 'Oefening zoeken')} />
        <div className="chips" role="group" aria-label={t('Muscle group', 'Spiergroep')}>
          <button type="button" aria-pressed={muscle === null} onClick={() => setMuscle(null)}>
            {t('All muscles', 'Alle spieren')}
          </button>
          {MUSCLES.map((m) => (
            <button key={m} type="button" aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {muscleLabel(m)}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label={t('Type', 'Soort')}>
          <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)}>
            {t('All types', 'Alle soorten')}
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {categoryLabel(c)}
            </button>
          ))}
        </div>
        {equipment && mine === 'all' && (
          <label className="row small muted" style={{ gap: 8 }}>
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            {t('Only exercises with my equipment', 'Alleen oefeningen met mijn apparatuur')}
          </label>
        )}
        <label className="row small muted" style={{ gap: 8 }}>
          <input type="checkbox" checked={onlyProgram} onChange={(e) => setOnlyProgram(e.target.checked)} />
          {t('Only exercises that can be in a program', 'Alleen oefeningen die in een programma kunnen')}
        </label>
        <p className="faint small" style={{ margin: 0 }}>
          {shown.length} {shown.length === 1 ? t('exercise', 'oefening') : t('exercises', 'oefeningen')}
        </p>
      </div>

      {groups.length === 0 && (
        <p className="muted">
          {mine === 'program'
            ? t('You have no program yet. Make one under Program.', 'Je hebt nog geen programma. Maak er een via Programma.')
            : mine === 'done'
              ? t('You have not finished a workout yet.', 'Je hebt nog geen training afgerond.')
              : mine === 'favorite'
                ? t('No favourites yet. Tap the star next to an exercise.', 'Nog geen favorieten. Tik op de ster bij een oefening.')
                : mine === 'excluded'
                  ? t('You have no exercises set to "never use".', 'Je hebt geen oefeningen op "niet gebruiken" staan.')
                  : t('No exercises found.', 'Geen oefeningen gevonden.')}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.key} className="section" style={{ marginTop: 0, marginBottom: 20 }}>
          <h2 style={{ marginBottom: 10 }}>{g.title}</h2>
          <div className="list">
            {g.items.map((e) => (
              <ExerciseRow
                key={e.id}
                exercise={e}
                available={hasEquipment(e, equipment)}
                days={days.get(e.id) ?? []}
                usage={usage[e.id]}
                mark={markOf(e.id)}
                ready={!!prefs}
              />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function ExerciseRow({
  exercise: e,
  available,
  days,
  usage,
  mark,
  ready,
}: {
  exercise: LibraryExercise;
  available: boolean;
  /** Program days this exercise is on. */
  days: string[];
  usage?: ExerciseUsage;
  mark: ExercisePreference | null;
  ready: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const notes = [
    mark === 'excluded' ? t('never use', 'niet gebruiken') : null,
    equipmentText(e.equipment, e.otherEquipment),
    e.category !== 'strength' ? categoryLabel(e.category) : null,
    !e.programmable ? t('view only', 'alleen bekijken') : null,
    !available ? t('not with your equipment', 'niet met jouw apparatuur') : null,
  ].filter(Boolean);

  const toggleFavorite = async () => {
    const next = mark === 'favorite' ? null : 'favorite';
    setBusy(true);
    try {
      toast(preferenceMessage(next, await setPreference(e.id, next)));
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`list-row pref-row ${available ? '' : 'unavailable'} ${mark === 'excluded' ? 'excluded-row' : ''}`}>
      <Link to={`/exercises/${encodeURIComponent(e.id)}`}>
        {e.photos[0] ? <img className="thumb" src={e.photos[0]} alt="" loading="lazy" crossOrigin="anonymous" /> : <span className="thumb" aria-hidden="true" />}
        <div className="grow">
          <div className="title">
            {/* The filled star on the right marks favourites; excluded ones get a mark here. */}
            {mark === 'excluded' && <PreferenceMark mark={mark} />}
            {e.name}
          </div>
          <div className="sub">{notes.join(' · ')}</div>
          {(days.length > 0 || usage) && (
            <div className="pills">
              {days.length > 0 && (
                <span className="pill program">
                  {t('In program', 'In programma')}: {days.join(', ')}
                </span>
              )}
              {usage && (
                <span className="pill done">
                  {t(`Done ${usage.sessions}×`, `${usage.sessions}× gedaan`)} · {relativeDay(usage.lastDone).toLowerCase()}
                </span>
              )}
            </div>
          )}
        </div>
        <IconChevron />
      </Link>
      {e.programmable && (
        <button
          type="button"
          className="star"
          aria-pressed={mark === 'favorite'}
          aria-label={t(`${e.name} favourite`, `${e.name} favoriet`)}
          disabled={busy || !ready}
          onClick={toggleFavorite}
        >
          <IconStar size={22} filled={mark === 'favorite'} />
        </button>
      )}
    </div>
  );
}
