// User-facing text on the server comes in English and Dutch; the profile picks one (default English).
// Text that is stored (engine advice, rule-based program names) keeps both languages as JSON, so
// switching language also applies to what is already in the database.
import type { Language, Profile } from '../shared/types.ts';

export type Lang = Language;

export interface Localized {
  en: string;
  nl: string;
}

export const loc = (en: string, nl: string): Localized => ({ en, nl });

export function langOf(profile: Pick<Profile, 'language'> | null | undefined): Lang {
  return profile?.language ?? 'en';
}

/** Serialize for a text column. */
export function encode(text: Localized): string {
  return JSON.stringify(text);
}

/** Text in the given language: a Localized value, its JSON form, or plain (older, untranslated) text. */
export function pick(text: Localized | string | null | undefined, lang: Lang): string {
  if (!text) return '';
  if (typeof text !== 'string') return text[lang];
  if (text.startsWith('{"en"')) {
    try {
      const parsed = JSON.parse(text) as Localized;
      if (typeof parsed.en === 'string' && typeof parsed.nl === 'string') return parsed[lang];
    } catch {
      // Not ours: plain text that happens to start like JSON.
    }
  }
  return text;
}

/** Error with a message in both languages; the error handler picks the profile's language. */
export class UserError extends Error {
  status: number;
  text: Localized;
  constructor(status: number, en: string, nl: string) {
    super(en);
    this.status = status;
    this.text = { en, nl };
  }
}

/** "42.5 kg" in English, "42,5 kg" in Dutch. */
export function formatKg(weight: number, lang: Lang): string {
  const n = Number.isInteger(weight) ? String(weight) : weight.toFixed(2).replace(/0$/, '');
  return `${lang === 'nl' ? n.replace('.', ',') : n} kg`;
}

/** "Set 2" / "Sets 2, 3 and 4" (Dutch: "en"). */
export function setNumbers(indices: number[], lang: Lang): string {
  const n = indices.map((i) => i + 1);
  if (n.length === 1) return `Set ${n[0]}`;
  return `Sets ${n.slice(0, -1).join(', ')} ${lang === 'nl' ? 'en' : 'and'} ${n[n.length - 1]}`;
}

/** Name of the language for AI prompts. */
export const AI_LANGUAGE: Record<Lang, string> = { en: 'English', nl: 'Dutch' };
