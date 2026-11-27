// Records every AI call and summarises the spend for the usage page and the monthly budget.
import type { AiFeature, AiUsageEntry, AiUsageSummary } from '../../shared/types.ts';
import { all, one, run } from '../db.ts';
import { loc, type Localized } from '../i18n.ts';
import { estimateCost, getAiSettings } from './aiSettings.ts';

export interface UsageRecord {
  feature: AiFeature;
  provider: string;
  model: string;
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  ok: boolean;
  error?: string;
}

export async function recordUsage(r: UsageRecord): Promise<void> {
  const cacheRead = r.cacheRead ?? 0;
  const cacheWrite = r.cacheWrite ?? 0;
  const cost = r.provider === 'anthropic' ? estimateCost(r.model, { input: r.input, output: r.output, cacheRead, cacheWrite }) : null;
  await run(
    `INSERT INTO ai_usage (feature, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, ok, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [r.feature, r.provider, r.model, r.input, r.output, cacheRead, cacheWrite, cost, r.ok, r.error?.slice(0, 300) ?? null],
  );
}

// Months follow the Dutch calendar, so "this month" flips at midnight in Amsterdam.
const MONTH_START_SQL = `(date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam')`;
const PREV_MONTH_START_SQL = `((date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') - interval '1 month') AT TIME ZONE 'Europe/Amsterdam')`;

export async function monthCostUsd(): Promise<number> {
  const row = await one<{ c: number | null }>(`SELECT sum(cost_usd) AS c FROM ai_usage WHERE created_at >= ${MONTH_START_SQL}`);
  return row?.c ?? 0;
}

export class BudgetExceeded extends Error {
  status = 429;
  text: Localized;
  constructor(text: Localized) {
    super(text.en);
    this.text = text;
  }
}

/** Throws when this month's estimated spend has reached the budget. */
export async function checkBudget(): Promise<void> {
  const budget = getAiSettings().monthlyBudgetUsd;
  if (budget === null) return;
  const spent = await monthCostUsd();
  if (spent >= budget) {
    throw new BudgetExceeded(
      loc(
        `The monthly AI budget ($${budget.toFixed(2)}) has been reached. Raise it in the AI settings or wait until next month.`,
        `Het maandbudget voor AI ($${budget.toFixed(2)}) is bereikt. Verhoog het in de AI-instellingen of wacht tot volgende maand.`,
      ),
    );
  }
}

export async function usageSummary(): Promise<AiUsageSummary> {
  const m = (await one<any>(
    `SELECT ${MONTH_START_SQL} AS start, count(*)::int AS calls,
            coalesce(sum(input_tokens + cache_read_tokens + cache_write_tokens), 0)::int AS input,
            coalesce(sum(output_tokens), 0)::int AS output, coalesce(sum(cost_usd), 0) AS cost,
            count(*) FILTER (WHERE NOT ok)::int AS failed,
            coalesce(bool_or(cost_usd IS NULL AND provider = 'anthropic'), false) AS unpriced
     FROM ai_usage WHERE created_at >= ${MONTH_START_SQL}`,
  ))!;
  const prev = (await one<{ c: number | null }>(
    `SELECT sum(cost_usd) AS c FROM ai_usage WHERE created_at >= ${PREV_MONTH_START_SQL} AND created_at < ${MONTH_START_SQL}`,
  ))!;
  const byFeature = await all<any>(
    `SELECT feature, count(*)::int AS calls, coalesce(sum(cost_usd), 0) AS cost,
            coalesce(sum(input_tokens + cache_read_tokens + cache_write_tokens), 0)::int AS input,
            coalesce(sum(output_tokens), 0)::int AS output
     FROM ai_usage WHERE created_at >= ${MONTH_START_SQL} GROUP BY feature ORDER BY cost DESC`,
  );
  const daily = await all<any>(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(sum(u.cost_usd), 0) AS cost, count(u.id)::int AS calls
     FROM generate_series((now() AT TIME ZONE 'Europe/Amsterdam')::date - 29, (now() AT TIME ZONE 'Europe/Amsterdam')::date, interval '1 day') AS d
     LEFT JOIN ai_usage u ON (u.created_at AT TIME ZONE 'Europe/Amsterdam')::date = d::date
     GROUP BY d ORDER BY d`,
  );
  const recent = await all<any>('SELECT * FROM ai_usage ORDER BY id DESC LIMIT 20');
  return {
    month: { start: m.start, calls: m.calls, inputTokens: m.input, outputTokens: m.output, costUsd: m.cost, failed: m.failed },
    previousMonthCostUsd: prev.c ?? 0,
    budgetUsd: getAiSettings().monthlyBudgetUsd,
    byFeature: byFeature.map((f) => ({ feature: f.feature, calls: f.calls, costUsd: f.cost, inputTokens: f.input, outputTokens: f.output })),
    daily: daily.map((d) => ({ day: d.day, costUsd: d.cost, calls: d.calls })),
    recent: recent.map(
      (r): AiUsageEntry => ({
        id: r.id,
        createdAt: r.created_at,
        feature: r.feature,
        model: r.model,
        inputTokens: r.input_tokens + r.cache_read_tokens + r.cache_write_tokens,
        outputTokens: r.output_tokens,
        costUsd: r.cost_usd,
        ok: r.ok,
        error: r.error,
      }),
    ),
    hasUnpricedCalls: Boolean(m.unpriced),
  };
}
