// Thin provider abstraction. Claude goes through the official Anthropic SDK; any
// OpenAI-compatible chat completions endpoint (OpenAI, Ollama, LM Studio, LiteLLM, ...)
// through fetch. Settings come from aiSettings.ts (app settings over environment).
// Every call is recorded in ai_usage. API keys never leave the server.
import Anthropic from '@anthropic-ai/sdk';
import type { AiFeature, Effort } from '../../shared/types.ts';
import { aiConfigured, getAiSettings, type AiSettings } from './aiSettings.ts';
import { loc, type Localized } from '../i18n.ts';
import { BudgetExceeded, checkBudget, recordUsage } from './aiUsage.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  feature: AiFeature;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  /** Ask the model for a single JSON object. */
  json?: boolean;
}

const TIMED_OUT = loc('The AI took too long. Try again.', 'De AI deed er te lang over. Probeer het opnieuw.');
const EMPTY = loc('The AI gave an empty answer.', 'De AI gaf een leeg antwoord.');

/** AI failure shown to the user: English and Dutch text (the error handler picks one). */
export class AiError extends Error {
  status: number;
  text: Localized;
  constructor(message: string | Localized, status = 502) {
    const text = typeof message === 'string' ? { en: message, nl: message } : message;
    super(text.en);
    this.text = text;
    this.status = status;
  }
}

/** Models that accept the server-side refusal fallback ("default" routing). */
const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-2', 'claude-fable-5-1']);

function effortFor(feature: AiFeature, s: AiSettings): Effort | null {
  if (feature === 'coach') return s.coachEffort;
  if (feature === 'program') return s.programEffort;
  return 'low';
}

export async function complete(req: CompletionRequest): Promise<string> {
  if (!aiConfigured())
    throw new AiError(loc('No AI is set up. Add an API key in the AI settings.', 'Er is geen AI ingesteld. Voeg een API-sleutel toe in de AI-instellingen.'), 503);
  try {
    await checkBudget();
  } catch (err) {
    throw err instanceof BudgetExceeded ? new AiError(err.text, 503) : err;
  }
  const s = getAiSettings();
  return s.provider === 'anthropic' ? completeAnthropic(req, s) : completeOpenAi(req, s);
}

function apiErrorMessage(err: unknown): AiError {
  // Most specific first; all SDK errors extend Anthropic.APIError.
  if (err instanceof Anthropic.AuthenticationError)
    return new AiError(loc('The API key was not accepted. Check it in the AI settings.', 'De API-sleutel wordt niet geaccepteerd. Controleer hem in de AI-instellingen.'), 502);
  if (err instanceof Anthropic.PermissionDeniedError)
    return new AiError(loc('This API key has no access to this model.', 'Deze API-sleutel heeft geen toegang tot dit model.'), 502);
  if (err instanceof Anthropic.NotFoundError)
    return new AiError(loc('This model does not exist or is not available to your account.', 'Dit model bestaat niet of is niet beschikbaar voor je account.'), 502);
  if (err instanceof Anthropic.RateLimitError)
    return new AiError(
      loc('Too many requests, or your Anthropic limit was reached. Try again later.', 'Te veel verzoeken of je limiet bij Anthropic is bereikt. Probeer het later opnieuw.'),
      502,
    );
  if (err instanceof Anthropic.BadRequestError)
    return new AiError(loc(`The AI provider rejected the request: ${err.message}`, `De AI-provider weigerde het verzoek: ${err.message}`), 502);
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new AiError(TIMED_OUT, 504);
  if (err instanceof Anthropic.APIConnectionError)
    return new AiError(loc('No connection to the AI provider. Does the server have outbound internet?', 'Geen verbinding met de AI-provider. Heeft de server uitgaand internet?'), 504);
  if (err instanceof Anthropic.APIError)
    return new AiError(loc(`AI provider error (${err.status ?? 'unknown'}).`, `Fout bij de AI-provider (${err.status ?? 'onbekend'}).`), 502);
  return new AiError(loc(`AI request failed: ${(err as Error).message}`, `AI-verzoek mislukt: ${(err as Error).message}`));
}

async function completeAnthropic(req: CompletionRequest, s: AiSettings): Promise<string> {
  const client = new Anthropic({ apiKey: s.apiKey, baseURL: s.baseUrl || undefined, timeout: s.timeoutMs, maxRetries: 2 });
  const effort = effortFor(req.feature, s);
  const params = {
    model: s.model,
    // Thinking counts towards max_tokens, so leave room; only what is used is billed.
    max_tokens: req.maxTokens ?? 8000,
    system: req.system,
    messages: req.messages,
    ...(effort ? { output_config: { effort } } : {}),
  };

  let response: Anthropic.Message | Anthropic.Beta.BetaMessage;
  try {
    response = FALLBACK_MODELS.has(s.model)
      ? // On a safety decline the API retries on a fallback model within the same call.
        await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);
  } catch (err) {
    const mapped = apiErrorMessage(err);
    await recordUsage({ feature: req.feature, provider: 'anthropic', model: s.model, input: 0, output: 0, ok: false, error: mapped.message });
    throw mapped;
  }

  const text = response.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('')
    .trim();
  const problem =
    response.stop_reason === 'refusal'
      ? loc('The model refused this request.', 'Het model weigerde dit verzoek.')
      : response.stop_reason === 'max_tokens'
        ? loc('The answer was too long and was cut off.', 'Het antwoord was te lang en is afgekapt.')
        : !text
          ? EMPTY
          : null;
  const u = response.usage;
  await recordUsage({
    feature: req.feature,
    provider: 'anthropic',
    model: response.model,
    input: u.input_tokens,
    output: u.output_tokens,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    ok: !problem,
    error: problem?.en,
  });
  if (problem) throw new AiError(problem);
  return text;
}

async function completeOpenAi(req: CompletionRequest, s: AiSettings): Promise<string> {
  const base = s.baseUrl || 'https://api.openai.com/v1';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (s.apiKey) headers.authorization = `Bearer ${s.apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), s.timeoutMs);
  let data: any;
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: s.model,
        max_tokens: req.maxTokens ?? 8000,
        messages: [{ role: 'system', content: req.system }, ...req.messages],
        ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    const body = await res.text();
    if (!res.ok) throw new AiError(loc(`The AI provider returned error ${res.status}: ${body.slice(0, 200)}`, `De AI-provider gaf fout ${res.status}: ${body.slice(0, 200)}`));
    data = JSON.parse(body);
  } catch (err) {
    const mapped =
      err instanceof AiError
        ? err
        : (err as Error).name === 'AbortError'
          ? new AiError(TIMED_OUT, 504)
          : new AiError(loc(`AI request failed: ${(err as Error).message}`, `AI-verzoek mislukt: ${(err as Error).message}`));
    await recordUsage({ feature: req.feature, provider: 'openai', model: s.model, input: 0, output: 0, ok: false, error: mapped.message });
    throw mapped;
  } finally {
    clearTimeout(timer);
  }
  const text: string = data.choices?.[0]?.message?.content ?? '';
  await recordUsage({
    feature: req.feature,
    provider: 'openai',
    model: data.model ?? s.model,
    input: data.usage?.prompt_tokens ?? 0,
    output: data.usage?.completion_tokens ?? 0,
    ok: Boolean(text),
    error: text ? undefined : EMPTY.en,
  });
  if (!text) throw new AiError(EMPTY);
  return text;
}

/** Extract the first JSON object from a model response (tolerates code fences and prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new AiError('AI response contained no JSON object');
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AiError('AI response contained invalid JSON');
  }
}
