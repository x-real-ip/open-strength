import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Equipment, Goal, Level, Profile } from '@shared/types.ts';
import { api } from '../api.ts';
import { useInfo } from '../App.tsx';
import { ErrorState, Loading, toast, useLoad } from '../components/ui.tsx';

const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: 'barbell', label: 'Barbell & rack' },
  { id: 'dumbbell', label: 'Dumbbells' },
  { id: 'bench', label: 'Bench' },
  { id: 'machine', label: 'Machines' },
  { id: 'cable', label: 'Cable station' },
  { id: 'kettlebell', label: 'Kettlebells' },
  { id: 'pullup_bar', label: 'Pull-up bar' },
  { id: 'bands', label: 'Resistance bands' },
];

const PRESETS: { label: string; equipment: Equipment[] }[] = [
  { label: 'Full gym', equipment: ['barbell', 'dumbbell', 'bench', 'machine', 'cable', 'kettlebell', 'pullup_bar'] },
  { label: 'Home with dumbbells', equipment: ['dumbbell', 'bench', 'pullup_bar'] },
  { label: 'Bodyweight only', equipment: ['pullup_bar'] },
];

const LEVELS: { id: Level; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

const GOALS: { id: Goal; label: string }[] = [
  { id: 'hypertrophy', label: 'Build muscle' },
  { id: 'strength', label: 'Strength' },
  { id: 'conditioning', label: 'Conditioning' },
  { id: 'fat_loss', label: 'Lose fat' },
];

const STEP_LABELS: { id: keyof Profile['increments']; label: string; needs: Equipment }[] = [
  { id: 'barbell', label: 'Barbell', needs: 'barbell' },
  { id: 'dumbbell', label: 'Dumbbell', needs: 'dumbbell' },
  { id: 'machine', label: 'Machine', needs: 'machine' },
  { id: 'cable', label: 'Cable', needs: 'cable' },
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
        toast(res.notice ?? 'Your program is ready');
        navigate('/program');
        return;
      }
      toast('Profile saved');
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
        <h1>{isNew ? 'Set up your profile' : 'Profile'}</h1>
      </div>
      {isNew && <p className="muted" style={{ marginTop: -8 }}>A few details so the program fits you. You can change everything later.</p>}

      <section className="section stack">
        <h2>About you</h2>
        <label className="field">
          <span>Name</span>
          <input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} autoComplete="given-name" />
        </label>
        <div className="grid-3">
          <NumberField label="Age" value={p.age} onChange={(v) => set('age', v)} />
          <NumberField label="Height" suffix="cm" value={p.heightCm} onChange={(v) => set('heightCm', v)} />
          <NumberField label="Weight" suffix="kg" step={0.1} value={p.weightKg} onChange={(v) => set('weightKg', v)} />
        </div>
      </section>

      <section className="section stack">
        <h2>Training</h2>
        <div className="field">
          <span>Experience</span>
          <div className="seg">
            {LEVELS.map((l) => (
              <button key={l.id} type="button" aria-pressed={p.level === l.id} onClick={() => set('level', l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Main goal</span>
          <div className="seg" style={{ gridAutoFlow: 'row', gridTemplateColumns: '1fr 1fr' }}>
            {GOALS.map((g) => (
              <button key={g.id} type="button" aria-pressed={p.goal === g.id} onClick={() => set('goal', g.id)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Training days per week</span>
          <div className="seg">
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <button key={d} type="button" aria-pressed={p.daysPerWeek === d} onClick={() => set('daysPerWeek', d)}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Time per session</span>
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
        <h2>Equipment</h2>
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
          <summary>Smallest weight steps (kg)</summary>
          <p className="faint small">The smallest jump you can make on each type of equipment. Weight advice is rounded to these steps.</p>
          <div className="grid-3">
            {STEP_LABELS.filter((s) => p.equipment.includes(s.needs)).map((s) => (
              <NumberField key={s.id} label={s.label} step={0.25} value={p.increments[s.id]} onChange={(v) => set('increments', { ...p.increments, [s.id]: v })} />
            ))}
          </div>
        </details>
      </section>

      <section className="section stack">
        <h2>Limitations</h2>
        <label className="field">
          <span>Injuries, pain or anything to work around</span>
          <textarea className="textarea" placeholder="For example: sensitive lower back, avoid overhead pressing" value={p.limitations} onChange={(e) => set('limitations', e.target.value)} />
        </label>
      </section>

      <section className="section stack">
        {formError && <p className="error">{formError}</p>}
        <button className="btn primary big block" onClick={save} disabled={saving}>
          {saving ? (isNew ? 'Building your program…' : 'Saving…') : isNew ? 'Save and build my program' : 'Save profile'}
        </button>
        {saving && isNew && info.aiConfigured && <p className="faint small">The AI is designing your program. This can take up to a minute.</p>}
      </section>

      {!isNew && <DataSection />}
      <AboutSection />
    </main>
  );
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File) => {
    if (!confirm('Importing replaces all current data. A backup is made first. Continue?')) return;
    try {
      await api.importJson(JSON.parse(await file.text()));
      toast('Data imported');
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <>
      <section className="section stack">
        <h2>Data</h2>
        <p className="faint small" style={{ margin: 0 }}>Database backups run on the server. Exports are for your own copies and moving data.</p>
        <div className="list">
          <a className="list-row" href="/api/export/json" download>
            <div className="grow">
              <div className="title">Export everything</div>
              <div className="sub">JSON file with profile, programs and all workouts</div>
            </div>
          </a>
          <a className="list-row" href="/api/export/sets.csv" download>
            <div className="grow">
              <div className="title">Export sets as CSV</div>
              <div className="sub">Every logged set, for spreadsheets</div>
            </div>
          </a>
          <button className="list-row" onClick={() => fileRef.current?.click()}>
            <div className="grow">
              <div className="title">Import from export file</div>
              <div className="sub">Replaces current data; also accepts exports from version 1.0</div>
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
      <h2>About</h2>
      <div className="panel small muted stack" style={{ gap: 4 }}>
        <div>
          AI: {info.aiConfigured ? `${info.aiProvider}, model ${info.aiModel}` : 'not configured (rule-based programs, coach shows facts only)'}
        </div>
        {info.user && info.authMode !== 'none' && <div>Signed in as {info.user.name ?? info.user.username}</div>}
        <div>Version {info.version}</div>
      </div>
      {info.authMode !== 'none' && (
        <button
          className="btn block"
          onClick={async () => {
            const res = await api.logout();
            location.href = res.redirect ?? '/';
          }}
        >
          Sign out
        </button>
      )}
    </section>
  );
}
