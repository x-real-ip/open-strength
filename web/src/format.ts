import type { Decision, Equipment, ExerciseCategory, ExerciseLevel, LibraryExercise, MovementPattern, MuscleGroup } from '@shared/types.ts';
import { decimal, locale, t } from './i18n.ts';

/** "v1.2.3" for a release, "dev-abc1234" as it is for other builds. */
export function versionLabel(version: string): string {
  return /^\d/.test(version) ? `v${version}` : version;
}

export function kg(weight: number): string {
  // 42.5 in English, 42,5 in Dutch.
  return decimal(Number.isInteger(weight) ? String(weight) : weight.toFixed(2).replace(/0$/, ''));
}

export function weightLabel(weight: number, loadType: string): string {
  return loadType === 'bodyweight' ? t('Bodyweight', 'Lichaamsgewicht') : `${kg(weight)} kg`;
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
  return new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

export function relativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return t('Today', 'Vandaag');
  if (days === 1) return t('Yesterday', 'Gisteren');
  if (days < 7) return t(`${days} days ago`, `${days} dagen geleden`);
  return shortDate(iso);
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${decimal((n / 1_000_000).toFixed(1))}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${decimal((n / 1000).toFixed(1))}k`;
  return String(Math.round(n));
}

export function decisionLabel(d: Decision): string {
  return {
    start: t('Starting weight', 'Startgewicht'),
    increase: t('Up', 'Omhoog'),
    hold: t('Same', 'Gelijk'),
    decrease: t('Down', 'Omlaag'),
    reps: t('Make it harder', 'Zwaarder maken'),
    deload: t('Deload', 'Deload'),
  }[d];
}

/** Muscle groups in display order. */
export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'quads',
  'hamstrings',
  'glutes',
  'biceps',
  'triceps',
  'calves',
  'core',
  'lower_back',
  'traps',
  'forearms',
  'adductors',
  'abductors',
  'neck',
];

export function muscleLabel(m: MuscleGroup): string {
  return {
    chest: t('Chest', 'Borst'),
    back: t('Back', 'Rug'),
    shoulders: t('Shoulders', 'Schouders'),
    quads: t('Quads', 'Quadriceps'),
    hamstrings: t('Hamstrings', 'Hamstrings'),
    glutes: t('Glutes', 'Billen'),
    biceps: t('Biceps', 'Biceps'),
    triceps: t('Triceps', 'Triceps'),
    calves: t('Calves', 'Kuiten'),
    core: t('Abs and core', 'Buik en core'),
    lower_back: t('Lower back', 'Onderrug'),
    traps: t('Traps', 'Trapezius'),
    forearms: t('Forearms', 'Onderarmen'),
    adductors: t('Adductors', 'Adductoren'),
    abductors: t('Abductors', 'Abductoren'),
    neck: t('Neck', 'Nek'),
  }[m];
}

export const CATEGORIES: ExerciseCategory[] = ['strength', 'powerlifting', 'olympic', 'strongman', 'plyometrics', 'stretching', 'cardio'];

export function categoryLabel(c: ExerciseCategory): string {
  return {
    strength: t('Strength', 'Kracht'),
    powerlifting: t('Powerlifting', 'Powerlifting'),
    olympic: t('Olympic weightlifting', 'Olympisch gewichtheffen'),
    strongman: t('Strongman', 'Strongman'),
    plyometrics: t('Plyometrics', 'Plyometrie'),
    stretching: t('Stretching', 'Rekken'),
    cardio: t('Cardio', 'Cardio'),
  }[c];
}

export function levelLabel(l: ExerciseLevel): string {
  return { beginner: t('beginner', 'beginner'), intermediate: t('intermediate', 'gevorderd'), expert: t('expert', 'expert') }[l];
}

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

export function equipmentLabel(e: Equipment): string {
  return {
    barbell: t('Barbell', 'Barbell'),
    dumbbell: t('Dumbbells', 'Dumbbells'),
    bench: t('Bench', 'Bank'),
    machine: t('Machine', 'Machine'),
    cable: t('Cable', 'Kabel'),
    kettlebell: t('Kettlebell', 'Kettlebell'),
    pullup_bar: t('Pull-up bar', 'Optrekstang'),
    bands: t('Bands', 'Elastiek'),
    bodyweight: t('Bodyweight', 'Lichaamsgewicht'),
  }[e];
}

/** Equipment outside the profile list arrives as an English label from the server. */
function otherEquipmentLabel(label: string): string {
  const nl: Record<string, string> = { 'Medicine ball': 'Medicijnbal', 'Exercise ball': 'Fitnessbal', 'Foam roller': 'Foamroller', Other: 'Overig' };
  return t(label, nl[label] ?? label);
}

/** "Barbell, Bench", or "No equipment" for bodyweight-only exercises. */
export function equipmentText(equipment: Equipment[], other?: string): string {
  const names = equipment.filter((e) => e !== 'bodyweight').map(equipmentLabel);
  if (other) names.push(otherEquipmentLabel(other));
  return names.join(', ') || t('No equipment', 'Geen apparatuur');
}

/** Bodyweight is always available; everything else must be in the profile. Unknown gear never is. */
export function hasEquipment(ex: LibraryExercise, equipment: Equipment[] | null): boolean {
  if (!equipment) return true;
  return !ex.otherEquipment && ex.equipment.every((e) => e === 'bodyweight' || equipment.includes(e));
}

export function patternLabel(p: MovementPattern): string {
  return {
    horizontal_push: t('Horizontal push', 'Horizontaal duwen'),
    vertical_push: t('Vertical push', 'Verticaal duwen'),
    horizontal_pull: t('Horizontal pull', 'Horizontaal trekken'),
    vertical_pull: t('Vertical pull', 'Verticaal trekken'),
    squat: t('Squat', 'Squat'),
    lunge: t('Single leg', 'Eén been'),
    hinge: t('Hip hinge', 'Heupscharnier'),
    chest_iso: t('Chest (isolation)', 'Borst (isolatie)'),
    shoulder_iso: t('Shoulders (isolation)', 'Schouders (isolatie)'),
    rear_delt: t('Rear delts', 'Achterkant schouders'),
    quad_iso: t('Quads (isolation)', 'Quadriceps (isolatie)'),
    hamstring_iso: t('Hamstrings (isolation)', 'Hamstrings (isolatie)'),
    glute_iso: t('Glutes', 'Billen'),
    calf: t('Calves', 'Kuiten'),
    biceps: t('Biceps', 'Biceps'),
    triceps: t('Triceps', 'Triceps'),
    core: t('Core', 'Core'),
  }[p];
}
