import { useState } from 'react';
import type { ExercisePreference } from '@shared/types.ts';
import { preferenceMessage, preferenceOf, setPreference, usePreferences } from '../preferences.ts';
import { IconBan, IconStar } from './Icons.tsx';
import { toast } from './ui.tsx';
import { t } from '../i18n.ts';

/** "Favourite" and "Never use" toggles for one exercise. */
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
    <div className="pref-buttons" role="group" aria-label={t('Your choice', 'Jouw keuze')}>
      <button type="button" className="favorite" aria-pressed={mark === 'favorite'} disabled={busy || !prefs} onClick={() => toggle('favorite')}>
        <IconStar size={18} filled={mark === 'favorite'} />
        {t('Favourite', 'Favoriet')}
      </button>
      <button type="button" className="excluded" aria-pressed={mark === 'excluded'} disabled={busy || !prefs} onClick={() => toggle('excluded')}>
        <IconBan size={18} />
        {t('Never use', 'Niet gebruiken')}
      </button>
    </div>
  );
}

/** Small inline mark next to an exercise name. */
export function PreferenceMark({ mark }: { mark: ExercisePreference | null }) {
  if (mark === 'favorite')
    return (
      <span className="pref-mark favorite" title={t('Favourite', 'Favoriet')}>
        <IconStar size={15} filled />
        <span className="sr-only">{t('Favourite', 'Favoriet')}</span>
      </span>
    );
  if (mark === 'excluded')
    return (
      <span className="pref-mark excluded" title={t('Never use', 'Niet gebruiken')}>
        <IconBan size={15} />
        <span className="sr-only">{t('Never use', 'Niet gebruiken')}</span>
      </span>
    );
  return null;
}
