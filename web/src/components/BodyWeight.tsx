import { useState, type FormEvent } from 'react';
import type { BodyWeightEntry } from '@shared/types.ts';
import { api } from '../api.ts';
import { kg, shortDate } from '../format.ts';
import { decimal, t } from '../i18n.ts';
import { LineChart } from './Charts.tsx';
import { toast, useLoad } from './ui.tsx';

/** Today as YYYY-MM-DD in the device's own time zone. */
const localDate = () => new Date().toLocaleDateString('en-CA');

/** Body weight over time: log today's weight, see the trend. The latest entry is your profile weight. */
export function BodyWeightSection() {
  const { data, setData } = useLoad(() => api.bodyWeights());
  const entries: BodyWeightEntry[] = data?.entries ?? [];
  const latest = entries[entries.length - 1];
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const weightKg = parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(weightKg)) return;
    setBusy(true);
    try {
      setData(await api.logBodyWeight(weightKg, localDate()));
      setValue('');
      toast(t('Weight saved', 'Gewicht opgeslagen'));
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry: BodyWeightEntry) => {
    if (!confirm(t(`Remove ${kg(entry.weightKg)} kg of ${shortDate(entry.date)}?`, `${kg(entry.weightKg)} kg van ${shortDate(entry.date)} verwijderen?`))) return;
    setData(await api.deleteBodyWeight(entry.id));
  };

  const first = entries[0];
  const change = latest && first && latest !== first ? Math.round((latest.weightKg - first.weightKg) * 10) / 10 : null;

  return (
    <section className="section stack">
      <div className="spread">
        <h2>{t('Body weight', 'Lichaamsgewicht')}</h2>
        {latest && (
          <span className="faint small">
            {kg(latest.weightKg)} kg
            {change !== null ? ` (${change > 0 ? '+' : ''}${decimal(change.toFixed(1))} ${t('since', 'sinds')} ${shortDate(first.date)})` : ''}
          </span>
        )}
      </div>

      <form className="row" style={{ gap: 8 }} onSubmit={submit}>
        <input
          className="input num"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={30}
          max={300}
          placeholder={latest ? kg(latest.weightKg) : 'kg'}
          aria-label={t('Weight today in kg', 'Gewicht vandaag in kg')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn primary" disabled={busy || !value}>
          {t('Save today', 'Vandaag opslaan')}
        </button>
      </form>
      <p className="faint small" style={{ margin: 0 }}>
        {t(
          'Your latest weight is also your profile weight, so new starting weights use it.',
          'Je laatste gewicht is ook je profielgewicht, dus nieuwe startgewichten gaan daarvan uit.',
        )}
      </p>

      {entries.length > 1 && (
        <LineChart
          title={t('Body weight', 'Lichaamsgewicht')}
          unit=" kg"
          data={entries.map((e) => ({ label: shortDate(e.date), value: e.weightKg, detail: `${kg(e.weightKg)} kg` }))}
        />
      )}

      {entries.length > 0 && (
        <div className="list">
          {[...entries]
            .reverse()
            .slice(0, 5)
            .map((e) => (
              <div className="list-row" key={e.id}>
                <div className="grow">
                  <div className="title">{kg(e.weightKg)} kg</div>
                  <div className="sub">{shortDate(e.date)}</div>
                </div>
                <button className="link-btn small" onClick={() => void remove(e)} aria-label={t(`Remove ${shortDate(e.date)}`, `${shortDate(e.date)} verwijderen`)}>
                  {t('Remove', 'Verwijderen')}
                </button>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
