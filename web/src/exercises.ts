// The exercise library rarely changes, so it is loaded once per page load and shared.
import { useEffect, useState } from 'react';
import type { LibraryExercise } from '@shared/types.ts';
import { api } from './api.ts';
import { getLang } from './i18n.ts';

// One copy per language: names and steps of the curated exercises differ.
const cache: Partial<Record<string, Promise<LibraryExercise[]>>> = {};

export function loadExercises(): Promise<LibraryExercise[]> {
  const lang = getLang();
  cache[lang] ??= api.exercises(lang).catch((err) => {
    delete cache[lang];
    throw err;
  });
  return cache[lang];
}

/** The library as a map by id; null while loading. */
export function useExercises(): Map<string, LibraryExercise> | null {
  const [map, setMap] = useState<Map<string, LibraryExercise> | null>(null);
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
