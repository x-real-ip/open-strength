// The full free-exercise-db list (https://github.com/x-real-ip/free-exercise-db, public domain),
// imported by `npm run import:exercises` into server/data/free-exercise-db.json.
// Names and instructions stay in the original English. Strength exercises that map cleanly onto a
// movement pattern and load type become programmable (swaps and AI programs); everything else is
// library-only. Rule-based templates never pick these: they keep to the curated list.
import fs from 'node:fs';
import path from 'node:path';
import type {
  Equipment,
  ExerciseCategory,
  ExerciseDef,
  ExerciseLevel,
  LibraryExercise,
  LoadType,
  MovementPattern,
  MuscleGroup,
} from '../../shared/types.ts';

interface Raw {
  id: string;
  name: string;
  force: 'push' | 'pull' | 'static' | null;
  level: ExerciseLevel;
  mechanic: 'compound' | 'isolation' | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

const file = path.resolve(import.meta.dirname, '../data/free-exercise-db.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { repo: string; commit: string; exercises: Raw[] };

/** Photos are served by GitHub from the same pinned commit as the data. */
export const PHOTO_BASE = `https://raw.githubusercontent.com/${data.repo}/${data.commit}/exercises/`;
export const SOURCE = { repo: data.repo, commit: data.commit };

const CATEGORY: Record<string, ExerciseCategory> = {
  strength: 'strength',
  powerlifting: 'powerlifting',
  'olympic weightlifting': 'olympic',
  strongman: 'strongman',
  plyometrics: 'plyometrics',
  stretching: 'stretching',
  cardio: 'cardio',
};

const MUSCLE: Record<string, MuscleGroup> = {
  chest: 'chest',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'lower_back',
  traps: 'traps',
  shoulders: 'shoulders',
  quadriceps: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  biceps: 'biceps',
  triceps: 'triceps',
  calves: 'calves',
  abdominals: 'core',
  forearms: 'forearms',
  adductors: 'adductors',
  abductors: 'abductors',
  neck: 'neck',
};

/** Equipment the profile can contain, and the load type that decides the weight step. */
const GEAR: Record<string, { equipment: Equipment; loadType: LoadType }> = {
  barbell: { equipment: 'barbell', loadType: 'barbell' },
  'e-z curl bar': { equipment: 'barbell', loadType: 'barbell' },
  dumbbell: { equipment: 'dumbbell', loadType: 'dumbbell' },
  machine: { equipment: 'machine', loadType: 'machine' },
  cable: { equipment: 'cable', loadType: 'cable' },
  kettlebells: { equipment: 'kettlebell', loadType: 'kettlebell' },
  // Bands progress by reps only, like bodyweight.
  bands: { equipment: 'bands', loadType: 'bodyweight' },
  'body only': { equipment: 'bodyweight', loadType: 'bodyweight' },
};

/** Equipment outside the profile list: an English label the web app translates; never available for programs. */
const OTHER_GEAR: Record<string, string> = {
  'medicine ball': 'Medicine ball',
  'exercise ball': 'Exercise ball',
  'foam roll': 'Foam roller',
  other: 'Other',
};

/** Rough beginner working weight as a fraction of body weight; low on purpose, the engine adjusts. */
const START_FACTOR: Record<LoadType, [compound: number, isolation: number]> = {
  barbell: [0.35, 0.15],
  dumbbell: [0.12, 0.05],
  machine: [0.35, 0.2],
  cable: [0.3, 0.1],
  kettlebell: [0.12, 0.06],
  bodyweight: [0, 0],
};

const has = (name: string, re: RegExp) => re.test(name.toLowerCase());

/**
 * Explosive lifts, odd variants and special setups (chains, reverse bands, boards) don't fit
 * double progression with a plain weight step; they stay library-only.
 */
const NOT_PROGRAMMABLE =
  /clean|snatch|jerk|jump|plyo|sprint|speed |air bike|chains|reverse band|board press|pin press|off pins|plate movers|partials|anti-gravity|bradford|car drivers|around the worlds|isometric|spell caster|judo flip|cocoons|figure 8|pass between|landmine 180|wipers/;

/** Movement pattern from the primary muscle, mechanics and name; null when it isn't clear. */
export function classifyPattern(r: Pick<Raw, 'name' | 'force' | 'mechanic' | 'primaryMuscles'>): MovementPattern | null {
  const n = r.name;
  const compound = r.mechanic === 'compound';
  switch (r.primaryMuscles[0]) {
    case 'chest':
      if (has(n, /fly|flye|cross ?over|iron cross|pec deck|butterfly|pullover/)) return 'chest_iso';
      if (r.force === 'push' || has(n, /push-up|pushup|press|dip/)) return 'horizontal_push';
      return null;
    case 'shoulders':
      if (has(n, /rear|reverse fl|face pull/)) return 'rear_delt';
      if (has(n, /raise|upright/)) return 'shoulder_iso';
      if (r.force === 'push' && compound && has(n, /press|push|jerk/)) return 'vertical_push';
      if (!compound && r.force !== 'static') return 'shoulder_iso';
      return null;
    case 'lats':
    case 'middle back':
      if (has(n, /pulldown|pull-down|pull-up|pullup|pull up|\bchin|muscle up|straight-arm|pullover/)) return 'vertical_pull';
      if (has(n, /\brows?\b|bench pull/)) return 'horizontal_pull';
      if (r.force === 'pull' && compound) return 'horizontal_pull';
      return null;
    case 'lower back':
      return has(n, /deadlift|good morning|hyperextension|back extension|superman|rack pull/) ? 'hinge' : null;
    case 'quadriceps':
      if (!compound && has(n, /extension/)) return 'quad_iso';
      if (has(n, /deadlift/)) return 'hinge';
      if (has(n, /lunge|split|step-up|step up|pistol/)) return 'lunge';
      if (has(n, /squat|leg press|hack/)) return 'squat';
      return compound && r.force === 'push' ? 'squat' : null;
    case 'hamstrings':
      if (has(n, /curl/)) return 'hamstring_iso';
      if (has(n, /deadlift|good morning|swing|pull through|pull-through|hyperextension|glute ham|hip/)) return 'hinge';
      return compound ? 'hinge' : 'hamstring_iso';
    case 'glutes':
      if (has(n, /deadlift|swing|pull through|pull-through/)) return 'hinge';
      if (has(n, /lunge|step-up|step up|split/)) return 'lunge';
      if (has(n, /squat/)) return 'squat';
      if (has(n, /thrust|bridge|kickback|abduct/) || !compound) return 'glute_iso';
      return null;
    case 'calves':
      return 'calf';
    case 'biceps':
      return r.force === 'pull' ? 'biceps' : null;
    case 'triceps':
      if (has(n, /bench press|floor press/) && !has(n, /close/)) return 'horizontal_push';
      return r.force === 'push' ? 'triceps' : null;
    case 'abdominals':
      return r.force === 'static' && !has(n, /plank|hollow|pallof|l-sit/) ? null : 'core';
    default:
      return null;
  }
}

/** Equipment the name implies on top of the listed piece (a bench, a pull-up bar). */
function impliedEquipment(name: string): Equipment[] {
  const out: Equipment[] = [];
  if (has(name, /bench|incline|decline|seated .*(dumbbell|curl|press)|preacher|tate press/) && !has(name, /no .*bench|smith/)) out.push('bench');
  if (has(name, /pull-up|pullup|pull up|chin-up|chinup|chin up|hanging(?! bar)|muscle up/)) out.push('pullup_bar');
  return out;
}

function toLibrary(r: Raw): LibraryExercise | ExerciseDef {
  const muscles = (list: string[]) => [...new Set(list.map((m) => MUSCLE[m]).filter(Boolean))];
  const primary = MUSCLE[r.primaryMuscles[0]] ?? 'core';
  const gear = r.equipment ? GEAR[r.equipment] : undefined;
  const equipment = [...new Set<Equipment>([...(gear ? [gear.equipment] : []), ...impliedEquipment(r.name)])];
  const category = CATEGORY[r.category] ?? 'strength';
  const base: LibraryExercise = {
    id: r.id,
    name: r.name,
    primary,
    secondary: muscles(r.secondaryMuscles).filter((m) => m !== primary),
    equipment: gear ? equipment : equipment.filter((e) => e !== 'bodyweight'),
    otherEquipment: gear ? undefined : OTHER_GEAR[r.equipment ?? 'other'] ?? 'Other',
    category,
    level: r.level,
    compound: r.mechanic === 'compound',
    source: 'free-exercise-db',
    steps: r.instructions,
    photos: r.images.slice(0, 2).map((p) => PHOTO_BASE + p),
    programmable: false,
  };

  const strength = category === 'strength' || category === 'powerlifting';
  const odd = has(r.name, NOT_PROGRAMMABLE) || (r.equipment !== 'bands' && has(r.name, /with bands/));
  const pattern = strength && !odd ? classifyPattern(r) : null;
  if (!gear || !pattern) return base;
  const weightNote = gear.loadType === 'dumbbell' && !has(r.name, /goblet|pullover|one dumbbell|tate/) ? 'per hand' : undefined;
  return {
    ...base,
    programmable: true,
    pattern,
    loadType: gear.loadType,
    startFactor: START_FACTOR[gear.loadType][base.compound ? 0 : 1],
    ...(weightNote ? { weightNote } : {}),
  } satisfies ExerciseDef;
}

/** Every exercise in the database, minus the ones whose photos a curated exercise already uses. */
export function freeExerciseDb(exclude: Set<string>): (LibraryExercise | ExerciseDef)[] {
  return data.exercises.filter((r) => !exclude.has(r.id)).map(toLibrary);
}
