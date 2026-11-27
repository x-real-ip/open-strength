import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { complete } from '../services/ai.ts';
import { aiSettingsView, saveAiSettings } from '../services/aiSettings.ts';
import { usageSummary } from '../services/aiUsage.ts';
import { AI_LANGUAGE, langOf } from '../i18n.ts';
import { getProfile } from '../services/profile.ts';

const effort = z.enum(['low', 'medium', 'high', 'xhigh', 'max']).nullable();

const updateSchema = z
  .object({
    provider: z.enum(['anthropic', 'openai']),
    model: z.string().max(100),
    baseUrl: z.union([z.literal(''), z.string().url().max(300)]),
    apiKey: z.string().max(400).nullable(),
    coachEffort: effort,
    programEffort: effort,
    monthlyBudgetUsd: z.number().min(0).max(10_000).nullable(),
  })
  .partial()
  .strict();

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/settings/ai', async () => aiSettingsView());

  app.put('/api/settings/ai', async (req) => saveAiSettings(updateSchema.parse(req.body)));

  // A tiny request to check key, model and connection. Costs a fraction of a cent.
  app.post('/api/settings/ai/test', async () => {
    const started = Date.now();
    const lang = langOf(await getProfile());
    const reply = await complete({
      feature: 'test',
      system: `You are a connection check. Reply with one short ${AI_LANGUAGE[lang]} sentence confirming that you work.`,
      messages: [{ role: 'user', content: lang === 'nl' ? 'Werk je?' : 'Do you work?' }],
      maxTokens: 2000,
    });
    return { ok: true, reply: reply.slice(0, 300), ms: Date.now() - started };
  });

  app.get('/api/usage', async () => usageSummary());
}
