import type {
  AiSettingsUpdate,
  AiSettingsView,
  AiUsageSummary,
  AppInfo,
  CoachMessage,
  ExerciseDef,
  ExerciseHistory,
  ExercisePreference,
  ExercisePreferences,
  ExerciseUsage,
  Language,
  LibraryExercise,
  PreferenceUpdate,
  Profile,
  Program,
  ProgramExplanation,
  StatsResponse,
  TodayResponse,
  Workout,
  WorkoutSummary,
} from '@shared/types.ts';
import { deletePending, getPending, keyOf, pendingAll, putPending, type PendingSet } from './offlineStore.ts';
import { t } from './i18n.ts';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(t('No connection to the server', 'Geen verbinding met de server'), 0);
  }
  if (res.status === 401) window.dispatchEvent(new Event('overload:unauthorized'));
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(data?.error ?? t(`Request failed (${res.status})`, `Verzoek mislukt (${res.status})`), res.status);
  return data as T;
}

export const api = {
  info: () => request<AppInfo>('GET', '/api/info'),
  login: (password: string) => request<{ ok: true }>('POST', '/api/auth/login', { password }),
  logout: () => request<{ ok: true; redirect: string | null }>('POST', '/api/auth/logout'),

  exercises: (lang: Language) => request<LibraryExercise[]>('GET', `/api/exercises?lang=${lang}`),
  profile: () => request<{ profile: Profile | null }>('GET', '/api/profile'),
  saveProfile: (p: Profile) => request<{ profile: Profile }>('PUT', '/api/profile', p),

  today: () => request<TodayResponse>('GET', '/api/today'),
  activeProgram: () => request<{ program: Program | null; explanation: ProgramExplanation[] }>('GET', '/api/programs/active'),
  generateProgram: (opts: { instructions?: string; useAi?: boolean; basedOnCurrent?: boolean }) =>
    request<{ program: Program; notice: string | null }>('POST', '/api/programs/generate', opts),
  preferences: () => request<ExercisePreferences>('GET', '/api/exercise-preferences'),
  setPreference: (exerciseId: string, preference: ExercisePreference | null) =>
    request<PreferenceUpdate>('PUT', '/api/exercise-preferences', { exerciseId, preference }),
  alternatives: (peId: number) => request<{ alternatives: ExerciseDef[] }>('GET', `/api/program-exercises/${peId}/alternatives`),
  replaceExercise: (peId: number, exerciseId: string) => request<{ program: Program }>('POST', `/api/program-exercises/${peId}/replace`, { exerciseId }),
  setWeight: (peId: number, weight: number) => request<{ program: Program }>('PUT', `/api/program-exercises/${peId}/weight`, { weight }),

  startWorkout: (programDayId: number) => request<{ workout: Workout }>('POST', '/api/workouts', { programDayId }),
  workout: (id: number) => request<{ workout: Workout }>('GET', `/api/workouts/${id}`),
  deleteSet: (id: number, peId: number, setIndex: number) => request<{ ok: true }>('DELETE', `/api/workouts/${id}/sets/${peId}/${setIndex}`),
  finishWorkout: (id: number) => request<{ summary: WorkoutSummary }>('POST', `/api/workouts/${id}/finish`),
  summary: (id: number) => request<{ summary: WorkoutSummary }>('GET', `/api/workouts/${id}/summary`),
  discardWorkout: (id: number) => request<{ ok: true }>('DELETE', `/api/workouts/${id}`),
  workouts: () =>
    request<{ workouts: { id: number; dayName: string; startedAt: string; finishedAt: string; isDeload: boolean; sets: number; volume: number }[] }>(
      'GET',
      '/api/workouts',
    ),

  stats: () => request<StatsResponse>('GET', '/api/stats'),
  exerciseUsage: () => request<Record<string, ExerciseUsage>>('GET', '/api/stats/exercise-usage'),
  exerciseHistory: (exerciseId: string) => request<ExerciseHistory>('GET', `/api/stats/exercises/${encodeURIComponent(exerciseId)}`),

  coachMessages: () => request<{ messages: CoachMessage[] }>('GET', '/api/coach/messages'),
  sendCoach: (content: string) => request<{ messages: CoachMessage[] }>('POST', '/api/coach/messages', { content }),
  clearCoach: () => request<{ ok: true }>('DELETE', '/api/coach/messages'),

  importJson: (data: unknown) => request<{ ok: true }>('POST', '/api/import/json', data),

  aiSettings: () => request<AiSettingsView>('GET', '/api/settings/ai'),
  saveAiSettings: (update: AiSettingsUpdate) => request<AiSettingsView>('PUT', '/api/settings/ai', update),
  testAi: () => request<{ ok: true; reply: string; ms: number }>('POST', '/api/settings/ai/test'),
  usage: () => request<AiUsageSummary>('GET', '/api/usage'),
};

// ---------------------------------------------------------------------------
// Set sync queue. Logged sets are saved on the device first (IndexedDB, see
// offlineStore.ts) and pushed to the server; failed pushes stay queued and are retried,
// so a bad gym connection loses nothing.

export type { PendingSet };

export function pendingCount(): number {
  return pendingAll().length;
}

export function pendingFor(workoutId: number): PendingSet[] {
  return pendingAll().filter((s) => s.workoutId === workoutId);
}

let flushing: Promise<void> | null = null;

export function flushQueue(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    for (const s of pendingAll()) {
      const key = keyOf(s);
      try {
        const { workoutId, ...body } = s;
        await request('PUT', `/api/workouts/${workoutId}/sets`, body);
        // Only remove if it wasn't changed again while we were sending.
        if (JSON.stringify(getPending(key)) === JSON.stringify(s)) await deletePending(key);
      } catch (err) {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 401) {
          // The server rejected it for good (e.g. workout discarded); drop it.
          await deletePending(key);
          continue;
        }
        break; // offline or server error: keep everything, retry later
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export async function queueSet(s: PendingSet): Promise<void> {
  await putPending(s);
  return flushQueue();
}

export function dropQueuedSet(workoutId: number, programExerciseId: number, setIndex: number) {
  void deletePending(keyOf({ workoutId, programExerciseId, setIndex }));
}

window.addEventListener('online', () => void flushQueue());
setInterval(() => {
  if (pendingCount() > 0) void flushQueue();
}, 15_000);
