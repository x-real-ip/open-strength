import type {
  AppInfo,
  CoachMessage,
  ExerciseDef,
  ExerciseHistory,
  Profile,
  Program,
  StatsResponse,
  TodayResponse,
  Workout,
  WorkoutSummary,
} from '@shared/types.ts';

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
    throw new ApiError('No connection to the server', 0);
  }
  if (res.status === 401) window.dispatchEvent(new Event('overload:unauthorized'));
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const api = {
  info: () => request<AppInfo>('GET', '/api/info'),
  login: (password: string) => request<{ ok: true }>('POST', '/api/auth/login', { password }),
  logout: () => request<{ ok: true; redirect: string | null }>('POST', '/api/auth/logout'),

  exercises: () => request<ExerciseDef[]>('GET', '/api/exercises'),
  profile: () => request<{ profile: Profile | null }>('GET', '/api/profile'),
  saveProfile: (p: Profile) => request<{ profile: Profile }>('PUT', '/api/profile', p),

  today: () => request<TodayResponse>('GET', '/api/today'),
  activeProgram: () => request<{ program: Program | null }>('GET', '/api/programs/active'),
  generateProgram: (opts: { instructions?: string; useAi?: boolean; basedOnCurrent?: boolean }) =>
    request<{ program: Program; notice: string | null }>('POST', '/api/programs/generate', opts),
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
  exerciseHistory: (exerciseId: string) => request<ExerciseHistory>('GET', `/api/stats/exercises/${encodeURIComponent(exerciseId)}`),

  coachMessages: () => request<{ messages: CoachMessage[] }>('GET', '/api/coach/messages'),
  sendCoach: (content: string) => request<{ messages: CoachMessage[] }>('POST', '/api/coach/messages', { content }),
  clearCoach: () => request<{ ok: true }>('DELETE', '/api/coach/messages'),

  importJson: (data: unknown) => request<{ ok: true }>('POST', '/api/import/json', data),
};

// ---------------------------------------------------------------------------
// Set sync queue. Logged sets are saved locally first and pushed to the server;
// failed pushes stay queued and are retried, so a bad gym connection loses nothing.

export interface PendingSet {
  workoutId: number;
  programExerciseId: number;
  setIndex: number;
  weight: number;
  reps: number;
  rir: number | null;
  completed: boolean;
}

const QUEUE_KEY = 'overload.pendingSets';
const keyOf = (s: PendingSet) => `${s.workoutId}:${s.programExerciseId}:${s.setIndex}`;

function readQueue(): Record<string, PendingSet> {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeQueue(q: Record<string, PendingSet>) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* storage unavailable: the in-flight request is still attempted */
  }
  window.dispatchEvent(new CustomEvent('overload:queue', { detail: Object.keys(q).length }));
}

export function pendingCount(): number {
  return Object.keys(readQueue()).length;
}

export function pendingFor(workoutId: number): PendingSet[] {
  return Object.values(readQueue()).filter((s) => s.workoutId === workoutId);
}

let flushing: Promise<void> | null = null;

export function flushQueue(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const q = readQueue();
    for (const [key, s] of Object.entries(q)) {
      try {
        const { workoutId, ...body } = s;
        await request('PUT', `/api/workouts/${workoutId}/sets`, body);
        const latest = readQueue();
        // Only remove if it wasn't changed again while we were sending.
        if (JSON.stringify(latest[key]) === JSON.stringify(s)) {
          delete latest[key];
          writeQueue(latest);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 401) {
          // The server rejected it for good (e.g. workout discarded); drop it.
          const latest = readQueue();
          delete latest[key];
          writeQueue(latest);
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

export function queueSet(s: PendingSet): Promise<void> {
  const q = readQueue();
  q[keyOf(s)] = s;
  writeQueue(q);
  return flushQueue();
}

export function dropQueuedSet(workoutId: number, programExerciseId: number, setIndex: number) {
  const q = readQueue();
  delete q[`${workoutId}:${programExerciseId}:${setIndex}`];
  writeQueue(q);
}

window.addEventListener('online', () => void flushQueue());
setInterval(() => {
  if (pendingCount() > 0) void flushQueue();
}, 15_000);
