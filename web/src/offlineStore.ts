// Durable storage for sets that are logged on this device but not yet confirmed by the
// server. IndexedDB survives closed tabs, phone restarts and storage pressure better than
// localStorage. An in-memory copy keeps reads synchronous for the UI; every write goes to
// memory first and is then persisted.

export interface PendingSet {
  workoutId: number;
  programExerciseId: number;
  setIndex: number;
  weight: number;
  reps: number;
  rir: number | null;
  completed: boolean;
}

const DB_NAME = 'overload';
const STORE = 'pendingSets';
/** Where 1.1 kept the queue, and the fallback when IndexedDB is unavailable. */
const LOCAL_KEY = 'overload.pendingSets';

export const keyOf = (s: Pick<PendingSet, 'workoutId' | 'programExerciseId' | 'setIndex'>) => `${s.workoutId}:${s.programExerciseId}:${s.setIndex}`;

const cache = new Map<string, PendingSet>();
let db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function idb<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function readLocal(): Record<string, PendingSet> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

function writeLocal() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(Object.fromEntries(cache)));
  } catch {
    /* storage unavailable: the set stays in memory and the request is still attempted */
  }
}

function announce() {
  window.dispatchEvent(new CustomEvent('overload:queue', { detail: cache.size }));
}

/** Loads the queue. Call once before rendering; never throws. */
export async function initOfflineStore(): Promise<void> {
  try {
    db = await openDb();
    const keys = await idb('readonly', (s) => s.getAllKeys());
    const values = await idb('readonly', (s) => s.getAll());
    keys.forEach((k, i) => cache.set(String(k), values[i] as PendingSet));
  } catch {
    db = null;
  }

  // Sets queued by 1.1 (or by the localStorage fallback) move over to IndexedDB.
  const local = readLocal();
  for (const [key, s] of Object.entries(local)) if (!cache.has(key)) cache.set(key, s);
  if (db && Object.keys(local).length) {
    try {
      for (const [key, s] of Object.entries(local)) await idb('readwrite', (st) => st.put(s, key));
      localStorage.removeItem(LOCAL_KEY);
    } catch {
      /* keep the localStorage copy; it is read again next start */
    }
  }
  announce();
}

export function pendingAll(): PendingSet[] {
  return [...cache.values()];
}

export function getPending(key: string): PendingSet | undefined {
  return cache.get(key);
}

export async function putPending(s: PendingSet): Promise<void> {
  const key = keyOf(s);
  cache.set(key, s);
  announce();
  if (db) {
    try {
      await idb('readwrite', (st) => st.put(s, key));
      return;
    } catch {
      /* fall through to localStorage */
    }
  }
  writeLocal();
}

export async function deletePending(key: string): Promise<void> {
  if (!cache.delete(key)) return;
  announce();
  if (db) {
    try {
      await idb('readwrite', (st) => st.delete(key));
      return;
    } catch {
      /* fall through to localStorage */
    }
  }
  writeLocal();
}
