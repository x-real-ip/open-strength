import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AiFeature, AiSettingsView, AiUsageSummary, Effort } from '@shared/types.ts';
import { api } from '../api.ts';
import { useRefreshInfo } from '../App.tsx';
import { BarChart } from '../components/Charts.tsx';
import { IconBack } from '../components/Icons.tsx';
import { ErrorState, Loading, toast, useLoad } from '../components/ui.tsx';
import { compact, shortDate } from '../format.ts';
import { decimal, locale, t } from '../i18n.ts';

/** Dollars (decimal comma in Dutch); small amounts keep four decimals so a single call is visible. */
export function usd(n: number | null): string {
  if (n === null) return '—';
  return `$${decimal(n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2))}`;
}

const featureLabel = (f: AiFeature) => ({ program: t('Programs', 'Programma’s'), coach: t('Coach', 'Coach'), test: t('Connection test', 'Verbindingstest') })[f];

const efforts = (): { id: Effort | null; label: string }[] => [
  { id: 'low', label: t('Low', 'Laag') },
  { id: 'medium', label: t('Medium', 'Middel') },
  { id: 'high', label: t('High', 'Hoog') },
  { id: null, label: t('Default', 'Standaard') },
];

/** What each model in the picker is good for. */
function modelNote(id: string): string {
  switch (id) {
    case 'claude-sonnet-5-5':
      return t('Recommended: good at designing programs, affordable.', 'Aanbevolen: goed in programma’s ontwerpen, betaalbaar.');
    case 'claude-haiku-5-5':
      return t('Much cheaper; fine for the coach, weaker at programs.', 'Veel goedkoper; prima voor de coach, minder sterk in programma’s.');
    case 'claude-opus-5-5':
      return t('The strongest model, twice the price of Sonnet.', 'Het sterkste model, twee keer zo duur als Sonnet.');
    default:
      return '';
  }
}

export default function AiPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // "verbruik" is the Dutch tab name from older links.
  const view = params.get('tab') === 'usage' || params.get('tab') === 'verbruik' ? 'usage' : 'settings';

  return (
    <main className="page">
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label={t('Back', 'Terug')}>
          <IconBack />
        </button>
      </div>
      <h1>AI</h1>
      <div className="chips" role="tablist" aria-label={t('View', 'Weergave')} style={{ margin: '14px 0 16px' }}>
        <button role="tab" aria-pressed={view === 'settings'} onClick={() => setParams({}, { replace: true })}>
          {t('Settings', 'Instellingen')}
        </button>
        <button role="tab" aria-pressed={view === 'usage'} onClick={() => setParams({ tab: 'usage' }, { replace: true })}>
          {t('Usage', 'Verbruik')}
        </button>
      </div>
      {view === 'settings' ? <SettingsView /> : <UsageView />}
    </main>
  );
}

function SettingsView() {
  const refreshInfo = useRefreshInfo();
  const { data, error, loading, reload, setData } = useLoad(() => api.aiSettings());
  const [form, setForm] = useState<AiSettingsView | null>(null);
  const [customModel, setCustomModel] = useState(false);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm(data);
    setCustomModel(data.provider === 'anthropic' && !data.models.some((m) => m.id === data.model));
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error || !data || !form) return <ErrorState message={error ?? t('Loading failed', 'Laden is mislukt')} onRetry={reload} />;

  const set = <K extends keyof AiSettingsView>(k: K, v: AiSettingsView[K]) => setForm({ ...form, [k]: v });

  const save = async (extra: { apiKey?: string | null } = {}, label = 'save') => {
    setBusy(label);
    setTest(null);
    try {
      const saved = await api.saveAiSettings({
        provider: form.provider,
        model: form.model,
        baseUrl: form.provider === 'openai' ? form.baseUrl : '',
        coachEffort: form.coachEffort,
        programEffort: form.programEffort,
        monthlyBudgetUsd: form.monthlyBudgetUsd,
        ...extra,
      });
      setData(saved);
      setKey('');
      refreshInfo();
      toast(t('AI settings saved', 'AI-instellingen opgeslagen'));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy('test');
    setTest(null);
    try {
      const r = await api.testAi();
      const secs = decimal((r.ms / 1000).toFixed(1));
      setTest({ ok: true, text: t(`It works (${secs} s): “${r.reply}”`, `Het werkt (${secs} s): “${r.reply}”`) });
    } catch (e) {
      setTest({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const changed =
    JSON.stringify({ ...form, keyHint: null, keySource: null }) !== JSON.stringify({ ...data, keyHint: null, keySource: null });

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="panel small">
        {data.configured ? (
          <>
            <b>{t('AI is on', 'AI staat aan')}</b>: {data.models.find((m) => m.id === data.model)?.label ?? data.model}.{' '}
            {t(
              'Programs are designed by the AI and the coach writes answers. The AI never decides weights.',
              'Programma’s worden door de AI ontworpen en de coach geeft geschreven antwoorden. Gewichten bepaalt de AI nooit.',
            )}
          </>
        ) : (
          <>
            <b>{t('AI is off.', 'AI staat uit.')}</b>{' '}
            {t(
              'Everything works, but programs are rule-based and the coach only shows facts. Add an API key below to turn on AI.',
              'Alles werkt, maar programma’s zijn regelgebaseerd en de coach toont alleen feiten. Voeg hieronder een API-sleutel toe om AI aan te zetten.',
            )}
          </>
        )}
      </div>

      <section className="stack">
        <h2>{t('Provider', 'Aanbieder')}</h2>
        <div className="seg">
          <button type="button" aria-pressed={form.provider === 'anthropic'} onClick={() => setForm({ ...form, provider: 'anthropic', model: 'claude-sonnet-5-5', baseUrl: '' })}>
            Claude (Anthropic)
          </button>
          <button type="button" aria-pressed={form.provider === 'openai'} onClick={() => setForm({ ...form, provider: 'openai', model: '', baseUrl: '' })}>
            {t('OpenAI-compatible', 'OpenAI-compatibel')}
          </button>
        </div>
      </section>

      <section className="stack">
        <h2>Model</h2>
        {form.provider === 'anthropic' ? (
          <div className="list">
            {data.models.map((m) => (
              <label key={m.id} className="list-row" style={{ cursor: 'pointer' }}>
                <input type="radio" name="model" checked={!customModel && form.model === m.id} onChange={() => (setCustomModel(false), set('model', m.id))} />
                <div className="grow">
                  <div className="title">{m.label}</div>
                  <div className="sub">
                    {t(
                      `${usd(m.inputUsd)} in / ${usd(m.outputUsd)} out per million tokens.`,
                      `${usd(m.inputUsd)} in / ${usd(m.outputUsd)} uit per miljoen tokens.`,
                    )}{' '}
                    {modelNote(m.id)}
                  </div>
                </div>
              </label>
            ))}
            <label className="list-row" style={{ cursor: 'pointer' }}>
              <input type="radio" name="model" checked={customModel} onChange={() => setCustomModel(true)} />
              <div className="grow">
                <div className="title">{t('Other model', 'Ander model')}</div>
                {customModel && (
                  <input className="input" style={{ marginTop: 8 }} placeholder="claude-…" value={form.model} onChange={(e) => set('model', e.target.value)} />
                )}
              </div>
            </label>
          </div>
        ) : (
          <>
            <label className="field">
              <span>Model</span>
              <input className="input" placeholder={t('for example llama3.1 or gpt-4o-mini', 'bijvoorbeeld llama3.1 of gpt-4o-mini')} value={form.model} onChange={(e) => set('model', e.target.value)} />
            </label>
            <label className="field">
              <span>{t('API address', 'Adres van de API')}</span>
              <input className="input" placeholder={t('http://ollama:11434/v1 (empty: OpenAI)', 'http://ollama:11434/v1 (leeg: OpenAI)')} value={form.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} />
            </label>
            <p className="faint small" style={{ margin: 0 }}>
              {t('For local models only tokens are counted; costs are unknown.', 'Voor lokale modellen worden alleen tokens geteld; kosten zijn onbekend.')}
            </p>
          </>
        )}
      </section>

      <section className="stack">
        <h2>{t('How much the model thinks', 'Hoeveel het model nadenkt')}</h2>
        <p className="faint small" style={{ margin: 0 }}>
          {t(
            'More thinking gives more thorough answers, but is slower and costs more (thinking counts as output).',
            'Meer nadenken geeft grondigere antwoorden, maar is trager en kost meer (nadenken telt als uitvoer).',
          )}
        </p>
        <div className="field">
          <span>{t('Coach', 'Coach')}</span>
          <div className="seg">
            {efforts().map((e) => (
              <button key={String(e.id)} type="button" aria-pressed={form.coachEffort === e.id} onClick={() => set('coachEffort', e.id)}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('Designing programs', 'Programma’s ontwerpen')}</span>
          <div className="seg">
            {efforts().map((e) => (
              <button key={String(e.id)} type="button" aria-pressed={form.programEffort === e.id} onClick={() => set('programEffort', e.id)}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="stack">
        <h2>{t('Monthly budget', 'Maandbudget')}</h2>
        <label className="row small" style={{ gap: 8 }}>
          <input type="checkbox" checked={form.monthlyBudgetUsd !== null} onChange={(e) => set('monthlyBudgetUsd', e.target.checked ? 10 : null)} />
          {t('Stop AI when the estimated cost this month reaches this amount', 'AI stoppen als de geschatte kosten deze maand dit bedrag halen')}
        </label>
        {form.monthlyBudgetUsd !== null && (
          <label className="field">
            <span>{t('Amount in dollars', 'Bedrag in dollar')}</span>
            <input
              className="input num"
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              value={form.monthlyBudgetUsd}
              onChange={(e) => set('monthlyBudgetUsd', parseFloat(e.target.value) || 0)}
            />
          </label>
        )}
      </section>

      <button className="btn primary big block" disabled={!changed || busy !== null} onClick={() => save()}>
        {busy === 'save' ? t('Saving…', 'Opslaan…') : t('Save settings', 'Instellingen opslaan')}
      </button>

      <section className="stack">
        <h2>{t('API key', 'API-sleutel')}</h2>
        <p className="small" style={{ margin: 0 }}>
          {data.keySource === 'app'
            ? t(`Set in the app (${data.keyHint}).`, `Ingesteld in de app (${data.keyHint}).`)
            : data.keySource === 'env'
              ? t(`Set on the server (${data.keyHint}).`, `Ingesteld op de server (${data.keyHint}).`)
              : t('No key yet.', 'Nog geen sleutel.')}
        </p>
        <input
          className="input"
          type="password"
          autoComplete="off"
          placeholder={form.provider === 'anthropic' ? 'sk-ant-…' : t('Key (leave empty for local models)', 'Sleutel (leeg laten voor lokale modellen)')}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button className="btn block" disabled={!key.trim() || busy !== null} onClick={() => save({ apiKey: key.trim() }, 'key')}>
          {busy === 'key' ? t('Saving…', 'Opslaan…') : t('Save key', 'Sleutel opslaan')}
        </button>
        {data.keySource === 'app' && (
          <button
            className="link-btn small"
            onClick={() =>
              confirm(t('Remove the key from the app? A key on the server applies again.', 'De sleutel uit de app verwijderen? Een sleutel op de server geldt dan weer.')) &&
              save({ apiKey: null }, 'key')
            }
          >
            {t('Remove key from the app', 'Sleutel uit de app verwijderen')}
          </button>
        )}
        <p className="faint small" style={{ margin: 0 }}>
          {t(
            'The key is stored in the app’s database and is never sent to your browser. A key in the app takes precedence over a key on the server.',
            'De sleutel staat in de database van de app en wordt nooit naar je browser gestuurd. Een sleutel in de app gaat voor een sleutel op de server.',
          )}
        </p>
      </section>

      <section className="stack">
        <h2>{t('Test', 'Testen')}</h2>
        <button className="btn block" disabled={!data.configured || busy !== null || changed} onClick={runTest}>
          {busy === 'test' ? t('Working…', 'Bezig…') : t('Test connection', 'Verbinding testen')}
        </button>
        {changed && (
          <p className="faint small" style={{ margin: 0 }}>
            {t('Save your changes first.', 'Sla eerst je wijzigingen op.')}
          </p>
        )}
        {test && <p className={test.ok ? 'small' : 'error'} style={{ margin: 0 }}>{test.text}</p>}
        <p className="faint small" style={{ margin: 0 }}>
          {t('A test costs a fraction of a cent and then shows up under Usage.', 'Een test kost een fractie van een cent en staat daarna bij Verbruik.')}
        </p>
      </section>
    </div>
  );
}

function UsageView() {
  const { data, error, loading, reload } = useLoad(() => api.usage());
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? t('Loading failed', 'Laden is mislukt')} onRetry={reload} />;
  return <Usage u={data} />;
}

function Usage({ u }: { u: AiUsageSummary }) {
  const budgetPct = u.budgetUsd ? Math.min(100, (u.month.costUsd / u.budgetUsd) * 100) : null;
  const monthName = new Date(u.month.start).toLocaleDateString(locale(), { month: 'long', timeZone: 'Europe/Amsterdam' });

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="stat-row">
        <div className="stat">
          <div className="value">{usd(u.month.costUsd)}</div>
          <div className="label">{monthName}</div>
        </div>
        <div className="stat">
          <div className="value">{u.month.calls}</div>
          <div className="label">{t('calls', 'aanroepen')}</div>
        </div>
        <div className="stat">
          <div className="value">{compact(u.month.inputTokens + u.month.outputTokens)}</div>
          <div className="label">tokens</div>
        </div>
      </div>

      {budgetPct !== null && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="spread small">
            <span>{t('Budget', 'Budget')}</span>
            <span className="muted">{t(`${usd(u.month.costUsd)} of ${usd(u.budgetUsd)}`, `${usd(u.month.costUsd)} van ${usd(u.budgetUsd)}`)}</span>
          </div>
          <div className="meter" role="meter" aria-valuenow={Math.round(budgetPct)} aria-valuemin={0} aria-valuemax={100} aria-label={t('Share of the monthly budget', 'Deel van het maandbudget')}>
            <span style={{ width: `${budgetPct}%` }} className={budgetPct >= 100 ? 'full' : budgetPct >= 80 ? 'high' : ''} />
          </div>
        </div>
      )}

      <p className="muted small" style={{ margin: 0 }}>
        {t(
          `Last month: ${usd(u.previousMonthCostUsd)}. Tokens this month: ${u.month.inputTokens.toLocaleString(locale())} in, ${u.month.outputTokens.toLocaleString(locale())} out (thinking counts as out).`,
          `Vorige maand: ${usd(u.previousMonthCostUsd)}. Tokens deze maand: ${u.month.inputTokens.toLocaleString(locale())} in, ${u.month.outputTokens.toLocaleString(locale())} uit (nadenken telt als uit).`,
        )}
        {u.month.failed > 0
          ? t(` ${u.month.failed} call${u.month.failed === 1 ? '' : 's'} failed.`, ` ${u.month.failed} aanroep${u.month.failed === 1 ? '' : 'en'} mislukt.`)
          : ''}
      </p>

      <BarChart
        title={t('Cost per day', 'Kosten per dag')}
        sub={t('In dollar cents, last 30 days', 'In dollarcent, laatste 30 dagen')}
        unit=""
        data={u.daily.map((d) => ({
          label: shortDate(d.day),
          value: Math.round(d.costUsd * 10000) / 100,
          detail: `${usd(d.costUsd)}, ${t(`${d.calls} call${d.calls === 1 ? '' : 's'}`, `${d.calls} aanroep${d.calls === 1 ? '' : 'en'}`)}`,
        }))}
      />

      <section className="stack">
        <h2>{t('Per feature', 'Per onderdeel')}</h2>
        {u.byFeature.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            {t('No AI used yet this month.', 'Deze maand nog geen AI gebruikt.')}
          </p>
        ) : (
          <div className="list">
            {u.byFeature.map((f) => (
              <div key={f.feature} className="list-row">
                <div className="grow">
                  <div className="title">{featureLabel(f.feature)}</div>
                  <div className="sub">
                    {t(
                      `${f.calls} call${f.calls === 1 ? '' : 's'}, ${usd(f.calls ? f.costUsd / f.calls : 0)} on average`,
                      `${f.calls} aanroep${f.calls === 1 ? '' : 'en'}, gemiddeld ${usd(f.calls ? f.costUsd / f.calls : 0)}`,
                    )}
                  </div>
                </div>
                <div className="num" style={{ fontWeight: 600 }}>
                  {usd(f.costUsd)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="stack">
        <h2>{t('Recent calls', 'Laatste aanroepen')}</h2>
        {u.recent.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            {t('Nothing yet.', 'Nog niets.')}
          </p>
        ) : (
          <div className="list">
            {u.recent.map((r) => (
              <div key={r.id} className="list-row">
                <div className="grow">
                  <div className="title">
                    {featureLabel(r.feature)}
                    {!r.ok && <span className="error small"> · {t('failed', 'mislukt')}</span>}
                  </div>
                  <div className="sub">
                    {new Date(r.createdAt).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {r.model} ·{' '}
                    {r.inputTokens.toLocaleString(locale())} in / {r.outputTokens.toLocaleString(locale())} {t('out', 'uit')}
                    {r.error ? ` · ${r.error}` : ''}
                  </div>
                </div>
                <div className="num small">{usd(r.costUsd)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="faint small" style={{ margin: 0 }}>
        {t(
          `Costs are an estimate based on the model’s price list${u.hasUnpricedCalls ? '; some models have no known price' : ''}. The Anthropic Console remains the source of truth for your bill.`,
          `Kosten zijn een schatting op basis van de prijslijst van het model${u.hasUnpricedCalls ? '; voor sommige modellen is geen prijs bekend' : ''}. De Anthropic Console blijft leidend voor je rekening.`,
        )}
      </p>
    </div>
  );
}
