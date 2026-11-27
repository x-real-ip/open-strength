import { useEffect, useState } from 'react';
import type { Equipment, LibraryExercise } from '@shared/types.ts';
import { api } from '../api.ts';
import { loadExercises } from '../exercises.ts';
import { equipmentText, hasEquipment } from '../format.ts';
import { t } from '../i18n.ts';
import { preferenceMessage, setPreference, usePreferences } from '../preferences.ts';
import { IconStar } from './Icons.tsx';
import { Sheet, toast } from './ui.tsx';

interface Option {
  id: string;
  name: string;
  equipment: Equipment[];
}

/**
 * Swap a program exercise for another one. Without a search it shows the best eight alternatives
 * (same movement pattern, favourites first); a search covers every exercise that fits the
 * equipment. Excluded exercises are never offered, and the current one can be excluded too.
 */
export function SwapSheet({
  open,
  onClose,
  programExerciseId,
  current,
  onSwapped,
}: {
  open: boolean;
  onClose: () => void;
  programExerciseId: number;
  current: { exerciseId: string; name: string };
  onSwapped: () => void;
}) {
  const prefs = usePreferences();
  const [alts, setAlts] = useState<Option[] | null>(null);
  const [all, setAll] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [neverAgain, setNeverAgain] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAlts(null);
    setQuery('');
    setNeverAgain(false);
    api
      .alternatives(programExerciseId)
      .then((r) => setAlts(r.alternatives))
      .catch(() => setAlts([]));
    // The search covers the whole library; the profile decides which equipment counts.
    Promise.all([loadExercises(), api.profile()])
      .then(([library, { profile }]) =>
        setAll(library.filter((e: LibraryExercise) => e.programmable && hasEquipment(e, profile?.equipment ?? null))),
      )
      .catch(() => setAll([]));
  }, [open, programExerciseId]);

  const excluded = new Set(prefs?.excluded ?? []);
  const favorites = new Set(prefs?.favorites ?? []);
  const allowed = (o: Option) => o.id !== current.exerciseId && !excluded.has(o.id);
  const q = query.trim().toLowerCase();
  let shown: Option[] = [];
  if (alts && q) {
    // Alternatives first (they fit best), then the rest of the library; favourites lead both.
    const seen = new Set<string>();
    const ranked = [...alts, ...all].filter((o) => !seen.has(o.id) && seen.add(o.id));
    shown = ranked
      .filter((o) => allowed(o) && o.name.toLowerCase().includes(q))
      .sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)))
      .slice(0, 40);
  } else if (alts) {
    shown = alts.filter(allowed).slice(0, 8);
  }

  const swap = async (to: Option) => {
    setBusy(true);
    try {
      await api.replaceExercise(programExerciseId, to.id);
      if (neverAgain) toast(preferenceMessage('excluded', await setPreference(current.exerciseId, 'excluded')));
      else toast(t('Exercise swapped', 'Oefening gewisseld'));
      onSwapped();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label={t('Swap exercise', 'Oefening wisselen')}>
      <h2>{t('Swap exercise', 'Oefening wisselen')}</h2>
      <p className="muted small">
        {t(
          `Swap ${current.name}. Sets and reps stay the same. The starting weight comes from your history with the new exercise, if there is any.`,
          `${current.name} wisselen. Sets en herhalingen blijven gelijk. Het startgewicht komt uit je historie met de nieuwe oefening, als die er is.`,
        )}
      </p>
      {!alts ? (
        <div className="spinner" style={{ margin: '20px auto' }} />
      ) : (
        <div className="stack">
          <input
            className="input"
            type="search"
            placeholder={t('Search all exercises', 'Zoeken in alle oefeningen')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('Search an exercise to swap to', 'Oefening zoeken om mee te wisselen')}
          />
          <label className="row small" style={{ gap: 8 }}>
            <input type="checkbox" checked={neverAgain} onChange={(e) => setNeverAgain(e.target.checked)} />
            {t(`Never use ${current.name} again`, `${current.name} nooit meer gebruiken`)}
          </label>
          <div className="list">
            {shown.length === 0 && (
              <p className="muted small" style={{ padding: '14px 16px', margin: 0 }}>
                {q
                  ? t('Nothing found.', 'Niets gevonden.')
                  : t('No similar exercises with your equipment. Search all exercises.', 'Geen vergelijkbare oefeningen met jouw apparatuur. Zoek in alle oefeningen.')}
              </p>
            )}
            {shown.map((o) => (
              <button key={o.id} className="list-row" disabled={busy} onClick={() => swap(o)}>
                <div className="grow">
                  <div className="title">
                    {favorites.has(o.id) && (
                      <span className="pref-mark favorite" title={t('Favourite', 'Favoriet')}>
                        <IconStar size={15} filled />
                        <span className="sr-only">{t('Favourite:', 'Favoriet:')}</span>
                      </span>
                    )}
                    {o.name}
                  </div>
                  <div className="sub">{equipmentText(o.equipment)}</div>
                </div>
              </button>
            ))}
          </div>
          {!q && (
            <p className="faint small" style={{ margin: 0 }}>
              {t('These are the best 8. Search to pick another exercise.', 'Hier staan de beste 8. Zoek om een andere oefening te kiezen.')}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
