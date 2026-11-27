import { useState } from 'react';
import type { ExercisePreference } from '@shared/types.ts';
import { preferenceMessage, preferenceOf, setPreference, usePreferences } from '../preferences.ts';
import { IconBan, IconStar } from './Icons.tsx';
import { toast } from './ui.tsx';

/** "Favoriet" and "Niet gebruiken" toggles for one exercise. */
export function PreferenceButtons({ exerciseId, onChanged }: { exerciseId: string; onChanged?: (mark: ExercisePreference | null) => void }) {
  const prefs = usePreferences();
  const [busy, setBusy] = useState(false);
  const mark = preferenceOf(prefs, exerciseId);

  const toggle = async (p: ExercisePreference) => {
    const next = mark === p ? null : p;
    setBusy(true);
    try {
      toast(preferenceMessage(next, await setPreference(exerciseId, next)));
      onChanged?.(next);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pref-buttons" role="group" aria-label="Jouw keuze">
      <button type="button" className="favorite" aria-pressed={mark === 'favorite'} disabled={busy || !prefs} onClick={() => toggle('favorite')}>
        <IconStar size={18} filled={mark === 'favorite'} />
        Favoriet
      </button>
      <button type="button" className="excluded" aria-pressed={mark === 'excluded'} disabled={busy || !prefs} onClick={() => toggle('excluded')}>
        <IconBan size={18} />
        Niet gebruiken
      </button>
    </div>
  );
}

/** Small inline mark next to an exercise name. */
export function PreferenceMark({ mark }: { mark: ExercisePreference | null }) {
  if (mark === 'favorite')
    return (
      <span className="pref-mark favorite" title="Favoriet">
        <IconStar size={15} filled />
        <span className="sr-only">Favoriet</span>
      </span>
    );
  if (mark === 'excluded')
    return (
      <span className="pref-mark excluded" title="Niet gebruiken">
        <IconBan size={15} />
        <span className="sr-only">Niet gebruiken</span>
      </span>
    );
  return null;
}
