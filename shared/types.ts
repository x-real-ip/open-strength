// Shared types between server and web client.
// Keep this file free of runtime code so both sides can import it as types only.

export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'hypertrophy' | 'strength' | 'conditioning' | 'fat_loss';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'kettlebell'
  | 'pullup_bar'
  | 'bench'
  | 'bands'
  | 'bodyweight';

/** How an exercise is loaded; decides which weight step applies. */
export type LoadType = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'kettlebell' | 'bodyweight';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'biceps'
  | 'triceps'
  | 'calves'
  | 'core';

export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'lunge'
  | 'hinge'
  | 'chest_iso'
  | 'shoulder_iso'
  | 'rear_delt'
  | 'quad_iso'
  | 'hamstring_iso'
  | 'glute_iso'
  | 'calf'
  | 'biceps'
  | 'triceps'
  | 'core';

/** Smallest weight jump (kg) available per load type. */
export type Increments = Record<Exclude<LoadType, 'bodyweight'>, number>;

export interface Profile {
  name: string;
  age: number;
  heightCm: number;
  weightKg: number;
  level: Level;
  goal: Goal;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: Equipment[];
  limitations: string;
  increments: Increments;
  updatedAt?: string;
}

export interface ExerciseDef {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  /** All of these must be available to perform the exercise. */
  equipment: Equipment[];
  loadType: LoadType;
  pattern: MovementPattern;
  compound: boolean;
  /** Rough working weight for a beginner as a fraction of body weight (per hand for dumbbells). */
  startFactor: number;
  /** Shown next to the weight, e.g. "per hand". */
  weightNote?: string;
  /** How to do it, in short steps. */
  steps: string[];
  /** Example photos: start and end position. */
  photos: string[];
  /** Set when the photos show a close variant instead of this exact exercise. */
  photoNote?: string;
}

export type Decision = 'start' | 'increase' | 'hold' | 'decrease' | 'reps' | 'deload';

export interface Target {
  weight: number;
  repTargets: number[];
  decision: Decision;
  reason: string;
  updatedAt: string;
}

export interface ProgramExercise {
  id: number;
  exerciseId: string;
  name: string;
  primary: MuscleGroup;
  loadType: LoadType;
  weightNote?: string;
  position: number;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  notes: string;
  increment: number;
  /** Superset label (A, B, …); neighbours with the same label are done back to back. */
  superset: string | null;
  target: Target | null;
}

export interface ProgramDay {
  id: number;
  dayIndex: number;
  name: string;
  focus: string;
  exercises: ProgramExercise[];
}

export interface Program {
  id: number;
  name: string;
  weeks: number;
  deloadWeek: number | null;
  source: 'ai' | 'template';
  rationale: string;
  status: 'active' | 'archived';
  createdAt: string;
  days: ProgramDay[];
  completedWorkouts: number;
  currentWeek: number;
  isComplete: boolean;
  /** Index in `days` of the next workout (days rotate: after the last day comes the first). */
  nextDayIndex: number;
}

/** How a program was put together, in plain Dutch, for the program screen. */
export interface ProgramExplanation {
  title: string;
  text: string[];
  bullets?: string[];
}

export interface LoggedSet {
  setIndex: number;
  weight: number;
  reps: number;
  rir: number | null;
  completed: boolean;
}

export interface PreviousSession {
  date: string;
  sets: { weight: number; reps: number; rir: number | null }[];
}

export interface WorkoutExercise {
  programExerciseId: number;
  exerciseId: string;
  name: string;
  primary: MuscleGroup;
  loadType: LoadType;
  weightNote?: string;
  increment: number;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  notes: string;
  superset: string | null;
  targetWeight: number;
  repTargets: number[];
  decision: Decision;
  reason: string;
  previous: PreviousSession | null;
  logged: LoggedSet[];
}

export interface Workout {
  id: number;
  programId: number;
  programDayId: number;
  dayName: string;
  status: 'in_progress' | 'completed';
  startedAt: string;
  finishedAt: string | null;
  week: number;
  isDeload: boolean;
  exercises: WorkoutExercise[];
}

export interface ExerciseOutcome {
  programExerciseId: number;
  exerciseId: string;
  name: string;
  decision: Decision;
  fromWeight: number;
  nextWeight: number;
  repTargets: number[];
  reason: string;
  weightNote?: string;
  sets: { weight: number; reps: number; rir: number | null }[];
  newRecords: string[];
}

export interface WorkoutSummary {
  workoutId: number;
  dayName: string;
  durationMinutes: number;
  totalSets: number;
  totalVolume: number;
  outcomes: ExerciseOutcome[];
}

export interface TodayResponse {
  hasProfile: boolean;
  program: Pick<Program, 'id' | 'name' | 'weeks' | 'deloadWeek' | 'currentWeek' | 'isComplete' | 'completedWorkouts'> | null;
  nextDay: ProgramDay | null;
  isDeload: boolean;
  inProgressWorkoutId: number | null;
  lastWorkout: { id: number; dayName: string; finishedAt: string } | null;
  workoutsThisWeek: number;
  stalled: { exerciseId: string; name: string; sessions: number }[];
}

export interface StatsResponse {
  totals: { workouts: number; sets: number; volumeKg: number; firstWorkout: string | null };
  weekly: { weekStart: string; workouts: number; sets: number; volumeKg: number }[];
  muscles: { muscle: MuscleGroup; setsPerWeekRecent: number; setsPerWeekPrevious: number }[];
  records: { exerciseId: string; name: string; bestWeight: number; bestWeightReps: number; bestE1rm: number; date: string }[];
  exercises: { exerciseId: string; name: string; sessions: number; firstE1rm: number; lastE1rm: number }[];
}

export interface ExerciseHistory {
  exerciseId: string;
  name: string;
  sessions: {
    date: string;
    isDeload: boolean;
    topWeight: number;
    totalReps: number;
    bestReps: number;
    e1rm: number;
    volume: number;
    sets: { weight: number; reps: number; rir: number | null }[];
  }[];
}

export interface CoachMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export type AuthMode = 'none' | 'password' | 'proxy' | 'oidc';

export interface AppInfo {
  aiConfigured: boolean;
  aiProvider: string;
  aiModel: string;
  authMode: AuthMode;
  authRequired: boolean;
  authenticated: boolean;
  user: { username: string; email?: string; name?: string } | null;
  oidcProviderName: string;
  version: string;
}

export type AiProviderId = 'anthropic' | 'openai';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type AiFeature = 'program' | 'coach' | 'test';

/** AI settings as the settings page sees them. The API key itself is never sent to the browser. */
export interface AiSettingsView {
  provider: AiProviderId;
  model: string;
  /** Only for OpenAI-compatible servers (Ollama, LM Studio, ...); empty means the provider default. */
  baseUrl: string;
  /** Where the key comes from: saved in the app, the server environment, or nowhere. */
  keySource: 'app' | 'env' | null;
  /** Last characters of the key, e.g. "…a1b2". */
  keyHint: string | null;
  /** null means: let the model use its own default. */
  coachEffort: Effort | null;
  programEffort: Effort | null;
  /** Stop AI calls once this month's estimated cost reaches this (USD). null means no limit. */
  monthlyBudgetUsd: number | null;
  configured: boolean;
  /** Known Claude models with their list price per million tokens. */
  models: { id: string; label: string; inputUsd: number; outputUsd: number; note: string }[];
}

export interface AiSettingsUpdate {
  provider?: AiProviderId;
  model?: string;
  baseUrl?: string;
  /** A new key, or null to remove the key saved in the app (the server key then applies again). */
  apiKey?: string | null;
  coachEffort?: Effort | null;
  programEffort?: Effort | null;
  monthlyBudgetUsd?: number | null;
}

export interface AiUsageEntry {
  id: number;
  createdAt: string;
  feature: AiFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Estimated from the list price; null when the price is unknown (e.g. a local model). */
  costUsd: number | null;
  ok: boolean;
  error: string | null;
}

export interface AiUsageSummary {
  month: { start: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number; failed: number };
  previousMonthCostUsd: number;
  budgetUsd: number | null;
  byFeature: { feature: AiFeature; calls: number; costUsd: number; inputTokens: number; outputTokens: number }[];
  daily: { day: string; costUsd: number; calls: number }[];
  recent: AiUsageEntry[];
  /** True when some calls used a model without a known price. */
  hasUnpricedCalls: boolean;
}
