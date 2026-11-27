import type { Decision, Equipment, MovementPattern, MuscleGroup } from '@shared/types.ts';

export function kg(weight: number): string {
  // Dutch decimal comma: 42,5.
  return (Number.isInteger(weight) ? String(weight) : weight.toFixed(2).replace(/0$/, '')).replace('.', ',');
}

export function weightLabel(weight: number, loadType: string): string {
  return loadType === 'bodyweight' ? 'Lichaamsgewicht' : `${kg(weight)} kg`;
}

export function repRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

export function rest(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} min`;
}

export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export function relativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return 'Vandaag';
  if (days === 1) return 'Gisteren';
  if (days < 7) return `${days} dagen geleden`;
  return shortDate(iso);
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')}k`;
  return String(Math.round(n));
}

export const DECISION_LABEL: Record<Decision, string> = {
  start: 'Startgewicht',
  increase: 'Omhoog',
  hold: 'Gelijk',
  decrease: 'Omlaag',
  reps: 'Zwaarder maken',
  deload: 'Deload',
};

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Borst',
  back: 'Rug',
  shoulders: 'Schouders',
  quads: 'Quadriceps',
  hamstrings: 'Hamstrings',
  glutes: 'Billen',
  biceps: 'Biceps',
  triceps: 'Triceps',
  calves: 'Kuiten',
  core: 'Buik en core',
};

/** Display labels such as "A1" and "A2" for superset members; null for straight sets. */
export function supersetLabels(exercises: { superset: string | null }[]): (string | null)[] {
  const seen = new Map<string, number>();
  return exercises.map((e) => {
    if (!e.superset) return null;
    const n = (seen.get(e.superset) ?? 0) + 1;
    seen.set(e.superset, n);
    return `${e.superset}${n}`;
  });
}

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  bench: 'Bank',
  machine: 'Machine',
  cable: 'Kabel',
  kettlebell: 'Kettlebell',
  pullup_bar: 'Optrekstang',
  bands: 'Elastiek',
  bodyweight: 'Lichaamsgewicht',
};

/** "Barbell, Bank", or "Geen apparatuur" for bodyweight-only exercises. */
export function equipmentText(equipment: Equipment[]): string {
  return equipment.filter((e) => e !== 'bodyweight').map((e) => EQUIPMENT_LABEL[e]).join(', ') || 'Geen apparatuur';
}

export const PATTERN_LABEL: Record<MovementPattern, string> = {
  horizontal_push: 'Horizontaal duwen',
  vertical_push: 'Verticaal duwen',
  horizontal_pull: 'Horizontaal trekken',
  vertical_pull: 'Verticaal trekken',
  squat: 'Squat',
  lunge: 'Eén been',
  hinge: 'Heupscharnier',
  chest_iso: 'Borst (isolatie)',
  shoulder_iso: 'Schouders (isolatie)',
  rear_delt: 'Achterkant schouders',
  quad_iso: 'Quadriceps (isolatie)',
  hamstring_iso: 'Hamstrings (isolatie)',
  glute_iso: 'Billen',
  calf: 'Kuiten',
  biceps: 'Biceps',
  triceps: 'Triceps',
  core: 'Core',
};
