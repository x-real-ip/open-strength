import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AiFeature, AiSettingsView, AiUsageSummary, Effort } from '@shared/types.ts';
import { api } from '../api.ts';
import { useRefreshInfo } from '../App.tsx';
import { BarChart } from '../components/Charts.tsx';
import { IconBack } from '../components/Icons.tsx';
import { ErrorState, Loading, toast, useLoad } from '../components/ui.tsx';
import { compact, shortDate } from '../format.ts';

/** Dollars with a decimal comma; small amounts keep four decimals so a single call is visible. */
export function usd(n: number | null): string {
  if (n === null) return '—';
  const s = n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2);
  return `$${s.replace('.', ',')}`;
}

const FEATURE_LABEL: Record<AiFeature, string> = { program: 'Programma’s', coach: 'Coach', test: 'Verbindingstest' };

const EFFORTS: { id: Effort | null; label: string }[] = [
  { id: 'low', label: 'Laag' },
  { id: 'medium', label: 'Middel' },
  { id: 'high', label: 'Hoog' },
  { id: null, label: 'Standaard' },
];

export default function AiPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('tab') === 'verbruik' ? 'usage' : 'settings';

  return (
    <main className="page">
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Terug">
          <IconBack />
        </button>
      </div>
      <h1>AI</h1>
      <div className="chips" role="tablist" aria-label="Weergave" style={{ margin: '14px 0 16px' }}>
        <button role="tab" aria-pressed={view === 'settings'} onClick={() => setParams({}, { replace: true })}>
          Instellingen
        </button>
        <button role="tab" aria-pressed={view === 'usage'} onClick={() => setParams({ tab: 'verbruik' }, { replace: true })}>
          Verbruik
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
  if (error || !data || !form) return <ErrorState message={error ?? 'Laden is mislukt'} onRetry={reload} />;

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
      toast('AI-instellingen opgeslagen');
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
      setTest({ ok: true, text: `Het werkt (${(r.ms / 1000).toFixed(1).replace('.', ',')} s): “${r.reply}”` });
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
            <b>AI staat aan</b>: {data.models.find((m) => m.id === data.model)?.label ?? data.model}. Programma’s worden door de AI ontworpen en de coach geeft
            geschreven antwoorden. Gewichten bepaalt de AI nooit.
          </>
        ) : (
          <>
            <b>AI staat uit.</b> Alles werkt, maar programma’s zijn regelgebaseerd en de coach toont alleen feiten. Voeg hieronder een API-sleutel toe om AI
            aan te zetten.
          </>
        )}
      </div>

      <section className="stack">
        <h2>Aanbieder</h2>
        <div className="seg">
          <button type="button" aria-pressed={form.provider === 'anthropic'} onClick={() => setForm({ ...form, provider: 'anthropic', model: 'claude-sonnet-5-5', baseUrl: '' })}>
            Claude (Anthropic)
          </button>
          <button type="button" aria-pressed={form.provider === 'openai'} onClick={() => setForm({ ...form, provider: 'openai', model: '', baseUrl: '' })}>
            OpenAI-compatibel
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
                    {usd(m.inputUsd)} in / {usd(m.outputUsd)} uit per miljoen tokens. {m.note}
                  </div>
                </div>
              </label>
            ))}
            <label className="list-row" style={{ cursor: 'pointer' }}>
              <input type="radio" name="model" checked={customModel} onChange={() => setCustomModel(true)} />
              <div className="grow">
                <div className="title">Ander model</div>
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
              <input className="input" placeholder="bijvoorbeeld llama3.1 of gpt-4o-mini" value={form.model} onChange={(e) => set('model', e.target.value)} />
            </label>
            <label className="field">
              <span>Adres van de API</span>
              <input className="input" placeholder="http://ollama:11434/v1 (leeg: OpenAI)" value={form.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} />
            </label>
            <p className="faint small" style={{ margin: 0 }}>
              Voor lokale modellen worden alleen tokens geteld; kosten zijn onbekend.
            </p>
          </>
        )}
      </section>

      <section className="stack">
        <h2>Hoeveel het model nadenkt</h2>
        <p className="faint small" style={{ margin: 0 }}>
          Meer nadenken geeft grondigere antwoorden, maar is trager en kost meer (nadenken telt als uitvoer).
        </p>
        <div className="field">
          <span>Coach</span>
          <div className="seg">
            {EFFORTS.map((e) => (
              <button key={String(e.id)} type="button" aria-pressed={form.coachEffort === e.id} onClick={() => set('coachEffort', e.id)}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Programma’s ontwerpen</span>
          <div className="seg">
            {EFFORTS.map((e) => (
              <button key={String(e.id)} type="button" aria-pressed={form.programEffort === e.id} onClick={() => set('programEffort', e.id)}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="stack">
        <h2>Maandbudget</h2>
        <label className="row small" style={{ gap: 8 }}>
          <input type="checkbox" checked={form.monthlyBudgetUsd !== null} onChange={(e) => set('monthlyBudgetUsd', e.target.checked ? 10 : null)} />
          AI stoppen als de geschatte kosten deze maand dit bedrag halen
        </label>
        {form.monthlyBudgetUsd !== null && (
          <label className="field">
            <span>Bedrag in dollar</span>
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
        {busy === 'save' ? 'Opslaan…' : 'Instellingen opslaan'}
      </button>

      <section className="stack">
        <h2>API-sleutel</h2>
        <p className="small" style={{ margin: 0 }}>
          {data.keySource === 'app'
            ? `Ingesteld in de app (${data.keyHint}).`
            : data.keySource === 'env'
              ? `Ingesteld op de server (${data.keyHint}).`
              : 'Nog geen sleutel.'}
        </p>
        <input
          className="input"
          type="password"
          autoComplete="off"
          placeholder={form.provider === 'anthropic' ? 'sk-ant-…' : 'Sleutel (leeg laten voor lokale modellen)'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button className="btn block" disabled={!key.trim() || busy !== null} onClick={() => save({ apiKey: key.trim() }, 'key')}>
          {busy === 'key' ? 'Opslaan…' : 'Sleutel opslaan'}
        </button>
        {data.keySource === 'app' && (
          <button
            className="link-btn small"
            onClick={() => confirm('De sleutel uit de app verwijderen? Een sleutel op de server geldt dan weer.') && save({ apiKey: null }, 'key')}
          >
            Sleutel uit de app verwijderen
          </button>
        )}
        <p className="faint small" style={{ margin: 0 }}>
          De sleutel staat in de database van de app en wordt nooit naar je browser gestuurd. Een sleutel in de app gaat voor een sleutel op de server.
        </p>
      </section>

      <section className="stack">
        <h2>Testen</h2>
        <button className="btn block" disabled={!data.configured || busy !== null || changed} onClick={runTest}>
          {busy === 'test' ? 'Bezig…' : 'Verbinding testen'}
        </button>
        {changed && <p className="faint small" style={{ margin: 0 }}>Sla eerst je wijzigingen op.</p>}
        {test && <p className={test.ok ? 'small' : 'error'} style={{ margin: 0 }}>{test.text}</p>}
        <p className="faint small" style={{ margin: 0 }}>
          Een test kost een fractie van een cent en staat daarna bij Verbruik.
        </p>
      </section>
    </div>
  );
}

function UsageView() {
  const { data, error, loading, reload } = useLoad(() => api.usage());
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Laden is mislukt'} onRetry={reload} />;
  return <Usage u={data} />;
}

function Usage({ u }: { u: AiUsageSummary }) {
  const budgetPct = u.budgetUsd ? Math.min(100, (u.month.costUsd / u.budgetUsd) * 100) : null;
  const monthName = new Date(u.month.start).toLocaleDateString('nl-NL', { month: 'long', timeZone: 'Europe/Amsterdam' });

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="stat-row">
        <div className="stat">
          <div className="value">{usd(u.month.costUsd)}</div>
          <div className="label">{monthName}</div>
        </div>
        <div className="stat">
          <div className="value">{u.month.calls}</div>
          <div className="label">aanroepen</div>
        </div>
        <div className="stat">
          <div className="value">{compact(u.month.inputTokens + u.month.outputTokens)}</div>
          <div className="label">tokens</div>
        </div>
      </div>

      {budgetPct !== null && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="spread small">
            <span>Budget</span>
            <span className="muted">
              {usd(u.month.costUsd)} van {usd(u.budgetUsd)}
            </span>
          </div>
          <div className="meter" role="meter" aria-valuenow={Math.round(budgetPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Deel van het maandbudget">
            <span style={{ width: `${budgetPct}%` }} className={budgetPct >= 100 ? 'full' : budgetPct >= 80 ? 'high' : ''} />
          </div>
        </div>
      )}

      <p className="muted small" style={{ margin: 0 }}>
        Vorige maand: {usd(u.previousMonthCostUsd)}. Tokens deze maand: {u.month.inputTokens.toLocaleString('nl-NL')} in, {u.month.outputTokens.toLocaleString('nl-NL')} uit
        (nadenken telt als uit).
        {u.month.failed > 0 ? ` ${u.month.failed} aanroep${u.month.failed === 1 ? '' : 'en'} mislukt.` : ''}
      </p>

      <BarChart
        title="Kosten per dag"
        sub="In dollarcent, laatste 30 dagen"
        unit=""
        data={u.daily.map((d) => ({ label: shortDate(d.day), value: Math.round(d.costUsd * 10000) / 100, detail: `${usd(d.costUsd)}, ${d.calls} aanroep${d.calls === 1 ? '' : 'en'}` }))}
      />

      <section className="stack">
        <h2>Per onderdeel</h2>
        {u.byFeature.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Deze maand nog geen AI gebruikt.</p>
        ) : (
          <div className="list">
            {u.byFeature.map((f) => (
              <div key={f.feature} className="list-row">
                <div className="grow">
                  <div className="title">{FEATURE_LABEL[f.feature]}</div>
                  <div className="sub">
                    {f.calls} aanroep{f.calls === 1 ? '' : 'en'}, gemiddeld {usd(f.calls ? f.costUsd / f.calls : 0)}
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
        <h2>Laatste aanroepen</h2>
        {u.recent.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Nog niets.</p>
        ) : (
          <div className="list">
            {u.recent.map((r) => (
              <div key={r.id} className="list-row">
                <div className="grow">
                  <div className="title">
                    {FEATURE_LABEL[r.feature]}
                    {!r.ok && <span className="error small"> · mislukt</span>}
                  </div>
                  <div className="sub">
                    {new Date(r.createdAt).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {r.model} ·{' '}
                    {r.inputTokens.toLocaleString('nl-NL')} in / {r.outputTokens.toLocaleString('nl-NL')} uit
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
        Kosten zijn een schatting op basis van de prijslijst van het model{u.hasUnpricedCalls ? '; voor sommige modellen is geen prijs bekend' : ''}. De
        Anthropic Console blijft leidend voor je rekening.
      </p>
    </div>
  );
}
