// UI language: English by default, Dutch when the profile says so. Text is written in place as
// t('English', 'Nederlands'), so both languages sit next to each other and none can go missing.
// The language is module state: App sets it from /api/info and remounts the screens when it changes.
import type { Language } from '@shared/types.ts';

// Keeps the name from before the rename to Open Strength, so data already on devices survives.
const STORAGE_KEY = 'overload-language';

function initial(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'nl' ? 'nl' : 'en';
  } catch {
    return 'en';
  }
}

let current: Language = initial();
document.documentElement.lang = current;

export function getLang(): Language {
  return current;
}

/** Remembered per browser so the first paint (before /api/info) is already in the right language. */
export function setLang(lang: Language) {
  current = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Private mode or blocked storage: the profile still decides after loading.
  }
}

export function t(en: string, nl: string): string {
  return current === 'nl' ? nl : en;
}

/** Locale for dates. */
export function locale(): string {
  return current === 'nl' ? 'nl-NL' : 'en-GB';
}

/** Decimal separator: comma in Dutch (42,5), point in English (42.5). */
export function decimal(text: string): string {
  return current === 'nl' ? text.replace('.', ',') : text;
}
