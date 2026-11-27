import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Equipment, Goal, Language, Level, Profile } from '@shared/types.ts';
import { api } from '../api.ts';
import { useInfo, useRefreshInfo, useSetLanguage } from '../App.tsx';
import { ErrorState, Loading, toast, useLoad } from '../components/ui.tsx';
import { getLang, t } from '../i18n.ts';

const equipmentOptions = (): { id: Equipment; label: string }[] => [
  { id: 'barbell', label: t('Barbell and rack', 'Barbell en rek') },
  { id: 'dumbbell', label: t('Dumbbells', 'Dumbbells') },
  { id: 'bench', label: t('Bench', 'Bank') },
  { id: 'machine', label: t('Machines', 'Machines') },
  { id: 'cable', label: t('Cable station', 'Kabelstation') },
  { id: 'kettlebell', label: t('Kettlebells', 'Kettlebells') },
  { id: 'pullup_bar', label: t('Pull-up bar', 'Optrekstang') },
  { id: 'bands', label: t('Resistance bands', 'Weerstandselastieken') },
];

const presets = (): { label: string; equipment: Equipment[] }[] => [
  { label: t('Full gym', 'Volledige sportschool'), equipment: ['barbell', 'dumbbell', 'bench', 'machine', 'cable', 'kettlebell', 'pullup_bar'] },
  { label: t('Home with dumbbells', 'Thuis met dumbbells'), equipment: ['dumbbell', 'bench', 'pullup_bar'] },
  { label: t('Bodyweight only', 'Alleen lichaamsgewicht'), equipment: ['pullup_bar'] },
];

const levels = (): { id: Level; label: string }[] => [
  { id: 'beginner', label: t('Beginner', 'Beginner') },
  { id: 'intermediate', label: t('Intermediate', 'Gevorderd') },
  { id: 'advanced', label: t('Advanced', 'Ervaren') },
];

const goals = (): { id: Goal; label: string }[] => [
  { id: 'hypertrophy', label: t('Muscle growth', 'Spiermassa') },
  { id: 'strength', label: t('Strength', 'Kracht') },
  { id: 'conditioning', label: t('Conditioning', 'Conditie') },
  { id: 'fat_loss', label: t('Lose fat', 'Vet verliezen') },
];

const stepLabels = (): { id: keyof Profile['increments']; label: string; needs: Equipment }[] => [
  { id: 'barbell', label: t('Barbell', 'Barbell'), needs: 'barbell' },
  { id: 'dumbbell', label: t('Dumbbell', 'Dumbbell'), needs: 'dumbbell' },
  { id: 'machine', label: t('Machine', 'Machine'), needs: 'machine' },
  { id: 'cable', label: t('Cable', 'Kabel'), needs: 'cable' },
  { id: 'kettlebell', label: t('Kettlebell', 'Kettlebell'), needs: 'kettlebell' },
];

/** Each language is named in itself, so you can find yours whatever the current language is. */
const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'nl', label: 'Nederlands' },
];

const empty = (): Profile => ({
  name: '',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  level: 'beginner',
  goal: 'hypertrophy',
  trainingDays: 3,
  sessionMinutes: 30,
  equipment: ['barbell', 'dumbbell', 'bench', 'machine', 'cable', 'pullup_bar'],
  limitations: '',
  increments: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, kettlebell: 4 },
  language: getLang(),
});

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
  const refreshInfo = useRefreshInfo();
  const setLanguage = useSetLanguage();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => Promise.all([api.profile(), api.activeProgram()]));
  const [p, setP] = useState<Profile>(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const saved = data?.[0].profile ?? null;
  const isNew = !saved;

  useEffect(() => {
    if (saved) setP(saved);
  }, [saved]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((cur) => ({ ...cur, [k]: v }));
  const toggleEq = (id: Equipment) => set('equipment', p.equipment.includes(id) ? p.equipment.filter((e) => e !== id) : [...p.equipment, id]);

  // The language applies right away. An existing profile saves just that field (other edits are not
  // saved by it); a new profile only switches the screen until the form is saved.
  const chooseLanguage = async (language: Language) => {
    if (language === getLang()) return;
    try {
      if (saved) {
        await api.saveProfile({ ...saved, language });
        refreshInfo();
      }
      setLanguage(language);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await api.saveProfile(p);
      if (!data?.[1].program) {
        const res = await api.generateProgram({});
        toast(res.notice ?? t('Your program is ready', 'Je programma staat klaar'));
        navigate('/program');
        return;
      }
      toast(t('Profile saved', 'Profiel opgeslagen'));
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
        <h1>{isNew ? t('Set up your profile', 'Profiel instellen') : t('Profile', 'Profiel')}</h1>
      </div>
      {isNew && (
        <p className="muted" style={{ marginTop: -8 }}>
          {t('A few details so the program fits you. You can change everything later.', 'Een paar gegevens zodat het programma bij je past. Je kunt alles later aanpassen.')}
        </p>
      )}

      <section className="section stack">
        <div className="field">
          <span>{t('Language', 'Taal')}</span>
          <div className="seg">
            {LANGUAGES.map((l) => (
              <button key={l.id} type="button" lang={l.id} aria-pressed={getLang() === l.id} onClick={() => void chooseLanguage(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section stack">
        <h2>{t('About you', 'Over jou')}</h2>
        <label className="field">
          <span>{t('Name', 'Naam')}</span>
          <input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} autoComplete="given-name" />
        </label>
        <div className="grid-3">
          <NumberField label={t('Age', 'Leeftijd')} value={p.age} onChange={(v) => set('age', v)} />
          <NumberField label={t('Height', 'Lengte')} suffix="cm" value={p.heightCm} onChange={(v) => set('heightCm', v)} />
          <NumberField label={t('Weight', 'Gewicht')} suffix="kg" step={0.1} value={p.weightKg} onChange={(v) => set('weightKg', v)} />
        </div>
      </section>

      <section className="section stack">
        <h2>{t('Training', 'Training')}</h2>
        <div className="field">
          <span>{t('Experience', 'Ervaring')}</span>
          <div className="seg">
            {levels().map((l) => (
              <button key={l.id} type="button" aria-pressed={p.level === l.id} onClick={() => set('level', l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('Main goal', 'Hoofddoel')}</span>
          <div className="seg" style={{ gridAutoFlow: 'row', gridTemplateColumns: '1fr 1fr' }}>
            {goals().map((g) => (
              <button key={g.id} type="button" aria-pressed={p.goal === g.id} onClick={() => set('goal', g.id)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('Training days in the rotation', 'Trainingsdagen in de rotatie')}</span>
          <div className="seg">
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <button key={d} type="button" aria-pressed={p.trainingDays === d} onClick={() => set('trainingDays', d)}>
                {d}
              </button>
            ))}
          </div>
          <p className="faint small" style={{ margin: '6px 0 0' }}>
            {t(
              'How many different workouts (A, B, C…) the program rotates through. It is not tied to the week: train as often as you can, the next workout is always the next one in the rotation.',
              'Hoeveel verschillende trainingen (A, B, C…) het programma afwisselt. Het hangt niet aan de week: train zo vaak als het uitkomt, de volgende training is altijd de volgende in de rotatie.',
            )}
          </p>
        </div>
        <div className="field">
          <span>{t('Time per session', 'Tijd per training')}</span>
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
          <h2>{t('Equipment', 'Apparatuur')}</h2>
          <Link className="link-btn small" to="/exercises">
            {t('See the exercises', 'Bekijk de oefeningen')}
          </Link>
        </div>
        <div className="toggles">
          {presets().map((pr) => (
            <button key={pr.label} type="button" className="link-btn small" onClick={() => set('equipment', pr.equipment)}>
              {pr.label}
            </button>
          ))}
        </div>
        <div className="toggles">
          {equipmentOptions().map((e) => (
            <button key={e.id} type="button" className="toggle" aria-pressed={p.equipment.includes(e.id)} onClick={() => toggleEq(e.id)}>
              {e.label}
            </button>
          ))}
        </div>
        <details className="why">
          <summary>{t('Smallest weight steps (kg)', 'Kleinste gewichtsstappen (kg)')}</summary>
          <p className="faint small">
            {t(
              'The smallest jump you can make per type of equipment. Weight advice is rounded to it.',
              'De kleinste sprong die je per type apparatuur kunt maken. Gewichtsadvies wordt hierop afgerond.',
            )}
          </p>
          <div className="grid-3">
            {stepLabels()
              .filter((s) => p.equipment.includes(s.needs))
              .map((s) => (
                <NumberField key={s.id} label={s.label} step={0.25} value={p.increments[s.id]} onChange={(v) => set('increments', { ...p.increments, [s.id]: v })} />
              ))}
          </div>
        </details>
      </section>

      <section className="section stack">
        <h2>{t('Limitations', 'Beperkingen')}</h2>
        <label className="field">
          <span>{t('Injuries, pain or anything to take into account', 'Blessures, pijn of iets waar rekening mee moet worden gehouden')}</span>
          <textarea
            className="textarea"
            placeholder={t('For example: sensitive lower back, no overhead pressing', 'Bijvoorbeeld: gevoelige onderrug, geen drukken boven het hoofd')}
            value={p.limitations}
            onChange={(e) => set('limitations', e.target.value)}
          />
        </label>
      </section>

      <section className="section stack">
        {formError && <p className="error">{formError}</p>}
        <button className="btn primary big block" onClick={save} disabled={saving}>
          {saving
            ? isNew
              ? t('Making your program…', 'Je programma wordt gemaakt…')
              : t('Saving…', 'Opslaan…')
            : isNew
              ? t('Save and make my program', 'Opslaan en programma maken')
              : t('Save profile', 'Profiel opslaan')}
        </button>
        {saving && isNew && info.aiConfigured && (
          <p className="faint small">{t('The AI is designing your program. This can take up to a minute.', 'De AI ontwerpt je programma. Dit kan tot een minuut duren.')}</p>
        )}
      </section>

      {!isNew && <DataSection />}
      <AboutSection />
    </main>
  );
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File) => {
    if (!confirm(t('Importing replaces all current data. Continue?', 'Importeren vervangt alle huidige gegevens. Doorgaan?'))) return;
    try {
      await api.importJson(JSON.parse(await file.text()));
      toast(t('Data imported', 'Gegevens geïmporteerd'));
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <>
      <section className="section stack">
        <h2>{t('Data', 'Gegevens')}</h2>
        <p className="faint small" style={{ margin: 0 }}>
          {t(
            'Database backups happen on the server. Exports are for your own copy or to move your data.',
            'Back-ups van de database gebeuren op de server. Exports zijn voor je eigen kopie of om gegevens te verhuizen.',
          )}
        </p>
        <div className="list">
          <a className="list-row" href="/api/export/json" download>
            <div className="grow">
              <div className="title">{t('Export everything', 'Alles exporteren')}</div>
              <div className="sub">{t('JSON file with profile, programs and all workouts', 'JSON-bestand met profiel, programma’s en alle trainingen')}</div>
            </div>
          </a>
          <a className="list-row" href="/api/export/sets.csv" download>
            <div className="grow">
              <div className="title">{t('Export sets as CSV', 'Sets exporteren als CSV')}</div>
              <div className="sub">{t('Every logged set, for spreadsheets', 'Elke gelogde set, voor spreadsheets')}</div>
            </div>
          </a>
          <button className="list-row" onClick={() => fileRef.current?.click()}>
            <div className="grow">
              <div className="title">{t('Import from an export file', 'Importeren uit exportbestand')}</div>
              <div className="sub">{t('Replaces the current data; also works with exports from version 1.0', 'Vervangt de huidige gegevens; werkt ook met exports uit versie 1.0')}</div>
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
      <h2>{t('About the app', 'Over de app')}</h2>
      <Link className="btn block" to="/ai">
        {t('AI settings and usage', 'AI-instellingen en verbruik')}
      </Link>
      <div className="panel small muted stack" style={{ gap: 4 }}>
        <div>
          AI:{' '}
          {info.aiConfigured
            ? t(`on, ${info.aiModel}`, `aan, ${info.aiModel}`)
            : t('off (rule-based programs, the coach only shows facts)', 'uit (regelgebaseerde programma’s, de coach toont alleen feiten)')}
        </div>
        {info.user && info.authMode !== 'none' && (
          <div>
            {t('Signed in as', 'Ingelogd als')} {info.user.name ?? info.user.username}
          </div>
        )}
        <div>
          {t('Version', 'Versie')} {info.version}
        </div>
      </div>
      {info.authMode !== 'none' && (
        <button
          className="btn block"
          onClick={async () => {
            const res = await api.logout();
            location.href = res.redirect ?? '/';
          }}
        >
          {t('Sign out', 'Uitloggen')}
        </button>
      )}
    </section>
  );
}
