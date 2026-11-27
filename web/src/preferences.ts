// Favourite and excluded exercises, shared by the library, the guide page and the swap sheet.
// One copy per page load; every change goes through `setPreference` so all screens stay in sync.
import { useEffect, useState } from 'react';
import type { ExercisePreference, ExercisePreferences, PreferenceUpdate } from '@shared/types.ts';
import { api } from './api.ts';
import { t } from './i18n.ts';

let current: ExercisePreferences | null = null;
let loading: Promise<ExercisePreferences> | null = null;
const listeners = new Set<(p: ExercisePreferences) => void>();

function publish(p: ExercisePreferences) {
  current = p;
  listeners.forEach((l) => l(p));
}

export function loadPreferences(): Promise<ExercisePreferences> {
  if (current) return Promise.resolve(current);
  loading ??= api
    .preferences()
    .then((p) => {
      publish(p);
      return p;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

export async function setPreference(exerciseId: string, preference: ExercisePreference | null): Promise<PreferenceUpdate> {
  const res = await api.setPreference(exerciseId, preference);
  publish(res.preferences);
  return res;
}

export function preferenceOf(p: ExercisePreferences | null, id: string): ExercisePreference | null {
  if (!p) return null;
  return p.favorites.includes(id) ? 'favorite' : p.excluded.includes(id) ? 'excluded' : null;
}

/** Current marks; null while loading (or when loading failed). */
export function usePreferences(): ExercisePreferences | null {
  const [prefs, setPrefs] = useState(current);
  useEffect(() => {
    listeners.add(setPrefs);
    loadPreferences().catch(() => undefined);
    return () => {
      listeners.delete(setPrefs);
    };
  }, []);
  return prefs;
}

/** Toast text after marking, including what was swapped out of the program. */
export function preferenceMessage(preference: ExercisePreference | null, res: PreferenceUpdate): string {
  if (preference === 'favorite') return t('Favourite: goes into your next schedule where it fits', 'Favoriet: komt in je volgende schema waar hij past');
  if (preference === null) return t('Mark removed', 'Markering weggehaald');
  const swaps = res.replaced.map((r) => `${r.day}: ${r.to}`).join(', ');
  const kept = res.kept.length
    ? t(` No alternative on ${res.kept.join(', ')}; it is still there.`, ` Geen alternatief op ${res.kept.join(', ')}; daar staat hij nog.`)
    : '';
  return t(
    `Won't be used any more.${swaps ? ` Replaced in your program (${swaps}).` : ''}${kept}`,
    `Wordt niet meer gebruikt.${swaps ? ` Vervangen in je programma (${swaps}).` : ''}${kept}`,
  );
}
