// The exercise library rarely changes, so it is loaded once per page load and shared.
import { useEffect, useState } from 'react';
import type { ExerciseDef } from '@shared/types.ts';
import { api } from './api.ts';

let cache: Promise<ExerciseDef[]> | null = null;

export function loadExercises(): Promise<ExerciseDef[]> {
  cache ??= api.exercises().catch((err) => {
    cache = null;
    throw err;
  });
  return cache;
}

/** The library as a map by id; null while loading. */
export function useExercises(): Map<string, ExerciseDef> | null {
  const [map, setMap] = useState<Map<string, ExerciseDef> | null>(null);
  useEffect(() => {
    let live = true;
    loadExercises()
      .then((list) => live && setMap(new Map(list.map((e) => [e.id, e]))))
      .catch(() => live && setMap(new Map()));
    return () => {
      live = false;
    };
  }, []);
  return map;
}
