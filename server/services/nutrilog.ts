// The link with Open Nutrilog (the nutrition app). Optional: without NUTRILOG_URL and NUTRILOG_TOKEN everything
// works as before. Calls have a short timeout, answers are cached for a minute, and nothing here throws: when
// Open Nutrilog is down the link is "not reachable" and the app carries on.
//
// Open Nutrilog owns body weight when the apps are linked: weigh-ins logged here are sent there (and kept here
// too, so starting weights keep using your current weight). What can't be sent waits in integration_outbox.
//
// Nutrition is context only: the coach and program design get a summary, and a stall can get a note. The
// progression engine (progression.ts) never sees any of it.
import { config } from '../config.ts';
import { all, one, run } from '../db.ts';
import { loc, type Lang, type Localized } from '../i18n.ts';

export type LinkStatus = 'off' | 'ok' | 'unreachable';

/** What Open Nutrilog says about the last 14 days (GET /api/integration/v1/phase). */
export interface NutritionPhase {
  phase: 'cut' | 'maintain' | 'bulk';
  ratePctPerWeek: number;
  estimatedTdee: number | null;
  proteinGPerKg: number;
  avgProteinGPerKg14d: number | null;
  /** Average intake minus maintenance over the logged days (negative: a deficit). */
  avgEnergyBalance14d: number | null;
  loggedDays14d: number;
}

export function linked(): boolean {
  return Boolean(config.integration.nutrilogUrl && config.integration.nutrilogToken);
}

let lastStatus: LinkStatus = 'off';
const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_MS = 60_000;
/** After a failed call the other app is left alone for a while, so pages don't each wait for the timeout. */
const RETRY_AFTER_MS = 15_000;
let failedAt = 0;

export function clearNutrilogCache() {
  cache.clear();
  failedAt = 0;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${config.integration.nutrilogUrl}/api/integration/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.integration.nutrilogToken}`,
      accept: 'application/json',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(config.integration.timeoutMs),
  });
  if (!res.ok) throw new Error(`Open Nutrilog answered ${res.status}`);
  lastStatus = 'ok';
  return (res.status === 204 ? null : await res.json()) as T;
}

/** A cached GET that never throws: null when not linked or not reachable. */
async function cachedGet<T>(path: string): Promise<T | null> {
  if (!linked()) {
    lastStatus = 'off';
    return null;
  }
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  if (Date.now() - failedAt < RETRY_AFTER_MS) {
    lastStatus = 'unreachable';
    return null;
  }
  try {
    const value = await call<T>('GET', path);
    cache.set(path, { at: Date.now(), value });
    return value;
  } catch {
    lastStatus = 'unreachable';
    failedAt = Date.now();
    return null;
  }
}

export async function nutritionPhase(): Promise<NutritionPhase | null> {
  return cachedGet<NutritionPhase>('/phase');
}

/** The status after the latest call (or a fresh check). */
export async function linkStatus(): Promise<LinkStatus> {
  if (!linked()) return 'off';
  await nutritionPhase();
  return lastStatus;
}

// ---------- Context for the coach, program design and stalls ----------

/** Deficit as a share of maintenance (0.25 = 25 % below). Null when unknown. */
export function deficitShare(n: NutritionPhase): number | null {
  if (n.avgEnergyBalance14d === null || !n.estimatedTdee) return null;
  return -n.avgEnergyBalance14d / n.estimatedTdee;
}

const pct = (x: number) => Math.round(x * 100);
const dec = (x: number, lang: Lang) => (lang === 'nl' ? x.toFixed(1).replace('.', ',') : x.toFixed(1));

/** Two or three plain lines about the last two weeks of eating, for the coach and the program prompt. */
export function nutritionFacts(n: NutritionPhase, lang: Lang): string {
  const T = (en: string, nl: string) => (lang === 'nl' ? nl : en);
  const phase = { cut: T('losing fat', 'afvallen'), maintain: T('maintaining', 'op gewicht blijven'), bulk: T('building', 'aankomen') }[n.phase];
  const lines = [
    T(
      `Nutrition phase (from Open Nutrilog): ${phase}${n.phase === 'maintain' ? '' : `, ${dec(n.ratePctPerWeek, lang)} % of body weight per week`}.`,
      `Voedingsfase (uit Open Nutrilog): ${phase}${n.phase === 'maintain' ? '' : `, ${dec(n.ratePctPerWeek, lang)} % van het lichaamsgewicht per week`}.`,
    ),
  ];
  if (n.loggedDays14d === 0) {
    lines.push(T('No meals logged in the last 14 days.', 'De laatste 14 dagen geen maaltijden gelogd.'));
    return lines.join('\n');
  }
  const share = deficitShare(n);
  if (n.avgEnergyBalance14d !== null) {
    const kcal = Math.round(n.avgEnergyBalance14d);
    lines.push(
      T(
        `Last 14 days (${n.loggedDays14d} days logged): on average ${kcal >= 0 ? `${kcal} kcal above` : `${-kcal} kcal below`} maintenance${share !== null ? ` (${pct(Math.abs(share))} %)` : ''}${n.estimatedTdee ? `, maintenance about ${Math.round(n.estimatedTdee)} kcal` : ''}.`,
        `Laatste 14 dagen (${n.loggedDays14d} dagen gelogd): gemiddeld ${kcal >= 0 ? `${kcal} kcal boven` : `${-kcal} kcal onder`} onderhoud${share !== null ? ` (${pct(Math.abs(share))} %)` : ''}${n.estimatedTdee ? `, onderhoud ongeveer ${Math.round(n.estimatedTdee)} kcal` : ''}.`,
      ),
    );
  }
  if (n.avgProteinGPerKg14d !== null) {
    lines.push(
      T(
        `Protein: ${dec(n.avgProteinGPerKg14d, lang)} g per kg body weight on average (target ${dec(n.proteinGPerKg, lang)}).`,
        `Eiwit: gemiddeld ${dec(n.avgProteinGPerKg14d, lang)} g per kg lichaamsgewicht (doel ${dec(n.proteinGPerKg, lang)}).`,
      ),
    );
  }
  return lines.join('\n');
}

/**
 * A plain-language note for a stall when the eating explains it: a deficit of more than 20 % of maintenance, or
 * less than 1.6 g protein per kg. Only an explanation: the progression engine doesn't change.
 */
export function stallNote(exercise: string, sessions: number, n: NutritionPhase | null): Localized | null {
  if (!n || n.loggedDays14d === 0) return null;
  const share = deficitShare(n);
  const bigDeficit = share !== null && share > 0.2;
  const lowProtein = n.avgProteinGPerKg14d !== null && n.avgProteinGPerKg14d < 1.6;
  if (!bigDeficit && !lowProtein) return null;
  const parts: Localized[] = [];
  if (bigDeficit) parts.push(loc(`averaged ${pct(share!)} % below maintenance`, `${pct(share!)} % onder onderhoud`));
  if (lowProtein) {
    const g = n.avgProteinGPerKg14d!;
    parts.push(loc(`${g.toFixed(1)} g/kg protein`, `${g.toFixed(1).replace('.', ',')} g/kg eiwit`));
  }
  const join = (l: 'en' | 'nl') => parts.map((p) => p[l]).join(l === 'nl' ? ' en ' : ' and ');
  return loc(
    `${exercise} has stalled for ${sessions} sessions; you've ${join('en')} over the last two weeks.`,
    `${exercise} staat al ${sessions} trainingen stil; je at de afgelopen twee weken gemiddeld ${join('nl')}.`,
  );
}

/**
 * A gentle warning when the training goal and the nutrition phase pull different ways. Neither app changes the
 * other's setting.
 */
export function goalClash(goal: string, n: NutritionPhase | null): Localized | null {
  if (!n) return null;
  const share = deficitShare(n);
  if ((goal === 'hypertrophy' || goal === 'strength') && n.phase === 'cut' && (share ?? n.ratePctPerWeek / 100) > 0.15) {
    return loc(
      'Your training goal is to build, but you are in a large deficit in Open Nutrilog. Expect slower progress, or eat closer to maintenance.',
      'Je trainingsdoel is opbouwen, maar je zit in Open Nutrilog in een groot tekort. Reken op tragere vooruitgang, of eet dichter bij onderhoud.',
    );
  }
  if (goal === 'fat_loss' && (n.phase === 'bulk' || (share !== null && share < 0))) {
    return loc(
      'Your training goal is fat loss, but Open Nutrilog has you eating above maintenance.',
      'Je trainingsdoel is vetverlies, maar volgens Open Nutrilog eet je boven onderhoud.',
    );
  }
  return null;
}

// ---------- Body weight: Open Nutrilog owns it when linked ----------

/** Sends a weigh-in (or its removal) to Open Nutrilog; queues it when that fails. Never throws. */
export async function sendWeight(day: string, weightKg: number | null): Promise<void> {
  if (!linked()) return;
  try {
    if (weightKg === null) await call('DELETE', `/body-weights/${day}`);
    else await call('PUT', `/body-weights/${day}`, { weightKg });
  } catch (err) {
    lastStatus = 'unreachable';
    await run(`INSERT INTO integration_outbox (kind, day, weight_kg, last_error) VALUES ($1, $2, $3, $4)`, [
      weightKg === null ? 'weight_delete' : 'weight_put',
      day,
      weightKg,
      (err as Error).message.slice(0, 200),
    ]).catch(() => {});
  }
}

/** Retries what is queued, oldest first; stops at the first failure so the order is kept. */
export async function flushOutbox(): Promise<number> {
  if (!linked()) return 0;
  const rows = await all<{ id: number; kind: string; day: string; weight_kg: number | null }>('SELECT id, kind, day, weight_kg FROM integration_outbox ORDER BY id');
  let sent = 0;
  for (const r of rows) {
    try {
      if (r.kind === 'weight_delete') await call('DELETE', `/body-weights/${r.day}`);
      else await call('PUT', `/body-weights/${r.day}`, { weightKg: r.weight_kg });
      await run('DELETE FROM integration_outbox WHERE id = $1', [r.id]);
      sent++;
    } catch (err) {
      lastStatus = 'unreachable';
      await run('UPDATE integration_outbox SET attempts = attempts + 1, last_error = $2 WHERE id = $1', [r.id, (err as Error).message.slice(0, 200)]);
      break;
    }
  }
  return sent;
}

export async function outboxSize(): Promise<number> {
  return (await one<{ n: number }>('SELECT count(*)::int AS n FROM integration_outbox'))!.n;
}

let timer: NodeJS.Timeout | null = null;

/** Retries the outbox every minute (one replica; started by index.ts). */
export function startOutboxRetry() {
  if (timer || !linked()) return;
  timer = setInterval(() => void flushOutbox().catch(() => {}), 60_000);
  timer.unref();
}
