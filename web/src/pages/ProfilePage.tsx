import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Equipment, Goal, Level, Profile } from '@shared/types.ts';
import { api } from '../api.ts';
import { useInfo } from '../App.tsx';
import { ErrorState, Loading, toast, useLoad } from '../components/ui.tsx';

const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: 'barbell', label: 'Barbell en rek' },
  { id: 'dumbbell', label: 'Dumbbells' },
  { id: 'bench', label: 'Bank' },
  { id: 'machine', label: 'Machines' },
  { id: 'cable', label: 'Kabelstation' },
  { id: 'kettlebell', label: 'Kettlebells' },
  { id: 'pullup_bar', label: 'Optrekstang' },
  { id: 'bands', label: 'Weerstandselastieken' },
];

const PRESETS: { label: string; equipment: Equipment[] }[] = [
  { label: 'Volledige sportschool', equipment: ['barbell', 'dumbbell', 'bench', 'machine', 'cable', 'kettlebell', 'pullup_bar'] },
  { label: 'Thuis met dumbbells', equipment: ['dumbbell', 'bench', 'pullup_bar'] },
  { label: 'Alleen lichaamsgewicht', equipment: ['pullup_bar'] },
];

const LEVELS: { id: Level; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Gevorderd' },
  { id: 'advanced', label: 'Ervaren' },
];

const GOALS: { id: Goal; label: string }[] = [
  { id: 'hypertrophy', label: 'Spiermassa' },
  { id: 'strength', label: 'Kracht' },
  { id: 'conditioning', label: 'Conditie' },
  { id: 'fat_loss', label: 'Vet verliezen' },
];

const STEP_LABELS: { id: keyof Profile['increments']; label: string; needs: Equipment }[] = [
  { id: 'barbell', label: 'Barbell', needs: 'barbell' },
  { id: 'dumbbell', label: 'Dumbbell', needs: 'dumbbell' },
  { id: 'machine', label: 'Machine', needs: 'machine' },
  { id: 'cable', label: 'Kabel', needs: 'cable' },
  { id: 'kettlebell', label: 'Kettlebell', needs: 'kettlebell' },
];

const EMPTY: Profile = {
  name: '',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  level: 'beginner',
  goal: 'hypertrophy',
  daysPerWeek: 3,
  sessionMinutes: 30,
  equipment: ['barbell', 'dumbbell', 'bench', 'machine', 'cable', 'pullup_bar'],
  limitations: '',
  increments: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, kettlebell: 4 },
};

function NumberField({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string }) {
  return (
    <label className="field">
      <span>
        {label}
        {suffix ? ` (${suffix})` : ''}
      </span>
      <input className="input num" type="number" inputMode="decimal" step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export default function ProfilePage() {
  const info = useInfo();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => Promise.all([api.profile(), api.activeProgram()]));
  const [p, setP] = useState<Profile>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isNew = !data?.[0].profile;

  useEffect(() => {
    if (data?.[0].profile) setP(data[0].profile);
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((cur) => ({ ...cur, [k]: v }));
  const toggleEq = (id: Equipment) => set('equipment', p.equipment.includes(id) ? p.equipment.filter((e) => e !== id) : [...p.equipment, id]);

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await api.saveProfile(p);
      if (!data?.[1].program) {
        const res = await api.generateProgram({});
        toast(res.notice ?? 'Je programma staat klaar');
        navigate('/program');
        return;
      }
      toast('Profiel opgeslagen');
      reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <div className="page-head">
        <h1>{isNew ? 'Profiel instellen' : 'Profiel'}</h1>
      </div>
      {isNew && <p className="muted" style={{ marginTop: -8 }}>Een paar gegevens zodat het programma bij je past. Je kunt alles later aanpassen.</p>}

      <section className="section stack">
        <h2>Over jou</h2>
        <label className="field">
          <span>Naam</span>
          <input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} autoComplete="given-name" />
        </label>
        <div className="grid-3">
          <NumberField label="Leeftijd" value={p.age} onChange={(v) => set('age', v)} />
          <NumberField label="Lengte" suffix="cm" value={p.heightCm} onChange={(v) => set('heightCm', v)} />
          <NumberField label="Gewicht" suffix="kg" step={0.1} value={p.weightKg} onChange={(v) => set('weightKg', v)} />
        </div>
      </section>

      <section className="section stack">
        <h2>Training</h2>
        <div className="field">
          <span>Ervaring</span>
          <div className="seg">
            {LEVELS.map((l) => (
              <button key={l.id} type="button" aria-pressed={p.level === l.id} onClick={() => set('level', l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Hoofddoel</span>
          <div className="seg" style={{ gridAutoFlow: 'row', gridTemplateColumns: '1fr 1fr' }}>
            {GOALS.map((g) => (
              <button key={g.id} type="button" aria-pressed={p.goal === g.id} onClick={() => set('goal', g.id)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Trainingsdagen per week</span>
          <div className="seg">
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <button key={d} type="button" aria-pressed={p.daysPerWeek === d} onClick={() => set('daysPerWeek', d)}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Tijd per training</span>
          <div className="seg">
            {[30, 45, 60, 75, 90].map((m) => (
              <button key={m} type="button" aria-pressed={p.sessionMinutes === m} onClick={() => set('sessionMinutes', m)}>
                {m}m
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section stack">
        <div className="spread">
          <h2>Apparatuur</h2>
          <Link className="link-btn small" to="/exercises">
            Bekijk de oefeningen
          </Link>
        </div>
        <div className="toggles">
          {PRESETS.map((pr) => (
            <button key={pr.label} type="button" className="link-btn small" onClick={() => set('equipment', pr.equipment)}>
              {pr.label}
            </button>
          ))}
        </div>
        <div className="toggles">
          {EQUIPMENT.map((e) => (
            <button key={e.id} type="button" className="toggle" aria-pressed={p.equipment.includes(e.id)} onClick={() => toggleEq(e.id)}>
              {e.label}
            </button>
          ))}
        </div>
        <details className="why">
          <summary>Kleinste gewichtsstappen (kg)</summary>
          <p className="faint small">De kleinste sprong die je per type apparatuur kunt maken. Gewichtsadvies wordt hierop afgerond.</p>
          <div className="grid-3">
            {STEP_LABELS.filter((s) => p.equipment.includes(s.needs)).map((s) => (
              <NumberField key={s.id} label={s.label} step={0.25} value={p.increments[s.id]} onChange={(v) => set('increments', { ...p.increments, [s.id]: v })} />
            ))}
          </div>
        </details>
      </section>

      <section className="section stack">
        <h2>Beperkingen</h2>
        <label className="field">
          <span>Blessures, pijn of iets waar rekening mee moet worden gehouden</span>
          <textarea className="textarea" placeholder="Bijvoorbeeld: gevoelige onderrug, geen drukken boven het hoofd" value={p.limitations} onChange={(e) => set('limitations', e.target.value)} />
        </label>
      </section>

      <section className="section stack">
        {formError && <p className="error">{formError}</p>}
        <button className="btn primary big block" onClick={save} disabled={saving}>
          {saving ? (isNew ? 'Je programma wordt gemaakt…' : 'Opslaan…') : isNew ? 'Opslaan en programma maken' : 'Profiel opslaan'}
        </button>
        {saving && isNew && info.aiConfigured && <p className="faint small">De AI ontwerpt je programma. Dit kan tot een minuut duren.</p>}
      </section>

      {!isNew && <DataSection />}
      <AboutSection />
    </main>
  );
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File) => {
    if (!confirm('Importeren vervangt alle huidige gegevens. Doorgaan?')) return;
    try {
      await api.importJson(JSON.parse(await file.text()));
      toast('Gegevens geïmporteerd');
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <>
      <section className="section stack">
        <h2>Gegevens</h2>
        <p className="faint small" style={{ margin: 0 }}>Back-ups van de database gebeuren op de server. Exports zijn voor je eigen kopie of om gegevens te verhuizen.</p>
        <div className="list">
          <a className="list-row" href="/api/export/json" download>
            <div className="grow">
              <div className="title">Alles exporteren</div>
              <div className="sub">JSON-bestand met profiel, programma’s en alle trainingen</div>
            </div>
          </a>
          <a className="list-row" href="/api/export/sets.csv" download>
            <div className="grow">
              <div className="title">Sets exporteren als CSV</div>
              <div className="sub">Elke gelogde set, voor spreadsheets</div>
            </div>
          </a>
          <button className="list-row" onClick={() => fileRef.current?.click()}>
            <div className="grow">
              <div className="title">Importeren uit exportbestand</div>
              <div className="sub">Vervangt de huidige gegevens; werkt ook met exports uit versie 1.0</div>
            </div>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
      </section>
    </>
  );
}

function AboutSection() {
  const info = useInfo();
  return (
    <section className="section stack">
      <h2>Over de app</h2>
      <div className="panel small muted stack" style={{ gap: 4 }}>
        <div>
          AI: {info.aiConfigured ? `${info.aiProvider}, model ${info.aiModel}` : 'niet ingesteld (regelgebaseerde programma’s, de coach toont alleen feiten)'}
        </div>
        {info.user && info.authMode !== 'none' && <div>Ingelogd als {info.user.name ?? info.user.username}</div>}
        <div>Versie {info.version}</div>
      </div>
      {info.authMode !== 'none' && (
        <button
          className="btn block"
          onClick={async () => {
            const res = await api.logout();
            location.href = res.redirect ?? '/';
          }}
        >
          Uitloggen
        </button>
      )}
    </section>
  );
}
