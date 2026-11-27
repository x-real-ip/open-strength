// AI settings, editable in the app. Values saved here (settings table, key "ai") win over
// the environment (AI_PROVIDER, AI_MODEL, ANTHROPIC_API_KEY, ...), which only supplies
// defaults. Settings are cached in memory: there is one replica, and every save goes
// through saveAiSettings().
import type { AiSettingsUpdate, AiSettingsView, Effort } from '../../shared/types.ts';
import { config } from '../config.ts';
import { getSetting, run } from '../db.ts';

export interface AiSettings {
  provider: 'anthropic' | 'openai';
  model: string;
  baseUrl: string;
  apiKey: string;
  keySource: 'app' | 'env' | null;
  coachEffort: Effort | null;
  programEffort: Effort | null;
  monthlyBudgetUsd: number | null;
  timeoutMs: number;
}

/** What is stored in the settings table; every field is optional and overrides the environment. */
type Stored = Partial<{
  provider: 'anthropic' | 'openai';
  model: string;
  baseUrl: string;
  apiKey: string;
  coachEffort: Effort | null;
  programEffort: Effort | null;
  monthlyBudgetUsd: number | null;
}>;

/** List prices in USD per million tokens. Used to estimate cost; the Anthropic Console is the source of truth. */
export const MODEL_PRICES: Record<string, { label: string; input: number; output: number; cacheRead: number }> = {
  'claude-sonnet-5-5': { label: 'Claude Sonnet 5.5', input: 2, output: 10, cacheRead: 0.1 },
  'claude-haiku-5-5': { label: 'Claude Haiku 5.5', input: 0.1, output: 0.5, cacheRead: 0.01 },
  'claude-opus-5-5': { label: 'Claude Opus 5.5', input: 4, output: 20, cacheRead: 0.2 },
  // Models a refusal fallback can route to; not offered in the picker.
  'claude-sonnet-5': { label: 'Claude Sonnet 5', input: 2, output: 10, cacheRead: 0.2 },
  'claude-opus-5': { label: 'Claude Opus 5', input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-8': { label: 'Claude Opus 4.8', input: 5, output: 25, cacheRead: 0.5 },
};

export const PICKER_MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'];

/** Effort defaults when nothing is set: a quick coach, a more careful program designer. */
export const DEFAULT_EFFORT = { coach: 'low' as Effort, program: 'medium' as Effort };

const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

let stored: Stored = {};

export async function loadAiSettings(): Promise<void> {
  const raw = await getSetting('ai');
  try {
    stored = raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    stored = {};
  }
}

function defaultModel(provider: 'anthropic' | 'openai'): string {
  if (provider === config.ai.provider) return config.ai.model;
  return provider === 'anthropic' ? 'claude-sonnet-5-5' : 'gpt-4o-mini';
}

export function getAiSettings(): AiSettings {
  const provider = stored.provider ?? config.ai.provider;
  const appKey = stored.apiKey?.trim() || '';
  const apiKey = appKey || config.ai.apiKey;
  return {
    provider,
    model: stored.model?.trim() || defaultModel(provider),
    baseUrl: (stored.baseUrl?.trim() || (provider === config.ai.provider ? config.ai.baseUrl : '')).replace(/\/$/, ''),
    apiKey,
    keySource: appKey ? 'app' : config.ai.apiKey ? 'env' : null,
    coachEffort: stored.coachEffort === undefined ? DEFAULT_EFFORT.coach : stored.coachEffort,
    programEffort: stored.programEffort === undefined ? DEFAULT_EFFORT.program : stored.programEffort,
    monthlyBudgetUsd: stored.monthlyBudgetUsd ?? null,
    timeoutMs: config.ai.timeoutMs,
  };
}

/** OpenAI-compatible local servers (Ollama, LM Studio) often need no key, only an address. */
export function aiConfigured(): boolean {
  const s = getAiSettings();
  if (s.provider === 'openai') return Boolean(s.apiKey || s.baseUrl);
  return Boolean(s.apiKey);
}

export function aiSettingsView(): AiSettingsView {
  const s = getAiSettings();
  return {
    provider: s.provider,
    model: s.model,
    baseUrl: stored.baseUrl ?? '',
    keySource: s.keySource,
    keyHint: s.apiKey ? `…${s.apiKey.slice(-4)}` : null,
    coachEffort: s.coachEffort,
    programEffort: s.programEffort,
    monthlyBudgetUsd: s.monthlyBudgetUsd,
    configured: aiConfigured(),
    models: PICKER_MODELS.map((id) => ({ id, label: MODEL_PRICES[id].label, inputUsd: MODEL_PRICES[id].input, outputUsd: MODEL_PRICES[id].output })),
  };
}

function effortOrNull(v: unknown): Effort | null {
  return typeof v === 'string' && (EFFORTS as string[]).includes(v) ? (v as Effort) : null;
}

export async function saveAiSettings(update: AiSettingsUpdate): Promise<AiSettingsView> {
  const next: Stored = { ...stored };
  if (update.provider !== undefined) {
    if (update.provider !== next.provider) {
      // A different provider means a different model and address.
      delete next.model;
      delete next.baseUrl;
    }
    next.provider = update.provider;
  }
  if (update.model !== undefined) next.model = update.model.trim() || undefined;
  if (update.baseUrl !== undefined) next.baseUrl = update.baseUrl.trim() || undefined;
  if (update.apiKey === null) delete next.apiKey;
  else if (update.apiKey !== undefined && update.apiKey.trim()) next.apiKey = update.apiKey.trim();
  if (update.coachEffort !== undefined) next.coachEffort = effortOrNull(update.coachEffort);
  if (update.programEffort !== undefined) next.programEffort = effortOrNull(update.programEffort);
  if (update.monthlyBudgetUsd !== undefined) {
    const b = update.monthlyBudgetUsd;
    next.monthlyBudgetUsd = b === null || !(Number(b) > 0) ? null : Math.round(Number(b) * 100) / 100;
  }
  await run(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    ['ai', JSON.stringify(next)],
  );
  stored = next;
  return aiSettingsView();
}

/** Estimated cost in USD, or null when the model has no known price. */
export function estimateCost(model: string, usage: { input: number; output: number; cacheRead: number; cacheWrite: number }): number | null {
  const p = MODEL_PRICES[model];
  if (!p) return null;
  // Cache writes cost 1.25× the input price (5-minute cache).
  const usd = (usage.input * p.input + usage.output * p.output + usage.cacheRead * p.cacheRead + usage.cacheWrite * p.input * 1.25) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
